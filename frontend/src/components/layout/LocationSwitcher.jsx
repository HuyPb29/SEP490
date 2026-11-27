import { Select as UiSelect } from '../ui';
import { useId } from 'react';
import styles from './AppLayouts.module.css';

/** Presentation only: location changes use the existing layout callback. */
export default function LocationSwitcher({ locations, value, name, onChange }) {
  const id = useId();
  return <div className={styles.sidebarLocation}>
    <label id={`${id}-label`} htmlFor={locations?.length ? id : undefined}>Địa điểm đang làm việc</label>
    {locations?.length > 0 ? <UiSelect id={id} aria-labelledby={`${id}-label`} value={value} onChange={onChange}>
      {locations.map((item) => <option key={item.id} value={item.id}>{item.name}{item.status === 'LOCKED' ? ' (Đã khóa)' : ''}</option>)}
    </UiSelect> : <strong>{name}</strong>}
  </div>;
}
