export const executeWithCleanup = (fn, cleanup) => {
  let isThenable;
  try {
    const result = fn();
    isThenable = result && typeof result.then === "function";
    if (isThenable) {
      return (async () => {
        try {
          return await result;
        } finally {
          cleanup();
        }
      })();
    }
    return result;
  } finally {
    if (!isThenable) {
      cleanup();
    }
  }
};
