import { useEffect } from 'react';

/** Reveal active horizontal navigation without scrolling the page or changing focus. */
export function useActiveItemScroll(ref, value, selector = '[aria-selected="true"]', itemCount = 0) {
  useEffect(() => {
    const list = ref.current;
    const active = list?.querySelector(selector);
    if (!list || !active) return undefined;
    const reveal = () => {
      const bounds = list.getBoundingClientRect(), item = active.getBoundingClientRect();
      if (item.left < bounds.left || item.right > bounds.right) {
        list.scrollLeft += item.left - bounds.left - (bounds.width - item.width) / 2;
      }
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(list);
    observer.observe(active);
    return () => observer.disconnect();
  }, [ref, value, selector, itemCount]);
}
