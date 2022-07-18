const STATUSES = {
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected"
};
const createEventSourceConnection = (eventSourceUrl, {
  retryMaxAttempt = Infinity,
  retryAllocatedMs = Infinity,
  lastEventId,
  useEventsToManageConnection = true
} = {}) => {
  const {
    EventSource
  } = window;

  if (typeof EventSource !== "function") {
    return () => {};
  }

  let eventSource;
  const listenersMap = new Map();
  const callbacksMap = new Map();
  const eventSourceOrigin = new URL(eventSourceUrl).origin;

  const addEventCallbacks = namedCallbacks => {
    let listenersMapSize = listenersMap.size;
    Object.keys(namedCallbacks).forEach(eventName => {
      const callback = namedCallbacks[eventName];
      const existingCallbacks = callbacksMap.get(eventName);
      let callbacks;

      if (existingCallbacks) {
        callbacks = existingCallbacks;
      } else {
        callbacks = [];
        callbacksMap.set(eventName, callbacks);
      }

      if (callbacks.length === 0) {
        const eventListener = e => {
          if (e.origin === eventSourceOrigin) {
            if (e.lastEventId) {
              lastEventId = e.lastEventId;
            }

            callbacks.forEach(eventCallback => {
              eventCallback(e);
            });
          }
        };

        listenersMap.set(eventName, eventListener);

        if (eventSource) {
          eventSource.addEventListener(eventName, eventListener);
        }
      }

      callbacks.push(callback);
    });

    if (useEventsToManageConnection && listenersMapSize === 0 && listenersMap.size > 0 && status.value !== STATUSES.CONNECTING && status.value !== STATUSES.CONNECTED) {
      _connect();
    }

    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      listenersMapSize = listenersMap.size;
      Object.keys(namedCallbacks).forEach(eventName => {
        const callback = namedCallbacks[eventName];
        const callbacks = callbacksMap.get(eventName);

        if (callbacks) {
          const index = callbacks.indexOf(callback);

          if (index > -1) {
            callbacks.splice(index, 0);

            if (callbacks.length === 0) {
              const listener = listenersMap.get(eventName);

              if (listener) {
                listenersMap.delete(listener);

                if (eventSource) {
                  eventSource.removeEventListener(eventName, listener);
                }
              }
            }
          }
        }
      });
      namedCallbacks = null; // allow garbage collect

      if (useEventsToManageConnection && listenersMapSize > 0 && listenersMap.size === 0 && (status.value === STATUSES.CONNECTING || status.value === STATUSES.CONNECTED)) {
        _disconnect();
      }
    };
  };

  const status = {
    value: "default",
    goTo: value => {
      if (value === status.value) {
        return;
      }

      status.value = value;
      status.onchange();
    },
    onchange: () => {}
  };

  let _disconnect = () => {};

  const attemptConnection = url => {
    if (status.value === STATUSES.CONNECTING || status.value === STATUSES.CONNECTED) {
      return;
    }

    eventSource = new EventSource(url, {
      withCredentials: true
    });

    _disconnect = () => {
      if (status.value !== STATUSES.CONNECTING && status.value !== STATUSES.CONNECTED) {
        console.warn(`disconnect() ignored because connection is ${status.value}`);
        return;
      }

      eventSource.onerror = undefined;
      eventSource.close();
      listenersMap.forEach((listener, eventName) => {
        eventSource.removeEventListener(eventName, listener);
      });
      eventSource = null;
      status.goTo(STATUSES.DISCONNECTED);
    };

    let retryCount = 0;
    let firstRetryMs = Date.now();

    eventSource.onerror = errorEvent => {
      if (errorEvent.target.readyState === EventSource.CONNECTING) {
        if (retryCount > retryMaxAttempt) {
          console.info(`could not connect after ${retryMaxAttempt} attempt`);

          _disconnect();

          return;
        }

        if (retryCount === 0) {
          firstRetryMs = Date.now();
        } else {
          const allRetryDuration = Date.now() - firstRetryMs;

          if (retryAllocatedMs && allRetryDuration > retryAllocatedMs) {
            console.info(`could not connect in less than ${retryAllocatedMs} ms`);

            _disconnect();

            return;
          }
        }

        retryCount++;
        status.goTo(STATUSES.CONNECTING);
        return;
      }

      if (errorEvent.target.readyState === EventSource.CLOSED) {
        _disconnect();

        return;
      }
    };

    eventSource.onopen = () => {
      status.goTo(STATUSES.CONNECTED);
    };

    listenersMap.forEach((listener, eventName) => {
      eventSource.addEventListener(eventName, listener);
    });

    if (!listenersMap.has("welcome")) {
      addEventCallbacks({
        welcome: () => {} // to update lastEventId

      });
    }

    status.goTo(STATUSES.CONNECTING);
  };

  let _connect = () => {
    attemptConnection(eventSourceUrl);

    _connect = () => {
      attemptConnection(lastEventId ? addLastEventIdIntoUrlSearchParams(eventSourceUrl, lastEventId) : eventSourceUrl);
    };
  };

  const removePageUnloadListener = listenPageUnload(() => {
    if (status.value === STATUSES.CONNECTING || status.value === STATUSES.CONNECTED) {
      _disconnect();
    }
  });

  const destroy = () => {
    removePageUnloadListener();

    _disconnect();

    listenersMap.clear();
    callbacksMap.clear();
  };

  return {
    status,
    connect: () => _connect(),
    addEventCallbacks,
    disconnect: () => _disconnect(),
    destroy
  };
};

const addLastEventIdIntoUrlSearchParams = (url, lastEventId) => {
  if (url.indexOf("?") === -1) {
    url += "?";
  } else {
    url += "&";
  }

  return `${url}last-event-id=${encodeURIComponent(lastEventId)}`;
}; // const listenPageMightFreeze = (callback) => {
//   const removePageHideListener = listenEvent(window, "pagehide", (pageHideEvent) => {
//     if (pageHideEvent.persisted === true) {
//       callback(pageHideEvent)
//     }
//   })
//   return removePageHideListener
// }
// const listenPageFreeze = (callback) => {
//   const removeFreezeListener = listenEvent(document, "freeze", (freezeEvent) => {
//     callback(freezeEvent)
//   })
//   return removeFreezeListener
// }
// const listenPageIsRestored = (callback) => {
//   const removeResumeListener = listenEvent(document, "resume", (resumeEvent) => {
//     removePageshowListener()
//     callback(resumeEvent)
//   })
//   const removePageshowListener = listenEvent(window, "pageshow", (pageshowEvent) => {
//     if (pageshowEvent.persisted === true) {
//       removePageshowListener()
//       removeResumeListener()
//       callback(pageshowEvent)
//     }
//   })
//   return () => {
//     removeResumeListener()
//     removePageshowListener()
//   }
// }


const listenPageUnload = callback => {
  const removePageHideListener = listenEvent(window, "pagehide", pageHideEvent => {
    if (pageHideEvent.persisted !== true) {
      callback(pageHideEvent);
    }
  });
  return removePageHideListener;
};

const listenEvent = (emitter, event, callback) => {
  emitter.addEventListener(event, callback);
  return () => {
    emitter.removeEventListener(event, callback);
  };
};

const eventsourceConnection = createEventSourceConnection(document.location.href, {
  retryMaxAttempt: Infinity,
  retryAllocatedMs: 20 * 1000
});
const {
  status,
  connect,
  addEventCallbacks,
  disconnect
} = eventsourceConnection;
window.__server_events__ = {
  addEventCallbacks,
  status,
  connect,
  disconnect
};
