import { chmod, stat, lstat, readdir, promises, unlink, openSync, closeSync, rmdir, readFile as readFile$1, writeFile as writeFile$1, writeFileSync as writeFileSync$1, mkdirSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { URL_META, filterV8Coverage } from "./js/v8_coverage.js";
import { pathToFileURL, fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { dirname } from "node:path";
import process$1, { memoryUsage } from "node:process";
import os from "node:os";
import tty from "node:tty";
import stringWidth from "string-width";
import { readGitHubWorkflowEnv, startGithubCheckRun } from "@jsenv/github-check-run";
import { createRequire } from "node:module";
import { spawn, spawnSync, fork } from "node:child_process";
import { createServer } from "node:net";
import v8, { takeCoverage } from "node:v8";
import stripAnsi from "strip-ansi";
import { applyBabelPlugins } from "@jsenv/ast";
import { runInNewContext } from "node:vm";
import wrapAnsi from "wrap-ansi";
import { injectSupervisorIntoHTML, supervisorFileUrl } from "@jsenv/plugin-supervisor";
import { SOURCEMAP, generateSourcemapDataUrl } from "@jsenv/sourcemap";
import { findFreePort } from "@jsenv/server";
import { Worker } from "node:worker_threads";

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
  // this warning is useful but becomes problematic when it's expected
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
    timeout,
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

const urlToScheme = (url) => {
  const urlString = String(url);
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) {
    return "";
  }

  const scheme = urlString.slice(0, colonIndex);
  return scheme;
};

const urlToResource = (url) => {
  const scheme = urlToScheme(url);

  if (scheme === "file") {
    const urlAsStringWithoutFileProtocol = String(url).slice("file://".length);
    return urlAsStringWithoutFileProtocol;
  }

  if (scheme === "https" || scheme === "http") {
    // remove origin
    const afterProtocol = String(url).slice(scheme.length + "://".length);
    const pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
    const urlAsStringWithoutOrigin = afterProtocol.slice(pathnameSlashIndex);
    return urlAsStringWithoutOrigin;
  }

  const urlAsStringWithoutProtocol = String(url).slice(scheme.length + 1);
  return urlAsStringWithoutProtocol;
};

const urlToPathname = (url) => {
  const resource = urlToResource(url);
  const pathname = resourceToPathname(resource);
  return pathname;
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

const urlToExtension = (url) => {
  const pathname = urlToPathname(url);
  return pathnameToExtension(pathname);
};

const pathnameToExtension = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex !== -1) {
    pathname = pathname.slice(slashLastIndex + 1);
  }

  const dotLastIndex = pathname.lastIndexOf(".");
  if (dotLastIndex === -1) return "";
  // if (dotLastIndex === pathname.length - 1) return ""
  const extension = pathname.slice(dotLastIndex);
  return extension;
};

const ensurePathnameTrailingSlash = (url) => {
  const urlObject = new URL(url);
  const { pathname } = urlObject;
  if (pathname.endsWith("/")) {
    return url;
  }
  let { origin } = urlObject;
  // origin is "null" for "file://" urls with Node.js
  if (origin === "null" && urlObject.href.startsWith("file:")) {
    origin = "file://";
  }
  const { search, hash } = urlObject;
  return `${origin}${pathname}/${search}${hash}`;
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
    throw new Error(`value must be a filesystem path, got ${value}`);
  }
  return String(pathToFileURL(value));
};

const resolveUrl = (specifier, baseUrl) => {
  if (typeof baseUrl === "undefined") {
    throw new TypeError(`baseUrl missing to resolve ${specifier}`);
  }
  return String(new URL(specifier, baseUrl));
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

const urlToRelativeUrl = (url, baseUrl) => {
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
  return relativeUrl;
};

const pathnameToParentPathname = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return "/";
  }
  return pathname.slice(0, slashLastIndex + 1);
};

const moveUrl = ({ url, from, to, preferRelative }) => {
  let relativeUrl = urlToRelativeUrl(url, from);
  if (relativeUrl.slice(0, 2) === "//") {
    // restore the protocol
    relativeUrl = new URL(relativeUrl, url).href;
  }
  const absoluteUrl = new URL(relativeUrl, to).href;
  if (preferRelative) {
    return urlToRelativeUrl(absoluteUrl, to);
  }
  return absoluteUrl;
};

const urlIsInsideOf = (url, otherUrl) => {
  const urlObject = new URL(url);
  const otherUrlObject = new URL(otherUrl);

  if (urlObject.origin !== otherUrlObject.origin) {
    return false;
  }

  const urlPathname = urlObject.pathname;
  const otherUrlPathname = otherUrlObject.pathname;
  if (urlPathname === otherUrlPathname) {
    return false;
  }

  const isInside = urlPathname.startsWith(otherUrlPathname);
  return isInside;
};

const urlToFileSystemPath = (url) => {
  let urlString = String(url);
  if (urlString[urlString.length - 1] === "/") {
    // remove trailing / so that nodejs path becomes predictable otherwise it logs
    // the trailing slash on linux but does not on windows
    urlString = urlString.slice(0, -1);
  }
  const fileSystemPath = fileURLToPath(urlString);
  return fileSystemPath;
};

const validateDirectoryUrl = (value) => {
  let urlString;

  if (value instanceof URL) {
    urlString = value.href;
  } else if (typeof value === "string") {
    if (isFileSystemPath(value)) {
      urlString = fileSystemPathToUrl(value);
    } else {
      try {
        urlString = String(new URL(value));
      } catch (e) {
        return {
          valid: false,
          value,
          message: `must be a valid url`,
        };
      }
    }
  } else {
    return {
      valid: false,
      value,
      message: `must be a string or an url`,
    };
  }
  if (!urlString.startsWith("file://")) {
    return {
      valid: false,
      value,
      message: 'must start with "file://"',
    };
  }
  return {
    valid: true,
    value: ensurePathnameTrailingSlash(urlString),
  };
};

const assertAndNormalizeDirectoryUrl = (
  directoryUrl,
  name = "directoryUrl",
) => {
  const { valid, message, value } = validateDirectoryUrl(directoryUrl);
  if (!valid) {
    throw new TypeError(`${name} ${message}, got ${value}`);
  }
  return value;
};

const validateFileUrl = (value, baseUrl) => {
  let urlString;

  if (value instanceof URL) {
    urlString = value.href;
  } else if (typeof value === "string") {
    if (isFileSystemPath(value)) {
      urlString = fileSystemPathToUrl(value);
    } else {
      try {
        urlString = String(new URL(value, baseUrl));
      } catch (e) {
        return {
          valid: false,
          value,
          message: "must be a valid url",
        };
      }
    }
  } else {
    return {
      valid: false,
      value,
      message: "must be a string or an url",
    };
  }

  if (!urlString.startsWith("file://")) {
    return {
      valid: false,
      value,
      message: 'must start with "file://"',
    };
  }

  return {
    valid: true,
    value: urlString,
  };
};

const assertAndNormalizeFileUrl = (
  fileUrl,
  baseUrl,
  name = "fileUrl",
) => {
  const { valid, message, value } = validateFileUrl(fileUrl, baseUrl);
  if (!valid) {
    throw new TypeError(`${name} ${message}, got ${fileUrl}`);
  }
  return value;
};

const statsToType = (stats) => {
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  if (stats.isSymbolicLink()) return "symbolic-link";
  if (stats.isFIFO()) return "fifo";
  if (stats.isSocket()) return "socket";
  if (stats.isCharacterDevice()) return "character-device";
  if (stats.isBlockDevice()) return "block-device";
  return undefined;
};

// https://github.com/coderaiser/cloudcmd/issues/63#issuecomment-195478143
// https://nodejs.org/api/fs.html#fs_file_modes
// https://github.com/TooTallNate/stat-mode

// cannot get from fs.constants because they are not available on windows
const S_IRUSR = 256; /* 0000400 read permission, owner */
const S_IWUSR = 128; /* 0000200 write permission, owner */
const S_IXUSR = 64; /* 0000100 execute/search permission, owner */
const S_IRGRP = 32; /* 0000040 read permission, group */
const S_IWGRP = 16; /* 0000020 write permission, group */
const S_IXGRP = 8; /* 0000010 execute/search permission, group */
const S_IROTH = 4; /* 0000004 read permission, others */
const S_IWOTH = 2; /* 0000002 write permission, others */
const S_IXOTH = 1; /* 0000001 execute/search permission, others */

const permissionsToBinaryFlags = ({ owner, group, others }) => {
  let binaryFlags = 0;

  if (owner.read) binaryFlags |= S_IRUSR;
  if (owner.write) binaryFlags |= S_IWUSR;
  if (owner.execute) binaryFlags |= S_IXUSR;

  if (group.read) binaryFlags |= S_IRGRP;
  if (group.write) binaryFlags |= S_IWGRP;
  if (group.execute) binaryFlags |= S_IXGRP;

  if (others.read) binaryFlags |= S_IROTH;
  if (others.write) binaryFlags |= S_IWOTH;
  if (others.execute) binaryFlags |= S_IXOTH;

  return binaryFlags;
};

const writeEntryPermissions = async (source, permissions) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);

  let binaryFlags;
  if (typeof permissions === "object") {
    permissions = {
      owner: {
        read: getPermissionOrComputeDefault("read", "owner", permissions),
        write: getPermissionOrComputeDefault("write", "owner", permissions),
        execute: getPermissionOrComputeDefault("execute", "owner", permissions),
      },
      group: {
        read: getPermissionOrComputeDefault("read", "group", permissions),
        write: getPermissionOrComputeDefault("write", "group", permissions),
        execute: getPermissionOrComputeDefault("execute", "group", permissions),
      },
      others: {
        read: getPermissionOrComputeDefault("read", "others", permissions),
        write: getPermissionOrComputeDefault("write", "others", permissions),
        execute: getPermissionOrComputeDefault(
          "execute",
          "others",
          permissions,
        ),
      },
    };
    binaryFlags = permissionsToBinaryFlags(permissions);
  } else {
    binaryFlags = permissions;
  }

  return new Promise((resolve, reject) => {
    chmod(new URL(sourceUrl), binaryFlags, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

const actionLevels = { read: 0, write: 1, execute: 2 };
const subjectLevels = { others: 0, group: 1, owner: 2 };

const getPermissionOrComputeDefault = (action, subject, permissions) => {
  if (subject in permissions) {
    const subjectPermissions = permissions[subject];
    if (action in subjectPermissions) {
      return subjectPermissions[action];
    }

    const actionLevel = actionLevels[action];
    const actionFallback = Object.keys(actionLevels).find(
      (actionFallbackCandidate) =>
        actionLevels[actionFallbackCandidate] > actionLevel &&
        actionFallbackCandidate in subjectPermissions,
    );
    if (actionFallback) {
      return subjectPermissions[actionFallback];
    }
  }

  const subjectLevel = subjectLevels[subject];
  // do we have a subject with a stronger level (group or owner)
  // where we could read the action permission ?
  const subjectFallback = Object.keys(subjectLevels).find(
    (subjectFallbackCandidate) =>
      subjectLevels[subjectFallbackCandidate] > subjectLevel &&
      subjectFallbackCandidate in permissions,
  );
  if (subjectFallback) {
    const subjectPermissions = permissions[subjectFallback];
    return action in subjectPermissions
      ? subjectPermissions[action]
      : getPermissionOrComputeDefault(action, subjectFallback, permissions);
  }

  return false;
};

/*
 * - stats object documentation on Node.js
 *   https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_class_fs_stats
 */


const isWindows$2 = process.platform === "win32";

const readEntryStat = async (
  source,
  { nullIfNotFound = false, followLink = true } = {},
) => {
  let sourceUrl = assertAndNormalizeFileUrl(source);
  if (sourceUrl.endsWith("/")) sourceUrl = sourceUrl.slice(0, -1);

  const sourcePath = urlToFileSystemPath(sourceUrl);

  const handleNotFoundOption = nullIfNotFound
    ? {
        handleNotFoundError: () => null,
      }
    : {};

  return readStat(sourcePath, {
    followLink,
    ...handleNotFoundOption,
    ...(isWindows$2
      ? {
          // Windows can EPERM on stat
          handlePermissionDeniedError: async (error) => {
            console.error(
              `trying to fix windows EPERM after stats on ${sourcePath}`,
            );

            try {
              // unfortunately it means we mutate the permissions
              // without being able to restore them to the previous value
              // (because reading current permission would also throw)
              await writeEntryPermissions(sourceUrl, 0o666);
              const stats = await readStat(sourcePath, {
                followLink,
                ...handleNotFoundOption,
                // could not fix the permission error, give up and throw original error
                handlePermissionDeniedError: () => {
                  console.error(`still got EPERM after stats on ${sourcePath}`);
                  throw error;
                },
              });
              return stats;
            } catch (e) {
              console.error(
                `error while trying to fix windows EPERM after stats on ${sourcePath}: ${e.stack}`,
              );
              throw error;
            }
          },
        }
      : {}),
  });
};

const readStat = (
  sourcePath,
  {
    followLink,
    handleNotFoundError = null,
    handlePermissionDeniedError = null,
  } = {},
) => {
  const nodeMethod = followLink ? stat : lstat;

  return new Promise((resolve, reject) => {
    nodeMethod(sourcePath, (error, statsObject) => {
      if (error) {
        if (handleNotFoundError && error.code === "ENOENT") {
          resolve(handleNotFoundError(error));
        } else if (
          handlePermissionDeniedError &&
          (error.code === "EPERM" || error.code === "EACCES")
        ) {
          resolve(handlePermissionDeniedError(error));
        } else {
          reject(error);
        }
      } else {
        resolve(statsObject);
      }
    });
  });
};

const readDirectory = async (url, { emfileMaxWait = 1000 } = {}) => {
  const directoryUrl = assertAndNormalizeDirectoryUrl(url);
  const directoryUrlObject = new URL(directoryUrl);
  const startMs = Date.now();
  let attemptCount = 0;

  const attempt = async () => {
    try {
      const names = await new Promise((resolve, reject) => {
        readdir(directoryUrlObject, (error, names) => {
          if (error) {
            reject(error);
          } else {
            resolve(names);
          }
        });
      });
      return names.map(encodeURIComponent);
    } catch (e) {
      // https://nodejs.org/dist/latest-v13.x/docs/api/errors.html#errors_common_system_errors
      if (e.code === "EMFILE" || e.code === "ENFILE") {
        attemptCount++;
        const nowMs = Date.now();
        const timeSpentWaiting = nowMs - startMs;
        if (timeSpentWaiting > emfileMaxWait) {
          throw e;
        }
        await new Promise((resolve) => setTimeout(resolve), attemptCount);
        return await attempt();
      }
      throw e;
    }
  };

  return attempt();
};

const comparePathnames = (leftPathame, rightPathname) => {
  const leftPartArray = leftPathame.split("/");
  const rightPartArray = rightPathname.split("/");

  const leftLength = leftPartArray.length;
  const rightLength = rightPartArray.length;

  const maxLength = Math.max(leftLength, rightLength);
  let i = 0;
  while (i < maxLength) {
    const leftPartExists = i in leftPartArray;
    const rightPartExists = i in rightPartArray;

    // longer comes first
    if (!leftPartExists) {
      return +1;
    }
    if (!rightPartExists) {
      return -1;
    }

    const leftPartIsLast = i === leftPartArray.length - 1;
    const rightPartIsLast = i === rightPartArray.length - 1;
    // folder comes first
    if (leftPartIsLast && !rightPartIsLast) {
      return +1;
    }
    if (!leftPartIsLast && rightPartIsLast) {
      return -1;
    }

    const leftPart = leftPartArray[i];
    const rightPart = rightPartArray[i];
    i++;
    // local comparison comes first
    const comparison = leftPart.localeCompare(rightPart);
    if (comparison !== 0) {
      return comparison;
    }
  }

  if (leftLength < rightLength) {
    return +1;
  }
  if (leftLength > rightLength) {
    return -1;
  }
  return 0;
};

const collectFiles = async ({
  signal = new AbortController().signal,
  directoryUrl,
  associations,
  predicate,
}) => {
  const rootDirectoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl);
  if (typeof predicate !== "function") {
    throw new TypeError(`predicate must be a function, got ${predicate}`);
  }
  associations = URL_META.resolveAssociations(associations, rootDirectoryUrl);

  const collectOperation = Abort.startOperation();
  collectOperation.addAbortSignal(signal);

  const matchingFileResultArray = [];
  const visitDirectory = async (directoryUrl) => {
    collectOperation.throwIfAborted();
    const directoryItems = await readDirectory(directoryUrl);

    await Promise.all(
      directoryItems.map(async (directoryItem) => {
        const directoryChildNodeUrl = `${directoryUrl}${directoryItem}`;
        collectOperation.throwIfAborted();
        const directoryChildNodeStats = await readEntryStat(
          directoryChildNodeUrl,
          {
            // we ignore symlink because recursively traversed
            // so symlinked file will be discovered.
            // Moreover if they lead outside of directoryPath it can become a problem
            // like infinite recursion of whatever.
            // that we could handle using an object of pathname already seen but it will be useless
            // because directoryPath is recursively traversed
            followLink: false,
          },
        );

        if (directoryChildNodeStats.isDirectory()) {
          const subDirectoryUrl = `${directoryChildNodeUrl}/`;
          if (
            !URL_META.urlChildMayMatch({
              url: subDirectoryUrl,
              associations,
              predicate,
            })
          ) {
            return;
          }
          await visitDirectory(subDirectoryUrl);
          return;
        }

        if (directoryChildNodeStats.isFile()) {
          const meta = URL_META.applyAssociations({
            url: directoryChildNodeUrl,
            associations,
          });
          if (!predicate(meta)) return;

          const relativeUrl = urlToRelativeUrl(
            directoryChildNodeUrl,
            rootDirectoryUrl,
          );
          matchingFileResultArray.push({
            url: new URL(relativeUrl, rootDirectoryUrl).href,
            relativeUrl: decodeURIComponent(relativeUrl),
            meta,
            fileStats: directoryChildNodeStats,
          });
          return;
        }
      }),
    );
  };

  try {
    await visitDirectory(rootDirectoryUrl);

    // When we operate on thoose files later it feels more natural
    // to perform operation in the same order they appear in the filesystem.
    // It also allow to get a predictable return value.
    // For that reason we sort matchingFileResultArray
    matchingFileResultArray.sort((leftFile, rightFile) => {
      return comparePathnames(leftFile.relativeUrl, rightFile.relativeUrl);
    });
    return matchingFileResultArray;
  } finally {
    await collectOperation.end();
  }
};

// https://nodejs.org/dist/latest-v13.x/docs/api/fs.html#fs_fspromises_mkdir_path_options
const { mkdir } = promises;

const writeDirectory = async (
  destination,
  { recursive = true, allowUseless = false } = {},
) => {
  const destinationUrl = assertAndNormalizeDirectoryUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);

  const destinationStats = await readEntryStat(destinationUrl, {
    nullIfNotFound: true,
    followLink: false,
  });

  if (destinationStats) {
    if (destinationStats.isDirectory()) {
      if (allowUseless) {
        return;
      }
      throw new Error(`directory already exists at ${destinationPath}`);
    }

    const destinationType = statsToType(destinationStats);
    throw new Error(
      `cannot write directory at ${destinationPath} because there is a ${destinationType}`,
    );
  }

  try {
    await mkdir(destinationPath, { recursive });
  } catch (error) {
    if (allowUseless && error.code === "EEXIST") {
      return;
    }
    throw error;
  }
};

const removeEntry = async (
  source,
  {
    signal = new AbortController().signal,
    allowUseless = false,
    recursive = false,
    maxRetries = 3,
    retryDelay = 100,
    onlyContent = false,
  } = {},
) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);

  const removeOperation = Abort.startOperation();
  removeOperation.addAbortSignal(signal);

  try {
    removeOperation.throwIfAborted();
    const sourceStats = await readEntryStat(sourceUrl, {
      nullIfNotFound: true,
      followLink: false,
    });
    if (!sourceStats) {
      if (allowUseless) {
        return;
      }
      throw new Error(`nothing to remove at ${urlToFileSystemPath(sourceUrl)}`);
    }

    // https://nodejs.org/dist/latest-v13.x/docs/api/fs.html#fs_class_fs_stats
    // FIFO and socket are ignored, not sure what they are exactly and what to do with them
    // other libraries ignore them, let's do the same.
    if (
      sourceStats.isFile() ||
      sourceStats.isSymbolicLink() ||
      sourceStats.isCharacterDevice() ||
      sourceStats.isBlockDevice()
    ) {
      await removeNonDirectory(
        sourceUrl.endsWith("/") ? sourceUrl.slice(0, -1) : sourceUrl,
        {
          maxRetries,
          retryDelay,
        },
      );
    } else if (sourceStats.isDirectory()) {
      await removeDirectory(ensurePathnameTrailingSlash(sourceUrl), {
        signal: removeOperation.signal,
        recursive,
        maxRetries,
        retryDelay,
        onlyContent,
      });
    }
  } finally {
    await removeOperation.end();
  }
};

const removeNonDirectory = (sourceUrl, { maxRetries, retryDelay }) => {
  const sourcePath = urlToFileSystemPath(sourceUrl);

  let retryCount = 0;
  const attempt = () => {
    return unlinkNaive(sourcePath, {
      ...(retryCount >= maxRetries
        ? {}
        : {
            handleTemporaryError: async () => {
              retryCount++;
              return new Promise((resolve) => {
                setTimeout(() => {
                  resolve(attempt());
                }, retryCount * retryDelay);
              });
            },
          }),
    });
  };
  return attempt();
};

const unlinkNaive = (sourcePath, { handleTemporaryError = null } = {}) => {
  return new Promise((resolve, reject) => {
    unlink(sourcePath, (error) => {
      if (error) {
        if (error.code === "ENOENT") {
          resolve();
        } else if (
          handleTemporaryError &&
          (error.code === "EBUSY" ||
            error.code === "EMFILE" ||
            error.code === "ENFILE" ||
            error.code === "ENOENT")
        ) {
          resolve(handleTemporaryError(error));
        } else {
          reject(error);
        }
      } else {
        resolve();
      }
    });
  });
};

const removeDirectory = async (
  rootDirectoryUrl,
  { signal, maxRetries, retryDelay, recursive, onlyContent },
) => {
  const removeDirectoryOperation = Abort.startOperation();
  removeDirectoryOperation.addAbortSignal(signal);

  const visit = async (sourceUrl) => {
    removeDirectoryOperation.throwIfAborted();
    const sourceStats = await readEntryStat(sourceUrl, {
      nullIfNotFound: true,
      followLink: false,
    });

    // file/directory not found
    if (sourceStats === null) {
      return;
    }

    if (
      sourceStats.isFile() ||
      sourceStats.isCharacterDevice() ||
      sourceStats.isBlockDevice()
    ) {
      await visitFile(sourceUrl);
    } else if (sourceStats.isSymbolicLink()) {
      await visitSymbolicLink(sourceUrl);
    } else if (sourceStats.isDirectory()) {
      await visitDirectory(`${sourceUrl}/`);
    }
  };

  const visitDirectory = async (directoryUrl) => {
    const directoryPath = urlToFileSystemPath(directoryUrl);
    const optionsFromRecursive = recursive
      ? {
          handleNotEmptyError: async () => {
            await removeDirectoryContent(directoryUrl);
            await visitDirectory(directoryUrl);
          },
        }
      : {};
    removeDirectoryOperation.throwIfAborted();
    await removeDirectoryNaive(directoryPath, {
      ...optionsFromRecursive,
      // Workaround for https://github.com/joyent/node/issues/4337
      ...(process.platform === "win32"
        ? {
            handlePermissionError: async (error) => {
              console.error(
                `trying to fix windows EPERM after readir on ${directoryPath}`,
              );

              let openOrCloseError;
              try {
                const fd = openSync(directoryPath);
                closeSync(fd);
              } catch (e) {
                openOrCloseError = e;
              }

              if (openOrCloseError) {
                if (openOrCloseError.code === "ENOENT") {
                  return;
                }
                console.error(
                  `error while trying to fix windows EPERM after readir on ${directoryPath}: ${openOrCloseError.stack}`,
                );
                throw error;
              }

              await removeDirectoryNaive(directoryPath, {
                ...optionsFromRecursive,
              });
            },
          }
        : {}),
    });
  };

  const removeDirectoryContent = async (directoryUrl) => {
    removeDirectoryOperation.throwIfAborted();
    const names = await readDirectory(directoryUrl);
    await Promise.all(
      names.map(async (name) => {
        const url = resolveUrl(name, directoryUrl);
        await visit(url);
      }),
    );
  };

  const visitFile = async (fileUrl) => {
    await removeNonDirectory(fileUrl, { maxRetries, retryDelay });
  };

  const visitSymbolicLink = async (symbolicLinkUrl) => {
    await removeNonDirectory(symbolicLinkUrl, { maxRetries, retryDelay });
  };

  try {
    if (onlyContent) {
      await removeDirectoryContent(rootDirectoryUrl);
    } else {
      await visitDirectory(rootDirectoryUrl);
    }
  } finally {
    await removeDirectoryOperation.end();
  }
};

const removeDirectoryNaive = (
  directoryPath,
  { handleNotEmptyError = null, handlePermissionError = null } = {},
) => {
  return new Promise((resolve, reject) => {
    rmdir(directoryPath, (error, lstatObject) => {
      if (error) {
        if (handlePermissionError && error.code === "EPERM") {
          resolve(handlePermissionError(error));
        } else if (error.code === "ENOENT") {
          resolve();
        } else if (
          handleNotEmptyError &&
          // linux os
          (error.code === "ENOTEMPTY" ||
            // SunOS
            error.code === "EEXIST")
        ) {
          resolve(handleNotEmptyError(error));
        } else {
          reject(error);
        }
      } else {
        resolve(lstatObject);
      }
    });
  });
};

const ensureEmptyDirectory = async (source) => {
  const stats = await readEntryStat(source, {
    nullIfNotFound: true,
    followLink: false,
  });
  if (stats === null) {
    // if there is nothing, create a directory
    return writeDirectory(source, { allowUseless: true });
  }
  if (stats.isDirectory()) {
    // if there is a directory remove its content and done
    return removeEntry(source, {
      allowUseless: true,
      recursive: true,
      onlyContent: true,
    });
  }

  const sourceType = statsToType(stats);
  const sourcePath = urlToFileSystemPath(assertAndNormalizeFileUrl(source));
  throw new Error(
    `ensureEmptyDirectory expect directory at ${sourcePath}, found ${sourceType} instead`,
  );
};

const ensureParentDirectories = async (destination) => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);
  const destinationParentPath = dirname(destinationPath);

  return writeDirectory(destinationParentPath, {
    recursive: true,
    allowUseless: true,
  });
};

const isWindows$1 = process.platform === "win32";
const baseUrlFallback = fileSystemPathToUrl(process.cwd());

/**
 * Some url might be resolved or remapped to url without the windows drive letter.
 * For instance
 * new URL('/foo.js', 'file:///C:/dir/file.js')
 * resolves to
 * 'file:///foo.js'
 *
 * But on windows it becomes a problem because we need the drive letter otherwise
 * url cannot be converted to a filesystem path.
 *
 * ensureWindowsDriveLetter ensure a resolved url still contains the drive letter.
 */

const ensureWindowsDriveLetter = (url, baseUrl) => {
  try {
    url = String(new URL(url));
  } catch (e) {
    throw new Error(`absolute url expected but got ${url}`);
  }

  if (!isWindows$1) {
    return url;
  }

  try {
    baseUrl = String(new URL(baseUrl));
  } catch (e) {
    throw new Error(
      `absolute baseUrl expected but got ${baseUrl} to ensure windows drive letter on ${url}`,
    );
  }

  if (!url.startsWith("file://")) {
    return url;
  }
  const afterProtocol = url.slice("file://".length);
  // we still have the windows drive letter
  if (extractDriveLetter(afterProtocol)) {
    return url;
  }

  // drive letter was lost, restore it
  const baseUrlOrFallback = baseUrl.startsWith("file://")
    ? baseUrl
    : baseUrlFallback;
  const driveLetter = extractDriveLetter(
    baseUrlOrFallback.slice("file://".length),
  );
  if (!driveLetter) {
    throw new Error(
      `drive letter expected on baseUrl but got ${baseUrl} to ensure windows drive letter on ${url}`,
    );
  }
  return `file:///${driveLetter}:${afterProtocol}`;
};

const extractDriveLetter = (resource) => {
  // we still have the windows drive letter
  if (/[a-zA-Z]/.test(resource[1]) && resource[2] === ":") {
    return resource[1];
  }
  return null;
};

process.platform === "win32";

const readFile = async (value, { as = "buffer" } = {}) => {
  const fileUrl = assertAndNormalizeFileUrl(value);
  const buffer = await new Promise((resolve, reject) => {
    readFile$1(new URL(fileUrl), (error, buffer) => {
      if (error) {
        reject(error);
      } else {
        resolve(buffer);
      }
    });
  });
  if (as === "buffer") {
    return buffer;
  }
  if (as === "string") {
    return buffer.toString();
  }
  if (as === "json") {
    return JSON.parse(buffer.toString());
  }
  throw new Error(
    `"as" must be one of "buffer","string","json" received "${as}"`,
  );
};

process.platform === "win32";

process.platform === "linux";

const writeFile = async (destination, content = "") => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationUrlObject = new URL(destinationUrl);
  try {
    await writeFileNaive(destinationUrlObject, content);
  } catch (error) {
    if (error.code === "ENOENT") {
      await ensureParentDirectories(destinationUrl);
      await writeFileNaive(destinationUrlObject, content);
      return;
    }
    throw error;
  }
};

const writeFileNaive = (urlObject, content) => {
  return new Promise((resolve, reject) => {
    writeFile$1(urlObject, content, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

const writeFileSync = (destination, content = "") => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationUrlObject = new URL(destinationUrl);
  try {
    writeFileSync$1(destinationUrlObject, content);
  } catch (error) {
    if (error.code === "ENOENT") {
      mkdirSync(new URL("./", destinationUrlObject), {
        recursive: true,
      });
      writeFileSync$1(destinationUrlObject, content);
      return;
    }
    throw error;
  }
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

// From: https://github.com/sindresorhus/has-flag/blob/main/index.js
/// function hasFlag(flag, argv = globalThis.Deno?.args ?? process.argv) {
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : process$1.argv) {
	const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');
	const position = argv.indexOf(prefix + flag);
	const terminatorPosition = argv.indexOf('--');
	return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}

const {env} = process$1;

let flagForceColor;
if (
	hasFlag('no-color')
	|| hasFlag('no-colors')
	|| hasFlag('color=false')
	|| hasFlag('color=never')
) {
	flagForceColor = 0;
} else if (
	hasFlag('color')
	|| hasFlag('colors')
	|| hasFlag('color=true')
	|| hasFlag('color=always')
) {
	flagForceColor = 1;
}

function envForceColor() {
	if ('FORCE_COLOR' in env) {
		if (env.FORCE_COLOR === 'true') {
			return 1;
		}

		if (env.FORCE_COLOR === 'false') {
			return 0;
		}

		return env.FORCE_COLOR.length === 0 ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
	}
}

function translateLevel(level) {
	if (level === 0) {
		return false;
	}

	return {
		level,
		hasBasic: true,
		has256: level >= 2,
		has16m: level >= 3,
	};
}

function _supportsColor(haveStream, {streamIsTTY, sniffFlags = true} = {}) {
	const noFlagForceColor = envForceColor();
	if (noFlagForceColor !== undefined) {
		flagForceColor = noFlagForceColor;
	}

	const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;

	if (forceColor === 0) {
		return 0;
	}

	if (sniffFlags) {
		if (hasFlag('color=16m')
			|| hasFlag('color=full')
			|| hasFlag('color=truecolor')) {
			return 3;
		}

		if (hasFlag('color=256')) {
			return 2;
		}
	}

	// Check for Azure DevOps pipelines.
	// Has to be above the `!streamIsTTY` check.
	if ('TF_BUILD' in env && 'AGENT_NAME' in env) {
		return 1;
	}

	if (haveStream && !streamIsTTY && forceColor === undefined) {
		return 0;
	}

	const min = forceColor || 0;

	if (env.TERM === 'dumb') {
		return min;
	}

	if (process$1.platform === 'win32') {
		// Windows 10 build 10586 is the first Windows release that supports 256 colors.
		// Windows 10 build 14931 is the first release that supports 16m/TrueColor.
		const osRelease = os.release().split('.');
		if (
			Number(osRelease[0]) >= 10
			&& Number(osRelease[2]) >= 10_586
		) {
			return Number(osRelease[2]) >= 14_931 ? 3 : 2;
		}

		return 1;
	}

	if ('CI' in env) {
		if ('GITHUB_ACTIONS' in env || 'GITEA_ACTIONS' in env) {
			return 3;
		}

		if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'BUILDKITE', 'DRONE'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
			return 1;
		}

		return min;
	}

	if ('TEAMCITY_VERSION' in env) {
		return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
	}

	if (env.COLORTERM === 'truecolor') {
		return 3;
	}

	if (env.TERM === 'xterm-kitty') {
		return 3;
	}

	if ('TERM_PROGRAM' in env) {
		const version = Number.parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

		switch (env.TERM_PROGRAM) {
			case 'iTerm.app': {
				return version >= 3 ? 3 : 2;
			}

			case 'Apple_Terminal': {
				return 2;
			}
			// No default
		}
	}

	if (/-256(color)?$/i.test(env.TERM)) {
		return 2;
	}

	if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
		return 1;
	}

	if ('COLORTERM' in env) {
		return 1;
	}

	return min;
}

function createSupportsColor(stream, options = {}) {
	const level = _supportsColor(stream, {
		streamIsTTY: stream && stream.isTTY,
		...options,
	});

	return translateLevel(level);
}

({
	stdout: createSupportsColor({isTTY: tty.isatty(1)}),
	stderr: createSupportsColor({isTTY: tty.isatty(2)}),
});

const processSupportsBasicColor = createSupportsColor(process.stdout).hasBasic;
let canUseColors = processSupportsBasicColor;

// GitHub workflow does support ANSI but "supports-color" returns false
// because stream.isTTY returns false, see https://github.com/actions/runner/issues/241
if (process.env.GITHUB_WORKFLOW) {
  // Check on FORCE_COLOR is to ensure it is prio over GitHub workflow check
  if (process.env.FORCE_COLOR !== "false") {
    // in unit test we use process.env.FORCE_COLOR = 'false' to fake
    // that colors are not supported. Let it have priority
    canUseColors = true;
  }
}

// https://github.com/Marak/colors.js/blob/master/lib/styles.js
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const GREY = "\x1b[90m";
const RESET = "\x1b[0m";

const setANSIColor = canUseColors
  ? (text, ANSI_COLOR) => `${ANSI_COLOR}${text}${RESET}`
  : (text) => text;

const ANSI = {
  supported: canUseColors,

  RED,
  GREEN,
  YELLOW,
  BLUE,
  MAGENTA,
  GREY,
  RESET,

  color: setANSIColor,
};

function isUnicodeSupported() {
	if (process$1.platform !== 'win32') {
		return process$1.env.TERM !== 'linux'; // Linux console (kernel)
	}

	return Boolean(process$1.env.CI)
		|| Boolean(process$1.env.WT_SESSION) // Windows Terminal
		|| Boolean(process$1.env.TERMINUS_SUBLIME) // Terminus (<0.2.27)
		|| process$1.env.ConEmuTask === '{cmd::Cmder}' // ConEmu and cmder
		|| process$1.env.TERM_PROGRAM === 'Terminus-Sublime'
		|| process$1.env.TERM_PROGRAM === 'vscode'
		|| process$1.env.TERM === 'xterm-256color'
		|| process$1.env.TERM === 'alacritty'
		|| process$1.env.TERMINAL_EMULATOR === 'JetBrains-JediTerm';
}

// see also https://github.com/sindresorhus/figures


const canUseUnicode = isUnicodeSupported();

const COMMAND_RAW = canUseUnicode ? `❯` : `>`;
const OK_RAW = canUseUnicode ? `✔` : `√`;
const FAILURE_RAW = canUseUnicode ? `✖` : `×`;
const DEBUG_RAW = canUseUnicode ? `◆` : `♦`;
const INFO_RAW = canUseUnicode ? `ℹ` : `i`;
const WARNING_RAW = canUseUnicode ? `⚠` : `‼`;
const CIRCLE_CROSS_RAW = canUseUnicode ? `ⓧ` : `(×)`;

const COMMAND = ANSI.color(COMMAND_RAW, ANSI.GREY); // ANSI_MAGENTA)
const OK = ANSI.color(OK_RAW, ANSI.GREEN);
const FAILURE = ANSI.color(FAILURE_RAW, ANSI.RED);
const DEBUG = ANSI.color(DEBUG_RAW, ANSI.GREY);
const INFO = ANSI.color(INFO_RAW, ANSI.BLUE);
const WARNING = ANSI.color(WARNING_RAW, ANSI.YELLOW);
const CIRCLE_CROSS = ANSI.color(CIRCLE_CROSS_RAW, ANSI.RED);

const UNICODE = {
  COMMAND,
  OK,
  FAILURE,
  DEBUG,
  INFO,
  WARNING,
  CIRCLE_CROSS,

  COMMAND_RAW,
  OK_RAW,
  FAILURE_RAW,
  DEBUG_RAW,
  INFO_RAW,
  WARNING_RAW,
  CIRCLE_CROSS_RAW,

  supported: canUseUnicode,
};

const createDetailedMessage = (message, details = {}) => {
  let string = `${message}`;

  Object.keys(details).forEach((key) => {
    const value = details[key];
    string += `
--- ${key} ---
${
  Array.isArray(value)
    ? value.join(`
`)
    : value
}`;
  });

  return string;
};

const setRoundedPrecision = (
  number,
  { decimals = 1, decimalsWhenSmall = decimals } = {},
) => {
  return setDecimalsPrecision(number, {
    decimals,
    decimalsWhenSmall,
    transform: Math.round,
  });
};

const setDecimalsPrecision = (
  number,
  {
    transform,
    decimals, // max decimals for number in [-Infinity, -1[]1, Infinity]
    decimalsWhenSmall, // max decimals for number in [-1,1]
  } = {},
) => {
  if (number === 0) {
    return 0;
  }
  let numberCandidate = Math.abs(number);
  if (numberCandidate < 1) {
    const integerGoal = Math.pow(10, decimalsWhenSmall - 1);
    let i = 1;
    while (numberCandidate < integerGoal) {
      numberCandidate *= 10;
      i *= 10;
    }
    const asInteger = transform(numberCandidate);
    const asFloat = asInteger / i;
    return number < 0 ? -asFloat : asFloat;
  }
  const coef = Math.pow(10, decimals);
  const numberMultiplied = (number + Number.EPSILON) * coef;
  const asInteger = transform(numberMultiplied);
  const asFloat = asInteger / coef;
  return number < 0 ? -asFloat : asFloat;
};

// https://www.codingem.com/javascript-how-to-limit-decimal-places/
// export const roundNumber = (number, maxDecimals) => {
//   const decimalsExp = Math.pow(10, maxDecimals)
//   const numberRoundInt = Math.round(decimalsExp * (number + Number.EPSILON))
//   const numberRoundFloat = numberRoundInt / decimalsExp
//   return numberRoundFloat
// }

// export const setPrecision = (number, precision) => {
//   if (Math.floor(number) === number) return number
//   const [int, decimals] = number.toString().split(".")
//   if (precision <= 0) return int
//   const numberTruncated = `${int}.${decimals.slice(0, precision)}`
//   return numberTruncated
// }

const msAsEllapsedTime = (ms) => {
  if (ms < 1000) {
    return "0 second";
  }
  const { primary, remaining } = parseMs(ms);
  if (!remaining) {
    return formatEllapsedUnit(primary);
  }
  return `${formatEllapsedUnit(primary)} and ${formatEllapsedUnit(remaining)}`;
};

const formatEllapsedUnit = (unit) => {
  const count =
    unit.name === "second" ? Math.floor(unit.count) : Math.round(unit.count);

  if (count <= 1) {
    return `${count} ${unit.name}`;
  }
  return `${count} ${unit.name}s`;
};

const msAsDuration = (ms) => {
  // ignore ms below meaningfulMs so that:
  // msAsDuration(0.5) -> "0 second"
  // msAsDuration(1.1) -> "0.001 second" (and not "0.0011 second")
  // This tool is meant to be read by humans and it would be barely readable to see
  // "0.0001 second" (stands for 0.1 millisecond)
  // yes we could return "0.1 millisecond" but we choosed consistency over precision
  // so that the prefered unit is "second" (and does not become millisecond when ms is super small)
  if (ms < 1) {
    return "0 second";
  }
  const { primary, remaining } = parseMs(ms);
  if (!remaining) {
    return formatDurationUnit(primary, primary.name === "second" ? 1 : 0);
  }
  return `${formatDurationUnit(primary, 0)} and ${formatDurationUnit(
    remaining,
    0,
  )}`;
};

const formatDurationUnit = (unit, decimals) => {
  const count = setRoundedPrecision(unit.count, {
    decimals,
  });
  if (count <= 1) {
    return `${count} ${unit.name}`;
  }
  return `${count} ${unit.name}s`;
};

const MS_PER_UNITS = {
  year: 31_557_600_000,
  month: 2_629_000_000,
  week: 604_800_000,
  day: 86_400_000,
  hour: 3_600_000,
  minute: 60_000,
  second: 1000,
};

const parseMs = (ms) => {
  const unitNames = Object.keys(MS_PER_UNITS);
  const smallestUnitName = unitNames[unitNames.length - 1];
  let firstUnitName = smallestUnitName;
  let firstUnitCount = ms / MS_PER_UNITS[smallestUnitName];
  const firstUnitIndex = unitNames.findIndex((unitName) => {
    if (unitName === smallestUnitName) {
      return false;
    }
    const msPerUnit = MS_PER_UNITS[unitName];
    const unitCount = Math.floor(ms / msPerUnit);
    if (unitCount) {
      firstUnitName = unitName;
      firstUnitCount = unitCount;
      return true;
    }
    return false;
  });
  if (firstUnitName === smallestUnitName) {
    return {
      primary: {
        name: firstUnitName,
        count: firstUnitCount,
      },
    };
  }
  const remainingMs = ms - firstUnitCount * MS_PER_UNITS[firstUnitName];
  const remainingUnitName = unitNames[firstUnitIndex + 1];
  const remainingUnitCount = remainingMs / MS_PER_UNITS[remainingUnitName];
  // - 1 year and 1 second is too much information
  //   so we don't check the remaining units
  // - 1 year and 0.0001 week is awful
  //   hence the if below
  if (Math.round(remainingUnitCount) < 1) {
    return {
      primary: {
        name: firstUnitName,
        count: firstUnitCount,
      },
    };
  }
  // - 1 year and 1 month is great
  return {
    primary: {
      name: firstUnitName,
      count: firstUnitCount,
    },
    remaining: {
      name: remainingUnitName,
      count: remainingUnitCount,
    },
  };
};

const byteAsFileSize = (numberOfBytes) => {
  return formatBytes(numberOfBytes);
};

const byteAsMemoryUsage = (metricValue) => {
  return formatBytes(metricValue, { fixedDecimals: true });
};

const formatBytes = (number, { fixedDecimals = false } = {}) => {
  if (number === 0) {
    return `0 B`;
  }
  const exponent = Math.min(
    Math.floor(Math.log10(number) / 3),
    BYTE_UNITS.length - 1,
  );
  const unitNumber = number / Math.pow(1000, exponent);
  const unitName = BYTE_UNITS[exponent];
  const maxDecimals = unitNumber < 100 ? 1 : 0;
  const unitNumberRounded = setRoundedPrecision(unitNumber, {
    decimals: maxDecimals,
    decimalsWhenSmall: 1,
  });
  if (fixedDecimals) {
    return `${unitNumberRounded.toFixed(maxDecimals)} ${unitName}`;
  }
  return `${unitNumberRounded} ${unitName}`;
};

const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

const ESC = '\u001B[';
const OSC = '\u001B]';
const BEL = '\u0007';
const SEP = ';';

/* global window */
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

const isTerminalApp = !isBrowser && process$1.env.TERM_PROGRAM === 'Apple_Terminal';
const isWindows = !isBrowser && process$1.platform === 'win32';
const cwdFunction = isBrowser ? () => {
	throw new Error('`process.cwd()` only works in Node.js, not the browser.');
} : process$1.cwd;

const ansiEscapes = {};

ansiEscapes.cursorTo = (x, y) => {
	if (typeof x !== 'number') {
		throw new TypeError('The `x` argument is required');
	}

	if (typeof y !== 'number') {
		return ESC + (x + 1) + 'G';
	}

	return ESC + (y + 1) + SEP + (x + 1) + 'H';
};

ansiEscapes.cursorMove = (x, y) => {
	if (typeof x !== 'number') {
		throw new TypeError('The `x` argument is required');
	}

	let returnValue = '';

	if (x < 0) {
		returnValue += ESC + (-x) + 'D';
	} else if (x > 0) {
		returnValue += ESC + x + 'C';
	}

	if (y < 0) {
		returnValue += ESC + (-y) + 'A';
	} else if (y > 0) {
		returnValue += ESC + y + 'B';
	}

	return returnValue;
};

ansiEscapes.cursorUp = (count = 1) => ESC + count + 'A';
ansiEscapes.cursorDown = (count = 1) => ESC + count + 'B';
ansiEscapes.cursorForward = (count = 1) => ESC + count + 'C';
ansiEscapes.cursorBackward = (count = 1) => ESC + count + 'D';

ansiEscapes.cursorLeft = ESC + 'G';
ansiEscapes.cursorSavePosition = isTerminalApp ? '\u001B7' : ESC + 's';
ansiEscapes.cursorRestorePosition = isTerminalApp ? '\u001B8' : ESC + 'u';
ansiEscapes.cursorGetPosition = ESC + '6n';
ansiEscapes.cursorNextLine = ESC + 'E';
ansiEscapes.cursorPrevLine = ESC + 'F';
ansiEscapes.cursorHide = ESC + '?25l';
ansiEscapes.cursorShow = ESC + '?25h';

ansiEscapes.eraseLines = count => {
	let clear = '';

	for (let i = 0; i < count; i++) {
		clear += ansiEscapes.eraseLine + (i < count - 1 ? ansiEscapes.cursorUp() : '');
	}

	if (count) {
		clear += ansiEscapes.cursorLeft;
	}

	return clear;
};

ansiEscapes.eraseEndLine = ESC + 'K';
ansiEscapes.eraseStartLine = ESC + '1K';
ansiEscapes.eraseLine = ESC + '2K';
ansiEscapes.eraseDown = ESC + 'J';
ansiEscapes.eraseUp = ESC + '1J';
ansiEscapes.eraseScreen = ESC + '2J';
ansiEscapes.scrollUp = ESC + 'S';
ansiEscapes.scrollDown = ESC + 'T';

ansiEscapes.clearScreen = '\u001Bc';

ansiEscapes.clearTerminal = isWindows
	? `${ansiEscapes.eraseScreen}${ESC}0f`
	// 1. Erases the screen (Only done in case `2` is not supported)
	// 2. Erases the whole screen including scrollback buffer
	// 3. Moves cursor to the top-left position
	// More info: https://www.real-world-systems.com/docs/ANSIcode.html
	: `${ansiEscapes.eraseScreen}${ESC}3J${ESC}H`;

ansiEscapes.enterAlternativeScreen = ESC + '?1049h';
ansiEscapes.exitAlternativeScreen = ESC + '?1049l';

ansiEscapes.beep = BEL;

ansiEscapes.link = (text, url) => [
	OSC,
	'8',
	SEP,
	SEP,
	url,
	BEL,
	text,
	OSC,
	'8',
	SEP,
	SEP,
	BEL,
].join('');

ansiEscapes.image = (buffer, options = {}) => {
	let returnValue = `${OSC}1337;File=inline=1`;

	if (options.width) {
		returnValue += `;width=${options.width}`;
	}

	if (options.height) {
		returnValue += `;height=${options.height}`;
	}

	if (options.preserveAspectRatio === false) {
		returnValue += ';preserveAspectRatio=0';
	}

	return returnValue + ':' + buffer.toString('base64') + BEL;
};

ansiEscapes.iTerm = {
	setCwd: (cwd = cwdFunction()) => `${OSC}50;CurrentDir=${cwd}${BEL}`,

	annotation(message, options = {}) {
		let returnValue = `${OSC}1337;`;

		const hasX = typeof options.x !== 'undefined';
		const hasY = typeof options.y !== 'undefined';
		if ((hasX || hasY) && !(hasX && hasY && typeof options.length !== 'undefined')) {
			throw new Error('`x`, `y` and `length` must be defined when `x` or `y` is defined');
		}

		message = message.replace(/\|/g, '');

		returnValue += options.isHidden ? 'AddHiddenAnnotation=' : 'AddAnnotation=';

		if (options.length > 0) {
			returnValue += (
				hasX
					? [message, options.length, options.x, options.y]
					: [options.length, message]
			).join('|');
		} else {
			returnValue += message;
		}

		return returnValue + BEL;
	},
};

/*
 *
 */

// maybe https://github.com/gajus/output-interceptor/tree/v3.0.0 ?
// the problem with listening data on stdout
// is that node.js will later throw error if stream gets closed
// while something listening data on it
const spyStreamOutput = (stream) => {
  const originalWrite = stream.write;

  let output = "";
  let installed = true;

  stream.write = function (...args /* chunk, encoding, callback */) {
    output += args;
    return originalWrite.call(stream, ...args);
  };

  const uninstall = () => {
    if (!installed) {
      return;
    }
    stream.write = originalWrite;
    installed = false;
  };

  return () => {
    uninstall();
    return output;
  };
};

/*
 * see also https://github.com/vadimdemedes/ink
 */


const createLog = ({
  stream = process.stdout,
  newLine = "after",
} = {}) => {
  const { columns = 80, rows = 24 } = stream;

  const log = {
    onVerticalOverflow: () => {},
  };

  let lastOutput = "";
  let clearAttemptResult;
  let streamOutputSpy = noopStreamSpy;

  const getErasePreviousOutput = () => {
    // nothing to clear
    if (!lastOutput) {
      return "";
    }
    if (clearAttemptResult !== undefined) {
      return "";
    }

    const logLines = lastOutput.split(/\r\n|\r|\n/);
    let visualLineCount = 0;
    logLines.forEach((logLine) => {
      const width = stringWidth(logLine);
      visualLineCount += width === 0 ? 1 : Math.ceil(width / columns);
    });

    if (visualLineCount > rows) {
      // the whole log cannot be cleared because it's vertically to long
      // (longer than terminal height)
      // readline.moveCursor cannot move cursor higher than screen height
      // it means we would only clear the visible part of the log
      // better keep the log untouched
      clearAttemptResult = false;
      log.onVerticalOverflow();
      return "";
    }

    clearAttemptResult = true;
    return ansiEscapes.eraseLines(visualLineCount);
  };

  const spyStream = () => {
    if (stream === process.stdout) {
      const stdoutSpy = spyStreamOutput(process.stdout);
      const stderrSpy = spyStreamOutput(process.stderr);
      return () => {
        return stdoutSpy() + stderrSpy();
      };
    }
    return spyStreamOutput(stream);
  };

  const doWrite = (string) => {
    string = addNewLines(string, newLine);
    stream.write(string);
    lastOutput = string;
    clearAttemptResult = undefined;

    // We don't want to clear logs written by other code,
    // it makes output unreadable and might erase precious information
    // To detect this we put a spy on the stream.
    // The spy is required only if we actually wrote something in the stream
    // otherwise tryToClear() won't do a thing so spy is useless
    streamOutputSpy = string ? spyStream() : noopStreamSpy;
  };

  const write = (string, outputFromOutside = streamOutputSpy()) => {
    if (!lastOutput) {
      doWrite(string);
      return;
    }
    if (outputFromOutside) {
      // something else than this code has written in the stream
      // so we just write without clearing (append instead of replacing)
      doWrite(string);
    } else {
      doWrite(`${getErasePreviousOutput()}${string}`);
    }
  };

  const dynamicWrite = (callback) => {
    const outputFromOutside = streamOutputSpy();
    const string = callback({ outputFromOutside });
    return write(string, outputFromOutside);
  };

  const destroy = () => {
    if (streamOutputSpy) {
      streamOutputSpy(); // this uninstalls the spy
      streamOutputSpy = null;
      lastOutput = "";
    }
  };

  Object.assign(log, {
    write,
    dynamicWrite,
    destroy,
    stream,
  });
  return log;
};

const noopStreamSpy = () => "";

// could be inlined but vscode do not correctly
// expand/collapse template strings, so I put it at the bottom
const addNewLines = (string, newLine) => {
  if (newLine === "before") {
    return `
${string}`;
  }
  if (newLine === "after") {
    return `${string}
`;
  }
  if (newLine === "around") {
    return `
${string}
`;
  }
  return string;
};

const startSpinner = ({
  log,
  frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  fps = 20,
  keepProcessAlive = false,
  stopOnWriteFromOutside = true,
  stopOnVerticalOverflow = true,
  render = () => "",
  effect = () => {},
  animated = log.stream.isTTY,
}) => {
  let frameIndex = 0;
  let interval;
  let running = true;

  const spinner = {
    message: undefined,
  };

  const update = (message) => {
    spinner.message = running ? `${frames[frameIndex]} ${message}` : message;
    return spinner.message;
  };
  spinner.update = update;

  let cleanup;
  if (animated && ANSI.supported) {
    running = true;
    cleanup = effect();
    log.write(update(render()));

    interval = setInterval(() => {
      frameIndex = frameIndex === frames.length - 1 ? 0 : frameIndex + 1;
      log.dynamicWrite(({ outputFromOutside }) => {
        if (outputFromOutside && stopOnWriteFromOutside) {
          stop();
          return "";
        }
        return update(render());
      });
    }, 1000 / fps);
    if (!keepProcessAlive) {
      interval.unref();
    }
  } else {
    log.write(update(render()));
  }

  const stop = (message) => {
    running = false;
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    if (log && message) {
      log.write(update(message));
      log = null;
    }
  };
  spinner.stop = stop;

  if (stopOnVerticalOverflow) {
    log.onVerticalOverflow = stop;
  }

  return spinner;
};

const createTeardown = () => {
  const teardownCallbackSet = new Set();
  return {
    addCallback: (callback) => {
      teardownCallbackSet.add(callback);
    },
    trigger: async () => {
      await Promise.all(
        Array.from(teardownCallbackSet.values()).map(async (callback) => {
          await callback();
        }),
      );
    },
  };
};

const generateCoverageJsonFile = async ({
  coverage,
  coverageJsonFileUrl,
  logger,
}) => {
  const coverageAsText = JSON.stringify(coverage, null, "  ");
  logger.info(
    `-> ${urlToFileSystemPath(coverageJsonFileUrl)} (${byteAsFileSize(
      Buffer.byteLength(coverageAsText),
    )})`,
  );
  await writeFile(coverageJsonFileUrl, coverageAsText);
};

const importWithRequire = createRequire(import.meta.url);

const istanbulCoverageMapFromCoverage = (coverage) => {
  const { createCoverageMap } = importWithRequire("istanbul-lib-coverage");

  const coverageAdjusted = {};
  Object.keys(coverage).forEach((key) => {
    coverageAdjusted[key.slice(2)] = {
      ...coverage[key],
      path: key.slice(2),
    };
  });

  const coverageMap = createCoverageMap(coverageAdjusted);
  return coverageMap;
};

const generateCoverageHtmlDirectory = async (
  coverage,
  {
    rootDirectoryUrl,
    coverageHtmlDirectoryRelativeUrl,
    coverageReportSkipEmpty,
    coverageReportSkipFull,
  },
) => {
  const libReport = importWithRequire("istanbul-lib-report");
  const reports = importWithRequire("istanbul-reports");

  const context = libReport.createContext({
    dir: fileURLToPath(rootDirectoryUrl),
    coverageMap: istanbulCoverageMapFromCoverage(coverage),
    sourceFinder: (path) =>
      readFileSync(new URL(path, rootDirectoryUrl), "utf8"),
  });

  const report = reports.create("html", {
    skipEmpty: coverageReportSkipEmpty,
    skipFull: coverageReportSkipFull,
    subdir: coverageHtmlDirectoryRelativeUrl,
  });
  report.execute(context);
};

const generateCoverageTextLog = (
  coverage,
  { coverageReportSkipEmpty, coverageReportSkipFull },
) => {
  const libReport = importWithRequire("istanbul-lib-report");
  const reports = importWithRequire("istanbul-reports");

  const context = libReport.createContext({
    coverageMap: istanbulCoverageMapFromCoverage(coverage),
  });
  const report = reports.create("text", {
    skipEmpty: coverageReportSkipEmpty,
    skipFull: coverageReportSkipFull,
  });
  report.execute(context);
};

const pingServer = async (url) => {
  const server = createServer();
  const { hostname, port } = new URL(url);

  try {
    await new Promise((resolve, reject) => {
      server.on("error", reject);
      server.on("listening", () => {
        resolve();
      });
      server.listen(port, hostname);
    });
  } catch (error) {
    if (error && error.code === "EADDRINUSE") {
      return true;
    }
    if (error && error.code === "EACCES") {
      return true;
    }
    throw error;
  }
  await new Promise((resolve, reject) => {
    server.on("error", reject);
    server.on("close", resolve);
    server.close();
  });
  return false;
};

const startServerUsingCommand = async (
  webServer,
  { signal, allocatedMs, logger, teardown },
) => {
  const spawnedProcess = spawn(webServer.command, [], {
    // On non-windows platforms, `detached: true` makes child process a leader of a new
    // process group, making it possible to kill child process tree with `.kill(-pid)` command.
    // @see https://nodejs.org/api/child_process.html#child_process_options_detached
    detached: process.platform !== "win32",
    stdio: ["pipe", "pipe", "pipe"],
    shell: true,
    cwd: webServer.cwd,
  });
  if (!spawnedProcess.pid) {
    await new Promise((resolve, reject) => {
      spawnedProcess.once("error", (error) => {
        reject(new Error(`Failed to launch: ${error}`));
      });
    });
  }

  let errorReceived = false;
  const errorPromise = new Promise((resolve, reject) => {
    spawnedProcess.on("error", (e) => {
      errorReceived = true;
      reject(e);
    });
  });

  // const stdout = readline.createInterface({ input: spawnedProcess.stdout });
  // stdout.on("line", () => {
  //   logger.debug(`[pid=${spawnedProcess.pid}][out] ${data}`);
  // });
  // const stderr = readline.createInterface({ input: spawnedProcess.stderr });
  // stderr.on("line", (data) => {
  //   logger.debug(`[pid=${spawnedProcess.pid}][err] ${data}`);
  // });
  let processClosed = false;
  const closedPromise = new Promise((resolve) => {
    spawnedProcess.once("exit", (exitCode, signal) => {
      logger.debug(
        `[pid=${spawnedProcess.pid}] <process did exit: exitCode=${exitCode}, signal=${signal}>`,
      );
      processClosed = true;
      resolve();
    });
  });
  const killProcess = async () => {
    logger.debug(`[pid=${spawnedProcess.pid}] <kill>`);
    if (!spawnedProcess.pid || spawnedProcess.killed || processClosed) {
      logger.debug(
        `[pid=${spawnedProcess.pid}] <skipped force kill spawnedProcess.killed=${spawnedProcess.killed} processClosed=${processClosed}>`,
      );
      return;
    }
    logger.debug(`[pid=${spawnedProcess.pid}] <will force kill>`);
    // Force kill the browser.
    try {
      if (process.platform === "win32") {
        const taskkillProcess = spawnSync(
          `taskkill /pid ${spawnedProcess.pid} /T /F`,
          { shell: true },
        );
        const [stdout, stderr] = [
          taskkillProcess.stdout.toString(),
          taskkillProcess.stderr.toString(),
        ];
        if (stdout)
          logger.debug(
            `[pid=${spawnedProcess.pid}] taskkill stdout: ${stdout}`,
          );
        if (stderr)
          logger.info(`[pid=${spawnedProcess.pid}] taskkill stderr: ${stderr}`);
      } else {
        process.kill(-spawnedProcess.pid, "SIGKILL");
      }
    } catch (e) {
      logger.info(
        `[pid=${spawnedProcess.pid}] exception while trying to kill process: ${e}`,
      );
      // the process might have already stopped
    }
    await closedPromise;
  };

  const startOperation = Abort.startOperation();
  startOperation.addAbortSignal(signal);
  const timeoutAbortSource = startOperation.timeout(allocatedMs);
  startOperation.addAbortCallback(killProcess);
  teardown.addCallback(killProcess);

  const startedPromise = (async () => {
    const logScale = [100, 250, 500];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (errorReceived) {
        break;
      }
      const connected = await pingServer(webServer.origin);
      if (connected) {
        break;
      }
      startOperation.throwIfAborted();
      const delay = logScale.shift() || 1000;
      logger.debug(`Waiting ${delay}ms`);
      await new Promise((x) => setTimeout(x, delay));
    }
  })();

  try {
    await Promise.race([errorPromise, startedPromise]);
  } catch (e) {
    if (Abort.isAbortError(e)) {
      if (timeoutAbortSource.signal.aborted) {
        // aborted by timeout
        throw new Error(
          `"${webServer.command}" command did not start a server in less than ${allocatedMs}ms`,
        );
      }
      if (signal.aborted) {
        // aborted from outside
        return;
      }
    }
    throw e;
  } finally {
    await startOperation.end();
  }
};

const startServerUsingModuleUrl = async (webServer, params) => {
  if (!existsSync(new URL(webServer.moduleUrl))) {
    throw new Error(`"${webServer.moduleUrl}" does not lead to a file`);
  }
  return startServerUsingCommand(
    {
      ...webServer,
      command: `node ${fileURLToPath(webServer.moduleUrl)}`,
    },
    params,
  );
};

const basicFetch = async (
  url,
  { rejectUnauthorized = true, method = "GET", headers = {} } = {},
) => {
  let requestModule;
  if (url.startsWith("http:")) {
    requestModule = await import("node:http");
  } else {
    requestModule = await import("node:https");
  }
  const { request } = requestModule;

  const urlObject = new URL(url);

  return new Promise((resolve, reject) => {
    const req = request({
      rejectUnauthorized,
      hostname: urlObject.hostname,
      port: urlObject.port,
      path: urlObject.pathname,
      method,
      headers,
    });
    req.on("response", (response) => {
      resolve({
        status: response.statusCode,
        headers: response.headers,
        json: () => {
          req.setTimeout(0);
          req.destroy();
          return new Promise((resolve) => {
            if (response.headers["content-type"] !== "application/json") {
              console.warn("not json");
            }
            let responseBody = "";
            response.setEncoding("utf8");
            response.on("data", (chunk) => {
              responseBody += chunk;
            });
            response.on("end", () => {
              resolve(JSON.parse(responseBody));
            });
            response.on("error", (e) => {
              reject(e);
            });
          });
        },
      });
    });
    req.on("error", reject);
    req.end();
  });
};

const assertAndNormalizeWebServer = async (
  webServer,
  { signal, logger, teardown },
) => {
  if (!webServer) {
    throw new TypeError(
      `webServer is required when running tests on browser(s)`,
    );
  }
  const unexpectedParamNames = Object.keys(webServer).filter((key) => {
    return ![
      "origin",
      "moduleUrl",
      "command",
      "cwd",
      "rootDirectoryUrl",
    ].includes(key);
  });
  if (unexpectedParamNames.length > 0) {
    throw new TypeError(
      `${unexpectedParamNames.join(",")}: there is no such param to webServer`,
    );
  }
  if (typeof webServer.origin !== "string") {
    throw new TypeError(
      `webServer.origin must be a string, got ${webServer.origin}`,
    );
  }
  await ensureWebServerIsStarted(webServer, {
    signal,
    teardown,
    logger,
  });
  const { headers } = await basicFetch(webServer.origin, {
    method: "GET",
    rejectUnauthorized: false,
    headers: {
      "x-server-inspect": "1",
    },
  });
  if (String(headers["server"]).includes("jsenv_dev_server")) {
    webServer.isJsenvDevServer = true;
    const { json } = await basicFetch(`${webServer.origin}/__params__.json`, {
      rejectUnauthorized: false,
    });
    if (webServer.rootDirectoryUrl === undefined) {
      const jsenvDevServerParams = await json();
      webServer.rootDirectoryUrl = jsenvDevServerParams.sourceDirectoryUrl;
    } else {
      webServer.rootDirectoryUrl = assertAndNormalizeDirectoryUrl(
        webServer.rootDirectoryUrl,
        "webServer.rootDirectoryUrl",
      );
    }
  } else {
    webServer.rootDirectoryUrl = assertAndNormalizeDirectoryUrl(
      webServer.rootDirectoryUrl,
      "webServer.rootDirectoryUrl",
    );
  }
};

const ensureWebServerIsStarted = async (
  webServer,
  { signal, teardown, logger, allocatedMs = 5_000 },
) => {
  const aServerIsListening = await pingServer(webServer.origin);
  if (aServerIsListening) {
    return;
  }
  if (webServer.moduleUrl) {
    await startServerUsingModuleUrl(webServer, {
      signal,
      allocatedMs,
      teardown,
      logger,
    });
    return;
  }
  if (webServer.command) {
    await startServerUsingCommand(webServer, {
      signal,
      allocatedMs,
      teardown,
      logger,
    });
    return;
  }
  throw new TypeError(
    `webServer.moduleUrl or webServer.command is required as there is no server listening "${webServer.origin}"`,
  );
};

const executionStepsFromTestPlan = async ({
  signal,
  rootDirectoryUrl,
  testPlan,
}) => {
  try {
    const fileResultArray = await collectFiles({
      signal,
      directoryUrl: rootDirectoryUrl,
      associations: { testPlan },
      predicate: ({ testPlan }) => testPlan,
    });
    const executionSteps = [];
    fileResultArray.forEach(({ relativeUrl, meta }) => {
      const fileExecutionSteps = generateFileExecutionSteps({
        fileRelativeUrl: relativeUrl,
        filePlan: meta.testPlan,
      });
      executionSteps.push(...fileExecutionSteps);
    });
    return executionSteps;
  } catch (e) {
    if (Abort.isAbortError(e)) {
      return {
        aborted: true,
        planSummary: {},
        planReport: {},
        planCoverage: null,
      };
    }
    throw e;
  }
};

const generateFileExecutionSteps = ({ fileRelativeUrl, filePlan }) => {
  const fileExecutionSteps = [];
  Object.keys(filePlan).forEach((executionName) => {
    const stepConfig = filePlan[executionName];
    if (stepConfig === null || stepConfig === undefined) {
      return;
    }
    if (typeof stepConfig !== "object") {
      throw new TypeError(
        createDetailedMessage(
          `found unexpected value in plan, they must be object`,
          {
            ["file relative path"]: fileRelativeUrl,
            ["execution name"]: executionName,
            ["value"]: stepConfig,
          },
        ),
      );
    }
    fileExecutionSteps.push({
      executionName,
      fileRelativeUrl,
      ...stepConfig,
    });
  });
  return fileExecutionSteps;
};

const readNodeV8CoverageDirectory = async ({
  logger,
  signal,
  onV8Coverage,
  maxMsWaitingForNodeToWriteCoverageFile = 2000,
}) => {
  const NODE_V8_COVERAGE = process.env.NODE_V8_COVERAGE;
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);

  let timeSpentTrying = 0;
  const tryReadDirectory = async () => {
    const dirContent = readdirSync(NODE_V8_COVERAGE);
    if (dirContent.length > 0) {
      return dirContent;
    }
    if (timeSpentTrying < maxMsWaitingForNodeToWriteCoverageFile) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      timeSpentTrying += 200;
      logger.debug("retry to read coverage directory");
      return tryReadDirectory();
    }
    logger.warn(`v8 coverage directory is empty at ${NODE_V8_COVERAGE}`);
    return dirContent;
  };

  try {
    operation.throwIfAborted();
    const dirContent = await tryReadDirectory();

    const coverageDirectoryUrl = assertAndNormalizeDirectoryUrl(
      NODE_V8_COVERAGE,
      "NODE_V8_COVERAGE",
    );

    await dirContent.reduce(async (previous, dirEntry) => {
      operation.throwIfAborted();
      await previous;

      const dirEntryUrl = new URL(dirEntry, coverageDirectoryUrl);
      const tryReadJsonFile = async () => {
        const fileContent = String(readFileSync(dirEntryUrl));
        if (fileContent === "") {
          if (timeSpentTrying < maxMsWaitingForNodeToWriteCoverageFile) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            timeSpentTrying += 200;
            return tryReadJsonFile();
          }
          console.warn(`Coverage JSON file is empty at ${dirEntryUrl}`);
          return null;
        }

        try {
          const fileAsJson = JSON.parse(fileContent);
          return fileAsJson;
        } catch (e) {
          if (timeSpentTrying < maxMsWaitingForNodeToWriteCoverageFile) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            timeSpentTrying += 200;
            return tryReadJsonFile();
          }
          console.warn(
            createDetailedMessage(`Error while reading coverage file`, {
              "error stack": e.stack,
              "file": dirEntryUrl,
            }),
          );
          return null;
        }
      };

      const fileContent = await tryReadJsonFile();
      if (fileContent) {
        await onV8Coverage(fileContent);
      }
    }, Promise.resolve());
  } finally {
    await operation.end();
  }
};

const composeTwoV8Coverages = (firstV8Coverage, secondV8Coverage) => {
  if (secondV8Coverage.result.length === 0) {
    return firstV8Coverage;
  }

  // eslint-disable-next-line import/no-unresolved
  const { mergeProcessCovs } = importWithRequire("@c88/v8-coverage");
  // "mergeProcessCovs" do not preserves source-map-cache during the merge
  // so we store sourcemap cache now
  const sourceMapCache = {};
  const visit = (coverageReport) => {
    if (coverageReport["source-map-cache"]) {
      Object.assign(sourceMapCache, coverageReport["source-map-cache"]);
    }
  };
  visit(firstV8Coverage);
  visit(secondV8Coverage);
  const v8Coverage = mergeProcessCovs([firstV8Coverage, secondV8Coverage]);
  v8Coverage["source-map-cache"] = sourceMapCache;

  return v8Coverage;
};

const composeTwoFileByFileIstanbulCoverages = (
  firstFileByFileIstanbulCoverage,
  secondFileByFileIstanbulCoverage,
) => {
  const fileByFileIstanbulCoverage = {};
  Object.keys(firstFileByFileIstanbulCoverage).forEach((key) => {
    fileByFileIstanbulCoverage[key] = firstFileByFileIstanbulCoverage[key];
  });
  Object.keys(secondFileByFileIstanbulCoverage).forEach((key) => {
    const firstCoverage = firstFileByFileIstanbulCoverage[key];
    const secondCoverage = secondFileByFileIstanbulCoverage[key];
    fileByFileIstanbulCoverage[key] = firstCoverage
      ? merge(firstCoverage, secondCoverage)
      : secondCoverage;
  });

  return fileByFileIstanbulCoverage;
};

const merge = (firstIstanbulCoverage, secondIstanbulCoverage) => {
  const { createFileCoverage } = importWithRequire("istanbul-lib-coverage");
  const istanbulFileCoverageObject = createFileCoverage(firstIstanbulCoverage);
  istanbulFileCoverageObject.merge(secondIstanbulCoverage);
  const istanbulCoverage = istanbulFileCoverageObject.toJSON();
  return istanbulCoverage;
};

const v8CoverageToIstanbul = async (v8Coverage, { signal }) => {
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);

  try {
    const v8ToIstanbul = importWithRequire("v8-to-istanbul");
    const sourcemapCache = v8Coverage["source-map-cache"];
    let istanbulCoverageComposed = null;

    await v8Coverage.result.reduce(async (previous, fileV8Coverage) => {
      operation.throwIfAborted();
      await previous;

      const { source } = fileV8Coverage;
      let sources;
      // when v8 coverage comes from playwright (chromium) v8Coverage.source is set
      if (typeof source === "string") {
        sources = { source };
      }
      // when v8 coverage comes from Node.js, the source can be read from sourcemapCache
      else if (sourcemapCache) {
        sources = sourcesFromSourceMapCache(fileV8Coverage.url, sourcemapCache);
      }
      const path = urlToFileSystemPath(fileV8Coverage.url);

      const converter = v8ToIstanbul(
        path,
        // wrapperLength is undefined we don't need it
        // https://github.com/istanbuljs/v8-to-istanbul/blob/2b54bc97c5edf8a37b39a171ec29134ba9bfd532/lib/v8-to-istanbul.js#L27
        undefined,
        sources,
      );
      await converter.load();

      converter.applyCoverage(fileV8Coverage.functions);
      const istanbulCoverage = converter.toIstanbul();

      istanbulCoverageComposed = istanbulCoverageComposed
        ? composeTwoFileByFileIstanbulCoverages(
            istanbulCoverageComposed,
            istanbulCoverage,
          )
        : istanbulCoverage;
    }, Promise.resolve());

    if (!istanbulCoverageComposed) {
      return {};
    }
    istanbulCoverageComposed = markAsConvertedFromV8(istanbulCoverageComposed);
    return istanbulCoverageComposed;
  } finally {
    await operation.end();
  }
};

const markAsConvertedFromV8 = (fileByFileCoverage) => {
  const fileByFileMarked = {};
  Object.keys(fileByFileCoverage).forEach((key) => {
    const fileCoverage = fileByFileCoverage[key];
    fileByFileMarked[key] = {
      ...fileCoverage,
      fromV8: true,
    };
  });
  return fileByFileMarked;
};

const sourcesFromSourceMapCache = (url, sourceMapCache) => {
  const sourceMapAndLineLengths = sourceMapCache[url];
  if (!sourceMapAndLineLengths) {
    return {};
  }

  const { data, lineLengths } = sourceMapAndLineLengths;
  // See: https://github.com/nodejs/node/pull/34305
  if (!data) {
    return undefined;
  }

  const sources = {
    sourcemap: data,
    ...(lineLengths ? { source: sourcesFromLineLengths(lineLengths) } : {}),
  };
  return sources;
};

const sourcesFromLineLengths = (lineLengths) => {
  let source = "";
  lineLengths.forEach((length) => {
    source += `${"".padEnd(length, ".")}\n`;
  });
  return source;
};

const composeV8AndIstanbul = (
  v8FileByFileCoverage,
  istanbulFileByFileCoverage,
  { coverageV8ConflictWarning },
) => {
  const fileByFileCoverage = {};
  const v8Files = Object.keys(v8FileByFileCoverage);
  const istanbulFiles = Object.keys(istanbulFileByFileCoverage);

  v8Files.forEach((key) => {
    fileByFileCoverage[key] = v8FileByFileCoverage[key];
  });
  istanbulFiles.forEach((key) => {
    const v8Coverage = v8FileByFileCoverage[key];
    if (v8Coverage) {
      if (coverageV8ConflictWarning) {
        console.warn(
          createDetailedMessage(
            `Coverage conflict on "${key}", found two coverage that cannot be merged together: v8 and istanbul. The istanbul coverage will be ignored.`,
            {
              "details": `This happens when a file is executed on a runtime using v8 coverage (node or chromium) and on runtime using istanbul coverage (firefox or webkit)`,
              "suggestion":
                "disable this warning with coverageV8ConflictWarning: false",
              "suggestion 2": `force coverage using istanbul with coverageMethodForBrowsers: "istanbul"`,
            },
          ),
        );
      }
      fileByFileCoverage[key] = v8Coverage;
    } else {
      fileByFileCoverage[key] = istanbulFileByFileCoverage[key];
    }
  });

  return fileByFileCoverage;
};

const normalizeFileByFileCoveragePaths = (
  fileByFileCoverage,
  rootDirectoryUrl,
) => {
  const fileByFileNormalized = {};
  Object.keys(fileByFileCoverage).forEach((key) => {
    const fileCoverage = fileByFileCoverage[key];
    const { path } = fileCoverage;
    const url = isFileSystemPath(path)
      ? fileSystemPathToUrl(path)
      : new URL(path, rootDirectoryUrl).href;
    const relativeUrl = urlToRelativeUrl(url, rootDirectoryUrl);
    fileByFileNormalized[`./${relativeUrl}`] = {
      ...fileCoverage,
      path: `./${relativeUrl}`,
    };
  });
  return fileByFileNormalized;
};

const listRelativeFileUrlToCover = async ({
  signal,
  rootDirectoryUrl,
  coverageConfig,
}) => {
  const matchingFileResultArray = await collectFiles({
    signal,
    directoryUrl: rootDirectoryUrl,
    associations: { cover: coverageConfig },
    predicate: ({ cover }) => cover,
  });
  return matchingFileResultArray.map(({ relativeUrl }) => relativeUrl);
};

// https://github.com/istanbuljs/babel-plugin-istanbul/blob/321740f7b25d803f881466ea819d870f7ed6a254/src/index.js

const babelPluginInstrument = (api, { useInlineSourceMaps = false }) => {
  const { programVisitor } = importWithRequire("istanbul-lib-instrument");
  const { types } = api;

  return {
    name: "transform-instrument",
    visitor: {
      Program: {
        enter(path, state) {
          const { file } = state;
          const { opts } = file;
          let inputSourceMap;
          if (useInlineSourceMaps) {
            // https://github.com/istanbuljs/babel-plugin-istanbul/commit/a9e15643d249a2985e4387e4308022053b2cd0ad#diff-1fdf421c05c1140f6d71444ea2b27638R65
            inputSourceMap =
              opts.inputSourceMap || file.inputMap
                ? file.inputMap.sourcemap
                : null;
          } else {
            inputSourceMap = opts.inputSourceMap;
          }
          const __dv__ = programVisitor(
            types,
            opts.filenameRelative || opts.filename,
            {
              coverageVariable: "__coverage__",
              inputSourceMap,
            },
          );
          __dv__.enter(path);
          file.metadata.__dv__ = __dv__;
        },

        exit(path, state) {
          const { __dv__ } = state.file.metadata;
          if (!__dv__) {
            return;
          }
          const object = __dv__.exit(path);
          // object got two properties: fileCoverage and sourceMappingURL
          state.file.metadata.coverage = object.fileCoverage;
        },
      },
    },
  };
};

const relativeUrlToEmptyCoverage = async (
  relativeUrl,
  { signal, rootDirectoryUrl },
) => {
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);

  try {
    const fileUrl = resolveUrl(relativeUrl, rootDirectoryUrl);
    const content = await readFile(fileUrl, { as: "string" });

    operation.throwIfAborted();
    const { metadata } = await applyBabelPlugins({
      babelPlugins: [babelPluginInstrument],
      input: content,
      inputIsJsModule: true,
      inputUrl: fileUrl,
    });
    const { coverage } = metadata;
    if (!coverage) {
      throw new Error(`missing coverage for file`);
    }
    // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229
    Object.keys(coverage.s).forEach(function (key) {
      coverage.s[key] = 0;
    });
    return coverage;
  } catch (e) {
    if (e && e.code === "PARSE_ERROR") {
      // return an empty coverage for that file when
      // it contains a syntax error
      return createEmptyCoverage(relativeUrl);
    }
    throw e;
  } finally {
    await operation.end();
  }
};

const createEmptyCoverage = (relativeUrl) => {
  const { createFileCoverage } = importWithRequire("istanbul-lib-coverage");
  return createFileCoverage(relativeUrl).toJSON();
};

const getMissingFileByFileCoverage = async ({
  signal,
  rootDirectoryUrl,
  coverageConfig,
  fileByFileCoverage,
}) => {
  const relativeUrlsToCover = await listRelativeFileUrlToCover({
    signal,
    rootDirectoryUrl,
    coverageConfig,
  });
  const relativeUrlsMissing = relativeUrlsToCover.filter((relativeUrlToCover) =>
    Object.keys(fileByFileCoverage).every((key) => {
      return key !== `./${relativeUrlToCover}`;
    }),
  );

  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  const missingFileByFileCoverage = {};
  await relativeUrlsMissing.reduce(async (previous, relativeUrlMissing) => {
    operation.throwIfAborted();
    await previous;
    await operation.withSignal(async (signal) => {
      const emptyCoverage = await relativeUrlToEmptyCoverage(
        relativeUrlMissing,
        {
          signal,
          rootDirectoryUrl,
        },
      );
      missingFileByFileCoverage[`./${relativeUrlMissing}`] = emptyCoverage;
    });
  }, Promise.resolve());
  return missingFileByFileCoverage;
};

const reportToCoverage = async (
  report,
  {
    signal,
    logger,
    rootDirectoryUrl,
    coverageConfig,
    coverageIncludeMissing,
    coverageMethodForNodeJs,
    coverageV8ConflictWarning,
  },
) => {
  // collect v8 and istanbul coverage from executions
  let { v8Coverage, fileByFileIstanbulCoverage } = await getCoverageFromReport({
    signal,
    report,
    onMissing: ({ file, executionResult, executionName }) => {
      // several reasons not to have coverage here:
      // 1. the file we executed did not import an instrumented file.
      // - a test file without import
      // - a test file importing only file excluded from coverage
      // - a coverDescription badly configured so that we don't realize
      // a file should be covered

      // 2. the file we wanted to executed timedout
      // - infinite loop
      // - too extensive operation
      // - a badly configured or too low allocatedMs for that execution.

      // 3. the file we wanted to execute contains syntax-error

      // in any scenario we are fine because
      // coverDescription will generate empty coverage for files
      // that were suppose to be coverage but were not.
      if (
        executionResult.status === "completed" &&
        executionResult.type === "node" &&
        coverageMethodForNodeJs !== "NODE_V8_COVERAGE"
      ) {
        logger.warn(
          `"${executionName}" execution of ${file} did not properly write coverage into ${executionResult.coverageFileUrl}`,
        );
      }
    },
  });

  if (coverageMethodForNodeJs === "NODE_V8_COVERAGE") {
    await readNodeV8CoverageDirectory({
      logger,
      signal,
      onV8Coverage: async (nodeV8Coverage) => {
        const nodeV8CoverageLight = await filterV8Coverage(nodeV8Coverage, {
          rootDirectoryUrl,
          coverageConfig,
        });
        v8Coverage = v8Coverage
          ? composeTwoV8Coverages(v8Coverage, nodeV8CoverageLight)
          : nodeV8CoverageLight;
      },
    });
  }

  // try to merge v8 with istanbul, if any
  let fileByFileCoverage;
  if (v8Coverage) {
    let v8FileByFileCoverage = await v8CoverageToIstanbul(v8Coverage, {
      signal,
    });

    v8FileByFileCoverage = normalizeFileByFileCoveragePaths(
      v8FileByFileCoverage,
      rootDirectoryUrl,
    );

    if (fileByFileIstanbulCoverage) {
      fileByFileIstanbulCoverage = normalizeFileByFileCoveragePaths(
        fileByFileIstanbulCoverage,
        rootDirectoryUrl,
      );
      fileByFileCoverage = composeV8AndIstanbul(
        v8FileByFileCoverage,
        fileByFileIstanbulCoverage,
        { coverageV8ConflictWarning },
      );
    } else {
      fileByFileCoverage = v8FileByFileCoverage;
    }
  }
  // get istanbul only
  else if (fileByFileIstanbulCoverage) {
    fileByFileCoverage = normalizeFileByFileCoveragePaths(
      fileByFileIstanbulCoverage,
      rootDirectoryUrl,
    );
  }
  // no coverage found in execution (or zero file where executed)
  else {
    fileByFileCoverage = {};
  }

  // now add coverage for file not covered
  if (coverageIncludeMissing) {
    const missingFileByFileCoverage = await getMissingFileByFileCoverage({
      signal,
      rootDirectoryUrl,
      coverageConfig,
      fileByFileCoverage,
    });
    Object.assign(
      fileByFileCoverage,
      normalizeFileByFileCoveragePaths(
        missingFileByFileCoverage,
        rootDirectoryUrl,
      ),
    );
  }

  return fileByFileCoverage;
};

const getCoverageFromReport = async ({ signal, report, onMissing }) => {
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);

  try {
    let v8Coverage;
    let fileByFileIstanbulCoverage;

    // collect v8 and istanbul coverage from executions
    await Object.keys(report).reduce(async (previous, file) => {
      operation.throwIfAborted();
      await previous;

      const executionResultForFile = report[file];
      await Object.keys(executionResultForFile).reduce(
        async (previous, executionName) => {
          operation.throwIfAborted();
          await previous;

          const executionResultForFileOnRuntime =
            executionResultForFile[executionName];
          const { coverageFileUrl } = executionResultForFileOnRuntime;
          let executionCoverage;
          try {
            executionCoverage = JSON.parse(
              String(readFileSync(new URL(coverageFileUrl))),
            );
          } catch (e) {
            if (e.code === "ENOENT" || e.name === "SyntaxError") {
              onMissing({
                executionName,
                file,
                executionResult: executionResultForFileOnRuntime,
              });
              return;
            }
            throw e;
          }

          if (isV8Coverage(executionCoverage)) {
            v8Coverage = v8Coverage
              ? composeTwoV8Coverages(v8Coverage, executionCoverage)
              : executionCoverage;
          } else {
            fileByFileIstanbulCoverage = fileByFileIstanbulCoverage
              ? composeTwoFileByFileIstanbulCoverages(
                  fileByFileIstanbulCoverage,
                  executionCoverage,
                )
              : executionCoverage;
          }
        },
        Promise.resolve(),
      );
    }, Promise.resolve());

    return {
      v8Coverage,
      fileByFileIstanbulCoverage,
    };
  } finally {
    await operation.end();
  }
};

const isV8Coverage = (coverage) => Boolean(coverage.result);

/*
 * Export a function capable to run a file on a runtime.
 *
 * - Used internally by "executeTestPlan" part of the documented API
 * - Used internally by "execute" an advanced API not documented
 * - logs generated during file execution can be collected
 * - logs generated during file execution can be mirrored (re-logged to the console)
 * - File is given allocatedMs to complete
 * - Errors are collected
 * - File execution result is returned, it contains status/errors/namespace/consoleCalls
 */


const run = async ({
  signal = new AbortController().signal,
  logger,
  allocatedMs,
  keepRunning = false,
  mirrorConsole = false,
  collectConsole = false,
  coverageEnabled = false,
  coverageTempDirectoryUrl,
  collectPerformance = false,
  runtime,
  runtimeParams,
}) => {
  const result = {
    status: "pending",
    errors: [],
    namespace: null,
  };
  const callbacks = [];

  const onConsoleRef = { current: () => {} };
  const stopSignal = { notify: () => {} };
  const runtimeLabel = `${runtime.name}/${runtime.version}`;

  const runOperation = Abort.startOperation();
  runOperation.addAbortSignal(signal);
  let timeoutAbortSource;
  if (
    // ideally we would rather log than the timeout is ignored
    // when keepRunning is true
    !keepRunning &&
    typeof allocatedMs === "number" &&
    allocatedMs !== Infinity
  ) {
    timeoutAbortSource = runOperation.timeout(allocatedMs);
  }
  const consoleCalls = [];
  onConsoleRef.current = ({ type, text }) => {
    if (mirrorConsole) {
      if (type === "error") {
        process.stderr.write(text);
      } else {
        process.stdout.write(text);
      }
    }
    if (collectConsole) {
      consoleCalls.push({ type, text });
    }
  };
  if (collectConsole) {
    result.consoleCalls = consoleCalls;
  }

  // we do not keep coverage in memory, it can grow very big
  // instead we store it on the filesystem
  // and they can be read later at "coverageFileUrl"
  let coverageFileUrl;
  if (coverageEnabled) {
    coverageFileUrl = new URL(
      `./${runtime.name}/${crypto.randomUUID()}.json`,
      coverageTempDirectoryUrl,
    ).href;
    await ensureParentDirectories(coverageFileUrl);
    if (coverageEnabled) {
      result.coverageFileUrl = coverageFileUrl;
      // written within the child_process/worker_thread or during runtime.run()
      // for browsers
      // (because it takes time to serialize and transfer the coverage object)
    }
  }

  const startMs = Date.now();
  callbacks.push(() => {
    result.duration = Date.now() - startMs;
  });

  try {
    logger.debug(`run() ${runtimeLabel}`);
    runOperation.throwIfAborted();
    const winnerPromise = new Promise((resolve) => {
      raceCallbacks(
        {
          aborted: (cb) => {
            runOperation.signal.addEventListener("abort", cb);
            return () => {
              runOperation.signal.removeEventListener("abort", cb);
            };
          },
          runned: async (cb) => {
            try {
              const runResult = await runtime.run({
                signal: runOperation.signal,
                logger,
                ...runtimeParams,
                collectConsole,
                collectPerformance,
                coverageFileUrl,
                keepRunning,
                stopSignal,
                onConsole: (log) => onConsoleRef.current(log),
              });
              cb(runResult);
            } catch (e) {
              cb({
                status: "failed",
                errors: [e],
              });
            }
          },
        },
        resolve,
      );
    });
    const winner = await winnerPromise;
    if (winner.name === "aborted") {
      runOperation.throwIfAborted();
    }
    const { status, namespace, errors, performance } = winner.data;
    result.status = status;
    result.errors.push(...errors);
    result.namespace = namespace;
    if (collectPerformance) {
      result.performance = performance;
    }
  } catch (e) {
    if (Abort.isAbortError(e)) {
      if (timeoutAbortSource && timeoutAbortSource.signal.aborted) {
        result.status = "timedout";
      } else {
        result.status = "aborted";
      }
    } else {
      result.status = "failed";
      result.errors.push(e);
    }
  } finally {
    await runOperation.end();
  }

  callbacks.forEach((callback) => {
    callback();
  });
  return result;
};

const ensureGlobalGc = () => {
  if (!global.gc) {
    v8.setFlagsFromString("--expose_gc");
    global.gc = runInNewContext("gc");
  }
};

const EXECUTION_COLORS = {
  executing: ANSI.BLUE,
  aborted: ANSI.MAGENTA,
  timedout: ANSI.MAGENTA,
  failed: ANSI.RED,
  completed: ANSI.GREEN,
  cancelled: ANSI.GREY,
};

const createExecutionLog = (
  {
    executionIndex,
    fileRelativeUrl,
    runtimeName,
    runtimeVersion,
    executionParams,
    executionResult,
    startMs,
    endMs,
    nowMs,
    timeEllapsed,
    memoryHeap,
    counters,
  },
  {
    logShortForCompletedExecutions,
    logRuntime,
    logEachDuration,
    logTimeUsage,
    logMemoryHeapUsage,
  },
) => {
  const { status } = executionResult;
  const label = formatExecutionLabel(
    {
      executionIndex,
      executionParams,
      status,
      timeEllapsed,
      memoryHeap,
      counters,
    },
    {
      logTimeUsage,
      logMemoryHeapUsage,
    },
  );

  let log;
  if (logShortForCompletedExecutions && status === "completed") {
    log = label;
  } else {
    const { consoleCalls = [], errors = [] } = executionResult;
    const consoleOutput = formatConsoleCalls(consoleCalls);
    const errorsOutput = formatErrors(errors);
    log = formatExecution({
      label,
      details: {
        file: fileRelativeUrl,
        ...(logRuntime ? { runtime: `${runtimeName}/${runtimeVersion}` } : {}),
        ...(logEachDuration
          ? {
              duration:
                status === "executing"
                  ? msAsEllapsedTime((nowMs || Date.now()) - startMs)
                  : msAsDuration(endMs - startMs),
            }
          : {}),
      },
      consoleOutput,
      errorsOutput,
    });
  }

  const { columns = 80 } = process.stdout;
  log = wrapAnsi(log, columns, {
    trim: false,
    hard: true,
    wordWrap: false,
  });
  if (endMs) {
    if (logShortForCompletedExecutions) {
      return `${log}\n`;
    }
    if (executionIndex === counters.total - 1) {
      return `${log}\n`;
    }
    return `${log}\n\n`;
  }
  return log;
};

const formatExecutionLabel = (
  {
    executionIndex,
    executionParams,
    status,
    timeEllapsed,
    memoryHeap,
    counters,
  },
  { logTimeUsage, logMemoryHeapUsage } = {},
) => {
  const descriptionFormatter = descriptionFormatters[status];
  const description = descriptionFormatter({
    index: executionIndex,
    total: counters.total,
    executionParams,
  });
  const summary = createIntermediateSummary({
    executionIndex,
    counters,
    timeEllapsed,
    memoryHeap,
    logTimeUsage,
    logMemoryHeapUsage,
  });
  return `${description}${summary}`;
};

const formatErrors = (errors) => {
  if (errors.length === 0) {
    return "";
  }
  const formatError = (error) => error.stack || error.message || error;

  if (errors.length === 1) {
    return `${ANSI.color(`-------- error --------`, ANSI.RED)}
${formatError(errors[0])}
${ANSI.color(`-------------------------`, ANSI.RED)}`;
  }

  let output = [];
  errors.forEach((error) => {
    output.push(
      prefixFirstAndIndentRemainingLines({
        prefix: `${UNICODE.CIRCLE_CROSS} `,
        indentation: "   ",
        text: formatError(error),
      }),
    );
  });
  return `${ANSI.color(`-------- errors (${errors.length}) --------`, ANSI.RED)}
${output.join(`\n`)}
${ANSI.color(`-------------------------`, ANSI.RED)}`;
};

const formatSummaryLog = (
  summary,
) => `-------------- summary -----------------
${createAllExecutionsSummary(summary)}
total duration: ${msAsDuration(summary.duration)}
----------------------------------------`;

const createAllExecutionsSummary = ({ counters }) => {
  if (counters.total === 0) {
    return `no execution`;
  }
  const executionLabel =
    counters.total === 1 ? `1 execution` : `${counters.total} executions`;
  return `${executionLabel}: ${createStatusSummary({
    counters,
  })}`;
};

const createIntermediateSummary = ({
  executionIndex,
  counters,
  memoryHeap,
  timeEllapsed,
  logTimeUsage,
  logMemoryHeapUsage,
}) => {
  const parts = [];
  if (executionIndex > 0 || counters.done > 0) {
    parts.push(
      createStatusSummary({
        counters: {
          ...counters,
          total: executionIndex + 1,
        },
      }),
    );
  }
  if (logTimeUsage && timeEllapsed) {
    parts.push(`duration: ${msAsEllapsedTime(timeEllapsed)}`);
  }
  if (logMemoryHeapUsage && memoryHeap) {
    parts.push(`memory heap: ${byteAsMemoryUsage(memoryHeap)}`);
  }
  if (parts.length === 0) {
    return "";
  }
  return ` (${parts.join(` / `)})`;
};

const createStatusSummary = ({ counters }) => {
  if (counters.aborted === counters.total) {
    return `all ${ANSI.color(`aborted`, EXECUTION_COLORS.aborted)}`;
  }
  if (counters.timedout === counters.total) {
    return `all ${ANSI.color(`timed out`, EXECUTION_COLORS.timedout)}`;
  }
  if (counters.failed === counters.total) {
    return `all ${ANSI.color(`failed`, EXECUTION_COLORS.failed)}`;
  }
  if (counters.completed === counters.total) {
    return `all ${ANSI.color(`completed`, EXECUTION_COLORS.completed)}`;
  }
  if (counters.cancelled === counters.total) {
    return `all ${ANSI.color(`cancelled`, EXECUTION_COLORS.cancelled)}`;
  }
  return createMixedDetails({
    counters,
  });
};

const createMixedDetails = ({ counters }) => {
  const parts = [];
  if (counters.timedout) {
    parts.push(
      `${counters.timedout} ${ANSI.color(
        `timed out`,
        EXECUTION_COLORS.timedout,
      )}`,
    );
  }
  if (counters.failed) {
    parts.push(
      `${counters.failed} ${ANSI.color(`failed`, EXECUTION_COLORS.failed)}`,
    );
  }
  if (counters.completed) {
    parts.push(
      `${counters.completed} ${ANSI.color(
        `completed`,
        EXECUTION_COLORS.completed,
      )}`,
    );
  }
  if (counters.aborted) {
    parts.push(
      `${counters.aborted} ${ANSI.color(`aborted`, EXECUTION_COLORS.aborted)}`,
    );
  }
  if (counters.cancelled) {
    parts.push(
      `${counters.cancelled} ${ANSI.color(
        `cancelled`,
        EXECUTION_COLORS.cancelled,
      )}`,
    );
  }
  return `${parts.join(", ")}`;
};

const descriptionFormatters = {
  executing: ({ index, total }) => {
    return ANSI.color(
      `executing ${padNumber(index, total)} of ${total}`,
      EXECUTION_COLORS.executing,
    );
  },
  aborted: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${padNumber(
        index,
        total,
      )} of ${total} aborted`,
      EXECUTION_COLORS.aborted,
    );
  },
  timedout: ({ index, total, executionParams }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${padNumber(
        index,
        total,
      )} of ${total} timeout after ${executionParams.allocatedMs}ms`,
      EXECUTION_COLORS.timedout,
    );
  },
  failed: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${padNumber(
        index,
        total,
      )} of ${total} failed`,
      EXECUTION_COLORS.failed,
    );
  },
  completed: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.OK_RAW} execution ${padNumber(
        index,
        total,
      )} of ${total} completed`,
      EXECUTION_COLORS.completed,
    );
  },
  cancelled: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${padNumber(
        index,
        total,
      )} of ${total} cancelled`,
      EXECUTION_COLORS.cancelled,
    );
  },
};

const padNumber = (index, total) => {
  const number = index + 1;
  const numberWidth = String(number).length;
  const totalWith = String(total).length;
  let missingWidth = totalWith - numberWidth;
  let padded = "";
  while (missingWidth--) {
    padded += "0";
  }
  padded += number;
  return padded;
};

const formatConsoleCalls = (consoleCalls) => {
  if (consoleCalls.length === 0) {
    return "";
  }
  const repartition = {
    debug: 0,
    info: 0,
    warning: 0,
    error: 0,
    log: 0,
  };
  consoleCalls.forEach((consoleCall) => {
    repartition[consoleCall.type]++;
  });
  const consoleOutput = formatConsoleOutput(consoleCalls);

  return `${ANSI.color(
    `-------- ${formatConsoleSummary(repartition)} --------`,
    ANSI.GREY,
  )}
${consoleOutput}
${ANSI.color(`-------------------------`, ANSI.GREY)}`;
};

const formatConsoleOutput = (consoleCalls) => {
  // inside Node.js you can do process.stdout.write()
  // and in that case the consoleCall is not suffixed with "\n"
  // we want to keep these calls together in the output
  const regroupedCalls = [];
  consoleCalls.forEach((consoleCall, index) => {
    if (index === 0) {
      regroupedCalls.push(consoleCall);
      return;
    }
    const previousCall = consoleCalls[index - 1];
    if (previousCall.type !== consoleCall.type) {
      regroupedCalls.push(consoleCall);
      return;
    }
    if (previousCall.text.endsWith("\n")) {
      regroupedCalls.push(consoleCall);
      return;
    }
    if (previousCall.text.endsWith("\r")) {
      regroupedCalls.push(consoleCall);
      return;
    }
    const previousRegroupedCallIndex = regroupedCalls.length - 1;
    const previousRegroupedCall = regroupedCalls[previousRegroupedCallIndex];
    previousRegroupedCall.text = `${previousRegroupedCall.text}${consoleCall.text}`;
  });

  let consoleOutput = ``;
  regroupedCalls.forEach((regroupedCall, index) => {
    const text = regroupedCall.text;
    const textFormatted = prefixFirstAndIndentRemainingLines({
      prefix: CONSOLE_ICONS[regroupedCall.type],
      text,
      trimLines: true,
      trimLastLine: index === regroupedCalls.length - 1,
    });
    consoleOutput += textFormatted;
  });
  return consoleOutput;
};

const prefixFirstAndIndentRemainingLines = ({
  prefix,
  indentation = "  ",
  text,
  trimLines,
  trimLastLine,
}) => {
  const lines = text.split(/\r?\n/);
  const firstLine = lines.shift();
  let result = `${prefix} ${firstLine}`;
  let i = 0;
  while (i < lines.length) {
    const line = trimLines ? lines[i].trim() : lines[i];
    i++;
    result += line.length
      ? `\n${indentation}${line}`
      : trimLastLine && i === lines.length
      ? ""
      : `\n`;
  }
  return result;
};

const CONSOLE_ICONS = {
  debug: UNICODE.DEBUG,
  info: UNICODE.INFO,
  warning: UNICODE.WARNING,
  error: UNICODE.FAILURE,
  log: " ",
};

const formatConsoleSummary = (repartition) => {
  const { debug, info, warning, error } = repartition;
  const parts = [];
  if (error) {
    parts.push(`${CONSOLE_ICONS.error} ${error}`);
  }
  if (warning) {
    parts.push(`${CONSOLE_ICONS.warning} ${warning}`);
  }
  if (info) {
    parts.push(`${CONSOLE_ICONS.info} ${info}`);
  }
  if (debug) {
    parts.push(`${CONSOLE_ICONS.debug} ${debug}`);
  }
  if (parts.length === 0) {
    return `console`;
  }
  return `console (${parts.join(" ")})`;
};

const formatExecution = ({
  label,
  details = {},
  consoleOutput,
  errorsOutput,
}) => {
  let message = ``;
  message += label;
  Object.keys(details).forEach((key) => {
    message += `
${key}: ${details[key]}`;
  });
  if (consoleOutput) {
    message += `\n${consoleOutput}`;
  }
  if (errorsOutput) {
    message += `\n${errorsOutput}`;
  }
  return message;
};

const executeSteps = async (
  executionSteps,
  {
    signal,
    teardown,
    logger,
    logRefresh,
    logRuntime,
    logEachDuration,
    logSummary,
    logTimeUsage,
    logMemoryHeapUsage,
    logFileRelativeUrl,
    logMergeForCompletedExecutions,
    logShortForCompletedExecutions,
    rootDirectoryUrl,
    webServer,

    keepRunning,
    defaultMsAllocatedPerExecution,
    maxExecutionsInParallel,
    failFast,
    gcBetweenExecutions,
    cooldownBetweenExecutions,

    coverageEnabled,
    coverageConfig,
    coverageIncludeMissing,
    coverageMethodForBrowsers,
    coverageMethodForNodeJs,
    coverageV8ConflictWarning,
    coverageTempDirectoryUrl,

    beforeExecutionCallback = () => {},
    afterExecutionCallback = () => {},
  } = {},
) => {
  executionSteps = executionSteps.filter(
    (executionStep) => !executionStep.runtime?.disabled,
  );

  const executePlanReturnValue = {};
  const report = {};
  const callbacks = [];

  const multipleExecutionsOperation = Abort.startOperation();
  multipleExecutionsOperation.addAbortSignal(signal);
  const failFastAbortController = new AbortController();
  if (failFast) {
    multipleExecutionsOperation.addAbortSignal(failFastAbortController.signal);
  }

  try {
    if (gcBetweenExecutions) {
      ensureGlobalGc();
    }

    if (coverageEnabled) {
      // when runned multiple times, we don't want to keep previous files in this directory
      await ensureEmptyDirectory(coverageTempDirectoryUrl);
      callbacks.push(async () => {
        if (multipleExecutionsOperation.signal.aborted) {
          // don't try to do the coverage stuff
          return;
        }
        try {
          if (coverageMethodForNodeJs === "NODE_V8_COVERAGE") {
            takeCoverage();
            // conceptually we don't need coverage anymore so it would be
            // good to call v8.stopCoverage()
            // but it logs a strange message about "result is not an object"
          }
          const planCoverage = await reportToCoverage(report, {
            signal: multipleExecutionsOperation.signal,
            logger,
            rootDirectoryUrl,
            coverageConfig,
            coverageIncludeMissing,
            coverageMethodForNodeJs,
            coverageV8ConflictWarning,
          });
          executePlanReturnValue.planCoverage = planCoverage;
        } catch (e) {
          if (Abort.isAbortError(e)) {
            return;
          }
          throw e;
        }
      });
    }

    const runtimeParams = {
      rootDirectoryUrl,
      webServer,

      coverageEnabled,
      coverageConfig,
      coverageMethodForBrowsers,
      coverageMethodForNodeJs,
      isTestPlan: true,
      teardown,
    };

    if (logMergeForCompletedExecutions && !process.stdout.isTTY) {
      logMergeForCompletedExecutions = false;
      logger.debug(
        `Force logMergeForCompletedExecutions to false because process.stdout.isTTY is false`,
      );
    }
    const debugLogsEnabled = logger.levels.debug;
    const executionLogsEnabled = logger.levels.info;
    const executionSpinner =
      logRefresh &&
      !debugLogsEnabled &&
      executionLogsEnabled &&
      process.stdout.isTTY &&
      // if there is an error during execution npm will mess up the output
      // (happens when npm runs several command in a workspace)
      // so we enable spinner only when !process.exitCode (no error so far)
      process.exitCode !== 1;

    const startMs = Date.now();
    let rawOutput = "";
    let executionLog = createLog({ newLine: "" });
    const counters = {
      total: executionSteps.length,
      aborted: 0,
      timedout: 0,
      failed: 0,
      completed: 0,
      done: 0,
    };
    await executeInParallel({
      multipleExecutionsOperation,
      maxExecutionsInParallel,
      cooldownBetweenExecutions,
      executionSteps,
      start: async (paramsFromStep) => {
        const executionIndex = executionSteps.indexOf(paramsFromStep);
        const { executionName, fileRelativeUrl, runtime } = paramsFromStep;
        const runtimeType = runtime.type;
        const runtimeName = runtime.name;
        const runtimeVersion = runtime.version;
        const executionParams = {
          measurePerformance: false,
          collectPerformance: false,
          collectConsole: true,
          allocatedMs: defaultMsAllocatedPerExecution,
          ...paramsFromStep,
          runtimeParams: {
            fileRelativeUrl,
            ...paramsFromStep.runtimeParams,
          },
        };
        const beforeExecutionInfo = {
          fileRelativeUrl,
          runtimeType,
          runtimeName,
          runtimeVersion,
          executionIndex,
          executionParams,
          startMs: Date.now(),
          executionResult: {
            status: "executing",
          },
          counters,
          timeEllapsed: Date.now() - startMs,
          memoryHeap: memoryUsage().heapUsed,
        };
        if (typeof executionParams.allocatedMs === "function") {
          executionParams.allocatedMs =
            executionParams.allocatedMs(beforeExecutionInfo);
        }
        let spinner;
        if (executionSpinner) {
          spinner = startSpinner({
            log: executionLog,
            render: () => {
              return createExecutionLog(beforeExecutionInfo, {
                logRuntime,
                logEachDuration,
                logTimeUsage,
                logMemoryHeapUsage,
              });
            },
          });
        }
        beforeExecutionCallback(beforeExecutionInfo);

        const fileUrl = `${rootDirectoryUrl}${fileRelativeUrl}`;
        let executionResult;
        if (existsSync(new URL(fileUrl))) {
          executionResult = await run({
            signal: multipleExecutionsOperation.signal,
            logger,
            allocatedMs: executionParams.allocatedMs,
            keepRunning,
            mirrorConsole: false, // file are executed in parallel, log would be a mess to read
            collectConsole: executionParams.collectConsole,
            coverageEnabled,
            coverageTempDirectoryUrl,
            runtime: executionParams.runtime,
            runtimeParams: {
              ...runtimeParams,
              ...executionParams.runtimeParams,
            },
          });
        } else {
          executionResult = {
            status: "failed",
            errors: [
              new Error(
                `No file at ${fileRelativeUrl} for execution "${executionName}"`,
              ),
            ],
          };
        }
        counters.done++;
        const fileReport = report[fileRelativeUrl];
        if (fileReport) {
          fileReport[executionName] = executionResult;
        } else {
          report[fileRelativeUrl] = {
            [executionName]: executionResult,
          };
        }

        const afterExecutionInfo = {
          ...beforeExecutionInfo,
          runtimeVersion: runtime.version,
          endMs: Date.now(),
          executionResult,
        };
        afterExecutionCallback(afterExecutionInfo);

        if (executionResult.status === "aborted") {
          counters.aborted++;
        } else if (executionResult.status === "timedout") {
          counters.timedout++;
        } else if (executionResult.status === "failed") {
          counters.failed++;
        } else if (executionResult.status === "completed") {
          counters.completed++;
        }
        if (gcBetweenExecutions) {
          global.gc();
        }
        if (executionLogsEnabled) {
          const log = createExecutionLog(afterExecutionInfo, {
            logShortForCompletedExecutions,
            logRuntime,
            logEachDuration,
            ...(logTimeUsage
              ? {
                  timeEllapsed: Date.now() - startMs,
                }
              : {}),
            ...(logMemoryHeapUsage
              ? { memoryHeap: memoryUsage().heapUsed }
              : {}),
          });
          // replace spinner with this execution result
          if (spinner) spinner.stop();
          executionLog.write(log);
          rawOutput += stripAnsi(log);

          const canOverwriteLog = canOverwriteLogGetter({
            logMergeForCompletedExecutions,
            executionResult,
          });
          if (canOverwriteLog) {
            // nothing to do, we reuse the current executionLog object
          } else {
            executionLog.destroy();
            executionLog = createLog({ newLine: "" });
          }
        }
        const isLastExecutionLog = executionIndex === executionSteps.length - 1;
        const cancelRemaining =
          failFast &&
          executionResult.status !== "completed" &&
          counters.done < counters.total;
        if (isLastExecutionLog && logger.levels.info) {
          executionLog.write("\n");
        }

        if (cancelRemaining) {
          logger.info(`"failFast" enabled -> cancel remaining executions`);
          failFastAbortController.abort();
        }
      },
    });
    if (!keepRunning) {
      logger.debug("trigger test plan teardown");
      await teardown.trigger();
    }

    counters.cancelled = counters.total - counters.done;
    const summary = {
      counters,
      // when execution is aborted, the remaining executions are "cancelled"
      duration: Date.now() - startMs,
    };
    if (logSummary) {
      const summaryLog = formatSummaryLog(summary);
      rawOutput += stripAnsi(summaryLog);
      logger.info(summaryLog);
    }
    if (summary.counters.total !== summary.counters.completed) {
      const logFileUrl = new URL(logFileRelativeUrl, rootDirectoryUrl).href;
      writeFileSync(logFileUrl, rawOutput);
      logger.info(`-> ${urlToFileSystemPath(logFileUrl)}`);
    }
    executePlanReturnValue.aborted = multipleExecutionsOperation.signal.aborted;
    executePlanReturnValue.planSummary = summary;
    executePlanReturnValue.planReport = report;
    for (const callback of callbacks) {
      await callback();
    }
    return executePlanReturnValue;
  } finally {
    await multipleExecutionsOperation.end();
  }
};

const canOverwriteLogGetter = ({
  logMergeForCompletedExecutions,
  executionResult,
}) => {
  if (!logMergeForCompletedExecutions) {
    return false;
  }
  if (executionResult.status === "aborted") {
    return true;
  }
  if (executionResult.status !== "completed") {
    return false;
  }
  const { consoleCalls = [] } = executionResult;
  if (consoleCalls.length > 0) {
    return false;
  }
  return true;
};

const executeInParallel = async ({
  multipleExecutionsOperation,
  maxExecutionsInParallel,
  cooldownBetweenExecutions,
  executionSteps,
  start,
}) => {
  const executionResults = [];
  let progressionIndex = 0;
  let remainingExecutionCount = executionSteps.length;

  const nextChunk = async () => {
    if (multipleExecutionsOperation.signal.aborted) {
      return;
    }
    const outputPromiseArray = [];
    while (
      remainingExecutionCount > 0 &&
      outputPromiseArray.length < maxExecutionsInParallel
    ) {
      remainingExecutionCount--;
      const outputPromise = executeOne(progressionIndex);
      progressionIndex++;
      outputPromiseArray.push(outputPromise);
    }
    if (outputPromiseArray.length) {
      await Promise.all(outputPromiseArray);
      if (remainingExecutionCount > 0) {
        await nextChunk();
      }
    }
  };

  const executeOne = async (index) => {
    const input = executionSteps[index];
    const output = await start(input);
    if (!multipleExecutionsOperation.signal.aborted) {
      executionResults[index] = output;
    }
    if (cooldownBetweenExecutions) {
      await new Promise((resolve) =>
        setTimeout(resolve, cooldownBetweenExecutions),
      );
    }
  };

  await nextChunk();

  return executionResults;
};

const githubAnnotationFromError = (
  error,
  { rootDirectoryUrl, executionInfo },
) => {
  if (error.isException) {
    return {
      annotation_level: "failure",
      title: error.site.message,
      message: replaceUrls(error.stackTrace, ({ match, url, line, column }) => {
        if (urlIsInsideOf(url, rootDirectoryUrl)) {
          const relativeUrl = urlToRelativeUrl(url, rootDirectoryUrl);
          match = stringifyUrlSite({ url: relativeUrl, line, column });
        }
        return match;
      }),
      ...(typeof error.site.line === "number"
        ? {
            start_line: error.site.line,
            end_line: error.site.line,
          }
        : {}),
    };
  }
  if (error.stack) {
    const annotation = {
      annotation_level: "failure",
      path: executionInfo.fileRelativeUrl,
    };
    let firstSite = true;
    const stack = replaceUrls(error.stack, ({ match, url, line, column }) => {
      if (urlIsInsideOf(url, rootDirectoryUrl)) {
        const relativeUrl = urlToRelativeUrl(url, rootDirectoryUrl);
        match = stringifyUrlSite({ url: relativeUrl, line, column });
      }
      if (firstSite) {
        firstSite = false;
        annotation.path = url;
        annotation.start_line = line;
        annotation.end_line = line;
      }
      return match;
    });
    annotation.message = stack;
    return annotation;
  }
  if (error.message) {
    return {
      annotation_level: "failure",
      path: executionInfo.fileRelativeUrl,
      message: error.message,
    };
  }
  return {
    annotation_level: "failure",
    path: executionInfo.fileRelativeUrl,
    message: error,
  };
};

const stringifyUrlSite = ({ url, line, column }) => {
  let string = url;
  if (typeof line === "number") {
    string += `:${line}`;
    if (typeof column === "number") {
      string += `:${column}`;
    }
  }
  return string;
};

const replaceUrls = (source, replace) => {
  return source.replace(/(?:https?|ftp|file):\/\/\S+/gm, (match) => {
    let replacement = "";
    const lastChar = match[match.length - 1];

    // hotfix because our url regex sucks a bit
    const endsWithSeparationChar = lastChar === ")" || lastChar === ":";
    if (endsWithSeparationChar) {
      match = match.slice(0, -1);
    }

    const lineAndColumnPattern = /:([0-9]+):([0-9]+)$/;
    const lineAndColumMatch = match.match(lineAndColumnPattern);
    if (lineAndColumMatch) {
      const lineAndColumnString = lineAndColumMatch[0];
      const lineString = lineAndColumMatch[1];
      const columnString = lineAndColumMatch[2];
      replacement = replace({
        match: lineAndColumMatch,
        url: match.slice(0, -lineAndColumnString.length),
        line: lineString ? parseInt(lineString) : null,
        column: columnString ? parseInt(columnString) : null,
      });
    } else {
      const linePattern = /:([0-9]+)$/;
      const lineMatch = match.match(linePattern);
      if (lineMatch) {
        const lineString = lineMatch[0];
        replacement = replace({
          match: lineMatch,
          url: match.slice(0, -lineString.length),
          line: lineString ? parseInt(lineString) : null,
        });
      } else {
        replacement = replace({
          match: lineMatch,
          url: match,
        });
      }
    }
    if (endsWithSeparationChar) {
      return `${replacement}${lastChar}`;
    }
    return replacement;
  });
};

/**
 * Execute a list of files and log how it goes.
 * @param {Object} testPlanParameters
 * @param {string|url} testPlanParameters.rootDirectoryUrl Directory containing test files;
 * @param {Object} [testPlanParameters.webServer] Web server info; required when executing test on browsers
 * @param {Object} testPlanParameters.testPlan Object associating files with runtimes where they will be executed
 * @param {boolean} [testPlanParameters.logShortForCompletedExecutions=false] Abbreviate completed execution information to shorten terminal output
 * @param {boolean} [testPlanParameters.logMergeForCompletedExecutions=false] Merge completed execution logs to shorten terminal output
 * @param {number} [testPlanParameters.maxExecutionsInParallel=1] Maximum amount of execution in parallel
 * @param {number} [testPlanParameters.defaultMsAllocatedPerExecution=30000] Milliseconds after which execution is aborted and considered as failed by timeout
 * @param {boolean} [testPlanParameters.failFast=false] Fails immediatly when a test execution fails
 * @param {number} [testPlanParameters.cooldownBetweenExecutions=0] Millisecond to wait between each execution
 * @param {boolean} [testPlanParameters.logMemoryHeapUsage=false] Add memory heap usage during logs
 * @param {boolean} [testPlanParameters.coverageEnabled=false] Controls if coverage is collected during files executions
 * @param {boolean} [testPlanParameters.coverageV8ConflictWarning=true] Warn when coverage from 2 executions cannot be merged
 * @return {Object} An object containing the result of all file executions
 */
const executeTestPlan = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel = "info",
  logRefresh = true,
  logRuntime = true,
  logEachDuration = true,
  logSummary = true,
  logTimeUsage = false,
  logMemoryHeapUsage = false,
  logFileRelativeUrl = ".jsenv/test_plan_debug.txt",
  logShortForCompletedExecutions = false,
  logMergeForCompletedExecutions = false,

  rootDirectoryUrl,
  webServer,
  testPlan,
  updateProcessExitCode = true,
  maxExecutionsInParallel = 1,
  defaultMsAllocatedPerExecution = 30_000,
  failFast = false,
  // keepRunning: false to ensure runtime is stopped once executed
  // because we have what we wants: execution is completed and
  // we have associated coverage and console output
  // passsing true means all node process and browsers launched stays opened
  // (can eventually be used for debug)
  keepRunning = false,
  cooldownBetweenExecutions = 0,
  gcBetweenExecutions = logMemoryHeapUsage,

  githubCheckEnabled = Boolean(process.env.GITHUB_WORKFLOW),
  githubCheckLogLevel,
  githubCheckName = "jsenv tests",
  githubCheckTitle,
  githubCheckToken,
  githubCheckRepositoryOwner,
  githubCheckRepositoryName,
  githubCheckCommitSha,

  coverageEnabled = process.argv.includes("--coverage"),
  coverageConfig = {
    "file:///**/node_modules/": false,
    "./**/.*": false,
    "./**/.*/": false,
    "./**/src/**/*.js": true,
    "./**/src/**/*.ts": true,
    "./**/src/**/*.jsx": true,
    "./**/src/**/*.tsx": true,
    "./**/tests/": false,
    "./**/*.test.html": false,
    "./**/*.test.html@*.js": false,
    "./**/*.test.js": false,
    "./**/*.test.mjs": false,
  },
  coverageIncludeMissing = true,
  coverageAndExecutionAllowed = false,
  coverageMethodForNodeJs = process.env.NODE_V8_COVERAGE
    ? "NODE_V8_COVERAGE"
    : "Profiler",
  // - When chromium only -> coverage generated by v8
  // - When chromium + node -> coverage generated by v8 are merged
  // - When firefox only -> coverage generated by babel+istanbul
  // - When chromium + firefox
  //   -> by default only coverage from chromium is used
  //   and a warning is logged according to coverageV8ConflictWarning
  //   -> to collect coverage from both browsers, pass coverageMethodForBrowsers: "istanbul"
  coverageMethodForBrowsers, // undefined | "playwright" | "istanbul"
  coverageV8ConflictWarning = true,
  coverageTempDirectoryUrl,
  // skip empty means empty files won't appear in the coverage reports (json and html)
  coverageReportSkipEmpty = false,
  // skip full means file with 100% coverage won't appear in coverage reports (json and html)
  coverageReportSkipFull = false,
  coverageReportTextLog = true,
  coverageReportJson = process.env.CI,
  coverageReportJsonFileUrl,
  coverageReportHtml = !process.env.CI,
  coverageReportHtmlDirectoryUrl,
  ...rest
}) => {
  const teardown = createTeardown();

  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  if (handleSIGINT) {
    operation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        () => {
          logger.debug(`SIGINT abort`);
          abort();
        },
      );
    });
  }

  let logger;
  let someNeedsServer = false;
  let someHasCoverageV8 = false;
  let someNodeRuntime = false;
  const runtimes = {};
  // param validation
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    rootDirectoryUrl = assertAndNormalizeDirectoryUrl(
      rootDirectoryUrl,
      "rootDirectoryUrl",
    );
    if (!existsSync(new URL(rootDirectoryUrl))) {
      throw new Error(`ENOENT on rootDirectoryUrl at ${rootDirectoryUrl}`);
    }
    if (typeof testPlan !== "object") {
      throw new Error(`testPlan must be an object, got ${testPlan}`);
    }

    logger = createLogger({ logLevel });

    Object.keys(testPlan).forEach((filePattern) => {
      const filePlan = testPlan[filePattern];
      if (!filePlan) return;
      Object.keys(filePlan).forEach((executionName) => {
        const executionConfig = filePlan[executionName];
        const { runtime } = executionConfig;
        if (runtime) {
          runtimes[runtime.name] = runtime.version;
          if (runtime.type === "browser") {
            if (runtime.capabilities && runtime.capabilities.coverageV8) {
              someHasCoverageV8 = true;
            }
            someNeedsServer = true;
          }
          if (runtime.type === "node") {
            someNodeRuntime = true;
          }
        }
      });
    });

    if (someNeedsServer) {
      await assertAndNormalizeWebServer(webServer, {
        signal: operation.signal,
        teardown,
        logger,
      });
    }

    if (githubCheckEnabled) {
      const githubCheckInfoFromEnv = process.env.GITHUB_WORKFLOW
        ? readGitHubWorkflowEnv()
        : {};
      githubCheckToken = githubCheckToken || githubCheckInfoFromEnv.githubToken;
      githubCheckRepositoryOwner =
        githubCheckRepositoryOwner || githubCheckInfoFromEnv.githubToken;
      githubCheckRepositoryName =
        githubCheckRepositoryName || githubCheckInfoFromEnv.githubToken;
      githubCheckCommitSha =
        githubCheckCommitSha || githubCheckInfoFromEnv.commitSha;
    }

    if (coverageEnabled) {
      if (coverageMethodForBrowsers === undefined) {
        coverageMethodForBrowsers = someHasCoverageV8
          ? "playwright"
          : "istanbul";
      }
      if (typeof coverageConfig !== "object") {
        throw new TypeError(
          `coverageConfig must be an object, got ${coverageConfig}`,
        );
      }
      if (!coverageAndExecutionAllowed) {
        const associationsForExecute = URL_META.resolveAssociations(
          { execute: testPlan },
          "file:///",
        );
        const associationsForCover = URL_META.resolveAssociations(
          { cover: coverageConfig },
          "file:///",
        );
        const patternsMatchingCoverAndExecute = Object.keys(
          associationsForExecute.execute,
        ).filter((testPlanPattern) => {
          const { cover } = URL_META.applyAssociations({
            url: testPlanPattern,
            associations: associationsForCover,
          });
          return cover;
        });
        if (patternsMatchingCoverAndExecute.length) {
          // It would be strange, for a given file to be both covered and executed
          throw new Error(
            createDetailedMessage(
              `some file will be both covered and executed`,
              {
                patterns: patternsMatchingCoverAndExecute,
              },
            ),
          );
        }
      }

      if (coverageTempDirectoryUrl === undefined) {
        coverageTempDirectoryUrl = new URL(
          "./.coverage/tmp/",
          rootDirectoryUrl,
        );
      } else {
        coverageTempDirectoryUrl = assertAndNormalizeDirectoryUrl(
          coverageTempDirectoryUrl,
          "coverageTempDirectoryUrl",
        );
      }
      if (coverageReportJson) {
        if (coverageReportJsonFileUrl === undefined) {
          coverageReportJsonFileUrl = new URL(
            "./.coverage/coverage.json",
            rootDirectoryUrl,
          );
        } else {
          coverageReportJsonFileUrl = assertAndNormalizeFileUrl(
            coverageReportJsonFileUrl,
            "coverageReportJsonFileUrl",
          );
        }
      }
      if (coverageReportHtml) {
        if (coverageReportHtmlDirectoryUrl === undefined) {
          coverageReportHtmlDirectoryUrl = new URL(
            "./.coverage/",
            rootDirectoryUrl,
          );
        } else {
          coverageReportHtmlDirectoryUrl = assertAndNormalizeDirectoryUrl(
            coverageReportHtmlDirectoryUrl,
            "coverageReportHtmlDirectoryUrl",
          );
        }
      }
    }
  }

  logger.debug(
    createDetailedMessage(`Prepare executing plan`, {
      runtimes: JSON.stringify(runtimes, null, "  "),
    }),
  );

  // param normalization
  {
    if (coverageEnabled) {
      if (Object.keys(coverageConfig).length === 0) {
        logger.warn(
          `coverageConfig is an empty object. Nothing will be instrumented for coverage so your coverage will be empty`,
        );
      }
      if (
        someNodeRuntime &&
        coverageEnabled &&
        coverageMethodForNodeJs === "NODE_V8_COVERAGE"
      ) {
        if (process.env.NODE_V8_COVERAGE) {
          // when runned multiple times, we don't want to keep previous files in this directory
          await ensureEmptyDirectory(process.env.NODE_V8_COVERAGE);
        } else {
          coverageMethodForNodeJs = "Profiler";
          logger.warn(
            createDetailedMessage(
              `process.env.NODE_V8_COVERAGE is required to generate coverage for Node.js subprocesses`,
              {
                "suggestion": `set process.env.NODE_V8_COVERAGE`,
                "suggestion 2": `use coverageMethodForNodeJs: "Profiler". But it means coverage for child_process and worker_thread cannot be collected`,
              },
            ),
          );
        }
      }
    }
  }

  testPlan = {
    "file:///**/node_modules/": null,
    "**/*./": null,
    ...testPlan,
    "**/.jsenv/": null,
  };
  logger.debug(`Generate executions`);
  const executionSteps = await executionStepsFromTestPlan({
    signal,
    testPlan,
    rootDirectoryUrl,
  });
  logger.debug(`${executionSteps.length} executions planned`);
  let beforeExecutionCallback;
  let afterExecutionCallback;
  let afterAllExecutionCallback = () => {};
  if (githubCheckEnabled) {
    const githubCheckRun = await startGithubCheckRun({
      logLevel: githubCheckLogLevel,
      githubToken: githubCheckToken,
      repositoryOwner: githubCheckRepositoryOwner,
      repositoryName: githubCheckRepositoryName,
      commitSha: githubCheckCommitSha,
      checkName: githubCheckName,
      checkTitle: `Tests executions`,
      checkSummary: `${executionSteps.length} files will be executed`,
    });
    beforeExecutionCallback = (beforeExecutionInfo) => {
      githubCheckRun.progress({
        summary: formatExecutionLabel(beforeExecutionInfo, {
          logTimeUsage,
          logMemoryHeapUsage,
        }),
      });
    };
    afterExecutionCallback = (afterExecutionInfo) => {
      const annotations = [];
      const { errors = [] } = afterExecutionInfo;
      for (const error of errors) {
        annotations.push(
          githubAnnotationFromError(error, {
            rootDirectoryUrl,
            executionInfo: afterExecutionInfo,
          }),
        );
      }

      githubCheckRun.progress({
        summary: formatExecutionLabel(afterExecutionInfo, {
          logTimeUsage,
          logMemoryHeapUsage,
        }),
      });
    };
    afterAllExecutionCallback = async ({ testPlanSummary }) => {
      if (
        testPlanSummary.counters.total !== testPlanSummary.counters.complete
      ) {
        await githubCheckRun.fail({
          summary: formatSummaryLog(testPlanSummary),
        });
        return;
      }
      await githubCheckRun.pass({
        summary: formatSummaryLog(testPlanSummary),
      });
    };
  }

  const result = await executeSteps(executionSteps, {
    signal,
    teardown,
    logger,
    logRefresh,
    logSummary,
    logRuntime,
    logEachDuration,
    logTimeUsage,
    logMemoryHeapUsage,
    logFileRelativeUrl,
    logShortForCompletedExecutions,
    logMergeForCompletedExecutions,
    rootDirectoryUrl,
    webServer,

    maxExecutionsInParallel,
    defaultMsAllocatedPerExecution,
    failFast,
    keepRunning,
    cooldownBetweenExecutions,
    gcBetweenExecutions,

    githubCheckEnabled,
    githubCheckName,
    githubCheckTitle,
    githubCheckToken,
    githubCheckRepositoryOwner,
    githubCheckRepositoryName,
    githubCheckCommitSha,

    coverageEnabled,
    coverageConfig,
    coverageIncludeMissing,
    coverageMethodForBrowsers,
    coverageMethodForNodeJs,
    coverageV8ConflictWarning,
    coverageTempDirectoryUrl,

    beforeExecutionCallback,
    afterExecutionCallback,
  });

  const hasFailed =
    result.planSummary.counters.total !== result.planSummary.counters.complete;
  if (updateProcessExitCode && hasFailed) {
    process.exitCode = 1;
  }
  const planCoverage = result.planCoverage;
  // planCoverage can be null when execution is aborted
  if (planCoverage) {
    const promises = [];
    // keep this one first because it does ensureEmptyDirectory
    // and in case coverage json file gets written in the same directory
    // it must be done before
    if (coverageEnabled && coverageReportHtml) {
      await ensureEmptyDirectory(coverageReportHtmlDirectoryUrl);
      const htmlCoverageDirectoryIndexFileUrl = `${coverageReportHtmlDirectoryUrl}index.html`;
      logger.info(
        `-> ${urlToFileSystemPath(htmlCoverageDirectoryIndexFileUrl)}`,
      );
      promises.push(
        generateCoverageHtmlDirectory(planCoverage, {
          rootDirectoryUrl,
          coverageHtmlDirectoryRelativeUrl: urlToRelativeUrl(
            coverageReportHtmlDirectoryUrl,
            rootDirectoryUrl,
          ),
          coverageReportSkipEmpty,
          coverageReportSkipFull,
        }),
      );
    }
    if (coverageEnabled && coverageReportJson) {
      promises.push(
        generateCoverageJsonFile({
          coverage: result.planCoverage,
          coverageJsonFileUrl: coverageReportJsonFileUrl,
          logger,
        }),
      );
    }
    if (coverageEnabled && coverageReportTextLog) {
      promises.push(
        generateCoverageTextLog(result.planCoverage, {
          coverageReportSkipEmpty,
          coverageReportSkipFull,
        }),
      );
    }
    await Promise.all(promises);
  }

  const returnValue = {
    testPlanAborted: result.aborted,
    testPlanSummary: result.planSummary,
    testPlanReport: result.planReport,
    testPlanCoverage: planCoverage,
  };
  await afterAllExecutionCallback(returnValue);
  return returnValue;
};

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

const WEB_URL_CONVERTER = {
  asWebUrl: (fileUrl, webServer) => {
    if (urlIsInsideOf(fileUrl, webServer.rootDirectoryUrl)) {
      return moveUrl({
        url: fileUrl,
        from: webServer.rootDirectoryUrl,
        to: `${webServer.origin}/`,
      });
    }
    const fsRootUrl = ensureWindowsDriveLetter("file:///", fileUrl);
    return `${webServer.origin}/@fs/${fileUrl.slice(fsRootUrl.length)}`;
  },
  asFileUrl: (webUrl, webServer) => {
    const { pathname, search } = new URL(webUrl);
    if (pathname.startsWith("/@fs/")) {
      const fsRootRelativeUrl = pathname.slice("/@fs/".length);
      return `file:///${fsRootRelativeUrl}${search}`;
    }
    return moveUrl({
      url: webUrl,
      from: `${webServer.origin}/`,
      to: webServer.rootDirectoryUrl,
    });
  },
};

const initJsSupervisorMiddleware = async (
  page,
  { webServer, fileUrl, fileServerUrl },
) => {
  const inlineScriptContents = new Map();

  const interceptHtmlToExecute = async ({ route }) => {
    const response = await route.fetch();
    const originalBody = await response.text();
    const injectionResult = await injectSupervisorIntoHTML(
      {
        content: originalBody,
        url: fileUrl,
      },
      {
        supervisorScriptSrc: `/@fs/${supervisorFileUrl.slice(
          "file:///".length,
        )}`,
        supervisorOptions: {},
        inlineAsRemote: true,
        webServer,
        onInlineScript: ({ src, textContent }) => {
          const inlineScriptWebUrl = new URL(src, `${webServer.origin}/`).href;
          inlineScriptContents.set(inlineScriptWebUrl, textContent);
        },
      },
    );
    route.fulfill({
      response,
      body: injectionResult.content,
      headers: {
        ...response.headers(),
        "content-length": Buffer.byteLength(injectionResult.content),
      },
    });
  };

  const interceptInlineScript = ({ url, route }) => {
    const inlineScriptContent = inlineScriptContents.get(url);
    route.fulfill({
      status: 200,
      body: inlineScriptContent,
      headers: {
        "content-type": "text/javascript",
        "content-length": Buffer.byteLength(inlineScriptContent),
      },
    });
  };

  const interceptFileSystemUrl = ({ url, route }) => {
    const relativeUrl = url.slice(webServer.origin.length);
    const fsPath = relativeUrl.slice("/@fs/".length);
    const fsUrl = `file:///${fsPath}`;
    const fileContent = readFileSync(new URL(fsUrl), "utf8");
    route.fulfill({
      status: 200,
      body: fileContent,
      headers: {
        "content-type": "text/javascript",
        "content-length": Buffer.byteLength(fileContent),
      },
    });
  };

  await page.route("**", async (route) => {
    const request = route.request();
    const url = request.url();
    if (url === fileServerUrl && urlToExtension(url) === ".html") {
      interceptHtmlToExecute({
        url,
        request,
        route,
      });
      return;
    }
    if (inlineScriptContents.has(url)) {
      interceptInlineScript({
        url,
        request,
        route,
      });
      return;
    }
    const fsServerUrl = new URL("/@fs/", webServer.origin);
    if (url.startsWith(fsServerUrl)) {
      interceptFileSystemUrl({ url, request, route });
      return;
    }
    route.fallback();
  });
};

const initIstanbulMiddleware = async (
  page,
  { webServer, rootDirectoryUrl, coverageConfig },
) => {
  const associations = URL_META.resolveAssociations(
    { cover: coverageConfig },
    rootDirectoryUrl,
  );
  await page.route("**", async (route) => {
    const request = route.request();
    const url = request.url(); // transform into a local url
    const fileUrl = WEB_URL_CONVERTER.asFileUrl(url, webServer);
    const needsInstrumentation = URL_META.applyAssociations({
      url: fileUrl,
      associations,
    }).cover;
    if (!needsInstrumentation) {
      route.fallback();
      return;
    }
    const response = await route.fetch();
    const originalBody = await response.text();
    try {
      const result = await applyBabelPlugins({
        babelPlugins: [babelPluginInstrument],
        input: originalBody,
        // jsenv server could send info to know it's a js module or js classic
        // but in the end it's not super important
        // - it's ok to parse js classic as js module considering it's only for istanbul instrumentation
        inputIsJsModule: true,
        inputUrl: fileUrl,
      });
      let code = result.code;
      code = SOURCEMAP.writeComment({
        contentType: "text/javascript",
        content: code,
        specifier: generateSourcemapDataUrl(result.map),
      });
      route.fulfill({
        response,
        body: code,
        headers: {
          ...response.headers(),
          "content-length": Buffer.byteLength(code),
        },
      });
    } catch (e) {
      if (e.code === "PARSE_ERROR") {
        route.fulfill({ response });
      } else {
        console.error(e);
        route.fulfill({ response });
      }
    }
  });
};

const browserPromiseCache = new Map();

const createRuntimeUsingPlaywright = ({
  browserName,
  browserVersion,
  coveragePlaywrightAPIAvailable = false,
  shouldIgnoreError = () => false,
  transformErrorHook = (error) => error,
  isolatedTab = false,
  headful,
  playwrightLaunchOptions = {},
  ignoreHTTPSErrors = true,
}) => {
  const label = `${browserName}${browserVersion}`;
  const runtime = {
    type: "browser",
    name: browserName,
    version: browserVersion,
    capabilities: {
      coverageV8: coveragePlaywrightAPIAvailable,
    },
  };

  runtime.run = async ({
    signal = new AbortController().signal,
    logger,
    rootDirectoryUrl,
    webServer,
    fileRelativeUrl,

    // measurePerformance,
    collectPerformance,
    coverageEnabled = false,
    coverageConfig,
    coverageMethodForBrowsers,
    coverageFileUrl,

    teardown,
    isTestPlan,
    stopSignal,
    keepRunning,
    onConsole,
  }) => {
    const fileUrl = new URL(fileRelativeUrl, rootDirectoryUrl).href;
    if (!urlIsInsideOf(fileUrl, webServer.rootDirectoryUrl)) {
      throw new Error(`Cannot execute file that is outside web server root directory
  --- file --- 
  ${fileUrl}
  --- web server root directory url ---
  ${webServer.rootDirectoryUrl}`);
    }
    const fileServerUrl = WEB_URL_CONVERTER.asWebUrl(fileUrl, webServer);
    const cleanupCallbackList = createCallbackListNotifiedOnce();
    const cleanup = memoize(async (reason) => {
      await cleanupCallbackList.notify({ reason });
    });

    const isBrowserDedicatedToExecution = isolatedTab || !isTestPlan;
    let browserAndContextPromise = isBrowserDedicatedToExecution
      ? null
      : browserPromiseCache.get(label);
    if (!browserAndContextPromise) {
      browserAndContextPromise = (async () => {
        const browser = await launchBrowserUsingPlaywright({
          signal,
          browserName,
          stopOnExit: true,
          playwrightLaunchOptions: {
            ...playwrightLaunchOptions,
            headless: headful === undefined ? !keepRunning : !headful,
          },
        });
        if (browser._initializer.version) {
          runtime.version = browser._initializer.version;
        }
        const browserContext = await browser.newContext({ ignoreHTTPSErrors });
        return { browser, browserContext };
      })();
      if (!isBrowserDedicatedToExecution) {
        browserPromiseCache.set(label, browserAndContextPromise);
        cleanupCallbackList.add(() => {
          browserPromiseCache.delete(label);
        });
      }
    }
    const { browser, browserContext } = await browserAndContextPromise;
    const closeBrowser = async () => {
      const disconnected = browser.isConnected()
        ? new Promise((resolve) => {
            const disconnectedCallback = () => {
              browser.removeListener("disconnected", disconnectedCallback);
              resolve();
            };
            browser.on("disconnected", disconnectedCallback);
          })
        : Promise.resolve();
      // for some reason without this timeout
      // browser.close() never resolves (playwright does not like something)
      await new Promise((resolve) => setTimeout(resolve, 50));
      try {
        await browser.close();
      } catch (e) {
        if (isTargetClosedError(e)) {
          return;
        }
        throw e;
      }
      await disconnected;
    };

    const page = await browserContext.newPage();

    const istanbulInstrumentationEnabled =
      coverageEnabled &&
      (!runtime.capabilities.coverageV8 ||
        coverageMethodForBrowsers === "istanbul");
    if (istanbulInstrumentationEnabled) {
      await initIstanbulMiddleware(page, {
        webServer,
        rootDirectoryUrl,
        coverageConfig,
      });
    }
    if (!webServer.isJsenvDevServer) {
      await initJsSupervisorMiddleware(page, {
        webServer,
        fileUrl,
        fileServerUrl,
      });
    }
    const closePage = async () => {
      try {
        await page.close();
      } catch (e) {
        if (isTargetClosedError(e)) {
          return;
        }
        throw e;
      }
    };

    const result = {
      status: "pending",
      namespace: null,
      errors: [],
    };
    const callbacks = [];
    if (coverageEnabled) {
      if (
        runtime.capabilities.coverageV8 &&
        coverageMethodForBrowsers === "playwright"
      ) {
        await page.coverage.startJSCoverage({
          // reportAnonymousScripts: true,
        });
        callbacks.push(async () => {
          const v8CoveragesWithWebUrls = await page.coverage.stopJSCoverage();
          // we convert urls starting with http:// to file:// because we later
          // convert the url to filesystem path in istanbulCoverageFromV8Coverage function
          const v8CoveragesWithFsUrls = v8CoveragesWithWebUrls.map(
            (v8CoveragesWithWebUrl) => {
              const fsUrl = WEB_URL_CONVERTER.asFileUrl(
                v8CoveragesWithWebUrl.url,
                webServer,
              );
              return {
                ...v8CoveragesWithWebUrl,
                url: fsUrl,
              };
            },
          );
          const coverage = await filterV8Coverage(
            { result: v8CoveragesWithFsUrls },
            {
              rootDirectoryUrl,
              coverageConfig,
            },
          );
          writeFileSync$1(
            new URL(coverageFileUrl),
            JSON.stringify(coverage, null, "  "),
          );
        });
      } else {
        callbacks.push(() => {
          const scriptExecutionResults = result.namespace;
          if (scriptExecutionResults) {
            const coverage =
              generateCoverageForPage(scriptExecutionResults) || {};
            writeFileSync$1(
              new URL(coverageFileUrl),
              JSON.stringify(coverage, null, "  "),
            );
          }
        });
      }
    } else {
      callbacks.push(() => {
        const scriptExecutionResults = result.namespace;
        if (scriptExecutionResults) {
          Object.keys(scriptExecutionResults).forEach((fileRelativeUrl) => {
            delete scriptExecutionResults[fileRelativeUrl].coverage;
          });
        }
      });
    }

    if (collectPerformance) {
      callbacks.push(async () => {
        const performance = await page.evaluate(
          /* eslint-disable no-undef */
          /* istanbul ignore next */
          () => {
            const { performance } = window;
            if (!performance) {
              return null;
            }
            const measures = {};
            const measurePerfEntries = performance.getEntriesByType("measure");
            measurePerfEntries.forEach((measurePerfEntry) => {
              measures[measurePerfEntry.name] = measurePerfEntry.duration;
            });
            return {
              timeOrigin: performance.timeOrigin,
              timing: performance.timing.toJSON(),
              navigation: performance.navigation.toJSON(),
              measures,
            };
          },
          /* eslint-enable no-undef */
        );
        result.performance = performance;
      });
    }

    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-console
    const removeConsoleListener = registerEvent({
      object: page,
      eventType: "console",
      // https://github.com/microsoft/playwright/blob/master/docs/api.md#event-console
      callback: async (consoleMessage) => {
        onConsole({
          type: consoleMessage.type(),
          text: `${extractTextFromConsoleMessage(consoleMessage)}\n`,
        });
      },
    });
    cleanupCallbackList.add(removeConsoleListener);
    const actionOperation = Abort.startOperation();
    actionOperation.addAbortSignal(signal);

    const winnerPromise = new Promise((resolve, reject) => {
      raceCallbacks(
        {
          aborted: (cb) => {
            return actionOperation.addAbortCallback(cb);
          },
          // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
          error: (cb) => {
            return registerEvent({
              object: page,
              eventType: "error",
              callback: (error) => {
                if (shouldIgnoreError(error, "error")) {
                  return;
                }
                cb(transformErrorHook(error));
              },
            });
          },
          // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
          // pageerror: () => {
          //   return registerEvent({
          //     object: page,
          //     eventType: "pageerror",
          //     callback: (error) => {
          //       if (
          //         webServer.isJsenvDevServer ||
          //         shouldIgnoreError(error, "pageerror")
          //       ) {
          //         return
          //       }
          //       result.errors.push(transformErrorHook(error))
          //     },
          //   })
          // },
          closed: (cb) => {
            // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
            if (isBrowserDedicatedToExecution) {
              browser.on("disconnected", async () => {
                cb({ reason: "browser disconnected" });
              });
              cleanupCallbackList.add(closePage);
              cleanupCallbackList.add(closeBrowser);
            } else {
              const disconnectedCallback = async () => {
                throw new Error("browser disconnected during execution");
              };
              browser.on("disconnected", disconnectedCallback);
              page.on("close", () => {
                cb({ reason: "page closed" });
              });
              cleanupCallbackList.add(closePage);
              cleanupCallbackList.add(() => {
                browser.removeListener("disconnected", disconnectedCallback);
              });
              teardown.addCallback(async () => {
                browser.removeListener("disconnected", disconnectedCallback);
                logger.debug(`testPlan teardown -> closing ${browserName}`);
                await closeBrowser();
              });
            }
          },
          response: async (cb) => {
            try {
              await page.goto(fileServerUrl, { timeout: 0 });
              const returnValue = await page.evaluate(
                /* eslint-disable no-undef */
                /* istanbul ignore next */
                async () => {
                  let startTime;
                  try {
                    startTime = window.performance.timing.navigationStart;
                  } catch (e) {
                    startTime = Date.now();
                  }
                  if (!window.__supervisor__) {
                    throw new Error("window.__supervisor__ is undefined");
                  }
                  const executionResultFromJsenvSupervisor =
                    await window.__supervisor__.getDocumentExecutionResult();
                  return {
                    type: "window_supervisor",
                    startTime,
                    endTime: Date.now(),
                    executionResults:
                      executionResultFromJsenvSupervisor.executionResults,
                  };
                },
                /* eslint-enable no-undef */
              );
              cb(returnValue);
            } catch (e) {
              reject(e);
            }
          },
        },
        resolve,
      );
    });

    const writeResult = async () => {
      const winner = await winnerPromise;
      if (winner.name === "aborted") {
        result.status = "aborted";
        return;
      }
      if (winner.name === "error") {
        let error = winner.data;
        result.status = "failed";
        result.errors.push(error);
        return;
      }
      if (winner.name === "pageerror") {
        let error = winner.data;
        result.status = "failed";
        result.errors.push(error);
        return;
      }
      if (winner.name === "closed") {
        result.status = "failed";
        result.errors.push(
          isBrowserDedicatedToExecution
            ? new Error(`browser disconnected during execution`)
            : new Error(`page closed during execution`),
        );
        return;
      }
      // winner.name === "response"
      const { executionResults } = winner.data;
      result.status = "completed";
      result.namespace = executionResults;
      Object.keys(executionResults).forEach((key) => {
        const executionResult = executionResults[key];
        if (executionResult.status === "failed") {
          result.status = "failed";
          if (executionResult.exception) {
            result.errors.push(executionResult.exception);
          } else {
            result.errors.push(executionResult.error);
          }
        }
      });
    };

    try {
      await writeResult();
      if (collectPerformance) {
        result.performance = performance;
      }
      await callbacks.reduce(async (previous, callback) => {
        await previous;
        await callback();
      }, Promise.resolve());
    } catch (e) {
      result.status = "failed";
      result.errors = [e];
    }
    if (keepRunning) {
      stopSignal.notify = cleanup;
    } else {
      await cleanup("execution done");
    }
    return result;
  };
  return runtime;
};

const generateCoverageForPage = (scriptExecutionResults) => {
  let istanbulCoverageComposed = null;
  Object.keys(scriptExecutionResults).forEach((fileRelativeUrl) => {
    const istanbulCoverage = scriptExecutionResults[fileRelativeUrl].coverage;
    istanbulCoverageComposed = istanbulCoverageComposed
      ? composeTwoFileByFileIstanbulCoverages(
          istanbulCoverageComposed,
          istanbulCoverage,
        )
      : istanbulCoverage;
  });
  return istanbulCoverageComposed;
};

const launchBrowserUsingPlaywright = async ({
  signal,
  browserName,
  stopOnExit,
  playwrightLaunchOptions,
}) => {
  const launchBrowserOperation = Abort.startOperation();
  launchBrowserOperation.addAbortSignal(signal);
  const playwright = await importPlaywright({ browserName });
  if (stopOnExit) {
    launchBrowserOperation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGHUP: true,
          SIGTERM: true,
          SIGINT: true,
          beforeExit: true,
          exit: true,
        },
        abort,
      );
    });
  }
  const browserClass = playwright[browserName];
  try {
    const browser = await browserClass.launch({
      ...playwrightLaunchOptions,
      // let's handle them to close properly browser + remove listener
      // instead of relying on playwright to do so
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
    });
    launchBrowserOperation.throwIfAborted();
    return browser;
  } catch (e) {
    if (launchBrowserOperation.signal.aborted && isTargetClosedError(e)) {
      // rethrow the abort error
      launchBrowserOperation.throwIfAborted();
    }
    throw e;
  } finally {
    await launchBrowserOperation.end();
  }
};

const importPlaywright = async ({ browserName }) => {
  try {
    const namespace = await import("playwright");
    return namespace;
  } catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(
        createDetailedMessage(
          `"playwright" not found. You need playwright in your dependencies to use "${browserName}"`,
          {
            suggestion: `npm install --save-dev playwright`,
          },
        ),
        { cause: e },
      );
    }
    throw e;
  }
};

const isTargetClosedError = (error) => {
  if (error.message.match(/Protocol error \(.*?\): Target closed/)) {
    return true;
  }
  if (error.message.match(/Protocol error \(.*?\): Browser.*?closed/)) {
    return true;
  }
  return error.message.includes("browserContext.close: Browser closed");
};

const extractTextFromConsoleMessage = (consoleMessage) => {
  return consoleMessage.text();
  // ensure we use a string so that istanbul won't try
  // to put any coverage statement inside it
  // ideally we should use uneval no ?
  // eslint-disable-next-line no-new-func
  //   const functionEvaluatedBrowserSide = new Function(
  //     "value",
  //     `if (value instanceof Error) {
  //   return value.stack
  // }
  // return value`,
  //   )
  //   const argValues = await Promise.all(
  //     message.args().map(async (arg) => {
  //       const jsHandle = arg
  //       try {
  //         return await jsHandle.executionContext().evaluate(functionEvaluatedBrowserSide, jsHandle)
  //       } catch (e) {
  //         return String(jsHandle)
  //       }
  //     }),
  //   )
  //   const text = argValues.reduce((previous, value, index) => {
  //     let string
  //     if (typeof value === "object") string = JSON.stringify(value, null, "  ")
  //     else string = String(value)
  //     if (index === 0) return `${previous}${string}`
  //     return `${previous} ${string}`
  //   }, "")
  //   return text
};

const registerEvent = ({ object, eventType, callback }) => {
  object.on(eventType, callback);
  return () => {
    object.removeListener(eventType, callback);
  };
};

const chromium = (params) => {
  return createChromiumRuntine(params);
};

const chromiumIsolatedTab = (params) => {
  return createChromiumRuntine({
    ...params,
    isolatedTab: true,
  });
};

const createChromiumRuntine = (params) => {
  return createRuntimeUsingPlaywright({
    browserName: "chromium",
    // browserVersion will be set by "browser._initializer.version"
    // see also https://github.com/microsoft/playwright/releases
    browserVersion: "unset",
    coveragePlaywrightAPIAvailable: true,
    ...params,
  });
};

const firefox = (params) => {
  return createFirefoxRuntime(params);
};

const firefoxIsolatedTab = (params) => {
  return createRuntimeUsingPlaywright({
    ...params,
    isolatedTab: true,
  });
};

const createFirefoxRuntime = ({
  disableOnWindowsBecauseFlaky,
  ...params
} = {}) => {
  if (process.platform === "win32") {
    if (disableOnWindowsBecauseFlaky === undefined) {
      // https://github.com/microsoft/playwright/issues/1396
      console.warn(
        `Windows + firefox detected: executions on firefox will be ignored  (firefox is flaky on windows).
To disable this warning, use disableOnWindowsBecauseFlaky: true
To ignore potential flakyness, use disableOnWindowsBecauseFlaky: false`,
      );
      disableOnWindowsBecauseFlaky = true;
    }
    if (disableOnWindowsBecauseFlaky) {
      return {
        disabled: true,
      };
    }
  }

  return createRuntimeUsingPlaywright({
    browserName: "firefox",
    // browserVersion will be set by "browser._initializer.version"
    // see also https://github.com/microsoft/playwright/releases
    browserVersion: "unset",
    isolatedTab: true,
    ...params,
  });
};

const webkit = (params) => {
  return createWekbitRuntime(params);
};

const webkitIsolatedTab = (params) => {
  return createWekbitRuntime({
    ...params,
    isolatedTab: true,
  });
};

const createWekbitRuntime = (params) => {
  return createRuntimeUsingPlaywright({
    browserName: "webkit",
    // browserVersion will be set by "browser._initializer.version"
    // see also https://github.com/microsoft/playwright/releases
    browserVersion: "unset",
    shouldIgnoreError: (error) => {
      // we catch error during execution but safari throw unhandled rejection
      // in a non-deterministic way.
      // I suppose it's due to some race condition to decide if the promise is catched or not
      // for now we'll ignore unhandled rejection on wekbkit
      if (error.name === "Unhandled Promise Rejection") {
        return true;
      }
      return false;
    },
    transformErrorHook: (error) => {
      // Force error stack to contain the error message
      // because it's not the case on webkit
      error.stack = `${error.message}
    at ${error.stack}`;
      return error;
    },
    ...params,
  });
};

const ExecOptions = {
  fromExecArgv: (execArgv) => {
    const execOptions = {};
    let i = 0;
    while (i < execArgv.length) {
      const execArg = execArgv[i];
      const option = execOptionFromExecArg(execArg);
      const existing = execOptions[option.name];
      if (existing) {
        execOptions[option.name] = Array.isArray(existing)
          ? [...existing, option.value]
          : [existing, option.value];
      } else {
        execOptions[option.name] = option.value;
      }
      i++;
    }
    return execOptions;
  },
  toExecArgv: (execOptions) => {
    const execArgv = [];
    Object.keys(execOptions).forEach((optionName) => {
      const optionValue = execOptions[optionName];
      if (optionValue === "unset") {
        return;
      }
      if (optionValue === "") {
        execArgv.push(optionName);
        return;
      }
      if (Array.isArray(optionValue)) {
        optionValue.forEach((subValue) => {
          execArgv.push(`${optionName}=${subValue}`);
        });
      } else {
        execArgv.push(`${optionName}=${optionValue}`);
      }
    });
    return execArgv;
  },
};

const execOptionFromExecArg = (execArg) => {
  const equalCharIndex = execArg.indexOf("=");
  if (equalCharIndex === -1) {
    return {
      name: execArg,
      value: "",
    };
  }
  const name = execArg.slice(0, equalCharIndex);
  const value = execArg.slice(equalCharIndex + 1);
  return {
    name,
    value,
  };
};

const createChildExecOptions = async ({
  signal = new AbortController().signal,
  // https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_automatically-attach-debugger-to-nodejs-subprocesses
  processExecArgv = process.execArgv,
  processDebugPort = process.debugPort,

  debugPort = 0,
  debugMode = "inherit",
  debugModeInheritBreak = true,
} = {}) => {
  if (
    typeof debugMode === "string" &&
    AVAILABLE_DEBUG_MODE.indexOf(debugMode) === -1
  ) {
    throw new TypeError(
      createDetailedMessage(`unexpected debug mode.`, {
        ["debug mode"]: debugMode,
        ["allowed debug mode"]: AVAILABLE_DEBUG_MODE,
      }),
    );
  }
  const childExecOptions = ExecOptions.fromExecArgv(processExecArgv);
  await mutateDebuggingOptions(childExecOptions, {
    signal,
    processDebugPort,
    debugMode,
    debugPort,
    debugModeInheritBreak,
  });
  return childExecOptions;
};

const AVAILABLE_DEBUG_MODE = [
  "none",
  "inherit",
  "inspect",
  "inspect-brk",
  "debug",
  "debug-brk",
];

const mutateDebuggingOptions = async (
  childExecOptions,
  {
    // ensure multiline
    signal,
    processDebugPort,
    debugMode,
    debugPort,
    debugModeInheritBreak,
  },
) => {
  const parentDebugInfo = getDebugInfo(childExecOptions);
  const parentDebugModeOptionName = parentDebugInfo.debugModeOptionName;
  const parentDebugPortOptionName = parentDebugInfo.debugPortOptionName;
  const childDebugModeOptionName = getChildDebugModeOptionName({
    parentDebugModeOptionName,
    debugMode,
    debugModeInheritBreak,
  });

  if (!childDebugModeOptionName) {
    // remove debug mode and debug port fron child options
    if (parentDebugModeOptionName) {
      delete childExecOptions[parentDebugModeOptionName];
    }
    if (parentDebugPortOptionName) {
      delete childExecOptions[parentDebugPortOptionName];
    }
    return;
  }

  // replace child debug mode
  if (
    parentDebugModeOptionName &&
    parentDebugModeOptionName !== childDebugModeOptionName
  ) {
    delete childExecOptions[parentDebugModeOptionName];
  }
  childExecOptions[childDebugModeOptionName] = "";

  // this is required because vscode does not
  // support assigning a child spawned without a specific port
  const childDebugPortOptionValue =
    debugPort === 0
      ? await findFreePort(processDebugPort + 37, { signal })
      : debugPort;
  // replace child debug port
  if (parentDebugPortOptionName) {
    delete childExecOptions[parentDebugPortOptionName];
  }
  childExecOptions[childDebugModeOptionName] = portToArgValue(
    childDebugPortOptionValue,
  );
};

const getChildDebugModeOptionName = ({
  parentDebugModeOptionName,
  debugMode,
  debugModeInheritBreak,
}) => {
  if (debugMode === "none") {
    return undefined;
  }
  if (debugMode !== "inherit") {
    return `--${debugMode}`;
  }
  if (!parentDebugModeOptionName) {
    return undefined;
  }
  if (!debugModeInheritBreak && parentDebugModeOptionName === "--inspect-brk") {
    return "--inspect";
  }
  if (!debugModeInheritBreak && parentDebugModeOptionName === "--debug-brk") {
    return "--debug";
  }
  return parentDebugModeOptionName;
};

const portToArgValue = (port) => {
  if (typeof port !== "number") return "";
  if (port === 0) return "";
  return port;
};

// https://nodejs.org/en/docs/guides/debugging-getting-started/
const getDebugInfo = (processOptions) => {
  const inspectOption = processOptions["--inspect"];
  if (inspectOption !== undefined) {
    return {
      debugModeOptionName: "--inspect",
      debugPortOptionName: "--inspect-port",
    };
  }
  const inspectBreakOption = processOptions["--inspect-brk"];
  if (inspectBreakOption !== undefined) {
    return {
      debugModeOptionName: "--inspect-brk",
      debugPortOptionName: "--inspect-port",
    };
  }
  const debugOption = processOptions["--debug"];
  if (debugOption !== undefined) {
    return {
      debugModeOptionName: "--debug",
      debugPortOptionName: "--debug-port",
    };
  }
  const debugBreakOption = processOptions["--debug-brk"];
  if (debugBreakOption !== undefined) {
    return {
      debugModeOptionName: "--debug-brk",
      debugPortOptionName: "--debug-port",
    };
  }
  return {};
};

// export const processIsExecutedByVSCode = () => {
//   return typeof process.env.VSCODE_PID === "string"
// }

// see also https://github.com/sindresorhus/execa/issues/96
const killProcessTree = async (
  processId,
  { signal, timeout = 2000 },
) => {
  const pidtree = importWithRequire("pidtree");

  let descendantProcessIds;
  try {
    descendantProcessIds = await pidtree(processId);
  } catch (e) {
    if (e.message === "No matching pid found") {
      descendantProcessIds = [];
    } else {
      throw e;
    }
  }
  descendantProcessIds.forEach((descendantProcessId) => {
    try {
      process.kill(descendantProcessId, signal);
    } catch (error) {
      // ignore
    }
  });

  try {
    process.kill(processId, signal);
  } catch (e) {
    if (e.code !== "ESRCH") {
      throw e;
    }
  }

  let remainingIds = [...descendantProcessIds, processId];

  const updateRemainingIds = () => {
    remainingIds = remainingIds.filter((remainingId) => {
      try {
        process.kill(remainingId, 0);
        return true;
      } catch (e) {
        return false;
      }
    });
  };

  let timeSpentWaiting = 0;

  const check = async () => {
    updateRemainingIds();
    if (remainingIds.length === 0) {
      return;
    }

    if (timeSpentWaiting > timeout) {
      const timeoutError = new Error(
        `timed out waiting for ${
          remainingIds.length
        } process to exit (${remainingIds.join(" ")})`,
      );
      timeoutError.code = "TIMEOUT";
      throw timeoutError;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
    timeSpentWaiting += 400;
    await check();
  };

  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  await check();
};

// https://nodejs.org/api/process.html#process_signal_events
const SIGINT_SIGNAL_NUMBER = 2;
const SIGABORT_SIGNAL_NUMBER = 6;
const SIGTERM_SIGNAL_NUMBER = 15;
const EXIT_CODES = {
  SIGINT: 128 + SIGINT_SIGNAL_NUMBER,
  SIGABORT: 128 + SIGABORT_SIGNAL_NUMBER,
  SIGTERM: 128 + SIGTERM_SIGNAL_NUMBER,
};

const IMPORTMAP_NODE_LOADER_FILE_URL = new URL(
  "./importmap_node_loader.mjs",
  import.meta.url,
).href;

const NO_EXPERIMENTAL_WARNING_FILE_URL = new URL(
  "./no_experimental_warnings.cjs",
  import.meta.url,
).href;

const CONTROLLED_CHILD_PROCESS_URL = new URL(
  "./node_child_process_controlled.mjs",
  import.meta.url,
).href;

const nodeChildProcess = ({
  logProcessCommand = false,
  importMap,
  gracefulStopAllocatedMs = 4000,
  env,
  debugPort,
  debugMode,
  debugModeInheritBreak,
  inheritProcessEnv = true,
  commandLineOptions = [],
  stdin = "pipe",
  stdout = "pipe",
  stderr = "pipe",
} = {}) => {
  if (env !== undefined && typeof env !== "object") {
    throw new TypeError(`env must be an object, got ${env}`);
  }
  env = {
    ...env,
    JSENV: true,
  };

  return {
    type: "node",
    name: "node_child_process",
    version: process.version.slice(1),
    run: async ({
      signal = new AbortController().signal,
      logger,

      rootDirectoryUrl,
      fileRelativeUrl,

      keepRunning,
      stopSignal,
      onConsole,

      coverageEnabled = false,
      coverageConfig,
      coverageMethodForNodeJs,
      coverageFileUrl,
      collectPerformance,
    }) => {
      if (coverageMethodForNodeJs !== "NODE_V8_COVERAGE") {
        env.NODE_V8_COVERAGE = "";
      }
      commandLineOptions = [
        "--experimental-import-meta-resolve",
        ...commandLineOptions,
      ];

      if (importMap) {
        env.IMPORT_MAP = JSON.stringify(importMap);
        env.IMPORT_MAP_BASE_URL = rootDirectoryUrl;
        commandLineOptions.push(
          `--experimental-loader=${IMPORTMAP_NODE_LOADER_FILE_URL}`,
        );
        commandLineOptions.push(
          `--require=${fileURLToPath(NO_EXPERIMENTAL_WARNING_FILE_URL)}`,
        );
      }

      const cleanupCallbackList = createCallbackListNotifiedOnce();
      const cleanup = async (reason) => {
        await cleanupCallbackList.notify({ reason });
      };

      const childExecOptions = await createChildExecOptions({
        signal,
        debugPort,
        debugMode,
        debugModeInheritBreak,
      });
      const execArgv = ExecOptions.toExecArgv({
        ...childExecOptions,
        ...ExecOptions.fromExecArgv(commandLineOptions),
      });
      const envForChildProcess = {
        ...(inheritProcessEnv ? process.env : {}),
        ...env,
      };
      logger[logProcessCommand ? "info" : "debug"](
        `${process.argv[0]} ${execArgv.join(" ")} ${fileURLToPath(
          CONTROLLED_CHILD_PROCESS_URL,
        )}`,
      );
      const childProcess = fork(fileURLToPath(CONTROLLED_CHILD_PROCESS_URL), {
        execArgv,
        // silent: true
        stdio: ["pipe", "pipe", "pipe", "ipc"],
        env: envForChildProcess,
      });
      logger.debug(
        createDetailedMessage(
          `child process forked (pid ${childProcess.pid})`,
          {
            "custom env": JSON.stringify(env, null, "  "),
          },
        ),
      );
      // if we pass stream, pipe them https://github.com/sindresorhus/execa/issues/81
      if (typeof stdin === "object") {
        stdin.pipe(childProcess.stdin);
      }
      if (typeof stdout === "object") {
        childProcess.stdout.pipe(stdout);
      }
      if (typeof stderr === "object") {
        childProcess.stderr.pipe(stderr);
      }
      const childProcessReadyPromise = new Promise((resolve) => {
        onceChildProcessMessage(childProcess, "ready", resolve);
      });
      const removeOutputListener = installChildProcessOutputListener(
        childProcess,
        ({ type, text }) => {
          onConsole({ type, text });
        },
      );
      const stop = memoize(async ({ gracefulStopAllocatedMs } = {}) => {
        // all libraries are facing problem on windows when trying
        // to kill a process spawning other processes.
        // "killProcessTree" is theorically correct but sometimes keep process handing forever.
        // Inside GitHub workflow the whole Virtual machine gets unresponsive and ends up being killed
        // There is no satisfying solution to this problem so we stick to the basic
        // childProcess.kill()
        if (process.platform === "win32") {
          childProcess.kill();
          return;
        }
        if (gracefulStopAllocatedMs) {
          try {
            await killProcessTree(childProcess.pid, {
              signal: GRACEFUL_STOP_SIGNAL,
              timeout: gracefulStopAllocatedMs,
            });
            return;
          } catch (e) {
            if (e.code === "TIMEOUT") {
              logger.debug(
                `kill with SIGTERM because gracefulStop still pending after ${gracefulStopAllocatedMs}ms`,
              );
              await killProcessTree(childProcess.pid, {
                signal: GRACEFUL_STOP_FAILED_SIGNAL,
              });
              return;
            }
            throw e;
          }
        }
        await killProcessTree(childProcess.pid, { signal: STOP_SIGNAL });
        return;
      });

      const actionOperation = Abort.startOperation();
      actionOperation.addAbortSignal(signal);
      const winnerPromise = new Promise((resolve) => {
        raceCallbacks(
          {
            aborted: (cb) => {
              return actionOperation.addAbortCallback(cb);
            },
            // https://nodejs.org/api/child_process.html#child_process_event_disconnect
            // disconnect: (cb) => {
            //   return onceProcessEvent(childProcess, "disconnect", cb)
            // },
            // https://nodejs.org/api/child_process.html#child_process_event_error
            error: (cb) => {
              return onceChildProcessEvent(childProcess, "error", cb);
            },
            exit: (cb) => {
              return onceChildProcessEvent(
                childProcess,
                "exit",
                (code, signal) => {
                  cb({ code, signal });
                },
              );
            },
            response: (cb) => {
              return onceChildProcessMessage(childProcess, "action-result", cb);
            },
          },
          resolve,
        );
      });
      const result = {
        status: "executing",
        errors: [],
        namespace: null,
      };

      const writeResult = async () => {
        actionOperation.throwIfAborted();
        await childProcessReadyPromise;
        actionOperation.throwIfAborted();
        await sendToChildProcess(childProcess, {
          type: "action",
          data: {
            actionType: "execute-using-dynamic-import",
            actionParams: {
              rootDirectoryUrl,
              fileUrl: new URL(fileRelativeUrl, rootDirectoryUrl).href,
              collectPerformance,
              coverageEnabled,
              coverageConfig,
              coverageMethodForNodeJs,
              coverageFileUrl,
              exitAfterAction: true,
            },
          },
        });
        const winner = await winnerPromise;
        if (winner.name === "aborted") {
          result.status = "aborted";
          return;
        }
        if (winner.name === "error") {
          const error = winner.data;
          removeOutputListener();
          result.status = "failed";
          result.errors.push(error);
          return;
        }
        if (winner.name === "exit") {
          const { code } = winner.data;
          await cleanup("process exit");
          if (code === 12) {
            result.status = "failed";
            result.errors.push(
              new Error(
                `node process exited with 12 (the forked child process wanted to use a non-available port for debug)`,
              ),
            );
            return;
          }
          if (
            code === null ||
            code === 0 ||
            code === EXIT_CODES.SIGINT ||
            code === EXIT_CODES.SIGTERM ||
            code === EXIT_CODES.SIGABORT
          ) {
            result.status = "failed";
            result.errors.push(
              new Error(`node process exited during execution`),
            );
            return;
          }
          // process.exit(1) in child process or process.exitCode = 1 + process.exit()
          // means there was an error even if we don't know exactly what.
          result.status = "failed";
          result.errors.push(
            new Error(`node process exited with code ${code} during execution`),
          );
          return;
        }
        const { status, value } = winner.data;
        if (status === "action-failed") {
          result.status = "failed";
          result.errors.push(value);
          return;
        }
        const { namespace, performance, coverage } = value;
        result.status = "completed";
        result.namespace = namespace;
        result.performance = performance;
        result.coverage = coverage;
      };

      try {
        await writeResult();
      } catch (e) {
        result.status = "failed";
        result.errors.push(e);
      }
      if (keepRunning) {
        stopSignal.notify = stop;
      } else {
        await stop({
          gracefulStopAllocatedMs,
        });
      }
      await actionOperation.end();
      return result;
    },
  };
};

// http://man7.org/linux/man-pages/man7/signal.7.html
// https:// github.com/nodejs/node/blob/1d9511127c419ec116b3ddf5fc7a59e8f0f1c1e4/lib/internal/child_process.js#L472
const GRACEFUL_STOP_SIGNAL = "SIGTERM";
const STOP_SIGNAL = "SIGKILL";
// it would be more correct if GRACEFUL_STOP_FAILED_SIGNAL was SIGHUP instead of SIGKILL.
// but I'm not sure and it changes nothing so just use SIGKILL
const GRACEFUL_STOP_FAILED_SIGNAL = "SIGKILL";

const sendToChildProcess = async (childProcess, { type, data }) => {
  return new Promise((resolve, reject) => {
    childProcess.send(
      {
        jsenv: true,
        type,
        data,
      },
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });
};

const installChildProcessOutputListener = (childProcess, callback) => {
  // beware that we may receive ansi output here, should not be a problem but keep that in mind
  const stdoutDataCallback = (chunk) => {
    callback({ type: "log", text: String(chunk) });
  };
  childProcess.stdout.on("data", stdoutDataCallback);
  const stdErrorDataCallback = (chunk) => {
    callback({ type: "error", text: String(chunk) });
  };
  childProcess.stderr.on("data", stdErrorDataCallback);
  return () => {
    childProcess.stdout.removeListener("data", stdoutDataCallback);
    childProcess.stderr.removeListener("data", stdoutDataCallback);
  };
};

const onceChildProcessMessage = (childProcess, type, callback) => {
  const onmessage = (message) => {
    if (message && message.jsenv && message.type === type) {
      childProcess.removeListener("message", onmessage);
      callback(message.data ? JSON.parse(message.data) : "");
    }
  };
  childProcess.on("message", onmessage);
  return () => {
    childProcess.removeListener("message", onmessage);
  };
};

const onceChildProcessEvent = (childProcess, type, callback) => {
  childProcess.once(type, callback);
  return () => {
    childProcess.removeListener(type, callback);
  };
};

// https://github.com/avajs/ava/blob/576f534b345259055c95fa0c2b33bef10847a2af/lib/fork.js#L23
// https://nodejs.org/api/worker_threads.html
// https://github.com/avajs/ava/blob/576f534b345259055c95fa0c2b33bef10847a2af/lib/worker/base.js

const CONTROLLED_WORKER_THREAD_URL = new URL(
  "./node_worker_thread_controlled.mjs",
  import.meta.url,
).href;

const nodeWorkerThread = ({
  importMap,
  env,
  debugPort,
  debugMode,
  debugModeInheritBreak,
  inheritProcessEnv = true,
  commandLineOptions = [],
} = {}) => {
  if (env !== undefined && typeof env !== "object") {
    throw new TypeError(`env must be an object, got ${env}`);
  }
  env = {
    ...env,
    JSENV: true,
  };

  return {
    type: "node",
    name: "node_worker_thread",
    version: process.version.slice(1),
    run: async ({
      signal = new AbortController().signal,
      // logger,
      rootDirectoryUrl,
      fileRelativeUrl,

      keepRunning,
      stopSignal,
      onConsole,

      collectConsole = false,
      collectPerformance,
      coverageEnabled = false,
      coverageConfig,
      coverageMethodForNodeJs,
      coverageFileUrl,
    }) => {
      if (coverageMethodForNodeJs !== "NODE_V8_COVERAGE") {
        env.NODE_V8_COVERAGE = "";
      }
      if (importMap) {
        env.IMPORT_MAP = JSON.stringify(importMap);
        env.IMPORT_MAP_BASE_URL = rootDirectoryUrl;
        commandLineOptions.push(`--import=${IMPORTMAP_NODE_LOADER_FILE_URL}`);
        commandLineOptions.push(
          `--require=${fileURLToPath(NO_EXPERIMENTAL_WARNING_FILE_URL)}`,
        );
      }

      const workerThreadExecOptions = await createChildExecOptions({
        signal,
        debugPort,
        debugMode,
        debugModeInheritBreak,
      });
      const execArgvForWorkerThread = ExecOptions.toExecArgv({
        ...workerThreadExecOptions,
        ...ExecOptions.fromExecArgv(commandLineOptions),
      });
      const envForWorkerThread = {
        ...(inheritProcessEnv ? process.env : {}),
        ...env,
      };

      const cleanupCallbackList = createCallbackListNotifiedOnce();
      const cleanup = async (reason) => {
        await cleanupCallbackList.notify({ reason });
      };
      const actionOperation = Abort.startOperation();
      actionOperation.addAbortSignal(signal);
      // https://nodejs.org/api/worker_threads.html#new-workerfilename-options
      const workerThread = new Worker(
        fileURLToPath(CONTROLLED_WORKER_THREAD_URL),
        {
          env: envForWorkerThread,
          execArgv: execArgvForWorkerThread,
          // workerData: { options },
          stdin: true,
          stdout: true,
          stderr: true,
        },
      );
      const removeOutputListener = installWorkerThreadOutputListener(
        workerThread,
        ({ type, text }) => {
          onConsole({ type, text });
        },
      );
      const workerThreadReadyPromise = new Promise((resolve) => {
        onceWorkerThreadMessage(workerThread, "ready", resolve);
      });

      const stop = memoize(async () => {
        // read all stdout before terminating
        // (no need for stderr because it's sync)
        if (collectConsole) {
          while (workerThread.stdout.read() !== null) {}
          await new Promise((resolve) => {
            setTimeout(resolve, 50);
          });
        }
        await workerThread.terminate();
      });

      const winnerPromise = new Promise((resolve) => {
        raceCallbacks(
          {
            aborted: (cb) => {
              return actionOperation.addAbortCallback(cb);
            },
            error: (cb) => {
              return onceWorkerThreadEvent(workerThread, "error", cb);
            },
            exit: (cb) => {
              return onceWorkerThreadEvent(
                workerThread,
                "exit",
                (code, signal) => {
                  cb({ code, signal });
                },
              );
            },
            response: (cb) => {
              return onceWorkerThreadMessage(workerThread, "action-result", cb);
            },
          },
          resolve,
        );
      });

      const result = {
        status: "executing",
        errors: [],
        namespace: null,
      };

      const writeResult = async () => {
        actionOperation.throwIfAborted();
        await workerThreadReadyPromise;
        actionOperation.throwIfAborted();
        await sendToWorkerThread(workerThread, {
          type: "action",
          data: {
            actionType: "execute-using-dynamic-import",
            actionParams: {
              rootDirectoryUrl,
              fileUrl: new URL(fileRelativeUrl, rootDirectoryUrl).href,
              collectPerformance,
              coverageEnabled,
              coverageConfig,
              coverageMethodForNodeJs,
              coverageFileUrl,
              exitAfterAction: true,
            },
          },
        });
        const winner = await winnerPromise;
        if (winner.name === "aborted") {
          result.status = "aborted";
          return;
        }
        if (winner.name === "error") {
          const error = winner.data;
          removeOutputListener();
          result.status = "failed";
          result.errors.push(error);
          return;
        }
        if (winner.name === "exit") {
          const { code } = winner.data;
          await cleanup("process exit");
          if (code === 12) {
            result.status = "failed";
            result.errors.push(
              new Error(
                `node process exited with 12 (the forked child process wanted to use a non-available port for debug)`,
              ),
            );
            return;
          }
          if (
            code === null ||
            code === 0 ||
            code === EXIT_CODES.SIGINT ||
            code === EXIT_CODES.SIGTERM ||
            code === EXIT_CODES.SIGABORT
          ) {
            result.status = "failed";
            result.errors.push(
              new Error(`node worker thread exited during execution`),
            );
            return;
          }
          // process.exit(1) in child process or process.exitCode = 1 + process.exit()
          // means there was an error even if we don't know exactly what.
          result.status = "failed";
          result.errors.push(
            new Error(
              `node worker thread exited with code ${code} during execution`,
            ),
          );
        }
        const { status, value } = winner.data;
        if (status === "action-failed") {
          result.status = "failed";
          result.errors.push(value);
          return;
        }
        const { namespace, performance, coverage } = value;
        result.status = "completed";
        result.namespace = namespace;
        result.performance = performance;
        result.coverage = coverage;
      };

      try {
        await writeResult();
      } catch (e) {
        result.status = "failed";
        result.errors.push(e);
      }

      if (keepRunning) {
        stopSignal.notify = stop;
      } else {
        await stop();
      }
      await actionOperation.end();
      return result;
    },
  };
};

const installWorkerThreadOutputListener = (workerThread, callback) => {
  // beware that we may receive ansi output here, should not be a problem but keep that in mind
  const stdoutDataCallback = (chunk) => {
    const text = String(chunk);
    callback({ type: "log", text });
  };
  workerThread.stdout.on("data", stdoutDataCallback);
  const stdErrorDataCallback = (chunk) => {
    const text = String(chunk);
    callback({ type: "error", text });
  };
  workerThread.stderr.on("data", stdErrorDataCallback);
  return () => {
    workerThread.stdout.removeListener("data", stdoutDataCallback);
    workerThread.stderr.removeListener("data", stdErrorDataCallback);
  };
};

const sendToWorkerThread = (worker, { type, data }) => {
  worker.postMessage({ jsenv: true, type, data });
};

const onceWorkerThreadMessage = (workerThread, type, callback) => {
  const onmessage = (message) => {
    if (message && message.jsenv && message.type === type) {
      workerThread.removeListener("message", onmessage);
      callback(message.data ? JSON.parse(message.data) : undefined);
    }
  };
  workerThread.on("message", onmessage);
  return () => {
    workerThread.removeListener("message", onmessage);
  };
};

const onceWorkerThreadEvent = (worker, type, callback) => {
  worker.once(type, callback);
  return () => {
    worker.removeListener(type, callback);
  };
};

/*
 * Export a function capable to execute a file on a runtime (browser or node) and return how it goes.
 *
 * - can be useful to execute a file in a browser/node.js programmatically
 * - not documented
 * - the most importants parts:
 *   - fileRelativeUrl: the file to execute inside rootDirectoryUrl
 *   - runtime: an object with a "run" method.
 *   The run method will start a browser/node process and execute file in it
 * - Most of the logic lives in "./run.js" used by executeTestPlan to run tests
 */


const execute = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel,
  rootDirectoryUrl,
  webServer,
  importMap,

  fileRelativeUrl,
  allocatedMs,
  mirrorConsole = true,
  keepRunning = false,

  collectConsole,
  collectCoverage,
  coverageTempDirectoryUrl,
  collectPerformance = false,
  runtime,
  runtimeParams,

  ignoreError = false,
}) => {
  const logger = createLogger({ logLevel });
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(
    rootDirectoryUrl,
    "rootDirectoryUrl",
  );
  const teardown = createTeardown();
  const executeOperation = Abort.startOperation();
  executeOperation.addAbortSignal(signal);
  if (handleSIGINT) {
    executeOperation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        abort,
      );
    });
  }

  if (runtime.type === "browser") {
    await assertAndNormalizeWebServer(webServer, { signal, teardown, logger });
  }

  let resultTransformer = (result) => result;
  runtimeParams = {
    rootDirectoryUrl,
    webServer,
    fileRelativeUrl,
    importMap,
    teardown,
    ...runtimeParams,
  };

  let result = await run({
    signal: executeOperation.signal,
    logger,
    allocatedMs,
    keepRunning,
    mirrorConsole,
    collectConsole,
    collectCoverage,
    coverageTempDirectoryUrl,
    collectPerformance,
    runtime,
    runtimeParams,
  });
  result = resultTransformer(result);

  try {
    if (result.status === "failed") {
      if (ignoreError) {
        return result;
      }
      /*
  Warning: when node launched with --unhandled-rejections=strict, despites
  this promise being rejected by throw result.error node will completely ignore it.

  The error can be logged by doing
  ```js
  process.setUncaughtExceptionCaptureCallback((error) => {
    console.error(error.stack)
  })
  ```
  But it feels like a hack.
  */
      throw result.errors[result.errors.length - 1];
    }
    return result;
  } finally {
    await teardown.trigger();
    await executeOperation.end();
  }
};

export { chromium, chromiumIsolatedTab, execute, executeTestPlan, firefox, firefoxIsolatedTab, nodeChildProcess, nodeWorkerThread, webkit, webkitIsolatedTab };
