const READY_STATES = {
  CONNECTING: "connecting",
  OPEN: "open",
  CLOSING: "closing",
  CLOSED: "closed",
};

export const createConnectionManager = (
  attemptConnection,
  { retry, retryAfter, retryMaxAttempt, retryAllocatedMs },
) => {
  const readyState = {
    value: READY_STATES.CLOSED,
    goTo: (value) => {
      if (value === readyState.value) {
        return;
      }
      readyState.value = value;
      readyState.onchange();
    },
    onchange: () => {},
  };

  let _disconnect = () => {};
  const connect = () => {
    if (
      readyState.value === READY_STATES.CONNECTING ||
      readyState.value === READY_STATES.OPEN
    ) {
      return;
    }

    let retryCount = 0;
    let msSpent = 0;
    const attempt = () => {
      readyState.goTo(READY_STATES.CONNECTING);
      let timeout;
      const cancelAttempt = attemptConnection({
        onClosed: () => {
          if (!retry) {
            readyState.goTo(READY_STATES.CLOSED);
            console.info(`[jsenv] failed to connect to server`);
            return;
          }
          if (retryCount > retryMaxAttempt) {
            readyState.goTo(READY_STATES.CLOSED);
            console.info(
              `[jsenv] could not connect to server after ${retryMaxAttempt} attempt`,
            );
            return;
          }
          if (retryAllocatedMs && msSpent > retryAllocatedMs) {
            readyState.goTo(READY_STATES.CLOSED);
            console.info(
              `[jsenv] could not connect to server in less than ${retryAllocatedMs}ms`,
            );
            return;
          }
          // if closed while open -> connection lost
          // otherwise it's the attempt to connect for the first time
          // or to reconnect
          if (readyState.value === READY_STATES.OPEN) {
            console.info(`[jsenv] server connection lost; retrying to connect`);
          }
          retryCount++;
          timeout = setTimeout(() => {
            msSpent += retryAfter;
            attempt();
          }, retryAfter);
        },
        onOpen: () => {
          readyState.goTo(READY_STATES.OPEN);
          // console.info(`[jsenv] connected to server`)
        },
      });
      _disconnect = () => {
        cancelAttempt();
        clearTimeout(timeout);
        readyState.goTo(READY_STATES.CLOSED);
      };
    };
    attempt();
  };

  const disconnect = () => {
    if (
      readyState.value !== READY_STATES.CONNECTING &&
      readyState.value !== READY_STATES.OPEN
    ) {
      console.warn(
        `disconnect() ignored because connection is ${readyState.value}`,
      );
      return null;
    }
    return _disconnect();
  };

  const removePageUnloadListener = listenPageUnload(() => {
    if (
      readyState.value === READY_STATES.CONNECTING ||
      readyState.value === READY_STATES.OPEN
    ) {
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
    },
  };
};

// const listenPageMightFreeze = (callback) => {
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

const listenPageUnload = (callback) => {
  const removePageHideListener = listenEvent(
    window,
    "pagehide",
    (pageHideEvent) => {
      if (pageHideEvent.persisted !== true) {
        callback(pageHideEvent);
      }
    },
  );
  return removePageHideListener;
};

const listenEvent = (emitter, event, callback) => {
  emitter.addEventListener(event, callback);
  return () => {
    emitter.removeEventListener(event, callback);
  };
};
