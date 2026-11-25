import { Button } from '../common';
import styles from './VenueMap.module.css';

export default function VenueMapDetails({ venue, onSelect, onClose }) {
  return <div className={styles.details} role="region" aria-label={`Thông tin ${venue.facility_name}`}>
    <div><strong>{venue.facility_name}</strong><p>{venue.address || 'Địa chỉ chưa cập nhật'}</p></div>
    <Button size="sm" onClick={() => onSelect?.(venue)}>Xem lịch sân</Button>
    <Button variant="ghost" size="sm" aria-label="Đóng thông tin địa điểm" onClick={onClose}>✕</Button>
  </div>;
}
