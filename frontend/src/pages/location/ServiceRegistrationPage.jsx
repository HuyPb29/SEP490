import { useEffect, useState, useCallback, useRef } from 'react';
import api, { apiErrorMessage } from '../../api';
import { getServiceRegistrationPaymentInfo, operatorQrUrl, submitServiceRegistration } from '../../api/locationApi';
import { useAuth } from '../../hooks/useAuth';
import LocationMap from '../../components/map/LocationMap';
import GoogleLocationPicker, { hasGoogleMapsKey, loadMaps } from '../../components/map/GoogleLocationPicker';
import PublicLayout from '../../components/layout/PublicLayout';
import { LoadingState } from '../../components/common';
import { SERVICE_TERMS, formatVnd, rentalAmount } from './serviceRegistrationTerms';
import styles from './ServiceRegistrationPage.module.css';
import { attribution, provinces } from './vietnam-addresses.json';

const addressFields = { provinceCode: '', wardCode: '', addressDetail: '' };
const compareNames = new Intl.Collator('vi').compare;
const provinceOptions = [...provinces].sort((a, b) => compareNames(a.name, b.name));

/** DR19: ảnh chứng từ JPG hoặc PNG, tối đa 5 MB (backend FileStorageService kiểm tra lại). */
const PROOF_TYPES = ['image/jpeg', 'image/png'];
const PROOF_MAX_BYTES = 5 * 1024 * 1024;
/** Đề xuất, chưa duyệt: tối đa 10 năm trên một đơn (DR29 chỉ quy định tối thiểu 1 năm). */
const MAX_RENTAL_YEARS = 10;

/**
 * Feature: F2 - Quản lý địa điểm
 * UC05 - Đăng ký sử dụng dịch vụ (FR10, BR61, BR65, DR19, P35; D168, D169).
 * Guest (hoặc Owner đăng ký thêm địa điểm) nhập địa điểm, số sân, số năm thuê; form tự tính tiền thuê,
 * hiện QR của bên vận hành và điều khoản; chủ sân chuyển khoản, đính kèm ảnh chứng từ, đồng ý điều khoản rồi gửi.
 */
export default function ServiceRegistrationPage() {
  const { user } = useAuth();

  const roleCode = String(user?.role_code || user?.role || '').toLowerCase();
  const isOwner = roleCode === 'owner';
  const canSubmit = !user || isOwner;

  const [formData, setFormData] = useState({
    locationName: '',
    ...addressFields,
    latitude: '',
    longitude: '',
    courtCount: '',
    rentalYears: '1',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState('');
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [paymentInfoError, setPaymentInfoError] = useState('');

  const [fieldErrors, setFieldErrors] = useState({});
  const [lookingUpAddress, setLookingUpAddress] = useState(false);
  const [mapAddressError, setMapAddressError] = useState('');
  const [mapAddress, setMapAddress] = useState('');
  const mapLookupInProgress = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);

  // Danh sách đơn đăng ký đã gửi
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listError, setListError] = useState('');

  const province = provinceOptions.find(({ code }) => code === formData.provinceCode);
  const wardOptions = province ? [...province.wards].sort((a, b) => compareNames(a.name, b.name)) : [];
  const ward = wardOptions.find(({ code }) => code === formData.wardCode);
  const addressDetail = formData.addressDetail.trim();
  const address = province && ward && addressDetail ? [addressDetail, ward.name, province.name].join(', ') : '';
  const addressDisabled = !canSubmit || isSubmitting || lookingUpAddress || locating;

  const loadMyRegistrations = useCallback(async () => {
    if (!user || !isOwner) return;
    setIsLoadingList(true);
    setListError('');
    try {
      const res = await api.get('/me/service-registrations');
      // res.data.data là List<ServiceRegistrationDto>
      const data = res.data?.data ?? res.data ?? [];
      setMyRegistrations(Array.isArray(data) ? data : []);
    } catch (err) {
      setListError(apiErrorMessage(err, 'Không thể tải danh sách đơn đăng ký.'));
    } finally {
      setIsLoadingList(false);
    }
  }, [user, isOwner]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadMyRegistrations();
    });
  }, [loadMyRegistrations]);

  // FR127: thông tin chuyển khoản và QR của bên vận hành luôn có (mặc định khi cài hệ thống).
  useEffect(() => {
    let cancelled = false;
    getServiceRegistrationPaymentInfo()
      .then((info) => { if (!cancelled) setPaymentInfo(info); })
      .catch((err) => {
        if (!cancelled) setPaymentInfoError(apiErrorMessage(err, 'Không tải được thông tin chuyển khoản.'));
      });
    return () => { cancelled = true; };
  }, []);

  // Thu hồi object URL của ảnh xem trước khi đổi ảnh hoặc rời trang.
  useEffect(() => () => { if (proofPreview) URL.revokeObjectURL(proofPreview); }, [proofPreview]);

  const amount = rentalAmount(formData.courtCount, formData.rentalYears,
    paymentInfo?.referenceFee, paymentInfo?.referenceCourts);

  const clearFieldError = (field) => {
    setFieldErrors(({ [field]: _removed, ...rest }) => rest);
  };

  const handleProofChange = (file) => {
    clearFieldError('proof');
    setProofFile(null);
    setProofPreview('');
    if (!file) return;
    if (!PROOF_TYPES.includes(file.type)) {
      setFieldErrors((prev) => ({ ...prev, proof: 'Chỉ nhận ảnh JPG hoặc PNG.' }));
      return;
    }
    if (file.size > PROOF_MAX_BYTES) {
      setFieldErrors((prev) => ({ ...prev, proof: 'Ảnh tối đa 5 MB.' }));
      return;
    }
    if (file.size === 0) {
      setFieldErrors((prev) => ({ ...prev, proof: 'Ảnh chứng từ không được là file rỗng.' }));
      return;
    }
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const fillCoordinates = (latitude, longitude) => {
    setFormData((prev) => ({
      ...prev,
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
    }));
    setFieldErrors(({ latitude: _latitude, longitude: _longitude, ...rest }) => rest);
    setLocationError('');
  };

  const handleAddressChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'provinceCode' && { wardCode: '' }),
      latitude: '',
      longitude: '',
    }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      delete next.latitude;
      delete next.address;
      if (field === 'provinceCode') delete next.wardCode;
      return next;
    });
    setMapAddress('');    setMapAddressError('');
    setLocationError('');
  };

  const lookupMapAddress = async (request) => {
    if (mapLookupInProgress.current || isSubmitting) return;
    mapLookupInProgress.current = true;
    setLookingUpAddress(true);
    setMapAddressError('');
    setMapAddress('');
    try {
      const maps = await loadMaps();
      const { Geocoder } = await maps.importLibrary('geocoding');
      const { results } = await new Geocoder().geocode(request);
      const result = results[0];
      if (!result?.formatted_address) throw new Error('No matching address');
      setMapAddress(result.formatted_address);
    } catch {
      setMapAddressError('Google Maps chưa tra được địa chỉ tại điểm ghim. Vị trí bạn chọn vẫn được giữ.');
    } finally {
      mapLookupInProgress.current = false;
      setLookingUpAddress(false);
    }
  };

  const handleMapPick = (latitude, longitude) => {
    if (mapLookupInProgress.current || isSubmitting) return;
    fillCoordinates(latitude, longitude);    setMapAddress('');
    setMapAddressError('');
    if (hasGoogleMapsKey) lookupMapAddress({ location: { lat: latitude, lng: longitude } });
  };

  const handleGetCurrentLocation = () => {
    if (mapLookupInProgress.current || isSubmitting || locating) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocationError('Không thể dùng định vị ở trình duyệt này. Hãy bấm vào bản đồ để đặt ghim.');
      return;
    }
    setLocationError('');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        handleMapPick(coords.latitude, coords.longitude);
        setLocating(false);
      },
      (error) => {
        const messages = {
          1: 'Quyền vị trí đang bị chặn. Hãy cho phép vị trí trong cài đặt trang hoặc bấm vào bản đồ để đặt ghim.',
          2: 'Thiết bị không xác định được vị trí. Hãy bấm vào bản đồ để đặt ghim.',
          3: 'Đã hết thời gian lấy vị trí. Hãy thử lại hoặc bấm vào bản đồ để đặt ghim.',
        };
        setLocationError(messages[error.code] ?? 'Không lấy được vị trí. Hãy bấm vào bản đồ để đặt ghim.');
        setLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const getValidationErrors = () => {
    const errors = {};

    if (!formData.locationName.trim()) {
      errors.locationName = 'Tên địa điểm không được để trống.';
    } else if (formData.locationName.trim().length > 100) {
      errors.locationName = 'Tên địa điểm tối đa 100 ký tự.';
    }

    if (!province) errors.provinceCode = 'Hãy chọn tỉnh hoặc thành phố.';
    if (!ward) errors.wardCode = 'Hãy chọn xã, phường hoặc đặc khu.';
    if (!addressDetail) errors.addressDetail = 'Hãy nhập địa chỉ chi tiết.';
    if (address.length > 255) errors.address = 'Địa chỉ đầy đủ tối đa 255 ký tự.';

    if (formData.latitude === '' || formData.longitude === '' ||
        !Number.isFinite(Number(formData.latitude)) || Math.abs(Number(formData.latitude)) > 90 ||
        !Number.isFinite(Number(formData.longitude)) || Math.abs(Number(formData.longitude)) > 180) {
      errors.latitude = 'Hãy xác định vị trí sân trên bản đồ.';
    }

    const courts = Number(formData.courtCount);
    if (!Number.isInteger(courts) || courts < 1) {
      errors.courtCount = 'Số sân phải lớn hơn 0.';
    } else if (courts > 50) {
      errors.courtCount = 'Số sân tối đa là 50 sân trên một địa điểm.';
    }

    const years = Number(formData.rentalYears);
    if (!Number.isInteger(years) || years < 1) {
      errors.rentalYears = 'Số năm thuê tối thiểu là 1 năm.';
    } else if (years > MAX_RENTAL_YEARS) {
      errors.rentalYears = `Số năm thuê tối đa là ${MAX_RENTAL_YEARS} năm.`;
    }

    if (!proofFile) {
      errors.proof = 'Vui lòng đính kèm ảnh chứng từ chuyển khoản tiền thuê.';
    }
    if (!termsAccepted) {
      errors.terms = 'Vui lòng đọc và đồng ý điều khoản sử dụng dịch vụ.';
    }

    if (!isOwner) {
      if (!formData.contactName.trim()) {
        errors.contactName = 'Tên người liên hệ không được để trống.';
      } else if (formData.contactName.trim().length > 50) {
        errors.contactName = 'Tên người liên hệ tối đa 50 ký tự.';
      }
      if (!/^[0-9]{10}$/.test(formData.contactPhone.trim())) {
        errors.contactPhone = 'Số điện thoại liên hệ phải gồm đúng 10 chữ số.';
      }
      if (formData.contactEmail.trim().length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim())) {
        errors.contactEmail = 'Nhập email hợp lệ để nhận quyền truy cập tài khoản sau khi được duyệt.';
      }
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (addressDisabled || mapLookupInProgress.current) return;
    setSubmitSuccess('');
    setSubmitError('');

    if (!canSubmit) return;

    const validationErrors = getValidationErrors();
    setFieldErrors(validationErrors);
    const firstError = Object.keys(validationErrors)[0];
    if (firstError) {
      const fieldId = { address: 'addressDetail', latitude: 'registration-map' }[firstError] || firstError;
      const field = e.currentTarget.querySelector('[id="' + fieldId + '"]');
      const target = firstError === 'proof' ? e.currentTarget.querySelector('label[for="proof"]') : field;
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field?.focus({ preventScroll: true });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        locationName: formData.locationName.trim(),
        address,
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        courtCount: Number(formData.courtCount),
        rentalYears: Number(formData.rentalYears),
        termsAccepted,
        ...(!isOwner && {
          contactName: formData.contactName.trim(),
          contactPhone: formData.contactPhone.trim(),
          contactEmail: formData.contactEmail.trim(),
        }),
      };

      const res = await submitServiceRegistration(payload, proofFile);
      // MSG99 do backend trả về, có email nhận kết quả.
      setSubmitSuccess(res?.message || 'Đã gửi yêu cầu đăng ký.');
      // Đơn đã gửi kèm chứng từ của lần chuyển khoản này: xóa để lần sau không gửi trùng ảnh.
      setMapAddress('');
      setMapAddressError('');
      setFormData((prev) => ({
        ...prev,
        locationName: '',
        ...addressFields,
        latitude: '',
        longitude: '',
      }));
      setProofFile(null);
      setProofPreview('');
      setTermsAccepted(false);
      setFieldErrors({});
      loadMyRegistrations();
    } catch (err) {
      setSubmitError(apiErrorMessage(err, 'Không thể gửi đơn đăng ký. Vui lòng kiểm tra lại thông tin.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublicLayout
      title={isOwner ? 'Đăng ký thêm địa điểm' : 'Đăng ký dịch vụ sân'}
      subtitle={isOwner ? 'Địa điểm mới sẽ được gắn với tài khoản của bạn sau khi Admin duyệt.' : 'Đưa địa điểm cầu lông của bạn lên Courtly'}
    >
      <div className={styles.container}>
        {/* Banner giới thiệu */}
        {!isOwner && <div className={styles.introCard}>
          <h2 className={styles.introHeading}>Trở thành đối tác của Courtly</h2>
          <p className={styles.introText}>
            Hệ thống Courtly giúp bạn quản lý lịch đặt sân, doanh thu, nhân viên và kết nối với cộng đồng người chơi cầu
            lông năng động. Hãy điền thông tin cơ sở của bạn để bắt đầu!
          </p>
        </div>}

        {/* Kiểm tra điều kiện vai trò */}
        {!canSubmit && (
          <div className={`${styles.alertBox} ${styles.alertWarning}`}>
            <div>
              <strong>Thông báo vai trò:</strong> Bạn đang đăng nhập với tài khoản người chơi/nhân viên. Chỉ tài khoản{' '}
              <strong>Chủ sân (Owner)</strong> mới có quyền gửi đơn đăng ký mở cụm sân mới. Hãy đăng xuất để gửi đơn bằng email chưa có tài khoản.
            </div>
          </div>
        )}

        {/* Thông báo kết quả gửi form */}
        {submitSuccess && (
          <div className={`${styles.alertBox} ${styles.alertSuccess}`}>
            ✓ {submitSuccess}
          </div>
        )}
        {submitError && (
          <div className={`${styles.alertBox} ${styles.alertDanger}`}>
            ✕ {submitError}
          </div>
        )}

        {/* Form Đăng ký */}
        <section className={styles.card} aria-labelledby="form-heading">
          <h3 id="form-heading" className={styles.cardTitle}>
            Thông tin cơ sở cầu lông
          </h3>
          <p className={styles.cardSubtitle}>
            Các mục đánh dấu <span className={styles.requiredMark}>*</span> là bắt buộc. Chuyển khoản tiền thuê theo thông tin bên dưới rồi đính kèm ảnh chứng từ.
            Khi tiền thuê đã về, Quản trị viên duyệt và hệ thống gửi kết quả, tên đăng nhập, mật khẩu tới email của bạn.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="locationName">
                <span>Tên địa điểm sân <span className={styles.requiredMark}>*</span></span>
              </label>
              <input
                id="locationName"
                type="text"
                maxLength={100}
                placeholder="VD: Sân Cầu Lông Cầu Giấy Arena"
                className={`${styles.input} ${fieldErrors.locationName ? styles.inputError : ''}`}
                value={formData.locationName}
                onChange={(e) => handleChange('locationName', e.target.value)}
                disabled={!canSubmit || isSubmitting}
              />
              {fieldErrors.locationName && (
                <p className={styles.errorText} role="alert">{fieldErrors.locationName}</p>
              )}
            </div>

            <div className={styles.twoColRow}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="provinceCode">
                  <span>Tỉnh/Thành phố <span className={styles.requiredMark}>*</span></span>
                </label>
                <select id="provinceCode" className={`${styles.input} ${fieldErrors.provinceCode ? styles.inputError : ''}`}
                  value={formData.provinceCode} onChange={(e) => handleAddressChange('provinceCode', e.target.value)}
                  disabled={addressDisabled} required>
                  <option value="">Chọn tỉnh/thành phố</option>
                  {provinceOptions.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
                </select>
                {fieldErrors.provinceCode && <p className={styles.errorText} role="alert">{fieldErrors.provinceCode}</p>}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="wardCode">
                  <span>Xã/Phường/Đặc khu <span className={styles.requiredMark}>*</span></span>
                </label>
                <select id="wardCode" className={`${styles.input} ${fieldErrors.wardCode ? styles.inputError : ''}`}
                  value={formData.wardCode} onChange={(e) => handleAddressChange('wardCode', e.target.value)}
                  disabled={addressDisabled || !province} required>
                  <option value="">{province ? 'Chọn xã/phường/đặc khu' : 'Chọn tỉnh/thành phố trước'}</option>
                  {wardOptions.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
                </select>
                {fieldErrors.wardCode && <p className={styles.errorText} role="alert">{fieldErrors.wardCode}</p>}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="addressDetail">
                <span>Địa chỉ chi tiết <span className={styles.requiredMark}>*</span></span>
              </label>
              <input id="addressDetail" type="text" maxLength={255}
                placeholder="Số nhà, tên đường, thôn hoặc tổ dân phố"
                className={`${styles.input} ${fieldErrors.addressDetail || fieldErrors.address ? styles.inputError : ''}`}
                value={formData.addressDetail} onChange={(e) => handleAddressChange('addressDetail', e.target.value)}
                disabled={addressDisabled} required
              />
              {(fieldErrors.addressDetail || fieldErrors.address) &&
                <p className={styles.errorText} role="alert">{fieldErrors.addressDetail || fieldErrors.address}</p>}
              {address && <p className={styles.helperText}>Địa chỉ đầy đủ: {address}</p>}
              <small className={styles.helperText}>
                Danh mục hành chính từ <a href={attribution.source} className="underline">{attribution.author}</a>
                {' · '}<a href={attribution.license} className="underline">CC BY 4.0</a>
              </small>
            </div>

            <div className={styles.threeColRow}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="courtCount">
                  <span>Số lượng sân <span className={styles.requiredMark}>*</span></span>
                </label>
                <input
                  id="courtCount"
                  type="number"
                  min={1}
                  max={50}
                  className={`${styles.input} ${fieldErrors.courtCount ? styles.inputError : ''}`}
                  value={formData.courtCount}
                  onChange={(e) => handleChange('courtCount', e.target.value)}
                  disabled={!canSubmit || isSubmitting}
                />
                {fieldErrors.courtCount && (
                  <p className={styles.errorText} role="alert">{fieldErrors.courtCount}</p>
                )}
                <p className={styles.helperText}>Hệ thống sẽ tự động khởi tạo các sân này khi được duyệt.</p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="rentalYears">
                  <span>Số năm thuê <span className={styles.requiredMark}>*</span></span>
                </label>
                <input
                  id="rentalYears"
                  type="number"
                  min={1}
                  max={MAX_RENTAL_YEARS}
                  step={1}
                  className={`${styles.input} ${fieldErrors.rentalYears ? styles.inputError : ''}`}
                  value={formData.rentalYears}
                  onChange={(e) => handleChange('rentalYears', e.target.value)}
                  disabled={!canSubmit || isSubmitting}
                />
                {fieldErrors.rentalYears && (
                  <p className={styles.errorText} role="alert">{fieldErrors.rentalYears}</p>
                )}
                <p className={styles.helperText}>Tối thiểu 1 năm, thời hạn tính từ ngày được duyệt.</p>
              </div>

              <div className={styles.formGroup}>
                <span className={styles.label}><span>Số tiền thuê</span></span>
                <p style={{ fontSize: 20, fontWeight: 700, margin: '8px 0 4px', color: 'var(--color-text)' }} aria-live="polite">
                  {formatVnd(amount)}
                </p>
                <p className={styles.helperText}>
                  Hệ thống tự tính: 10.000.000 đồng cho 9 sân con trong 1 năm, theo số sân và số năm thuê, làm tròn lên nghìn đồng.
                </p>
              </div>
            </div>

            {fieldErrors.latitude && <p className={styles.errorText} role="alert">{fieldErrors.latitude}</p>}
            {canSubmit && (
              <div id="registration-map" tabIndex={-1} className="mt-4 max-w-md" aria-label="Vị trí sân trên bản đồ">
                <p>Bấm vào bản đồ để ghim vị trí sân.</p>
                <GoogleLocationPicker
                  point={formData.latitude !== '' && formData.longitude !== '' &&
                    Math.abs(Number(formData.latitude)) <= 90 && Math.abs(Number(formData.longitude)) <= 180
                    ? { lat: Number(formData.latitude), lng: Number(formData.longitude) } : null}
                  onPick={handleMapPick}
                  disabled={isSubmitting || lookingUpAddress || locating}
                  fallback={<LocationMap
                    initialCenter={{ latitude: 21.028511, longitude: 105.854444 }}
                    venues={formData.latitude === '' || formData.longitude === '' ? [] :
                      [{ facility_id: 'registration', latitude: formData.latitude, longitude: formData.longitude }]}
                    onPick={handleMapPick}
                    pickDisabled={isSubmitting || lookingUpAddress || locating}
                  />}
                />
                {lookingUpAddress && <p role="status">Đang tìm địa chỉ trên bản đồ…</p>}
                {mapAddress && <p role="status">Vị trí tìm được: {mapAddress}. Hãy kiểm tra và chỉnh ghim đúng vị trí sân trước khi gửi.</p>}
                {mapAddressError && <p role="alert" className={styles.errorText}>{mapAddressError}</p>}
              </div>
            )}

            <div className={styles.coordActionRow}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleGetCurrentLocation}
                disabled={addressDisabled}
              >
                {locating ? 'Đang lấy vị trí…' : 'Đặt ghim tại vị trí hiện tại (GPS)'}
              </button>
            </div>
            {locationError && <p className={styles.errorText} role="alert">{locationError}</p>}

            {!isOwner && <><hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

            <h4 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--color-text)' }}>
              Thông tin người đại diện liên hệ
            </h4>

            <div className={styles.threeColRow}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="contactName">
                  <span>Họ và tên người liên hệ <span className={styles.requiredMark}>*</span></span>
                </label>
                <input
                  id="contactName"
                  type="text"
                  maxLength={50}
                  placeholder="VD: Nguyễn Văn A"
                  className={`${styles.input} ${fieldErrors.contactName ? styles.inputError : ''}`}
                  value={formData.contactName}
                  onChange={(e) => handleChange('contactName', e.target.value)}
                  disabled={!canSubmit || isSubmitting}
                />
                {fieldErrors.contactName && (
                  <p className={styles.errorText} role="alert">{fieldErrors.contactName}</p>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="contactPhone">
                  <span>Số điện thoại <span className={styles.requiredMark}>*</span></span>
                </label>
                <input
                  id="contactPhone"
                  type="tel"
                  maxLength={10}
                  placeholder="VD: 0912345678"
                  className={`${styles.input} ${fieldErrors.contactPhone ? styles.inputError : ''}`}
                  value={formData.contactPhone}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                  disabled={!canSubmit || isSubmitting}
                />
                {fieldErrors.contactPhone && (
                  <p className={styles.errorText} role="alert">{fieldErrors.contactPhone}</p>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="contactEmail">
                  <span>Email liên hệ <span className={styles.requiredMark}>*</span></span>
                </label>
                <input
                  id="contactEmail"
                  type="email"
                  maxLength={100}
                  placeholder="VD: owner@example.com"
                  className={`${styles.input} ${fieldErrors.contactEmail ? styles.inputError : ''}`}
                  value={formData.contactEmail}
                  onChange={(e) => handleChange('contactEmail', e.target.value)}
                  disabled={!canSubmit || isSubmitting}
                />
                {fieldErrors.contactEmail && (
                  <p className={styles.errorText} role="alert">{fieldErrors.contactEmail}</p>
                )}
              </div>
            </div>

            </>}

            <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

            <h4 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: 'var(--color-text)' }}>
              Chuyển khoản tiền thuê
            </h4>
            <p className={styles.helperText}>
              Chuyển <strong>{formatVnd(amount)}</strong> vào tài khoản của bên vận hành, sau đó đính kèm ảnh chứng từ.
              Không giới hạn thời gian thanh toán.
            </p>
            {paymentInfoError && (
              <div className={`${styles.alertBox} ${styles.alertDanger}`}>{paymentInfoError}</div>
            )}
            {paymentInfo && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', margin: '12px 0 16px' }}>
                <img
                  src={operatorQrUrl(paymentInfo.updatedAt)}
                  alt="Mã QR chuyển khoản của bên vận hành"
                  width={180}
                  height={180}
                  style={{ border: '1px solid var(--color-border)', borderRadius: 8, background: '#fff' }}
                />
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px' }}>
                  <dt>Ngân hàng</dt><dd style={{ margin: 0 }}><strong>{paymentInfo.bankName}</strong></dd>
                  <dt>Số tài khoản</dt><dd style={{ margin: 0 }}><strong>{paymentInfo.bankAccountNo}</strong></dd>
                  <dt>Chủ tài khoản</dt><dd style={{ margin: 0 }}><strong>{paymentInfo.bankAccountHolder}</strong></dd>
                  <dt>Số tiền</dt><dd style={{ margin: 0 }}><strong>{formatVnd(amount)}</strong></dd>
                  <dt />
                  <dd style={{ margin: 0 }}>
                    <a href={operatorQrUrl(paymentInfo.updatedAt)} download="qr-ben-van-hanh.png" className="underline">
                      Lưu ảnh QR
                    </a>
                  </dd>
                </dl>
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="proof">
                <span>Ảnh chứng từ chuyển khoản <span className={styles.requiredMark}>*</span></span>
              </label>
              <input
                id="proof"
                className={styles.proofInput}
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => {
                  handleProofChange(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
                disabled={!canSubmit || isSubmitting}
                aria-describedby="proof-help"
                aria-invalid={Boolean(fieldErrors.proof)}
              />
              <label htmlFor="proof" className={`${styles.proofPicker} ${proofFile ? styles.proofSelected : ''}`}>
                {proofPreview ? <img src={proofPreview} alt="Ảnh chứng từ đã chọn" /> : <span className={styles.proofAdd} aria-hidden="true">+</span>}
                <strong>{proofFile ? 'Bấm để thay ảnh chứng từ' : 'Bấm để chọn ảnh chứng từ'}</strong>
                {proofFile && <span className={styles.proofFileName}>{proofFile.name}</span>}
                <span id="proof-help">Ảnh JPG hoặc PNG, tối đa 5 MB.</span>
              </label>
              {proofFile && <button type="button" className={styles.removeProof} disabled={!canSubmit || isSubmitting}
                onClick={() => handleProofChange(null)}>Xóa ảnh chứng từ</button>}
              {fieldErrors.proof && (
                <p className={styles.errorText} role="alert">{fieldErrors.proof}</p>
              )}
            </div>

            <div className={styles.formGroup}>
              <span className={styles.label}><span>Điều khoản sử dụng dịch vụ</span></span>
              <ol
                style={{
                  maxHeight: 220, overflowY: 'auto', margin: '8px 0', padding: '12px 12px 12px 32px',
                  border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 'var(--text-sm)', lineHeight: 1.5,
                }}
              >
                {SERVICE_TERMS.map((term) => <li key={term} style={{ marginBottom: 6 }}>{term}</li>)}
              </ol>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input
                  id="terms"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => { setTermsAccepted(e.target.checked); clearFieldError('terms'); }}
                  disabled={!canSubmit || isSubmitting}
                />
                <span>Tôi đã đọc và đồng ý các điều khoản sử dụng dịch vụ. <span className={styles.requiredMark}>*</span></span>
              </label>
              {fieldErrors.terms && (
                <p className={styles.errorText} role="alert">{fieldErrors.terms}</p>
              )}
            </div>

            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={addressDisabled}
            >
              {isSubmitting ? 'Đang gửi đơn đăng ký…' : 'Gửi đơn đăng ký dịch vụ'}
            </button>
          </form>
        </section>

        {/* Danh sách các đơn đăng ký của tôi (dành cho Owner) */}
        {isOwner && (
          <section className={styles.card} aria-labelledby="my-requests-heading">
            <h3 id="my-requests-heading" className={styles.cardTitle}>
              Lịch sử đơn đăng ký của bạn
            </h3>
            <p className={styles.cardSubtitle}>
              Theo dõi tiến độ xét duyệt các cơ sở bạn đã nộp lên ban quản trị hệ thống.
            </p>

            {isLoadingList ? (
              <LoadingState message="Đang tải danh sách đơn đăng ký…" />
            ) : listError ? (
              <div className={`${styles.alertBox} ${styles.alertDanger}`}>{listError}</div>
            ) : myRegistrations.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                Bạn chưa gửi đơn đăng ký địa điểm nào.
              </p>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Tên cơ sở</th>
                      <th>Địa chỉ</th>
                      <th>Số sân</th>
                      <th>Số năm thuê</th>
                      <th>Số tiền thuê</th>
                      <th>Trạng thái</th>
                      <th>Ngày gửi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myRegistrations.map((item) => (
                      <tr key={item.id}>
                        <td>#{item.id}</td>
                        <td><strong>{item.locationName}</strong></td>
                        <td>{item.address}</td>
                        <td>{item.courtCount} sân</td>
                        <td>{item.rentalYears} năm</td>
                        <td>{formatVnd(item.rentalAmount)}</td>
                        <td>
                          {item.status === 'APPROVED' ? (
                            <span className={`${styles.badge} ${styles.badgeApproved}`}>Đã duyệt</span>
                          ) : item.status === 'REJECTED' ? (
                            <span className={`${styles.badge} ${styles.badgeRejected}`} title={item.rejectReason}>
                              Bị từ chối
                            </span>
                          ) : (
                            <span className={`${styles.badge} ${styles.badgePending}`}>Chờ duyệt</span>
                          )}
                        </td>
                        <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </PublicLayout>
  );
}
