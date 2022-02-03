/* eslint-env browser */
(function () {
'use strict';
var createEventSourceConnection = function createEventSourceConnection(eventSourceUrl) {
  var events = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
      _ref$retryMaxAttempt = _ref.retryMaxAttempt,
      retryMaxAttempt = _ref$retryMaxAttempt === void 0 ? Infinity : _ref$retryMaxAttempt,
      _ref$retryAllocatedMs = _ref.retryAllocatedMs,
      retryAllocatedMs = _ref$retryAllocatedMs === void 0 ? Infinity : _ref$retryAllocatedMs,
      lastEventId = _ref.lastEventId;

  var _window = window,
      EventSource = _window.EventSource;

  if (typeof EventSource !== "function") {
    return function () {};
  }

  var eventSourceOrigin = new URL(eventSourceUrl).origin;
  Object.keys(events).forEach(function (eventName) {
    var eventCallback = events[eventName];

    events[eventName] = function (e) {
      if (e.origin === eventSourceOrigin) {
        if (e.lastEventId) {
          lastEventId = e.lastEventId;
        }

        eventCallback(e);
      }
    };
  });
  var status = {
    value: "default",
    goTo: function goTo(value) {
      if (value === status.value) {
        return;
      }

      status.value = value;
      status.onchange();
    },
    onchange: function onchange() {}
  };

  var _disconnect = function _disconnect() {};

  var attemptConnection = function attemptConnection(url) {
    var eventSource = new EventSource(url, {
      withCredentials: true
    });

    _disconnect = function _disconnect() {
      if (status.value !== "connecting" && status.value !== "connected") {
        console.warn("disconnect() ignored because connection is ".concat(status.value));
        return;
      }

      eventSource.onerror = undefined;
      eventSource.close();
      Object.keys(events).forEach(function (eventName) {
        eventSource.removeEventListener(eventName, events[eventName]);
      });
      status.goTo("disconnected");
    };

    var retryCount = 0;
    var firstRetryMs = Date.now();

    eventSource.onerror = function (errorEvent) {
      if (errorEvent.target.readyState === EventSource.CONNECTING) {
        if (retryCount > retryMaxAttempt) {
          console.info("could not connect after ".concat(retryMaxAttempt, " attempt"));

          _disconnect();

          return;
        }

        if (retryCount === 0) {
          firstRetryMs = Date.now();
        } else {
          var allRetryDuration = Date.now() - firstRetryMs;

          if (retryAllocatedMs && allRetryDuration > retryAllocatedMs) {
            console.info("could not connect in less than ".concat(retryAllocatedMs, " ms"));

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

    eventSource.onopen = function () {
      status.goTo("connected");
    };

    Object.keys(events).forEach(function (eventName) {
      eventSource.addEventListener(eventName, events[eventName]);
    });

    if (!events.hasOwnProperty("welcome")) {
      eventSource.addEventListener("welcome", function (e) {
        if (e.origin === eventSourceOrigin && e.lastEventId) {
          lastEventId = e.lastEventId;
        }
      });
    }

    status.goTo("connecting");
  };

  var _connect = function connect() {
    attemptConnection(eventSourceUrl);

    _connect = function connect() {
      attemptConnection(lastEventId ? addLastEventIdIntoUrlSearchParams(eventSourceUrl, lastEventId) : eventSourceUrl);
    };
  };

  var removePageUnloadListener = listenPageUnload(function () {
    _disconnect();
  });

  var destroy = function destroy() {
    removePageUnloadListener();

    _disconnect();
  };

  return {
    status: status,
    connect: _connect,
    disconnect: function disconnect() {
      return _disconnect();
    },
    destroy: destroy
  };
};

var addLastEventIdIntoUrlSearchParams = function addLastEventIdIntoUrlSearchParams(url, lastEventId) {
  if (url.indexOf("?") === -1) {
    url += "?";
  } else {
    url += "&";
  }

  return "".concat(url, "last-event-id=").concat(encodeURIComponent(lastEventId));
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


var listenPageUnload = function listenPageUnload(callback) {
  var removePageHideListener = listenEvent(window, "pagehide", function (pageHideEvent) {
    if (pageHideEvent.persisted !== true) {
      callback(pageHideEvent);
    }
  });
  return removePageHideListener;
};

var listenEvent = function listenEvent(emitter, event, callback) {
  emitter.addEventListener(event, callback);
  return function () {
    emitter.removeEventListener(event, callback);
  };
};

/* eslint-env browser */
var isLivereloadEnabled = function isLivereloadEnabled() {
  var value = window.localStorage.getItem("livereload");

  if (value === "0") {
    return false;
  }

  return true;
};
var setLivereloadPreference = function setLivereloadPreference(value) {
  window.localStorage.setItem("livereload", value ? "1" : "0");
};

var reloadPage = function reloadPage() {
  window.parent.location.reload(true);
};

/* eslint-env browser */

function _await(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }

  if (!value || !value.then) {
    value = Promise.resolve(value);
  }

  return then ? value.then(then) : value;
}

var reloadMessages = []; // const urlHotMetas = {}

function _async(f) {
  return function () {
    for (var args = [], i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }

    try {
      return Promise.resolve(f.apply(this, args));
    } catch (e) {
      return Promise.reject(e);
    }
  };
}

var reloadMessagesSignal = {
  onchange: function onchange() {}
};

var applyReloadMessageEffects = _async(function () {
  var someEffectIsFullReload = reloadMessages.find(function (reloadMessage) {
    return reloadMessage.type === "full_reload";
  });

  if (someEffectIsFullReload) {
    reloadPage();
    return;
  }

  var copy = reloadMessages.slice();
  reloadMessages.length = 0;
  copy.forEach(function () {// todo
  });
  return _await();
});

var eventsourceConnection = createEventSourceConnection(document.location.href, {
  reload: function reload(_ref) {
    var reason = _ref.reason,
        fileRelativeUrl = _ref.fileRelativeUrl,
        instruction = _ref.instruction;
    reloadMessages.push({
      reason: reason,
      fileRelativeUrl: fileRelativeUrl,
      instruction: instruction
    });

    if (isLivereloadEnabled()) {
      applyReloadMessageEffects();
    } else {
      reloadMessagesSignal.onchange();
    }
  }
}, {
  retryMaxAttempt: Infinity,
  retryAllocatedMs: 20 * 1000
});
var status = eventsourceConnection.status,
    connect = eventsourceConnection.connect,
    disconnect = eventsourceConnection.disconnect;
connect();
window.__jsenv_event_source_client__ = {
  status: status,
  connect: connect,
  disconnect: disconnect,
  isLivereloadEnabled: isLivereloadEnabled,
  setLivereloadPreference: setLivereloadPreference,
  reloadMessages: reloadMessages,
  reloadMessagesSignal: reloadMessagesSignal,
  applyReloadMessageEffects: applyReloadMessageEffects
};
})(); // const findHotMetaUrl = (originalFileRelativeUrl) => {
//   return Object.keys(urlHotMetas).find((compileUrl) => {
//     return (
//       parseCompiledUrl(compileUrl).fileRelativeUrl === originalFileRelativeUrl
//     )
//   })
// }
// // TODO: the following "parseCompiledUrl"
// // already exists somewhere in the codebase: reuse the other one
// const parseCompiledUrl = (url) => {
//   const { pathname, search } = new URL(url)
//   const ressource = `${pathname}${search}`
//   const slashIndex = ressource.indexOf("/", 1)
//   const compileDirectoryRelativeUrl = ressource.slice(1, slashIndex)
//   const afterCompileDirectory = ressource.slice(slashIndex)
//   const nextSlashIndex = afterCompileDirectory.indexOf("/")
//   const compileId = afterCompileDirectory.slice(0, nextSlashIndex)
//   const afterCompileId = afterCompileDirectory.slice(nextSlashIndex)
//   return {
//     compileDirectoryRelativeUrl,
//     compileId,
//     fileRelativeUrl: afterCompileId,
//   }
// }

//# sourceMappingURL=event_source_client_3f4edd04.js.map