import { useId, useState } from 'react';
import { Select } from './Select';
import { emitChange, useFormValue, setRef } from './formState';

export function MonthPicker({ value, defaultValue, onChange, min, max, ref, ...props }) {
  const autoId = useId();
  const [raw, setValue, bridge] = useFormValue(value, defaultValue);
  const [year] = useState(() => new Date().getFullYear());
  const from = min || `${year - 100}-01`, to = max || `${year + 100}-12`;
  const options = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) for (let m = 1; m <= 12; m++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (key >= from && key <= to) options.push([key, `Tháng ${m} ${y}`]);
  }
  return <Select {...props} id={props.id || autoId} ref={node => { setRef(bridge, node); setRef(ref, node); }} searchable
    placeholder={props.placeholder || 'Chọn tháng'} options={options} value={raw}
    onChange={event => { setValue(event.target.value); emitChange(onChange, bridge.current, event.target.value); }} />;
}
