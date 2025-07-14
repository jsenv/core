import { signal } from "@preact/signals";

export const documentIsRoutingSignal = signal(false);
export const useDocumentIsRouting = () => {
  return documentIsRoutingSignal.value;
};
export const startDocumentRouting = () => {
  documentIsRoutingSignal.value = true;
};
export const endDocumentRouting = () => {
  documentIsRoutingSignal.value = false;
};
export const routingWhile = (fn, { onFinally, onReturn } = {}) => {
  startDocumentRouting();

  let isThenable;
  try {
    const result = fn();
    isThenable = result && typeof result.then === "function";
    if (isThenable) {
      return (async () => {
        try {
          return await result;
        } finally {
          endDocumentRouting();
          onFinally?.();
        }
      })();
    }
    onReturn?.(result);
    return result;
  } finally {
    if (!isThenable) {
      endDocumentRouting();
      onFinally?.();
    }
  }
};
