import styles from './FormStepper.module.css';

export function FormStepper({ steps, current, onChange, disabled = false, label = 'Tiến trình biểu mẫu' }) {
  return <nav aria-label={label} className={styles.stepper}>
    <p className={styles.mobile}>Bước {current + 1}/{steps.length} · {steps[current]}</p>
    <ol>{steps.map((title, index) => <li key={title} data-complete={index < current} data-active={index === current}>
      <button type="button" onClick={() => onChange?.(index)} disabled={disabled || index > current}
        aria-current={index === current ? 'step' : undefined}>
        <span className={styles.number} aria-hidden="true">{index < current ? '✓' : index + 1}</span>
        <span>{title}{index < current && <small>Đã điền · Chỉnh sửa</small>}</span>
      </button>
    </li>)}</ol>
  </nav>;
}
export default FormStepper;
