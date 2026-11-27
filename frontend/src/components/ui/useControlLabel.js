import { useEffect, useState } from 'react';

/** Resolve legacy wrapping labels for controls outside FormField. */
export function useControlLabel(triggerRef, label, labelledBy) {
  const [derived, setDerived] = useState(null);
  useEffect(() => {
    if (label || labelledBy) return;
    const node = triggerRef.current;
    const parentLabel = node?.labels?.[0] || node?.closest('label');
    if (!parentLabel) return;
    if (!parentLabel.id) parentLabel.setAttribute('id', `${node.id}-label`);
    const copy = parentLabel.cloneNode(true);
    copy.querySelectorAll('button, input, select, [data-ui-control], small').forEach(child => child.remove());
    let active = true;
    queueMicrotask(() => { if (active) setDerived({ text: copy.textContent.trim(), id: parentLabel.id }); });
    return () => { active = false; };
  }, [triggerRef, label, labelledBy]);
  const resolvedId = labelledBy || (!label ? derived?.id : undefined);
  return { label: resolvedId ? undefined : label || derived?.text || 'Chọn giá trị', labelledBy: resolvedId };
}
