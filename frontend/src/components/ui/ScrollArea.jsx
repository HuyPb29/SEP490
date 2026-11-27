import { useEffect, useId } from 'react';
import { useScrollEdges } from '../../hooks/useScrollEdges';
import styles from './Controls.module.css';

export function ScrollArea({ children, label, className = '', viewportClassName = '' }) {
  const { scrollRef, left, right, max = 0, value = 0, ratio = 1, overlay = false } = useScrollEdges(undefined, true);
  const id = useId();
  const persistent = overlay && max > 0;
  useEffect(() => {
    const node = scrollRef.current;
    const wheel = event => {
      if (!event.shiftKey || !event.deltaY || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const next = Math.max(0, Math.min(node.scrollWidth - node.clientWidth, node.scrollLeft + event.deltaY));
      if (next !== node.scrollLeft) { event.preventDefault(); node.scrollLeft = next; }
    };
    node?.addEventListener('wheel', wheel, { passive: false });
    return () => node?.removeEventListener('wheel', wheel);
  }, [scrollRef]);
  return <div className={`${styles.scrollFrame} ${className}`} data-scroll-left={left || undefined} data-scroll-right={right || undefined}>
    <div id={id} ref={scrollRef} role="region" aria-label={label} tabIndex={0} data-overlay-scrollbar={persistent || undefined}
      className={`${styles.scrollViewport} custom-scrollbar ${viewportClassName}`}>{children}</div>
    {persistent && <input type="range" role="scrollbar" aria-label={`Cuộn ngang ${label || 'nội dung'}`}
      aria-controls={id} aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}
      min={0} max={max} value={value} step={1} className={styles.horizontalScrollbar}
      style={{ '--scroll-thumb-width': `${ratio * 100}%` }}
      onChange={event => { if (scrollRef.current) scrollRef.current.scrollLeft = Number(event.target.value); }} />}
  </div>;
}
