/** Keyboard navigation for menus whose entries already own their actions. */
export function handleMenuKeyDown(event) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const items = Array.from(event.currentTarget.querySelectorAll('[role="menuitem"]:not(:disabled)'));
  if (!items.length) return;
  event.preventDefault();
  const index = items.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
    (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
}
