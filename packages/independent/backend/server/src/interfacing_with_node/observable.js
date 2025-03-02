// https://wicg.github.io/observable/#core-infrastructure

if ("observable" in Symbol === false) {
  Symbol.observable = Symbol.for("observable");
}

export const createObservable = (producer) => {
  if (typeof producer !== "function") {
    throw new TypeError(`producer must be a function, got ${producer}`);
  }

  const observable = {
    [Symbol.observable]: () => observable,
    subscribe: (
      {
        next = () => {},
        error = (value) => {
          throw value;
        },
        complete = () => {},
      },
      { signal = new AbortController().signal } = {},
    ) => {
      let cleanup = () => {};
      const subscription = {
        active: true,
        signal,
        unsubscribe: () => {
          subscription.closed = true;
          cleanup();
        },
      };

      const teardownCallbackList = [];
      const close = () => {
        subscription.active = false;
        let i = 0;
        while (i--) {
          teardownCallbackList[i]();
        }
        teardownCallbackList.length = 0;
      };

      const producerReturnValue = producer({
        next: (value) => {
          if (!subscription.active) {
            return;
          }
          next(value);
        },
        error: (value) => {
          if (!subscription.active) {
            return;
          }
          error(value);
          close();
        },
        complete: () => {
          if (!subscription.active) {
            return;
          }
          complete();
          close();
        },
        addTeardown: (teardownCallback) => {
          if (!subscription.active) {
            teardownCallback();
            return;
          }
          teardownCallbackList.push(teardownCallback);
        },
      });
      if (typeof producerReturnValue === "function") {
        cleanup = producerReturnValue;
      }
      return undefined;
    },
  };

  return observable;
};

export const isObservable = (value) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "object" || typeof value === "function") {
    return Symbol.observable in value;
  }

  return false;
};

export const createCompositeProducer = ({ cleanup = () => {} } = {}) => {
  const observableSet = new Set();
  const observerSet = new Set();
  const addObservable = (observable) => {
    if (observableSet.has(observable)) {
      return false;
    }
    observableSet.add(observable);
    for (const observer of observerSet) {
      observer.observe(observable);
    }
    return true;
  };
  const removeObservable = (observable) => {
    if (!observableSet.has(observable)) {
      return false;
    }
    observableSet.delete(observable);
    for (const observer of observerSet) {
      observer.unobserve(observable);
    }
    return true;
  };

  const producer = ({
    next = () => {},
    complete = () => {},
    error = () => {},
    addTeardown = () => {},
  }) => {
    let completeCount = 0;
    const checkComplete = () => {
      if (completeCount === observableSet.size) {
        complete();
      }
    };
    addTeardown(cleanup);

    const abortMap = new Map();
    const observe = (observable) => {
      const abortController = new AbortController();
      observable.subscribe(
        {
          next: (value) => {
            next(value);
          },
          error: (value) => {
            error(value);
          },
          complete: () => {
            abortMap.delete(observable);
            completeCount++;
            checkComplete();
          },
        },
        { signal: abortController.signal },
      );
      abortMap.set(observable, () => {
        abortController.abort();
      });
    };
    const unobserve = (observable) => {
      const abort = abortMap.get(observable);
      if (!abort) {
        return;
      }
      abortMap.delete(observable);
      abort();
      checkComplete();
    };
    const observer = {
      observe,
      unobserve,
    };
    observerSet.add(observer);
    for (const observable of observableSet) {
      observe(observable);
    }
  };
  producer.addObservable = addObservable;
  producer.removeObservable = removeObservable;
  return producer;
};
