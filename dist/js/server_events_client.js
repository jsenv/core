const READY_STATES = {
  CONNECTING: "connecting",
  OPEN: "open",
  CLOSING: "closing",
  CLOSED: "closed"
};
const createConnectionManager = (attemptConnection, {
  retry,
  retryAfter,
  retryMaxAttempt,
  retryAllocatedMs
}) => {
  const readyState = {
    value: READY_STATES.CLOSED,
    goTo: value => {
      if (value === readyState.value) {
        return;
      }

      readyState.value = value;
      readyState.onchange();
    },
    onchange: () => {}
  };

  let _disconnect = () => {};

  const connect = () => {
    if (readyState.value === READY_STATES.CONNECTING || readyState.value === READY_STATES.OPEN) {
      return;
    }

    let retryCount = 0;
    let msSpent = 0;

    const attempt = () => {
      readyState.goTo(READY_STATES.CONNECTING);
      _disconnect = attemptConnection({
        onClosed: () => {
          if (!retry) {
            readyState.goTo(READY_STATES.CLOSED);
            console.info(`[jsenv] failed to connect to server`);
            return;
          }

          if (retryCount > retryMaxAttempt) {
            readyState.goTo(READY_STATES.CLOSED);
            console.info(`[jsenv] could not connect to server after ${retryMaxAttempt} attempt`);
            return;
          }

          if (retryAllocatedMs && msSpent > retryAllocatedMs) {
            readyState.goTo(READY_STATES.CLOSED);
            console.info(`[jsenv] could not connect to server in less than ${retryAllocatedMs}ms`);
            return;
          } // if closed while open -> connection lost
          // otherwise it's the attempt to connect for the first time
          // or to reconnect


          if (readyState.value === READY_STATES.OPEN) {
            console.info(`[jsenv] server connection lost; retrying to connect`);
          }

          retryCount++;
          setTimeout(() => {
            msSpent += retryAfter;
            attempt();
          }, retryAfter);
        },
        onOpen: () => {
          readyState.goTo(READY_STATES.OPEN); // console.info(`[jsenv] connected to server`)
        }
      });
    };

    attempt();
  };

  const disconnect = () => {
    if (readyState.value !== READY_STATES.CONNECTING && readyState.value !== READY_STATES.OPEN) {
      console.warn(`disconnect() ignored because connection is ${readyState.value}`);
      return null;
    }

    return _disconnect();
  };

  const removePageUnloadListener = listenPageUnload(() => {
    if (readyState.value === READY_STATES.CONNECTING || readyState.value === READY_STATES.OPEN) {
      _disconnect();
    }
  });
  return {
    readyState,
    connect,
    disconnect,
    destroy: () => {
      removePageUnloadListener();
      disconnect();
    }
  };
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

const createEventsManager = ({
  effect = () => {}
} = {}) => {
  const callbacksMap = new Map();
  let cleanup;

  const addCallbacks = namedCallbacks => {
    let callbacksMapSize = callbacksMap.size;
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

      callbacks.push(callback);
    });

    if (effect && callbacksMapSize === 0 && callbacksMapSize.size > 0) {
      cleanup = effect();
    }

    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      callbacksMapSize = callbacksMap.size;
      Object.keys(namedCallbacks).forEach(eventName => {
        const callback = namedCallbacks[eventName];
        const callbacks = callbacksMap.get(eventName);

        if (callbacks) {
          const index = callbacks.indexOf(callback);

          if (index > -1) {
            callbacks.splice(index, 1);

            if (callbacks.length === 0) {
              callbacksMap.delete(eventName);
            }
          }
        }
      });
      namedCallbacks = null; // allow garbage collect

      if (cleanup && typeof cleanup === "function" && callbacksMapSize > 0 && callbacksMapSize.size === 0) {
        cleanup();
        cleanup = null;
      }
    };
  };

  const triggerCallbacks = event => {
    const callbacks = callbacksMap.get(event.type);

    if (callbacks) {
      callbacks.forEach(callback => {
        callback(event);
      });
    }
  };

  const destroy = () => {
    callbacksMap.clear();

    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  };

  return {
    addCallbacks,
    triggerCallbacks,
    destroy
  };
};

const createWebSocketConnection = (websocketUrl, {
  protocols = ["jsenv"],
  useEventsToManageConnection = true,
  retry = false,
  retryAfter = 1000,
  retryMaxAttempt = Infinity,
  retryAllocatedMs = Infinity
} = {}) => {
  const connectionManager = createConnectionManager(({
    onClosed,
    onOpen
  }) => {
    let socket = new WebSocket(websocketUrl, protocols);
    let interval;

    const cleanup = () => {
      if (socket) {
        socket.onerror = null;
        socket.onopen = null;
        socket.onclose = null;
        socket.onmessage = null;
        socket = null;
        clearInterval(interval);
      }
    };

    socket.onerror = () => {
      cleanup();
      onClosed();
    };

    socket.onopen = () => {
      socket.onopen = null;
      onOpen();
      interval = setInterval(() => {
        socket.send('{"type":"ping"}');
      }, 30_000);
    };

    socket.onclose = () => {
      cleanup();
      onClosed();
    };

    socket.onmessage = messageEvent => {
      const event = JSON.parse(messageEvent.data);
      eventsManager.triggerCallbacks(event);
    };

    return () => {
      if (socket) {
        socket.close();
        cleanup();
      }
    };
  }, {
    retry,
    retryAfter,
    retryMaxAttempt,
    retryAllocatedMs
  });
  const eventsManager = createEventsManager({
    effect: () => {
      if (useEventsToManageConnection) {
        connectionManager.connect();
        return () => {
          connectionManager.disconnect();
        };
      }

      return null;
    }
  });
  return {
    readyState: connectionManager.readyState,
    connect: connectionManager.connect,
    disconnect: connectionManager.disconnect,
    listenEvents: namedCallbacks => {
      return eventsManager.addCallbacks(namedCallbacks);
    },
    destroy: () => {
      connectionManager.destroy();
      eventsManager.destroy();
    }
  };
};

/* globals self */
const websocketScheme = self.location.protocol === "https:" ? "wss" : "ws";
const websocketUrl = `${websocketScheme}://${self.location.host}${self.location.pathname}${self.location.search}`;
const websocketConnection = createWebSocketConnection(websocketUrl, {
  retry: true,
  retryAllocatedMs: 10_000
});
const {
  readyState,
  connect,
  disconnect,
  listenEvents
} = websocketConnection;
window.__server_events__ = {
  readyState,
  connect,
  disconnect,
  listenEvents
};
connect();
