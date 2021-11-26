(function () {
  'use strict';

  /* eslint-env browser */
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
    var connectionStatus = "default";

    var connectionStatusChangeCallback = function connectionStatusChangeCallback() {};

    var disconnect = function disconnect() {};

    var goToStatus = function goToStatus(newStatus) {
      connectionStatus = newStatus;
      connectionStatusChangeCallback();
    };

    var attemptConnection = function attemptConnection(url) {
      var eventSource = new EventSource(url, {
        withCredentials: true
      });

      disconnect = function disconnect() {
        if (connectionStatus !== "connecting" && connectionStatus !== "connected") {
          console.warn("disconnect() ignored because connection is ".concat(connectionStatus));
          return;
        }

        eventSource.onerror = undefined;
        eventSource.close();
        goToStatus("disconnected");
      };

      var retryCount = 0;
      var firstRetryMs = Date.now();

      eventSource.onerror = function (errorEvent) {
        if (errorEvent.target.readyState === EventSource.CONNECTING) {
          if (retryCount > retryMaxAttempt) {
            console.info("could not connect after ".concat(retryMaxAttempt, " attempt"));
            disconnect();
            return;
          }

          if (retryCount === 0) {
            firstRetryMs = Date.now();
          } else {
            var allRetryDuration = Date.now() - firstRetryMs;

            if (retryAllocatedMs && allRetryDuration > retryAllocatedMs) {
              console.info("could not connect in less than ".concat(retryAllocatedMs, " ms"));
              disconnect();
              return;
            }
          }

          retryCount++;
          goToStatus("connecting");
          return;
        }

        if (errorEvent.target.readyState === EventSource.CLOSED) {
          disconnect();
          return;
        }
      };

      eventSource.onopen = function () {
        goToStatus("connected");
      };

      Object.keys(events).forEach(function (eventName) {
        eventSource.addEventListener(eventName, function (e) {
          if (e.origin === eventSourceOrigin) {
            if (e.lastEventId) {
              lastEventId = e.lastEventId;
            }

            events[eventName](e);
          }
        });
      });

      if (!events.hasOwnProperty("welcome")) {
        eventSource.addEventListener("welcome", function (e) {
          if (e.origin === eventSourceOrigin && e.lastEventId) {
            lastEventId = e.lastEventId;
          }
        });
      }

      goToStatus("connecting");
    };

    var _connect = function connect() {
      attemptConnection(eventSourceUrl);

      _connect = function connect() {
        attemptConnection(lastEventId ? addLastEventIdIntoUrlSearchParams(eventSourceUrl, lastEventId) : eventSourceUrl);
      };
    };

    var removePageUnloadListener = listenPageUnload(function () {
      disconnect();
    });

    var destroy = function destroy() {
      removePageUnloadListener();
      disconnect();
    };

    return {
      getConnectionStatus: function getConnectionStatus() {
        return connectionStatus;
      },
      setConnectionStatusCallback: function setConnectionStatusCallback(callback) {
        connectionStatusChangeCallback = callback;
      },
      connect: _connect,
      disconnect: disconnect,
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
    var value = window.localStorage.hasOwnProperty("livereload");

    if (value === "0") {
      return false;
    }

    return true;
  };
  var setLivereloadPreference = function setLivereloadPreference(value) {
    window.localStorage.setItem("livereload", value ? "1" : "0");
  };

  /* eslint-env browser */
  var fileChanges = {};

  var filechangeCallback = function filechangeCallback() {};

  var getFileChanges = function getFileChanges() {
    return fileChanges;
  };
  var addFileChange = function addFileChange(_ref) {
    var file = _ref.file,
        eventType = _ref.eventType;
    fileChanges[file] = eventType;

    if (isLivereloadEnabled()) {
      reloadIfNeeded();
    } else {
      filechangeCallback();
    }
  };
  var setFileChangeCallback = function setFileChangeCallback(callback) {
    filechangeCallback = callback;
  };
  var reloadIfNeeded = function reloadIfNeeded() {
    var customReloads = [];
    var cssReloads = [];
    var fullReloads = [];
    Object.keys(fileChanges).forEach(function (key) {
      var livereloadCallback = window.__jsenv__.livereloadingCallbacks[key];

      if (livereloadCallback) {
        customReloads.push(function () {
          delete fileChanges[key];
          livereloadCallback({
            reloadPage: reloadPage
          });
        });
      } else if (key.endsWith(".css") || key.endsWith(".scss") || key.endsWith(".sass")) {
        cssReloads.push(function () {
          delete fileChanges[key];
        });
      } else {
        fullReloads.push(key);
      }
    });

    if (fullReloads.length > 0) {
      reloadPage();
      return;
    }

    customReloads.forEach(function (customReload) {
      customReload();
    });

    if (cssReloads.length) {
      reloadAllCss();
      cssReloads.forEach(function (cssReload) {
        cssReload();
      });
    }

    filechangeCallback();
  };

  var reloadAllCss = function reloadAllCss() {
    var links = Array.from(window.parent.document.getElementsByTagName("link"));
    links.forEach(function (link) {
      if (link.rel === "stylesheet") {
        var url = new URL(link.href);
        url.searchParams.set("t", Date.now());
        link.href = String(url);
      }
    });
  };

  var reloadPage = function reloadPage() {
    window.parent.location.reload(true);
  };

  /* eslint-env browser */
  var eventsourceConnection = createEventSourceConnection(document.location.href, {
    "file-added": function fileAdded(_ref) {
      var data = _ref.data;
      addFileChange({
        file: data,
        eventType: "added"
      });
    },
    "file-modified": function fileModified(_ref2) {
      var data = _ref2.data;
      addFileChange({
        file: data,
        eventType: "modified"
      });
    },
    "file-removed": function fileRemoved(_ref3) {
      var data = _ref3.data;
      addFileChange({
        file: data,
        eventType: "removed"
      });
    }
  }, {
    retryMaxAttempt: Infinity,
    retryAllocatedMs: 20 * 1000
  });
  var connect = eventsourceConnection.connect,
      disconnect = eventsourceConnection.disconnect,
      setConnectionStatusChangeCallback = eventsourceConnection.setConnectionStatusChangeCallback,
      getConnectionStatus = eventsourceConnection.getConnectionStatus;
  connect();
  window.__jsenv_event_source_client__ = {
    connect: connect,
    disconnect: disconnect,
    getConnectionStatus: getConnectionStatus,
    setConnectionStatusChangeCallback: setConnectionStatusChangeCallback,
    getFileChanges: getFileChanges,
    addFileChange: addFileChange,
    setFileChangeCallback: setFileChangeCallback,
    reloadIfNeeded: reloadIfNeeded,
    isLivereloadEnabled: isLivereloadEnabled,
    setLivereloadPreference: setLivereloadPreference
  };

})();

//# sourceMappingURL=event_source_client-d29d7141.js.map