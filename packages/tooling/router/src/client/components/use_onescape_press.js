// https://github.com/primer/react/blob/a470e14bf143f5be50047f6c43c7853980d6e952/packages/react/src/hooks/useOnEscapePress.ts#L53
import { useEffect, useCallback } from "preact/hooks";

export const useOnEscapePress = (callback, deps = []) => {
  callback = useCallback(callback, deps);
  useEffect(() => {
    const onkeydown = (keydownEvent) => {
      if (keydownEvent.key === "Escape") {
        callback(keydownEvent);
      }
    };
    document.addEventListener("keydown", onkeydown);
    return () => {
      document.removeEventListener("keydown", onkeydown);
    };
  }, [callback]);
};
