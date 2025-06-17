/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useCallback } from "react";

type AsyncOperation<T, U extends { [key: string]: any }> = (
  params: U,
) => Promise<T>;

function useAsync<T, U extends { [key: string]: any }>(
  asyncOperation: AsyncOperation<T, U>,
): [T | null, boolean, string | null, (params: U) => Promise<void>] {
  const [result, setResult] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (params: U) => {
      setIsLoading(true);
      try {
        const operationResult = await asyncOperation(params);
        setResult(operationResult);
      } catch (err) {
        setError(err as string);
      } finally {
        setIsLoading(false);
      }
    },

    [asyncOperation],
  );

  return [result, isLoading, error, execute];
}

export default useAsync;
