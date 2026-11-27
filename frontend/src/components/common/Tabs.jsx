import { Button as UiButton } from '../ui';
import { useId } from 'react';
import { useActiveItemScroll } from '../../hooks/useActiveItemScroll';
import { useScrollEdges } from '../../hooks/useScrollEdges';
import styles from './CommonUI.module.css';

/** Controlled tabs. Panels stay mounted so their form state is preserved. */
export function Tabs({ items = [], value, onChange, label = 'Các mục', className = '', panelClassName = '', children }) {
  const id = useId();
  const { scrollRef: listRef, left, right } = useScrollEdges(items.length);
  const selected = value ?? items.find((item) => !item.disabled)?.value;
  const enabled = items.filter((item) => !item.disabled);
  const activeIndex = items.findIndex(item => item.value === selected);
  useActiveItemScroll(listRef, selected, '[aria-selected="true"]', items.length);
  function handleKey(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = enabled.findIndex((item) => item.value === selected);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 :
      (index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length;
    const item = enabled[next];
    if (!item) return;
    onChange?.(item.value);
    listRef.current?.querySelectorAll('[role="tab"]')[items.indexOf(item)]?.focus();
  }
  return <div className={className}>
    <div className={styles.tabRail} data-scroll-left={left || undefined} data-scroll-right={right || undefined}>
    <div ref={listRef} role="tablist" aria-label={label} className={styles.tabs} onKeyDown={handleKey}>
      {items.map((item, index) => <UiButton variant="custom" key={item.value} type="button" role="tab"
        id={id + '-tab-' + index} aria-controls={children !== undefined ? id + '-panel' : id + '-panel-' + index}
        aria-selected={selected === item.value} tabIndex={selected === item.value ? 0 : -1}
        disabled={item.disabled} onClick={() => onChange?.(item.value)}>{item.label}</UiButton>)}
    </div>
    </div>
    {children !== undefined ? <div role="tabpanel" tabIndex={0} id={id + '-panel'}
      aria-labelledby={id + '-tab-' + activeIndex} className={panelClassName}>{children}</div> : items.map((item, index) => <div key={item.value} role="tabpanel" tabIndex={0}
      id={id + '-panel-' + index} aria-labelledby={id + '-tab-' + index}
      hidden={selected !== item.value} className={`${styles.tabPanel} ${panelClassName}`}>{item.content}</div>)}
  </div>;
}
export default Tabs;
