import { createPubSub } from "@jsenv/dom";
import { useLayoutEffect, useRef } from "preact/hooks";

export const useCleanup = () => {
  const cleanupMethodsRef = useRef(null);
  let cleanupMethods = cleanupMethodsRef.current;
  if (!cleanupMethods) {
    const [publish, subscribe, clear] = createPubSub();
    const cleanup = () => {
      publish();
      clear();
    };
    const registerCleanup = (cb) => {
      subscribe(cb);
    };
    cleanupMethodsRef.current = cleanupMethods = [registerCleanup, cleanup];
  }
  useLayoutEffect(() => {
    return () => {
      const [, cleanup] = cleanupMethods;
      cleanup();
    };
  }, []);
  return cleanupMethods;
};
