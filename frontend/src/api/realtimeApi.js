/** Authenticated fetch stream: tokens never appear in URLs or browser history. */
export async function readRealtimeEvents(token, signal, onChange) {
  const response = await fetch('/api/realtime/events', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
    cache: 'no-store', signal,
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Realtime unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const record = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (/^event:\s*(ready|changed)\s*$/m.test(record)) onChange();
      }
      if (buffer.length > 65536) throw new Error('Invalid realtime stream');
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
