package com.sep490.bms.service.location;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.core.io.Resource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import com.sep490.bms.dto.location.CreateServiceRegistrationRequest;
import com.sep490.bms.dto.location.RejectServiceRegistrationRequest;
import com.sep490.bms.dto.location.ServiceRegistrationDto;
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.location.ServiceRegistration;
import com.sep490.bms.entity.location.ServiceTerm;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.location.ServiceRegistrationRepository;
import com.sep490.bms.repository.location.ServiceTermRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.account.OtpLockService;
import com.sep490.bms.service.integration.EmailService;
import com.sep490.bms.service.integration.FileStorageService;
import com.sep490.bms.service.notification.NotificationService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh (Leader code lại theo D168, D169)
 * UC05 và UC06 - Đăng ký và duyệt sử dụng dịch vụ (FR10, FR11, FR12, BR61, BR65).
 *
 * Guest hoặc Owner điền đơn kèm số năm thuê, chuyển khoản trước tiền thuê (P35), đính kèm ảnh chứng từ,
 * đồng ý điều khoản rồi gửi (PENDING, không tự hết hạn). Admin thấy tiền về thì duyệt: hệ thống tạo địa điểm,
 * sinh đủ số sân mà đơn khai báo ("Sân 1".."Sân N"), ghi thời hạn từ ngày duyệt theo số năm thuê,
 * tạo tài khoản Owner với tên đăng nhập và mật khẩu do hệ thống sinh (đơn của Guest) và gửi email MSG116.
 * Admin từ chối thì bắt buộc ghi lý do, hệ thống gửi email MSG117.
 * Gửi email lỗi thì hủy cả lần duyệt/từ chối để chủ sân không bị mất tài khoản hoặc kết quả; Admin thử lại.
 * Đơn đã xử lý không được xử lý lại (tránh tạo trùng địa điểm).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ServiceRegistrationService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final int USERNAME_ATTEMPTS = 20;
    private static final DateTimeFormatter EMAIL_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /**
     * Trần số sân của một đơn đăng ký. Số sân được dùng để sinh sân thật khi duyệt đơn,
     * nên phải chặn trần để một đơn sai không tạo ra hàng nghìn dòng trong bảng court.
     */
    private static final int MAX_COURT_COUNT = 50;

    /** Đề xuất, chưa duyệt: trần số năm thuê trên một đơn (DR29 chỉ quy định tối thiểu 1 năm). */
    private static final int MAX_RENTAL_YEARS = 10;

    private final ServiceRegistrationRepository serviceRegistrationRepository;
    private final ServiceTermRepository serviceTermRepository;
    private final LocationRepository locationRepository;
    private final CourtRepository courtRepository;
    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final NotificationService notifications;
    private final OtpLockService contactLocks;
    private final FileStorageService files;
    private final EmailService emails;
    private final OwnerCredentialGenerator credentials;

    /** Tài khoản Owner vừa tạo kèm mật khẩu gốc, chỉ dùng để gửi email MSG116 rồi bỏ. */
    private record NewOwner(Account account, String rawPassword) {
    }

    /** UC05 - Guest đăng ký dịch vụ hoặc Owner đăng ký thêm địa điểm (FR10). */
    @Transactional
    public ServiceRegistrationDto submit(UserPrincipal user, CreateServiceRegistrationRequest request,
            MultipartFile proof, MultipartFile identityDocument, MultipartFile businessLicense) {
        requireCanRegister(user, request);
        if (!Boolean.TRUE.equals(request.getTermsAccepted())) {
            throw new AppException("Vui lòng đọc và đồng ý điều khoản sử dụng dịch vụ");
        }
        if (proof == null || proof.isEmpty()) {
            throw new AppException("Vui lòng đính kèm ảnh chứng từ chuyển khoản tiền thuê");
        }
        if (!Boolean.TRUE.equals(request.getPrivacyAccepted())) {
            throw new AppException("Vui lòng đồng ý cam kết bảo mật và xác minh hồ sơ");
        }
        if (identityDocument == null || identityDocument.isEmpty()) throw new AppException("Vui lòng đính kèm CCCD chủ sân");
        if (businessLicense == null || businessLicense.isEmpty()) throw new AppException("Vui lòng đính kèm giấy phép kinh doanh");
        // Kiểm tra lại toàn bộ dù form đã gọi check(): email, số điện thoại có thể vừa bị người khác dùng (D181).
        Draft draft = validateDraft(user, request, true);
        files.validateRegistrationDocument(identityDocument, "CCCD chủ sân");
        files.validateRegistrationDocument(businessLicense, "giấy phép kinh doanh");

        // Kiểm tra xong mọi thứ mới lưu ảnh, để đơn bị từ chối vì dữ liệu sai không để lại file rác.
        List<String> uploaded = new ArrayList<>();
        boolean synchronizedTransaction = TransactionSynchronizationManager.isSynchronizationActive();
        if (synchronizedTransaction) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCompletion(int status) {
                    if (status != STATUS_COMMITTED) cleanupUploads(uploaded);
                }
            });
        }
        try {
            String proofPath = files.storeImage(proof, "service-registration-proofs");
            uploaded.add(proofPath);
            String identityPath = files.storeRegistrationDocument(identityDocument, "service-registration-identities", "CCCD chủ sân");
            uploaded.add(identityPath);
            String licensePath = files.storeRegistrationDocument(businessLicense, "service-registration-licenses", "giấy phép kinh doanh");
            uploaded.add(licensePath);
            LocalDateTime now = LocalDateTime.now();
            ServiceRegistration entity = ServiceRegistration.builder()
                    .requesterId(draft.owner() == null ? null : draft.owner().getId())
                    .locationName(draft.locationName())
                    .address(draft.address())
                    .latitude(request.getLatitude())
                    .longitude(request.getLongitude())
                    .courtCount(draft.courtCount())
                    .rentalYears(draft.rentalYears())
                    .rentalAmount(RentalFeeCalculator.amount(draft.courtCount(), draft.rentalYears()))
                    .proofImagePath(proofPath)
                    .termsAcceptedAt(now)
                    .identityDocumentPath(identityPath)
                    .businessLicensePath(licensePath)
                    .privacyAcceptedAt(now)
                    .contactName(draft.contactName())
                    .contactPhone(draft.contactPhone())
                    .contactEmail(draft.contactEmail())
                    .status(ApprovalStatus.PENDING)
                    .build();

            ServiceRegistration saved = serviceRegistrationRepository.save(entity);
            for (Account admin : accountRepository.findByRoleAndStatus(Role.ADMIN, AccountStatus.ACTIVE)) {
                notifications.notifyOnce(admin.getId(), "SERVICE_REGISTRATION_SUBMITTED", "Có đơn đăng ký dịch vụ mới",
                        "Địa điểm " + saved.getLocationName() + " đang chờ xét duyệt.",
                        "SERVICE_REGISTRATION", saved.getId());
            }
            return ServiceRegistrationDto.fromEntity(saved, draft.contactName());
        } catch (RuntimeException ex) {
            if (!synchronizedTransaction) cleanupUploads(uploaded);
            throw ex;
        }
    }

    private void cleanupUploads(List<String> paths) {
        for (String path : paths) {
            if (path == null) continue;
            try { files.discardImage(path); }
            catch (RuntimeException ex) { log.warn("Không dọn được tệp của hồ sơ đăng ký bị rollback", ex); }
        }
    }

    /**
     * UC05 #2 - Kiểm tra thông tin trước khi form hiện QR chuyển khoản (FR10, D181).
     * Chạy đúng các kiểm tra của submit() trừ điều khoản và ảnh chứng từ; không lưu gì, không giữ email/số điện thoại.
     */
    @Transactional(readOnly = true)
    public void check(UserPrincipal user, CreateServiceRegistrationRequest request) {
        requireCanRegister(user, request);
        validateDraft(user, request, false);
    }

    /** Thông tin đơn đã kiểm tra và chuẩn hóa, dùng chung cho check() và submit(). */
    private record Draft(Account owner, int courtCount, int rentalYears, String locationName, String address,
            String contactName, String contactPhone, String contactEmail) {
    }

    private void requireCanRegister(UserPrincipal user, CreateServiceRegistrationRequest request) {
        if (user != null && user.getRole() != Role.OWNER) {
            throw new AppException("Chỉ Owner mới được đăng ký sử dụng dịch vụ", HttpStatus.FORBIDDEN);
        }
        if (request == null) {
            throw new AppException("Thiếu thông tin đơn đăng ký");
        }
    }

    /**
     * Kiểm tra dữ liệu đơn (DR19), email và số điện thoại (MSG103, DR01), yêu cầu Chờ xử lý trùng (D180),
     * địa điểm trùng của Owner. forSubmit = true thì khóa tài khoản Owner và email, số điện thoại tới hết giao dịch.
     */
    private Draft validateDraft(UserPrincipal user, CreateServiceRegistrationRequest request, boolean forSubmit) {
        int courtCount = validateCourtCount(request.getCourtCount());
        int rentalYears = validateRentalYears(request.getRentalYears());
        if (request.getLatitude() == null || request.getLongitude() == null) {
            throw new AppException("Hãy chọn vị trí địa điểm trên bản đồ");
        }
        if (request.getLatitude().abs().compareTo(BigDecimal.valueOf(90)) > 0
                || request.getLongitude().abs().compareTo(BigDecimal.valueOf(180)) > 0) {
            throw new AppException("Tọa độ địa điểm không hợp lệ");
        }
        Account owner = user == null ? null : forSubmit ? lockOwner(user.getId()) : findOwner(user.getId());
        String contactName = owner == null
                ? requireText(request.getContactName(), "Họ tên người đại diện", 50) : owner.getFullName();
        String contactPhone = owner == null
                ? requireText(request.getContactPhone(), "Số điện thoại", 10) : owner.getPhone();
        String contactEmail = owner == null
                ? requireText(request.getContactEmail(), "Email", 100).toLowerCase(Locale.ROOT) : owner.getEmail();
        String locationName = requireText(request.getLocationName(), "Tên địa điểm", 100);
        String address = requireText(request.getAddress(), "Địa chỉ", 255);
        if (contactName == null || !contactName.matches(com.sep490.bms.dto.request.ValidationRules.NAME)) {
            throw new AppException("Họ tên chỉ được chứa chữ và khoảng trắng, không chứa số hoặc ký tự đặc biệt");
        }
        if (contactPhone == null || !contactPhone.matches("^0[0-9]{9}$")) {
            throw new AppException("Số điện thoại liên hệ phải gồm đúng 10 chữ số và bắt đầu bằng 0");
        }
        if (contactEmail == null || !contactEmail.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new AppException("Email liên hệ không hợp lệ");
        }
        if (owner == null) {
            if (forSubmit) {
                lockContact(contactEmail, contactPhone);
            }
            requireAvailableContact(contactEmail, contactPhone);
            requireNoPendingGuestRegistration(contactEmail, contactPhone);
        } else {
            requireNewOwnerLocation(owner.getId(), locationName, address);
            boolean pending = serviceRegistrationRepository
                    .findAllByRequesterIdAndStatusOrderByCreatedAtDescIdDesc(owner.getId(), ApprovalStatus.PENDING)
                    .stream()
                    .anyMatch(item -> sameVenue(locationName, address, item.getLocationName(), item.getAddress()));
            if (pending) {
                throw new AppException("Địa điểm này đã có đơn đăng ký đang chờ duyệt.", HttpStatus.CONFLICT);
            }
        }
        return new Draft(owner, courtCount, rentalYears, locationName, address,
                contactName, contactPhone, contactEmail);
    }

    /** UC05 - Owner xem các đơn mình đã gửi, lọc tuỳ chọn theo trạng thái. */
    @Transactional(readOnly = true)
    public List<ServiceRegistrationDto> listMine(UserPrincipal user, String status) {
        if (user == null) {
            throw new AppException("Chưa đăng nhập", HttpStatus.UNAUTHORIZED);
        }
        ApprovalStatus filter = parseStatus(status);
        List<ServiceRegistration> items = filter == null
                ? serviceRegistrationRepository.findAllByRequesterIdOrderByCreatedAtDescIdDesc(user.getId())
                : serviceRegistrationRepository.findAllByRequesterIdAndStatusOrderByCreatedAtDescIdDesc(
                        user.getId(), filter);
        return toDtos(items);
    }

    /** UC06 #1 - Admin xem toàn bộ đơn, lọc tuỳ chọn theo trạng thái. */
    @Transactional(readOnly = true)
    public List<ServiceRegistrationDto> listForAdmin(String status) {
        ApprovalStatus filter = parseStatus(status);
        List<ServiceRegistration> items = filter == null
                ? serviceRegistrationRepository.findAllByOrderByCreatedAtDescIdDesc()
                : serviceRegistrationRepository.findAllByStatusOrderByCreatedAtDescIdDesc(filter);
        return toDtos(items);
    }

    /** UC06 #1 - Admin xem ảnh chứng từ chuyển khoản của đơn (FR11). Quyền Admin do SecurityConfig chặn. */
    @Transactional(readOnly = true)
    public Resource loadProof(Long registrationId) {
        if (registrationId == null || registrationId <= 0) {
            throw new AppException("Mã đơn đăng ký không hợp lệ");
        }
        ServiceRegistration entity = serviceRegistrationRepository.findById(registrationId)
                .orElseThrow(() -> new AppException("Không tìm thấy đơn đăng ký", HttpStatus.NOT_FOUND));
        if (isBlank(entity.getProofImagePath())) {
            throw new AppException("Đơn đăng ký không có ảnh chứng từ", HttpStatus.NOT_FOUND);
        }
        return files.load(entity.getProofImagePath());
    }

    @Transactional(readOnly = true)
    public Resource loadVerificationDocument(UserPrincipal user, Long registrationId, String kind) {
        if (user == null || user.getRole() != Role.ADMIN) {
            throw new AppException("Chỉ Admin được xem giấy tờ xác minh", HttpStatus.FORBIDDEN);
        }
        if (registrationId == null || registrationId <= 0) throw new AppException("Mã đơn đăng ký không hợp lệ");
        if (!"identity".equals(kind) && !"business-license".equals(kind)) throw new AppException("Loại giấy tờ không hợp lệ");
        ServiceRegistration entity = serviceRegistrationRepository.findById(registrationId)
                .orElseThrow(() -> new AppException("Không tìm thấy đơn đăng ký", HttpStatus.NOT_FOUND));
        String path = "identity".equals(kind) ? entity.getIdentityDocumentPath() : entity.getBusinessLicensePath();
        if (isBlank(path)) throw new AppException("Hồ sơ chưa có giấy tờ này", HttpStatus.NOT_FOUND);
        return files.load(path);
    }

    /**
     * UC06 #2 - Admin duyệt đơn khi đã thấy tiền thuê về (FR11, FR12): tạo địa điểm, sinh đủ số sân mà đơn
     * đã khai báo, ghi thời hạn từ ngày duyệt theo số năm thuê, tạo tài khoản Owner nếu là đơn của Guest
     * và gửi email MSG116.
     *
     * Các sân mặc định ở trạng thái tạm ngưng để Owner thiết lập giá trước khi bật.
     */
    @Transactional
    public ServiceRegistrationDto approve(UserPrincipal admin, Long registrationId) {
        ServiceRegistration entity = requirePending(registrationId);

        if (isBlank(entity.getIdentityDocumentPath()) || isBlank(entity.getBusinessLicensePath()) || entity.getPrivacyAcceptedAt() == null) {
            throw new AppException("Hồ sơ thiếu CCCD, giấy phép kinh doanh hoặc cam kết bảo mật. Vui lòng từ chối và yêu cầu nộp đơn mới.");
        }

        if (isBlank(entity.getContactPhone())) {
            throw new AppException("Đơn thiếu số điện thoại liên hệ, không thể duyệt");
        }
        if (isBlank(entity.getContactEmail())) {
            throw new AppException("Đơn thiếu email của chủ sân, không gửi được kết quả");
        }
        int courtCount = validateCourtCount(entity.getCourtCount());
        int rentalYears = validateRentalYears(entity.getRentalYears());
        NewOwner newOwner = null;
        if (entity.getRequesterId() == null) {
            newOwner = createOwner(entity);
            entity.setRequesterId(newOwner.account().getId());
        } else {
            Account owner = lockOwner(entity.getRequesterId());
            requireNewOwnerLocation(owner.getId(), entity.getLocationName(), entity.getAddress());
        }

        LocalDateTime now = LocalDateTime.now();
        Location location = locationRepository.save(Location.builder()
                .ownerId(entity.getRequesterId())
                .name(entity.getLocationName())
                .address(entity.getAddress())
                .latitude(entity.getLatitude())
                .longitude(entity.getLongitude())
                .contactPhone(entity.getContactPhone())
                .status(STATUS_ACTIVE)
                .createdAt(now)
                .build());

        courtRepository.saveAll(defaultCourts(location.getId(), courtCount));

        // FR12, DR29: thời hạn tính từ ngày duyệt theo số năm thuê (1 năm = 12 tháng, đủ mức tối thiểu).
        LocalDate startDate = LocalDate.now();
        LocalDate endDate = startDate.plusYears(rentalYears).minusDays(1);
        serviceTermRepository.save(ServiceTerm.builder()
                .locationId(location.getId())
                .startDate(startDate)
                .endDate(endDate)
                .recordedBy(admin == null ? null : admin.getId())
                .build());

        entity.setStatus(ApprovalStatus.APPROVED);
        entity.setLocationId(location.getId());
        entity.setProcessedBy(admin == null ? null : admin.getId());
        entity.setProcessedAt(now);
        entity.setRejectReason(null);

        ServiceRegistration saved = serviceRegistrationRepository.save(entity);

        // MSG116: gửi sau cùng; lỗi thì exception hủy toàn bộ giao dịch (chưa tạo địa điểm, tài khoản).
        emails.sendServiceRegistrationApproved(saved.getContactEmail(), saved.getLocationName(), courtCount,
                formatMoney(rentalAmountOf(saved)), startDate.format(EMAIL_DATE), endDate.format(EMAIL_DATE),
                newOwner == null ? null : newOwner.account().getUsername(),
                newOwner == null ? null : newOwner.rawPassword());
        return ServiceRegistrationDto.fromEntity(saved, requesterName(saved.getRequesterId()));
    }

    /** UC06 #3 - Admin từ chối đơn, bắt buộc ghi lý do; hệ thống gửi email lý do (MSG117). */
    @Transactional
    public ServiceRegistrationDto reject(UserPrincipal admin, Long registrationId,
            RejectServiceRegistrationRequest request) {
        ServiceRegistration entity = requirePending(registrationId);
        String reason = requireText(request == null ? null : request.getReason(), "Lý do từ chối", 500);
        String email = requireText(entity.getContactEmail(), "Email nhận kết quả", 100);

        entity.setStatus(ApprovalStatus.REJECTED);
        entity.setRejectReason(reason);
        entity.setProcessedBy(admin == null ? null : admin.getId());
        entity.setProcessedAt(LocalDateTime.now());

        ServiceRegistration saved = serviceRegistrationRepository.save(entity);
        emails.sendServiceRegistrationRejected(email, saved.getLocationName(), reason);
        return ServiceRegistrationDto.fromEntity(saved, requesterName(saved.getRequesterId()));
    }

    // --------------------------------------------------------------- helpers

    /** FR11, BR59: tên đăng nhập theo DR22 và mật khẩu theo DR23 do hệ thống sinh; mật khẩu lưu dạng băm. */
    private NewOwner createOwner(ServiceRegistration registration) {
        String email = requireText(registration.getContactEmail(), "Email liên hệ", 100).toLowerCase(Locale.ROOT);
        lockContact(email, registration.getContactPhone());
        requireAvailableContact(email, registration.getContactPhone());
        String username = uniqueUsername();
        String rawPassword = credentials.password();
        try {
            Account account = accountRepository.saveAndFlush(Account.builder()
                    .username(username)
                    .email(email)
                    .phone(registration.getContactPhone())
                    .fullName(registration.getContactName())
                    .passwordHash(passwordEncoder.encode(rawPassword))
                    .role(Role.OWNER)
                    .status(AccountStatus.ACTIVE)
                    .build());
            return new NewOwner(account, rawPassword);
        } catch (DataIntegrityViolationException ex) {
            throw new AppException("Không thể tạo tài khoản Owner. Kiểm tra email và số điện thoại của đơn.",
                    HttpStatus.CONFLICT);
        }
    }

    private String uniqueUsername() {
        for (int attempt = 0; attempt < USERNAME_ATTEMPTS; attempt++) {
            String candidate = credentials.username();
            if (!accountRepository.existsByUsername(candidate)) {
                return candidate;
            }
        }
        throw new AppException("Không sinh được tên đăng nhập cho Owner, vui lòng thử duyệt lại",
                HttpStatus.CONFLICT);
    }

    private Account lockOwner(Long ownerId) {
        return accountRepository.findByIdForUpdate(ownerId)
                .orElseThrow(() -> new AppException("Không tìm thấy tài khoản Owner", HttpStatus.NOT_FOUND));
    }

    private Account findOwner(Long ownerId) {
        return accountRepository.findById(ownerId)
                .orElseThrow(() -> new AppException("Không tìm thấy tài khoản Owner", HttpStatus.NOT_FOUND));
    }

    private void requireNewOwnerLocation(Long ownerId, String name, String address) {
        if (locationRepository.findAllByOwnerId(ownerId).stream()
                .anyMatch(location -> sameVenue(name, address, location.getName(), location.getAddress()))) {
            throw new AppException("Địa điểm này đã thuộc tài khoản Owner.", HttpStatus.CONFLICT);
        }
    }

    private static boolean sameVenue(String name, String address, String existingName, String existingAddress) {
        return normalizeVenueText(name).equals(normalizeVenueText(existingName))
                && normalizeVenueText(address).equals(normalizeVenueText(existingAddress));
    }

    private static String normalizeVenueText(String value) {
        return java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFC)
                .replaceAll("(?U)\\s+", " ").strip().toLowerCase(Locale.ROOT);
    }

    private void lockContact(String email, String phone) {
        contactLocks.acquire(email);
        contactLocks.acquire("phone:" + phone);
    }

    private void requireNoPendingGuestRegistration(String email, String phone) {
        if (serviceRegistrationRepository.existsByRequesterIdIsNullAndStatusAndContactEmailIgnoreCase(
                ApprovalStatus.PENDING, email)) {
            throw new AppException("Email đã có đơn đăng ký dịch vụ đang chờ duyệt.", HttpStatus.CONFLICT);
        }
        if (serviceRegistrationRepository.existsByRequesterIdIsNullAndStatusAndContactPhone(
                ApprovalStatus.PENDING, phone)) {
            throw new AppException("Số điện thoại đã có đơn đăng ký dịch vụ đang chờ duyệt.", HttpStatus.CONFLICT);
        }
    }

    private void requireAvailableContact(String email, String phone) {
        if (accountRepository.existsByEmail(email)) {
            throw new AppException("Email này đã có tài khoản. Vui lòng đăng nhập để đăng ký thêm địa điểm. (MSG103)",
                    HttpStatus.CONFLICT);
        }
        if (accountRepository.existsByPhone(phone)) {
            throw new AppException("Số điện thoại đã được sử dụng cho một tài khoản khác.", HttpStatus.CONFLICT);
        }
    }

    /** Sinh danh sách sân mặc định cho địa điểm mới: "Sân 1".."Sân N". */
    private List<Court> defaultCourts(Long locationId, int courtCount) {
        List<Court> courts = new ArrayList<>(courtCount);
        for (int index = 1; index <= courtCount; index++) {
            courts.add(Court.builder()
                    .locationId(locationId)
                    .name("Sân " + index)
                    .active(false)
                    .build());
        }
        return courts;
    }

    /** Số sân phải trong khoảng 1..MAX_COURT_COUNT (ck_sreg_courts chỉ chặn điều kiện lớn hơn 0). */
    private int validateCourtCount(Integer courtCount) {
        if (courtCount == null) {
            throw new AppException("Số sân không được để trống");
        }
        if (courtCount < 1) {
            throw new AppException("Số sân phải lớn hơn 0");
        }
        if (courtCount > MAX_COURT_COUNT) {
            throw new AppException("Số sân tối đa là " + MAX_COURT_COUNT);
        }
        return courtCount;
    }

    /** DR19, DR29: số năm thuê nguyên, tối thiểu 1. */
    private int validateRentalYears(Integer rentalYears) {
        if (rentalYears == null) {
            throw new AppException("Số năm thuê không được để trống");
        }
        if (rentalYears < 1) {
            throw new AppException("Số năm thuê tối thiểu là 1 năm");
        }
        if (rentalYears > MAX_RENTAL_YEARS) {
            throw new AppException("Số năm thuê tối đa là " + MAX_RENTAL_YEARS + " năm");
        }
        return rentalYears;
    }

    /** Đơn cũ (trước D168) đã được migration tính tiền; phòng khi thiếu thì tính lại theo P35. */
    private BigDecimal rentalAmountOf(ServiceRegistration entity) {
        return entity.getRentalAmount() != null ? entity.getRentalAmount()
                : RentalFeeCalculator.amount(entity.getCourtCount(), entity.getRentalYears());
    }

    /** 4445000 → "4.445.000" (cách viết tiền trong MSG116). */
    static String formatMoney(BigDecimal amount) {
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.ROOT);
        symbols.setGroupingSeparator('.');
        return new DecimalFormat("#,##0", symbols).format(amount);
    }

    /** Đơn phải đang PENDING: đã duyệt/từ chối rồi thì trả 409 để tránh tạo trùng địa điểm. */
    private ServiceRegistration requirePending(Long registrationId) {
        if (registrationId == null || registrationId <= 0) {
            throw new AppException("Mã đơn đăng ký không hợp lệ");
        }
        ServiceRegistration entity = serviceRegistrationRepository.findByIdForUpdate(registrationId)
                .orElseThrow(() -> new AppException("Không tìm thấy đơn đăng ký", HttpStatus.NOT_FOUND));
        if (entity.getStatus() != ApprovalStatus.PENDING) {
            throw new AppException("Đơn đăng ký đã được xử lý (" + entity.getStatus() + ")", HttpStatus.CONFLICT);
        }
        return entity;
    }

    private List<ServiceRegistrationDto> toDtos(List<ServiceRegistration> items) {
        Map<Long, String> names = requesterNames(items);
        return items.stream()
                .map(item -> ServiceRegistrationDto.fromEntity(item, item.getRequesterId() == null
                        ? item.getContactName() : names.get(item.getRequesterId())))
                .toList();
    }

    private Map<Long, String> requesterNames(List<ServiceRegistration> items) {
        List<Long> ids = items.stream()
                .map(ServiceRegistration::getRequesterId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return accountRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Account::getId, this::displayName));
    }

    private String requesterName(Long requesterId) {
        if (requesterId == null) {
            return null;
        }
        return accountRepository.findById(requesterId).map(this::displayName).orElse(null);
    }

    private String displayName(Account account) {
        if (account == null) {
            return null;
        }
        return isBlank(account.getFullName()) ? account.getUsername() : account.getFullName();
    }

    /** Lọc theo trạng thái: bỏ trống = tất cả, sai giá trị = 400. */
    private ApprovalStatus parseStatus(String status) {
        if (isBlank(status)) {
            return null;
        }
        try {
            return ApprovalStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new AppException("Trạng thái lọc không hợp lệ, chỉ nhận PENDING, APPROVED hoặc REJECTED");
        }
    }

    private String requireText(String value, String fieldLabel, int maxLength) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            throw new AppException(fieldLabel + " không được để trống");
        }
        if (trimmed.length() > maxLength) {
            throw new AppException(fieldLabel + " tối đa " + maxLength + " ký tự");
        }
        return trimmed;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

}
