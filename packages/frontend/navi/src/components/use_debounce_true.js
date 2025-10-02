import { useLayoutEffect, useRef, useState } from "preact/hooks";

export const useDebounceTrue = (value, delay = 300) => {
  const [debouncedTrue, setDebouncedTrue] = useState(false);
  const timerRef = useRef(null);

  useLayoutEffect(() => {
    // If value is true or becomes true, start a timer
    if (value) {
      timerRef.current = setTimeout(() => {
        setDebouncedTrue(true);
      }, delay);
    } else {
      // If value becomes false, clear any pending timer and immediately set to false
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setDebouncedTrue(false);
    }

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value, delay]);

  return debouncedTrue;
};
