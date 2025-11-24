import cluster from "node:cluster";
import net, { Socket, createServer, isIP } from "node:net";
import { extname } from "node:path";
import { parse } from "node:querystring";
import { Readable, Stream, Writable } from "node:stream";
import http from "node:http";
import { Http2ServerResponse } from "node:http2";
import { createReadStream, existsSync, readFileSync, readdirSync, lstatSync, statSync, readFile } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { lookup } from "node:dns";
import { networkInterfaces } from "node:os";
import { createHash } from "node:crypto";

const createCallbackListNotifiedOnce = () => {
  let callbacks = [];
  let status = "waiting";
  let currentCallbackIndex = -1;

  const callbackListOnce = {};

  const add = (callback) => {
    if (status !== "waiting") {
      emitUnexpectedActionWarning({ action: "add", status });
      return removeNoop;
    }

    if (typeof callback !== "function") {
      throw new Error(`callback must be a function, got ${callback}`);
    }

    // don't register twice
    const existingCallback = callbacks.find((callbackCandidate) => {
      return callbackCandidate === callback;
    });
    if (existingCallback) {
      emitCallbackDuplicationWarning();
      return removeNoop;
    }

    callbacks.push(callback);
    return () => {
      if (status === "notified") {
        // once called removing does nothing
        // as the callbacks array is frozen to null
        return;
      }

      const index = callbacks.indexOf(callback);
      if (index === -1) {
        return;
      }

      if (status === "looping") {
        if (index <= currentCallbackIndex) {
          // The callback was already called (or is the current callback)
          // We don't want to mutate the callbacks array
          // or it would alter the looping done in "call" and the next callback
          // would be skipped
          return;
        }

        // Callback is part of the next callback to call,
        // we mutate the callbacks array to prevent this callback to be called
      }

      callbacks.splice(index, 1);
    };
  };

  const notify = (param) => {
    if (status !== "waiting") {
      emitUnexpectedActionWarning({ action: "call", status });
      return [];
    }
    status = "looping";
    const values = callbacks.map((callback, index) => {
      currentCallbackIndex = index;
      return callback(param);
    });
    callbackListOnce.notified = true;
    status = "notified";
    // we reset callbacks to null after looping
    // so that it's possible to remove during the loop
    callbacks = null;
    currentCallbackIndex = -1;

    return values;
  };

  callbackListOnce.notified = false;
  callbackListOnce.add = add;
  callbackListOnce.notify = notify;

  return callbackListOnce;
};

const emitUnexpectedActionWarning = ({ action, status }) => {
  if (typeof process.emitWarning === "function") {
    process.emitWarning(
      `"${action}" should not happen when callback list is ${status}`,
      {
        CODE: "UNEXPECTED_ACTION_ON_CALLBACK_LIST",
        detail: `Code is potentially executed when it should not`,
      },
    );
  } else {
    console.warn(
      `"${action}" should not happen when callback list is ${status}`,
    );
  }
};

const emitCallbackDuplicationWarning = () => {
  if (typeof process.emitWarning === "function") {
    process.emitWarning(`Trying to add a callback already in the list`, {
      CODE: "CALLBACK_DUPLICATION",
      detail: `Code is potentially executed more than it should`,
    });
  } else {
    console.warn(`Trying to add same callback twice`);
  }
};

const removeNoop = () => {};

/*
 * See callback_race.md
 */

const raceCallbacks = (raceDescription, winnerCallback) => {
  let cleanCallbacks = [];
  let status = "racing";

  const clean = () => {
    cleanCallbacks.forEach((clean) => {
      clean();
    });
    cleanCallbacks = null;
  };

  const cancel = () => {
    if (status !== "racing") {
      return;
    }
    status = "cancelled";
    clean();
  };

  Object.keys(raceDescription).forEach((candidateName) => {
    const register = raceDescription[candidateName];
    const returnValue = register((data) => {
      if (status !== "racing") {
        return;
      }
      status = "done";
      clean();
      winnerCallback({
        name: candidateName,
        data,
      });
    });
    if (typeof returnValue === "function") {
      cleanCallbacks.push(returnValue);
    }
  });

  return cancel;
};

/*
 * https://github.com/whatwg/dom/issues/920
 */


const Abort = {
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

const raceProcessTeardownEvents = (processTeardownEvents, callback) => {
  return raceCallbacks(
    {
      ...(processTeardownEvents.SIGHUP ? SIGHUP_CALLBACK : {}),
      ...(processTeardownEvents.SIGTERM ? SIGTERM_CALLBACK : {}),
      ...(processTeardownEvents.SIGINT ? SIGINT_CALLBACK : {}),
      ...(processTeardownEvents.beforeExit ? BEFORE_EXIT_CALLBACK : {}),
      ...(processTeardownEvents.exit ? EXIT_CALLBACK : {}),
    },
    callback,
  );
};

const SIGHUP_CALLBACK = {
  SIGHUP: (cb) => {
    process.on("SIGHUP", cb);
    return () => {
      process.removeListener("SIGHUP", cb);
    };
  },
};

const SIGTERM_CALLBACK = {
  SIGTERM: (cb) => {
    process.on("SIGTERM", cb);
    return () => {
      process.removeListener("SIGTERM", cb);
    };
  },
};

const BEFORE_EXIT_CALLBACK = {
  beforeExit: (cb) => {
    process.on("beforeExit", cb);
    return () => {
      process.removeListener("beforeExit", cb);
    };
  },
};

const EXIT_CALLBACK = {
  exit: (cb) => {
    process.on("exit", cb);
    return () => {
      process.removeListener("exit", cb);
    };
  },
};

const SIGINT_CALLBACK = {
  SIGINT: (cb) => {
    process.on("SIGINT", cb);
    return () => {
      process.removeListener("SIGINT", cb);
    };
  },
};

const createDetailedMessage = (message, details = {}) => {
  let text = `${message}`;
  const namedSectionsText = renderNamedSections(details);
  if (namedSectionsText) {
    text += `
${namedSectionsText}`;
  }
  return text;
};

const renderNamedSections = (namedSections) => {
  let text = "";
  let keys = Object.keys(namedSections);
  for (const key of keys) {
    const isLastKey = key === keys[keys.length - 1];
    const value = namedSections[key];
    text += `--- ${key} ---
${
  Array.isArray(value)
    ? value.join(`
`)
    : value
}`;
    if (!isLastKey) {
      text += "\n";
    }
  }
  return text;
};

const errorToHTML = (error) => {
  const errorIsAPrimitive =
    error === null ||
    (typeof error !== "object" && typeof error !== "function");

  if (errorIsAPrimitive) {
    if (typeof error === "string") {
      return `<pre>${escapeHtml(error)}</pre>`;
    }
    return `<pre>${JSON.stringify(error, null, "  ")}</pre>`;
  }
  return `<pre>${escapeHtml(error.stack)}</pre>`;
};

const escapeHtml = (string) => {
  return string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const LOG_LEVEL_OFF = "off";

const LOG_LEVEL_DEBUG = "debug";

const LOG_LEVEL_INFO = "info";

const LOG_LEVEL_WARN = "warn";

const LOG_LEVEL_ERROR = "error";

const createLogger = ({ logLevel = LOG_LEVEL_INFO } = {}) => {
  if (logLevel === LOG_LEVEL_DEBUG) {
    return {
      level: "debug",
      levels: { debug: true, info: true, warn: true, error: true },
      debug,
      info,
      warn,
      error,
    };
  }
  if (logLevel === LOG_LEVEL_INFO) {
    return {
      level: "info",
      levels: { debug: false, info: true, warn: true, error: true },
      debug: debugDisabled,
      info,
      warn,
      error,
    };
  }
  if (logLevel === LOG_LEVEL_WARN) {
    return {
      level: "warn",
      levels: { debug: false, info: false, warn: true, error: true },
      debug: debugDisabled,
      info: infoDisabled,
      warn,
      error,
    };
  }
  if (logLevel === LOG_LEVEL_ERROR) {
    return {
      level: "error",
      levels: { debug: false, info: false, warn: false, error: true },
      debug: debugDisabled,
      info: infoDisabled,
      warn: warnDisabled,
      error,
    };
  }
  if (logLevel === LOG_LEVEL_OFF) {
    return {
      level: "off",
      levels: { debug: false, info: false, warn: false, error: false },
      debug: debugDisabled,
      info: infoDisabled,
      warn: warnDisabled,
      error: errorDisabled,
    };
  }
  throw new Error(`unexpected logLevel.
--- logLevel ---
${logLevel}
--- allowed log levels ---
${LOG_LEVEL_OFF}
${LOG_LEVEL_ERROR}
${LOG_LEVEL_WARN}
${LOG_LEVEL_INFO}
${LOG_LEVEL_DEBUG}`);
};

const debug = (...args) => console.debug(...args);

const debugDisabled = () => {};

const info = (...args) => console.info(...args);

const infoDisabled = () => {};

const warn = (...args) => console.warn(...args);

const warnDisabled = () => {};

const error = (...args) => console.error(...args);

const errorDisabled = () => {};

const memoize = (compute) => {
  let memoized = false;
  let memoizedValue;

  const fnWithMemoization = (...args) => {
    if (memoized) {
      return memoizedValue;
    }
    // if compute is recursive wait for it to be fully done before storing the lockValue
    // so set locked later
    memoizedValue = compute(...args);
    memoized = true;
    return memoizedValue;
  };

  fnWithMemoization.forget = () => {
    const value = memoizedValue;
    memoized = false;
    memoizedValue = undefined;
    return value;
  };

  return fnWithMemoization;
};

const mediaTypeInfos = {
  "application/json": {
    extensions: ["json", "map"],
    isTextual: true,
  },
  "application/importmap+json": {
    extensions: ["importmap"],
    isTextual: true,
  },
  "application/manifest+json": {
    extensions: ["webmanifest"],
    isTextual: true,
  },
  "application/octet-stream": {},
  "application/pdf": {
    extensions: ["pdf"],
  },
  "application/xml": {
    extensions: ["xml"],
    isTextual: true,
  },
  "application/x-gzip": {
    extensions: ["gz"],
  },
  "application/yaml": {
    extensions: ["yml", "yaml"],
    isTextual: true,
  },
  "application/wasm": {
    extensions: ["wasm"],
  },
  "application/zip": {
    extensions: ["zip"],
  },
  "audio/basic": {
    extensions: ["au", "snd"],
  },
  "audio/mpeg": {
    extensions: ["mpga", "mp2", "mp2a", "mp3", "m2a", "m3a"],
  },
  "audio/midi": {
    extensions: ["midi", "mid", "kar", "rmi"],
  },
  "audio/mp4": {
    extensions: ["m4a", "mp4a"],
  },
  "audio/ogg": {
    extensions: ["oga", "ogg", "spx"],
  },
  "audio/webm": {
    extensions: ["weba"],
  },
  "audio/x-wav": {
    extensions: ["wav"],
  },
  "font/ttf": {
    extensions: ["ttf"],
  },
  "font/woff": {
    extensions: ["woff"],
  },
  "font/woff2": {
    extensions: ["woff2"],
  },
  "image/png": {
    extensions: ["png"],
  },
  "image/gif": {
    extensions: ["gif"],
  },
  "image/jpeg": {
    extensions: ["jpg"],
  },
  "image/svg+xml": {
    extensions: ["svg", "svgz"],
    isTextual: true,
  },
  "text/plain": {
    extensions: ["txt"],
    isTextual: true,
  },
  "text/html": {
    extensions: ["html"],
    isTextual: true,
  },
  "text/css": {
    extensions: ["css"],
    isTextual: true,
  },
  "text/javascript": {
    extensions: ["js", "cjs", "mjs", "ts", "jsx", "tsx"],
    isTextual: true,
  },
  "text/markdown": {
    extensions: ["md", "mdx"],
    isTextual: true,
  },
  "text/x-sass": {
    extensions: ["sass"],
    isTextual: true,
  },
  "text/x-scss": {
    extensions: ["scss"],
    isTextual: true,
  },
  "text/cache-manifest": {
    extensions: ["appcache"],
  },
  "video/mp4": {
    extensions: ["mp4", "mp4v", "mpg4"],
  },
  "video/mpeg": {
    extensions: ["mpeg", "mpg", "mpe", "m1v", "m2v"],
  },
  "video/ogg": {
    extensions: ["ogv"],
  },
  "video/webm": {
    extensions: ["webm"],
  },
};

const CONTENT_TYPE = {
  parse: (string) => {
    const [mediaType, charset] = string.split(";");
    return { mediaType: normalizeMediaType(mediaType), charset };
  },

  stringify: ({ mediaType, charset }) => {
    if (charset) {
      return `${mediaType};${charset}`;
    }
    return mediaType;
  },

  asMediaType: (value) => {
    if (typeof value === "string") {
      return CONTENT_TYPE.parse(value).mediaType;
    }
    if (typeof value === "object") {
      return value.mediaType;
    }
    return null;
  },

  isJson: (value) => {
    const mediaType = CONTENT_TYPE.asMediaType(value);
    return (
      mediaType === "application/json" ||
      /^application\/\w+\+json$/.test(mediaType)
    );
  },

  isTextual: (value) => {
    const mediaType = CONTENT_TYPE.asMediaType(value);
    if (mediaType.startsWith("text/")) {
      return true;
    }
    const mediaTypeInfo = mediaTypeInfos[mediaType];
    if (mediaTypeInfo && mediaTypeInfo.isTextual) {
      return true;
    }
    // catch things like application/manifest+json, application/importmap+json
    if (/^application\/\w+\+json$/.test(mediaType)) {
      return true;
    }
    return false;
  },

  isBinary: (value) => !CONTENT_TYPE.isTextual(value),

  asFileExtension: (value) => {
    const mediaType = CONTENT_TYPE.asMediaType(value);
    const mediaTypeInfo = mediaTypeInfos[mediaType];
    return mediaTypeInfo ? `.${mediaTypeInfo.extensions[0]}` : "";
  },

  fromExtension: (extension) => {
    if (extension[0] === ".") {
      extension = extension.slice(1);
    }
    for (const mediaTypeCandidate of Object.keys(mediaTypeInfos)) {
      const mediaTypeCandidateInfo = mediaTypeInfos[mediaTypeCandidate];
      if (
        mediaTypeCandidateInfo.extensions &&
        mediaTypeCandidateInfo.extensions.includes(extension)
      ) {
        return mediaTypeCandidate;
      }
    }
    return "application/octet-stream";
  },

  fromUrlExtension: (url) => {
    const { pathname } = new URL(url);
    const extensionWithDot = extname(pathname);
    if (!extensionWithDot || extensionWithDot === ".") {
      return "application/octet-stream";
    }
    const extension = extensionWithDot.slice(1);
    return CONTENT_TYPE.fromExtension(extension);
  },

  toUrlExtension: (contentType) => {
    const mediaType = CONTENT_TYPE.asMediaType(contentType);
    const mediaTypeInfo = mediaTypeInfos[mediaType];
    return mediaTypeInfo ? `.${mediaTypeInfo.extensions[0]}` : "";
  },
};

const normalizeMediaType = (value) => {
  if (value === "application/javascript") {
    return "text/javascript";
  }
  return value;
};

// https://github.com/Marak/colors.js/blob/b63ef88e521b42920a9e908848de340b31e68c9d/lib/styles.js#L29

const close = "\x1b[0m";
const red = "\x1b[31m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
// const blue = "\x1b[34m"
const magenta = "\x1b[35m";
const cyan = "\x1b[36m";
// const white = "\x1b[37m"

const websocketSuffixColorized = `{ upgrade: ${magenta}websocket${close} }`;

const colorizeResponseStatus = (status) => {
  const statusType = statusToType(status);
  if (statusType === "information") return `${cyan}${status}${close}`;
  if (statusType === "success") return `${green}${status}${close}`;
  if (statusType === "redirection") return `${magenta}${status}${close}`;
  if (statusType === "client_error") return `${yellow}${status}${close}`;
  if (statusType === "server_error") return `${red}${status}${close}`;
  return status;
};

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
const statusToType = (status) => {
  if (statusIsInformation(status)) return "information";
  if (statusIsSuccess(status)) return "success";
  if (statusIsRedirection(status)) return "redirection";
  if (statusIsClientError(status)) return "client_error";
  if (statusIsServerError(status)) return "server_error";
  return "unknown";
};

const statusIsInformation = (status) => status >= 100 && status < 200;

const statusIsSuccess = (status) => status >= 200 && status < 300;

const statusIsRedirection = (status) => status >= 300 && status < 400;

const statusIsClientError = (status) => status >= 400 && status < 500;

const statusIsServerError = (status) => status >= 500 && status < 600;

const normalizeHeaderName = (headerName) => {
  headerName = String(headerName);
  if (/[^a-z0-9\-#$%&'*+.^_`|~]/i.test(headerName)) {
    throw new TypeError("Invalid character in header field name");
  }

  return headerName.toLowerCase();
};

const normalizeHeaderValue = (headerValue) => {
  return String(headerValue);
};

/*
https://developer.mozilla.org/en-US/docs/Web/API/Headers
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
*/


const headersFromObject = (headersObject) => {
  const headers = {};

  Object.keys(headersObject).forEach((headerName) => {
    if (headerName[0] === ":") {
      // exclude http2 headers
      return;
    }
    headers[normalizeHeaderName(headerName)] = normalizeHeaderValue(
      headersObject[headerName],
    );
  });

  return headers;
};

/**

 A multiple header is a header with multiple values like

 "text/plain, application/json;q=0.1"

 Each, means it's a new value (it's optionally followed by a space)

 Each; mean it's a property followed by =
 if "" is a string
 if not it's likely a number
 */

const parseMultipleHeader = (
  multipleHeaderString,
  { validateName = () => true, validateProperty = () => true } = {},
) => {
  const values = multipleHeaderString.split(",");
  const multipleHeader = {};
  values.forEach((value) => {
    const valueTrimmed = value.trim();
    const valueParts = valueTrimmed.split(";");
    const name = valueParts[0];
    const nameValidation = validateName(name);
    if (!nameValidation) {
      return;
    }
    const afterName = valueParts.slice(1);
    const properties = parseHeaderProperties(afterName, { validateProperty });
    multipleHeader[name] = properties;
  });
  return multipleHeader;
};

const parseSingleHeaderWithAttributes = (
  string,
  { validateAttribute = () => true } = {},
) => {
  const props = {};
  const attributes = string.split(";");
  for (const attr of attributes) {
    let [name, value] = attr.split("=");
    name = name.trim();
    value = value.trim();
    if (validateAttribute({ name, value })) {
      props[name] = value;
    }
  }
  return props;
};

const parseHeaderProperties = (headerProperties, { validateProperty }) => {
  const properties = {};
  for (const propertySource of headerProperties) {
    const [propertyName, propertyValueString] = propertySource
      .trim()
      .split("=");
    const propertyValue = parseHeaderPropertyValue(propertyValueString);
    const property = { name: propertyName, value: propertyValue };
    const propertyValidation = validateProperty(property);
    if (!propertyValidation) {
      continue;
    }
    properties[propertyName] = propertyValue;
  }
  return properties;
};

const parseHeaderPropertyValue = (headerPropertyValueString) => {
  const firstChar = headerPropertyValueString[0];
  const lastChar =
    headerPropertyValueString[headerPropertyValueString.length - 1];
  if (firstChar === '"' && lastChar === '"') {
    return headerPropertyValueString.slice(1, -1);
  }
  if (isNaN(headerPropertyValueString)) {
    return headerPropertyValueString;
  }
  return parseFloat(headerPropertyValueString);
};

const stringifyMultipleHeader = (
  multipleHeader,
  { validateName = () => true, validateProperty = () => true } = {},
) => {
  return Object.keys(multipleHeader)
    .filter((name) => {
      const headerProperties = multipleHeader[name];
      if (!headerProperties) {
        return false;
      }
      if (typeof headerProperties !== "object") {
        return false;
      }
      const nameValidation = validateName(name);
      if (!nameValidation) {
        return false;
      }
      return true;
    })
    .map((name) => {
      const headerProperties = multipleHeader[name];
      const headerPropertiesString = stringifyHeaderProperties(
        headerProperties,
        {
          validateProperty,
        },
      );
      if (headerPropertiesString.length) {
        return `${name};${headerPropertiesString}`;
      }
      return name;
    })
    .join(", ");
};

const stringifyHeaderProperties = (headerProperties, { validateProperty }) => {
  const headerPropertiesString = Object.keys(headerProperties)
    .map((name) => {
      const property = {
        name,
        value: headerProperties[name],
      };
      return property;
    })
    .filter((property) => {
      const propertyValidation = validateProperty(property);
      if (!propertyValidation) {
        return false;
      }
      return true;
    })
    .map(stringifyHeaderProperty)
    .join(";");
  return headerPropertiesString;
};

const stringifyHeaderProperty = ({ name, value }) => {
  if (typeof value === "string") {
    return `${name}="${value}"`;
  }
  return `${name}=${value}`;
};

// https://wicg.github.io/observable/#core-infrastructure

if ("observable" in Symbol === false) {
  Symbol.observable = Symbol.for("observable");
}

const createObservable = (producer) => {
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
      const subscription = {
        active: true};

      const teardownCallbackList = [];
      const close = () => {
        subscription.active = false;
        let i = teardownCallbackList.length;
        while (i--) {
          teardownCallbackList[i]();
        }
        teardownCallbackList.length = 0;
      };

      signal.addEventListener("abort", () => {
        close();
      });

      producer({
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
      return undefined;
    },
  };

  return observable;
};

const isObservable = (value) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "object" || typeof value === "function") {
    return Symbol.observable in value;
  }

  return false;
};

// https://github.com/jamestalmage/stream-to-observable/blob/master/index.js

const observableFromNodeStream = (
  nodeStream,
  { readableLifetime } = {},
) => {
  const observable = createObservable(
    ({ next, error, complete, addTeardown }) => {
      const errorEventCallback = (e) => {
        error(e);
      };
      const dataEventCallback = (data) => {
        next(data);
      };
      const closeEventCallback = () => {
        complete();
      };
      const endEventCallback = () => {
        complete();
      };
      nodeStream.once("error", errorEventCallback);
      nodeStream.on("data", dataEventCallback);
      nodeStream.once("end", endEventCallback);
      nodeStream.once("close", closeEventCallback); // not sure it's required
      addTeardown(() => {
        nodeStream.removeListener("error", errorEventCallback);
        nodeStream.removeListener("data", dataEventCallback);
        nodeStream.removeListener("end", endEventCallback);
        nodeStream.removeListener("close", closeEventCallback); // not sure it's required
      });
      if (nodeStream.isPaused()) {
        nodeStream.resume();
      } else if (nodeStream.complete) {
        complete();
      }
    },
  );

  if (readableLifetime && nodeStream instanceof Readable) {
    const timeout = setTimeout(() => {
      // disabled for now
      // process.emitWarning(
      //   `Readable stream not used after ${readableLifetime / 1000} seconds.`,
      //   {
      //     CODE: "READABLE_STREAM_TIMEOUT",
      //     // url is for http client request
      //     detail: `path: ${nodeStream.path}, fd: ${nodeStream.fd}, url: ${nodeStream.url}`,
      //   },
      // );
    }, readableLifetime).unref();
    onceReadableStreamUsedOrClosed(nodeStream, () => {
      clearTimeout(timeout);
    });
    observable.timeout = timeout;
  }

  return observable;
};

const onceReadableStreamUsedOrClosed = (readableStream, callback) => {
  const dataOrCloseCallback = () => {
    readableStream.removeListener("data", dataOrCloseCallback);
    readableStream.removeListener("close", dataOrCloseCallback);
    callback();
  };
  readableStream.on("data", dataOrCloseCallback);
  readableStream.once("close", dataOrCloseCallback);
};

const fromNodeRequest = (
  nodeRequest,
  { serverOrigin, signal, requestBodyLifetime, logger, nagle },
) => {
  const requestLogger = createRequestLogger(nodeRequest, (type, value) => {
    const logFunction = logger[type];
    logFunction(value);
  });
  nodeRequest.on("error", (error) => {
    if (error.message === "aborted") {
      requestLogger.debug(
        createDetailedMessage(`request aborted by client`, {
          "error message": error.message,
        }),
      );
    } else {
      // I'm not sure this can happen but it's here in case
      requestLogger.error(
        createDetailedMessage(`"error" event emitted on request`, {
          "error stack": error.stack,
        }),
      );
    }
  });

  const handleRequestOperation = Abort.startOperation();
  if (signal) {
    handleRequestOperation.addAbortSignal(signal);
  }
  handleRequestOperation.addAbortSource((abort) => {
    nodeRequest.once("close", abort);
    return () => {
      nodeRequest.removeListener("close", abort);
    };
  });

  const headers = headersFromObject(nodeRequest.headers);
  // pause the request body stream to let a chance for other parts of the code to subscribe to the stream
  // Without this the request body readable stream
  // might be closed when we'll try to attach "data" and "end" listeners to it
  nodeRequest.pause();
  if (!nagle) {
    nodeRequest.connection.setNoDelay(true);
  }
  const body = observableFromNodeStream(nodeRequest, {
    readableLifetime: requestBodyLifetime,
  });

  let requestOrigin;
  if (nodeRequest.upgrade) {
    requestOrigin = serverOrigin;
  } else if (nodeRequest.authority) {
    requestOrigin = nodeRequest.connection.encrypted
      ? `https://${nodeRequest.authority}`
      : `http://${nodeRequest.authority}`;
  } else if (nodeRequest.headers.host) {
    requestOrigin = nodeRequest.connection.encrypted
      ? `https://${nodeRequest.headers.host}`
      : `http://${nodeRequest.headers.host}`;
  } else {
    requestOrigin = serverOrigin;
  }

  // check the following parsers if we want to support more request body content types
  // https://github.com/node-formidable/formidable/tree/master/src/parsers
  const buffer = async () => {
    // here we don't really need to warn, one might want to read anything as binary
    // const contentType = headers["content-type"];
    // if (!CONTENT_TYPE.isBinary(contentType)) {
    //   console.warn(
    //     `buffer() called on a request with content-type: "${contentType}". A binary content-type was expected.`,
    //   );
    // }
    const requestBodyBuffer = await readBody(body, { as: "buffer" });
    return requestBodyBuffer;
  };
  // maybe we could use https://github.com/form-data/form-data
  // for now we'll just return { fields, files } it's good enough to work with
  const formData = async () => {
    const contentType = headers["content-type"];
    if (contentType !== "multipart/form-data") {
      console.warn(
        `formData() called on a request with content-type: "${contentType}". multipart/form-data was expected.`,
      );
    }
    const { formidable } = await import("./formidable_index/formidable_index.js");
    const form = formidable({});
    nodeRequest.resume(); // was paused in line #53
    const [fields, files] = await form.parse(nodeRequest);
    const requestBodyFormData = { fields, files };
    return requestBodyFormData;
  };
  const text = async () => {
    const contentType = headers["content-type"];
    if (!CONTENT_TYPE.isTextual(contentType)) {
      console.warn(
        `text() called on a request with content-type "${contentType}". A textual content-type was expected.`,
      );
    }
    const requestBodyString = await readBody(body, { as: "string" });
    return requestBodyString;
  };
  const json = async () => {
    const contentType = headers["content-type"];
    if (!CONTENT_TYPE.isJson(contentType)) {
      console.warn(
        `json() called on a request with content-type "${contentType}". A json content-type was expected.`,
      );
    }
    const requestBodyString = await readBody(body, { as: "string" });
    const requestBodyJSON = JSON.parse(requestBodyString);
    return requestBodyJSON;
  };
  const queryString = async () => {
    const contentType = headers["content-type"];
    if (contentType !== "application/x-www-form-urlencoded") {
      console.warn(
        `queryString() called on a request with content-type "${contentType}". application/x-www-form-urlencoded was expected.`,
      );
    }
    const requestBodyString = await readBody(body, { as: "string" });
    const requestBodyQueryStringParsed = parse(requestBodyString);
    return requestBodyQueryStringParsed;
  };

  // request.ip          -> request ip as received by the server
  // request.ipForwarded -> ip of the client before proxying, undefined when there is no proxy
  // same applies on request.proto and request.host
  let ip = nodeRequest.socket.remoteAddress;
  let proto = requestOrigin.startsWith("http:") ? "http" : "https";
  let host = headers["host"];
  const forwarded = headers["forwarded"];
  let hostForwarded;
  let ipForwarded;
  let protoForwarded;
  if (forwarded) {
    const forwardedParsed = parseSingleHeaderWithAttributes(forwarded);
    ipForwarded = forwardedParsed.for;
    protoForwarded = forwardedParsed.proto;
    hostForwarded = forwardedParsed.host;
  } else {
    const forwardedFor = headers["x-forwarded-for"];
    const forwardedProto = headers["x-forwarded-proto"];
    const forwardedHost = headers["x-forwarded-host"];
    if (forwardedFor) {
      // format is <client-ip>, <proxy1>, <proxy2>
      ipForwarded = forwardedFor.split(",")[0];
    }
    if (forwardedProto) {
      protoForwarded = forwardedProto;
    }
    if (forwardedHost) {
      hostForwarded = forwardedHost;
    }
  }

  return Object.freeze({
    logger: requestLogger,
    ip,
    ipForwarded,
    proto,
    protoForwarded,
    host,
    hostForwarded,
    params: {},
    signal: handleRequestOperation.signal,
    http2: Boolean(nodeRequest.stream),
    origin: requestOrigin,
    ...getPropertiesFromResource({
      resource: nodeRequest.url,
      baseUrl: requestOrigin,
    }),
    method: nodeRequest.method,
    headers,
    body,
    buffer,
    formData,
    text,
    json,
    queryString,
  });
};

const createRequestLogger = (nodeRequest, write) => {
  // Handling request is asynchronous, we buffer logs for that request
  // until we know what happens with that request
  // It delays logs until we know of the request will be handled
  // but it's mandatory to make logs readable.

  const logArray = [];
  const childArray = [];
  const add = ({ type, value }) => {
    logArray.push({ type, value });
  };

  const requestLogger = {
    logArray,
    childArray,
    hasPushChild: false,
    forPush: () => {
      const childLogBuffer = createRequestLogger(nodeRequest, write);
      childLogBuffer.isChild = true;
      childArray.push(childLogBuffer);
      requestLogger.hasPushChild = true;
      return childLogBuffer;
    },
    debug: (value) => {
      add({
        type: "debug",
        value,
      });
    },
    info: (value) => {
      add({
        type: "info",
        value,
      });
    },
    warn: (value) => {
      add({
        type: "warn",
        value,
      });
    },
    error: (value) => {
      add({
        type: "error",
        value,
      });
    },
    onHeadersSent: ({ status, statusText }) => {
      const isFaviconNotFound =
        status === 404 && nodeRequest.url === "/favicon.ico";
      if (isFaviconNotFound) {
        if (process.env.CAPTURING_SIDE_EFFECTS) {
          // we don't care about this 99.999999% of the time, it only pollute logs
          return;
        }
      }
      const statusType = statusToType(status);
      let message = `${colorizeResponseStatus(status)}`;
      if (statusText) {
        message += ` ${statusText}`;
      }
      add({
        type: isFaviconNotFound
          ? "debug"
          : {
              information: "info",
              success: "info",
              redirection: "info",
              client_error: "warn",
              server_error: "error",
            }[statusType] || "error",
        value: message,
      });
    },
    ended: false,
    end: () => {
      if (requestLogger.ended) {
        return;
      }
      requestLogger.ended = true;
      if (requestLogger.isChild) {
        // keep buffering until root request write logs for everyone
        return;
      }
      const prefixLines = (string, prefix) => {
        return string.replace(/^(?!\s*$)/gm, prefix);
      };
      const writeLog = (
        { type, value },
        { someLogIsError, someLogIsWarn, depth },
      ) => {
        if (depth > 0) {
          value = prefixLines(value, "  ".repeat(depth));
        }
        if (type === "info") {
          if (someLogIsError) {
            type = "error";
          } else if (someLogIsWarn) {
            type = "warn";
          }
        }
        write(type, value);
      };
      const writeLogs = (loggerToWrite, depth) => {
        const logArray = loggerToWrite.logArray;
        if (logArray.length === 0) {
          return;
        }
        let someLogIsError = false;
        let someLogIsWarn = false;
        for (const log of loggerToWrite.logArray) {
          if (log.type === "error") {
            someLogIsError = true;
          }
          if (log.type === "warn") {
            someLogIsWarn = true;
          }
        }
        const firstLog = logArray.shift();
        const lastLog = logArray.pop();
        const middleLogs = logArray;
        writeLog(firstLog, {
          someLogIsError,
          someLogIsWarn,
          depth,
        });
        for (const middleLog of middleLogs) {
          writeLog(middleLog, {
            someLogIsError,
            someLogIsWarn,
            depth,
          });
        }
        for (const childLoggerToWrite of loggerToWrite.childArray) {
          writeLogs(childLoggerToWrite, depth + 1);
        }
        if (lastLog) {
          writeLog(lastLog, {
            someLogIsError,
            someLogIsWarn,
            depth: depth + 1,
          });
        }
      };
      writeLogs(requestLogger, 0);
    },
  };

  return requestLogger;
};

const readBody = (body, { as }) => {
  return new Promise((resolve, reject) => {
    const bufferArray = [];
    body.subscribe({
      error: reject,
      next: (buffer) => {
        bufferArray.push(buffer);
      },
      complete: () => {
        const bodyAsBuffer = Buffer.concat(bufferArray);
        if (as === "buffer") {
          resolve(bodyAsBuffer);
          return;
        }
        if (as === "string") {
          const bodyAsString = bodyAsBuffer.toString();
          resolve(bodyAsString);
          return;
        }
        if (as === "json") {
          const bodyAsString = bodyAsBuffer.toString();
          const bodyAsJSON = JSON.parse(bodyAsString);
          resolve(bodyAsJSON);
          return;
        }
      },
    });
  });
};

const applyRedirectionToRequest = (
  request,
  { resource, pathname, ...rest },
) => {
  return {
    ...request,
    ...(resource
      ? getPropertiesFromResource({
          resource,
          baseUrl: request.url,
        })
      : pathname
        ? getPropertiesFromPathname({
            pathname,
            baseUrl: request.url,
          })
        : {}),
    ...rest,
  };
};
const getPropertiesFromResource = ({ resource, baseUrl }) => {
  const urlObject = new URL(resource, baseUrl);
  let pathname = urlObject.pathname;

  return {
    url: String(urlObject),
    searchParams: urlObject.searchParams,
    pathname,
    resource,
  };
};
const getPropertiesFromPathname = ({ pathname, baseUrl }) => {
  return getPropertiesFromResource({
    resource: `${pathname}${new URL(baseUrl).search}`,
    baseUrl,
  });
};

const createPushRequest = (
  request,
  { signal, pathname, method, logger },
) => {
  const pushRequest = Object.freeze({
    ...request,
    logger,
    parent: request,
    signal,
    http2: true,
    ...(pathname
      ? getPropertiesFromPathname({
          pathname,
          baseUrl: request.url,
        })
      : {}),
    method: method || request.method,
    headers: getHeadersInheritedByPushRequest(request),
    body: undefined,
  });
  return pushRequest;
};

const getHeadersInheritedByPushRequest = (request) => {
  const headersInherited = { ...request.headers };
  // mtime sent by the client in request headers concerns the main request
  // Time remains valid for request to other resources so we keep it
  // in child requests
  // delete childHeaders["if-modified-since"]

  // eTag sent by the client in request headers concerns the main request
  // A request made to an other resource must not inherit the eTag
  delete headersInherited["if-none-match"];

  return headersInherited;
};

const isFileHandle = (value) => {
  return value && value.constructor && value.constructor.name === "FileHandle";
};

const observableFromFileHandle = (fileHandle) => {
  return observableFromNodeStream(fileHandleToReadableStream(fileHandle));
};

const fileHandleToReadableStream = (fileHandle) => {
  const fileReadableStream =
    typeof fileHandle.createReadStream === "function"
      ? fileHandle.createReadStream()
      : createReadStream(
          "/toto", // is it ok to pass a fake path like this?
          {
            fd: fileHandle.fd,
            emitClose: true,
            // autoClose: true
          },
        );
  // I suppose it's required only when doing fs.createReadStream()
  // and not fileHandle.createReadStream()
  // fileReadableStream.on("end", () => {
  //   fileHandle.close()
  // })
  return fileReadableStream;
};

const getObservableValueType = (value) => {
  if (value && typeof value.then === "function") {
    return "promise";
  }

  if (isObservable(value)) {
    return "observable";
  }

  if (isFileHandle(value)) {
    return "file_handle";
  }

  if (isNodeStream(value)) {
    return "node_stream";
  }

  if (value instanceof ReadableStream) {
    return "node_web_stream";
  }

  return "js_value";
};

const isNodeStream = (value) => {
  if (value === undefined) {
    return false;
  }

  if (
    value instanceof Stream ||
    value instanceof Writable ||
    value instanceof Readable
  ) {
    return true;
  }

  return false;
};

// https://nodejs.org/api/webstreams.html#readablestreamgetreaderoptions
// https://nodejs.org/api/webstreams.html
// we can read as text using TextDecoder, see https://developer.mozilla.org/fr/docs/Web/API/Fetch_API/Using_Fetch#traiter_un_fichier_texte_ligne_%C3%A0_ligne

const observableFromNodeWebReadableStream = (nodeWebReadableStream) => {
  const observable = createObservable(
    ({ next, error, complete, addTeardown }) => {
      const reader = nodeWebReadableStream.getReader();

      const readNext = async () => {
        try {
          const { done, value } = await reader.read();
          if (done) {
            complete();
            return;
          }
          next(value);
          readNext();
        } catch (e) {
          error(e);
        }
      };
      readNext();
      addTeardown(() => {
        reader.cancel();
      });
    },
  );

  return observable;
};

const observableFromPromise = (promise) => {
  return createObservable(async ({ next, error, complete }) => {
    try {
      const value = await promise;
      next(value);
      complete();
    } catch (e) {
      error(e);
    }
  });
};

const observableFromValue = (value) => {
  const observableValueType = getObservableValueType(value);
  if (observableValueType === "observable") {
    return value;
  }
  if (observableValueType === "promise") {
    return observableFromPromise(value);
  }
  if (observableValueType === "file_handle") {
    return observableFromFileHandle(value);
  }
  if (observableValueType === "node_stream") {
    return observableFromNodeStream(value);
  }
  if (observableValueType === "node_web_stream") {
    return observableFromNodeWebReadableStream(value);
  }
  return createObservable(({ next, complete, addTeardown }) => {
    next(value);
    const timer = setTimeout(() => {
      complete();
    });
    addTeardown(() => {
      clearTimeout(timer);
    });
  });
};

const writeNodeResponse = async (
  responseStream,
  { status, statusText, headers, body, bodyEncoding },
  { signal, ignoreBody, onAbort, onError, onHeadersSent, onEnd } = {},
) => {
  const isNetSocket = responseStream instanceof Socket;
  if (
    body &&
    body.isObservableBody &&
    headers["connection"] === undefined &&
    headers["content-length"] === undefined
  ) {
    headers["transfer-encoding"] = "chunked";
  }
  // if (body && headers["content-length"] === undefined) {
  //   headers["transfer-encoding"] = "chunked";
  // }

  const bodyObservableType = getObservableValueType(body);
  const destroyBody = () => {
    if (bodyObservableType === "file_handle") {
      body.close();
      return;
    }
    if (bodyObservableType === "node_stream") {
      body.destroy();
      return;
    }
    if (bodyObservableType === "node_web_stream") {
      body.cancel();
      return;
    }
  };

  if (signal.aborted) {
    destroyBody();
    responseStream.destroy();
    onAbort();
    return;
  }

  writeHead(responseStream, {
    status,
    statusText,
    headers,
    onHeadersSent,
  });

  if (!body) {
    onEnd();
    responseStream.end();
    return;
  }

  if (ignoreBody) {
    onEnd();
    destroyBody();
    responseStream.end();
    return;
  }

  if (bodyEncoding && !isNetSocket) {
    responseStream.setEncoding(bodyEncoding);
  }

  await new Promise((resolve) => {
    const observable = observableFromValue(body);
    const abortController = new AbortController();
    signal.addEventListener("abort", () => {
      abortController.abort();
    });
    observable.subscribe(
      {
        next: (data) => {
          try {
            responseStream.write(data);
          } catch (e) {
            // Something inside Node.js sometimes puts stream
            // in a state where .write() throw despites nodeResponse.destroyed
            // being undefined and "close" event not being emitted.
            // I have tested if we are the one calling destroy
            // (I have commented every .destroy() call)
            // but issue still occurs
            // For the record it's "hard" to reproduce but can be by running
            // a lot of tests against a browser in the context of @jsenv/core testing
            if (e.code === "ERR_HTTP2_INVALID_STREAM") {
              return;
            }
            responseStream.emit("error", e);
          }
        },
        error: (value) => {
          responseStream.emit("error", value);
        },
        complete: () => {
          responseStream.end();
        },
      },
      { signal: abortController.signal },
    );

    raceCallbacks(
      {
        abort: (cb) => {
          signal.addEventListener("abort", cb);
          return () => {
            signal.removeEventListener("abort", cb);
          };
        },
        error: (cb) => {
          responseStream.on("error", cb);
          return () => {
            responseStream.removeListener("error", cb);
          };
        },
        close: (cb) => {
          responseStream.on("close", cb);
          return () => {
            responseStream.removeListener("close", cb);
          };
        },
        finish: (cb) => {
          responseStream.on("finish", cb);
          return () => {
            responseStream.removeListener("finish", cb);
          };
        },
      },
      (winner) => {
        const raceEffects = {
          abort: () => {
            abortController.abort();
            responseStream.destroy();
            onAbort();
            resolve();
          },
          error: (error) => {
            abortController.abort();
            responseStream.destroy();
            onError(error);
            resolve();
          },
          close: () => {
            // close body in case nodeResponse is prematurely closed
            // while body is writing
            // it may happen in case of server sent event
            // where body is kept open to write to client
            // and the browser is reloaded or closed for instance
            abortController.abort();
            responseStream.destroy();
            onAbort();
            resolve();
          },
          finish: () => {
            onEnd();
            resolve();
          },
        };
        raceEffects[winner.name](winner.data);
      },
    );
  });
};

const writeHead = (
  responseStream,
  { status, statusText, headers, onHeadersSent },
) => {
  const responseIsNetSocket = responseStream instanceof Socket;
  const responseIsHttp2ServerResponse =
    responseStream instanceof Http2ServerResponse;
  const responseIsServerHttp2Stream =
    responseStream.constructor.name === "ServerHttp2Stream";
  let nodeHeaders = headersToNodeHeaders(headers, {
    // https://github.com/nodejs/node/blob/79296dc2d02c0b9872bbfcbb89148ea036a546d0/lib/internal/http2/compat.js#L112
    ignoreConnectionHeader:
      responseIsHttp2ServerResponse || responseIsServerHttp2Stream,
  });
  if (statusText === undefined) {
    statusText = statusTextFromStatus(status);
  } else {
    statusText = statusText.replace(/\n/g, "").replaceAll("✅", "");
  }
  if (responseIsServerHttp2Stream) {
    nodeHeaders = {
      ...nodeHeaders,
      ":status": status,
    };
    responseStream.respond(nodeHeaders);
    onHeadersSent({ nodeHeaders, status, statusText });
    return;
  }
  // nodejs strange signature for writeHead force this
  // https://nodejs.org/api/http.html#http_response_writehead_statuscode_statusmessage_headers
  if (
    // https://github.com/nodejs/node/blob/79296dc2d02c0b9872bbfcbb89148ea036a546d0/lib/internal/http2/compat.js#L97
    responseIsHttp2ServerResponse
  ) {
    responseStream.writeHead(status, nodeHeaders);
    onHeadersSent({ nodeHeaders, status, statusText });
    return;
  }
  if (responseIsNetSocket) {
    const headersString = Object.keys(nodeHeaders)
      .map((h) => `${h}: ${nodeHeaders[h]}`)
      .join("\r\n");
    responseStream.write(
      `HTTP/1.1 ${status} ${statusText}\r\n${headersString}\r\n\r\n`,
    );
    onHeadersSent({ nodeHeaders, status, statusText });
    return;
  }

  try {
    responseStream.writeHead(status, statusText, nodeHeaders);
  } catch (e) {
    if (
      e.code === "ERR_INVALID_CHAR" &&
      e.message.includes("Invalid character in statusMessage")
    ) {
      throw new Error(`Invalid character in statusMessage
--- status message ---
${statusText}`);
    }
    throw e;
  }
  onHeadersSent({ nodeHeaders, status, statusText });
};

const statusTextFromStatus = (status) =>
  http.STATUS_CODES[status] || "not specified";

const headersToNodeHeaders = (headers, { ignoreConnectionHeader }) => {
  const nodeHeaders = {};

  Object.keys(headers).forEach((name) => {
    if (name === "connection" && ignoreConnectionHeader) return;
    const nodeHeaderName = name in mapping ? mapping[name] : name;
    nodeHeaders[nodeHeaderName] = headers[name];
  });

  return nodeHeaders;
};

const mapping = {
  // "content-type": "Content-Type",
  // "last-modified": "Last-Modified",
};

const composeTwoObjects = (
  firstObject,
  secondObject,
  { keysComposition, strict = false, forceLowerCase = false } = {},
) => {
  if (forceLowerCase) {
    return applyCompositionForcingLowerCase(firstObject, secondObject, {
      keysComposition,
      strict,
    });
  }

  return applyCaseSensitiveComposition(firstObject, secondObject, {
    keysComposition,
    strict,
  });
};

const applyCaseSensitiveComposition = (
  firstObject,
  secondObject,
  { keysComposition, strict },
) => {
  if (strict) {
    const composed = {};
    for (const key of Object.keys(keysComposition)) {
      composed[key] = composeValueAtKey({
        firstObject,
        secondObject,
        keysComposition,
        key,
        firstKey: keyExistsIn(key, firstObject) ? key : null,
        secondKey: keyExistsIn(key, secondObject) ? key : null,
      });
    }
    return composed;
  }

  const composed = {};
  Object.keys(firstObject).forEach((key) => {
    composed[key] = firstObject[key];
  });
  Object.keys(secondObject).forEach((key) => {
    composed[key] = composeValueAtKey({
      firstObject,
      secondObject,
      keysComposition,
      key,
      firstKey: keyExistsIn(key, firstObject) ? key : null,
      secondKey: keyExistsIn(key, secondObject) ? key : null,
    });
  });
  return composed;
};

const applyCompositionForcingLowerCase = (
  firstObject,
  secondObject,
  { keysComposition, strict },
) => {
  if (strict) {
    const firstObjectKeyMapping = {};
    Object.keys(firstObject).forEach((key) => {
      firstObjectKeyMapping[key.toLowerCase()] = key;
    });
    const secondObjectKeyMapping = {};
    Object.keys(secondObject).forEach((key) => {
      secondObjectKeyMapping[key.toLowerCase()] = key;
    });
    Object.keys(keysComposition).forEach((key) => {
      composed[key] = composeValueAtKey({
        firstObject,
        secondObject,
        keysComposition,
        key,
        firstKey: firstObjectKeyMapping[key] || null,
        secondKey: secondObjectKeyMapping[key] || null,
      });
    });
  }

  const composed = {};
  Object.keys(firstObject).forEach((key) => {
    composed[key.toLowerCase()] = firstObject[key];
  });
  Object.keys(secondObject).forEach((key) => {
    const keyLowercased = key.toLowerCase();

    composed[key.toLowerCase()] = composeValueAtKey({
      firstObject,
      secondObject,
      keysComposition,
      key: keyLowercased,
      firstKey: keyExistsIn(keyLowercased, firstObject)
        ? keyLowercased
        : keyExistsIn(key, firstObject)
          ? key
          : null,
      secondKey: keyExistsIn(keyLowercased, secondObject)
        ? keyLowercased
        : keyExistsIn(key, secondObject)
          ? key
          : null,
    });
  });
  return composed;
};

const composeValueAtKey = ({
  firstObject,
  secondObject,
  firstKey,
  secondKey,
  key,
  keysComposition,
}) => {
  if (!firstKey) {
    return secondObject[secondKey];
  }

  if (!secondKey) {
    return firstObject[firstKey];
  }

  const keyForCustomComposition = keyExistsIn(key, keysComposition)
    ? key
    : null;
  if (!keyForCustomComposition) {
    return secondObject[secondKey];
  }

  const composeTwoValues = keysComposition[keyForCustomComposition];
  return composeTwoValues(firstObject[firstKey], secondObject[secondKey]);
};

const keyExistsIn = (key, object) => {
  return Object.prototype.hasOwnProperty.call(object, key);
};

const composeTwoHeaders = (firstHeaders, secondHeaders) => {
  if (firstHeaders && typeof firstHeaders.entries === "function") {
    firstHeaders = Object.fromEntries(firstHeaders.entries());
  }
  if (secondHeaders && typeof secondHeaders.entries === "function") {
    secondHeaders = Object.fromEntries(secondHeaders.entries());
  }
  return composeTwoObjects(firstHeaders, secondHeaders, {
    keysComposition: HEADER_NAMES_COMPOSITION,
    forceLowerCase: true,
  });
};

const composeTwoHeaderValues = (name, leftValue, rightValue) => {
  if (HEADER_NAMES_COMPOSITION[name]) {
    return HEADER_NAMES_COMPOSITION[name](leftValue, rightValue);
  }
  return rightValue;
};

const composeTwoCommaSeparatedValues = (value, nextValue) => {
  if (!value) {
    return nextValue;
  }
  if (!nextValue) {
    return value;
  }
  const currentValues = value
    .split(", ")
    .map((part) => part.trim().toLowerCase());
  const nextValues = nextValue
    .split(", ")
    .map((part) => part.trim().toLowerCase());
  for (const nextValue of nextValues) {
    if (!currentValues.includes(nextValue)) {
      currentValues.push(nextValue);
    }
  }
  return currentValues.join(", ");
};

const HEADER_NAMES_COMPOSITION = {
  "accept": composeTwoCommaSeparatedValues,
  "accept-charset": composeTwoCommaSeparatedValues,
  "accept-language": composeTwoCommaSeparatedValues,
  "access-control-allow-headers": composeTwoCommaSeparatedValues,
  "access-control-allow-methods": composeTwoCommaSeparatedValues,
  "access-control-allow-origin": composeTwoCommaSeparatedValues,
  "accept-patch": composeTwoCommaSeparatedValues,
  "accept-post": composeTwoCommaSeparatedValues,
  "allow": composeTwoCommaSeparatedValues,
  // https://www.w3.org/TR/server-timing/
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing
  "server-timing": composeTwoCommaSeparatedValues,
  // 'content-type', // https://github.com/ninenines/cowboy/issues/1230
  "vary": composeTwoCommaSeparatedValues,
};

const listen = async ({
  signal = new AbortController().signal,
  server,
  port,
  portHint,
  hostname,
}) => {
  const listeningOperation = Abort.startOperation();

  try {
    listeningOperation.addAbortSignal(signal);

    if (portHint) {
      listeningOperation.throwIfAborted();
      port = await findFreePort(portHint, {
        signal: listeningOperation.signal,
        hostname,
      });
    }
    listeningOperation.throwIfAborted();
    port = await startListening({ server, port, hostname });
    listeningOperation.addAbortCallback(() => stopListening(server));
    listeningOperation.throwIfAborted();

    return port;
  } finally {
    await listeningOperation.end();
  }
};

const findFreePort = async (
  initialPort = 1,
  {
    signal = new AbortController().signal,
    hostname = "127.0.0.1",
    min = 1,
    max = 65534,
    next = (port) => port + 1,
  } = {},
) => {
  const findFreePortOperation = Abort.startOperation();
  try {
    findFreePortOperation.addAbortSignal(signal);
    findFreePortOperation.throwIfAborted();

    const testUntil = async (port, host) => {
      findFreePortOperation.throwIfAborted();
      const free = await portIsFree(port, host);
      if (free) {
        return port;
      }

      const nextPort = next(port);
      if (nextPort > max) {
        throw new Error(
          `${hostname} has no available port between ${min} and ${max}`,
        );
      }
      return testUntil(nextPort, hostname);
    };
    const freePort = await testUntil(initialPort, hostname);
    return freePort;
  } finally {
    await findFreePortOperation.end();
  }
};

const portIsFree = async (port, hostname) => {
  const server = createServer();

  try {
    await startListening({
      server,
      port,
      hostname,
    });
  } catch (error) {
    if (error && error.code === "EADDRINUSE") {
      return false;
    }
    if (error && error.code === "EACCES") {
      return false;
    }
    throw error;
  }

  await stopListening(server);
  return true;
};

const startListening = ({ server, port, hostname }) => {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.on("listening", () => {
      // in case port is 0 (randomly assign an available port)
      // https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback
      resolve(server.address().port);
    });
    server.listen(port, hostname);
  });
};

const stopListening = (server) => {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.on("close", resolve);
    server.close();
  });
};

const listenEvent = (
  objectWithEventEmitter,
  eventName,
  callback,
  { once = false } = {},
) => {
  if (once) {
    objectWithEventEmitter.once(eventName, callback);
  } else {
    objectWithEventEmitter.addListener(eventName, callback);
  }
  return () => {
    objectWithEventEmitter.removeListener(eventName, callback);
  };
};

const listenRequest = (nodeServer, requestCallback) => {
  if (nodeServer._httpServer) {
    const removeHttpRequestListener = listenEvent(
      nodeServer._httpServer,
      "request",
      requestCallback,
    );
    const removeTlsRequestListener = listenEvent(
      nodeServer._tlsServer,
      "request",
      requestCallback,
    );
    return () => {
      removeHttpRequestListener();
      removeTlsRequestListener();
    };
  }
  return listenEvent(nodeServer, "request", requestCallback);
};

const listenServerConnectionError = (
  nodeServer,
  connectionErrorCallback,
  { ignoreErrorAfterConnectionIsDestroyed = true } = {},
) => {
  const cleanupSet = new Set();

  const removeConnectionListener = listenEvent(
    nodeServer,
    "connection",
    (socket) => {
      const removeSocketErrorListener = listenEvent(
        socket,
        "error",
        (error) => {
          if (ignoreErrorAfterConnectionIsDestroyed && socket.destroyed) {
            return;
          }
          connectionErrorCallback(error, socket);
        },
      );
      const removeOnceSocketCloseListener = listenEvent(
        socket,
        "close",
        () => {
          removeSocketErrorListener();
          cleanupSet.delete(cleanup);
        },
        {
          once: true,
        },
      );
      const cleanup = () => {
        removeSocketErrorListener();
        removeOnceSocketCloseListener();
      };
      cleanupSet.add(cleanup);
    },
  );
  return () => {
    removeConnectionListener();
    cleanupSet.forEach((cleanup) => {
      cleanup();
    });
    cleanupSet.clear();
  };
};

const asResponseProperties = (value) => {
  if (value && value instanceof Response) {
    return {
      status: value.status,
      statusText: value.statusText,
      headers: Object.fromEntries(value.headers),
      body: value.body,
      bodyEncoding: value.bodyEncoding,
    };
  }
  return value;
};

const composeTwoResponses = (firstResponse, secondResponse) => {
  firstResponse = asResponseProperties(firstResponse);
  secondResponse = asResponseProperties(secondResponse);

  return composeTwoObjects(firstResponse, secondResponse, {
    keysComposition: RESPONSE_KEYS_COMPOSITION,
    strict: true,
  });
};

const RESPONSE_KEYS_COMPOSITION = {
  status: (prevStatus, status) => status,
  statusText: (prevStatusText, statusText) => statusText,
  statusMessage: (prevStatusMessage, statusMessage) => statusMessage,
  headers: composeTwoHeaders,
  body: (prevBody, body) => body,
  bodyEncoding: (prevEncoding, encoding) => encoding,
};

/**

https://stackoverflow.com/a/42019773/2634179

*/


const createPolyglotServer = async ({
  http2 = false,
  http1Allowed = true,
  certificate,
  privateKey,
}) => {
  const httpServer = http.createServer();
  const tlsServer = await createSecureServer({
    certificate,
    privateKey,
    http2,
    http1Allowed,
  });
  const netServer = net.createServer({
    allowHalfOpen: false,
  });

  listenEvent(netServer, "connection", (socket) => {
    detectSocketProtocol(socket, (protocol) => {
      if (protocol === "http") {
        httpServer.emit("connection", socket);
        return;
      }

      if (protocol === "tls") {
        tlsServer.emit("connection", socket);
        return;
      }

      const response = [
        `HTTP/1.1 400 Bad Request`,
        `Content-Length: 0`,
        "",
        "",
      ].join("\r\n");
      socket.write(response);
      socket.end();
      socket.destroy();
      netServer.emit(
        "clientError",
        new Error("protocol error, Neither http, nor tls"),
        socket,
      );
    });
  });

  netServer._httpServer = httpServer;
  netServer._tlsServer = tlsServer;

  return netServer;
};

// The async part is just to lazyly import "http2" or "https"
// so that these module are parsed only if used.
// https://nodejs.org/api/tls.html#tlscreatesecurecontextoptions
const createSecureServer = async ({
  certificate,
  privateKey,
  http2,
  http1Allowed,
}) => {
  if (http2) {
    const { createSecureServer } = await import("node:http2");
    return createSecureServer({
      cert: certificate,
      key: privateKey,
      allowHTTP1: http1Allowed,
    });
  }

  const { createServer } = await import("node:https");
  return createServer({
    cert: certificate,
    key: privateKey,
  });
};

const detectSocketProtocol = (socket, protocolDetectedCallback) => {
  let removeOnceReadableListener = () => {};

  const tryToRead = () => {
    const buffer = socket.read(1);
    if (buffer === null) {
      removeOnceReadableListener = socket.once("readable", tryToRead);
      return;
    }

    const firstByte = buffer[0];
    socket.unshift(buffer);
    if (firstByte === 22) {
      protocolDetectedCallback("tls");
      return;
    }
    if (firstByte > 32 && firstByte < 127) {
      protocolDetectedCallback("http");
      return;
    }
    protocolDetectedCallback(null);
  };

  tryToRead();

  return () => {
    removeOnceReadableListener();
  };
};

const trackServerPendingConnections = (nodeServer, { http2 }) => {
  if (http2) {
    // see http2.js: we rely on https://nodejs.org/api/http2.html#http2_compatibility_api
    return trackHttp1ServerPendingConnections(nodeServer);
  }
  return trackHttp1ServerPendingConnections(nodeServer);
};

// const trackHttp2ServerPendingSessions = () => {}

const trackHttp1ServerPendingConnections = (nodeServer) => {
  const pendingConnections = new Set();

  const removeConnectionListener = listenEvent(
    nodeServer,
    "connection",
    (connection) => {
      pendingConnections.add(connection);
      listenEvent(
        connection,
        "close",
        () => {
          pendingConnections.delete(connection);
        },
        { once: true },
      );
    },
  );

  const stop = async (reason) => {
    removeConnectionListener();
    const pendingConnectionsArray = Array.from(pendingConnections);
    pendingConnections.clear();

    await Promise.all(
      pendingConnectionsArray.map(async (pendingConnection) => {
        await destroyConnection(pendingConnection, reason);
      }),
    );
  };

  return { stop };
};

const destroyConnection = (connection, reason) => {
  return new Promise((resolve, reject) => {
    connection.destroy(reason, (error) => {
      if (error) {
        if (error === reason || error.code === "ENOTCONN") {
          resolve();
        } else {
          reject(error);
        }
      } else {
        resolve();
      }
    });
  });
};

// export const trackServerPendingStreams = (nodeServer) => {
//   const pendingClients = new Set()

//   const streamListener = (http2Stream, headers, flags) => {
//     const client = { http2Stream, headers, flags }

//     pendingClients.add(client)
//     http2Stream.on("close", () => {
//       pendingClients.delete(client)
//     })
//   }

//   nodeServer.on("stream", streamListener)

//   const stop = ({
//     status,
//     // reason
//   }) => {
//     nodeServer.removeListener("stream", streamListener)

//     return Promise.all(
//       Array.from(pendingClients).map(({ http2Stream }) => {
//         if (http2Stream.sentHeaders === false) {
//           http2Stream.respond({ ":status": status }, { endStream: true })
//         }

//         return new Promise((resolve, reject) => {
//           if (http2Stream.closed) {
//             resolve()
//           } else {
//             http2Stream.close(NGHTTP2_NO_ERROR, (error) => {
//               if (error) {
//                 reject(error)
//               } else {
//                 resolve()
//               }
//             })
//           }
//         })
//       }),
//     )
//   }

//   return { stop }
// }

// export const trackServerPendingSessions = (nodeServer, { onSessionError }) => {
//   const pendingSessions = new Set()

//   const sessionListener = (session) => {
//     session.on("close", () => {
//       pendingSessions.delete(session)
//     })
//     session.on("error", onSessionError)
//     pendingSessions.add(session)
//   }

//   nodeServer.on("session", sessionListener)

//   const stop = async (reason) => {
//     nodeServer.removeListener("session", sessionListener)

//     await Promise.all(
//       Array.from(pendingSessions).map((pendingSession) => {
//         return new Promise((resolve, reject) => {
//           pendingSession.close((error) => {
//             if (error) {
//               if (error === reason || error.code === "ENOTCONN") {
//                 resolve()
//               } else {
//                 reject(error)
//               }
//             } else {
//               resolve()
//             }
//           })
//         })
//       }),
//     )
//   }

//   return { stop }
// }

const trackServerPendingRequests = (nodeServer, { http2 }) => {
  if (http2) {
    // see http2.js: we rely on https://nodejs.org/api/http2.html#http2_compatibility_api
    return trackHttp1ServerPendingRequests(nodeServer);
  }
  return trackHttp1ServerPendingRequests(nodeServer);
};

const trackHttp1ServerPendingRequests = (nodeServer) => {
  const pendingClients = new Set();

  const removeRequestListener = listenRequest(
    nodeServer,
    (nodeRequest, nodeResponse) => {
      const client = { nodeRequest, nodeResponse };
      pendingClients.add(client);
      nodeResponse.once("close", () => {
        pendingClients.delete(client);
      });
    },
  );

  const stop = async ({ status, reason }) => {
    removeRequestListener();
    const pendingClientsArray = Array.from(pendingClients);
    pendingClients.clear();
    await Promise.all(
      pendingClientsArray.map(({ nodeResponse }) => {
        if (nodeResponse.headersSent === false) {
          nodeResponse.writeHead(status, String(reason));
        }

        // http2
        if (nodeResponse.close) {
          return new Promise((resolve, reject) => {
            if (nodeResponse.closed) {
              resolve();
            } else {
              nodeResponse.close((error) => {
                if (error) {
                  reject(error);
                } else {
                  resolve();
                }
              });
            }
          });
        }

        // http
        return new Promise((resolve) => {
          if (nodeResponse.destroyed) {
            resolve();
          } else {
            nodeResponse.once("close", () => {
              resolve();
            });
            nodeResponse.destroy();
          }
        });
      }),
    );
  };

  return { stop };
};

// This file is used just for test and internal tests
// so super-linear-backtracking is ok
// and I don't know how to update the regexes to prevent this
/* eslint-disable regexp/no-super-linear-backtracking */

const parseFunction = (fn) => {
  const string = fn.toString();
  for (const candidate of CANDIDATES) {
    const returnValue = candidate(string, fn);
    if (returnValue) {
      return returnValue;
    }
  }
  return {
    type: "unknwon",
    name: "",
    argsSource: "()",
    body: removeRootIndentation(string),
  };
};

const CANDIDATES = [
  (fnString, fn) => {
    const ARROW_FUNCTION_BODY_REGEX =
      /^(?:async\s*)?(\([\s\S]*?\))\s*=>\s*\{([\s\S]*)\}$/;
    const match = fnString.match(ARROW_FUNCTION_BODY_REGEX);
    if (match) {
      return {
        type: "arrow",
        name: fn.name,
        argsSource: normalizeArgsSource(match[1]),
        body: removeRootIndentation(match[2]),
      };
    }
    return null;
  },
  (fnString, fn) => {
    const ARROW_FUNCTION_SHORTHAND_BODY_REGEX =
      /^(\([\s\S]*?\))\s*=>([\s\S]*)$/;
    const match = fnString.match(ARROW_FUNCTION_SHORTHAND_BODY_REGEX);
    if (match) {
      return {
        type: "arrow",
        name: fn.name,
        argsSource: normalizeArgsSource(match[1]),
        body: removeRootIndentation(match[2]),
      };
    }
    return null;
  },
  (fnString) => {
    const FUNCTION_BODY_REGEX =
      /^function\s*(\S*)\s*(\([\s\S]*?\))\s*\{([\s\S]*)\}$/;
    const match = fnString.match(FUNCTION_BODY_REGEX);
    if (match) {
      return {
        type: "classic",
        name: match[1],
        argsSource: normalizeArgsSource(match[2]),
        body: removeRootIndentation(match[3]),
      };
    }
    return null;
  },
  (fnString) => {
    const GETTER_SETTER_FUNCTION_BODY_REGEX =
      /^[gs]et\s*(\S*)\s*(\([\s\S]*?\))\s*\{([\s\S]*)\}$/;
    const match = fnString.match(GETTER_SETTER_FUNCTION_BODY_REGEX);
    if (match) {
      return {
        type: fnString.startsWith("get") ? "getter" : "setter",
        name: match[1],
        argsSource: normalizeArgsSource(match[2]),
        body: removeRootIndentation(match[3]),
      };
    }
    return null;
  },
];
// function with default params not supported and fallback to "()"
const normalizeArgsSource = (argsSource) => {
  if (argsSource.indexOf("(", 1)) {
    return "()";
  }
  return argsSource;
};

const removeRootIndentation = (text) => {
  const lines = text.split(/\r?\n/);
  let result = ``;
  let i = 0;

  let charsToRemove = 0;
  while (i < lines.length) {
    const line = lines[i];
    const isFirstLine = i === 0;
    const isLastLine = i === lines.length - 1;
    const isRootLine = lines[0] === "" ? i === 1 : isFirstLine;
    i++;
    if (isFirstLine && line === "") {
      // remove first line when empty
      continue;
    }
    let lineShortened = "";
    let j = 0;
    let searchIndentChar = true;
    while (j < line.length) {
      const char = line[j];
      j++;
      if (searchIndentChar && (char === " " || char === "\t")) {
        if (isRootLine) {
          charsToRemove++;
          continue;
        }
        if (j <= charsToRemove) {
          continue;
        }
      }
      searchIndentChar = false;
      lineShortened += char;
    }
    if (isLastLine && lineShortened === "") {
      // remove last line when empty
      continue;
    }
    result += isRootLine ? `${lineShortened}` : `\n${lineShortened}`;
  }
  return result;
};

const pathnameToExtension = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  const filename =
    slashLastIndex === -1 ? pathname : pathname.slice(slashLastIndex + 1);
  if (filename.match(/@([0-9])+(\.[0-9]+)?(\.[0-9]+)?$/)) {
    return "";
  }
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return "";
  }
  // if (dotLastIndex === pathname.length - 1) return ""
  const extension = filename.slice(dotLastIndex);
  return extension;
};

const resourceToParts = (resource) => {
  const searchSeparatorIndex = resource.indexOf("?");
  if (searchSeparatorIndex === -1) {
    const hashSeparatorIndex = resource.indexOf("#");
    if (hashSeparatorIndex === -1) {
      return [resource, "", ""];
    }
    const beforeHashSeparator = resource.slice(0, hashSeparatorIndex);
    const afterHashSeparator = resource.slice(hashSeparatorIndex + 1);
    return [beforeHashSeparator, "", afterHashSeparator];
  }
  const beforeSearchSeparator = resource.slice(0, searchSeparatorIndex);
  const afterSearchSeparator = resource.slice(searchSeparatorIndex + 1);
  const hashSeparatorIndex = afterSearchSeparator.indexOf("#");
  if (hashSeparatorIndex === -1) {
    return [beforeSearchSeparator, afterSearchSeparator, ""];
  }
  const afterSearchSeparatorAndBeforeHashSeparator = afterSearchSeparator.slice(
    0,
    hashSeparatorIndex,
  );
  const afterHashSeparator = afterSearchSeparator.slice(hashSeparatorIndex + 1);
  return [
    beforeSearchSeparator,
    afterSearchSeparatorAndBeforeHashSeparator,
    afterHashSeparator,
  ];
};

const resourceToPathname = (resource) => {
  const searchSeparatorIndex = resource.indexOf("?");
  if (searchSeparatorIndex > -1) {
    return resource.slice(0, searchSeparatorIndex);
  }
  const hashIndex = resource.indexOf("#");
  if (hashIndex > -1) {
    return resource.slice(0, hashIndex);
  }
  return resource;
};

const resourceToExtension = (resource) => {
  const pathname = resourceToPathname(resource);
  return pathnameToExtension(pathname);
};

const getCommonPathname = (pathname, otherPathname) => {
  if (pathname === otherPathname) {
    return pathname;
  }
  let commonPart = "";
  let commonPathname = "";
  let i = 0;
  const length = pathname.length;
  const otherLength = otherPathname.length;
  while (i < length) {
    const char = pathname.charAt(i);
    const otherChar = otherPathname.charAt(i);
    i++;
    if (char === otherChar) {
      if (char === "/") {
        commonPart += "/";
        commonPathname += commonPart;
        commonPart = "";
      } else {
        commonPart += char;
      }
    } else {
      if (char === "/" && i - 1 === otherLength) {
        commonPart += "/";
        commonPathname += commonPart;
      }
      return commonPathname;
    }
  }
  if (length === otherLength) {
    commonPathname += commonPart;
  } else if (otherPathname.charAt(i) === "/") {
    commonPathname += commonPart;
  }
  return commonPathname;
};

const urlToRelativeUrl = (
  url,
  baseUrl,
  { preferRelativeNotation } = {},
) => {
  const urlObject = new URL(url);
  const baseUrlObject = new URL(baseUrl);

  if (urlObject.protocol !== baseUrlObject.protocol) {
    const urlAsString = String(url);
    return urlAsString;
  }

  if (
    urlObject.username !== baseUrlObject.username ||
    urlObject.password !== baseUrlObject.password ||
    urlObject.host !== baseUrlObject.host
  ) {
    const afterUrlScheme = String(url).slice(urlObject.protocol.length);
    return afterUrlScheme;
  }

  const { pathname, hash, search } = urlObject;
  if (pathname === "/") {
    const baseUrlResourceWithoutLeadingSlash = baseUrlObject.pathname.slice(1);
    return baseUrlResourceWithoutLeadingSlash;
  }

  const basePathname = baseUrlObject.pathname;
  const commonPathname = getCommonPathname(pathname, basePathname);
  if (!commonPathname) {
    const urlAsString = String(url);
    return urlAsString;
  }
  const specificPathname = pathname.slice(commonPathname.length);
  const baseSpecificPathname = basePathname.slice(commonPathname.length);
  if (baseSpecificPathname.includes("/")) {
    const baseSpecificParentPathname =
      pathnameToParentPathname(baseSpecificPathname);
    const relativeDirectoriesNotation = baseSpecificParentPathname.replace(
      /.*?\//g,
      "../",
    );
    const relativeUrl = `${relativeDirectoriesNotation}${specificPathname}${search}${hash}`;
    return relativeUrl;
  }

  const relativeUrl = `${specificPathname}${search}${hash}`;
  return preferRelativeNotation ? `./${relativeUrl}` : relativeUrl;
};

const pathnameToParentPathname = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return "/";
  }
  return pathname.slice(0, slashLastIndex + 1);
};

const urlToFileSystemPath = (url) => {
  const urlObject = new URL(url);
  let { origin, pathname, hash } = urlObject;
  if (urlObject.protocol === "file:") {
    origin = "file://";
  }
  pathname = pathname
    .split("/")
    .map((part) => {
      return part.replace(/%(?![0-9A-F][0-9A-F])/g, "%25");
    })
    .join("/");
  if (hash) {
    pathname += `%23${encodeURIComponent(hash.slice(1))}`;
  }
  const urlString = `${origin}${pathname}`;
  const fileSystemPath = fileURLToPath(urlString);
  if (fileSystemPath[fileSystemPath.length - 1] === "/") {
    // remove trailing / so that nodejs path becomes predictable otherwise it logs
    // the trailing slash on linux but does not on windows
    return fileSystemPath.slice(0, -1);
  }
  return fileSystemPath;
};

const getParentDirectoryUrl = (url) => {
  if (url.startsWith("file://")) {
    // With node.js new URL('../', 'file:///C:/').href
    // returns "file:///C:/" instead of "file:///"
    const resource = url.slice("file://".length);
    const slashLastIndex = resource.lastIndexOf("/");
    if (slashLastIndex === -1) {
      return url;
    }
    const lastCharIndex = resource.length - 1;
    if (slashLastIndex === lastCharIndex) {
      const slashBeforeLastIndex = resource.lastIndexOf(
        "/",
        slashLastIndex - 1,
      );
      if (slashBeforeLastIndex === -1) {
        return url;
      }
      return `file://${resource.slice(0, slashBeforeLastIndex + 1)}`;
    }
    return `file://${resource.slice(0, slashLastIndex + 1)}`;
  }
  return new URL(url.endsWith("/") ? "../" : "./", url).href;
};

const findSelfOrAncestorDirectoryUrl = (url, callback) => {
  url = String(url);
  if (!url.endsWith("/")) {
    url = new URL("./", url).href;
  }
  while (url !== "file:///") {
    if (callback(url)) {
      return url;
    }
    url = getParentDirectoryUrl(url);
  }
  return null;
};

const lookupPackageDirectory = (currentUrl) => {
  return findSelfOrAncestorDirectoryUrl(currentUrl, (ancestorDirectoryUrl) => {
    const potentialPackageJsonFileUrl = `${ancestorDirectoryUrl}package.json`;
    return existsSync(new URL(potentialPackageJsonFileUrl));
  });
};

/*
 * Link to things doing pattern matching:
 * https://git-scm.com/docs/gitignore
 * https://github.com/kaelzhang/node-ignore
 */

/** @module jsenv_url_meta **/
/**
 * An object representing the result of applying a pattern to an url
 * @typedef {Object} MatchResult
 * @property {boolean} matched Indicates if url matched pattern
 * @property {number} patternIndex Index where pattern stopped matching url, otherwise pattern.length
 * @property {number} urlIndex Index where url stopped matching pattern, otherwise url.length
 * @property {Array} matchGroups Array of strings captured during pattern matching
 */

/**
 * Apply a pattern to an url
 * @param {Object} applyPatternMatchingParams
 * @param {string} applyPatternMatchingParams.pattern "*", "**" and trailing slash have special meaning
 * @param {string} applyPatternMatchingParams.url a string representing an url
 * @return {MatchResult}
 */
const applyPattern = ({ url, pattern }) => {
  const { matched, patternIndex, index, groups } = applyMatching(pattern, url);
  const matchGroups = [];
  let groupIndex = 0;
  for (const group of groups) {
    if (group.name) {
      matchGroups[group.name] = group.string;
    } else {
      matchGroups[groupIndex] = group.string;
      groupIndex++;
    }
  }
  return {
    matched,
    patternIndex,
    urlIndex: index,
    matchGroups,
  };
};

/**
 * Core pattern matching function that processes patterns against strings
 * @param {string} pattern - The pattern with special syntax (*,**,/) to match against
 * @param {string} string - The string to test against the pattern
 * @returns {Object} Result containing match status and capture groups
 * @private
 */
const applyMatching = (pattern, string) => {
  const groups = [];
  let patternIndex = 0;
  let index = 0;
  let remainingPattern = pattern;
  let remainingString = string;
  let restoreIndexes = true;

  const consumePattern = (count) => {
    const subpattern = remainingPattern.slice(0, count);
    remainingPattern = remainingPattern.slice(count);
    patternIndex += count;
    return subpattern;
  };
  const consumeString = (count) => {
    const substring = remainingString.slice(0, count);
    remainingString = remainingString.slice(count);
    index += count;
    return substring;
  };
  const consumeRemainingString = () => {
    return consumeString(remainingString.length);
  };

  const matchOne = () => {
    // pattern consumed
    if (remainingPattern === "") {
      if (remainingString === "") {
        return true; // string fully matched pattern
      }
      if (remainingString[0] === "?") {
        // match search params
        consumeRemainingString();
        return true;
      }
      return false; // fails because string longer than expect
    }

    // -- from this point pattern is not consumed --
    // string consumed, pattern not consumed
    if (remainingString === "") {
      if (remainingPattern === "**") {
        // trailing "**" is optional
        consumePattern(2);
        return true;
      }
      if (remainingPattern === "*") {
        groups.push({ string: "" });
      }
      return false; // fail because string shorter than expect
    }

    // -- from this point pattern and string are not consumed --
    // fast path trailing slash
    if (remainingPattern === "/") {
      if (remainingString[0] === "/") {
        // trailing slash match remaining
        consumePattern(1);
        groups.push({ string: consumeRemainingString() });
        return true;
      }
      return false;
    }

    // fast path trailing '**'
    if (remainingPattern === "**") {
      consumePattern(2);
      consumeRemainingString();
      return true;
    }

    if (remainingPattern.slice(0, 4) === "/**/") {
      consumePattern(3); // consumes "/**/"
      const skipResult = skipUntilMatchIterative({
        pattern: remainingPattern,
        string: remainingString,
        canSkipSlash: true,
      });
      for (let i = 0; i < skipResult.groups.length; i++) {
        groups.push(skipResult.groups[i]);
      }
      consumePattern(skipResult.patternIndex);
      consumeRemainingString();
      restoreIndexes = false;
      return skipResult.matched;
    }

    // pattern leading **
    if (remainingPattern.slice(0, 2) === "**") {
      consumePattern(2); // consumes "**"
      let skipAllowed = true;
      if (remainingPattern[0] === "/") {
        consumePattern(1); // consumes "/"
        // when remainingPattern was preceeded by "**/"
        // and remainingString have no "/"
        // then skip is not allowed, a regular match will be performed
        if (remainingString.includes("/")) {
          skipAllowed = false;
        }
      }
      // pattern ending with "**" or "**/" match remaining string
      if (remainingPattern === "") {
        consumeRemainingString();
        return true;
      }
      if (skipAllowed) {
        const skipResult = skipUntilMatchIterative({
          pattern: remainingPattern,
          string: remainingString,
          canSkipSlash: true,
        });
        for (let i = 0; i < skipResult.groups.length; i++) {
          groups.push(skipResult.groups[i]);
        }
        consumePattern(skipResult.patternIndex);
        consumeRemainingString();
        restoreIndexes = false;
        return skipResult.matched;
      }
    }

    if (remainingPattern[0] === "*") {
      consumePattern(1); // consumes "*"
      if (remainingPattern === "") {
        // matches everything except "/"
        const slashIndex = remainingString.indexOf("/");
        if (slashIndex === -1) {
          groups.push({ string: consumeRemainingString() });
          return true;
        }
        groups.push({ string: consumeString(slashIndex) });
        return false;
      }
      // the next char must not the one expect by remainingPattern[0]
      // because * is greedy and expect to skip at least one char
      if (remainingPattern[0] === remainingString[0]) {
        groups.push({ string: "" });
        patternIndex = patternIndex - 1;
        return false;
      }
      const skipResult = skipUntilMatchIterative({
        pattern: remainingPattern,
        string: remainingString,
        canSkipSlash: false,
      });
      groups.push(skipResult.group);
      for (let i = 0; i < skipResult.groups.length; i++) {
        groups.push(skipResult.groups[i]);
      }
      consumePattern(skipResult.patternIndex);
      consumeString(skipResult.index);
      restoreIndexes = false;
      return skipResult.matched;
    }

    if (remainingPattern[0] !== remainingString[0]) {
      return false;
    }

    return undefined;
  };

  // Replace recursive iterate() with iterative approach
  let matched;
  let continueIteration = true;

  while (continueIteration) {
    const patternIndexBefore = patternIndex;
    const indexBefore = index;

    matched = matchOne();

    if (matched === undefined) {
      consumePattern(1);
      consumeString(1);
      // Continue the loop instead of recursion
      continue;
    }

    if (matched === false && restoreIndexes) {
      patternIndex = patternIndexBefore;
      index = indexBefore;
    }

    // End the loop
    continueIteration = false;
  }

  return {
    matched,
    patternIndex,
    index,
    groups,
  };
};

/**
 * Iterative version of skipUntilMatch that avoids recursion
 * @param {Object} params
 * @param {string} params.pattern - The pattern to match
 * @param {string} params.string - The string to test against
 * @param {boolean} params.canSkipSlash - Whether slash characters can be skipped
 * @returns {Object} Result of the matching attempt
 */
const skipUntilMatchIterative = ({ pattern, string, canSkipSlash }) => {
  let index = 0;
  let remainingString = string;
  let longestAttemptRange = null;
  let isLastAttempt = false;

  const failure = () => {
    return {
      matched: false,
      patternIndex: longestAttemptRange.patternIndex,
      index: longestAttemptRange.index + longestAttemptRange.length,
      groups: longestAttemptRange.groups,
      group: {
        string: string.slice(0, longestAttemptRange.index),
      },
    };
  };

  // Loop until a match is found or all attempts fail
  while (true) {
    const matchAttempt = applyMatching(pattern, remainingString);

    if (matchAttempt.matched) {
      return {
        matched: true,
        patternIndex: matchAttempt.patternIndex,
        index: index + matchAttempt.index,
        groups: matchAttempt.groups,
        group: {
          string:
            remainingString === ""
              ? string
              : string.slice(0, -remainingString.length),
        },
      };
    }

    const attemptIndex = matchAttempt.index;
    const attemptRange = {
      patternIndex: matchAttempt.patternIndex,
      index,
      length: attemptIndex,
      groups: matchAttempt.groups,
    };

    if (
      !longestAttemptRange ||
      longestAttemptRange.length < attemptRange.length
    ) {
      longestAttemptRange = attemptRange;
    }

    if (isLastAttempt) {
      return failure();
    }

    const nextIndex = attemptIndex + 1;
    if (nextIndex >= remainingString.length) {
      return failure();
    }

    if (remainingString[0] === "/") {
      if (!canSkipSlash) {
        return failure();
      }
      // when it's the last slash, the next attempt is the last
      if (remainingString.indexOf("/", 1) === -1) {
        isLastAttempt = true;
      }
    }

    // search against the next unattempted string
    index += nextIndex;
    remainingString = remainingString.slice(nextIndex);
  }
};

const applyPatternMatching = ({ url, pattern }) => {
  assertUrlLike(pattern, "pattern");
  if (url && typeof url.href === "string") url = url.href;
  assertUrlLike(url, "url");
  return applyPattern({ url, pattern });
};

const resolveAssociations = (associations, resolver) => {
  let resolve = () => {};
  if (typeof resolver === "function") {
    resolve = resolver;
  } else if (typeof resolver === "string") {
    const baseUrl = resolver;
    assertUrlLike(baseUrl, "baseUrl");
    resolve = (pattern) => new URL(pattern, baseUrl).href;
  } else if (resolver && typeof resolver.href === "string") {
    const baseUrl = resolver.href;
    assertUrlLike(baseUrl, "baseUrl");
    resolve = (pattern) => new URL(pattern, baseUrl).href;
  }

  const associationsResolved = {};
  for (const key of Object.keys(associations)) {
    const value = associations[key];
    if (typeof value === "object" && value !== null) {
      const valueMapResolved = {};
      for (const pattern of Object.keys(value)) {
        const valueAssociated = value[pattern];
        let patternResolved;
        try {
          patternResolved = resolve(pattern);
        } catch {
          // it's not really an url, no need to perform url resolution nor encoding
          patternResolved = pattern;
        }
        valueMapResolved[patternResolved] = valueAssociated;
      }
      associationsResolved[key] = valueMapResolved;
    } else {
      associationsResolved[key] = value;
    }
  }
  return associationsResolved;
};

const asFlatAssociations = (associations) => {
  if (!isPlainObject(associations)) {
    throw new TypeError(
      `associations must be a plain object, got ${associations}`,
    );
  }
  const flatAssociations = {};
  for (const associationName of Object.keys(associations)) {
    const associationValue = associations[associationName];
    if (!isPlainObject(associationValue)) {
      continue;
    }
    for (const pattern of Object.keys(associationValue)) {
      const patternValue = associationValue[pattern];
      const previousValue = flatAssociations[pattern];
      if (isPlainObject(previousValue)) {
        flatAssociations[pattern] = {
          ...previousValue,
          [associationName]: patternValue,
        };
      } else {
        flatAssociations[pattern] = {
          [associationName]: patternValue,
        };
      }
    }
  }
  return flatAssociations;
};

const applyAssociations = ({ url, associations }) => {
  if (url && typeof url.href === "string") url = url.href;
  assertUrlLike(url);
  const flatAssociations = asFlatAssociations(associations);
  let associatedValue = {};
  for (const pattern of Object.keys(flatAssociations)) {
    const { matched } = applyPatternMatching({
      pattern,
      url,
    });
    if (matched) {
      const value = flatAssociations[pattern];
      associatedValue = deepAssign(associatedValue, value);
    }
  }
  return associatedValue;
};

const deepAssign = (firstValue, secondValue) => {
  if (!isPlainObject(firstValue)) {
    if (isPlainObject(secondValue)) {
      return deepAssign({}, secondValue);
    }
    return secondValue;
  }
  if (!isPlainObject(secondValue)) {
    return secondValue;
  }
  for (const key of Object.keys(secondValue)) {
    const leftPopertyValue = firstValue[key];
    const rightPropertyValue = secondValue[key];
    firstValue[key] = deepAssign(leftPopertyValue, rightPropertyValue);
  }
  return firstValue;
};

const urlChildMayMatch = ({ url, associations, predicate }) => {
  if (url && typeof url.href === "string") url = url.href;
  assertUrlLike(url, "url");
  // the function was meants to be used on url ending with '/'
  if (!url.endsWith("/")) {
    throw new Error(`url should end with /, got ${url}`);
  }
  if (typeof predicate !== "function") {
    throw new TypeError(`predicate must be a function, got ${predicate}`);
  }
  const flatAssociations = asFlatAssociations(associations);
  // for full match we must create an object to allow pattern to override previous ones
  let fullMatchMeta = {};
  let someFullMatch = false;
  // for partial match, any meta satisfying predicate will be valid because
  // we don't know for sure if pattern will still match for a file inside pathname
  const partialMatchMetaArray = [];
  for (const pattern of Object.keys(flatAssociations)) {
    const value = flatAssociations[pattern];
    const matchResult = applyPatternMatching({
      pattern,
      url,
    });
    if (matchResult.matched) {
      someFullMatch = true;
      if (isPlainObject(fullMatchMeta) && isPlainObject(value)) {
        fullMatchMeta = {
          ...fullMatchMeta,
          ...value,
        };
      } else {
        fullMatchMeta = value;
      }
    } else if (someFullMatch === false && matchResult.urlIndex >= url.length) {
      partialMatchMetaArray.push(value);
    }
  }
  if (someFullMatch) {
    return Boolean(predicate(fullMatchMeta));
  }
  return partialMatchMetaArray.some((partialMatchMeta) =>
    predicate(partialMatchMeta),
  );
};

const applyAliases = ({ url, aliases }) => {
  for (const key of Object.keys(aliases)) {
    const matchResult = applyPatternMatching({
      pattern: key,
      url,
    });
    if (!matchResult.matched) {
      continue;
    }
    const { matchGroups } = matchResult;
    const alias = aliases[key];
    const parts = alias.split("*");
    let newUrl = "";
    let index = 0;
    for (const part of parts) {
      newUrl += `${part}`;
      if (index < parts.length - 1) {
        newUrl += matchGroups[index];
      }
      index++;
    }
    return newUrl;
  }
  return url;
};

const matches = (url, patterns) => {
  return Boolean(
    applyAssociations({
      url,
      associations: {
        yes: patterns,
      },
    }).yes,
  );
};

// const assertSpecifierMetaMap = (value, checkComposition = true) => {
//   if (!isPlainObject(value)) {
//     throw new TypeError(
//       `specifierMetaMap must be a plain object, got ${value}`,
//     );
//   }
//   if (checkComposition) {
//     const plainObject = value;
//     Object.keys(plainObject).forEach((key) => {
//       assertUrlLike(key, "specifierMetaMap key");
//       const value = plainObject[key];
//       if (value !== null && !isPlainObject(value)) {
//         throw new TypeError(
//           `specifierMetaMap value must be a plain object or null, got ${value} under key ${key}`,
//         );
//       }
//     });
//   }
// };
const assertUrlLike = (value, name = "url") => {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a url string, got ${value}`);
  }
  if (isWindowsPathnameSpecifier(value)) {
    throw new TypeError(
      `${name} must be a url but looks like a windows pathname, got ${value}`,
    );
  }
  if (!hasScheme(value)) {
    throw new TypeError(
      `${name} must be a url and no scheme found, got ${value}`,
    );
  }
};
const isPlainObject = (value) => {
  if (value === null) {
    return false;
  }
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return false;
    }
    return true;
  }
  return false;
};
const isWindowsPathnameSpecifier = (specifier) => {
  const firstChar = specifier[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = specifier[1];
  if (secondChar !== ":") return false;
  const thirdChar = specifier[2];
  return thirdChar === "/" || thirdChar === "\\";
};
const hasScheme = (specifier) => /^[a-zA-Z]+:/.test(specifier);

const createFilter = (patterns, url, map = (v) => v) => {
  const associations = resolveAssociations(
    {
      yes: patterns,
    },
    url,
  );
  return (url) => {
    const meta = applyAssociations({ url, associations });
    return Boolean(map(meta.yes));
  };
};

const URL_META = {
  resolveAssociations,
  applyAssociations,
  applyAliases,
  applyPatternMatching,
  urlChildMayMatch,
  matches,
  createFilter,
};

const isEscaped = (i, string) => {
  let backslashBeforeCount = 0;
  while (i--) {
    const previousChar = string[i];
    if (previousChar === "\\") {
      backslashBeforeCount++;
    }
    break;
  }
  const isEven = backslashBeforeCount % 2 === 0;
  return !isEven;
};

const escapeChars = (string, replacements) => {
  const charsToEscape = Object.keys(replacements);
  let result = "";
  let last = 0;
  let i = 0;
  while (i < string.length) {
    const char = string[i];
    i++;
    if (charsToEscape.includes(char) && !isEscaped(i - 1, string)) {
      if (last === i - 1) {
        result += replacements[char];
      } else {
        result += `${string.slice(last, i - 1)}${replacements[char]}`;
      }
      last = i;
    }
  }
  if (last !== string.length) {
    result += string.slice(last);
  }
  return result;
};

// https://github.com/benjamingr/RegExp.escape/blob/master/polyfill.js

const escapeRegexpSpecialChars = (string) => {
  return escapeChars(String(string), {
    "/": "\\/",
    "^": "\\^",
    "\\": "\\\\",
    "[": "\\[",
    "]": "\\]",
    "(": "\\(",
    ")": "\\)",
    "{": "\\{",
    "}": "\\}",
    "?": "\\?",
    "+": "\\+",
    "*": "\\*",
    ".": "\\.",
    "|": "\\|",
    "$": "\\$",
  });
};

const createPattern = (
  pattern,
  {
    namedGroupDelimiter,
    prepareStringToGenerate = (stringToBuild) => stringToBuild,
    finalizeGeneratedString = (generatedString) => generatedString,
    // encode = encodeURIComponent,
    // decode = decodeURIComponent,
  } = {},
) => {
  if (pattern === "*") {
    return {
      regexp: /.*/,
      match: () => true,
      generate: (stringToGenerate) => stringToGenerate,
      generateExample: (stringToGenerate) => stringToGenerate,
    };
  }

  const parts = [];
  const namedParams = [];
  let starParamCount = 0;
  let regexpSource = "";
  let lastIndex = 0;
  regexpSource += "^";
  for (const match of pattern.matchAll(/:\w+|\*/g)) {
    const string = match[0];
    const index = match.index;
    let before = pattern.slice(lastIndex, index);
    parts.push({ type: "static", value: before });
    regexpSource += escapeRegexpSpecialChars(before);
    if (string === "*") {
      starParamCount++;
      regexpSource += `(?<star_${starParamCount - 1}>.+)`;
      parts.push({ type: "star", value: starParamCount - 1 });
    } else {
      const paramName = string.slice(1);
      namedParams.push(paramName);
      regexpSource += namedGroupDelimiter
        ? `(?<${paramName}>[^${escapeRegexpSpecialChars(namedGroupDelimiter)}]+)`
        : `(?<${paramName}>.+)`;
      parts.push({ type: "named", value: paramName });
    }
    lastIndex = index + string.length;
  }
  const after = pattern.slice(lastIndex);
  parts.push({ type: "static", value: after });
  regexpSource += escapeRegexpSpecialChars(after);
  regexpSource += "$";

  const regexp = new RegExp(regexpSource);

  const generateWhenPatternIsStatic = () => {
    return prepareStringToGenerate(pattern);
  };
  const generateWhenPatternUsesOnlyStarParams = (...values) => {
    let generatedString = "";
    for (const part of parts) {
      if (part.type === "static") {
        generatedString += part.value;
      } else {
        generatedString += values[part.value];
      }
    }
    return finalizeGeneratedString(generatedString, pattern);
  };
  const generateWhenPatternUsesOnlyNamedParams = (namedValues) => {
    let generatedString = "";
    for (const part of parts) {
      if (part.type === "static") {
        generatedString += part.value;
      } else {
        generatedString += namedValues[part.value];
      }
    }
    return finalizeGeneratedString(generatedString, pattern);
  };
  const generateWhenPatternUsesNamedAndStarParams = (
    namedValues,
    ...values
  ) => {
    let generatedString = "";
    for (const part of parts) {
      if (part.type === "static") {
        generatedString += part.value;
      } else if (part.type === "named") {
        generatedString += namedValues[part.value];
      } else {
        generatedString += values[part.value];
      }
    }
    return finalizeGeneratedString(generatedString, pattern);
  };

  const isStatic = namedParams.length === 0 && starParamCount === 0;
  const usesOnlyNamedParams = namedParams.length > 0 && starParamCount === 0;
  const usesOnlyStarParams = namedParams.length === 0 && starParamCount > 0;
  const usesNamedAndStarParams = namedParams.length > 0 && starParamCount > 0;

  const generate = isStatic
    ? generateWhenPatternIsStatic
    : usesOnlyNamedParams
      ? generateWhenPatternUsesOnlyNamedParams
      : usesOnlyStarParams
        ? generateWhenPatternUsesOnlyStarParams
        : generateWhenPatternUsesNamedAndStarParams;

  return {
    regexp,
    match: (value) => {
      if (value === undefined) {
        return null;
      }
      const match = String(value).match(regexp);
      if (!match) {
        return null;
      }
      const groups = match.groups;
      if (groups && Object.keys(groups).length) {
        const stars = [];
        const named = {};
        for (const key of Object.keys(groups)) {
          if (key.startsWith("star_")) {
            const index = parseInt(key.slice("star_".length));
            stars[index] = groups[key];
          } else {
            named[key] = groups[key];
          }
        }
        return {
          named: Object.keys(named).length === 0 ? null : named,
          stars: stars.length === 0 ? null : stars,
        };
      }
      return { named: null, stars: null };
    },
    generate,
    generateExample: () => {
      if (usesNamedAndStarParams) {
        return generate(
          generateNamedParamsExample(namedParams),
          ...generateStarParamsExample(starParamCount),
        );
      }
      if (usesOnlyNamedParams) {
        return generate(generateNamedParamsExample(namedParams));
      }
      if (usesOnlyStarParams) {
        return generate(...generateStarParamsExample(starParamCount));
      }
      return generate();
    },
  };
};

const composeTwoMatchResults = (left, right) => {
  if (!left || !right) {
    return false;
  }
  let named;
  const leftNamed = left.named;
  const rightNamed = right.named;
  if (leftNamed && rightNamed) {
    named = { ...leftNamed, ...rightNamed };
  } else if (leftNamed) {
    named = leftNamed;
  } else if (rightNamed) {
    named = rightNamed;
  }
  let stars;
  const leftStars = left.stars;
  const rightStars = right.stars;
  if (leftStars && rightStars) {
    stars = [...leftStars, ...rightStars];
  } else if (leftStars) {
    stars = leftStars;
  } else if (rightStars) {
    stars = rightStars;
  }
  return { named, stars };
};

const PATTERN = {
  create: createPattern,
  composeTwoMatchResults,
  createKeyValue: (object) => {
    const patternMap = new Map();
    const keys = Object.keys(object);
    for (const key of keys) {
      const value = object[key];
      if (typeof value === "function") {
        patternMap.set(key, {
          match: (value) => {
            return Boolean(value(value));
          },
          generate: () => {
            return "?";
          },
        });
      } else {
        const valuePattern = PATTERN.create(value);
        patternMap.set(key, valuePattern);
      }
    }
    return {
      match: (objectToMatch) => {
        const namedValues = {};
        for (const [key, pattern] of patternMap) {
          const value = objectToMatch[key];
          const matchResult = pattern.match(value);
          if (!matchResult) {
            return false;
          }
          const named = matchResult.named;
          Object.assign(namedValues, named);
        }
        return namedValues;
      },
      generate: (values) => {
        const generatedObject = {};
        for (const [key, pattern] of patternMap) {
          generatedObject[key] = pattern.generate(values);
        }
        return generatedObject;
      },
      generateExample: () => {
        const generatedObject = {};
        for (const [key, pattern] of patternMap) {
          generatedObject[key] = pattern.generateExample();
        }
        return generatedObject;
      },
    };
  },
};

const generateNamedParamsExample = (namedParams) => {
  const namedParamValues = {};
  for (const name of namedParams) {
    namedParamValues[name] = name;
  }
  return namedParamValues;
};
const generateStarParamsExample = (starParamCount) => {
  const starValues = [];
  while (starValues.length < starParamCount) {
    starValues.push(starValues.length);
  }
  return starValues;
};

const createHeadersPattern = (headers) => {
  return PATTERN.createKeyValue(headers);
};

const createResourcePattern = (pattern) => {
  const [pathnamePatternString, searchPatternString, hashPatternString] =
    resourceToParts(pattern);

  const pathnamePattern = PATTERN.create(pathnamePatternString, {
    namedGroupDelimiter: "/",
  });
  let searchPattern;
  if (searchPatternString) {
    const searchParams = Object.fromEntries(
      new URLSearchParams(searchPatternString),
    );
    searchPattern = PATTERN.createKeyValue(searchParams);
  }
  let hashPattern;
  if (hashPatternString) {
    hashPattern = PATTERN.create(hashPatternString, {
      namedGroupDelimiter: "&",
    });
  }

  return {
    match: (resource) => {
      const [pathname, search, hash] = resourceToParts(resource);
      let result = pathnamePattern.match(decodeURIComponent(pathname));
      if (!result) {
        return null;
      }

      let searchResult;
      let hashResult;
      if (searchPattern) {
        const searchParams = Object.fromEntries(new URLSearchParams(search));
        searchResult = searchPattern.match(searchParams);
        if (!searchResult) {
          return null;
        }
        if (result.named) {
          Object.assign(result.named, searchResult);
        } else {
          result.named = searchResult;
        }
      }
      if (hashPattern) {
        hashResult = hashPattern.match(hash);
        if (!hashResult) {
          return null;
        }
        result = PATTERN.composeTwoMatchResults(result, hashResult);
      }
      return result;
    },
    generate: (...args) => {
      let resource = "";
      resource += pathnamePattern.generate(...args);
      if (searchPatternString) {
        const generatedSearchParams = searchPattern.generate(args[0]);
        const searchParams = new URLSearchParams();
        for (const key of Object.keys(generatedSearchParams)) {
          searchParams.set(key, generatedSearchParams[key]);
        }
        const search = searchParams.toString();
        resource += `?${search}`;
      }
      if (hashPatternString) {
        resource += `#${hashPattern.generate(args[0])}`;
      }
      return resource;
    },
    generateExample: () => {
      let resourceExample = "";
      resourceExample += pathnamePattern.generateExample();
      if (searchPatternString) {
        resourceExample += `?${searchPattern.generateExample()}`;
      }
      if (hashPatternString) {
        resourceExample += `#${hashPattern.generateExample()}`;
      }
      return resourceExample;
    },
  };
};

// const resourceFromUrl = (url, baseUrl = "http://example.com") => {
//   url = String(url);
//   if (url[0] === "/") {
//     url = url.slice(1);
//   }
//   // if (url[0] !== "/") url = `/${url}`;
//   const urlObject = new URL(url, baseUrl);
//   const resource = urlObject.href.slice(urlObject.origin.length);
//   return resource;
// };

const pickAcceptedContent = ({
  availables,
  accepteds,
  getAcceptanceScore,
}) => {
  let highestScore = -1;
  let availableWithHighestScore = null;
  let availableIndex = 0;
  while (availableIndex < availables.length) {
    const available = availables[availableIndex];
    availableIndex++;

    let acceptedIndex = 0;
    while (acceptedIndex < accepteds.length) {
      const accepted = accepteds[acceptedIndex];
      acceptedIndex++;

      const score = getAcceptanceScore(accepted, available);
      if (score > highestScore) {
        availableWithHighestScore = available;
        highestScore = score;
      }
    }
  }
  return availableWithHighestScore;
};

const pickContentEncoding = (request, availableEncodings) => {
  const { headers = {} } = request;
  const requestAcceptEncodingHeader = headers["accept-encoding"];
  if (!requestAcceptEncodingHeader) {
    return null;
  }

  const encodingsAccepted = parseAcceptEncodingHeader(
    requestAcceptEncodingHeader,
  );
  return pickAcceptedContent({
    accepteds: encodingsAccepted,
    availables: availableEncodings,
    getAcceptanceScore: getEncodingAcceptanceScore,
  });
};

const parseAcceptEncodingHeader = (acceptEncodingHeaderString) => {
  const acceptEncodingHeader = parseMultipleHeader(acceptEncodingHeaderString, {
    validateProperty: ({ name }) => {
      // read only q, anything else is ignored
      return name === "q";
    },
  });

  const encodingsAccepted = [];
  Object.keys(acceptEncodingHeader).forEach((key) => {
    const { q = 1 } = acceptEncodingHeader[key];
    const value = key;
    encodingsAccepted.push({
      value,
      quality: q,
    });
  });
  encodingsAccepted.sort((a, b) => {
    return b.quality - a.quality;
  });
  return encodingsAccepted;
};

const getEncodingAcceptanceScore = ({ value, quality }, availableEncoding) => {
  if (value === "*") {
    return quality;
  }

  // normalize br to brotli
  if (value === "br") value = "brotli";
  if (availableEncoding === "br") availableEncoding = "brotli";

  if (value === availableEncoding) {
    return quality;
  }

  return -1;
};

const pickContentLanguage = (request, availableLanguages) => {
  const { headers = {} } = request;
  const requestAcceptLanguageHeader = headers["accept-language"];
  if (!requestAcceptLanguageHeader) {
    return null;
  }

  const languagesAccepted = parseAcceptLanguageHeader(
    requestAcceptLanguageHeader,
  );
  return pickAcceptedContent({
    accepteds: languagesAccepted,
    availables: availableLanguages,
    getAcceptanceScore: getLanguageAcceptanceScore,
  });
};

const parseAcceptLanguageHeader = (acceptLanguageHeaderString) => {
  const acceptLanguageHeader = parseMultipleHeader(acceptLanguageHeaderString, {
    validateProperty: ({ name }) => {
      // read only q, anything else is ignored
      return name === "q";
    },
  });

  const languagesAccepted = [];
  Object.keys(acceptLanguageHeader).forEach((key) => {
    const { q = 1 } = acceptLanguageHeader[key];
    const value = key;
    languagesAccepted.push({
      value,
      quality: q,
    });
  });
  languagesAccepted.sort((a, b) => {
    return b.quality - a.quality;
  });
  return languagesAccepted;
};

const getLanguageAcceptanceScore = ({ value, quality }, availableLanguage) => {
  const [acceptedPrimary, acceptedVariant] = decomposeLanguage(value);
  const [availablePrimary, availableVariant] =
    decomposeLanguage(availableLanguage);

  const primaryAccepted =
    acceptedPrimary === "*" ||
    acceptedPrimary.toLowerCase() === availablePrimary.toLowerCase();
  const variantAccepted =
    acceptedVariant === "*" ||
    compareVariant(acceptedVariant, availableVariant);

  if (primaryAccepted && variantAccepted) {
    return quality + 1;
  }
  if (primaryAccepted) {
    return quality;
  }
  return -1;
};

const decomposeLanguage = (fullType) => {
  const [primary, variant] = fullType.split("-");
  return [primary, variant];
};

const compareVariant = (left, right) => {
  if (left === right) {
    return true;
  }
  if (left && right && left.toLowerCase() === right.toLowerCase()) {
    return true;
  }
  return false;
};

const pickContentType = (request, availableContentTypes) => {
  const { headers = {} } = request;
  const requestAcceptHeader = headers.accept;
  if (!requestAcceptHeader) {
    return null;
  }

  const contentTypesAccepted = parseAcceptHeader(requestAcceptHeader);
  return pickAcceptedContent({
    accepteds: contentTypesAccepted,
    availables: availableContentTypes,
    getAcceptanceScore: getContentTypeAcceptanceScore,
  });
};

const parseAcceptHeader = (acceptHeader) => {
  const acceptHeaderObject = parseMultipleHeader(acceptHeader, {
    validateProperty: ({ name }) => {
      // read only q, anything else is ignored
      return name === "q";
    },
  });

  const accepts = [];
  Object.keys(acceptHeaderObject).forEach((key) => {
    const { q = 1 } = acceptHeaderObject[key];
    const value = key;
    accepts.push({
      value,
      quality: q,
    });
  });
  accepts.sort((a, b) => {
    return b.quality - a.quality;
  });
  return accepts;
};

const getContentTypeAcceptanceScore = (
  { value, quality },
  availableContentType,
) => {
  const [acceptedType, acceptedSubtype] = decomposeContentType(value);
  const [availableType, availableSubtype] =
    decomposeContentType(availableContentType);

  const typeAccepted = acceptedType === "*" || acceptedType === availableType;
  const subtypeAccepted =
    acceptedSubtype === "*" || acceptedSubtype === availableSubtype;

  if (typeAccepted && subtypeAccepted) {
    return quality;
  }
  return -1;
};

const decomposeContentType = (fullType) => {
  const [type, subtype] = fullType.split("/");
  return [type, subtype];
};

const pickContentVersion = (request, availableVersions) => {
  const { headers = {} } = request;
  const requestAcceptVersionHeader = headers["accept-version"];
  if (!requestAcceptVersionHeader) {
    return null;
  }

  const versionsAccepted = parseAcceptVersionHeader(requestAcceptVersionHeader);
  return pickAcceptedContent({
    accepteds: versionsAccepted,
    availables: availableVersions,
    getAcceptanceScore: getVersionAcceptanceScore,
  });
};

const parseAcceptVersionHeader = (acceptVersionHeaderString) => {
  const acceptVersionHeader = parseMultipleHeader(acceptVersionHeaderString, {
    validateProperty: ({ name }) => {
      // read only q, anything else is ignored
      return name === "q";
    },
  });

  const versionsAccepted = [];
  for (const key of Object.keys(acceptVersionHeader)) {
    const { q = 1 } = acceptVersionHeader[key];
    const value = key;
    versionsAccepted.push({
      value,
      quality: q,
    });
  }
  versionsAccepted.sort((a, b) => {
    return b.quality - a.quality;
  });
  return versionsAccepted;
};

const getVersionAcceptanceScore = ({ value, quality }, availableVersion) => {
  if (value === "*") {
    return quality;
  }

  if (typeof availableVersion === "function") {
    if (availableVersion(value)) {
      return quality;
    }
    return -1;
  }

  if (typeof availableVersion === "number") {
    availableVersion = String(availableVersion);
  }

  if (value === availableVersion) {
    return quality;
  }

  return -1;
};

const routeInspectorUrl = `/.internal/route_inspector`;

const HTTP_METHODS = [
  "OPTIONS",
  "HEAD",
  "GET",
  "POST",
  "PATCH",
  "PUT",
  "DELETE",
];

const createRouter = (
  routeDescriptionArray,
  { optionsFallback, logLevel } = {},
) => {
  const logger = createLogger({ logLevel });
  const routeSet = new Set();

  const constructAvailableEndpoints = () => {
    // TODO: memoize
    // TODO: construct only if the route is visible to that client
    const availableEndpoints = [];
    const createEndpoint = ({ method, resource }) => {
      return {
        method,
        resource,
        toString: () => {
          return `${method} ${resource}`;
        },
      };
    };

    for (const route of routeSet) {
      const endpointResource = route.resourcePattern.generateExample();
      if (route.method === "*") {
        for (const HTTP_METHOD of HTTP_METHODS) {
          availableEndpoints.push(
            createEndpoint({
              method: HTTP_METHOD,
              resource: endpointResource,
            }),
          );
        }
      } else {
        availableEndpoints.push(
          createEndpoint({
            method: route.method,
            resource: endpointResource,
          }),
        );
      }
    }
    return availableEndpoints;
  };
  const createResourceOptions = () => {
    const acceptedMediaTypeSet = new Set();
    const postAcceptedMediaTypeSet = new Set();
    const patchAcceptedMediaTypeSet = new Set();
    const allowedMethodSet = new Set();
    return {
      onMethodAllowed: (route, method) => {
        allowedMethodSet.add(method);
        for (const acceptedMediaType of route.acceptedMediaTypes) {
          acceptedMediaTypeSet.add(acceptedMediaType);
          if (method === "POST") {
            postAcceptedMediaTypeSet.add(acceptedMediaType);
          }
          if (method === "PATCH") {
            patchAcceptedMediaTypeSet.add(acceptedMediaType);
          }
        }
      },
      asResponseHeaders: () => {
        const headers = {};
        if (acceptedMediaTypeSet.size) {
          headers["accept"] = Array.from(acceptedMediaTypeSet).join(", ");
        }
        if (postAcceptedMediaTypeSet.size) {
          headers["accept-post"] = Array.from(postAcceptedMediaTypeSet).join(
            ", ",
          );
        }
        if (patchAcceptedMediaTypeSet.size) {
          headers["accept-patch"] = Array.from(patchAcceptedMediaTypeSet).join(
            ", ",
          );
        }
        if (allowedMethodSet.size) {
          headers["allow"] = Array.from(allowedMethodSet).join(", ");
        }
        return headers;
      },
      toJSON: () => {
        return {
          acceptedMediaTypes: Array.from(acceptedMediaTypeSet),
          postAcceptedMediaTypes: Array.from(postAcceptedMediaTypeSet),
          patchAcceptedMediaTypes: Array.from(patchAcceptedMediaTypeSet),
          allowedMethods: Array.from(allowedMethodSet),
        };
      },
    };
  };
  const forEachMethodAllowed = (route, onMethodAllowed) => {
    const supportedMethods =
      route.method === "*" ? HTTP_METHODS : [route.method];
    for (const supportedMethod of supportedMethods) {
      onMethodAllowed(supportedMethod);
    }
  };
  const inferResourceOPTIONS = (request) => {
    const resourceOptions = createResourceOptions();
    for (const route of routeSet) {
      if (!route.matchResource(request.resource)) {
        continue;
      }
      const accessControlRequestMethodHeader =
        request.headers["access-control-request-method"];
      if (accessControlRequestMethodHeader) {
        if (route.matchMethod(accessControlRequestMethodHeader)) {
          resourceOptions.onMethodAllowed(
            route,
            accessControlRequestMethodHeader,
          );
        }
      } else {
        forEachMethodAllowed(route, (methodAllowed) => {
          resourceOptions.onMethodAllowed(route, methodAllowed);
        });
      }
    }
    return resourceOptions;
  };
  const inferServerOPTIONS = () => {
    const serverOptions = createResourceOptions();
    const resourceOptionsMap = new Map();

    for (const route of routeSet) {
      const routeResource = route.resource;
      let resourceOptions = resourceOptionsMap.get(routeResource);
      if (!resourceOptions) {
        resourceOptions = createResourceOptions();
        resourceOptionsMap.set(routeResource, resourceOptions);
      }
      forEachMethodAllowed(route, (method) => {
        serverOptions.onMethodAllowed(route, method);
        resourceOptions.onMethodAllowed(route, method);
      });
    }
    return {
      server: serverOptions,
      resourceOptionsMap,
    };
  };

  const router = {};
  for (const routeDescription of routeDescriptionArray) {
    const route = createRoute(routeDescription);
    routeSet.add(route);
  }

  const match = async (request, fetchSecondArg) => {
    fetchSecondArg.router = router;
    const wouldHaveMatched = {
      // in case nothing matches we can produce a response with Allow: GET, POST, PUT for example
      methodSet: new Set(),
      requestMediaTypeSet: new Set(),
      responseMediaTypeSet: new Set(),
      responseLanguageSet: new Set(),
      responseVersionSet: new Set(),
      responseEncodingSet: new Set(),
      upgrade: false,
    };

    let currentService;
    let currentRoutingTiming;
    const onRouteMatchStart = (route) => {
      if (route.service === currentService) {
        return;
      }
      onRouteGroupEnd();
      currentRoutingTiming = fetchSecondArg.timing(
        route.service
          ? `${route.service.name.replace("jsenv:", "")}.routing`
          : "routing",
      );
      currentService = route.service;
    };
    const onRouteGroupEnd = () => {
      if (currentRoutingTiming) {
        currentRoutingTiming.end();
      }
    };
    const onRouteMatch = (route) => {
      logger.debug(`Matched route: ${route}`);
      onRouteGroupEnd();
    };

    const checkResponseContentHeader = (route, responseHeaders, name) => {
      const routePropertyName = {
        type: "availableMediaTypes",
        language: "availableLanguages",
        version: "availableVersions",
        encoding: "availableEncodings",
      }[name];
      const availableValues = route[routePropertyName];
      if (availableValues.length === 0) {
        return;
      }
      const responseHeaderName = {
        type: "content-type",
        language: "content-language",
        version: "content-version",
        encoding: "content-encoding",
      }[name];
      let responseHeaderValue = responseHeaders[responseHeaderName];
      if (!responseHeaderValue) {
        request.logger.warn(
          `The response header ${responseHeaderName} is missing.
It should be set to one of route.${routePropertyName}: ${availableValues.join(", ")}.`,
        );
        return;
      }
      if (responseHeaderName === "content-type") {
        responseHeaderValue = CONTENT_TYPE.asMediaType(responseHeaderValue);
      }
      if (
        responseHeaderName === "content-version" &&
        isFinite(responseHeaderValue)
      ) {
        responseHeaderValue = parseFloat(responseHeaderValue);
      }
      let matchesAnAvailableValue = false;
      for (const availableValue of availableValues) {
        if (responseHeaderValue === availableValue) {
          matchesAnAvailableValue = true;
          break;
        }
        if (
          typeof availableValue === "function" &&
          availableValue(responseHeaderValue)
        ) {
          matchesAnAvailableValue = true;
          break;
        }
      }

      if (!matchesAnAvailableValue) {
        request.logger.warn(
          `The value "${responseHeaderValue}" found in response header ${responseHeaderName} is strange.
It should be should be one of route.${routePropertyName}: ${availableValues.join(", ")}.`,
        );
        return;
      }
    };
    const onResponseHeaders = (request, route, responseHeaders) => {
      checkResponseContentHeader(route, responseHeaders, "type");
      checkResponseContentHeader(route, responseHeaders, "language");
      checkResponseContentHeader(route, responseHeaders, "version");
      checkResponseContentHeader(route, responseHeaders, "encoding");
    };

    for (const route of routeSet) {
      onRouteMatchStart(route);
      const resourceMatchResult = route.matchResource(request.resource);
      if (!resourceMatchResult) {
        continue;
      }
      if (!route.matchMethod(request.method)) {
        if (!route.isFallback) {
          wouldHaveMatched.methodSet.add(route.method);
        }
        continue;
      }
      if (
        request.method === "POST" ||
        request.method === "PATCH" ||
        request.method === "PUT"
      ) {
        const { acceptedMediaTypes } = route;
        if (
          acceptedMediaTypes.length &&
          !isRequestBodyMediaTypeSupported(request, { acceptedMediaTypes })
        ) {
          for (const acceptedMediaType of acceptedMediaTypes) {
            wouldHaveMatched.requestMediaTypeSet.add(acceptedMediaType);
          }
          continue;
        }
      }
      const headersMatchResult = route.matchHeaders(request.headers);
      if (!headersMatchResult) {
        continue;
      }
      if (route.isForWebSocket && request.headers["upgrade"] !== "websocket") {
        wouldHaveMatched.upgrade = true;
        continue;
      }
      // now we are "good", let's try to generate a response
      const contentNegotiationResult = {};
      {
        // when content nego fails
        // we will check the remaining accept headers to properly inform client of all the things are failing
        // Example:
        // client says "I want text in french"
        // but server only provide json in english
        // we want to tell client both text and french are not available
        let hasFailed = false;
        const { availableMediaTypes } = route;
        if (availableMediaTypes.length) {
          fetchSecondArg.injectResponseHeader("vary", "accept");
          if (request.headers["accept"]) {
            const mediaTypeNegotiated = pickContentType(
              request,
              availableMediaTypes,
            );
            if (!mediaTypeNegotiated) {
              for (const availableMediaType of availableMediaTypes) {
                wouldHaveMatched.responseMediaTypeSet.add(availableMediaType);
              }
              hasFailed = true;
            }
            contentNegotiationResult.mediaType = mediaTypeNegotiated;
          } else {
            contentNegotiationResult.mediaType = availableMediaTypes[0];
          }
        }
        const { availableLanguages } = route;
        if (availableLanguages.length) {
          fetchSecondArg.injectResponseHeader("vary", "accept-language");
          if (request.headers["accept-language"]) {
            const languageNegotiated = pickContentLanguage(
              request,
              availableLanguages,
            );
            if (!languageNegotiated) {
              for (const availableLanguage of availableLanguages) {
                wouldHaveMatched.responseLanguageSet.add(availableLanguage);
              }
              hasFailed = true;
            }
            contentNegotiationResult.language = languageNegotiated;
          } else {
            contentNegotiationResult.language = availableLanguages[0];
          }
        }
        const { availableVersions } = route;
        if (availableVersions.length) {
          fetchSecondArg.injectResponseHeader("vary", "accept-version");
          if (request.headers["accept-version"]) {
            const versionNegotiated = pickContentVersion(
              request,
              availableVersions,
            );
            if (!versionNegotiated) {
              for (const availableVersion of availableVersions) {
                wouldHaveMatched.responseVersionSet.add(availableVersion);
              }
              hasFailed = true;
            }
            contentNegotiationResult.version = versionNegotiated;
          } else {
            contentNegotiationResult.version = availableVersions[0];
          }
        }
        const { availableEncodings } = route;
        if (availableEncodings.length) {
          fetchSecondArg.injectResponseHeader("vary", "accept-encoding");
          if (request.headers["accept-encoding"]) {
            const encodingNegotiated = pickContentEncoding(
              request,
              availableEncodings,
            );
            if (!encodingNegotiated) {
              for (const availableEncoding of availableEncodings) {
                wouldHaveMatched.responseEncodingSet.add(availableEncoding);
              }
              hasFailed = true;
            }
            contentNegotiationResult.encoding = encodingNegotiated;
          } else {
            contentNegotiationResult.encoding = availableEncodings[0];
          }
        }
        if (hasFailed) {
          continue;
        }
      }
      const { named, stars = [] } = PATTERN.composeTwoMatchResults(
        resourceMatchResult,
        headersMatchResult,
      );
      Object.assign(request.params, named, stars);
      fetchSecondArg.contentNegotiation = contentNegotiationResult;
      let fetchReturnValue = route.fetch(request, fetchSecondArg);
      if (
        fetchReturnValue !== null &&
        typeof fetchReturnValue === "object" &&
        typeof fetchReturnValue.then === "function"
      ) {
        fetchReturnValue = await fetchReturnValue;
      }
      // route decided not to handle in the end
      if (fetchReturnValue === null || fetchReturnValue === undefined) {
        continue;
      }
      onRouteMatch(route);
      if (fetchReturnValue instanceof Response) {
        const headers = Object.fromEntries(fetchReturnValue.headers);
        onResponseHeaders(request, route, headers);
        return {
          status: fetchReturnValue.status,
          statusText: fetchReturnValue.statusText,
          headers,
          body: fetchReturnValue.body,
        };
      }
      if (fetchReturnValue !== null && typeof fetchReturnValue === "object") {
        const headers = fetchReturnValue.headers || {};
        onResponseHeaders(request, route, headers);
        return {
          status: fetchReturnValue.status || 404,
          statusText: fetchReturnValue.statusText,
          statusMessage: fetchReturnValue.statusMessage,
          headers,
          body: fetchReturnValue.body,
        };
      }
      throw new TypeError(
        `response must be a Response, or an Object, received ${fetchReturnValue}`,
      );
    }
    // nothing has matched fully
    // if nothing matches at all we'll send 404
    // but if url matched but METHOD was not supported we send 405
    if (wouldHaveMatched.methodSet.size) {
      return createMethodNotAllowedResponse(request, {
        allowedMethods: [...wouldHaveMatched.methodSet],
      });
    }
    if (wouldHaveMatched.requestMediaTypeSet.size) {
      return createUnsupportedMediaTypeResponse(request, {
        acceptedMediaTypes: [...wouldHaveMatched.requestMediaTypeSet],
      });
    }
    if (
      wouldHaveMatched.responseMediaTypeSet.size ||
      wouldHaveMatched.responseLanguageSet.size ||
      wouldHaveMatched.responseVersionSet.size ||
      wouldHaveMatched.responseEncodingSet.size
    ) {
      return createNotAcceptableResponse(request, {
        availableMediaTypes: [...wouldHaveMatched.responseMediaTypeSet],
        availableLanguages: [...wouldHaveMatched.responseLanguageSet],
        availableVersions: [...wouldHaveMatched.responseVersionSet],
        availableEncodings: [...wouldHaveMatched.responseEncodingSet],
      });
    }
    if (wouldHaveMatched.upgrade) {
      return {
        status: 426,
        statusText: "Upgrade Required",
        statusMessage: `The request requires the upgrade to a webSocket connection`,
      };
    }
    constructAvailableEndpoints();
    return createRouteNotFoundResponse(request);
  };
  const inspect = () => {
    // I want all the info I can gather about the routes
    const data = [];
    for (const route of routeSet) {
      data.push(route.toJSON());
    }
    return data;
  };

  if (optionsFallback) {
    const optionRouteFallback = createRoute({
      endpoint: "OPTIONS *",
      description:
        "Auto generate an OPTIONS response about a resource or the whole server.",
      declarationSource: import.meta.url,
      fetch: (request, helpers) => {
        const isForAnyRoute = request.resource === "*";
        if (isForAnyRoute) {
          const serverOPTIONS = inferServerOPTIONS();
          return createServerResourceOptionsResponse(request, serverOPTIONS);
        }
        const resourceOPTIONS = inferResourceOPTIONS(request);
        return createResourceOptionsResponse(request, resourceOPTIONS);
      },
      isFallback: true,
    });
    routeSet.add(optionRouteFallback);
  }

  Object.assign(router, {
    match,
    inspect,
  });
  return router;
};

/**
 * Adds a route to the router.
 *
 * @param {Object} params - Route configuration object
 * @param {string} params.endpoint - String in format "METHOD /resource/path" (e.g. "GET /users/:id")
 * @param {Object} [params.headers] - Optional headers pattern to match
 * @param {Array<string>} [params.availableMediaTypes=[]] - Content types this route can produce
 * @param {Array<string>} [params.availableLanguages=[]] - Languages this route can respond with
 * @param {Array<string>} [params.availableEncodings=[]] - Encodings this route supports
 * @param {Array<string>} [params.acceptedMediaTypes=[]] - Content types this route accepts (for POST/PATCH/PUT)
 * @param {Function} params.fetch - Function to generate response for matching requests
 * @throws {TypeError} If endpoint is not a string
 * @returns {void}
 */
const createRoute = ({
  endpoint,
  description,
  headers,
  service,
  availableMediaTypes = [],
  availableLanguages = [],
  availableVersions = [],
  availableEncodings = [],
  acceptedMediaTypes = [], // useful only for POST/PATCH/PUT
  fetch: routeFetchMethod, // rename because there is global.fetch and we want to be explicit
  clientCodeExample,
  isFallback,
  subroutes,
  declarationSource,
}) => {
  if (!endpoint || typeof endpoint !== "string") {
    throw new TypeError(`endpoint must be a string, received ${endpoint}`);
  }
  const [method, resource] = endpoint === "*" ? ["* *"] : endpoint.split(" ");
  if (method !== "*" && !HTTP_METHODS.includes(method)) {
    throw new TypeError(`"${method}" is not an HTTP method`);
  }
  if (resource[0] !== "/" && resource[0] !== "*") {
    throw new TypeError(`resource must start with /, received ${resource}`);
  }
  if (typeof routeFetchMethod !== "function") {
    throw new TypeError(
      `fetch must be a function, received ${routeFetchMethod} on endpoint "${endpoint}"`,
    );
  }
  const extension = resourceToExtension(resource);
  const extensionWellKnownContentType = extension
    ? CONTENT_TYPE.fromExtension(extension)
    : null;
  if (
    availableMediaTypes.length === 0 &&
    extensionWellKnownContentType &&
    extensionWellKnownContentType !== "application/octet-stream" // this is the default extension
  ) {
    availableMediaTypes.push(extensionWellKnownContentType);
  }
  const resourcePattern = createResourcePattern(resource);
  const headersPattern = headers ? createHeadersPattern(headers) : null;

  const isForWebSocket =
    (headers && headers["upgrade"] === "websocket") ||
    extension === ".websocket";

  const route = {
    method,
    resource,
    description,
    service,
    availableMediaTypes,
    availableLanguages,
    availableVersions,
    availableEncodings,
    acceptedMediaTypes,
    matchMethod:
      method === "*" ? () => true : (requestMethod) => requestMethod === method,
    matchResource:
      resource === "*"
        ? () => true
        : (requestResource) => {
            return resourcePattern.match(requestResource);
          },
    matchHeaders:
      headers === undefined
        ? () => true
        : (requestHeaders) => {
            return headersPattern.match(requestHeaders);
          },
    fetch: routeFetchMethod,
    toString: () => {
      return `${method} ${resource}`;
    },
    toJSON: () => {
      const meta = {};

      if (declarationSource) {
        meta.declarationLink = {
          url: `javascript:window.fetch("/.internal/open_file/${encodeURIComponent(declarationSource)}")`,
          text: declarationSource,
        };

        const packageDirectory = lookupPackageDirectory(declarationSource);
        if (packageDirectory) {
          const packageFileUrl = new URL("package.json", packageDirectory);
          try {
            const packageFileText = readFileSync(packageFileUrl, "utf8");
            const packageJson = JSON.parse(packageFileText);
            const packageName = packageJson.name;
            if (packageJson.name) {
              meta.packageName = packageName;
              meta.ownerLink = {
                url: `javascript:window.fetch("/.internal/open_file/${encodeURIComponent(packageFileUrl)}")`,
                text: packageName,
              };
              const declarationUrlRelativeToOwnerPackage = urlToRelativeUrl(
                declarationSource,
                packageFileUrl,
              );
              meta.declarationLink.text = `${packageName}/${declarationUrlRelativeToOwnerPackage}`;
            }
          } catch {}
        }
      }

      return {
        method,
        resource,
        description,
        availableMediaTypes,
        availableLanguages,
        availableVersions,
        availableEncodings,
        acceptedMediaTypes,
        isForWebSocket,
        clientCodeExample:
          typeof clientCodeExample === "function"
            ? parseFunction(clientCodeExample).body
            : typeof clientCodeExample === "string"
              ? clientCodeExample
              : undefined,
        declarationSource,
        meta,
      };
    },
    resourcePattern,
    isForWebSocket,
    isFallback,
    subroutes,
  };
  return route;
};

const isRequestBodyMediaTypeSupported = (request, { acceptedMediaTypes }) => {
  const requestBodyContentType = request.headers["content-type"];
  if (!requestBodyContentType) {
    return false;
  }
  for (const acceptedMediaType of acceptedMediaTypes) {
    if (requestBodyContentType.includes(acceptedMediaType)) {
      return true;
    }
  }
  return false;
};

const createServerResourceOptionsResponse = (
  request,
  { server, resourceOptionsMap },
) => {
  const headers = server.asResponseHeaders();
  const mediaTypeNegotiated = pickContentType(request, [
    "application/json",
    "text/plain",
  ]);
  if (mediaTypeNegotiated === "application/json") {
    const perResource = {};
    for (const [resource, resourceOptions] of resourceOptionsMap) {
      perResource[resource] = resourceOptions.toJSON();
    }
    return Response.json(
      {
        server: server.toJSON(),
        perResource,
      },
      { status: 200, headers },
    );
  }
  // text/plain
  return new Response(
    `The list of endpoints available can be seen at ${routeInspectorUrl}`,
    { status: 200, headers },
  );
};
const createResourceOptionsResponse = (request, resourceOptions) => {
  const headers = resourceOptions.asResponseHeaders();
  return new Response(undefined, { status: 204, headers });
};

/**
 * Creates a 406 Not Acceptable response when content negotiation fails
 *
 * @param {Object} request - The HTTP request object
 * @param {Object} params - Content negotiation parameters
 * @param {Array<string>} params.availableMediaTypes - Content types the server can produce
 * @param {Array<string>} params.availableLanguages - Languages the server can respond with
 * @param {Array<string>} params.availableEncodings - Encodings the server supports
 * @returns {Response} A 406 Not Acceptable response
 */
const createNotAcceptableResponse = (
  request,
  {
    availableMediaTypes,
    availableLanguages,
    availableVersions,
    availableEncodings,
  },
) => {
  const unsupported = [];
  const headers = {};
  const data = {};

  if (availableMediaTypes.length) {
    const requestAcceptHeader = request.headers["accept"];

    // Use a non-standard but semantic header name
    headers["available-media-types"] = availableMediaTypes.join(", ");

    Object.assign(data, {
      requestAcceptHeader,
      availableMediaTypes,
    });

    unsupported.push({
      type: "content-type",
      message: `The server cannot produce a response in any of the media types accepted by the request: "${requestAcceptHeader}".
Available media types: ${availableMediaTypes.join(", ")}.`,
    });
  }
  if (availableLanguages.length) {
    const requestAcceptLanguageHeader = request.headers["accept-language"];

    // Use a non-standard but semantic header name
    headers["available-languages"] = availableLanguages.join(", ");

    Object.assign(data, {
      requestAcceptLanguageHeader,
      availableLanguages,
    });

    unsupported.push({
      type: "language",
      message: `The server cannot produce a response in any of the languages accepted by the request: "${requestAcceptLanguageHeader}".
Available languages: ${availableLanguages.join(", ")}.`,
    });
  }
  if (availableVersions.length) {
    const requestAcceptVersionHeader = request.headers["accept-version"];

    // Use a non-standard but semantic header name
    headers["available-versions"] = availableVersions.join(", ");

    Object.assign(data, {
      requestAcceptVersionHeader,
      availableLanguages,
    });

    unsupported.push({
      type: "version",
      message: `The server cannot produce a response in any of the versions accepted by the request: "${requestAcceptVersionHeader}".
Available versions: ${availableVersions.join(", ")}.`,
    });
  }
  if (availableEncodings.length) {
    const requestAcceptEncodingHeader = request.headers["accept-encoding"];

    // Use a non-standard but semantic header name
    headers["available-encodings"] = availableEncodings.join(", ");

    Object.assign(data, {
      requestAcceptEncodingHeader,
      availableEncodings,
    });

    unsupported.push({
      type: "encoding",
      message: `The server cannot encode the response in any of the encodings accepted by the request: "${requestAcceptEncodingHeader}".
Available encodings: ${availableEncodings.join(", ")}.`,
    });
  }

  // Special case for single negotiation failure
  if (unsupported.length === 1) {
    const [{ message }] = unsupported;
    return {
      status: 406,
      statusText: "Not Acceptable",
      statusMessage: message,
      headers,
    };
  }
  // Handle multiple negotiation failures
  let message = `The server cannot produce a response in a format acceptable to the client:`;
  for (const info of unsupported) {
    message += `\n- ${info.type} ${info.message}`;
  }
  return {
    status: 406,
    statusText: "Not Acceptable",
    statusMessage: message,
    headers,
  };
};
const createMethodNotAllowedResponse = (
  request,
  { allowedMethods = [] } = {},
) => {
  return {
    status: 405,
    statusText: "Method Not Allowed",
    statusmessage: `The HTTP method "${request.method}" is not supported for this resource.
Allowed methods: ${allowedMethods.join(", ")}`,
    headers: {
      allow: allowedMethods.join(", "),
    },
  };
};
const createUnsupportedMediaTypeResponse = (
  request,
  { acceptedMediaTypes },
) => {
  const requestContentType = request.headers["content-type"];
  const methodSpecificHeader =
    request.method === "POST"
      ? "accept-post"
      : request.method === "PATCH"
        ? "accept-patch"
        : "accept";
  const headers = {
    [methodSpecificHeader]: acceptedMediaTypes.join(", "),
  };
  const requestMethod = request.method;

  return {
    status: 415,
    statusText: "Unsupported Media Type",
    statusMessage: requestContentType
      ? `The media type "${requestContentType}" specified in the Content-Type header is not supported for ${requestMethod} requests to this resource.
    Supported media types: ${acceptedMediaTypes.join(", ")}`
      : `The Content-Type header is missing. It must be declared for ${requestMethod} requests to this resource.`,
    headers,
  };
};
const createRouteNotFoundResponse = (request) => {
  return {
    status: 404,
    statusText: "Not Found",
    statusMessage: `The URL ${request.resource} does not exist on this server.
The list of existing endpoints is available at ${routeInspectorUrl}.`,
    headers: {},
  };
};

// to predict order in chrome devtools we should put a,b,c,d,e or something
// because in chrome dev tools they are shown in alphabetic order
// also we should manipulate a timing object instead of a header to facilitate
// manipulation of the object so that the timing header response generation logic belongs to @jsenv/server
// so response can return a new timing object
// yes it's awful, feel free to PR with a better approach :)
const timingToServerTimingResponseHeaders = (timing) => {
  const serverTimingHeader = {};
  Object.keys(timing).forEach((key, index) => {
    const name = letters[index] || "zz";
    serverTimingHeader[name] = {
      desc: key,
      dur: timing[key],
    };
  });
  const serverTimingHeaderString =
    stringifyServerTimingHeader(serverTimingHeader);

  return { "server-timing": serverTimingHeaderString };
};

const stringifyServerTimingHeader = (serverTimingHeader) => {
  return stringifyMultipleHeader(serverTimingHeader, {
    validateName: validateServerTimingName,
  });
};

// (),/:;<=>?@[\]{}" Don't allowed
// Minimal length is one symbol
// Digits, alphabet characters,
// and !#$%&'*+-.^_`|~ are allowed
// https://www.w3.org/TR/2019/WD-server-timing-20190307/#the-server-timing-header-field
// https://tools.ietf.org/html/rfc7230#section-3.2.6
const validateServerTimingName = (name) => {
  const valid = /^[!#$%&'*+\-.^_`|~0-9a-z]+$/i.test(name);
  if (!valid) {
    console.warn(`server timing contains invalid symbols`);
    return false;
  }
  return true;
};

const letters = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
];

const HOOK_NAMES = [
  "serverListening",
  "redirectRequest",
  "augmentRouteFetchSecondArg",
  "routes",
  "handleError",
  "onResponsePush",
  "injectResponseProperties",
  "serverStopped",
];

const createServiceController = (services) => {
  const hookSetMap = new Map();

  const addHook = (hook) => {
    let hookSet = hookSetMap.get(hook.name);
    if (!hookSet) {
      hookSet = new Set();
      hookSetMap.set(hook.name, hookSet);
    }
    hookSet.add(hook);
  };

  const addService = (service) => {
    for (const key of Object.keys(service)) {
      if (key === "name") continue;
      const isHook = HOOK_NAMES.includes(key);
      if (!isHook) {
        console.warn(
          `Unexpected "${key}" property on "${service.name}" service`,
        );
      }
      const hookName = key;
      const hookValue = service[hookName];
      if (!hookValue) {
        continue;
      }
      if (hookName === "routes") ; else {
        addHook({
          service,
          name: hookName,
          value: hookValue,
        });
      }
    }
  };

  for (const service of services) {
    addService(service);
  }

  let currentService = null;
  let currentHookName = null;
  const callHook = (hook, info, context) => {
    const hookFn = getHookFunction(hook, info);
    if (!hookFn) {
      return null;
    }
    currentService = hook.service;
    currentHookName = hook.name;
    let valueReturned = hookFn(info, context);
    currentService = null;
    currentHookName = null;
    return valueReturned;
  };
  const callAsyncHook = async (hook, info, context) => {
    const hookFn = getHookFunction(hook, info);
    if (!hookFn) {
      return null;
    }
    currentService = hook.service;
    currentHookName = hook.name;
    let valueReturned = await hookFn(info, context);
    currentService = null;
    currentHookName = null;
    return valueReturned;
  };

  const callHooks = (hookName, info, context, callback = () => {}) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return;
    }
    for (const hook of hookSet) {
      const returnValue = callHook(hook, info, context);
      if (returnValue) {
        callback(returnValue);
      }
    }
  };
  const callAsyncHooks = async (hookName, info, context, callback) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return;
    }
    for (const hook of hookSet) {
      const returnValue = await callAsyncHook(hook, info, context);
      if (returnValue && callback) {
        await callback(returnValue, hook.plugin);
      }
    }
  };
  const callHooksUntil = (
    hookName,
    info,
    context,
    until = (returnValue) => returnValue,
  ) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return null;
    }
    for (const hook of hookSet) {
      const returnValue = callHook(hook, info, context);
      const untilReturnValue = until(returnValue);
      if (untilReturnValue) {
        return untilReturnValue;
      }
    }
    return null;
  };
  const callAsyncHooksUntil = async (hookName, info, context) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return null;
    }
    if (hookSet.size === 0) {
      return null;
    }
    const iterator = hookSet.values()[Symbol.iterator]();
    let result;
    const visit = async () => {
      const { done, value: hook } = iterator.next();
      if (done) {
        return;
      }
      const returnValue = await callAsyncHook(hook, info, context);
      if (returnValue) {
        result = returnValue;
        return;
      }
      await visit();
    };
    await visit();
    return result;
  };

  return {
    services,

    callHooks,
    callHooksUntil,
    callAsyncHooks,
    callAsyncHooksUntil,

    getCurrentService: () => currentService,
    getCurrentHookName: () => currentHookName,
  };
};

const getHookFunction = (hook, info) => {
  const hookValue = hook.value;
  if (hook.name === "handleRequest" && typeof hookValue === "object") {
    const request = info;
    const hookForMethod = hookValue[request.method] || hookValue["*"];
    if (!hookForMethod) {
      return null;
    }
    return hookForMethod;
  }
  return hookValue;
};

const flattenAndFilterServices = (services) => {
  const flatServices = [];
  const visitServiceEntry = (serviceEntry) => {
    if (Array.isArray(serviceEntry)) {
      serviceEntry.forEach((value) => visitServiceEntry(value));
      return;
    }
    if (typeof serviceEntry === "object" && serviceEntry !== null) {
      if (!serviceEntry.name) {
        serviceEntry.name = "anonymous";
      }
      flatServices.push(serviceEntry);
      return;
    }
    throw new Error(`services must be objects, got ${serviceEntry}`);
  };
  services.forEach((serviceEntry) => visitServiceEntry(serviceEntry));
  return flatServices;
};

/**
 * The standard ways to create a Response
 * - new Response(body, init)
 * - Response.json(data, init)
 * Here we need a way to tell: I want to handle websocket
 * to align with the style of new Response and Response.json to make it look as follow:
 * ```js
 * import { WebSocketResponse } from "@jsenv/server"
 * new WebSocketResponse((websocket) => {
 *   // do stuff with the websocket
 * })
 * ```
 *
 * But we don't really need a class so we are just returning a regular object under the hood
 */

class WebSocketResponse {
  constructor(
    webSocketHandler,
    {
      status = 101,
      statusText = status === 101 ? "Switching Protocols" : undefined,
      headers,
    } = {},
  ) {
    const webSocketResponse = {
      status,
      statusText,
      headers,
      body: {
        websocket: webSocketHandler,
      },
    };
    // eslint-disable-next-line no-constructor-return
    return webSocketResponse;
  }
}

const getWebSocketHandler = (responseProperties) => {
  const responseBody = responseProperties.body;
  if (!responseBody) {
    return undefined;
  }
  const webSocketHandler = responseBody.websocket;
  return webSocketHandler;
};

/**
 * https://www.html5rocks.com/en/tutorials/eventsource/basics/
 *
 */


/**
 * Creates a Server-Sent Events controller that manages client connections and event distribution.
 * Supports both SSE (EventSource) and WebSocket connections with automatic event history tracking.
 *
 * @class
 * @param {Object} options - Configuration options for the SSE controller
 * @param {String} [options.logLevel] - Controls logging verbosity ('debug', 'info', 'warn', 'error', etc.)
 * @param {Boolean} [options.keepProcessAlive=false] - If true, prevents Node.js from exiting while SSE connections are active
 * @param {Number} [options.keepaliveDuration=30000] - Milliseconds between keepalive messages to prevent connection timeout
 * @param {Number} [options.retryDuration=1000] - Suggested client reconnection delay in milliseconds
 * @param {Number} [options.historyLength=1000] - Maximum number of events to keep in history for reconnecting clients
 * @param {Number} [options.maxClientAllowed=100] - Maximum number of concurrent client connections allowed
 * @param {Function} [options.computeEventId] - Function to generate event IDs, receives (event, lastEventId) and returns new ID
 * @param {Boolean} [options.welcomeEventEnabled=false] - Whether to send a welcome event to new clients
 * @param {Boolean} [options.welcomeEventPublic=false] - If true, welcome events are broadcast to all clients, not just the new one
 * @param {String} [options.actionOnClientLimitReached='refuse'] - Action when client limit is reached ('refuse' or 'kick-oldest')
 *
 * @returns {Object} SSE controller with the following methods:
 * @returns {Function} .sendEventToAllClients - Sends an event to all connected clients
 * @returns {Function} .fetch - Handles HTTP requests and upgrades them to SSE/WebSocket connections
 * @returns {Function} .getAllEventSince - Retrieves events since a specific ID
 * @returns {Function} .getClientCount - Returns the number of connected clients
 * @returns {Function} .close - Closes all connections and stops the controller
 * @returns {Function} .open - Reopens the controller after closing
 *
 * @example
 * import { ServerEvents } from "@jsenv/server";
 *
 * const serverEvents = new ServerEvents({
 *   welcomeEventEnabled: true,
 *   historyLength: 50
 * });
 *
 * // Send events to all connected clients
 * serverEvents.sendEventToAllClients({
 *   type: "update",
 *   data: JSON.stringify({ timestamp: Date.now() })
 * });
 *
 * // Use in server route
 * {
 *   endpoint: "GET /events",
 *   response: (request) => serverEvents.fetch(request)
 * }
 */
class ServerEvents {
  constructor(...args) {
    // eslint-disable-next-line no-constructor-return
    return createServerEvents(...args);
  }
}

/**
 * Creates a minimal Server-Sent Events controller that exposes only the fetch method
 * to handle client connections, keeping other controller methods private.
 *
 * This is useful when you want to provide a minimal API surface and ensure
 * the events can only be pushed through a given function.
 *
 * @class
 * @param {Function} producer - Function called when first client connects
 * @param {Object} [options] - Configuration options for the SSE controller
 * @param {String} [options.logLevel] - Controls logging verbosity ('debug', 'info', 'warn', 'error', etc.)
 * @param {Boolean} [options.keepProcessAlive=false] - If true, prevents Node.js from exiting while SSE connections are active
 * @param {Number} [options.keepaliveDuration=30000] - Milliseconds between keepalive messages to prevent connection timeout
 * @param {Number} [options.retryDuration=1000] - Suggested client reconnection delay in milliseconds
 * @param {Number} [options.historyLength=1000] - Maximum number of events to keep in history for reconnecting clients
 * @param {Number} [options.maxClientAllowed=100] - Maximum number of concurrent client connections allowed
 * @param {Function} [options.computeEventId] - Function to generate event IDs, receives (event, lastEventId) and returns new ID
 * @param {Boolean} [options.welcomeEventEnabled=false] - Whether to send a welcome event to new clients
 * @param {Boolean} [options.welcomeEventPublic=false] - If true, welcome events are broadcast to all clients, not just the new one
 * @param {String} [options.actionOnClientLimitReached='refuse'] - Action when client limit is reached ('refuse' or 'kick-oldest')
 *
 * @returns {Object} An object with only the fetch method to handle client connections
 *
 * @example
 * import { LazyServerEvents } from "@jsenv/server";
 *
 * // Events can only be sent through the producer function
 * const events = new LazyServerEvents((api) => {
 *   console.log("First client connected");
 *
 *   // Setup interval, database watchers, etc.
 *   const interval = setInterval(() => {
 *     api.sendEvent({
 *       type: "tick",
 *       data: new Date().toISOString()
 *     });
 *   }, 1000);
 *
 *   // Return cleanup function that runs when last client disconnects
 *   return () => {
 *     console.log("Last client disconnected");
 *     clearInterval(interval);
 *   };
 * });
 *
 * // Use in server route
 * {
 *   endpoint: "GET /events",
 *   response: (request) => events.fetch(request)
 * }
 */
class LazyServerEvents {
  constructor(producer, options = {}) {
    const serverEvents = createServerEvents({
      producer,
      ...options,
    });
    // eslint-disable-next-line no-constructor-return
    return {
      fetch: serverEvents.fetch,
    };
  }
}

const createServerEvents = ({
  producer,
  logLevel,
  // do not keep process alive because of event source, something else must keep it alive
  keepProcessAlive = false,
  keepaliveDuration = 30 * 1000,
  retryDuration = 1 * 1000,
  historyLength = 1 * 1000,
  maxClientAllowed = 100, // max 100 clients accepted
  computeEventId = (event, lastEventId) => lastEventId + 1,
  welcomeEventEnabled = false,
  welcomeEventPublic = false,
  actionOnClientLimitReached = "refuse",
} = {}) => {
  const logger = createLogger({ logLevel });

  const serverEventSource = {
    closed: false,
  };
  const clientArray = [];
  const eventHistory = createEventHistory(historyLength);
  // what about previousEventId that keeps growing ?
  // we could add some limit
  // one limit could be that an event older than 24h is deleted
  let previousEventId = 0;
  let interval;
  let producerReturnValue;

  const addClient = (client) => {
    if (clientArray.length === 0) {
      if (typeof producer === "function") {
        producerReturnValue = producer({
          sendEvent: sendEventToAllClients,
        });
      }
    }
    clientArray.push(client);
    logger.debug(
      `A client has joined. Number of client: ${clientArray.length}`,
    );
    if (client.lastKnownId !== undefined) {
      const previousEvents = getAllEventSince(client.lastKnownId);
      const eventMissedCount = previousEvents.length;
      if (eventMissedCount > 0) {
        logger.info(
          `send ${eventMissedCount} event missed by client since event with id "${client.lastKnownId}"`,
        );
        for (const previousEvent of previousEvents) {
          client.sendEvent(previousEvent);
        }
      }
    }
    if (welcomeEventEnabled) {
      const welcomeEvent = {
        retry: retryDuration,
        type: "welcome",
        data: new Date().toLocaleTimeString(),
      };
      addEventToHistory(welcomeEvent);

      // send to everyone
      if (welcomeEventPublic) {
        sendEventToAllClients(welcomeEvent, {
          history: false,
        });
      }
      // send only to this client
      else {
        client.sendEvent(welcomeEvent);
      }
    } else {
      const firstEvent = {
        retry: retryDuration,
        type: "comment",
        data: new Date().toLocaleTimeString(),
      };
      client.sendEvent(firstEvent);
    }
  };
  const removeClient = (client) => {
    const index = clientArray.indexOf(client);
    if (index === -1) {
      return;
    }
    clientArray.splice(index, 1);
    logger.debug(`A client left. Number of client: ${clientArray.length}`);
    if (clientArray.length === 0) {
      if (typeof producerReturnValue === "function") {
        producerReturnValue();
        producerReturnValue = undefined;
      }
    }
  };

  const fetch = (request) => {
    const isWebsocketUpgradeRequest =
      request.headers["upgrade"] === "websocket";
    const isEventSourceRequest = isWebsocketUpgradeRequest
      ? false
      : request.headers["accept"] &&
        request.headers["accept"].includes("text/event-stream");
    if (!isWebsocketUpgradeRequest && !isEventSourceRequest) {
      return {
        status: 400,
        body: "Bad Request, this endpoint only accepts WebSocket or EventSource requests",
      };
    }

    if (clientArray.length >= maxClientAllowed) {
      if (actionOnClientLimitReached === "refuse") {
        return {
          status: 503,
        };
      }
      // "kick-oldest"
      const oldestClient = clientArray.shift();
      oldestClient.close();
    }

    if (serverEventSource.closed) {
      return {
        status: 204,
      };
    }

    const lastKnownId =
      request.headers["last-event-id"] ||
      request.searchParams.get("last-event-id");
    if (isWebsocketUpgradeRequest) {
      return new WebSocketResponse((websocket) => {
        const webSocketClient = {
          type: "websocket",
          lastKnownId,
          request,
          websocket,
          sendEvent: (event) => {
            websocket.send(JSON.stringify(event));
          },
          close: () => {
            websocket.close();
          },
        };
        addClient(webSocketClient);
        return () => {
          removeClient(webSocketClient);
        };
      });
    }
    // event source request
    return {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        "connection": "keep-alive",
      },
      body: createObservable(({ next, complete, addTeardown }) => {
        const client = {
          type: "event_source",
          lastKnownId,
          request,
          sendEvent: (event) => {
            next(stringifySourceEvent(event));
          },
          close: () => {
            complete(); // will terminate the http connection as body ends
          },
        };
        addClient(client);
        addTeardown(() => {
          removeClient(client);
        });
      }),
    };
  };

  const addEventToHistory = (event) => {
    if (typeof event.id === "undefined") {
      event.id = computeEventId(event, previousEventId);
    }
    previousEventId = event.id;
    eventHistory.add(event);
  };

  const sendEventToAllClients = (event, { history = true } = {}) => {
    if (history) {
      addEventToHistory(event);
    }
    logger.debug(`send "${event.type}" event to ${clientArray.size} client(s)`);
    for (const client of clientArray) {
      client.sendEvent(event);
    }
  };

  const getAllEventSince = (id) => {
    const events = eventHistory.since(id);
    if (welcomeEventEnabled && !welcomeEventPublic) {
      return events.filter((event) => event.type !== "welcome");
    }
    return events;
  };

  const keepAlive = () => {
    // maybe that, when an event occurs, we can delay the keep alive event
    logger.debug(
      `send keep alive event, number of client listening this event source: ${clientArray.length}`,
    );
    sendEventToAllClients(
      {
        type: "comment",
        data: new Date().toLocaleTimeString(),
      },
      { history: false },
    );
  };

  const open = () => {
    if (!serverEventSource.closed) {
      return;
    }
    interval = setInterval(keepAlive, keepaliveDuration);
    if (!keepProcessAlive) {
      interval.unref();
    }
    serverEventSource.closed = false;
  };

  const close = () => {
    if (serverEventSource.closed) {
      return;
    }
    logger.debug(`closing, number of client : ${clientArray.length}`);
    for (const client of clientArray) {
      client.close();
    }
    clientArray.length = 0;
    clearInterval(interval);
    eventHistory.reset();
    serverEventSource.closed = true;
  };

  Object.assign(serverEventSource, {
    // main api:
    // - ability to sendEvent to clients in the room
    // - ability to join the room
    // - ability to leave the room
    sendEventToAllClients,
    fetch,

    // should rarely be necessary, get information about the room
    getAllEventSince,
    getClientCount: () => clientArray.length,

    // should rarely be used
    close,
    open,
  });
  return serverEventSource;
};

// https://github.com/dmail-old/project/commit/da7d2c88fc8273850812972885d030a22f9d7448
// https://github.com/dmail-old/project/commit/98b3ae6748d461ac4bd9c48944a551b1128f4459
// https://github.com/dmail-old/http-eventsource/blob/master/lib/event-source.js
// http://html5doctor.com/server-sent-events/
const stringifySourceEvent = ({ data, type = "message", id, retry }) => {
  let string = "";

  if (id !== undefined) {
    string += `id:${id}\n`;
  }

  if (retry) {
    string += `retry:${retry}\n`;
  }

  if (type !== "message") {
    string += `event:${type}\n`;
  }

  string += `data:${data}\n\n`;

  return string;
};

const createEventHistory = (limit) => {
  const events = [];

  const add = (data) => {
    events.push(data);

    if (events.length >= limit) {
      events.shift();
    }
  };

  const since = (id) => {
    const index = events.findIndex((event) => String(event.id) === id);
    return index === -1 ? [] : events.slice(index + 1);
  };

  const reset = () => {
    events.length = 0;
  };

  return { add, since, reset };
};

const jsenvServiceAutoreloadOnRestart = () => {
  const aliveServerEvents = new LazyServerEvents(() => {});

  return {
    name: "jsenv:autoreload_on_server_restart",

    routes: [
      {
        endpoint: "GET /.internal/alive.websocket",
        description:
          "Client can connect to this websocket endpoint to detect when server connection is lost.",
        declarationSource: import.meta.url,
        /* eslint-disable no-undef */
        clientCodeExample: () => {
          const websocket = new WebSocket(
            "ws://localhost/.internal/alive.websocket",
          );
          websocket.onclose = () => {
            // server connection closed
            window.location.reload();
          };
        },
        fetch: aliveServerEvents.fetch,
      },
      {
        endpoint: "GET /.internal/alive.eventsource",
        description: `Client can connect to this eventsource endpoint to detect when server connection is lost.
This endpoint exists mostly to demo eventsource as there is already the websocket endpoint.`,
        declarationSource: import.meta.url,
        /* eslint-disable no-undef */
        clientCodeExample: async () => {
          const eventSource = new EventSource("/.internal/alive.eventsource");
          eventSource.onerror = () => {
            // server connection closed
            window.location.reload();
          };
        },
        /* eslint-enable no-undef */
        fetch: aliveServerEvents.fetch,
      },
    ],
  };
};

const replacePlaceholdersInHtml = (html, replacers) => {
  return html.replace(/\$\{(\w+)\}/g, (match, name) => {
    const replacer = replacers[name];
    if (replacer === undefined) {
      return match;
    }
    if (typeof replacer === "function") {
      return replacer();
    }
    return replacer;
  });
};

const clientErrorHtmlTemplateFileUrl = import.meta.resolve("./client/default_body_4xx_5xx/4xx.html");

const jsenvServiceDefaultBody4xx5xx = () => {
  return {
    name: "jsenv:default_body_4xx_5xx",

    injectResponseProperties: (request, responseProperties) => {
      if (responseProperties.body !== undefined) {
        return null;
      }
      if (responseProperties.status >= 400 && responseProperties.status < 500) {
        return generateBadStatusResponse(request, responseProperties);
      }
      if (responseProperties.status >= 500 && responseProperties.status < 600) {
        return generateBadStatusResponse(request, responseProperties);
      }
      return null;
    },
  };
};

const generateBadStatusResponse = (
  request,
  { status, statusText, statusMessage },
) => {
  const contentTypeNegotiated = pickContentType(request, [
    "text/html",
    "text/plain",
    "application/json",
  ]);
  if (contentTypeNegotiated === "text/html") {
    const htmlTemplate = readFileSync(
      new URL(clientErrorHtmlTemplateFileUrl),
      "utf8",
    );
    if (statusMessage) {
      statusMessage = statusMessage.replace(/https?:\/\/\S+/g, (url) => {
        return `<a href="${url}">${url}</a>`;
      });
      statusMessage = statusMessage.replace(
        /(^|\s)(\/\S+)/g,
        (match, startOrSpace, resource) => {
          let end = "";
          if (resource[resource.length - 1] === ".") {
            resource = resource.slice(0, -1);
            end = ".";
          }
          return `${startOrSpace}<a href="${resource}">${resource}</a>${end}`;
        },
      );
      statusMessage = statusMessage.replace(/\r\n|\r|\n/g, "<br />");
    }

    const html = replacePlaceholdersInHtml(htmlTemplate, {
      status,
      statusText,
      statusMessage: statusMessage || "",
    });
    return new Response(html, {
      headers: { "content-type": "text/html" },
      status,
      statusText,
    });
  }
  if (contentTypeNegotiated === "text/plain") {
    return new Response(statusMessage, {
      status,
      statusText,
    });
  }
  return Response.json(
    { statusMessage },
    {
      status,
      statusText,
    },
  );
};

const jsenvServerRootDirectoryUrl = import.meta.resolve("./");

const jsenvServiceInternalClientFiles = () => {
  return {
    name: "jsenv:internal_client_files",

    routes: [
      {
        endpoint: "GET /@jsenv/server/*",
        description: "Serve @jsenv/server internal files.",
        availableMediaTypes: ["text/javascript"],
        declarationSource: import.meta.url,
        fetch: (request) => {
          const path = request.params[0];
          const jsenvServerClientFileUrl = new URL(
            `./${path}`,
            jsenvServerRootDirectoryUrl,
          );
          const fileContent = readFileSync(jsenvServerClientFileUrl, "utf8");
          return new Response(fileContent, {
            headers: {
              "content-type": CONTENT_TYPE.fromUrlExtension(
                jsenvServerClientFileUrl,
              ),
            },
          });
        },
      },
    ],
  };
};

const jsenvServiceOpenFile = () => {
  return {
    name: "jsenv:open_file",
    routes: [
      {
        endpoint: "GET /.internal/open_file/*",
        description: "Can be used to open a given file in your editor.",
        declarationSource: import.meta.url,
        fetch: (request) => {
          let file = decodeURIComponent(request.params[0]);
          if (!file) {
            return {
              status: 400,
              body: "Missing file in url",
            };
          }
          let fileUrl;
          try {
            fileUrl = new URL(file);
          } catch {
            return {
              status: 400,
              body: `"${file}" is not a file url`,
            };
          }
          const filePath = urlToFileSystemPath(fileUrl);
          const require = createRequire(import.meta.url);
          const launch = require("launch-editor");
          launch(filePath, () => {
            // ignore error for now
          });
          return {
            status: 200,
            headers: {
              "cache-control": "no-store",
            },
          };
        },
      },
    ],
  };
};

const routeInspectorHtmlFileUrl = import.meta.resolve(
  "./client/route_inspector/route_inspector.html",
);

const jsenvServiceRouteInspector = () => {
  return {
    name: "jsenv:route_inspector",
    routes: [
      {
        endpoint: "GET /.internal/route_inspector",
        description:
          "Explore the routes available on this server using a web interface.",
        availableMediaTypes: ["text/html"],
        declarationSource: import.meta.url,
        fetch: () => {
          const inspectorHtml = readFileSync(
            new URL(routeInspectorHtmlFileUrl),
            "utf8",
          );
          return new Response(inspectorHtml, {
            headers: { "content-type": "text/html" },
          });
        },
      },
      {
        endpoint: "GET /.internal/routes.json",
        availableMediaTypes: ["application/json"],
        description: "Get the routes available on this server in JSON.",
        declarationSource: import.meta.url,
        fetch: (request, helpers) => {
          const routeJSON = helpers.router.inspect(request, helpers);
          return Response.json(routeJSON);
        },
      },
    ],
  };
};

const createReason = (reasonString) => {
  return {
    toString: () => reasonString,
  };
};

const STOP_REASON_INTERNAL_ERROR = createReason("Internal error");
const STOP_REASON_PROCESS_SIGHUP = createReason("process SIGHUP");
const STOP_REASON_PROCESS_SIGTERM = createReason("process SIGTERM");
const STOP_REASON_PROCESS_SIGINT = createReason("process SIGINT");
const STOP_REASON_PROCESS_BEFORE_EXIT = createReason(
  "process before exit",
);
const STOP_REASON_PROCESS_EXIT = createReason("process exit");
const STOP_REASON_NOT_SPECIFIED = createReason("not specified");

const applyDnsResolution = async (
  hostname,
  { verbatim = false } = {},
) => {
  const dnsResolution = await new Promise((resolve, reject) => {
    lookup(hostname, { verbatim }, (error, address, family) => {
      if (error) {
        reject(error);
      } else {
        resolve({ address, family });
      }
    });
  });
  return dnsResolution;
};

const parseHostname = (hostname) => {
  if (hostname === "0.0.0.0") {
    return {
      type: "ip",
      label: "unspecified",
      version: 4,
    };
  }
  if (
    hostname === "::" ||
    hostname === "0000:0000:0000:0000:0000:0000:0000:0000"
  ) {
    return {
      type: "ip",
      label: "unspecified",
      version: 6,
    };
  }
  if (hostname === "127.0.0.1") {
    return {
      type: "ip",
      label: "loopback",
      version: 4,
    };
  }
  if (
    hostname === "::1" ||
    hostname === "0000:0000:0000:0000:0000:0000:0000:0001"
  ) {
    return {
      type: "ip",
      label: "loopback",
      version: 6,
    };
  }
  const ipVersion = isIP(hostname);
  if (ipVersion === 0) {
    return {
      type: "hostname",
    };
  }
  return {
    type: "ip",
    version: ipVersion,
  };
};

const createIpGetters = () => {
  const networkAddresses = [];
  const networkInterfaceMap = networkInterfaces();
  for (const key of Object.keys(networkInterfaceMap)) {
    for (const networkAddress of networkInterfaceMap[key]) {
      networkAddresses.push(networkAddress);
    }
  }
  return {
    getFirstInternalIp: ({ preferIpv6 }) => {
      const isPref = preferIpv6 ? isIpV6 : isIpV4;
      let firstInternalIp;
      for (const networkAddress of networkAddresses) {
        if (networkAddress.internal) {
          firstInternalIp = networkAddress.address;
          if (isPref(networkAddress)) {
            break;
          }
        }
      }
      return firstInternalIp;
    },
    getFirstExternalIp: ({ preferIpv6 }) => {
      const isPref = preferIpv6 ? isIpV6 : isIpV4;
      let firstExternalIp;
      for (const networkAddress of networkAddresses) {
        if (!networkAddress.internal) {
          firstExternalIp = networkAddress.address;
          if (isPref(networkAddress)) {
            break;
          }
        }
      }
      return firstExternalIp;
    },
  };
};

const isIpV4 = (networkAddress) => {
  // node 18.5
  if (typeof networkAddress.family === "number") {
    return networkAddress.family === 4;
  }
  return networkAddress.family === "IPv4";
};

const isIpV6 = (networkAddress) => !isIpV4(networkAddress);

const TIMING_NOOP = () => {
  return { end: () => {} };
};

const startServer = async ({
  signal = new AbortController().signal,
  logLevel,
  routerLogLevel,
  startLog = true,
  serverName = "server",

  https = false,
  http2 = false,
  http1Allowed = true,
  redirectHttpToHttps,
  allowHttpRequestOnHttps = false,
  acceptAnyIp = false,
  preferIpv6,
  hostname = "localhost",
  port = 0, // assign a random available port
  portHint,

  // when inside a worker, we should not try to stop server on SIGINT
  // otherwise it can create an EPIPE error while primary process tries
  // to kill the server
  stopOnSIGINT = !cluster.isWorker,
  // auto close the server when the process exits
  stopOnExit = true,
  // auto close when requestToResponse throw an error
  stopOnInternalError = false,
  keepProcessAlive = true,
  routes = [],
  services = [],
  nagle = true,
  serverTiming = false,
  requestWaitingMs = 0,
  requestWaitingCallback = ({ request, requestWaitingMs }) => {
    request.logger.warn(
      createDetailedMessage(
        `still no response found for request after ${requestWaitingMs} ms`,
        {
          "request url": request.url,
          "request headers": JSON.stringify(request.headers, null, "  "),
        },
      ),
    );
  },
  // timeAllocated to start responding to a request
  // after this delay the server will respond with 504
  responseTimeout = 60_000 * 10, // 10s
  // time allocated to server code to start reading the request body
  // after this delay the underlying stream is destroyed, attempting to read it would throw
  // if used the stream stays opened, it's only if the stream is not read at all that it gets destroyed
  requestBodyLifetime = 60_000 * 2, // 2s
  ...rest
} = {}) => {
  // param validations
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    if (https) {
      if (typeof https !== "object") {
        throw new TypeError(`https must be an object, got ${https}`);
      }
      const { certificate, privateKey } = https;
      if (!certificate || !privateKey) {
        throw new TypeError(
          `https must be an object with { certificate, privateKey }`,
        );
      }
    }
    if (http2 && !https) {
      throw new Error(`http2 needs https`);
    }
  }
  const logger = createLogger({ logLevel });
  // param warnings and normalization
  {
    if (
      redirectHttpToHttps === undefined &&
      https &&
      !allowHttpRequestOnHttps
    ) {
      redirectHttpToHttps = true;
    }
    if (redirectHttpToHttps && !https) {
      logger.warn(`redirectHttpToHttps ignored because protocol is http`);
      redirectHttpToHttps = false;
    }
    if (allowHttpRequestOnHttps && redirectHttpToHttps) {
      logger.warn(
        `redirectHttpToHttps ignored because allowHttpRequestOnHttps is enabled`,
      );
      redirectHttpToHttps = false;
    }

    if (allowHttpRequestOnHttps && !https) {
      logger.warn(`allowHttpRequestOnHttps ignored because protocol is http`);
      allowHttpRequestOnHttps = false;
    }
  }

  services = [
    jsenvServiceOpenFile(),
    jsenvServiceDefaultBody4xx5xx(),
    jsenvServiceRouteInspector(),
    jsenvServiceInternalClientFiles(),
    jsenvServiceAutoreloadOnRestart(),
    ...flattenAndFilterServices(services),
  ];

  const allRouteArray = [];
  for (const route of routes) {
    allRouteArray.push(route);
  }
  for (const service of services) {
    const serviceRoutes = service.routes;
    if (serviceRoutes) {
      for (const serviceRoute of serviceRoutes) {
        serviceRoute.service = service;
        allRouteArray.push(serviceRoute);
      }
    }
  }

  const router = createRouter(allRouteArray, {
    optionsFallback: true,
    logLevel: routerLogLevel,
  });

  const server = {};

  const serviceController = createServiceController(services);
  const processTeardownEvents = {
    SIGHUP: stopOnExit,
    SIGTERM: stopOnExit,
    SIGINT: stopOnSIGINT,
    beforeExit: stopOnExit,
    exit: stopOnExit,
  };

  let status = "starting";
  let nodeServer;
  const startServerOperation = Abort.startOperation();
  const stopCallbackSet = new Set();
  const serverOrigins = {
    local: "", // favors hostname when possible
  };

  try {
    startServerOperation.addAbortSignal(signal);
    startServerOperation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(processTeardownEvents, ({ name }) => {
        logger.info(`process teardown (${name}) -> aborting start server`);
        abort();
      });
    });
    startServerOperation.throwIfAborted();
    nodeServer = await createNodeServer({
      https,
      redirectHttpToHttps,
      allowHttpRequestOnHttps,
      http2,
      http1Allowed,
    });
    startServerOperation.throwIfAborted();

    // https://nodejs.org/api/net.html#net_server_unref
    if (!keepProcessAlive) {
      nodeServer.unref();
    }

    const createOrigin = (hostname) => {
      const protocol = https ? "https" : "http";
      if (isIP(hostname) === 6) {
        return `${protocol}://[${hostname}]`;
      }
      return `${protocol}://${hostname}`;
    };

    const ipGetters = createIpGetters();
    let hostnameToListen;
    if (acceptAnyIp) {
      const firstInternalIp = ipGetters.getFirstInternalIp({ preferIpv6 });
      serverOrigins.local = createOrigin(firstInternalIp);
      serverOrigins.localip = createOrigin(firstInternalIp);
      const firstExternalIp = ipGetters.getFirstExternalIp({ preferIpv6 });
      serverOrigins.externalip = createOrigin(firstExternalIp);
      hostnameToListen = preferIpv6 ? "::" : "0.0.0.0";
    } else {
      hostnameToListen = hostname;
    }
    const hostnameInfo = parseHostname(hostname);
    if (hostnameInfo.type === "ip") {
      if (acceptAnyIp) {
        throw new Error(
          `hostname cannot be an ip when acceptAnyIp is enabled, got ${hostname}`,
        );
      }

      preferIpv6 = hostnameInfo.version === 6;
      const firstInternalIp = ipGetters.getFirstInternalIp({ preferIpv6 });
      serverOrigins.local = createOrigin(firstInternalIp);
      serverOrigins.localip = createOrigin(firstInternalIp);
      if (hostnameInfo.label === "unspecified") {
        const firstExternalIp = ipGetters.getFirstExternalIp({ preferIpv6 });
        serverOrigins.externalip = createOrigin(firstExternalIp);
      } else if (hostnameInfo.label === "loopback") {
        // nothing
      } else {
        serverOrigins.local = createOrigin(hostname);
      }
    } else {
      const hostnameDnsResolution = await applyDnsResolution(hostname, {
        verbatim: true,
      });
      if (hostnameDnsResolution) {
        const hostnameIp = hostnameDnsResolution.address;
        serverOrigins.localip = createOrigin(hostnameIp);
        serverOrigins.local = createOrigin(hostname);
      } else {
        const firstInternalIp = ipGetters.getFirstInternalIp({ preferIpv6 });
        // fallback to internal ip because there is no ip
        // associated to this hostname on operating system (in hosts file)
        hostname = firstInternalIp;
        hostnameToListen = firstInternalIp;
        serverOrigins.local = createOrigin(firstInternalIp);
      }
    }

    port = await listen({
      signal: startServerOperation.signal,
      server: nodeServer,
      port,
      portHint,
      hostname: hostnameToListen,
    });

    // normalize origins (remove :80 when port is 80 for instance)
    Object.keys(serverOrigins).forEach((key) => {
      serverOrigins[key] = new URL(`${serverOrigins[key]}:${port}`).origin;
    });

    serviceController.callHooks("serverListening", { port });
    startServerOperation.addAbortCallback(async () => {
      await stopListening(nodeServer);
    });
    startServerOperation.throwIfAborted();
  } finally {
    await startServerOperation.end();
  }

  // the main server origin
  // - when protocol is http
  //   node-fetch do not apply local dns resolution to map localhost back to 127.0.0.1
  //   despites localhost being mapped so we prefer to use the internal ip
  //   (127.0.0.1)
  // - when protocol is https
  //   using the hostname becomes important because the certificate is generated
  //   for hostnames, not for ips
  //   so we prefer https://locahost or https://local_hostname
  //   over the ip
  const serverOrigin = serverOrigins.local;

  // now the server is started (listening) it cannot be aborted anymore
  // (otherwise an AbortError is thrown to the code calling "startServer")
  // we can proceed to create a stop function to stop it gacefully
  // and add a request handler
  stopCallbackSet.add(({ reason }) => {
    if (reason !== STOP_REASON_PROCESS_BEFORE_EXIT) {
      logger.info(`${serverName} stopping server (reason: ${reason})`);
    }
  });
  stopCallbackSet.add(async () => {
    await stopListening(nodeServer);
  });
  let stoppedResolve;
  const stoppedPromise = new Promise((resolve) => {
    stoppedResolve = resolve;
  });
  const stop = memoize(async (reason = STOP_REASON_NOT_SPECIFIED) => {
    status = "stopping";
    const promises = [];
    for (const stopCallback of stopCallbackSet) {
      promises.push(stopCallback({ reason }));
    }
    stopCallbackSet.clear();
    await Promise.all(promises);
    serviceController.callHooks("serverStopped", { reason });
    status = "stopped";
    stoppedResolve(reason);
  });
  let stopAbortSignal;
  {
    let stopAbortController = new AbortController();
    stopCallbackSet.add(() => {
      stopAbortController.abort();
      stopAbortController = undefined;
    });
    stopAbortSignal = stopAbortController.signal;
  }

  const cancelProcessTeardownRace = raceProcessTeardownEvents(
    processTeardownEvents,
    (winner) => {
      stop(PROCESS_TEARDOWN_EVENTS_MAP[winner.name]);
    },
  );
  stopCallbackSet.add(cancelProcessTeardownRace);

  const onError = (error) => {
    if (status === "stopping" && error.code === "ECONNRESET") {
      return;
    }
    throw error;
  };

  status = "opened";

  const removeConnectionErrorListener = listenServerConnectionError(
    nodeServer,
    onError,
  );
  stopCallbackSet.add(removeConnectionErrorListener);

  const connectionsTracker = trackServerPendingConnections(nodeServer, {
    http2,
  });
  // opened connection must be shutdown before the close event is emitted
  stopCallbackSet.add(connectionsTracker.stop);

  const pendingRequestsTracker = trackServerPendingRequests(nodeServer, {
    http2,
  });
  // ensure pending requests got a response from the server
  stopCallbackSet.add((reason) => {
    pendingRequestsTracker.stop({
      status: reason === STOP_REASON_INTERNAL_ERROR ? 500 : 503,
      reason,
    });
  });

  const applyRequestInternalRedirection = (request) => {
    serviceController.callHooks(
      "redirectRequest",
      request,
      {},
      (newRequestProperties) => {
        if (newRequestProperties) {
          request = applyRedirectionToRequest(request, {
            original: request.original || request,
            previous: request,
            ...newRequestProperties,
          });
        }
      },
    );
    return request;
  };

  const prepareHandleRequestOperations = (nodeRequest, nodeResponse) => {
    const receiveRequestOperation = Abort.startOperation();
    receiveRequestOperation.addAbortSignal(stopAbortSignal);
    const sendResponseOperation = Abort.startOperation();
    sendResponseOperation.addAbortSignal(stopAbortSignal);
    receiveRequestOperation.addAbortSource((abort) => {
      const closeEventCallback = () => {
        if (nodeRequest.complete) {
          receiveRequestOperation.end();
        } else {
          nodeResponse.destroy();
          abort();
        }
      };
      nodeRequest.once("close", closeEventCallback);
      return () => {
        nodeRequest.removeListener("close", closeEventCallback);
      };
    });
    sendResponseOperation.addAbortSignal(receiveRequestOperation.signal);
    return [receiveRequestOperation, sendResponseOperation];
  };
  const getResponseProperties = async (request, { pushResponse }) => {
    const timings = {};
    const timing = serverTiming
      ? (name) => {
          const start = performance.now();
          timings[name] = null;
          return {
            name,
            end: () => {
              const end = performance.now();
              const duration = end - start;
              timings[name] = duration;
            },
          };
        }
      : TIMING_NOOP;
    const startRespondingTiming = timing("time to start responding");

    request.logger.info(
      request.headers["upgrade"] === "websocket"
        ? `GET ${request.url} ${websocketSuffixColorized}`
        : request.parent
          ? `Push ${request.resource}`
          : `${request.method} ${request.url}`,
    );
    let requestWaitingTimeout;
    if (requestWaitingMs) {
      requestWaitingTimeout = setTimeout(
        () =>
          requestWaitingCallback({
            request,
            requestWaitingMs,
          }),
        requestWaitingMs,
      ).unref();
    }

    let headersToInject;
    const finalizeResponseProperties = (responseProperties) => {
      if (serverTiming) {
        startRespondingTiming.end();
        responseProperties.headers = composeTwoHeaders(
          responseProperties.headers,
          timingToServerTimingResponseHeaders(timings),
        );
      }
      if (requestWaitingMs) {
        clearTimeout(requestWaitingTimeout);
      }
      if (
        request.method !== "HEAD" &&
        responseProperties.headers &&
        responseProperties.headers["content-length"] > 0 &&
        !responseProperties.body
      ) {
        request.logger.warn(
          `content-length response header found without body`,
        );
      }

      if (headersToInject) {
        responseProperties.headers = composeTwoHeaders(
          responseProperties.headers,
          headersToInject,
        );
      }
      serviceController.callHooks(
        "injectResponseProperties",
        request,
        responseProperties,
        (returnValue) => {
          if (!returnValue) {
            return;
          }
          responseProperties = composeTwoResponses(
            responseProperties,
            returnValue,
          );
        },
      );
      // the node request readable stream is never closed because
      // the response headers contains "connection: keep-alive"
      // In this scenario we want to disable READABLE_STREAM_TIMEOUT warning
      if (
        responseProperties.headers.connection === "keep-alive" &&
        request.body
      ) {
        clearTimeout(request.body.timeout);
      }
      return responseProperties;
    };

    let timeout;
    try {
      request = applyRequestInternalRedirection(request);
      const timeoutResponsePropertiesPromise = new Promise((resolve) => {
        timeout = setTimeout(() => {
          resolve({
            // the correct status code should be 500 because it's
            // we don't really know what takes time
            // in practice it's often because server is trying to reach an other server
            // that is not responding so 504 is more correct
            status: 504,
            statusText: `server timeout after ${
              responseTimeout / 1000
            }s waiting to handle request`,
          });
        }, responseTimeout);
      });
      const routerResponsePropertiesPromise = (async () => {
        const fetchSecondArg = {
          timing,
          pushResponse,
          injectResponseHeader: (name, value) => {
            if (!headersToInject) {
              headersToInject = {};
            }
            headersToInject[name] = composeTwoHeaderValues(
              name,
              headersToInject[name],
              value,
            );
          },
        };
        await serviceController.callAsyncHooks(
          "augmentRouteFetchSecondArg",
          request,
          fetchSecondArg,
          (properties) => {
            if (properties) {
              Object.assign(fetchSecondArg, properties);
            }
          },
        );
        const routerResponseProperties = await router.match(
          request,
          fetchSecondArg,
        );
        return routerResponseProperties;
      })();
      const responseProperties = await Promise.race([
        timeoutResponsePropertiesPromise,
        routerResponsePropertiesPromise,
      ]);
      clearTimeout(timeout);
      return finalizeResponseProperties(responseProperties);
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === "AbortError" && request.signal.aborted) {
        // let it propagate to the caller that should catch this
        throw e;
      }
      // internal error, create 500 response
      if (
        // stopOnInternalError stops server only if requestToResponse generated
        // a non controlled error (internal error).
        // if requestToResponse gracefully produced a 500 response (it did not throw)
        // then we can assume we are still in control of what we are doing
        stopOnInternalError
      ) {
        // il faudrais pouvoir stop que les autres response ?
        stop(STOP_REASON_INTERNAL_ERROR);
      }
      const handleErrorReturnValue =
        await serviceController.callAsyncHooksUntil("handleError", e, {
          request,
        });
      if (!handleErrorReturnValue) {
        throw e;
      }
      request.logger.error(
        createDetailedMessage(`internal error while handling request`, {
          "error stack": e.stack,
        }),
      );
      const responseProperties = composeTwoResponses(
        {
          status: 500,
          statusText: "Internal Server Error",
          headers: {
            // ensure error are not cached
            "cache-control": "no-store",
          },
        },
        handleErrorReturnValue,
      );
      return finalizeResponseProperties(responseProperties);
    }
  };
  const sendResponse = async (
    responseStream,
    responseProperties,
    { signal, request },
  ) => {
    // When "pushResponse" is called and the parent response has no body
    // the parent response is immediatly ended. It means child responses (pushed streams)
    // won't get a chance to be pushed.
    // To let a chance to pushed streams we wait a little before sending the response
    const ignoreBody = request.method === "HEAD";
    const bodyIsEmpty = !responseProperties.body || ignoreBody;
    if (bodyIsEmpty && request.logger.hasPushChild) {
      await new Promise((resolve) => setTimeout(resolve));
    }
    await writeNodeResponse(responseStream, responseProperties, {
      signal,
      ignoreBody,
      onAbort: () => {
        request.logger.info(`response aborted`);
        request.logger.end();
      },
      onError: (error) => {
        request.logger.error(
          createDetailedMessage(`An error occured while sending response`, {
            "error stack": error.stack,
          }),
        );
        request.logger.end();
      },
      onHeadersSent: ({ status, statusText }) => {
        request.logger.onHeadersSent({
          status,
          statusText: responseProperties.statusMessage || statusText,
        });
        request.logger.end();
      },
      onEnd: () => {
        request.logger.end();
      },
    });
  };

  {
    const requestEventHandler = async (nodeRequest, nodeResponse) => {
      if (redirectHttpToHttps && !nodeRequest.connection.encrypted) {
        nodeResponse.writeHead(301, {
          location: `${serverOrigin}${nodeRequest.url}`,
        });
        nodeResponse.end();
        return;
      }
      try {
        // eslint-disable-next-line no-new
        new URL(nodeRequest.url, "http://example.com");
      } catch {
        nodeResponse.writeHead(400, "Request url is not supported");
        nodeResponse.end();
        return;
      }

      const [receiveRequestOperation, sendResponseOperation] =
        prepareHandleRequestOperations(nodeRequest, nodeResponse);
      const request = fromNodeRequest(nodeRequest, {
        signal: stopAbortSignal,
        serverOrigin,
        requestBodyLifetime,
        logger,
        nagle,
      });

      try {
        const responseProperties = await getResponseProperties(request, {
          pushResponse: async ({ path, method }) => {
            const pushRequestLogger = request.logger.forPush();
            if (typeof path !== "string" || path[0] !== "/") {
              pushRequestLogger.warn(
                `response push ignored because path is invalid (must be a string starting with "/", found ${path})`,
              );
              return;
            }
            if (!request.http2) {
              pushRequestLogger.warn(
                `response push ignored because request is not http2`,
              );
              return;
            }
            const canPushStream = testCanPushStream(nodeResponse.stream);
            if (!canPushStream.can) {
              pushRequestLogger.debug(
                `response push ignored because ${canPushStream.reason}`,
              );
              return;
            }

            let preventedByService = null;
            const prevent = () => {
              preventedByService = serviceController.getCurrentService();
            };
            serviceController.callHooksUntil(
              "onResponsePush",
              { path, method },
              { request, prevent },
              () => preventedByService,
            );
            if (preventedByService) {
              pushRequestLogger.debug(
                `response push prevented by "${preventedByService.name}" service`,
              );
              return;
            }

            const http2Stream = nodeResponse.stream;

            // being able to push a stream is nice to have
            // so when it fails it's not critical
            const onPushStreamError = (e) => {
              pushRequestLogger.error(
                createDetailedMessage(
                  `An error occured while pushing a stream to the response for ${request.resource}`,
                  {
                    "error stack": e.stack,
                  },
                ),
              );
            };

            // not aborted, let's try to push a stream into that response
            // https://nodejs.org/docs/latest-v16.x/api/http2.html#http2streampushstreamheaders-options-callback
            let pushStream;
            try {
              pushStream = await new Promise((resolve, reject) => {
                http2Stream.pushStream(
                  {
                    ":path": path,
                    ...(method ? { ":method": method } : {}),
                  },
                  async (
                    error,
                    pushStream,
                    // headers
                  ) => {
                    if (error) {
                      reject(error);
                    }
                    resolve(pushStream);
                  },
                );
              });
            } catch (e) {
              onPushStreamError(e);
              return;
            }

            const abortController = new AbortController();
            // It's possible to get NGHTTP2_REFUSED_STREAM errors here
            // https://github.com/nodejs/node/issues/20824
            const pushErrorCallback = (error) => {
              onPushStreamError(error);
              abortController.abort();
            };
            pushStream.on("error", pushErrorCallback);
            sendResponseOperation.addEndCallback(() => {
              pushStream.removeListener("error", onPushStreamError);
            });

            await sendResponseOperation.withSignal(async (signal) => {
              const pushResponseOperation = Abort.startOperation();
              pushResponseOperation.addAbortSignal(signal);
              pushResponseOperation.addAbortSignal(abortController.signal);

              const pushRequest = createPushRequest(request, {
                signal: pushResponseOperation.signal,
                pathname: path,
                method,
                logger: pushRequestLogger,
              });

              try {
                const responseProperties = await getResponseProperties(
                  pushRequest,
                  {
                    pushResponse: () => {
                      pushRequest.logger.warn(
                        `response push ignored because nested push is not supported`,
                      );
                    },
                  },
                );
                if (!abortController.signal.aborted) {
                  if (pushStream.destroyed) {
                    abortController.abort();
                  } else if (!http2Stream.pushAllowed) {
                    abortController.abort();
                  } else if (responseProperties.requestAborted) {
                  } else {
                    const responseLength =
                      responseProperties.headers["content-length"] || 0;
                    const { effectiveRecvDataLength, remoteWindowSize } =
                      http2Stream.session.state;
                    if (
                      effectiveRecvDataLength + responseLength >
                      remoteWindowSize
                    ) {
                      pushRequest.logger.debug(
                        `Aborting stream to prevent exceeding remoteWindowSize`,
                      );
                      abortController.abort();
                    }
                  }
                }
                await sendResponse(pushStream, responseProperties, {
                  signal: pushResponseOperation.signal,
                  request: pushRequest,
                });
              } finally {
                await pushResponseOperation.end();
              }
            });
          },
        });
        const webSocketHandler = getWebSocketHandler(responseProperties);
        if (webSocketHandler) {
          throw new Error(
            "unexpected websocketResponse received for request that does not want to be upgraded to websocket. A regular response was expected.",
          );
        }
        if (receiveRequestOperation.signal.aborted) {
          return;
        }
        await sendResponse(nodeResponse, responseProperties, {
          signal: sendResponseOperation.signal,
          request,
        });
      } finally {
        await sendResponseOperation.end();
      }
    };
    const removeRequestListener = listenRequest(
      nodeServer,
      requestEventHandler,
    );
    // ensure we don't try to handle new requests while server is stopping
    stopCallbackSet.add(removeRequestListener);
  }

  {
    // https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocket
    const webSocketOrigin = https
      ? `wss://${hostname}:${port}`
      : `ws://${hostname}:${port}`;
    server.webSocketOrigin = webSocketOrigin;
    const webSocketSet = new Set();
    let upgradeRequestToWebSocket;
    const loadUpgradeRequestToWebSocket = async () => {
      const { WebSocketServer } = await import("./ws/ws.js");
      let webSocketServer = new WebSocketServer({ noServer: true });
      stopCallbackSet.add(() => {
        webSocketServer.close();
        webSocketServer = null;
      });
      upgradeRequestToWebSocket = async ({ nodeRequest, socket, head }) => {
        const websocket = await new Promise((resolve) => {
          webSocketServer.handleUpgrade(nodeRequest, socket, head, resolve);
        });
        return websocket;
      };
    };
    // https://github.com/websockets/ws/blob/b92745a9d6760e6b4b2394bfac78cbcd258a8c8d/lib/websocket-server.js#L491
    const upgradeEventHandler = async (nodeRequest, socket, head) => {
      let request = fromNodeRequest(nodeRequest, {
        signal: stopAbortSignal,
        serverOrigin,
        requestBodyLifetime,
        logger,
        nagle,
      });
      const [receiveRequestOperation, sendResponseOperation] =
        prepareHandleRequestOperations(nodeRequest, socket);
      const responseProperties = await getResponseProperties(request, {
        pushResponse: () => {
          request.logger.warn(
            `pushResponse ignored because it's not supported in websocket`,
          );
        },
      });
      if (receiveRequestOperation.signal.aborted) {
        return;
      }
      if (responseProperties.status !== 101) {
        await sendResponse(socket, responseProperties, {
          signal: sendResponseOperation.signal,
          request,
        });
        return;
      }
      const webSocketHandler = getWebSocketHandler(responseProperties);
      if (!webSocketHandler) {
        throw new Error(
          "unexpected response received for request that wants to be upgraded to websocket. A webSocketResponse was expected.",
        );
      }
      if (!upgradeRequestToWebSocket) {
        await loadUpgradeRequestToWebSocket();
      }
      if (sendResponseOperation.signal.aborted) {
        return;
      }
      const webSocket = await upgradeRequestToWebSocket({
        nodeRequest,
        socket,
        head,
      });
      if (sendResponseOperation.signal.aborted) {
        webSocket.destroy();
        return;
      }
      const webSocketAbortController = new AbortController();
      webSocketSet.add(webSocket);
      webSocket.once("close", () => {
        webSocketSet.delete(webSocket);
        webSocketAbortController.abort();
      });
      request.logger.onHeadersSent({
        status: 101,
        statusText: "Switching Protocols",
      });
      request.logger.end();
      let websocketHandlerReturnValue = await webSocketHandler(webSocket);
      if (typeof websocketHandlerReturnValue === "function") {
        webSocket.once("close", () => {
          websocketHandlerReturnValue();
          websocketHandlerReturnValue = undefined;
        });
      }
      return;
    };
    // see server-polyglot.js, upgrade must be listened on https server when used
    const facadeServer = nodeServer._tlsServer || nodeServer;
    const removeUpgradeCallback = listenEvent(
      facadeServer,
      "upgrade",
      upgradeEventHandler,
    );
    stopCallbackSet.add(removeUpgradeCallback);
    stopCallbackSet.add(() => {
      for (const websocket of webSocketSet) {
        websocket.close();
      }
      webSocketSet.clear();
    });
  }

  if (startLog) {
    if (serverOrigins.network) {
      logger.info(
        `${serverName} started at ${serverOrigins.local} (${serverOrigins.network})`,
      );
    } else {
      logger.info(`${serverName} started at ${serverOrigins.local}`);
    }
  }

  Object.assign(server, {
    getStatus: () => status,
    port,
    hostname,
    origin: serverOrigin,
    origins: serverOrigins,
    nodeServer,
    stop,
    stoppedPromise,
    addEffect: (callback) => {
      const cleanup = callback();
      if (typeof cleanup === "function") {
        stopCallbackSet.add(cleanup);
      }
    },
  });
  return server;
};

const createNodeServer = async ({
  https,
  redirectHttpToHttps,
  allowHttpRequestOnHttps,
  http2,
  http1Allowed,
}) => {
  if (https) {
    const { certificate, privateKey } = https;
    if (redirectHttpToHttps || allowHttpRequestOnHttps) {
      return createPolyglotServer({
        certificate,
        privateKey,
        http2,
        http1Allowed,
      });
    }
    const { createServer } = await import("node:https");
    return createServer({
      cert: certificate,
      key: privateKey,
    });
  }
  const { createServer } = await import("node:http");
  return createServer();
};

const testCanPushStream = (http2Stream) => {
  if (!http2Stream.pushAllowed) {
    return {
      can: false,
      reason: `stream.pushAllowed is false`,
    };
  }

  // See https://nodejs.org/dist/latest-v16.x/docs/api/http2.html#http2sessionstate
  // And https://github.com/google/node-h2-auto-push/blob/67a36c04cbbd6da7b066a4e8d361c593d38853a4/src/index.ts#L100-L106
  const { remoteWindowSize } = http2Stream.session.state;
  if (remoteWindowSize === 0) {
    return {
      can: false,
      reason: `no more remoteWindowSize`,
    };
  }

  return {
    can: true,
  };
};

const PROCESS_TEARDOWN_EVENTS_MAP = {
  SIGHUP: STOP_REASON_PROCESS_SIGHUP,
  SIGTERM: STOP_REASON_PROCESS_SIGTERM,
  SIGINT: STOP_REASON_PROCESS_SIGINT,
  beforeExit: STOP_REASON_PROCESS_BEFORE_EXIT,
  exit: STOP_REASON_PROCESS_EXIT,
};

const internalErrorHtmlFileUrl = import.meta.resolve("./client/error_handler/500.html");

const jsenvServiceErrorHandler = ({ sendErrorDetails = false } = {}) => {
  return {
    name: "jsenv:error_handler",
    handleError: (serverInternalError, { request }) => {
      const serverInternalErrorIsAPrimitive =
        serverInternalError === null ||
        (typeof serverInternalError !== "object" &&
          typeof serverInternalError !== "function");
      if (!serverInternalErrorIsAPrimitive && serverInternalError.asResponse) {
        return serverInternalError.asResponse();
      }
      const dataToSend = serverInternalErrorIsAPrimitive
        ? {
            code: "VALUE_THROWED",
            value: serverInternalError,
          }
        : {
            code: serverInternalError.code || "UNKNOWN_ERROR",
            ...(sendErrorDetails
              ? {
                  stack: serverInternalError.stack,
                  ...serverInternalError,
                }
              : {}),
          };

      const availableContentTypes = {
        "text/html": () => {
          const renderHtmlForErrorWithoutDetails = () => {
            return `<p>Details not available: to enable them use jsenvServiceErrorHandler({ sendErrorDetails: true }).</p>`;
          };
          const renderHtmlForErrorWithDetails = () => {
            return errorToHTML(serverInternalError);
          };

          const internalErrorHtmlTemplate = readFileSync(
            new URL(internalErrorHtmlFileUrl),
            "utf8",
          );
          const internalErrorHtml = replacePlaceholdersInHtml(
            internalErrorHtmlTemplate,
            {
              errorMessage: serverInternalErrorIsAPrimitive
                ? `Code inside server has thrown a literal.`
                : `Code inside server has thrown an error.`,
              errorDetailsContent: sendErrorDetails
                ? renderHtmlForErrorWithDetails()
                : renderHtmlForErrorWithoutDetails(),
            },
          );

          return {
            headers: {
              "content-type": "text/html",
              "content-length": Buffer.byteLength(internalErrorHtml),
            },
            body: internalErrorHtml,
          };
        },
        "text/plain": () => {
          let internalErrorMessage = serverInternalErrorIsAPrimitive
            ? `Code inside server has thrown a literal:`
            : `Code inside server has thrown an error:`;
          if (sendErrorDetails) {
            if (serverInternalErrorIsAPrimitive) {
              internalErrorMessage += `\n${JSON.stringify(
                serverInternalError,
                null,
                "  ",
              )}`;
            } else {
              internalErrorMessage += `\n${serverInternalError.stack}`;
            }
          } else {
            internalErrorMessage += `\nDetails not available: to enable them use jsenvServiceErrorHandler({ sendErrorDetails: true }).`;
          }

          return {
            headers: {
              "content-type": "text/plain",
              "content-length": Buffer.byteLength(internalErrorMessage),
            },
            body: internalErrorMessage,
          };
        },
        "application/json": () => {
          const body = JSON.stringify(dataToSend);
          return {
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
            },
            body,
          };
        },
      };
      const bestContentType = pickContentType(
        request,
        Object.keys(availableContentTypes),
      );
      return availableContentTypes[bestContentType || "application/json"]();
    },
  };
};

const convertFileSystemErrorToResponseProperties = (error) => {
  // https://iojs.org/api/errors.html#errors_eacces_permission_denied
  if (isErrorWithCode(error, "EACCES")) {
    return {
      status: 403,
      statusText: `EACCES: No permission to read file at ${error.path}`,
    };
  }
  if (isErrorWithCode(error, "EPERM")) {
    return {
      status: 403,
      statusText: `EPERM: No permission to read file at ${error.path}`,
    };
  }
  if (isErrorWithCode(error, "ENOENT")) {
    return {
      status: 404,
      statusText: `ENOENT: File not found at ${error.path}`,
    };
  }
  // file access may be temporarily blocked
  // (by an antivirus scanning it because recently modified for instance)
  if (isErrorWithCode(error, "EBUSY")) {
    return {
      status: 503,
      statusText: `EBUSY: File is busy ${error.path}`,
      headers: {
        "retry-after": 0.01, // retry in 10ms
      },
    };
  }
  // emfile means there is too many files currently opened
  if (isErrorWithCode(error, "EMFILE")) {
    return {
      status: 503,
      statusText: "EMFILE: too many file opened",
      headers: {
        "retry-after": 0.1, // retry in 100ms
      },
    };
  }
  if (isErrorWithCode(error, "EISDIR")) {
    return {
      status: 500,
      statusText: `EISDIR: Unexpected directory operation at ${error.path}`,
    };
  }
  return null;
};

const isErrorWithCode = (error, code) => {
  return typeof error === "object" && error.code === code;
};

const ETAG_FOR_EMPTY_CONTENT = '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';

const bufferToEtag = (buffer) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(`buffer expect,got ${buffer}`);
  }

  if (buffer.length === 0) {
    return ETAG_FOR_EMPTY_CONTENT;
  }

  const hash = createHash("sha1");
  hash.update(buffer, "utf8");

  const hashBase64String = hash.digest("base64");
  const hashBase64StringSubset = hashBase64String.slice(0, 27);
  const length = buffer.length;

  return `"${length.toString(16)}-${hashBase64StringSubset}"`;
};

const isFileSystemPath = (value) => {
  if (typeof value !== "string") {
    throw new TypeError(
      `isFileSystemPath first arg must be a string, got ${value}`,
    );
  }

  if (value[0] === "/") {
    return true;
  }

  return startsWithWindowsDriveLetter(value);
};

const startsWithWindowsDriveLetter = (string) => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;

  const secondChar = string[1];
  if (secondChar !== ":") return false;

  return true;
};

const fileSystemPathToUrl = (value) => {
  if (!isFileSystemPath(value)) {
    throw new Error(`received an invalid value for fileSystemPath: ${value}`);
  }
  return String(pathToFileURL(value));
};

const serveDirectory = (
  url,
  { headers = {}, rootDirectoryUrl } = {},
) => {
  url = String(url);
  url = url[url.length - 1] === "/" ? url : `${url}/`;
  const directoryContentArray = readdirSync(new URL(url));
  const responseProducers = {
    "application/json": () => {
      const directoryContentJson = JSON.stringify(
        directoryContentArray,
        null,
        "  ",
      );
      return {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": directoryContentJson.length,
        },
        body: directoryContentJson,
      };
    },
    "text/html": () => {
      const directoryAsHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>Directory explorer</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <h1>Content of directory ${url}</h1>
    <ul>
      ${directoryContentArray.map((filename) => {
        const fileUrlObject = new URL(filename, url);
        const fileUrl = String(fileUrlObject);
        let fileUrlRelativeToServer = fileUrl.slice(
          String(rootDirectoryUrl).length,
        );
        if (lstatSync(fileUrlObject).isDirectory()) {
          fileUrlRelativeToServer += "/";
        }
        return `<li>
        <a href="/${fileUrlRelativeToServer}">${fileUrlRelativeToServer}</a>
      </li>`;
      }).join(`
      `)}
    </ul>
  </body>
</html>`;

      return {
        status: 200,
        headers: {
          "content-type": "text/html",
          "content-length": Buffer.byteLength(directoryAsHtml),
        },
        body: directoryAsHtml,
      };
    },
  };
  const bestContentType = pickContentType(
    { headers },
    Object.keys(responseProducers),
  );
  return responseProducers[bestContentType || "application/json"]();
};

/*
 * This function returns response properties in a plain object like
 * { status: 200, body: "Hello world" }.
 * It is meant to be used inside "requestToResponse"
 */


const createFileSystemFetch = (directoryUrl, options) => {
  return (request, helpers) => {
    return fetchFileSystem(request, helpers, directoryUrl, options);
  };
};

const fetchFileSystem = async (
  request,
  helpers,
  directoryUrl,
  {
    etagEnabled = false,
    etagMemory = true,
    etagMemoryMaxSize = 1000,
    mtimeEnabled = false,
    compressionEnabled = false,
    compressionSizeThreshold = 1024,
    cacheControl = etagEnabled || mtimeEnabled
      ? "private,max-age=0,must-revalidate"
      : "no-store",
    canReadDirectory = false,
    ENOENTFallback = () => {},
  } = {},
) => {
  let directoryUrlString = asUrlString(directoryUrl);
  if (!directoryUrlString) {
    throw new TypeError(
      `directoryUrl must be a string or an url, got ${directoryUrl}`,
    );
  }
  if (!directoryUrlString.startsWith("file://")) {
    throw new Error(
      `directoryUrl must start with "file://", got ${directoryUrlString}`,
    );
  }
  if (!directoryUrlString.endsWith("/")) {
    directoryUrlString = `${directoryUrlString}/`;
  }
  let resource;
  if (request.params && "0" in request.params) {
    resource = request.params["0"];
  } else {
    resource = request.resource.slice(1);
  }
  const filesystemUrl = new URL(resource, directoryUrl);
  const urlString = asUrlString(filesystemUrl);

  if (typeof cacheControl === "function") {
    cacheControl = cacheControl(request);
  }

  // here you might be tempted to add || cacheControl === 'no-cache'
  // but no-cache means resource can be cached but must be revalidated (yeah naming is strange)
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#Cacheability
  if (cacheControl === "no-store") {
    if (etagEnabled) {
      console.warn(`cannot enable etag when cache-control is ${cacheControl}`);
      etagEnabled = false;
    }
    if (mtimeEnabled) {
      console.warn(`cannot enable mtime when cache-control is ${cacheControl}`);
      mtimeEnabled = false;
    }
  }
  if (etagEnabled && mtimeEnabled) {
    console.warn(
      `cannot enable both etag and mtime, mtime disabled in favor of etag.`,
    );
    mtimeEnabled = false;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return null;
  }

  const serveFile = async (fileUrl) => {
    try {
      const readStatTiming = helpers?.timing("file service>read file stat");
      const fileStat = statSync(new URL(fileUrl));
      readStatTiming?.end();

      if (fileStat.isDirectory()) {
        if (canReadDirectory) {
          return serveDirectory(fileUrl, {
            headers: request.headers,
            canReadDirectory,
            rootDirectoryUrl: directoryUrl,
          });
        }
        return {
          status: 403,
          statusText: "not allowed to read directory",
        };
      }
      // not a file, give up
      if (!fileStat.isFile()) {
        return {
          status: 404,
        };
      }

      const clientCacheResponse = await getClientCacheResponse({
        headers: request.headers,
        helpers,
        etagEnabled,
        etagMemory,
        etagMemoryMaxSize,
        mtimeEnabled,
        fileStat,
        fileUrl,
      });

      // send 304 (redirect response to client cache)
      // because the response body does not have to be transmitted
      if (clientCacheResponse.status === 304) {
        return composeTwoResponses(
          {
            headers: {
              ...(cacheControl ? { "cache-control": cacheControl } : {}),
            },
          },
          clientCacheResponse,
        );
      }

      let response;
      if (compressionEnabled && fileStat.size >= compressionSizeThreshold) {
        const compressedResponse = await getCompressedResponse({
          headers: request.headers,
          fileUrl,
        });
        if (compressedResponse) {
          response = compressedResponse;
        }
      }
      if (!response) {
        response = await getRawResponse({
          fileStat,
          fileUrl,
        });
      }

      const intermediateResponse = composeTwoResponses(
        {
          headers: {
            ...(cacheControl ? { "cache-control": cacheControl } : {}),
            // even if client cache is disabled, server can still
            // send his own cache control but client should just ignore it
            // and keep sending cache-control: 'no-store'
            // if not, uncomment the line below to preserve client
            // desire to ignore cache
            // ...(headers["cache-control"] === "no-store" ? { "cache-control": "no-store" } : {}),
          },
        },
        response,
      );
      return composeTwoResponses(intermediateResponse, clientCacheResponse);
    } catch (e) {
      if (e.code === "ENOENT") {
        const fallbackFileUrl = ENOENTFallback();
        if (fallbackFileUrl) {
          return serveFile(fallbackFileUrl);
        }
      }
      return composeTwoResponses(
        {
          headers: {
            ...(cacheControl ? { "cache-control": cacheControl } : {}),
          },
        },
        convertFileSystemErrorToResponseProperties(e) || {},
      );
    }
  };

  return serveFile(`file://${new URL(urlString).pathname}`);
};

const getClientCacheResponse = async ({
  headers,
  helpers,
  etagEnabled,
  etagMemory,
  etagMemoryMaxSize,
  mtimeEnabled,
  fileStat,
  fileUrl,
}) => {
  // here you might be tempted to add || headers["cache-control"] === "no-cache"
  // but no-cache means resource can be cache but must be revalidated (yeah naming is strange)
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#Cacheability

  if (
    headers["cache-control"] === "no-store" ||
    // let's disable it on no-cache too
    headers["cache-control"] === "no-cache"
  ) {
    return { status: 200 };
  }

  if (etagEnabled) {
    return getEtagResponse({
      headers,
      helpers,
      etagMemory,
      etagMemoryMaxSize,
      fileStat,
      fileUrl,
    });
  }

  if (mtimeEnabled) {
    return getMtimeResponse({
      headers,
      fileStat,
    });
  }

  return { status: 200 };
};

const getEtagResponse = async ({
  headers,
  helpers,
  etagMemory,
  etagMemoryMaxSize,
  fileUrl,
  fileStat,
}) => {
  const etagTiming = helpers?.timing("file service>generate file etag");
  const fileContentEtag = await computeEtag({
    etagMemory,
    etagMemoryMaxSize,
    fileUrl,
    fileStat,
  });
  etagTiming?.end();

  const requestHasIfNoneMatchHeader = "if-none-match" in headers;
  if (
    requestHasIfNoneMatchHeader &&
    headers["if-none-match"] === fileContentEtag
  ) {
    return {
      status: 304,
    };
  }

  return {
    status: 200,
    headers: {
      etag: fileContentEtag,
    },
  };
};

const ETAG_MEMORY_MAP = new Map();
const computeEtag = async ({
  etagMemory,
  etagMemoryMaxSize,
  fileUrl,
  fileStat,
}) => {
  if (etagMemory) {
    const etagMemoryEntry = ETAG_MEMORY_MAP.get(fileUrl);
    if (
      etagMemoryEntry &&
      fileStatAreTheSame(etagMemoryEntry.fileStat, fileStat)
    ) {
      return etagMemoryEntry.eTag;
    }
  }
  const fileContentAsBuffer = await new Promise((resolve, reject) => {
    readFile(new URL(fileUrl), (error, buffer) => {
      if (error) {
        reject(error);
      } else {
        resolve(buffer);
      }
    });
  });
  const eTag = bufferToEtag(fileContentAsBuffer);
  if (etagMemory) {
    if (ETAG_MEMORY_MAP.size >= etagMemoryMaxSize) {
      const firstKey = Array.from(ETAG_MEMORY_MAP.keys())[0];
      ETAG_MEMORY_MAP.delete(firstKey);
    }
    ETAG_MEMORY_MAP.set(fileUrl, { fileStat, eTag });
  }
  return eTag;
};

// https://nodejs.org/api/fs.html#fs_class_fs_stats
const fileStatAreTheSame = (leftFileStat, rightFileStat) => {
  return fileStatKeysToCompare.every((keyToCompare) => {
    const leftValue = leftFileStat[keyToCompare];
    const rightValue = rightFileStat[keyToCompare];
    return leftValue === rightValue;
  });
};
const fileStatKeysToCompare = [
  // mtime the the most likely to change, check it first
  "mtimeMs",
  "size",
  "ctimeMs",
  "ino",
  "mode",
  "uid",
  "gid",
  "blksize",
];

const getMtimeResponse = async ({ headers, fileStat }) => {
  if ("if-modified-since" in headers) {
    let cachedModificationDate;
    try {
      cachedModificationDate = new Date(headers["if-modified-since"]);
    } catch {
      return {
        status: 400,
        statusText: "if-modified-since header is not a valid date",
      };
    }

    const actualModificationDate = dateToSecondsPrecision(fileStat.mtime);
    if (Number(cachedModificationDate) >= Number(actualModificationDate)) {
      return {
        status: 304,
      };
    }
  }

  return {
    status: 200,
    headers: {
      "last-modified": dateToUTCString(fileStat.mtime),
    },
  };
};

const getCompressedResponse = async ({ fileUrl, headers }) => {
  const contentType = CONTENT_TYPE.fromUrlExtension(fileUrl);
  if (CONTENT_TYPE.isBinary(contentType)) {
    return null;
  }
  const acceptedCompressionFormat = pickContentEncoding(
    { headers },
    Object.keys(availableCompressionFormats),
  );
  if (!acceptedCompressionFormat) {
    return null;
  }

  const fileReadableStream = fileUrlToReadableStream(fileUrl);
  const body =
    await availableCompressionFormats[acceptedCompressionFormat](
      fileReadableStream,
    );

  return {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-encoding": acceptedCompressionFormat,
      "vary": "accept-encoding",
    },
    body,
  };
};

const fileUrlToReadableStream = (fileUrl) => {
  return createReadStream(new URL(fileUrl), {
    emitClose: true,
    autoClose: true,
  });
};

const availableCompressionFormats = {
  br: async (fileReadableStream) => {
    const { createBrotliCompress } = await import("node:zlib");
    return fileReadableStream.pipe(createBrotliCompress());
  },
  deflate: async (fileReadableStream) => {
    const { createDeflate } = await import("node:zlib");
    return fileReadableStream.pipe(createDeflate());
  },
  gzip: async (fileReadableStream) => {
    const { createGzip } = await import("node:zlib");
    return fileReadableStream.pipe(createGzip());
  },
};

const getRawResponse = async ({ fileUrl, fileStat }) => {
  return {
    status: 200,
    headers: {
      "content-type": CONTENT_TYPE.fromUrlExtension(fileUrl),
      "content-length": fileStat.size,
    },
    body: fileUrlToReadableStream(fileUrl),
  };
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toUTCString
const dateToUTCString = (date) => date.toUTCString();

const dateToSecondsPrecision = (date) => {
  const dateWithSecondsPrecision = new Date(date);
  dateWithSecondsPrecision.setMilliseconds(0);
  return dateWithSecondsPrecision;
};

const asUrlString = (value) => {
  if (value instanceof URL) {
    return value.href;
  }
  if (typeof value === "string") {
    if (isFileSystemPath(value)) {
      return fileSystemPathToUrl(value);
    }
    try {
      const urlObject = new URL(value);
      return String(urlObject);
    } catch {
      return null;
    }
  }
  return null;
};

class ProgressiveResponse {
  constructor(responseBodyHandler, { status = 200, statusText, headers } = {}) {
    const contentType = headers ? headers["content-type"] : "text/plain";
    const progressiveResponse = {
      status,
      statusText,
      headers,
      body: createObservable(({ next, complete, addTeardown }) => {
        // we must write something for fetch promise to resolve
        // this is conform to HTTP spec where client expect body to starts writing
        // before resolving response promise client side
        if (CONTENT_TYPE.isTextual(contentType)) {
          next("");
        } else {
          next(new Uint8Array());
        }
        const returnValue = responseBodyHandler({
          write: (data) => {
            next(data);
          },
          end: () => {
            complete();
          },
        });
        if (typeof returnValue === "function") {
          addTeardown(() => {
            returnValue();
          });
        }
      }),
    };
    // eslint-disable-next-line no-constructor-return
    return progressiveResponse;
  }
}

/**
 * @jsenv/server is already registering a route to handle OPTIONS request
 * so here we just need to add the CORS headers to the response
 */

const jsenvAccessControlAllowedHeaders = ["x-requested-with"];

const jsenvAccessControlAllowedMethods = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "OPTIONS",
];

const jsenvServiceCORS = ({
  accessControlAllowedOrigins = [],
  accessControlAllowedMethods = jsenvAccessControlAllowedMethods,
  accessControlAllowedHeaders = jsenvAccessControlAllowedHeaders,
  accessControlAllowRequestOrigin = false,
  accessControlAllowRequestMethod = false,
  accessControlAllowRequestHeaders = false,
  accessControlAllowCredentials = false,
  // by default OPTIONS request can be cache for a long time, it's not going to change soon ?
  // we could put a lot here, see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
  accessControlMaxAge = 600,
  timingAllowOrigin = false,
} = {}) => {
  // TODO: we should check access control params and throw/warn if we find strange values

  const corsEnabled =
    accessControlAllowRequestOrigin || accessControlAllowedOrigins.length;

  if (!corsEnabled) {
    return [];
  }

  return {
    name: "jsenv:cors",
    injectResponseProperties: (request) => {
      const accessControlHeaders = generateAccessControlHeaders({
        request,
        accessControlAllowedOrigins,
        accessControlAllowRequestOrigin,
        accessControlAllowedMethods,
        accessControlAllowRequestMethod,
        accessControlAllowedHeaders,
        accessControlAllowRequestHeaders,
        accessControlAllowCredentials,
        accessControlMaxAge,
        timingAllowOrigin,
      });
      return {
        headers: accessControlHeaders,
      };
    },
  };
};

// https://www.w3.org/TR/cors/
// https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
const generateAccessControlHeaders = ({
  request: { headers },
  accessControlAllowedOrigins,
  accessControlAllowRequestOrigin,
  accessControlAllowedMethods,
  accessControlAllowRequestMethod,
  accessControlAllowedHeaders,
  accessControlAllowRequestHeaders,
  accessControlAllowCredentials,
  // by default OPTIONS request can be cache for a long time, it's not going to change soon ?
  // we could put a lot here, see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
  accessControlMaxAge = 600,
  timingAllowOrigin,
} = {}) => {
  const vary = [];

  const allowedOriginArray = [...accessControlAllowedOrigins];
  if (accessControlAllowRequestOrigin) {
    if ("origin" in headers && headers.origin !== "null") {
      allowedOriginArray.push(headers.origin);
      vary.push("origin");
    } else if ("referer" in headers) {
      allowedOriginArray.push(new URL(headers.referer).origin);
      vary.push("referer");
    } else {
      allowedOriginArray.push("*");
    }
  }

  const allowedMethodArray = [...accessControlAllowedMethods];
  if (
    accessControlAllowRequestMethod &&
    "access-control-request-method" in headers
  ) {
    const requestMethodName = headers["access-control-request-method"];
    if (!allowedMethodArray.includes(requestMethodName)) {
      allowedMethodArray.push(requestMethodName);
      vary.push("access-control-request-method");
    }
  }

  const allowedHeaderArray = [...accessControlAllowedHeaders];
  if (
    accessControlAllowRequestHeaders &&
    "access-control-request-headers" in headers
  ) {
    const requestHeaderNameArray =
      headers["access-control-request-headers"].split(", ");
    requestHeaderNameArray.forEach((headerName) => {
      const headerNameLowerCase = headerName.toLowerCase();
      if (!allowedHeaderArray.includes(headerNameLowerCase)) {
        allowedHeaderArray.push(headerNameLowerCase);
        if (!vary.includes("access-control-request-headers")) {
          vary.push("access-control-request-headers");
        }
      }
    });
  }

  return {
    "access-control-allow-origin": allowedOriginArray.join(", "),
    "access-control-allow-methods": allowedMethodArray.join(", "),
    "access-control-allow-headers": allowedHeaderArray.join(", "),
    ...(accessControlAllowCredentials
      ? { "access-control-allow-credentials": true }
      : {}),
    "access-control-max-age": accessControlMaxAge,
    ...(timingAllowOrigin
      ? { "timing-allow-origin": allowedOriginArray.join(", ") }
      : {}),
    ...(vary.length ? { vary: vary.join(", ") } : {}),
  };
};

const jsenvServiceResponseAcceptanceCheck = () => {
  return {
    name: "jsenv:response_acceptance_check",
    inspectResponse: (request, { response, warn }) => {
      checkResponseAcceptance(request, response, { warn });
    },
  };
};

const checkResponseAcceptance = (request, response, { warn }) => {
  const requestAcceptHeader = request.headers.accept;
  const responseContentTypeHeader = response.headers["content-type"];
  if (
    requestAcceptHeader &&
    responseContentTypeHeader &&
    !pickContentType(request, [responseContentTypeHeader])
  ) {
    warn(`response content type is not in the request accepted content types.
--- response content-type header ---
${responseContentTypeHeader}
--- request accept header ---
${requestAcceptHeader}`);
  }

  const requestAcceptLanguageHeader = request.headers["accept-language"];
  const responseContentLanguageHeader = response.headers["content-language"];
  if (
    requestAcceptLanguageHeader &&
    responseContentLanguageHeader &&
    !pickContentLanguage(request, [responseContentLanguageHeader])
  ) {
    warn(`response language is not in the request accepted language.
--- response content-language header ---
${responseContentLanguageHeader}
--- request accept-language header ---
${requestAcceptLanguageHeader}`);
  }

  const requestAcceptEncodingHeader = request.headers["accept-encoding"];
  const responseContentEncodingHeader = response.headers["content-encoding"];
  if (
    requestAcceptLanguageHeader &&
    responseContentLanguageHeader &&
    !pickContentEncoding(request, [responseContentLanguageHeader])
  ) {
    warn(`response encoding is not in the request accepted encoding.
--- response content-encoding header ---
${responseContentEncodingHeader}
--- request accept-encoding header ---
${requestAcceptEncodingHeader}`);
  }
};

const jsenvServiceRequestAliases = (resourceAliases) => {
  const aliases = {};
  Object.keys(resourceAliases).forEach((key) => {
    aliases[asFileUrl(key)] = asFileUrl(resourceAliases[key]);
  });
  return {
    name: "jsenv:request_aliases",
    redirectRequest: (request) => {
      const resourceBeforeAlias = request.resource;
      const urlAfterAliasing = URL_META.applyAliases({
        url: asFileUrl(request.pathname),
        aliases,
      });
      const resourceAfterAlias = urlAfterAliasing.slice("file://".length);
      if (resourceBeforeAlias === resourceAfterAlias) {
        return null;
      }
      const resource = replaceResource(resourceBeforeAlias, resourceAfterAlias);
      return { resource };
    },
  };
};

const asFileUrl = (specifier) => new URL(specifier, "file:///").href;

const replaceResource = (resourceBeforeAlias, newValue) => {
  const urlObject = new URL(resourceBeforeAlias, "file:///");
  const searchSeparatorIndex = newValue.indexOf("?");
  if (searchSeparatorIndex > -1) {
    return newValue; // let new value override search params
  }
  urlObject.pathname = newValue;
  const resource = `${urlObject.pathname}${urlObject.search}`;
  return resource;
};

export { LazyServerEvents, ProgressiveResponse, STOP_REASON_INTERNAL_ERROR, STOP_REASON_NOT_SPECIFIED, STOP_REASON_PROCESS_BEFORE_EXIT, STOP_REASON_PROCESS_EXIT, STOP_REASON_PROCESS_SIGHUP, STOP_REASON_PROCESS_SIGINT, STOP_REASON_PROCESS_SIGTERM, ServerEvents, WebSocketResponse, composeTwoResponses, createFileSystemFetch, fetchFileSystem, findFreePort, jsenvAccessControlAllowedHeaders, jsenvAccessControlAllowedMethods, jsenvServiceCORS, jsenvServiceErrorHandler, jsenvServiceRequestAliases, jsenvServiceResponseAcceptanceCheck, pickContentEncoding, pickContentLanguage, pickContentType, serveDirectory, startServer };
