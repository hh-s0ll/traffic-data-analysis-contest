// client.ts 가 Promise 를 돌려주므로(나중에 fetch 로 바뀜) 화면에서 쓰는 간단한 훅.

import { useEffect, useState } from 'react';

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    load()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, deps);

  return { data, error };
}
