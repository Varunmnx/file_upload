import { clear } from "@/utils";
import { useEffect, useRef } from "react";

const logoutRedirect = () => {
  clear();
  window.location.href = "/logout";
};

function useInactivityTracker(
  callback?: () => void,
  timeout = 1800000,
  debounceTime = 60000,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const resetTimer = () => {
      // If no timer exists, initialize it
      if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          if (callback) {
            callback();
          } else {
            logoutRedirect();
          }
        }, timeout);
      }

      // Prevent multiple rapid resets with a debounce mechanism
      if (debounceRef.current) {
        return;
      }

      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
      }, debounceTime);

      // Clear and restart the inactivity timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          if (callback) {
            callback();
          } else {
            logoutRedirect();
          }
        }, timeout);
      }
    };

    // Attach event listeners
    const events = [
      "mousemove",
      "mousedown",
      "touchstart",
      "touchmove",
      "click",
      "keydown",
      "scroll",
    ];

    events.forEach((event) => window.addEventListener(event, resetTimer, true));

    // Start the timer on mount
    resetTimer();

    // Cleanup function
    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, resetTimer, true),
      );
      if (timerRef.current) clearTimeout(timerRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [callback, timeout, debounceTime]);
}

export default useInactivityTracker;
