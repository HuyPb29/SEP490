import { useCallback, useEffect, useState } from 'react';
import {
  apiErrorMessage,
  approveMaintenanceRequest,
  cancelMaintenanceRequest,
  createMaintenanceRequest,
  getMaintenanceRequests,
  getOwnerLocations,
  getStaffCourts,
  getStoredLocationId,
  rejectMaintenanceRequest,
  storeLocationId,
} from '../../api/locationApi';
import { Button } from '../../components/common/Button';
import { FormField, Input, Select, Textarea } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Table } from '../../components/common/Table';
import ManagementLayout from '../../components/layout/ManagementLayout';
import { useAuth } from '../../hooks/useAuth';

const STATUS_FILTERS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Bị từ chối' },
  { value: 'CANCELLED', label: 'Đã rút' },
];

const STATUS_LABELS = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
  CANCELLED: 'Đã rút',
};

/** LocalDateTime "2026-11-10T19:00:00" -> "10/11/2026 19:00". */
function formatDateTime(value) {
  if (!value) return '—';
  const [datePart, timePart = ''] = String(value).split('T');
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year} ${timePart.slice(0, 5)}`;
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
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const selectedLocation =
    locations.find((location) => String(location.id) === String(selectedLocationId)) || null;
  const courts = isOwner ? (selectedLocation?.courts ?? []) : staffCourts;

  const loadRequests = useCallback(async (status = statusFilter) => {
    if (!isOwner && !isStaff) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await getMaintenanceRequests(isOwner ? 'OWNER' : 'STAFF', status || null);
      setRequests(list);
      setActionError('');
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isOwner, isStaff, statusFilter]);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      if (isOwner) {
        try {
          const list = await getOwnerLocations();
          if (!active) return;
          setLocations(list);
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
    if (!isOwner && !isStaff) return undefined;
    getMaintenanceRequests(isOwner ? 'OWNER' : 'STAFF', statusFilter || null)
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
    return () => {
      active = false;
    };
  }, [isOwner, isStaff, statusFilter]);

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    if (!form.courtId) {
      setActionError('Vui lòng chọn sân cần bảo trì.');
      return;
    }
    if (!form.startAt || !form.endAt) {
      setActionError('Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc.');
      return;
    }
    if (new Date(`${form.startAt}:00`) >= new Date(`${form.endAt}:00`)) {
      setActionError('Thời gian kết thúc phải sau thời gian bắt đầu.');
      return;
    }
    if (!form.reason.trim()) {
      setActionError('Vui lòng nhập lý do bảo trì.');
      return;
    }

    setSaving(true);
    setActionError('');
    setStatusMessage('');
    try {
      await createMaintenanceRequest({
        courtId: Number(form.courtId),
        startAt: `${form.startAt}:00`,
        endAt: `${form.endAt}:00`,
        reason: form.reason.trim(),
      });
      setForm(emptyForm());
      await loadRequests(statusFilter);
      setStatusMessage('Đã gửi yêu cầu bảo trì thành công.');
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id) => {
    setSaving(true);
    setActionError('');
    setStatusMessage('');
    try {
      await approveMaintenanceRequest(id);
      await loadRequests(statusFilter);
      setStatusMessage('Đã duyệt yêu cầu bảo trì.');
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id) => {
    setSaving(true);
    setActionError('');
    setStatusMessage('');
    try {
      await cancelMaintenanceRequest(id);
      await loadRequests(statusFilter);
      setStatusMessage('Đã rút yêu cầu bảo trì.');
    } catch (err) {
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
      await rejectMaintenanceRequest(rejectTarget.id, rejectReason.trim());
      setRejectTarget(null);
      setRejectReason('');
      await loadRequests(statusFilter);
      setActionError('');
      setStatusMessage('Đã từ chối yêu cầu bảo trì.');
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = requests.filter((request) => request.status === 'PENDING').length;

  if (!isOwner && !isStaff) {
    return (
      <ManagementLayout role="staff" title="Yêu cầu bảo trì">
        <div className="cw-card text-center py-8">
          <p className="cw-muted">Trang này chỉ dành cho Chủ địa điểm (Owner) hoặc Nhân viên (Staff).</p>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout
      role={isOwner ? 'owner' : 'staff'}
      title="Quản lý bảo trì sân"
      subtitle={
        isOwner
          ? `Có ${pendingCount} yêu cầu đang chờ phê duyệt`
          : 'Tạo và theo dõi yêu cầu bảo trì định kỳ hoặc đột xuất'
      }
      locations={locations}
      locationId={selectedLocationId}
      onLocationChange={(nextId) => {
        setSelectedLocationId(nextId);
        storeLocationId(nextId);
        setLoading(true);
        setActionError('');
        setStatusMessage('');
      }}
    >
      <div className="space-y-6">
        {statusMessage && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm" role="status">
            {statusMessage}
          </div>
        )}

        {actionError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm" role="alert">
            {actionError}
          </div>
        )}

        {isStaff && (
          <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h2 className="text-base font-bold text-slate-800 mb-4">Gửi yêu cầu bảo trì mới</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="Sân cần bảo trì" required>
                  <Select
                    value={form.courtId}
                    onChange={(event) => setForm({ ...form, courtId: event.target.value })}
                    disabled={saving}
                  >
                    <option value="">-- Chọn sân --</option>
                    {courts.map((court) => (
                      <option key={court.id} value={court.id}>{court.name}</option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Thời gian bắt đầu" required>
                  <Input
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(event) => setForm({ ...form, startAt: event.target.value })}
                    disabled={saving}
                  />
                </FormField>

                <FormField label="Thời gian kết thúc" required>
                  <Input
                    type="datetime-local"
                    value={form.endAt}
                    onChange={(event) => setForm({ ...form, endAt: event.target.value })}
                    disabled={saving}
                  />
                </FormField>
              </div>

              <FormField label="Lý do bảo trì" required>
                <Textarea
                  rows={2}
                  value={form.reason}
                  onChange={(event) => setForm({ ...form, reason: event.target.value })}
                  placeholder="Mô tả lý do hoặc nội dung bảo trì..."
                  disabled={saving}
                />
              </FormField>

              <div className="flex justify-end">
                <Button type="submit" variant="primary" loading={saving}>
                  Gửi yêu cầu
                </Button>
              </div>
            </form>
          </section>
        )}

        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-bold text-slate-800">
              Danh sách yêu cầu bảo trì {pendingCount > 0 && <span className="text-amber-600">({pendingCount} chờ duyệt)</span>}
            </h2>
            <div className="w-full sm:w-56">
              <Select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setLoading(true);
                }}
              >
                {STATUS_FILTERS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </Select>
            </div>
          </div>

          {loading ? (
            <p className="text-center text-slate-500 py-8" role="status">Đang tải danh sách yêu cầu…</p>
          ) : requests.length === 0 ? (
            <div className="text-center text-slate-500 py-10">
              Chưa có yêu cầu bảo trì nào trong danh mục này.
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Sân</th>
                  <th>Thời gian bắt đầu</th>
                  <th>Thời gian kết thúc</th>
                  <th>Lý do</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const isOwn = String(request.requestedBy) === String(currentUser?.user_id);
                  return (
                    <tr key={request.id}>
                      <td className="font-medium text-slate-900">{request.courtName}</td>
                      <td>{formatDateTime(request.startAt)}</td>
                      <td>{formatDateTime(request.endAt)}</td>
                      <td className="max-w-xs truncate" title={request.reason}>{request.reason}</td>
                      <td>
                        <StatusBadge status={request.status}>
                          {STATUS_LABELS[request.status] ?? request.status}
                        </StatusBadge>
                        {request.rejectionReason && (
                          <div className="text-xs text-rose-600 mt-1">
                            Lý do: {request.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <div className="inline-flex gap-2">
                          {isOwner && request.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleApprove(request.id)}
                                disabled={saving}
                              >
                                Duyệt
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  setRejectTarget(request);
                                  setRejectReason('');
                                  setActionError('');
                                }}
                                disabled={saving}
                              >
                                Từ chối
                              </Button>
                            </>
                          )}
                          {isStaff && isOwn && request.status === 'PENDING' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleCancel(request.id)}
                              disabled={saving}
                            >
                              Rút yêu cầu
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </section>

        {rejectTarget && (
          <Modal
            isOpen={true}
            onClose={() => setRejectTarget(null)}
            title="Từ chối yêu cầu bảo trì"
          >
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <p className="text-sm text-slate-600">
                Bạn đang từ chối yêu cầu bảo trì cho sân <strong>{rejectTarget.courtName}</strong> (
                {formatDateTime(rejectTarget.startAt)} – {formatDateTime(rejectTarget.endAt)}).
              </p>
              <FormField label="Lý do từ chối" required>
                <Textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Nhập lý do từ chối để nhân viên nắm thông tin..."
                  required
                />
              </FormField>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setRejectTarget(null)} disabled={saving}>
                  Hủy
                </Button>
                <Button type="submit" variant="danger" loading={saving}>
                  Xác nhận từ chối
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </ManagementLayout>
  );
}
