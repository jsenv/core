(function () {
'use strict';
var inferContextFrom = function inferContextFrom(_ref) {
  var url = _ref.url,
      _ref$jsenvDirectoryRe = _ref.jsenvDirectoryRelativeUrl,
      jsenvDirectoryRelativeUrl = _ref$jsenvDirectoryRe === void 0 ? ".jsenv/" : _ref$jsenvDirectoryRe;

  var _URL = new URL(url),
      origin = _URL.origin,
      pathname = _URL.pathname;

  if (!pathname.startsWith("/".concat(jsenvDirectoryRelativeUrl))) {
    return {
      projectDirectoryServerUrl: "".concat(origin, "/"),
      jsenvDirectoryRelativeUrl: null,
      compileId: null,
      compileDirectoryRelativeUrl: null
    };
  }

  var slashIndex = pathname.indexOf("/", 1);
  var afterJsenvDirectory = pathname.slice(slashIndex + 1);
  var nextSlashIndex = afterJsenvDirectory.indexOf("/");
  var compileId = afterJsenvDirectory.slice(0, nextSlashIndex);
  return {
    projectDirectoryServerUrl: "".concat(origin, "/"),
    jsenvDirectoryRelativeUrl: jsenvDirectoryRelativeUrl,
    compileId: compileId,
    compileDirectoryRelativeUrl: "".concat(jsenvDirectoryRelativeUrl).concat(compileId, "/")
  };
};
var createUrlContext = function createUrlContext(_ref2) {
  var projectDirectoryServerUrl = _ref2.projectDirectoryServerUrl,
      compileDirectoryRelativeUrl = _ref2.compileDirectoryRelativeUrl;

  if (!compileDirectoryRelativeUrl) {
    var _compileDirectoryServerUrl = "".concat(projectDirectoryServerUrl, ".jsenv/out/");

    return {
      asSourceRelativeUrl: function asSourceRelativeUrl(url) {
        if (url.startsWith(projectDirectoryServerUrl)) {
          return url.slice(projectDirectoryServerUrl.length);
        }

        return url;
      },
      asSourceUrl: function asSourceUrl(sourceRelativeUrl) {
        return "".concat(projectDirectoryServerUrl).concat(sourceRelativeUrl);
      },
      asCompiledUrl: function asCompiledUrl(sourceRelativeUrl) {
        return "".concat(_compileDirectoryServerUrl).concat(sourceRelativeUrl);
      },
      asUrlToFetch: function asUrlToFetch(sourceRelativeUrl) {
        return "".concat(projectDirectoryServerUrl).concat(sourceRelativeUrl);
      }
    };
  }

  var compileDirectoryServerUrl = "".concat(projectDirectoryServerUrl).concat(compileDirectoryRelativeUrl);
  return {
    asSourceRelativeUrl: function asSourceRelativeUrl(url) {
      if (url.startsWith(compileDirectoryServerUrl)) {
        return url.slice(compileDirectoryServerUrl.length);
      }

      if (url.startsWith(projectDirectoryServerUrl)) {
        return url.slice(projectDirectoryServerUrl.length);
      }

      return url;
    },
    asSourceUrl: function asSourceUrl(sourceRelativeUrl) {
      return "".concat(projectDirectoryServerUrl).concat(sourceRelativeUrl);
    },
    asCompiledUrl: function asCompiledUrl(sourceRelativeUrl) {
      return "".concat(compileDirectoryServerUrl).concat(sourceRelativeUrl);
    },
    asUrlToFetch: function asUrlToFetch(sourceRelativeUrl) {
      return "".concat(compileDirectoryServerUrl).concat(sourceRelativeUrl);
    }
  };
};

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

var isAutoreloadEnabled = function isAutoreloadEnabled() {
  var value = window.localStorage.getItem("autoreload");

  if (value === "0") {
    return false;
  }

  return true;
};
var setAutoreloadPreference = function setAutoreloadPreference(value) {
  window.localStorage.setItem("autoreload", value ? "1" : "0");
};

var compareTwoUrlPaths = function compareTwoUrlPaths(url, otherUrl) {
  if (url === otherUrl) {
    return true;
  }

  var urlObject = new URL(url);
  var otherUrlObject = new URL(otherUrl);
  return urlObject.origin === otherUrlObject.origin && urlObject.pathname === otherUrlObject.pathname;
};
var injectQuery = function injectQuery(url, query) {
  var urlObject = new URL(url);
  var searchParams = urlObject.searchParams;
  Object.keys(query).forEach(function (key) {
    searchParams.set(key, query[key]);
  });
  return String(urlObject);
};

// eslint-disable-next-line consistent-return
var arrayWithHoles = (function (arr) {
  if (Array.isArray(arr)) return arr;
});

function _iterableToArrayLimit(arr, i) {
  // this is an expanded form of \`for...of\` that properly supports abrupt completions of
  // iterators etc. variable names have been minimised to reduce the size of this massive
  // helper. sometimes spec compliance is annoying :(
  //
  // _n = _iteratorNormalCompletion
  // _d = _didIteratorError
  // _e = _iteratorError
  // _i = _iterator
  // _s = _step
  var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];

  if (_i == null) return;
  var _arr = [];
  var _n = true;
  var _d = false;

  var _s, _e;

  try {
    for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) {
      _arr.push(_s.value);

      if (i && _arr.length === i) break;
    }
  } catch (err) {
    _d = true;
    _e = err;
  } finally {
    try {
      if (!_n && _i["return"] != null) _i["return"]();
    } finally {
      if (_d) throw _e;
    }
  }

  return _arr;
}

/* eslint-disable no-eq-null, eqeqeq */
function arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length;
  var arr2 = new Array(len);

  for (var i = 0; i < len; i++) {
    arr2[i] = arr[i];
  }

  return arr2;
}

/* eslint-disable consistent-return */
function unsupportedIterableToArray(o, minLen) {
  if (!o) return;
  if (typeof o === "string") return arrayLikeToArray(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);
}

var nonIterableRest = (function () {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
});

var _slicedToArray = (function (arr, i) {
  return arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || unsupportedIterableToArray(arr, i) || nonIterableRest();
});

var htmlAttributeSrcSet = {
  parse: function parse(srcset) {
    var srcCandidates = [];
    srcset.split(",").forEach(function (set) {
      var _set$trim$split = set.trim().split(" "),
          _set$trim$split2 = _slicedToArray(_set$trim$split, 2),
          specifier = _set$trim$split2[0],
          descriptor = _set$trim$split2[1];

      srcCandidates.push({
        specifier: specifier,
        descriptor: descriptor
      });
    });
    return srcCandidates;
  },
  stringify: function stringify(srcCandidates) {
    var srcset = srcCandidates.map(function (_ref) {
      var specifier = _ref.specifier,
          descriptor = _ref.descriptor;
      return "".concat(specifier, " ").concat(descriptor);
    }).join(", ");
    return srcset;
  }
};

// - no need to check [hot-accept]and [hot-decline] attributes for instance
// This is because if something should full reload, we receive "full_reload"
// from server and this function is not called


function _async$1(f) {
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

var reloadHtmlPage = function reloadHtmlPage() {
  window.parent.location.reload(true);
};
var reloadDOMNodesUsingUrls = function reloadDOMNodesUsingUrls(urlsToReload) {
  var mutations = [];

  var shouldReloadUrl = function shouldReloadUrl(urlCandidate) {
    return urlsToReload.some(function (urlToReload) {
      return compareTwoUrlPaths(urlCandidate, urlToReload);
    });
  };

  var visitNodeAttributeAsUrl = function visitNodeAttributeAsUrl(node, attributeName) {
    var attribute = node[attributeName];

    if (!attribute) {
      return;
    }

    if (SVGAnimatedString && attribute instanceof SVGAnimatedString) {
      attribute = attribute.animVal;
    }

    if (!shouldReloadUrl(attribute)) {
      return;
    }

    mutations.push(function () {
      node[attributeName] = injectQuery(attribute, {
        hmr: Date.now()
      });
    });
  };

  Array.from(document.querySelector("script")).forEach(function (script) {
    visitNodeAttributeAsUrl(script, "src");
  });
  Array.from(document.querySelectorAll("link[rel=\"stylesheet\"]")).forEach(function (link) {
    visitNodeAttributeAsUrl(link, "href");
  });
  Array.from(document.querySelectorAll("link[rel=\"icon\"]")).forEach(function (link) {
    visitNodeAttributeAsUrl(link, "href");
  });
  Array.from(document.querySelectorAll("source")).forEach(function (source) {
    visitNodeAttributeAsUrl(source, "src");
  });
  Array.from(document.querySelectorAll("img")).forEach(function (img) {
    visitNodeAttributeAsUrl(img, "src");
    var srcset = img.srcset;

    if (srcset) {
      var srcCandidates = htmlAttributeSrcSet.parse(srcset);
      srcCandidates.forEach(function (srcCandidate) {
        var url = new URL(srcCandidate.specifier, "".concat(window.location.href));

        if (shouldReloadUrl(url)) {
          srcCandidate.specifier = injectQuery(url, {
            hmr: Date.now()
          });
        }
      });
      mutations.push(function () {
        img.srcset = htmlAttributeSrcSet.stringify(srcCandidates);
      });
    }
  }); // svg image tag

  Array.from(document.querySelectorAll("image")).forEach(function (image) {
    visitNodeAttributeAsUrl(image, "href");
  }); // svg use

  Array.from(document.querySelectorAll("use")).forEach(function (use) {
    visitNodeAttributeAsUrl(use, "href");
  });
  mutations.forEach(function (mutation) {
    mutation();
  });
};
var reloadJsImport = _async$1(function (url) {
  var urlWithHmr = injectQuery(url, {
    hmr: Date.now()
  });
  return System.import(urlWithHmr);
});

/*
 * https://vitejs.dev/guide/api-hmr.html#hot-accept-deps-cb
 * https://modern-web.dev/docs/dev-server/plugins/hmr/
 */
var urlHotMetas = {};

function _await(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }

  if (!value || !value.then) {
    value = Promise.resolve(value);
  }

  return then ? value.then(then) : value;
}

var urlContext = createUrlContext(inferContextFrom({
  url: window.location
}));

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

var reloadMessages = [];

function _empty() {}

var reloadMessagesSignal = {
  onchange: function onchange() {}
};

function _awaitIgnored(value, direct) {
  if (!direct) {
    return value && value.then ? value.then(_empty) : Promise.resolve();
  }
}

var applyReloadMessageEffects = _async(function () {
  var someEffectIsFullReload = reloadMessages.some(function (reloadMessage) {
    return reloadMessage.type === "full";
  });

  if (someEffectIsFullReload) {
    reloadHtmlPage();
    return;
  }

  var onApplied = function onApplied(reloadMessage) {
    var index = reloadMessages.indexOf(reloadMessage);
    reloadMessages.splice(index, 1);
    reloadMessagesSignal.onchange();
  };

  var setReloadMessagePromise = function setReloadMessagePromise(reloadMessage, promise) {
    reloadMessage.status = "pending";
    promise.then(function () {
      onApplied(reloadMessage);
    }, function (e) {
      // reuse error display from html supervisor?
      console.error(e);
      console.error("[hmr] Failed to reload after ".concat(reloadMessage.reason, ".\nThis could be due to syntax errors or importing non-existent modules (see errors above)"));
      reloadMessage.status = "failed";
      reloadMessagesSignal.onchange();
    });
  };

  reloadMessages.forEach(function (reloadMessage) {
    if (reloadMessage.type === "hot") {
      setReloadMessagePromise(reloadMessage, applyHotReload(reloadMessage));
      return;
    }

    setReloadMessagePromise(reloadMessage, Promise.resolve());
  });
  reloadMessagesSignal.onchange(); // reload status is "pending"

  return _await();
});

function _invoke(body, then) {
  var result = body();

  if (result && result.then) {
    return result.then(then);
  }

  return then(result);
}

var applyHotReload = _async(function (_ref) {
  var hotInstructions = _ref.hotInstructions;
  return _awaitIgnored(hotInstructions.reduce(function (previous, _ref2) {
    var type = _ref2.type,
        relativeUrl = _ref2.relativeUrl,
        hotAcceptedByRelativeUrl = _ref2.hotAcceptedByRelativeUrl;
    return _await(previous, function () {
      var urlToFetch = urlContext.asUrlToFetch(relativeUrl);
      var urlHotMeta = urlHotMetas[urlToFetch];
      return _invoke(function () {
        if (urlHotMeta && urlHotMeta.disposeCallback) {
          return _awaitIgnored(urlHotMeta.disposeCallback());
        }
      }, function () {
        var _exit = false;

        if (type === "prune") {
          console.log("[jsenv] hot prune: ".concat(relativeUrl));
          return null;
        }

        return _invoke(function () {
          if (type === "js_module") {
            return _await(reloadJsImport(urlToFetch), function (namespace) {
              console.log("[jsenv] hot updated: ".concat(relativeUrl));
              _exit = true;
              return namespace;
            });
          }
        }, function (_result) {
          if (_exit) return _result;

          if (type === "html") {
            if (!compareTwoUrlPaths(urlToFetch, window.location.href)) {
              // we are not in that HTML page
              return null;
            }

            var urlToReload = urlContext.asUrlToFetch(hotAcceptedByRelativeUrl);
            var sourceUrlToReload = urlContext.asSourceUrl(hotAcceptedByRelativeUrl);
            reloadDOMNodesUsingUrls([urlToReload, sourceUrlToReload]);
            console.log("[jsenv] hot updated: ".concat(relativeUrl));
            return null;
          }

          throw new Error("unknown update type: \"".concat(type, "\""));
        });
      });
    });
  }, Promise.resolve()));
});

var addReloadMessage = function addReloadMessage(reloadMessage) {
  reloadMessages.push(reloadMessage);

  if (isAutoreloadEnabled()) {
    applyReloadMessageEffects();
  } else {
    reloadMessagesSignal.onchange();
  }
};

var eventsourceConnection = createEventSourceConnection(document.location.href, {
  reload: function reload(_ref3) {
    var data = _ref3.data;
    var reloadMessage = JSON.parse(data);
    addReloadMessage(reloadMessage);
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
  isAutoreloadEnabled: isAutoreloadEnabled,
  setAutoreloadPreference: setAutoreloadPreference,
  urlHotMetas: urlHotMetas,
  reloadMessages: reloadMessages,
  reloadMessagesSignal: reloadMessagesSignal,
  applyReloadMessageEffects: applyReloadMessageEffects,
  addReloadMessage: addReloadMessage
};
})(); // const findHotMetaUrl = (originalFileRelativeUrl) => {
//   return Object.keys(urlHotMetas).find((compileUrl) => {
//     return (
//       parseCompiledUrl(compileUrl).fileRelativeUrl === originalFileRelativeUrl
//     )
//   })
// }

//# sourceMappingURL=event_source_client.js.map