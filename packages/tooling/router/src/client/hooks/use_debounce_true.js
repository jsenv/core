import { useEffect, useState, useRef } from "preact/hooks";

export const useDebounceTrue = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // If value becomes true, start a timer
    if (value) {
      timerRef.current = setTimeout(() => {
        setDebouncedValue(true);
      }, delay);
    } else {
      // If value becomes false, clear any pending timer and immediately set to false
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setDebouncedValue(false);
    }

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
};
