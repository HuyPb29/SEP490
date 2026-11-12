import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../utils/formatters';

export function useResource(load, key) {
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const [state, setState] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, revision, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ key, revision, error: errorMessage(error) });
      });
    return () => controller.abort();
  }, [load, key, revision]);

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
