import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../../components/layout/Header';
import {
  getMyPointsAtFacility,
  getMyOwnedTeams,
  applyVoucherApi,
  createBookingApi,
  previewBookingSummaryApi,
  previewBookingOrderApi,
  createBookingOrderApi,
  previewBookingPackageApi,
  createBookingPackageApi,
} from '../../api/bookingApi';
import styles from './BookingSummaryPage.module.css';

// FIX: Cinderella Bug (Chặn lỗi 24:00:00 của SQL Server)
function addThirtyMinutes(timeStr) {
  const [hh, mm] = timeStr.split(':').map(Number);
  const totalMins = hh * 60 + mm + 30;

  // Nếu chạm mốc 24:00 (1440 phút), ép về 23:59 để DB không bị crash
  if (totalMins >= 1440) return '23:59';

  const nextH = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const nextM = String(totalMins % 60).padStart(2, '0');
  return `${nextH}:${nextM}`;
}

function groupSlotsByCourtAndRange(slots, bookingDate) {
  const ordered = [...slots].sort((a, b) => Number(a.courtId) - Number(b.courtId) || a.timeIdx - b.timeIdx);
  const ranges = [];
  ordered.forEach((slot) => {
    const previous = ranges[ranges.length - 1];
    const endTime = addThirtyMinutes(slot.time);
    if (previous && previous.court_id === slot.courtId && previous.slots.at(-1).end_time === `${slot.time}:00`) {
      previous.slots.push({ start_time: `${slot.time}:00`, end_time: `${endTime}:00` });
      previous.total_list_price += slot.price;
    } else {
      ranges.push({
        court_id: slot.courtId,
        court_name: slot.courtName,
        booking_date: slot.date || bookingDate,
        slots: [{ start_time: `${slot.time}:00`, end_time: `${endTime}:00` }],
        total_list_price: slot.price,
      });
    }
  });
  return ranges;
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function BookingSummaryPage() {
  const navigate = useNavigate();
  const [dateLimits] = useState(() => {
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setMonth(maxDate.getMonth() + 3);
    return { today: localDateKey(today), max: localDateKey(maxDate) };
  });

  // 1. Load dữ liệu các slot đã chọn từ UC13 (hoặc khởi tạo chuẩn theo Mockup để dễ test)
  const [bookingContext] = useState(() => {
    try {
      const saved = sessionStorage.getItem('pending_booking_selection');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.selectedSlots?.length > 0) return { mode: 'single', ...parsed };
      }
    } catch {
      // Fallback nếu JSON lỗi
    }
    return {
      mode: 'single',
      facility: {
        facility_id: 1,
        facility_name: 'Smash Arena',
        address: '12 Tran Thai Tong, Cau Giay, Hanoi',
      },
      playDate: '2026-10-24',
      selectedSlots: [
        { courtId: 2, courtName: 'Court 2', timeIdx: 4, time: '19:00', price: 80000 },
        { courtId: 2, courtName: 'Court 2', timeIdx: 5, time: '19:30', price: 80000 },
      ],
    };
  });

  // 2. Load thông tin Player đăng nhập (DR24, DR01)
  const [playerInfo] = useState(() => {
    try {
      const savedUser = localStorage.getItem('bms_user_info');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        return {
          full_name: parsed.full_name || 'Nguyen Minh Anh',
          phone_number: parsed.phone_number || '0987 654 321',
          email: parsed.email || 'minhanh@gmail.com',
        };
      }
    } catch {
      // Fallback
    }
    return {
      full_name: 'Nguyen Minh Anh',
      phone_number: '0987 654 321',
      email: 'minhanh@gmail.com',
    };
  });

  // State Đội bóng (DR03 / BR09)
  const [ownedTeams, setOwnedTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null); // null = Cá nhân

  // State Ghi chú cho chủ sân (DR20: tối đa 200 ký tự)
  const [guestNote, setGuestNote] = useState('');

  // Sửa lại thành chuỗi rỗng và null
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherError, setVoucherError] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);

  // State Điểm thưởng tại cơ sở (FR89, P10, P11, P13, BR15, BR41)
  const [availablePoints, setAvailablePoints] = useState(120);
  const [usePoints, setUsePoints] = useState(true);

  // State thông báo khi chốt đơn
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdBooking, setCreatedBooking] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [packageSessions, setPackageSessions] = useState(() => bookingContext.packagePayload?.sessions || []);
  const [conflictedSessions, setConflictedSessions] = useState([]);
  const [replacementInputs, setReplacementInputs] = useState({});

  useEffect(() => {
    const fetchInitialData = async () => {
      const facilityId = bookingContext.facility?.facility_id || 1;
      const [pointsRes, teamsRes] = await Promise.all([
        getMyPointsAtFacility(facilityId),
        getMyOwnedTeams(),
      ]);
      if (pointsRes?.success) {
        setAvailablePoints(pointsRes.data.available_points);
      }
      if (teamsRes?.success) {
        setOwnedTeams(teamsRes.data);
      }
    };
    fetchInitialData();
  }, [bookingContext.facility?.facility_id]);

  // Tính toán thông tin hiển thị khung giờ & tiền sân niêm yết (DR05)
  const slotSummary = useMemo(() => {
    const slots = [...(bookingContext.selectedSlots || [])].sort((a, b) => (
      Number(a.courtId) - Number(b.courtId) || a.timeIdx - b.timeIdx
    ));
    const totalSlots = slots.length;
    const unitPrice = slots[0]?.price || 80000;
    const totalListPrice = slots.reduce((sum, s) => sum + s.price, 0);
    const courtId = slots[0]?.courtId || 2;
    const courtName = slots[0]?.courtName || 'Court 2';
    const startTime = slots[0]?.time || '19:00';
    const endTime = slots.length > 0 ? addThirtyMinutes(slots[slots.length - 1].time) : '20:00';

    return {
      totalSlots,
      unitPrice,
      totalListPrice,
      courtId,
      courtName,
      timeRangeText: `${startTime} – ${endTime} (${totalSlots} slot)`,
    };
  }, [bookingContext.selectedSlots]);

  const singleRanges = useMemo(
    () => groupSlotsByCourtAndRange(bookingContext.selectedSlots || [], bookingContext.playDate),
    [bookingContext.selectedSlots, bookingContext.playDate]
  );
  const isPackageBooking = bookingContext.mode === 'custom' || bookingContext.mode === 'recurring';

  // Thuật toán tính thứ tự trừ tiền (Discount Calculation Order - BR15, BR41, P10, P11, P13):
  // Giá niêm yết -> Trừ Voucher -> Trừ Điểm thưởng (tối đa 50% phần còn lại) -> Thực trả (> 0đ)
  const pricingSummary = useMemo(() => {
    const listPrice = Number(previewData?.listAmount ?? previewData?.total_list_price ?? slotSummary.totalListPrice);
    const voucherDiscount = Number(previewData?.voucherDiscount ?? (appliedVoucher ? appliedVoucher.discount_amount : 0));
    const remainingAfterVoucher = Math.max(0, listPrice - voucherDiscount);

    let pointsUsed = 0;
    let pointsDiscount = 0;

    if (usePoints && availablePoints >= 2 && remainingAfterVoucher > 1000) {
      // P13 / BR41: Tối đa 50% số tiền còn lại sau khi trừ Voucher
      const maxAllowedDiscountByRatio = Math.floor(remainingAfterVoucher * 0.5);
      // BR15: Không có booking 0 đồng (giữ lại ít nhất 1.000đ thực trả)
      const maxAllowedDiscountByNonZero = Math.max(0, remainingAfterVoucher - 1000);
      const maxDiscountVnd = Math.min(maxAllowedDiscountByRatio, maxAllowedDiscountByNonZero);

      // Quy đổi sang số điểm tối đa được phép dùng (P10: 1 điểm = 500đ)
      const maxPointsByRule = Math.floor(maxDiscountVnd / 500);
      const candidatePoints = Math.min(availablePoints, maxPointsByRule);

      // P11 / BR15: Mỗi lần dùng điểm phải giảm tối thiểu 1.000đ (tức >= 2 điểm)
      if (candidatePoints >= 2) {
        pointsUsed = candidatePoints;
        pointsDiscount = pointsUsed * 500;
      }
    }

    const finalAmount = Math.max(0, remainingAfterVoucher - pointsDiscount);

    return {
      listPrice,
      voucherDiscount,
      remainingAfterVoucher,
      pointsUsed,
      pointsDiscount,
      finalAmount,
    };
  }, [slotSummary.totalListPrice, appliedVoucher, usePoints, availablePoints, previewData]);

  useEffect(() => {
    let active = true;
    const loadPreview = async () => {
      setPreviewError('');
      try {
        const common = {
          facility_id: bookingContext.facility?.facility_id || 1,
          facility_name: bookingContext.facility?.facility_name || 'Smash Arena',
          booking_date: bookingContext.playDate,
          voucher_code: appliedVoucher?.voucher_code || null,
          points_used: pricingSummary.pointsUsed,
          team_id: selectedTeamId,
          total_list_price: pricingSummary.listPrice,
        };
        let response;
        if (bookingContext.mode === 'custom' || bookingContext.mode === 'recurring') {
          const packageRequest = {
            ...bookingContext.packagePayload,
            voucherCode: appliedVoucher?.voucher_code || null,
            pointsToUse: pricingSummary.pointsUsed,
            teamId: selectedTeamId,
          };
          response = await previewBookingPackageApi(packageRequest);
          const sessions = response?.data?.sessions || packageRequest.sessions || [];
          if (active) {
            const mappedSessions = sessions.map((session) => ({
              ...session,
              is_conflicted: Boolean(session.is_conflicted || session.conflict),
            }));
            setPackageSessions(mappedSessions);
            setConflictedSessions(mappedSessions.filter((session) => session.is_conflicted));
          }
        } else if (singleRanges.length === 1) {
          response = await previewBookingSummaryApi({
            ...common,
            court_id: singleRanges[0].court_id,
            slots: singleRanges[0].slots,
          });
        } else {
          response = await previewBookingOrderApi({
            ...common,
            bookings: singleRanges,
          });
        }
        if (!response?.success) throw new Error('Booking preview could not be calculated.');
        if (active) setPreviewData(response.data || null);
      } catch (error) {
        if (active) setPreviewError(error.response?.data?.message || error.message || 'Booking preview could not be calculated.');
      }
    };
    loadPreview();
    return () => { active = false; };
  }, [bookingContext, singleRanges, appliedVoucher, pricingSummary.listPrice, pricingSummary.pointsUsed, selectedTeamId]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[d.getDay()];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dayName}, ${dd}/${mm}/${yyyy}`;
  };

  // Xử lý Áp dụng hoặc Bỏ mã Voucher
  const handleVoucherAction = async () => {
    setVoucherError('');

    // Nếu đang có mã được áp dụng -> bấm nút sẽ Bỏ mã
    if (appliedVoucher) {
      setAppliedVoucher(null);
      return;
    }

    if (!voucherInput.trim()) {
      setVoucherError('Please enter a voucher code before applying.');
      return;
    }

    setVoucherLoading(true);
    try {
      const res = await applyVoucherApi({
        facility_id: bookingContext.facility?.facility_id || 1,
        total_list_price: pricingSummary.listPrice,
        voucher_code: voucherInput.trim(),
      });
      if (res?.success) {
        setAppliedVoucher(res.data);
      }
    } catch (err) {
      const message = err.response?.data?.message;
      setVoucherError(
        message && message !== 'No message available'
          ? message
          : 'Mã giảm giá không đủ điều kiện hoặc có lỗi xảy ra. Vui lòng kiểm tra lại.'
      );
    } finally {
      setVoucherLoading(false);
    }
  };

  const removeConflictedSessions = () => {
    setPackageSessions((sessions) => sessions.filter((session) => !session.is_conflicted && !session.conflict));
    setConflictedSessions([]);
    setSubmitError('');
  };

  const handleReplaceConflictedSession = async (conflictSession) => {
    const sessionIndex = packageSessions.indexOf(conflictSession);
    if (sessionIndex < 0) return;
    const key = `${conflictSession.date}-${conflictSession.startMinute}-${sessionIndex}`;
    const input = replacementInputs[key] || {};
    const replacementDate = input.date || conflictSession.date;
    const startTime = input.startTime || conflictSession.startTime || '19:00';
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinute = hours * 60 + minutes;
    const duration = Math.max(30, (conflictSession.endMinute || startMinute + 30) - (conflictSession.startMinute || startMinute));
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    const maxDateKey = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`;
    if (replacementDate > maxDateKey) {
      setSubmitError('MSG115: Buổi đặt không được vượt quá 3 tháng kể từ ngày đặt.');
      return;
    }

    const candidateSessions = packageSessions.map((session, index) => index === sessionIndex
      ? {
        date: replacementDate,
        courtId: session.courtId || bookingContext.packagePayload.courtId,
        startMinute,
        endMinute: Math.min(1440, startMinute + duration),
        is_conflicted: false,
        conflict: null,
      }
      : session);
    const request = {
      ...bookingContext.packagePayload,
      sessions: candidateSessions.map(({ date, courtId, startMinute: sessionStart, endMinute }) => ({
        date,
        courtId,
        startMinute: sessionStart,
        endMinute,
      })),
      voucherCode: appliedVoucher?.voucher_code || null,
      pointsToUse: pricingSummary.pointsUsed,
      teamId: selectedTeamId,
    };

    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await previewBookingPackageApi(request);
      if (!response?.success) throw new Error('Replacement session preview failed.');
      const sessions = (response.data?.sessions || candidateSessions).map((session) => ({
        ...session,
        is_conflicted: Boolean(session.is_conflicted || session.conflict),
      }));
      setPackageSessions(sessions);
      setConflictedSessions(sessions.filter((session) => session.is_conflicted));
      setPreviewData(response.data || null);
    } catch (error) {
      setSubmitError(error.response?.data?.message || error.message || 'Replacement session preview failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Preview is read-only; only these create calls hold slots and consume discounts.
  const handleConfirmBooking = async () => {
    setSubmitError('');

    if (guestNote.length > 200) {
      setSubmitError('Note to location owner cannot exceed 200 characters (MSG109).');
      return;
    }

    if (pricingSummary.finalAmount <= 0) {
      setSubmitError('Total payment after discount must be greater than 0 VND (BR15).');
      return;
    }

    const isPackage = bookingContext.mode === 'custom' || bookingContext.mode === 'recurring';
    const packageRequest = isPackage ? {
      ...bookingContext.packagePayload,
      facility_id: bookingContext.facility?.facility_id || 1,
      facility_name: bookingContext.facility?.facility_name || 'Smash Arena',
      sessions: packageSessions.map(({ date, courtId, startMinute, endMinute }) => ({
        date,
        courtId,
        startMinute,
        endMinute,
      })),
      voucherCode: appliedVoucher?.voucher_code || null,
      pointsToUse: pricingSummary.pointsUsed,
      teamId: selectedTeamId,
      total_amount: pricingSummary.listPrice,
      total_list_price: pricingSummary.listPrice,
      voucher_discount_amount: pricingSummary.voucherDiscount,
      points_discount_amount: pricingSummary.pointsDiscount,
      final_amount: pricingSummary.finalAmount,
    } : null;

    if (isPackage) {
      const conflicted = packageSessions.filter((session) => session.is_conflicted || session.conflict);
      if (conflicted.length) {
        const conflictList = conflicted.map((session) => `${session.date} (${session.startTime || ''}–${session.endTime || ''})`).join(', ');
        setSubmitError(`MSG44: Bạn có ${conflicted.length} buổi vừa bị đặt trùng: ${conflictList}. Các buổi này đã được đánh dấu trên lịch, vui lòng chọn slot bù hoặc bỏ buổi.`);
        return;
      }
      if (bookingContext.mode === 'custom') {
        const distinctDays = new Set(packageRequest.sessions.map((session) => session.date)).size;
        if (packageRequest.sessions.length < 2) {
          setSubmitError('MSG91: Gói phải có ít nhất 2 buổi nằm trong ít nhất 2 ngày khác nhau.');
          return;
        }
        if (distinctDays < 2) {
          setSubmitError('MSG92: Gói phải có ít nhất 2 buổi nằm trong ít nhất 2 ngày khác nhau.');
          return;
        }
      }
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 3);
      const latestDate = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`;
      if (packageRequest.sessions.some((session) => session.date > latestDate) || packageRequest.endDate > latestDate) {
        setSubmitError('MSG115: Buổi đặt không được vượt quá 3 tháng kể từ ngày đặt.');
        return;
      }
    }

    const commonPayload = {
      facility_id: bookingContext.facility?.facility_id || 1,
      facility_name: bookingContext.facility?.facility_name || 'Smash Arena',
      team_id: selectedTeamId,
      voucher_code: appliedVoucher?.voucher_code || null,
      points_used: pricingSummary.pointsUsed,
      guest_note: guestNote.trim() || null,
      total_list_price: pricingSummary.listPrice,
      voucher_discount_amount: pricingSummary.voucherDiscount,
      final_amount: pricingSummary.finalAmount,
    };

    setSubmitting(true);
    try {
      let res;
      let fallbackType = 'single';
      let fallbackSlots = slotSummary.totalSlots;
      if (isPackage) {
        res = await createBookingPackageApi(packageRequest);
        fallbackType = 'package';
        fallbackSlots = packageRequest.sessions.length;
      } else if (singleRanges.length > 1) {
        res = await createBookingOrderApi({
          ...commonPayload,
          booking_date: bookingContext.playDate,
          bookings: singleRanges,
        });
        fallbackType = 'order';
      } else {
        const range = singleRanges[0];
        res = await createBookingApi({
          ...commonPayload,
          court_id: range.court_id,
          booking_date: range.booking_date,
          booking_type: 'single',
          slots: range.slots,
        });
      }
      if (res?.success) {
        const paymentBooking = {
          ...res.data,
          booking_type: res.data.booking_type || fallbackType,
          total_slots: res.data.total_slots ?? fallbackSlots,
        };
        sessionStorage.setItem('active_holding_booking', JSON.stringify(paymentBooking));
        setCreatedBooking(paymentBooking);
        navigate('/booking/payment');
      }
    } catch (err) {
      const message = err.response?.data?.message;
      const code = err.response?.data?.code;
      if (code === 'MSG28' || message?.includes('MSG28')) {
        const conflicts = Array.isArray(err.response?.data?.conflicts) ? err.response.data.conflicts : [];
        const ranges = conflicts.map((conflict) => typeof conflict === 'string'
          ? conflict
          : `${conflict.booking_date || conflict.date} ${conflict.start_time || conflict.startTime || ''}–${conflict.end_time || conflict.endTime || ''} (${conflict.court_name || conflict.courtName || ''})`).join(', ');
        setSubmitError(`MSG28: Slot vừa có người giữ hoặc đặt. Vui lòng chọn slot khác.${ranges ? ` Dải bị trùng: ${ranges}` : message ? ` ${message}` : ''}`);
      } else if (code === 'MSG44' || message?.includes('MSG44')) {
        const conflicts = Array.isArray(err.response?.data?.conflicts) ? err.response.data.conflicts : conflictedSessions;
        const rangeList = conflicts.map((session) => typeof session === 'string' ? session : `${session.date} (${session.startTime || ''}–${session.endTime || ''})`).join(', ');
        setSubmitError(`MSG44: Bạn có ${conflicts.length} buổi vừa bị đặt trùng: ${rangeList}. Các buổi này đã được đánh dấu trên lịch, vui lòng chọn slot bù hoặc bỏ buổi.`);
      } else if (code === 'MSG91' || code === 'MSG92' || code === 'MSG115') {
        setSubmitError(message || `${code}: Lịch đặt không đáp ứng điều kiện.`);
      } else if (message?.includes('MSG37')) {
        setSubmitError(
          'Điểm thưởng của bạn không đủ để thực hiện giao dịch này. Vui lòng tải lại trang để cập nhật số điểm.'
        );
      } else {
        setSubmitError(
          message && message !== 'No message available'
            ? message
            : 'Không thể xác nhận đặt sân. Vui lòng kiểm tra lại thông tin và thử lại.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      {/* Top Navbar */}
      <Header />

      <main className={styles.mainContainer}>
        {/* Nút quay lại lịch sân */}
        <Link
          to={`/locations/${bookingContext.facility?.facility_id || 1}`}
          className={styles.backLink}
        >
          ‹ Back to schedule
        </Link>

        <h1 className={styles.pageTitle}>Booking Summary</h1>

        <div className={styles.contentGrid}>
          {/* CỘT TRÁI: Đặt cho + Thông tin booking + Ưu đãi */}
          <div className={styles.leftColumn}>
            {/* Card 1: Đặt cho (DR03 / BR09) */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Book for</h2>
              <div className={styles.teamPillGroup}>
                <button
                  type="button"
                  className={`${styles.teamPill} ${selectedTeamId === null ? styles.teamPillActive : ''
                    }`}
                  onClick={() => setSelectedTeamId(null)}
                >
                  Personal
                </button>
                {ownedTeams.map((team) => (
                  <button
                    key={team.team_id}
                    type="button"
                    className={`${styles.teamPill} ${selectedTeamId === team.team_id ? styles.teamPillActive : ''
                      }`}
                    onClick={() => setSelectedTeamId(team.team_id)}
                  >
                    {team.team_name}
                  </button>
                ))}
              </div>
              <p className={styles.helperText}>
                Team selection is optional. Only teams you manage are shown.
              </p>
            </section>

            {/* Card 2: Thông tin booking (UC14) */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Booking Information</h2>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Location</span>
                  <strong className={styles.infoValue}>
                    {bookingContext.facility?.facility_name || 'Smash Arena'}
                  </strong>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Court</span>
                  <strong className={styles.infoValue}>
                    {isPackageBooking
                      ? `${bookingContext.mode === 'recurring' ? 'Recurring' : 'Custom'} package`
                      : singleRanges.length > 1 ? `${singleRanges.length} booking ranges` : slotSummary.courtName}
                  </strong>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Date</span>
                  <strong className={styles.infoValue}>
                    {isPackageBooking
                      ? bookingContext.mode === 'recurring'
                        ? `${formatDate(bookingContext.packagePayload.startDate)} – ${formatDate(bookingContext.packagePayload.endDate)}`
                        : `${new Set(packageSessions.map((session) => session.date)).size || new Set(bookingContext.packagePayload.sessions.map((session) => session.date)).size} session dates`
                      : formatDate(bookingContext.playDate)}
                  </strong>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Play Time</span>
                  <strong className={styles.infoValue}>
                    {isPackageBooking
                      ? `${packageSessions.length || bookingContext.packagePayload.sessions?.length || bookingContext.packagePayload.weeklySlots?.length || 0} sessions`
                      : singleRanges.length > 1 ? `${slotSummary.totalSlots} slots across ${singleRanges.length} ranges` : slotSummary.timeRangeText}
                  </strong>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Booker</span>
                  <strong className={styles.infoValue}>{playerInfo.full_name}</strong>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Phone Number</span>
                  <strong className={styles.infoValue}>{playerInfo.phone_number}</strong>
                </div>
              </div>

              <div className={styles.noteGroup}>
                <label className={styles.noteLabel}>Note to location owner (optional)</label>
                <textarea
                  rows={3}
                  maxLength={200}
                  className={styles.noteTextarea}
                  placeholder="Can I borrow 2 extra rackets?"
                  value={guestNote}
                  onChange={(e) => setGuestNote(e.target.value)}
                />
              </div>
            </section>

            {/* Card 3: Ưu đãi (Voucher & Điểm thưởng - DR08, BR41, P10, P13) */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Promotions</h2>

              <label className={styles.noteLabel}>Voucher Code</label>
              <div className={styles.voucherRow}>
                <input
                  type="text"
                  className={styles.voucherInput}
                  value={voucherInput}
                  disabled={Boolean(appliedVoucher)}
                  onChange={(e) => {
                    setVoucherInput(e.target.value.toUpperCase());
                    setVoucherError('');
                  }}
                  placeholder="Enter discount code (e.g., DISC20K)"
                />
                <button
                  type="button"
                  className={styles.voucherBtn}
                  onClick={handleVoucherAction}
                  disabled={voucherLoading}
                >
                  {appliedVoucher ? 'Remove' : voucherLoading ? 'Checking...' : 'Apply'}
                </button>
              </div>

              {voucherError && <p className={styles.errorText}>{voucherError}</p>}

              {appliedVoucher && (
                <div className={styles.voucherSuccessBanner}>
                  Applied {appliedVoucher.voucher_code}: {appliedVoucher.description}
                </div>
              )}

              <div className={styles.pointsRow}>
                <div className={styles.pointsInfo}>
                  <strong className={styles.pointsTitle}>Use Points</strong>
                  <span className={styles.pointsSub}>
                    You have {availablePoints} points (1 point = 500 VND). Max 50% of the remaining amount after voucher.
                  </span>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={usePoints}
                  className={`${styles.switchToggle} ${usePoints ? styles.switchOn : ''}`}
                  onClick={() => setUsePoints((prev) => !prev)}
                >
                  <span className={styles.switchThumb} />
                </button>
              </div>
            </section>
          </div>

          {/* CỘT PHẢI: Thanh toán & Xác nhận đặt sân */}
          <aside className={styles.rightColumn}>
            <div className={styles.paymentCard}>
              <h2 className={styles.cardTitle}>Payment</h2>

              <div className={styles.priceLine}>
                <span className={styles.priceLabel}>
                  {isPackageBooking
                    ? `Package booking (${packageSessions.length} sessions)`
                    : singleRanges.length > 1
                      ? `Court fee (${slotSummary.totalSlots} slots across ${singleRanges.length} ranges)`
                      : `Court Fee (${slotSummary.totalSlots} × ${slotSummary.unitPrice.toLocaleString('vi-VN')} VND)`}
                </span>
                <strong className={styles.priceValue}>
                  {pricingSummary.listPrice.toLocaleString('vi-VN')} VND
                </strong>
              </div>

              {previewError && <p className={styles.errorText} role="alert">{previewError}</p>}
              {conflictedSessions.length > 0 && (
                <div className={styles.conflictPanel} role="alert">
                  <strong>MSG44: Bạn có {conflictedSessions.length} buổi vừa bị đặt trùng:</strong>
                  <ul>
                    {conflictedSessions.map((session, index) => (
                      <li className={styles.conflictSession} key={`${session.date}-${session.startMinute}-${index}`}>
                        <span>
                          {session.date} · {session.startTime || (session.startMinute != null ? `${String(Math.floor(session.startMinute / 60)).padStart(2, '0')}:${String(session.startMinute % 60).padStart(2, '0')}` : '')}–{session.endTime || (session.endMinute != null ? `${String(Math.floor(session.endMinute / 60)).padStart(2, '0')}:${String(session.endMinute % 60).padStart(2, '0')}` : '')} · {session.courtName || ''}
                        </span>
                        <div className={styles.replacementControls}>
                          <input
                            type="date"
                            aria-label={`Replacement date for session ${index + 1}`}
                            min={dateLimits.today}
                            max={dateLimits.max}
                            value={replacementInputs[`${session.date}-${session.startMinute}-${packageSessions.indexOf(session)}`]?.date || session.date}
                            onChange={(event) => setReplacementInputs((inputs) => ({
                              ...inputs,
                              [`${session.date}-${session.startMinute}-${packageSessions.indexOf(session)}`]: {
                                ...inputs[`${session.date}-${session.startMinute}-${packageSessions.indexOf(session)}`],
                                date: event.target.value,
                              },
                            }))}
                          />
                          <input
                            type="time"
                            aria-label={`Replacement time for session ${index + 1}`}
                            step="1800"
                            value={replacementInputs[`${session.date}-${session.startMinute}-${packageSessions.indexOf(session)}`]?.startTime || session.startTime || '19:00'}
                            onChange={(event) => setReplacementInputs((inputs) => ({
                              ...inputs,
                              [`${session.date}-${session.startMinute}-${packageSessions.indexOf(session)}`]: {
                                ...inputs[`${session.date}-${session.startMinute}-${packageSessions.indexOf(session)}`],
                                startTime: event.target.value,
                              },
                            }))}
                          />
                          <button type="button" className={styles.removeConflictButton} onClick={() => handleReplaceConflictedSession(session)}>
                            Preview replacement
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={styles.removeConflictButton} onClick={removeConflictedSessions}>
                    Remove conflicting sessions
                  </button>
                </div>
              )}

              <div className={styles.priceLine}>
                <span className={styles.priceLabel}>Voucher</span>
                <strong className={styles.discountValue}>
                  –{pricingSummary.voucherDiscount.toLocaleString('vi-VN')} VND
                </strong>
              </div>

              <div className={styles.priceLine}>
                <span className={styles.priceLabel}>Points</span>
                <strong className={styles.discountValue}>
                  –{pricingSummary.pointsDiscount.toLocaleString('vi-VN')} VND (
                  {pricingSummary.pointsUsed} points)
                </strong>
              </div>

              <hr className={styles.divider} />

              <div className={styles.totalLine}>
                <span className={styles.totalLabel}>Total Payment</span>
                <strong className={styles.totalValue}>
                  {pricingSummary.finalAmount.toLocaleString('vi-VN')} VND
                </strong>
              </div>

              {submitError && (
                <div style={{
                  backgroundColor: '#fef2f2',
                  borderLeft: '4px solid #ef4444',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  color: '#991b1b',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>⚠️</span>
                  <span>{submitError}</span>
                </div>
              )}

              <button
                type="button"
                className={styles.confirmBtn}
                disabled={submitting}
                onClick={handleConfirmBooking}
              >
                {submitting ? 'Holding slot...' : 'Confirm Booking'}
              </button>

              <p className={styles.holdNotice}>
                After confirmation, {isPackageBooking ? 'the package' : 'your booking'} will be held for {isPackageBooking ? 15 : 10} minutes for payment.
              </p>

              {/* Hiển thị thông báo xác nhận giữ chỗ thành công (Chuẩn bị nối sang UC18) */}
              {createdBooking && (
                <div className={styles.holdingSuccessBox}>
                  <strong>✅ Slot held with code {createdBooking.booking_code}!</strong>
                  <span>
                    Please transfer:{' '}
                    {createdBooking.pricing_summary.final_amount.toLocaleString('vi-VN')} VND to{' '}
                    {createdBooking.bank_info.bank_name} ({createdBooking.bank_info.bank_account_number}).
                  </span>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}