import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { readRealtimeEvents } from '../api/realtimeApi';

export function useRealtimeEvents() {
  const { token } = useAuth();
  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    let timer, dispatchTimer, retry = 1000, running = false;
    const changed = () => {
      clearTimeout(dispatchTimer);
      dispatchTimer = setTimeout(() => {
        if (!controller.signal.aborted) window.dispatchEvent(new Event('bms-data-changed'));
      }, 100);
      retry = 1000;
    };
    async function connect() {
      if (controller.signal.aborted || running) return;
      clearTimeout(timer); running = true;
      try { await readRealtimeEvents(token, controller.signal, changed); } catch { /* Polling remains active. */ }
      finally {
        running = false;
        if (!controller.signal.aborted) {
          timer = setTimeout(connect, retry);
          retry = Math.min(30000, retry * 2);
        }
      }
    }
    const wake = () => { if (!document.hidden) { changed(); connect(); } };
    connect();
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      controller.abort(); clearTimeout(timer); clearTimeout(dispatchTimer);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [token]);
}
