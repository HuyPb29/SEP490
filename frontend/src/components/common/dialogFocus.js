/** Keep Tab in the active dialog, including when all actions become disabled. */
export function trapDialogFocus(event) {
  if (event.key !== 'Tab') return;
  const dialog = event.currentTarget;
  const controls = Array.from(dialog.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]'))
    .filter((element) => !element.matches(':disabled') && element.tabIndex >= 0 && element.getClientRects().length > 0);
  const first = controls[0];
  const last = controls.at(-1);
  if (!first) {
    event.preventDefault();
    dialog.focus();
  } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
    event.preventDefault();
    first.focus();
  }
}
