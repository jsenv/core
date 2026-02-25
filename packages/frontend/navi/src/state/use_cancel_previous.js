import { useRef } from "preact/hooks";

import { createRequestCanceller } from "./request_canceller.js";

export const useCancelPrevious = () => {
  const cancellerRef = useRef();
  if (!cancellerRef.current) {
    cancellerRef.current = createRequestCanceller();
  }
  const canceller = cancellerRef.current;
  return canceller;
};
