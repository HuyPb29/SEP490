import { useRef, useState } from 'react';
import { FormField, Input } from './FormField';
import styles from './AuthInputs.module.css';

export function PasswordField({ id, label = 'Mật khẩu', value, error, hint, strength = false, ...props }) {
  const [visible, setVisible] = useState(false);
  const score = value ? [value.length >= 8, /[a-z]/.test(value) && /[A-Z]/.test(value), /\d/.test(value), /[^\w\s]/.test(value)].filter(Boolean).length : 0;
  const description = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return <FormField htmlFor={id} label={label} error={error} hint={hint} required>
    <div className={styles.passwordWrap}>
      <Input {...props} id={id} value={value} type={visible ? 'text' : 'password'} invalid={Boolean(error)}
        aria-required="true" aria-describedby={description} className={styles.passwordInput} />
      <button type="button" className={styles.toggle} aria-controls={id} aria-pressed={visible}
        aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`} onClick={() => setVisible(!visible)}>
        {visible ? 'Ẩn' : 'Hiện'}
      </button>
    </div>
    {strength && <div className={styles.strength}>
      <div className={styles.strengthTrack} aria-hidden="true">{[1, 2, 3, 4].map(level => <span key={level} data-filled={score >= level} />)}</div>
      <span>{!value ? 'Độ mạnh mật khẩu' : `Độ mạnh: ${score <= 1 ? 'Yếu' : score === 2 ? 'Trung bình' : score === 3 ? 'Khá' : 'Mạnh'}`}</span>
      <small>Thêm chữ hoa hoặc ký tự đặc biệt để tăng độ mạnh.</small>
    </div>}
  </FormField>;
}

export function OtpInput({ value, onChange, error, disabled = false, id = 'otp-code' }) {
  const refs = useRef([]);
  function enter(index, text) {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    if (!digits) {
      const next = value.padEnd(6, ' ').split(''); next[index] = ' ';
      onChange(next.join('').trimEnd()); return;
    }
    const next = value.padEnd(6, ' ').split('');
    const start = digits.length === 6 ? 0 : index;
    digits.split('').forEach((digit, offset) => { if (start + offset < 6) next[start + offset] = digit; });
    onChange(next.join('').trimEnd());
    refs.current[Math.min(start + digits.length, 5)]?.focus();
  }
  return <fieldset className={styles.otpField} disabled={disabled}>
    <legend>Mã xác thực gồm 6 số</legend>
    <div className={styles.otpCells}>{Array.from({ length: 6 }, (_, index) => <Input key={index}
      ref={element => { refs.current[index] = element; }} id={`${id}-${index}`} aria-label={`Số ${index + 1} của mã xác thực`}
      inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} type="text"
      value={value[index]?.trim() || ''} invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
      onFocus={event => event.target.select()} onChange={event => enter(index, event.target.value)}
      onPaste={event => { event.preventDefault(); enter(index, event.clipboardData.getData('text')); }}
      onKeyDown={event => {
        if (event.key === 'Backspace' && !value[index]?.trim() && index > 0) { event.preventDefault(); enter(index - 1, ''); refs.current[index - 1]?.focus(); }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); refs.current[Math.max(0, Math.min(5, index + (event.key === 'ArrowLeft' ? -1 : 1)))]?.focus(); }
      }} />)}</div>
    {error && <p id={`${id}-error`} className={styles.error} role="alert">{error}</p>}
  </fieldset>;
}
