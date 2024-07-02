/*
 * https://github.com/whatwg/dom/issues/920
 */

import { raceCallbacks } from "./callback_race.js";
import { createCallbackListNotifiedOnce } from "./callback_list_once.js";

export const Abort = {
  isAbortError: (error) => {
    return error && error.name === "AbortError";
  },

  startOperation: () => {
    return createOperation();
  },

  throwIfAborted: (signal) => {
    if (signal.aborted) {
      const error = new Error(`The operation was aborted`);
      error.name = "AbortError";
      error.type = "aborted";
      throw error;
    }
  },
};

const createOperation = () => {
  const operationAbortController = new AbortController();
  // const abortOperation = (value) => abortController.abort(value)
  const operationSignal = operationAbortController.signal;

  // abortCallbackList is used to ignore the max listeners warning from Node.js
  // this warning is useful but becomes problematic when it's expect
  // (a function doing 20 http call in parallel)
  // To be 100% sure we don't have memory leak, only Abortable.asyncCallback
  // uses abortCallbackList to know when something is aborted
  const abortCallbackList = createCallbackListNotifiedOnce();
  const endCallbackList = createCallbackListNotifiedOnce();

  let isAbortAfterEnd = false;

  operationSignal.onabort = () => {
    operationSignal.onabort = null;

    const allAbortCallbacksPromise = Promise.all(abortCallbackList.notify());
    if (!isAbortAfterEnd) {
      addEndCallback(async () => {
        await allAbortCallbacksPromise;
      });
    }
  };

  const throwIfAborted = () => {
    Abort.throwIfAborted(operationSignal);
  };

  // add a callback called on abort
  // differences with signal.addEventListener('abort')
  // - operation.end awaits the return value of this callback
  // - It won't increase the count of listeners for "abort" that would
  //   trigger max listeners warning when count > 10
  const addAbortCallback = (callback) => {
    // It would be painful and not super redable to check if signal is aborted
    // before deciding if it's an abort or end callback
    // with pseudo-code below where we want to stop server either
    // on abort or when ended because signal is aborted
    // operation[operation.signal.aborted ? 'addAbortCallback': 'addEndCallback'](async () => {
    //   await server.stop()
    // })
    if (operationSignal.aborted) {
      return addEndCallback(callback);
    }
    return abortCallbackList.add(callback);
  };

  const addEndCallback = (callback) => {
    return endCallbackList.add(callback);
  };

  const end = async ({ abortAfterEnd = false } = {}) => {
    await Promise.all(endCallbackList.notify());

    // "abortAfterEnd" can be handy to ensure "abort" callbacks
    // added with { once: true } are removed
    // It might also help garbage collection because
    // runtime implementing AbortSignal (Node.js, browsers) can consider abortSignal
    // as settled and clean up things
    if (abortAfterEnd) {
      // because of operationSignal.onabort = null
      // + abortCallbackList.clear() this won't re-call
      // callbacks
      if (!operationSignal.aborted) {
        isAbortAfterEnd = true;
        operationAbortController.abort();
      }
    }
  };

  const addAbortSignal = (
    signal,
    { onAbort = callbackNoop, onRemove = callbackNoop } = {},
  ) => {
    const applyAbortEffects = () => {
      const onAbortCallback = onAbort;
      onAbort = callbackNoop;
      onAbortCallback();
    };
    const applyRemoveEffects = () => {
      const onRemoveCallback = onRemove;
      onRemove = callbackNoop;
      onAbort = callbackNoop;
      onRemoveCallback();
    };

    if (operationSignal.aborted) {
      applyAbortEffects();
      applyRemoveEffects();
      return callbackNoop;
    }

    if (signal.aborted) {
      operationAbortController.abort();
      applyAbortEffects();
      applyRemoveEffects();
      return callbackNoop;
    }

    const cancelRace = raceCallbacks(
      {
        operation_abort: (cb) => {
          return addAbortCallback(cb);
        },
        operation_end: (cb) => {
          return addEndCallback(cb);
        },
        child_abort: (cb) => {
          return addEventListener(signal, "abort", cb);
        },
      },
      (winner) => {
        const raceEffects = {
          // Both "operation_abort" and "operation_end"
          // means we don't care anymore if the child aborts.
          // So we can:
          // - remove "abort" event listener on child (done by raceCallback)
          // - remove abort callback on operation (done by raceCallback)
          // - remove end callback on operation (done by raceCallback)
          // - call any custom cancel function
          operation_abort: () => {
            applyAbortEffects();
            applyRemoveEffects();
          },
          operation_end: () => {
            // Exists to
            // - remove abort callback on operation
            // - remove "abort" event listener on child
            // - call any custom cancel function
            applyRemoveEffects();
          },
          child_abort: () => {
            applyAbortEffects();
            operationAbortController.abort();
          },
        };
        raceEffects[winner.name](winner.value);
      },
    );

    return () => {
      cancelRace();
      applyRemoveEffects();
    };
  };

  const addAbortSource = (abortSourceCallback) => {
    const abortSource = {
      cleaned: false,
      signal: null,
      remove: callbackNoop,
    };
    const abortSourceController = new AbortController();
    const abortSourceSignal = abortSourceController.signal;
    abortSource.signal = abortSourceSignal;
    if (operationSignal.aborted) {
      return abortSource;
    }
    const returnValue = abortSourceCallback((value) => {
      abortSourceController.abort(value);
    });
    const removeAbortSignal = addAbortSignal(abortSourceSignal, {
      onRemove: () => {
        if (typeof returnValue === "function") {
          returnValue();
        }
        abortSource.cleaned = true;
      },
    });
    abortSource.remove = removeAbortSignal;
    return abortSource;
  };

  const timeout = (ms) => {
    return addAbortSource((abort) => {
      const timeoutId = setTimeout(abort, ms);
      // an abort source return value is called when:
      // - operation is aborted (by an other source)
      // - operation ends
      return () => {
        clearTimeout(timeoutId);
      };
    });
  };

  const wait = (ms) => {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        removeAbortCallback();
        resolve();
      }, ms);
      const removeAbortCallback = addAbortCallback(() => {
        clearTimeout(timeoutId);
      });
    });
  };

  const withSignal = async (asyncCallback) => {
    const abortController = new AbortController();
    const signal = abortController.signal;
    const removeAbortSignal = addAbortSignal(signal, {
      onAbort: () => {
        abortController.abort();
      },
    });
    try {
      const value = await asyncCallback(signal);
      removeAbortSignal();
      return value;
    } catch (e) {
      removeAbortSignal();
      throw e;
    }
  };

  const withSignalSync = (callback) => {
    const abortController = new AbortController();
    const signal = abortController.signal;
    const removeAbortSignal = addAbortSignal(signal, {
      onAbort: () => {
        abortController.abort();
      },
    });
    try {
      const value = callback(signal);
      removeAbortSignal();
      return value;
    } catch (e) {
      removeAbortSignal();
      throw e;
    }
  };

  const fork = () => {
    const forkedOperation = createOperation();
    forkedOperation.addAbortSignal(operationSignal);
    return forkedOperation;
  };

  return {
    // We could almost hide the operationSignal
    // But it can be handy for 2 things:
    // - know if operation is aborted (operation.signal.aborted)
    // - forward the operation.signal directly (not using "withSignal" or "withSignalSync")
    signal: operationSignal,

    throwIfAborted,
    addAbortCallback,
    addAbortSignal,
    addAbortSource,
    fork,
    timeout,
    wait,
    withSignal,
    withSignalSync,
    addEndCallback,
    end,
  };
};

const callbackNoop = () => {};

const addEventListener = (target, eventName, cb) => {
  target.addEventListener(eventName, cb);
  return () => {
    target.removeEventListener(eventName, cb);
  };
};
