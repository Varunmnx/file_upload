import { useEffect } from "react";
import useTimeout from "./useTimout";

interface UseDebouncedReturn {
  reset: () => void;
  clear: () => void;
}

export default function useDebounceApiRequest(
  callback: () => void,
  delay: number,
  dependencies: React.DependencyList,
): UseDebouncedReturn {
  const { reset, clear } = useTimeout(callback, delay);

  useEffect(() => {
    reset();
    return clear; // Clean up on unmount or dependencies change
  }, dependencies);

  return { reset, clear };
}
