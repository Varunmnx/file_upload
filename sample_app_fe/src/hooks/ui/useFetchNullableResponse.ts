import { useEffect, useState } from "react";
import useEffectSkipMount from "./useEffectSkipMount";
/* eslint-disable @typescript-eslint/no-explicit-any */
type UseFetchNullableResponseOptions = {
  skipMount?: boolean;
};

export function useFetchNullableResponse<T>(
  apiRequest: () => Promise<T>,
  dependencyArray?: any[],
  options?: UseFetchNullableResponseOptions,
): T | null {
  const [res, setRes] = useState<T | null>(null);

  const skipMount = options?.skipMount ?? false;

  async function fetchAndCache() {
    const res = await apiRequest();
    setRes(res);
  }

  useEffect(
    () => {
      if (!skipMount) fetchAndCache();
    },
    dependencyArray
      ? [...dependencyArray, fetchAndCache, skipMount]
      : [fetchAndCache, skipMount],
  );

  useEffectSkipMount(
    () => {
      if (skipMount) fetchAndCache();
    },
    dependencyArray
      ? [...dependencyArray, fetchAndCache, skipMount]
      : [fetchAndCache, skipMount],
  );

  return res;
}
