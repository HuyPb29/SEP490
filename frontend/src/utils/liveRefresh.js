/** One request at a time; remember an event received while a request was running. */
export function subscribeLiveRefresh(refresh, interval = 5000, immediate = false) {
  let stopped = false, running = false, pending = false, timer;
  const schedule = () => { if (!stopped && interval > 0) timer = setTimeout(run, interval); };
  async function run() {
    if (stopped) return;
    if (document.hidden) { clearTimeout(timer); schedule(); return; }
    if (running) { pending = true; return; }
    clearTimeout(timer);
    running = true;
    try { await refresh(); } catch { /* The consumer owns error feedback. Retry on the next wake. */ }
    finally {
      running = false;
      if (!stopped && pending) { pending = false; run(); }
      else schedule();
    }
  }
  const wake = () => { if (!document.hidden) run(); };
  for (const event of ['focus', 'online', 'bms-data-changed']) window.addEventListener(event, wake);
  document.addEventListener('visibilitychange', wake);
  if (immediate) run(); else schedule();
  return () => {
    stopped = true;
    clearTimeout(timer);
    for (const event of ['focus', 'online', 'bms-data-changed']) window.removeEventListener(event, wake);
    document.removeEventListener('visibilitychange', wake);
  };
}
