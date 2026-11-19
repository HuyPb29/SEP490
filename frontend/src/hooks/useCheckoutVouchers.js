import { useEffect, useState } from 'react';
import { applyVoucherApi, getEligibleCheckoutVouchers } from '../api/bookingApi';
import { apiErrorMessage } from '../api';

const EMPTY = [];

export function useCheckoutVouchers(locationId, orderAmount) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const key = locationId && orderAmount > 0 ? [locationId, orderAmount, revision].join(':') : null;
  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    getEligibleCheckoutVouchers(locationId, orderAmount, controller.signal)
      .then((items) => { if (!controller.signal.aborted) setResult({ key, items }); })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResult({ key, error: 'Không tải được voucher. Bạn vẫn có thể kiểm tra mã đã biết.' });
        }
      });
    return () => controller.abort();
  }, [key, locationId, orderAmount]);

  const current = result?.key === key ? result : null;
  return {
    items: current?.items ?? EMPTY,
    loading: Boolean(key && !current),
    error: current?.error,
    reload: () => setRevision((value) => value + 1),
  };
}

export function useCheckoutVoucherSelection(locationId, orderAmount) {
  const vouchers = useCheckoutVouchers(locationId, orderAmount);
  const [code, setCode] = useState('');
  const [selection, setSelection] = useState(null);
  const [scope, setScope] = useState({ locationId, orderAmount });
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  if (scope.locationId !== locationId || scope.orderAmount !== orderAmount) {
    setScope({ locationId, orderAmount });
    setSelection(null);
  }
  const applied = selection && selection.locationId === locationId && selection.orderAmount === orderAmount ? selection : null;

  function remove() {
    setSelection(null);
    setCode('');
    setError('');
  }

  function invalidate(message) {
    remove();
    setError(message);
    vouchers.reload();
  }

  async function apply(choice, label) {
    if (checking || !(orderAmount > 0)) return;
    if (applied) {
      setError('Đơn này đã có voucher. Bỏ voucher đang dùng trước khi chọn mã khác. (MSG35)');
      return;
    }
    if (!choice.code && !choice.grantId) {
      setError('Vui lòng nhập mã hoặc chọn voucher để áp dụng. (MSG01)');
      return;
    }
    setError('');
    setChecking(true);
    try {
      const quote = await applyVoucherApi({ locationId, orderAmount, selection: choice });
      setSelection({ ...quote, selection: choice, label, locationId, orderAmount });
      setCode(choice.code || '');
    } catch (cause) {
      const reason = apiErrorMessage(cause, 'Vui lòng thử lại.');
      setError(reason.includes('MSG34') ? reason : `Mã giảm giá không dùng được: ${reason} (MSG34)`);
      vouchers.reload();
    } finally {
      setChecking(false);
    }
  }

  return {
    vouchers, orderAmount, code, applied, checking, error, invalidate,
    onCode: (value) => { setCode(value); setError(''); },
    onApply: apply,
    onRemove: remove,
  };
}
