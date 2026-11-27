import styles from './Controls.module.css';
import { setRef, useFormValue } from './formState';

export function Slider({ className = '', style, min = 0, max = 100, value, defaultValue, invalid, ref, onChange, ...props }) {
  const [current, setValue, inputRef] = useFormValue(value, defaultValue, min);
  const fill = Math.max(0, Math.min(100, (Number(current) - Number(min)) / (Number(max) - Number(min) || 1) * 100));
  return <input {...props} type="range" ref={node => { setRef(inputRef, node); setRef(ref, node); }} value={current} min={min} max={max}
    onChange={event => { setValue(event.target.value); onChange?.(event); }}
    aria-invalid={invalid || props['aria-invalid'] || undefined} className={`${styles.slider} ${className}`} style={{ '--ui-slider-fill': `${fill}%`, ...style }} />;
}
