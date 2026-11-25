import { dateTime } from '../../utils/formatters'
import styles from './Timeline.module.css'

export function Timeline({ items = [], label = 'Tiến trình xử lý' }) {
  return <ol className={styles.timeline} aria-label={label}>{items.map((item, index) =>
    <li key={item.id ?? index} className={styles.event} data-tone={item.tone || 'neutral'}>
      <span className={styles.dot} aria-hidden="true">{index + 1}</span>
      <div><h4>{item.title}</h4>{item.time ? <time dateTime={item.time}>{dateTime(item.time)}</time> : <p className={styles.unknown}>Chưa có thời điểm cập nhật</p>}
        {item.content && <div className={styles.content}>{item.content}</div>}</div>
    </li>)}</ol>
}

export default Timeline
