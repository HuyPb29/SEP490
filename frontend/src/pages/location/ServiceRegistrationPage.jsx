import { useEffect, useState, useCallback, useRef } from 'react';
import api, { apiErrorMessage } from '../../api';
import { checkServiceRegistration, getServiceRegistrationPaymentInfo, operatorQrUrl, submitServiceRegistration } from '../../api/locationApi';
import { useAuth } from '../../hooks/useAuth';
import LocationMap from '../../components/map/LocationMap';
import GoogleLocationPicker, { hasGoogleMapsKey, loadMaps } from '../../components/map/GoogleLocationPicker';
import PublicLayout from '../../components/layout/PublicLayout';
import { Link } from 'react-router-dom';
import { money, shortDate, uiMessage } from '../../utils/formatters';
import { FileInput } from '../../components/common/FileInput';
import { Button, FormField, Input, Select, PageHeader, Table, StatusBadge, EmptyState, ErrorState, FormStepper, LoadingState } from '../../components/common';
import { SERVICE_TERMS, rentalAmount } from './serviceRegistrationTerms';
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
 * D181: QR, ô ảnh chứng từ và điều khoản chỉ hiện sau khi backend kiểm tra thông tin (email, số điện thoại,
 * đơn chờ duyệt trùng, địa điểm trùng); sửa thông tin sau đó thì phải kiểm tra lại.
 */
export default function ServiceRegistrationPage() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const stepHeading = useRef(null);
  const [paymentAttempt, setPaymentAttempt] = useState(0);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [qrError, setQrError] = useState(false);
  const previousStep = useRef(0);
  const pendingFocus = useRef(null);
  useEffect(() => {
    if (previousStep.current !== step) {
      (pendingFocus.current ? document.getElementById(pendingFocus.current) : stepHeading.current)?.focus();
      pendingFocus.current = null;
    }
    previousStep.current = step;
  }, [step]);

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
  const mapLookupVersion = useRef(0);
  const submitInProgress = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef(null);
  // D181: khóa của thông tin đã qua kiểm tra; thông tin hiện tại khác khóa này thì phải kiểm tra lại mới hiện QR.
  const [checkedKey, setCheckedKey] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const successHeading = useRef(null);
  useEffect(() => { if (submitSuccess) successHeading.current?.focus(); }, [submitSuccess]);
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
  const addressDisabled = !canSubmit || isSubmitting || locating;

  useEffect(() => () => { mapLookupVersion.current += 1; }, []);

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
      })
      .finally(() => { if (!cancelled) setPaymentLoading(false); });
    return () => { cancelled = true; };
  }, [paymentAttempt]);

  // Thu hồi object URL của ảnh xem trước khi đổi ảnh hoặc rời trang.
  useEffect(() => () => { if (proofPreview) URL.revokeObjectURL(proofPreview); }, [proofPreview]);

  const amount = rentalAmount(formData.courtCount, formData.rentalYears,
    paymentInfo?.referenceFee, paymentInfo?.referenceCourts);

  /** Thông tin đơn gửi lên backend (không gồm điều khoản và ảnh chứng từ). */
  const buildPayload = () => ({
    locationName: formData.locationName.trim(),
    address,
    latitude: Number(formData.latitude),
    longitude: Number(formData.longitude),
    courtCount: Number(formData.courtCount),
    rentalYears: Number(formData.rentalYears),
    ...(!isOwner && {
      contactName: formData.contactName.trim(),
      contactPhone: formData.contactPhone.trim(),
      contactEmail: formData.contactEmail.trim(),
    }),
  });
  const payloadKey = JSON.stringify(buildPayload());
  const verified = checkedKey !== '' && checkedKey === payloadKey;

  const clearFieldError = (field) => {
    setFieldErrors(({ [field]: _removed, ...rest }) => rest);
  };

  const handleProofChange = (file) => {
    clearFieldError('proof');
    if (!file) {
      setProofFile(null);
      setProofPreview('');
      return;
    }
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
    // Đã sửa thông tin thì câu lỗi của lần kiểm tra/gửi trước (vd. email đã có tài khoản) không còn đúng.
    setSubmitError('');
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
    setSubmitError('');
  };

  const handleAddressChange = (field, value) => {
    mapLookupVersion.current += 1;
    setLookingUpAddress(false);
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
    setSubmitError('');
  };

  const lookupMapAddress = async (request) => {
    const version = ++mapLookupVersion.current;
    setLookingUpAddress(true);
    setMapAddressError('');
    setMapAddress('');
    try {
      const maps = await loadMaps();
      const { Geocoder } = await maps.importLibrary('geocoding');
      const { results } = await new Geocoder().geocode(request);
      const result = results[0];
      if (version !== mapLookupVersion.current) return;
      if (!result?.formatted_address) throw new Error("Không tìm thấy địa chỉ phù hợp");
      setMapAddress(result.formatted_address);
    } catch {
      if (version === mapLookupVersion.current) setMapAddressError('Google Maps chưa tra được địa chỉ tại điểm ghim. Vị trí bạn chọn vẫn được giữ.');
    } finally {
      if (version === mapLookupVersion.current) setLookingUpAddress(false);
    }
  };

  const handleMapPick = (latitude, longitude) => {
    if (submitInProgress.current) return;
    fillCoordinates(latitude, longitude);    setMapAddress('');
    setMapAddressError('');
    if (hasGoogleMapsKey) lookupMapAddress({ location: { lat: latitude, lng: longitude } });
  };

  const handleGetCurrentLocation = () => {
    if (submitInProgress.current || locating) return;
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

  /** payment = false: bỏ qua ảnh chứng từ và điều khoản (chưa đến bước chuyển khoản, D181). */
  const getValidationErrors = ({ payment = true } = {}) => {
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

    if (payment && !proofFile) {
      errors.proof = 'Vui lòng đính kèm ảnh chứng từ chuyển khoản tiền thuê.';
    }
    if (payment && !termsAccepted) {
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

  /** Hiện lỗi kiểm tra ở form: chuyển tới bước có trường sai đầu tiên và đưa con trỏ vào trường đó. */
  const showValidationErrors = (validationErrors) => {
    setFieldErrors(validationErrors);
    const firstError = Object.keys(validationErrors)[0];
    if (!firstError) return false;
    setStep(stepForField(firstError));
    const fieldId = { address: 'addressDetail', latitude: 'registration-map' }[firstError] || firstError;
    if (stepForField(firstError) !== step) pendingFocus.current = fieldId;
    const form = formRef.current;
    const field = form?.querySelector('[id="' + fieldId + '"]');
    const target = firstError === 'proof' ? form?.querySelector('label[for="proof"]') : field;
    requestAnimationFrame(() => { target?.scrollIntoView({ behavior: 'smooth', block: 'center' }); field?.focus({ preventScroll: true }); });
    return true;
  };

  /** Lỗi từ backend (kiểm tra hoặc gửi): email, số điện thoại, địa điểm trùng thì chuyển về đúng trường. */
  const showServerError = (err, fallback) => {
    const message = apiErrorMessage(err, fallback);
    setSubmitError(message);
    const field = /email/i.test(message) ? 'contactEmail'
      : /số điện thoại/i.test(message) ? 'contactPhone'
        : /^Địa điểm này/i.test(message) ? 'locationName' : null;
    if (!field || (isOwner && field !== 'locationName')) return;
    // Thông tin này phải sửa và kiểm tra lại trước khi chuyển khoản.
    setCheckedKey('');
    setFieldErrors((current) => ({ ...current, [field]: message }));
    pendingFocus.current = field;
    setStep(stepForField(field));
    requestAnimationFrame(() => document.getElementById(field)?.focus());
  };

  /** D181: kiểm tra thông tin ở backend (không lưu gì); qua thì mới sang bước chuyển khoản, hiện QR. */
  const handleCheck = async () => {
    if (addressDisabled || isChecking || submitInProgress.current || !canSubmit) return;
    setSubmitSuccess('');
    setSubmitError('');
    if (showValidationErrors(getValidationErrors({ payment: false }))) return;

    const key = payloadKey;
    setIsChecking(true);
    try {
      await checkServiceRegistration(buildPayload());
      setCheckedKey(key);
      setStep(3);
    } catch (err) {
      showServerError(err, 'Không kiểm tra được thông tin. Vui lòng thử lại.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (addressDisabled || submitInProgress.current) return;
    setSubmitSuccess('');
    setSubmitError('');

    if (!canSubmit) return;
    if (!verified) {
      handleCheck();
      return;
    }
    if (showValidationErrors(getValidationErrors())) return;

    submitInProgress.current = true;
    mapLookupVersion.current += 1;
    setLookingUpAddress(false);
    setIsSubmitting(true);
    try {
      const res = await submitServiceRegistration({ ...buildPayload(), termsAccepted }, proofFile);
      // MSG99 do backend trả về, có email nhận kết quả.
      setStep(3);
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
      setCheckedKey('');
      loadMyRegistrations();
    } catch (err) {
      showServerError(err, 'Không thể gửi đơn đăng ký. Vui lòng kiểm tra lại thông tin.');
    } finally {
      submitInProgress.current = false;
      setIsSubmitting(false);
    }
  };

  const steps = ['Địa điểm', 'Vị trí trên bản đồ', 'Người đại diện', 'Xem lại & gửi'];
  const stepFields = [
    ['locationName', 'provinceCode', 'wardCode', 'addressDetail', 'address', 'courtCount', 'rentalYears'],
    ['latitude', 'longitude'], ['contactName', 'contactPhone', 'contactEmail'], ['proof', 'terms'],
  ];
  function stepForField(field) { return Math.max(0, stepFields.findIndex(fields => fields.includes(field))); }
  function nextStep() {
    const errors = getValidationErrors();
    const currentErrors = Object.fromEntries(Object.entries(errors).filter(([field]) => stepFields[step].includes(field)));
    setFieldErrors(currentErrors);
    const first = Object.keys(currentErrors)[0];
    if (first) {
      document.getElementById(first === 'latitude' ? 'registration-map' : first === 'address' ? 'addressDetail' : first)?.focus();
      return;
    }
    // D181: rời bước Người đại diện là bấm Kiểm tra thông tin; qua kiểm tra mới sang bước chuyển khoản.
    if (step === 2 && !verified) {
      handleCheck();
      return;
    }
    setStep(current => Math.min(3, current + 1));
  }
  const price = value => value == null ? '—' : money(value).replace(/\s*₫/, 'đ');
  const errorText = field => fieldErrors[field] ? uiMessage(fieldErrors[field]) : undefined;
  const representative = isOwner ? {
    name: user?.full_name || user?.fullName || 'Thông tin từ tài khoản',
    phone: user?.phone_number || user?.phone || 'Chưa có thông tin', email: user?.email || 'Email của tài khoản',
  } : { name: formData.contactName, phone: formData.contactPhone, email: formData.contactEmail };
  const point = formData.latitude !== '' && formData.longitude !== '' && Math.abs(Number(formData.latitude)) <= 90 && Math.abs(Number(formData.longitude)) <= 180
    ? { lat: Number(formData.latitude), lng: Number(formData.longitude) } : null;
  const historyColumns = [
    { key: 'id', header: 'Mã đơn', render: item => '#' + item.id },
    { key: 'locationName', header: 'Địa điểm', render: item => <div><strong>{item.locationName}</strong><p className={styles.helper}>{item.address}</p></div> },
    { key: 'courtCount', header: 'Quy mô', render: item => `${item.courtCount} sân · ${item.rentalYears} năm` },
    { key: 'rentalAmount', header: 'Tiền thuê', render: item => price(item.rentalAmount) },
    { key: 'status', header: 'Trạng thái', render: item => <div><StatusBadge status={item.status} category="service_request" />{item.rejectReason && <p className={styles.helper}>{item.rejectReason}</p>}</div> },
    { key: 'createdAt', header: 'Ngày gửi', render: item => shortDate(item.createdAt) },
  ];

  return <PublicLayout>
    <div className={styles.container}>
      <PageHeader eyebrow="Dành cho chủ sân" title={isOwner ? 'Đăng ký thêm địa điểm' : 'Đưa sân của bạn lên Courtly'}
        subtitle={isOwner ? 'Địa điểm mới được gắn với tài khoản của bạn sau khi được duyệt.' : 'Một nơi để quản lý lịch sân, vận hành địa điểm và kết nối người chơi.'}
        breadcrumbs={[{ to: '/', label: 'Trang chủ' }, { label: 'Đăng ký sử dụng dịch vụ' }]} />
      {!canSubmit ? <ErrorState message="Chỉ khách chưa đăng nhập hoặc tài khoản Chủ sân có thể gửi yêu cầu đăng ký dịch vụ." /> : submitSuccess ?
        <section className={`${styles.card} ${styles.success}`} aria-labelledby="success-title">
          <span className={styles.successIcon} aria-hidden="true">✓</span>
          <StatusBadge status="PENDING" category="service_request" />
          <h1 ref={successHeading} id="success-title" tabIndex={-1}>Yêu cầu đang chờ xử lý</h1>
          <p role="status">{uiMessage(submitSuccess)}</p>
          <p>Kết quả xét duyệt sẽ được gửi qua email <strong>{representative.email}</strong>. Vui lòng kiểm tra cả hộp thư đến và thư rác.</p>
          <div className={styles.successActions}><Link to="/" className={styles.linkButton}>Về trang chủ</Link>
            {isOwner && <Button variant="secondary" onClick={() => { setSubmitSuccess(''); setStep(0); }}>Đăng ký địa điểm khác</Button>}
          </div>
        </section> : <>
        <FormStepper steps={steps} current={step} disabled={isSubmitting || locating} onChange={setStep} />
        <div className={styles.formLayout}>
          <section className={styles.card} aria-labelledby="step-title">
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>Bước {step + 1} / 4</p><h2 ref={stepHeading} id="step-title" tabIndex={-1}>{steps[step]}</h2>
              <p>{['Cho người chơi biết tên, địa chỉ và quy mô sân của bạn.', 'Đặt ghim chính xác để người chơi tìm đường đến sân.', isOwner ? 'Thông tin liên hệ được lấy từ tài khoản Chủ sân của bạn.' : 'Thông tin để nhận kết quả xét duyệt và quyền truy cập tài khoản.', verified ? 'Thông tin đã được kiểm tra. Chuyển khoản, đính kèm chứng từ và đồng ý điều khoản trước khi gửi.' : 'Hệ thống kiểm tra thông tin trước khi hiện thông tin chuyển khoản.'][step]}</p>
            </div>
            <p className={styles.requiredNote}>Các trường có dấu <span aria-hidden="true">*</span> là bắt buộc.</p>
            <form ref={formRef} noValidate onSubmit={event => { if (step < 3) { event.preventDefault(); nextStep(); } else handleSubmit(event); }} aria-busy={isSubmitting || isChecking}>
              <div hidden={step !== 0} className={styles.stepBody}>
                <FormField label="Tên địa điểm sân" required error={errorText('locationName')}><Input id="locationName" maxLength={100} placeholder="Ví dụ: Cầu lông Thành Công" value={formData.locationName} onChange={event => handleChange('locationName', event.target.value)} disabled={addressDisabled} /></FormField>
                <div className={styles.row}>
                  <FormField label="Tỉnh/Thành phố" required error={errorText('provinceCode')}><Select id="provinceCode" value={formData.provinceCode} onChange={event => handleAddressChange('provinceCode', event.target.value)} disabled={addressDisabled}><option value="">Chọn tỉnh/thành phố</option>{provinceOptions.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</Select></FormField>
                  <FormField label="Xã/Phường/Đặc khu" required error={errorText('wardCode')}><Select id="wardCode" value={formData.wardCode} onChange={event => handleAddressChange('wardCode', event.target.value)} disabled={addressDisabled || !province}><option value="">{province ? 'Chọn xã/phường/đặc khu' : 'Chọn tỉnh/thành phố trước'}</option>{wardOptions.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</Select></FormField>
                </div>
                <FormField label="Địa chỉ chi tiết" required error={errorText('addressDetail') || errorText('address')} hint={address ? 'Địa chỉ đầy đủ: ' + address : 'Số nhà, tên đường, thôn hoặc tổ dân phố.'}><Input id="addressDetail" maxLength={255} placeholder="Ví dụ: 24 Nguyễn Văn Huyên" value={formData.addressDetail} onChange={event => handleAddressChange('addressDetail', event.target.value)} disabled={addressDisabled} /></FormField>
                <p className={styles.attribution}>Danh mục hành chính: <a href={attribution.source}>{attribution.author}</a> · <a href={attribution.license}>CC BY 4.0</a></p>
                <div className={styles.row}>
                  <FormField label="Số lượng sân" required error={errorText('courtCount')} hint="Từ 1 đến 50 sân; được khởi tạo khi đơn được duyệt."><Input id="courtCount" type="number" min={1} max={50} value={formData.courtCount} onChange={event => handleChange('courtCount', event.target.value)} disabled={addressDisabled} /></FormField>
                  <FormField label="Số năm thuê" required error={errorText('rentalYears')} hint="Thời hạn tính từ ngày được duyệt."><Input id="rentalYears" type="number" min={1} max={MAX_RENTAL_YEARS} step={1} value={formData.rentalYears} onChange={event => handleChange('rentalYears', event.target.value)} disabled={addressDisabled} /></FormField>
                </div>
              </div>
              <div hidden={step !== 1} className={styles.stepBody}>
                <div className={styles.mapToolbar}><div><strong>Ghim vị trí sân</strong><p className={styles.helper}>Bấm bản đồ hoặc kéo ghim. Dùng bàn phím: di chuyển bản đồ bằng phím mũi tên, nhấn Enter để ghim ở tâm bản đồ. Vị trí thiết bị chỉ được lấy khi bạn bấm nút bên cạnh.</p></div><Button variant="secondary" loading={locating} disabled={addressDisabled} onClick={handleGetCurrentLocation}>Dùng vị trí hiện tại</Button></div>
                {locationError && <p role="alert" className={styles.error}>{locationError}</p>}
                <div id="registration-map" tabIndex={-1} aria-label="Vị trí sân trên bản đồ" aria-describedby={fieldErrors.latitude ? 'registration-map-error' : 'map-help'} className={styles.mapFrame}>
                  {step === 1 && <GoogleLocationPicker point={point} onPick={handleMapPick} disabled={isSubmitting || locating} className={styles.googleMap}
                    fallback={<LocationMap initialCenter={{ latitude: 21.028511, longitude: 105.854444 }} venues={!point ? [] : [{ facility_id: 'registration', latitude: point.lat, longitude: point.lng }]} onPick={handleMapPick} pickDisabled={isSubmitting || locating} />} />}
                </div>
                {fieldErrors.latitude && <p role="alert" id="registration-map-error" className={styles.error}>{errorText('latitude')}</p>}
                <div className={styles.pinInfo} id="map-help"><strong>{point ? 'Đã chọn điểm ghim' : 'Chưa chọn điểm ghim'}</strong><p>{point ? `Tọa độ: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : 'Đặt ghim trên bản đồ để tiếp tục.'}</p><p>Địa chỉ đã nhập: {address || 'Chưa có địa chỉ'}</p>
                  {lookingUpAddress && <p role="status">Đang tìm địa chỉ tại ghim…</p>}{mapAddress && <p role="status">Địa chỉ tham khảo tại ghim: {mapAddress}</p>}
                  {mapAddressError && <p role="alert">{mapAddressError} <Button variant="ghost" onClick={() => lookupMapAddress({ location: point })} disabled={!point || lookingUpAddress}>Thử lại</Button></p>}
                </div>
              </div>
              <div hidden={step !== 2} className={styles.stepBody}>
                {isOwner ? <div className={styles.pinInfo}><p className={styles.helper}>Bạn không cần nhập lại thông tin người đại diện.</p><dl className={styles.details}><dt>Họ và tên</dt><dd>{representative.name}</dd><dt>Số điện thoại</dt><dd>{representative.phone}</dd><dt>Email</dt><dd>{representative.email}</dd></dl></div> : <>
                  <FormField label="Họ và tên người liên hệ" required error={errorText('contactName')}><Input id="contactName" autoComplete="name" maxLength={50} placeholder="Nguyễn Minh Anh" value={formData.contactName} onChange={event => handleChange('contactName', event.target.value)} disabled={isSubmitting} /></FormField>
                  <FormField label="Số điện thoại" required error={errorText('contactPhone')}><Input id="contactPhone" type="tel" autoComplete="tel" maxLength={10} placeholder="0912345678" value={formData.contactPhone} onChange={event => handleChange('contactPhone', event.target.value)} disabled={isSubmitting} /></FormField>
                  <FormField label="Email liên hệ" required error={errorText('contactEmail')} hint="Kết quả xét duyệt và thông tin truy cập sẽ được gửi đến email này."><Input id="contactEmail" type="email" autoComplete="email" maxLength={100} placeholder="ban@example.com" value={formData.contactEmail} onChange={event => handleChange('contactEmail', event.target.value)} disabled={isSubmitting} /></FormField>
                  {/MSG103|email.*(tồn tại|sử dụng|tài khoản)/i.test(submitError) && <p className={styles.error}>Email đã có tài khoản. <Link to="/login" state={{ returnTo: '/register-service' }}>Đăng nhập để tiếp tục</Link>.</p>}
                </>}
              </div>
              <div hidden={step !== 3} className={styles.stepBody}>
                <section className={styles.review} aria-label="Thông tin xem lại"><div className={styles.reviewHeading}><h3>Thông tin đăng ký</h3><Button variant="ghost" disabled={isSubmitting} onClick={() => setStep(0)}>Chỉnh sửa</Button></div><dl className={styles.details}><dt>Địa điểm</dt><dd>{formData.locationName}</dd><dt>Địa chỉ</dt><dd>{address}</dd><dt>Vị trí</dt><dd>{point ? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : 'Chưa chọn ghim'}</dd><dt>Quy mô</dt><dd>{formData.courtCount} sân · {formData.rentalYears} năm</dd><dt>Người đại diện</dt><dd>{representative.name}<br />{representative.phone}<br />{representative.email}</dd></dl></section>
                {!verified ? <div className={styles.pinInfo}><strong>Chưa kiểm tra thông tin</strong><p>Bấm Kiểm tra thông tin để hệ thống kiểm tra email, số điện thoại và địa điểm. Thông tin chuyển khoản chỉ hiện khi thông tin hợp lệ, bạn chưa cần chuyển tiền ở bước này.</p></div> : <>
                <p className={styles.helper} role="status">Thông tin đã được kiểm tra. Nếu sửa lại thông tin, bạn cần kiểm tra lại trước khi chuyển khoản.</p>
                <section aria-labelledby="payment-title" className={styles.payment}><h3 id="payment-title">Chuyển khoản tiền thuê</h3><p>Chuyển <strong>{price(amount)}</strong> vào tài khoản bên vận hành, sau đó đính kèm ảnh chứng từ. Không giới hạn thời gian thanh toán.</p>
                  {paymentLoading ? <LoadingState message="Đang tải thông tin chuyển khoản…" /> : paymentInfoError ? <ErrorState message={paymentInfoError} onRetry={() => { setPaymentInfoError(''); setPaymentLoading(true); setPaymentAttempt(current => current + 1); }} /> : paymentInfo && <div className={styles.bank}>
                    <div>{qrError ? <div className={styles.qrFallback}><p>Chưa tải được mã QR.</p><Button variant="secondary" onClick={() => setQrError(false)}>Thử lại</Button></div> : <img src={operatorQrUrl(paymentInfo.updatedAt)} onError={() => setQrError(true)} alt="Mã QR chuyển khoản của bên vận hành" width={180} height={180} />}<a className={styles.download} href={operatorQrUrl(paymentInfo.updatedAt)} download="qr-ben-van-hanh.png">Lưu ảnh QR</a></div>
                    <dl className={styles.details}><dt>Ngân hàng</dt><dd>{paymentInfo.bankName}</dd><dt>Số tài khoản</dt><dd>{paymentInfo.bankAccountNo}</dd><dt>Chủ tài khoản</dt><dd>{paymentInfo.bankAccountHolder}</dd><dt>Số tiền</dt><dd><strong>{price(amount)}</strong></dd></dl>
                  </div>}
                </section>
                <FormField htmlFor="proof" label="Ảnh chứng từ chuyển khoản" required error={errorText('proof')} hint="Ảnh JPG hoặc PNG, tối đa 5 MB."><FileInput selectedFileName={proofFile?.name || ''} id="proof" accept="image/jpeg,image/png" disabled={isSubmitting} aria-invalid={Boolean(fieldErrors.proof)} aria-describedby={fieldErrors.proof ? 'proof-error' : 'proof-hint'} onChange={event => { handleProofChange(event.target.files?.[0] ?? null); event.target.value = ''; }} />
                  {proofPreview && <img className={styles.proofPreview} src={proofPreview} alt="Ảnh chứng từ đã chọn" />}
                  {proofFile && <Button variant="ghost" disabled={isSubmitting} onClick={() => handleProofChange(null)}>Bỏ ảnh đã chọn</Button>}
                </FormField>
                <section aria-labelledby="terms-title"><h3 id="terms-title">Điều khoản sử dụng dịch vụ</h3><div role="region" aria-label="Nội dung điều khoản" tabIndex={0} className={styles.terms}><ol>{SERVICE_TERMS.map(term => <li key={term}>{term}</li>)}</ol></div>
                  <label className={styles.checkbox}><input id="terms" type="checkbox" checked={termsAccepted} disabled={isSubmitting} aria-invalid={Boolean(fieldErrors.terms)} aria-describedby={fieldErrors.terms ? 'terms-error' : undefined} onChange={event => { setTermsAccepted(event.target.checked); clearFieldError('terms'); }} /><span>Tôi đã đọc và đồng ý các điều khoản sử dụng dịch vụ.</span></label>
                  {fieldErrors.terms && <p className={styles.error} id="terms-error" role="alert">{errorText('terms')}</p>}
                </section>
                </>}
              </div>
              {submitError && <div role="alert" className={styles.errorBanner}><p>{uiMessage(submitError)}</p>{step === 3 && <Button type="submit" variant="secondary" disabled={isSubmitting || isChecking} loading={isSubmitting || isChecking}>Thử lại</Button>}</div>}
              <div className={styles.formFooter}>{step > 0 ? <Button variant="secondary" disabled={isSubmitting || isChecking || locating} onClick={() => setStep(current => current - 1)}>Quay lại</Button> : <span className={styles.helper}>Thông tin được giữ khi chuyển bước.</span>}
                {step < 3
                  ? <Button key="continue" onClick={event => { event.preventDefault(); nextStep(); }} loading={step === 2 && isChecking} disabled={locating || isChecking}>{step === 2 && !verified ? 'Kiểm tra thông tin →' : 'Tiếp tục →'}</Button>
                  : <Button key="submit" type="submit" loading={isSubmitting || isChecking} disabled={addressDisabled || isChecking}>{verified ? 'Gửi đơn đăng ký dịch vụ' : 'Kiểm tra thông tin'}</Button>}
              </div>
            </form>
          </section>
          <aside className={styles.summary} data-review={step === 3} aria-label="Tóm tắt đăng ký"><p className={styles.eyebrow}>Yêu cầu của bạn</p><h3>{formData.locationName || 'Địa điểm mới'}</h3><p>{address || 'Hoàn tất địa chỉ ở bước 1'}</p><dl className={styles.details}><dt>Số sân</dt><dd>{formData.courtCount || '—'}</dd><dt>Thời hạn</dt><dd>{formData.rentalYears} năm</dd></dl><div className={styles.total}><span>Tiền thuê dự kiến</span><strong aria-live="polite">{price(amount)}</strong></div><p className={styles.helper}>Tính theo số sân và số năm thuê, làm tròn lên nghìn đồng. Thời hạn bắt đầu khi đơn được duyệt.</p><div className={styles.nextInfo}><strong>Sau khi gửi yêu cầu</strong><p>Bên vận hành kiểm tra thông tin và khoản chuyển. Bạn nhận kết quả qua email.</p></div></aside>
        </div>
      </>}
      {isOwner && <section className={styles.card} aria-labelledby="history-title"><div className={styles.reviewHeading}><div><h2 id="history-title">Lịch sử đơn đăng ký</h2><p className={styles.helper}>Theo dõi tiến độ xét duyệt địa điểm của bạn.</p></div><Button variant="ghost" loading={isLoadingList} onClick={loadMyRegistrations}>Làm mới</Button></div>
        {isLoadingList ? <LoadingState message="Đang tải danh sách đơn đăng ký…" /> : listError ? <ErrorState message={listError} onRetry={loadMyRegistrations} /> : !myRegistrations.length ? <EmptyState title="Chưa có đơn đăng ký" description="Hoàn tất bốn bước phía trên để gửi địa điểm đầu tiên của bạn." action={<Button variant="secondary" onClick={() => { setSubmitSuccess(''); setStep(0); requestAnimationFrame(() => stepHeading.current?.scrollIntoView({ block: 'center' })); }}>Điền thông tin địa điểm</Button>} /> : <Table columns={historyColumns} data={myRegistrations} />}
      </section>}
    </div>
  </PublicLayout>;
}
