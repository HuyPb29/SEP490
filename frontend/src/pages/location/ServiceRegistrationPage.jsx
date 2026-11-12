import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import PublicLayout from '../../components/layout/PublicLayout';
import { LoadingState } from '../../components/common';
import styles from './ServiceRegistrationPage.module.css';

const DEFAULT_COORDS = {
  latitude: 21.028511,
  longitude: 105.854444,
};

export default function ServiceRegistrationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const roleCode = String(user?.role_code || user?.role || '').toLowerCase();
  const isOwner = roleCode === 'owner';

  const [formData, setFormData] = useState({
    locationName: '',
    address: '',
    latitude: DEFAULT_COORDS.latitude,
    longitude: DEFAULT_COORDS.longitude,
    courtCount: 4,
    contactName: user?.fullName || user?.full_name || '',
    contactPhone: user?.phone || '',
    contactEmail: user?.email || '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Danh sách đơn đăng ký đã gửi
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listError, setListError] = useState('');

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

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSubmitError('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.latitude;
          delete next.longitude;
          return next;
        });
      },
      () => {
        setSubmitError('Không thể lấy tọa độ hiện tại. Vui lòng cấp quyền định vị hoặc nhập thủ công.');
      }
    );
  };

  const validate = () => {
    const errors = {};

    if (!formData.locationName.trim()) {
      errors.locationName = 'Tên địa điểm không được để trống.';
    } else if (formData.locationName.trim().length > 100) {
      errors.locationName = 'Tên địa điểm tối đa 100 ký tự.';
    }

    if (!formData.address.trim()) {
      errors.address = 'Địa chỉ không được để trống.';
    } else if (formData.address.trim().length > 255) {
      errors.address = 'Địa chỉ tối đa 255 ký tự.';
    }

    const lat = Number(formData.latitude);
    if (formData.latitude === '' || isNaN(lat)) {
      errors.latitude = 'Vĩ độ không được để trống.';
    } else if (lat < -90 || lat > 90) {
      errors.latitude = 'Vĩ độ phải nằm trong khoảng từ -90 đến 90.';
    }

    const lng = Number(formData.longitude);
    if (formData.longitude === '' || isNaN(lng)) {
      errors.longitude = 'Kinh độ không được để trống.';
    } else if (lng < -180 || lng > 180) {
      errors.longitude = 'Kinh độ phải nằm trong khoảng từ -180 đến 180.';
    }

    const courts = Number(formData.courtCount);
    if (!courts || isNaN(courts) || courts < 1) {
      errors.courtCount = 'Số sân phải lớn hơn 0.';
    } else if (courts > 50) {
      errors.courtCount = 'Số sân tối đa là 50 sân trên một cơ sở.';
    }

    if (formData.contactName && formData.contactName.length > 50) {
      errors.contactName = 'Tên người liên hệ tối đa 50 ký tự.';
    }

    if (!formData.contactPhone) {
      errors.contactPhone = 'Số điện thoại liên hệ không được để trống.';
    } else if (!/^[0-9]{10}$/.test(formData.contactPhone.trim())) {
      errors.contactPhone = 'Số điện thoại phải gồm đúng 10 chữ số.';
    }

    if (formData.contactEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim())) {
        errors.contactEmail = 'Email liên hệ không đúng định dạng.';
      } else if (formData.contactEmail.length > 100) {
        errors.contactEmail = 'Email liên hệ tối đa 100 ký tự.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitSuccess('');
    setSubmitError('');

    if (!user) {
      navigate('/login', { state: { returnTo: '/register-service' } });
      return;
    }

    if (!isOwner) {
      setSubmitError('Chỉ tài khoản Chủ sân (Owner) mới có quyền nộp đơn đăng ký cơ sở dịch vụ.');
      return;
    }

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        locationName: formData.locationName.trim(),
        address: formData.address.trim(),
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        courtCount: Number(formData.courtCount),
        contactName: formData.contactName.trim() || null,
        contactPhone: formData.contactPhone.trim(),
        contactEmail: formData.contactEmail.trim() || null,
      };

      const res = await api.post('/service-registrations', payload);
      setSubmitSuccess(
        res.data?.message || 'Đơn đăng ký sử dụng dịch vụ đã được gửi thành công! Quản trị viên sẽ sớm liên hệ và xét duyệt.'
      );
      // Reset form
      setFormData((prev) => ({
        ...prev,
        locationName: '',
        address: '',
      }));
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
      title="Đăng ký dịch vụ sân"
      subtitle="Đưa cơ sở cầu lông của bạn lên hệ thống Courtly để tiếp cận hàng ngàn người chơi"
    >
      <div className={styles.container}>
        {/* Banner giới thiệu */}
        <div className={styles.introCard}>
          <h2 className={styles.introHeading}>Trở thành đối tác của Courtly</h2>
          <p className={styles.introText}>
            Hệ thống Courtly giúp bạn quản lý lịch đặt sân, doanh thu, nhân viên và kết nối với cộng đồng người chơi cầu
            lông năng động. Hãy điền thông tin cơ sở của bạn để bắt đầu!
          </p>
        </div>

        {/* Kiểm tra điều kiện vai trò */}
        {!user ? (
          <div className={`${styles.alertBox} ${styles.alertWarning}`}>
            <div>
              <strong>Bạn chưa đăng nhập:</strong> Vui lòng đăng nhập bằng tài khoản Chủ sân (Owner) để gửi đơn đăng ký.
              <div style={{ marginTop: 10 }}>
                <Link
                  to="/login"
                  state={{ returnTo: '/register-service' }}
                  className={styles.primaryBtn}
                  style={{ textDecoration: 'none', height: 40, minHeight: 40, fontSize: 14 }}
                >
                  Đăng nhập ngay
                </Link>
              </div>
            </div>
          </div>
        ) : !isOwner ? (
          <div className={`${styles.alertBox} ${styles.alertWarning}`}>
            <div>
              <strong>Thông báo vai trò:</strong> Bạn đang đăng nhập với tài khoản người chơi/nhân viên. Chỉ tài khoản{' '}
              <strong>Chủ sân (Owner)</strong> mới có quyền gửi đơn đăng ký mở cụm sân mới. Bạn có thể đăng ký tài khoản Chủ sân mới để tiếp tục.
            </div>
          </div>
        ) : null}

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
            Các mục đánh dấu <span className={styles.requiredMark}>*</span> là bắt buộc. Sau khi gửi, Quản trị viên sẽ xác thực và phê duyệt địa điểm của bạn.
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
                disabled={!isOwner || isSubmitting}
              />
              {fieldErrors.locationName && (
                <p className={styles.errorText} role="alert">{fieldErrors.locationName}</p>
              )}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="address">
                <span>Địa chỉ chi tiết <span className={styles.requiredMark}>*</span></span>
              </label>
              <input
                id="address"
                type="text"
                maxLength={255}
                placeholder="VD: Số 123 Đường Cầu Giấy, Phường Dịch Vọng, Quận Cầu Giấy, Hà Nội"
                className={`${styles.input} ${fieldErrors.address ? styles.inputError : ''}`}
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                disabled={!isOwner || isSubmitting}
              />
              {fieldErrors.address && (
                <p className={styles.errorText} role="alert">{fieldErrors.address}</p>
              )}
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
                  disabled={!isOwner || isSubmitting}
                />
                {fieldErrors.courtCount && (
                  <p className={styles.errorText} role="alert">{fieldErrors.courtCount}</p>
                )}
                <p className={styles.helperText}>Hệ thống sẽ tự động khởi tạo các sân này khi được duyệt.</p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="latitude">
                  <span>Vĩ độ (Latitude) <span className={styles.requiredMark}>*</span></span>
                </label>
                <input
                  id="latitude"
                  type="number"
                  step="any"
                  className={`${styles.input} ${fieldErrors.latitude ? styles.inputError : ''}`}
                  value={formData.latitude}
                  onChange={(e) => handleChange('latitude', e.target.value)}
                  disabled={!isOwner || isSubmitting}
                />
                {fieldErrors.latitude && (
                  <p className={styles.errorText} role="alert">{fieldErrors.latitude}</p>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="longitude">
                  <span>Kinh độ (Longitude) <span className={styles.requiredMark}>*</span></span>
                </label>
                <input
                  id="longitude"
                  type="number"
                  step="any"
                  className={`${styles.input} ${fieldErrors.longitude ? styles.inputError : ''}`}
                  value={formData.longitude}
                  onChange={(e) => handleChange('longitude', e.target.value)}
                  disabled={!isOwner || isSubmitting}
                />
                {fieldErrors.longitude && (
                  <p className={styles.errorText} role="alert">{fieldErrors.longitude}</p>
                )}
              </div>
            </div>

            <div className={styles.coordActionRow}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleGetCurrentLocation}
                disabled={!isOwner || isSubmitting}
              >
                📍 Lấy tọa độ GPS hiện tại
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    latitude: DEFAULT_COORDS.latitude,
                    longitude: DEFAULT_COORDS.longitude,
                  }));
                }}
                disabled={!isOwner || isSubmitting}
              >
                Tọa độ mẫu (Hà Nội)
              </button>
            </div>

            <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

            <h4 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--color-text)' }}>
              Thông tin người đại diện liên hệ
            </h4>

            <div className={styles.threeColRow}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="contactName">
                  <span>Họ và tên người liên hệ</span>
                </label>
                <input
                  id="contactName"
                  type="text"
                  maxLength={50}
                  placeholder="VD: Nguyễn Văn A"
                  className={`${styles.input} ${fieldErrors.contactName ? styles.inputError : ''}`}
                  value={formData.contactName}
                  onChange={(e) => handleChange('contactName', e.target.value)}
                  disabled={!isOwner || isSubmitting}
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
                  disabled={!isOwner || isSubmitting}
                />
                {fieldErrors.contactPhone && (
                  <p className={styles.errorText} role="alert">{fieldErrors.contactPhone}</p>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="contactEmail">
                  <span>Email liên hệ</span>
                </label>
                <input
                  id="contactEmail"
                  type="email"
                  maxLength={100}
                  placeholder="VD: owner@example.com"
                  className={`${styles.input} ${fieldErrors.contactEmail ? styles.inputError : ''}`}
                  value={formData.contactEmail}
                  onChange={(e) => handleChange('contactEmail', e.target.value)}
                  disabled={!isOwner || isSubmitting}
                />
                {fieldErrors.contactEmail && (
                  <p className={styles.errorText} role="alert">{fieldErrors.contactEmail}</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={!isOwner || isSubmitting}
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
                        <td>
                          {item.status === 'APPROVED' ? (
                            <span className={`${styles.badge} ${styles.badgeApproved}`}>Đã duyệt</span>
                          ) : item.status === 'REJECTED' ? (
                            <span className={`${styles.badge} ${styles.badgeRejected}`} title={item.rejectionReason}>
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
