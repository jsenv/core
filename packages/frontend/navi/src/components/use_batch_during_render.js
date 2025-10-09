import { useLayoutEffect, useMemo, useRef } from "preact/hooks";

import { useStableCallback } from "./use_stable_callback.js";

export const useBatchDuringRender = (callback) => {
  const pendingCallArrayRef = useRef([]);
  const pendingCallArray = pendingCallArrayRef.current;

  callback = useStableCallback(callback);
  const callbackWithBatching = useMemo(() => {
    return (...args) => {
      if (isRenderingRef.current) {
        pendingCallArray.push(...args);
        return;
      }
      callback(...args);
    };
  }, []);

  const isRenderingRef = useRef();
  isRenderingRef.current = true;
  useLayoutEffect(() => {
    isRenderingRef.current = false;
    if (pendingCallArray.length === 0) {
      return;
    }
    const copy = [...pendingCallArray];
    pendingCallArray.length = 0;
    callback(copy);
  });

  return callbackWithBatching;
};
