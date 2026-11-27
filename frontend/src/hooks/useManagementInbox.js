import { useEffect, useState } from 'react';
import { loadManagementInbox } from '../api/managementInboxApi';
import { subscribeLiveRefresh } from '../utils/liveRefresh';

export function useManagementInboxCounts(role, locationId, userId) {
  const [snapshot, setSnapshot] = useState(null);
  const key = `${role}:${userId}:${locationId}`;
  useEffect(() => {
    if (!userId || !locationId || !['owner', 'staff'].includes(role)) return undefined;
    const controller = new AbortController();
    const poll = async () => {
      const counts = await loadManagementInbox(role, locationId, controller.signal);
      if (!controller.signal.aborted) setSnapshot(previous => ({ key, counts: { ...(previous?.key === key ? previous.counts : {}), ...counts } }));
    };
    const stop = subscribeLiveRefresh(poll, 5000, true);
    return () => {
      controller.abort(); stop();
    };
  }, [key, role, locationId, userId]);
  return snapshot?.key === key ? snapshot.counts : {};
}
