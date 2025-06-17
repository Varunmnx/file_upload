import { EffectCallback, useEffect, useRef } from "react";
/* eslint-disable @typescript-eslint/no-explicit-any */
export default function useEffectSkipMount(
  effect: EffectCallback,
  dependencies: any[],
): void {
  const firstUpdate = useRef(true);

  useEffect(() => {
    if (firstUpdate.current) {
      firstUpdate.current = false;
      return;
    }

    effect();
  }, [...dependencies, effect]);
}
