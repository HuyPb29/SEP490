import { useEffect, useRef, useState } from 'react';

/** Observe real horizontal overflow, including content and viewport changes. */
export function useScrollEdges(contentKey, trackPosition = false) {
  const scrollRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measure = () => {
      const left = element.scrollLeft > 1;
      const right = element.scrollWidth - element.clientWidth - element.scrollLeft > 1;
      const position = trackPosition ? { max: Math.max(0, element.scrollWidth - element.clientWidth), value: element.scrollLeft,
        ratio: element.clientWidth / (element.scrollWidth || 1), overlay: CSS.supports('selector(::-webkit-scrollbar)') && element.offsetHeight === element.clientHeight } : {};
      const next = { left, right, ...position };
      setEdges(previous => Object.keys(next).every(key => previous[key] === next[key]) ? previous : next);
    };
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener('scroll', measure, { passive: true });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); element.removeEventListener('scroll', measure); };
  }, [contentKey, trackPosition]);
  return { scrollRef, ...edges };
}
