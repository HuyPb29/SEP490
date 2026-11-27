import { DatePicker } from './DatePicker';
import { DateTimePicker } from './DateTimePicker';
import { TimePicker } from './TimePicker';
import { MonthPicker } from './MonthPicker';
import { Checkbox } from './Checkbox';
import { Radio } from './Radio';
import { NumberInput } from './NumberInput';
import { FileInput } from './FileInput';
import { Slider } from './Slider';
import styles from './Controls.module.css';

const controls = { date: DatePicker, 'datetime-local': DateTimePicker, time: TimePicker, month: MonthPicker,
  checkbox: Checkbox, radio: Radio, number: NumberInput, file: FileInput, range: Slider };

export function Input({ type = 'text', invalid = false, className = '', ...props }) {
  const Control = controls[type];
  if (Control) return <Control {...props} invalid={invalid} className={className} />;
  return <input {...props} type={type} aria-invalid={invalid || props['aria-invalid'] || undefined} className={`${styles.input} ${className}`} />;
}
