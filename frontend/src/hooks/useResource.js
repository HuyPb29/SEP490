import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../utils/formatters';
import { subscribeLiveRefresh } from '../utils/liveRefresh';

export function useResource(load, key, pollMs = 5000) {
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const [state, setState] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, revision, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState(previous => previous && previous.key === key && previous.revision === revision && previous.data !== undefined
          ? previous : { key, revision, error: errorMessage(error) });
      });
    const stop = subscribeLiveRefresh(refresh, pollMs, true);
    return () => { controller.abort(); stop(); };
  }, [load, key, revision, pollMs]);

  const current = state && state.key === key ? state : null;
  const loading = !current || current.revision !== revision;
  return {
    data: current?.data,
    error: loading ? undefined : current.error,
    loading,
    reload,
  };
}

export default useResource;
