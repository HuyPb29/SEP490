import { subscribeLiveRefresh } from '../../utils/liveRefresh';
import { useCallback, useEffect, useState } from 'react';
import {
  apiErrorMessage,
  approveMaintenanceRequest,
  cancelMaintenanceRequest,
  createMaintenanceRequest,
  getMaintenanceRequests,
  getMaintenanceImpact,
  getOwnerLocations,
  getStaffCourts,
  getStoredLocationId,
  rejectMaintenanceRequest,
  storeLocationId,
} from '../../api/locationApi';
import { Button } from '../../components/common/Button';
import { FormField, Input, Select, Textarea } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import ManagementLayout from '../../components/layout/ManagementLayout';
import { useAuth } from '../../hooks/useAuth';
import styles from './MaintenanceRequestsPage.module.css';

/** UC10 – Bảo trì sân: Staff (và Owner) tạo, rút yêu cầu; Owner duyệt hoặc từ chối (FR23–FR25, BR16, BR17). */

const STATUS_TABS = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Bị từ chối' },
  { value: 'CANCELLED', label: 'Đã rút' },
  { value: '', label: 'Tất cả' },
];

const STATUS_LABELS = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
  CANCELLED: 'Đã rút',
  COMPLETED: 'Hoàn thành',
};

const STATUS_TONE = {
  PENDING: 'badgeWarning',
  APPROVED: 'badgeSuccess',
  REJECTED: 'badgeDanger',
  CANCELLED: 'badgeNeutral',
  COMPLETED: 'badgeNeutral',
};

/** LocalDateTime "2026-11-10T19:00:00" -> "10/11/2026 19:00". */
function formatDateTime(value) {
  if (!value) return '—';
  const [datePart, timePart = ''] = String(value).split('T');
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year} ${timePart.slice(0, 5)}`;
}

/** Hai mốc cùng ngày thì ghi gọn "25/11/2026 · 07:00–11:00". */
function formatRange(startAt, endAt) {
  if (!startAt || !endAt) return '—';
  const [startDate, startTime = ''] = String(startAt).split('T');
  const [endDate, endTime = ''] = String(endAt).split('T');
  if (startDate === endDate) {
    const [year, month, day] = startDate.split('-');
    return `${day}/${month}/${year} · ${startTime.slice(0, 5)}–${endTime.slice(0, 5)}`;
  }
  return `${formatDateTime(startAt)} → ${formatDateTime(endAt)}`;
}

function formatDuration(minutes) {
  if (!minutes) return '';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  return [days && `${days} ngày`, hours && `${hours} giờ`, rest && `${rest} phút`].filter(Boolean).join(' ');
}

function defaultStartAt() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const pad = (number) => String(number).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function addHours(inputValue, hours) {
  if (!inputValue) return '';
  const date = new Date(`${inputValue}:00`);
  date.setHours(date.getHours() + hours);
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function emptyForm() {
  const startAt = defaultStartAt();
  return { courtId: '', startAt, endAt: addHours(startAt, 2), reason: '' };
}

export default function MaintenanceRequestsPage() {
  const { user: currentUser, role: rawRole } = useAuth();
  const role = String(rawRole || currentUser?.role_code || '').toUpperCase();
  const isOwner = role === 'OWNER';
  const isStaff = role === 'STAFF';

  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(() => getStoredLocationId());
  const [staffCourts, setStaffCourts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const selectedLocation =
    locations.find((location) => String(location.id) === String(selectedLocationId)) || null;
  const courts = isOwner ? (selectedLocation?.courts ?? []) : staffCourts;
  const ownerLocationId = isOwner ? selectedLocation?.id : undefined;
  const canCreate = isStaff || (isOwner && selectedLocation?.status === 'ACTIVE');

  // Tải mọi trạng thái một lần, lọc theo tab ở giao diện để tab hiện được số đếm.
  const loadRequests = useCallback(async () => {
    if ((!isOwner && !isStaff) || (isOwner && !ownerLocationId)) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await getMaintenanceRequests(isOwner ? 'OWNER' : 'STAFF', null, ownerLocationId);
      setRequests(list);
      setActionError('');
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isOwner, isStaff, ownerLocationId]);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      if (isOwner) {
        try {
          const list = await getOwnerLocations();
          if (!active) return;
          setLocations(list);
          if (list.length === 0) setLoading(false);
          setSelectedLocationId((currentId) => {
            const exists = list.some((location) => String(location.id) === String(currentId));
            const nextId = exists ? currentId : list[0]?.id ?? null;
            storeLocationId(nextId);
            return nextId;
          });
        } catch (err) {
          if (active) setActionError(apiErrorMessage(err));
        }
      }
      if (isStaff) {
        try {
          const list = await getStaffCourts();
          if (!active) return;
          setStaffCourts(list);
        } catch (err) {
          if (active) setActionError(apiErrorMessage(err));
        }
      }
    };
    bootstrap();
    return () => {
      active = false;
    };
  }, [isOwner, isStaff]);

  useEffect(() => {
    let active = true;
    if ((!isOwner && !isStaff) || (isOwner && !ownerLocationId)) return undefined;
    setLoading(true);
    const refresh = () => getMaintenanceRequests(isOwner ? 'OWNER' : 'STAFF', null, ownerLocationId)
      .then((list) => {
        if (!active) return;
        setRequests(list);
        setActionError('');
      })
      .catch((err) => {
        if (active) setActionError(apiErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const stop = subscribeLiveRefresh(refresh, 5000, true);
    return () => {
      active = false; stop();
    };
  }, [isOwner, isStaff, ownerLocationId]);

  const openCreate = () => {
    setForm(emptyForm());
    setFormError('');
    setCreating(true);
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    if (!form.courtId) {
      setFormError('Vui lòng chọn sân cần bảo trì.');
      return;
    }
    if (!form.startAt || !form.endAt) {
      setFormError('Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc.');
      return;
    }
    if (new Date(`${form.startAt}:00`) >= new Date(`${form.endAt}:00`)) {
      setFormError('Thời gian kết thúc phải sau thời gian bắt đầu.');
      return;
    }
    if (!form.reason.trim()) {
      setFormError('Vui lòng nhập lý do bảo trì.');
      return;
    }

    setSaving(true);
    setFormError('');
    setStatusMessage('');
    try {
      await createMaintenanceRequest({
        courtId: Number(form.courtId),
        startAt: `${form.startAt}:00`,
        endAt: `${form.endAt}:00`,
        reason: form.reason.trim(),
      }, ownerLocationId);
      setForm(emptyForm());
      setCreating(false);
      setStatusFilter('PENDING');
      await loadRequests();
      setStatusMessage('Đã gửi yêu cầu bảo trì thành công.');
    } catch (err) {
      if (err.response?.status === 409) await loadRequests();
      setFormError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id) => {
    setSaving(true);
    setActionError('');
    setStatusMessage('');
    try {
      const impact = await getMaintenanceImpact(id, ownerLocationId);
      if (impact.affectedCount > 0) {
        setApproveTarget(impact);
        return;
      }
      await approveMaintenanceRequest(id, ownerLocationId, impact.bookings);
      await loadRequests();
      setStatusMessage('Đã duyệt yêu cầu bảo trì.');
    } catch (err) {
      if (err.response?.status === 409) {
        await loadRequests();
        try { setApproveTarget(await getMaintenanceImpact(id, ownerLocationId)); }
        catch { setApproveTarget(null); }
      }
      setActionError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmApprove = async () => {
    if (!approveTarget || saving) return;
    setSaving(true);
    setActionError('');
    try {
      await approveMaintenanceRequest(approveTarget.maintenanceId, ownerLocationId, approveTarget.bookings);
      setApproveTarget(null);
      await loadRequests();
      setStatusMessage("Đã duyệt bảo trì và xử lý các đặt sân bị ảnh hưởng.");
    } catch (err) {
      if (err.response?.status === 409) {
        await loadRequests();
        try { setApproveTarget(await getMaintenanceImpact(approveTarget.maintenanceId, ownerLocationId)); }
        catch { setApproveTarget(null); }
      }
      setActionError(apiErrorMessage(err));
    } finally { setSaving(false); }
  };

  const handleCancel = async (id) => {
    setSaving(true);
    setActionError('');
    setStatusMessage('');
    try {
      await cancelMaintenanceRequest(id, null, ownerLocationId);
      await loadRequests();
      setStatusMessage('Đã rút yêu cầu bảo trì.');
    } catch (err) {
      if (err.response?.status === 409) await loadRequests();
      setActionError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRejectSubmit = async (event) => {
    event.preventDefault();
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      setActionError('Vui lòng nhập lý do từ chối.');
      return;
    }

    setSaving(true);
    try {
      await rejectMaintenanceRequest(rejectTarget.id, rejectReason.trim(), ownerLocationId);
      setRejectTarget(null);
      setRejectReason('');
      await loadRequests();
      setActionError('');
      setStatusMessage('Đã từ chối yêu cầu bảo trì.');
    } catch (err) {
      if (err.response?.status === 409) {
        setRejectTarget(null);
        setApproveTarget(null);
        setRejectReason('');
        await loadRequests();
      }
      setActionError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const countOf = (status) => (status ? requests.filter((request) => request.status === status).length : requests.length);
  const pendingCount = countOf('PENDING');
  const visible = requests
    .filter((request) => !statusFilter || request.status === statusFilter)
    .sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));

  if (!isOwner && !isStaff) {
    return (
      <ManagementLayout role="staff" title="Yêu cầu bảo trì">
        <p className={styles.empty}>Trang này chỉ dành cho chủ sân hoặc nhân viên của địa điểm.</p>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout
      role={isOwner ? 'owner' : 'staff'}
      title={isOwner ? 'Duyệt yêu cầu bảo trì' : 'Yêu cầu bảo trì'}
      subtitle={isOwner
        ? `Có ${pendingCount} yêu cầu đang chờ duyệt. Khi duyệt, sân bị khóa trong khoảng thời gian đó; booking bị ảnh hưởng được xử lý theo quy trình sân hủy lịch.`
        : 'Nhân viên tạo yêu cầu, chủ sân duyệt. Khi được duyệt, sân bị khóa trong khoảng thời gian đó; booking bị ảnh hưởng được xử lý theo quy trình sân hủy lịch.'}
      actions={canCreate && (
        <button type="button" className={styles.primary} onClick={openCreate}>+ Tạo yêu cầu bảo trì</button>
      )}
      locations={locations}
      locationId={selectedLocationId}
      onLocationChange={(nextId) => {
        if (String(nextId) === String(selectedLocationId)) return;
        setSelectedLocationId(nextId);
        storeLocationId(nextId);
        setRequests([]);
        setRejectTarget(null);
        setApproveTarget(null);
        setRejectReason('');
        setForm(emptyForm());
        setCreating(false);
        setLoading(Boolean(nextId));
        setActionError('');
        setStatusMessage('');
      }}
    >
      {statusMessage && <p className={styles.success} role="status">{statusMessage}</p>}
      {actionError && !approveTarget && !rejectTarget && <p className={styles.error} role="alert">{actionError}</p>}

      <section className={styles.board} aria-label="Danh sách yêu cầu bảo trì">
        <div className={styles.tabs} role="tablist" aria-label="Lọc theo trạng thái">
          {STATUS_TABS.map((tab) => {
            const n = countOf(tab.value);
            return (
              <button key={tab.value || 'all'} type="button" role="tab" aria-selected={statusFilter === tab.value}
                className={statusFilter === tab.value ? styles.tabOn : ''} onClick={() => setStatusFilter(tab.value)}>
                {tab.label}<span className={tab.value === 'PENDING' && n > 0 ? styles.countHot : styles.count}>{n}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className={styles.empty} role="status">Đang tải danh sách yêu cầu…</p>
        ) : visible.length === 0 ? (
          <p className={styles.empty}>Không có yêu cầu bảo trì trong mục này.</p>
        ) : (
          <div className={styles.cards}>
            {visible.map((request) => {
              const isOwn = String(request.requestedBy) === String(currentUser?.user_id);
              const canDecide = isOwner && request.status === 'PENDING';
              const canWithdraw = (isStaff || isOwner) && isOwn && request.status === 'PENDING';
              const rejectNote = request.rejectReason ?? request.rejectionReason;
              return (
                <article key={request.id} className={styles.card}>
                  <header>
                    <h3>{request.courtName}</h3>
                    <span className={`${styles.badge} ${styles[STATUS_TONE[request.status]] ?? ''}`}>
                      {STATUS_LABELS[request.status] ?? request.status}
                    </span>
                  </header>
                  <p className={styles.range}>
                    <strong>{formatRange(request.startAt, request.endAt)}</strong>
                    {request.durationMinutes ? <span> · {formatDuration(request.durationMinutes)}</span> : null}
                  </p>
                  <p className={styles.reason}>{request.reason}</p>
                  <p className={styles.meta}>
                    Gửi bởi {isOwn ? 'bạn' : request.requesterName || 'nhân viên'}
                    {request.status === 'APPROVED' && request.approverName ? ` · Duyệt bởi ${request.approverName}` : ''}
                    {request.status === 'REJECTED' && request.approverName ? ` · Từ chối bởi ${request.approverName}` : ''}
                    {request.status === 'CANCELLED' && request.cancellerName ? ` · Rút bởi ${request.cancellerName}` : ''}
                    {request.decidedAt && request.status !== 'PENDING' ? ` · ${formatDateTime(request.decidedAt)}` : ''}
                  </p>
                  {request.status === 'REJECTED' && rejectNote && (
                    <p className={styles.rejectNote}><strong>Lý do từ chối:</strong> {rejectNote}</p>
                  )}
                  {(canDecide || canWithdraw || request.status === 'PENDING') && (
                    <footer>
                      <span className={styles.meta}>
                        {request.status === 'PENDING' && !isOwner ? 'Chủ sân sẽ thấy số booking bị ảnh hưởng trước khi duyệt.' : ''}
                      </span>
                      <span className={styles.cardActions}>
                        {canWithdraw && (
                          <Button size="sm" variant="secondary" onClick={() => handleCancel(request.id)} disabled={saving}>Rút yêu cầu</Button>
                        )}
                        {canDecide && <>
                          <Button size="sm" variant="danger" disabled={saving}
                            onClick={() => { setRejectTarget(request); setRejectReason(''); setActionError(''); }}>
                            Từ chối
                          </Button>
                          <Button size="sm" variant="primary" onClick={() => handleApprove(request.id)} disabled={saving}>Duyệt</Button>
                        </>}
                      </span>
                    </footer>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {creating && (
        <Modal title="Tạo yêu cầu bảo trì" busy={saving} onClose={() => setCreating(false)} className={styles.modal}>
          <form onSubmit={handleCreateSubmit} className={styles.form} noValidate>
            <p className={styles.meta}>
              {isOwner
                ? 'Yêu cầu mới ở trạng thái chờ duyệt. Hãy kiểm tra rồi duyệt để khóa lịch bảo trì.'
                : 'Gửi chủ sân duyệt. Sân chưa bị khóa cho đến khi được duyệt.'}
            </p>
            <FormField label="Sân cần bảo trì" htmlFor="maintenance-court" required>
              <Select id="maintenance-court" value={form.courtId} disabled={saving}
                onChange={(event) => setForm({ ...form, courtId: event.target.value })}>
                <option value="">-- Chọn sân --</option>
                {courts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
              </Select>
            </FormField>
            <div className={styles.formRow}>
              <FormField label="Bắt đầu" htmlFor="maintenance-start" required>
                <Input id="maintenance-start" type="datetime-local" step={1800} value={form.startAt} disabled={saving}
                  onChange={(event) => setForm({ ...form, startAt: event.target.value })} />
              </FormField>
              <FormField label="Kết thúc" htmlFor="maintenance-end" required>
                <Input id="maintenance-end" type="datetime-local" step={1800} value={form.endAt} disabled={saving}
                  onChange={(event) => setForm({ ...form, endAt: event.target.value })} />
              </FormField>
            </div>
            <p className={styles.meta}>Theo slot 30 phút, trong giờ mở cửa của địa điểm.</p>
            <FormField label="Lý do bảo trì" htmlFor="maintenance-reason" required>
              <Textarea id="maintenance-reason" rows={3} maxLength={500} value={form.reason} disabled={saving}
                placeholder="Mô tả lý do hoặc nội dung bảo trì…"
                onChange={(event) => setForm({ ...form, reason: event.target.value })} />
            </FormField>
            <p className={styles.info}>
              {isOwner
                ? 'Khi duyệt, bạn sẽ thấy số booking bị ảnh hưởng; khách được chọn đổi slot miễn phí, hoàn tiền hoặc nhận điểm bồi hoàn.'
                : 'Chủ sân sẽ thấy số booking bị ảnh hưởng trước khi duyệt. Nếu được duyệt, khách có booking trong khung giờ này được chọn đổi slot miễn phí, hoàn tiền hoặc nhận điểm bồi hoàn.'}
            </p>
            {formError && <p className={styles.error} role="alert">{formError}</p>}
            <div className={styles.modalActions}>
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setCreating(false)}>Hủy</Button>
              <Button type="submit" variant="primary" loading={saving}>Gửi yêu cầu</Button>
            </div>
          </form>
        </Modal>
      )}

      {approveTarget && (
        <Modal title="Xác nhận duyệt bảo trì" busy={saving} onClose={() => setApproveTarget(null)} className={styles.modal}>
          <p className={styles.modalLead}>Sân: <strong>{approveTarget.courtName}</strong></p>
          {actionError && <p role="alert" className={styles.error}>{actionError}</p>}
          <p className={styles.warning}>Thay đổi này ảnh hưởng <strong>{approveTarget.affectedCount} đặt sân đã xác nhận</strong>. Khách sẽ được thông báo để chọn cách xử lý. Tiếp tục?</p>
          <ul className={styles.impact}>
            {approveTarget.bookings.map((booking) => (
              <li key={booking.id}>
                <strong>{booking.bookingCode}</strong>
                <span>{formatDateTime(`${booking.playDate}T${booking.startTime}`)} – {booking.endTime}</span>
                {booking.bookingType === 'WALK_IN' && <small>Đơn tại quầy sẽ chuyển Sân hủy để nhân viên tiếp nhận xử lý cho khách.</small>}
              </li>
            ))}
          </ul>
          <div className={styles.modalActions}>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setApproveTarget(null)}>Quay lại</Button>
            <Button type="button" variant="danger" loading={saving} onClick={confirmApprove}>Xác nhận duyệt bảo trì</Button>
          </div>
        </Modal>
      )}

      {rejectTarget && (
        <Modal onClose={() => setRejectTarget(null)} title="Từ chối yêu cầu bảo trì" busy={saving} className={styles.modal}>
          <form onSubmit={handleRejectSubmit} className={styles.form}>
            <p className={styles.meta}>
              Bạn đang từ chối yêu cầu bảo trì sân <strong>{rejectTarget.courtName}</strong> ({formatRange(rejectTarget.startAt, rejectTarget.endAt)}).
            </p>
            {actionError && <p role="alert" className={styles.error}>{actionError}</p>}
            <FormField label="Lý do từ chối" required>
              <Textarea rows={3} value={rejectReason} required
                placeholder="Nhập lý do để nhân viên nắm thông tin…"
                onChange={(event) => setRejectReason(event.target.value)} />
            </FormField>
            <div className={styles.modalActions}>
              <Button type="button" variant="secondary" onClick={() => setRejectTarget(null)} disabled={saving}>Hủy</Button>
              <Button type="submit" variant="danger" loading={saving}>Xác nhận từ chối</Button>
            </div>
          </form>
        </Modal>
      )}
    </ManagementLayout>
  );
}
