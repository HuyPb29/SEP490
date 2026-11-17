import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { apiErrorMessage } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import LocationMap from '../../components/map/LocationMap';
import PublicLayout from '../../components/layout/PublicLayout';
import { LoadingState } from '../../components/common';
import styles from './ServiceRegistrationPage.module.css';

export default function ServiceRegistrationPage() {
  const { user } = useAuth();

  const roleCode = String(user?.role_code || user?.role || '').toLowerCase();
  const isOwner = roleCode === 'owner';
  const canSubmit = !user || isOwner;

  const [formData, setFormData] = useState({
    locationName: '',
    address: '',
    latitude: '',
    longitude: '',
    courtCount: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [coordinatePair, setCoordinatePair] = useState('');
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);

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

  const fillCoordinates = (latitude, longitude) => {
    setFormData((prev) => ({
      ...prev,
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
    }));
    setFieldErrors(({ latitude: _latitude, longitude: _longitude, ...rest }) => rest);
    setLocationError('');
  };

  const applyCoordinatePair = () => {
    const match = coordinatePair.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/);
    if (!match || Math.abs(Number(match[1])) > 90 || Math.abs(Number(match[2])) > 180) {
      setLocationError('Dán tọa độ theo dạng vĩ độ, kinh độ. Ví dụ: 21.028511, 105.854444.');
      return;
    }
    fillCoordinates(Number(match[1]), Number(match[2]));
    setCoordinatePair('');
  };

  const handleGetCurrentLocation = () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocationError('Không thể dùng định vị ở trình duyệt này. Bạn có thể dán tọa độ từ Google Maps.');
      return;
    }
    setLocationError('');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        fillCoordinates(coords.latitude, coords.longitude);
        setLocating(false);
      },
      (error) => {
        const messages = {
          1: 'Quyền vị trí đang bị chặn. Hãy cho phép vị trí trong cài đặt trang hoặc dán tọa độ từ Google Maps.',
          2: 'Thiết bị không xác định được vị trí. Bạn có thể dán tọa độ từ Google Maps.',
          3: 'Đã hết thời gian lấy vị trí. Hãy thử lại hoặc dán tọa độ từ Google Maps.',
        };
        setLocationError(messages[error.code] ?? 'Không lấy được vị trí. Bạn có thể dán tọa độ từ Google Maps.');
        setLocating(false);
      },
      { timeout: 10000 }
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
    if (!Number.isInteger(courts) || courts < 1) {
      errors.courtCount = 'Số sân phải lớn hơn 0.';
    } else if (courts > 50) {
      errors.courtCount = 'Số sân tối đa là 50 sân trên một cơ sở.';
    }

    if (!isOwner) {
      if (!formData.contactName.trim()) {
        errors.contactName = 'Tên người liên hệ không được để trống.';
      }
      if (!/^[0-9]{10}$/.test(formData.contactPhone.trim())) {
        errors.contactPhone = 'Số điện thoại liên hệ phải gồm đúng 10 chữ số.';
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim())) {
        errors.contactEmail = 'Nhập email hợp lệ để nhận quyền truy cập tài khoản sau khi được duyệt.';
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitSuccess('');
    setSubmitError('');

    if (!canSubmit) return;

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        locationName: formData.locationName.trim(),
        address: formData.address.trim(),
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        courtCount: Number(formData.courtCount),
        ...(!isOwner && {
          contactName: formData.contactName.trim(),
          contactPhone: formData.contactPhone.trim(),
          contactEmail: formData.contactEmail.trim(),
        }),
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
        {submitSuccess && !isOwner && (
          <p>Sau khi Admin duyệt, vào <Link to="/login">Đăng nhập</Link>, chọn Quên mật khẩu và dùng email đã gửi để đặt mật khẩu lần đầu.</p>
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
                disabled={!canSubmit || isSubmitting}
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
                disabled={!canSubmit || isSubmitting}
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
                  disabled={!canSubmit || isSubmitting}
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
                  disabled={!canSubmit || isSubmitting}
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
                  disabled={!canSubmit || isSubmitting}
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
                disabled={!canSubmit || isSubmitting || locating}
              >
                {locating ? 'Đang lấy vị trí…' : 'Lấy tọa độ GPS hiện tại'}
              </button>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="coordinatePair">Tọa độ từ Google Maps</label>
              <div className={styles.coordActionRow}>
                <input id="coordinatePair" className={styles.input} value={coordinatePair}
                  onChange={(event) => setCoordinatePair(event.target.value)}
                  placeholder="Vĩ độ, kinh độ" disabled={!canSubmit || isSubmitting || locating} />
                <button type="button" className={styles.secondaryBtn} onClick={applyCoordinatePair}
                  disabled={!canSubmit || isSubmitting || locating || !coordinatePair.trim()}>
                  Điền tọa độ
                </button>
              </div>
              {locationError && <p className={styles.errorText} role="alert">{locationError}</p>}
            </div>

            {canSubmit && (
              <div className="mt-4 max-w-md">
                <p>Chọn điểm ghim trên bản đồ hoặc nhập tọa độ bên trên.</p>
                <LocationMap
                  initialCenter={{ latitude: 21.028511, longitude: 105.854444 }}
                  venues={formData.latitude === '' || formData.longitude === '' ? [] :
                    [{ facility_id: 'registration', latitude: formData.latitude, longitude: formData.longitude }]}
                  onPick={fillCoordinates}
                  pickDisabled={isSubmitting || locating}
                />
              </div>
            )}

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

            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={!canSubmit || isSubmitting}
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
