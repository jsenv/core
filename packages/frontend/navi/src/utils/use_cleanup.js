import { createPubSub } from "@jsenv/dom";
import { useLayoutEffect, useRef } from "preact/hooks";

export const useCleanup = () => {
  const cleanupPubSub = useRef(null);
  if (!cleanupPubSub.current) {
    const [publish, subscribe, clear] = createPubSub();
    const cleanup = () => {
      publish();
      clear();
    };
    const registerCleanup = (cb) => {
      subscribe(cb);
    };
    cleanupPubSub.current = [registerCleanup, cleanup];
  }
  useLayoutEffect(() => {
    return () => {
      const [, cleanup] = cleanupPubSub.current;
      cleanup();
    };
  }, []);
  return cleanupPubSub;
};
