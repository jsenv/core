/* eslint-env browser */
(function () {
'use strict';
const createEventSourceConnection = (eventSourceUrl, events = {}, {
  retryMaxAttempt = Infinity,
  retryAllocatedMs = Infinity,
  lastEventId
} = {}) => {
  const {
    EventSource
  } = window;

  if (typeof EventSource !== "function") {
    return () => {};
  }

  const eventSourceOrigin = new URL(eventSourceUrl).origin;
  Object.keys(events).forEach(eventName => {
    const eventCallback = events[eventName];

    events[eventName] = e => {
      if (e.origin === eventSourceOrigin) {
        if (e.lastEventId) {
          lastEventId = e.lastEventId;
        }

        eventCallback(e);
      }
    };
  });
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
    const eventSource = new EventSource(url, {
      withCredentials: true
    });

    _disconnect = () => {
      if (status.value !== "connecting" && status.value !== "connected") {
        console.warn(`disconnect() ignored because connection is ${status.value}`);
        return;
      }

      eventSource.onerror = undefined;
      eventSource.close();
      Object.keys(events).forEach(eventName => {
        eventSource.removeEventListener(eventName, events[eventName]);
      });
      status.goTo("disconnected");
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
        status.goTo("connecting");
        return;
      }

      if (errorEvent.target.readyState === EventSource.CLOSED) {
        _disconnect();

        return;
      }
    };

    eventSource.onopen = () => {
      status.goTo("connected");
    };

    Object.keys(events).forEach(eventName => {
      eventSource.addEventListener(eventName, events[eventName]);
    });

    if (!events.hasOwnProperty("welcome")) {
      eventSource.addEventListener("welcome", e => {
        if (e.origin === eventSourceOrigin && e.lastEventId) {
          lastEventId = e.lastEventId;
        }
      });
    }

    status.goTo("connecting");
  };

  let connect = () => {
    attemptConnection(eventSourceUrl);

    connect = () => {
      attemptConnection(lastEventId ? addLastEventIdIntoUrlSearchParams(eventSourceUrl, lastEventId) : eventSourceUrl);
    };
  };

  const removePageUnloadListener = listenPageUnload(() => {
    _disconnect();
  });

  const destroy = () => {
    removePageUnloadListener();

    _disconnect();
  };

  return {
    status,
    connect,
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

/* eslint-env browser */
const isLivereloadEnabled = () => {
  const value = window.localStorage.getItem("livereload");

  if (value === "0") {
    return false;
  }

  return true;
};
const setLivereloadPreference = value => {
  window.localStorage.setItem("livereload", value ? "1" : "0");
};

const createUrlContext = () => {
  const {
    origin,
    pathname,
    search
  } = new URL(window.location);

  if (!pathname.includes("/.jsenv/")) {
    return {
      asUrlToFetch: relativeUrl => {
        return `${origin}/${relativeUrl}`;
      }
    };
  }

  const ressource = `${pathname}${search}`;
  const slashIndex = ressource.indexOf("/", 1);
  const compileDirectoryRelativeUrl = ressource.slice(1, slashIndex);
  const afterCompileDirectory = ressource.slice(slashIndex + 1);
  const nextSlashIndex = afterCompileDirectory.indexOf("/");
  const compileId = afterCompileDirectory.slice(0, nextSlashIndex);
  return {
    asUrlToFetch: relativeUrl => {
      return `${origin}/${compileDirectoryRelativeUrl}/${compileId}/${relativeUrl}`;
    }
  };
};

const reloadPage = () => {
  window.parent.location.reload(true);
};

const urlContext = createUrlContext();
const reloadMessages = [];
const urlHotMetas = {};
const reloadMessagesSignal = {
  onchange: () => {}
};

const applyReloadMessageEffects = async () => {
  const someEffectIsFullReload = reloadMessages.some(reloadMessage => reloadMessage.instruction.type === "full_reload");

  if (someEffectIsFullReload) {
    reloadPage();
    return;
  }

  const onApplied = reloadMessage => {
    const index = reloadMessages.indexOf(reloadMessage);
    reloadMessages.splice(index, 1);
    reloadMessagesSignal.onchange();
  };

  const setReloadMessagePromise = (reloadMessage, promise) => {
    reloadMessage.status = "pending";
    promise.then(() => {
      onApplied(reloadMessage);
    }, e => {
      console.error(e);
      console.error(`[hmr] Failed to reload after ${reloadMessage.reason}.
This could be due to syntax errors or importing non-existent modules (see errors above)`);
      reloadMessage.status = "failed";
      reloadMessagesSignal.onchange();
    });
  };

  await Promise.all(reloadMessages.map(async reloadMessage => {
    if (reloadMessage.instruction.type === "hot_reload") {
      setReloadMessagePromise(reloadMessage, applyHotReload(reloadMessage.instruction));
      return;
    }

    onApplied(reloadMessage);
  }));
};

const applyHotReload = async ({
  updates
}) => {
  await Promise.all(updates.map(async ({
    type,
    relativeUrl
  }) => {
    // maybe rename "js" into "import"
    // "js" is too generic it could apply to a regular js file
    if (type === "js") {
      const urlToFetch = urlContext.asUrlToFetch(relativeUrl);
      const urlWithHmr = injectQuery(urlToFetch, {
        hmr: Date.now()
      });
      const namespace = await import(urlWithHmr);
      console.log(`[jsenv] hot updated: ${relativeUrl}`);
      return namespace;
    }

    throw new Error(`unknown update type: "${type}"`);
  }));
};

const injectQuery = (url, query) => {
  const urlObject = new URL(url);
  const {
    searchParams
  } = urlObject;
  Object.keys(query).forEach(key => {
    searchParams.set(key, query[key]);
  });
  return String(urlObject);
};

const addReloadMessage = reloadMessage => {
  reloadMessages.push(reloadMessage);

  if (isLivereloadEnabled()) {
    applyReloadMessageEffects();
  } else {
    reloadMessagesSignal.onchange();
  }
};

const eventsourceConnection = createEventSourceConnection(document.location.href, {
  reload: ({
    data
  }) => {
    const reloadMessage = JSON.parse(data);
    addReloadMessage(reloadMessage);
  }
}, {
  retryMaxAttempt: Infinity,
  retryAllocatedMs: 20 * 1000
});
const {
  status,
  connect,
  disconnect
} = eventsourceConnection;
connect();
window.__jsenv_event_source_client__ = {
  status,
  connect,
  disconnect,
  isLivereloadEnabled,
  setLivereloadPreference,
  urlHotMetas,
  reloadMessages,
  reloadMessagesSignal,
  applyReloadMessageEffects,
  addReloadMessage
};
})(); // const findHotMetaUrl = (originalFileRelativeUrl) => {
//   return Object.keys(urlHotMetas).find((compileUrl) => {
//     return (
//       parseCompiledUrl(compileUrl).fileRelativeUrl === originalFileRelativeUrl
//     )
//   })
// }

//# sourceMappingURL=event_source_client.js.map