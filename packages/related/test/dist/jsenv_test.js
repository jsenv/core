import { readGitHubWorkflowEnv, startGithubCheckRun } from "@jsenv/github-check-run";
import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution";
import { readdir, chmod, stat, lstat, chmodSync, statSync, lstatSync, promises, readFile as readFile$1, readdirSync, openSync, closeSync, unlinkSync, rmdirSync, mkdirSync, readFileSync, writeFileSync as writeFileSync$1, unlink, rmdir, existsSync } from "node:fs";
import { takeCoverage } from "node:v8";
import stripAnsi from "strip-ansi";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { applyBabelPlugins } from "@jsenv/ast";
import { cpuUsage, memoryUsage } from "node:process";
import { createSupportsColor, isUnicodeSupported, emojiRegex, eastAsianWidth, clearTerminal, eraseLines } from "./jsenv_test_node_modules.js";
import { stripVTControlCharacters } from "node:util";
import { createException } from "@jsenv/exception";
import crypto from "node:crypto";
import { dirname } from "node:path";
import { createServer } from "node:net";
import { spawn, spawnSync, fork } from "node:child_process";
import { availableParallelism, cpus, totalmem, release, freemem } from "node:os";
import { SOURCEMAP, generateSourcemapDataUrl } from "@jsenv/sourcemap";
import { injectSupervisorIntoHTML, supervisorFileUrl } from "@jsenv/plugin-supervisor";
import { findFreePort } from "@jsenv/server";
import { Worker } from "node:worker_threads";
import he from "he";
import "node:tty";

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

// https://github.com/Marak/colors.js/blob/master/lib/styles.js
// https://stackoverflow.com/a/75985833/2634179
const RESET = "\x1b[0m";

const RED = "red";
const GREEN = "green";
const YELLOW = "yellow";
const BLUE = "blue";
const MAGENTA = "magenta";
const CYAN = "cyan";
const GREY = "grey";
const WHITE = "white";
const BLACK = "black";

const TEXT_COLOR_ANSI_CODES = {
  [RED]: "\x1b[31m",
  [GREEN]: "\x1b[32m",
  [YELLOW]: "\x1b[33m",
  [BLUE]: "\x1b[34m",
  [MAGENTA]: "\x1b[35m",
  [CYAN]: "\x1b[36m",
  [GREY]: "\x1b[90m",
  [WHITE]: "\x1b[37m",
  [BLACK]: "\x1b[30m",
};
const BACKGROUND_COLOR_ANSI_CODES = {
  [RED]: "\x1b[41m",
  [GREEN]: "\x1b[42m",
  [YELLOW]: "\x1b[43m",
  [BLUE]: "\x1b[44m",
  [MAGENTA]: "\x1b[45m",
  [CYAN]: "\x1b[46m",
  [GREY]: "\x1b[100m",
  [WHITE]: "\x1b[47m",
  [BLACK]: "\x1b[40m",
};

const createAnsi = ({ supported }) => {
  const ANSI = {
    supported,

    RED,
    GREEN,
    YELLOW,
    BLUE,
    MAGENTA,
    CYAN,
    GREY,
    WHITE,
    BLACK,
    color: (text, color) => {
      if (!ANSI.supported) {
        return text;
      }
      if (!color) {
        return text;
      }
      if (typeof text === "string" && text.trim() === "") {
        // cannot set color of blank chars
        return text;
      }
      const ansiEscapeCodeForTextColor = TEXT_COLOR_ANSI_CODES[color];
      if (!ansiEscapeCodeForTextColor) {
        return text;
      }
      return `${ansiEscapeCodeForTextColor}${text}${RESET}`;
    },
    backgroundColor: (text, color) => {
      if (!ANSI.supported) {
        return text;
      }
      if (!color) {
        return text;
      }
      if (typeof text === "string" && text.trim() === "") {
        // cannot set background color of blank chars
        return text;
      }
      const ansiEscapeCodeForBackgroundColor =
        BACKGROUND_COLOR_ANSI_CODES[color];
      if (!ansiEscapeCodeForBackgroundColor) {
        return text;
      }
      return `${ansiEscapeCodeForBackgroundColor}${text}${RESET}`;
    },

    BOLD: "\x1b[1m",
    UNDERLINE: "\x1b[4m",
    STRIKE: "\x1b[9m",
    effect: (text, effect) => {
      if (!ANSI.supported) {
        return text;
      }
      if (!effect) {
        return text;
      }
      // cannot add effect to empty string
      if (text === "") {
        return text;
      }
      const ansiEscapeCodeForEffect = effect;
      return `${ansiEscapeCodeForEffect}${text}${RESET}`;
    },
  };

  return ANSI;
};

const processSupportsBasicColor = createSupportsColor(process.stdout).hasBasic;

const ANSI = createAnsi({
  supported:
    process.env.FORCE_COLOR === "1" ||
    processSupportsBasicColor ||
    // GitHub workflow does support ANSI but "supports-color" returns false
    // because stream.isTTY returns false, see https://github.com/actions/runner/issues/241
    process.env.GITHUB_WORKFLOW,
});

// see also https://github.com/sindresorhus/figures

const createUnicode = ({ supported, ANSI }) => {
  const UNICODE = {
    supported,
    get COMMAND_RAW() {
      return UNICODE.supported ? `❯` : `>`;
    },
    get OK_RAW() {
      return UNICODE.supported ? `✔` : `√`;
    },
    get FAILURE_RAW() {
      return UNICODE.supported ? `✖` : `×`;
    },
    get DEBUG_RAW() {
      return UNICODE.supported ? `◆` : `♦`;
    },
    get INFO_RAW() {
      return UNICODE.supported ? `ℹ` : `i`;
    },
    get WARNING_RAW() {
      return UNICODE.supported ? `⚠` : `‼`;
    },
    get CIRCLE_CROSS_RAW() {
      return UNICODE.supported ? `ⓧ` : `(×)`;
    },
    get CIRCLE_DOTTED_RAW() {
      return UNICODE.supported ? `◌` : `*`;
    },
    get COMMAND() {
      return ANSI.color(UNICODE.COMMAND_RAW, ANSI.GREY); // ANSI_MAGENTA)
    },
    get OK() {
      return ANSI.color(UNICODE.OK_RAW, ANSI.GREEN);
    },
    get FAILURE() {
      return ANSI.color(UNICODE.FAILURE_RAW, ANSI.RED);
    },
    get DEBUG() {
      return ANSI.color(UNICODE.DEBUG_RAW, ANSI.GREY);
    },
    get INFO() {
      return ANSI.color(UNICODE.INFO_RAW, ANSI.BLUE);
    },
    get WARNING() {
      return ANSI.color(UNICODE.WARNING_RAW, ANSI.YELLOW);
    },
    get CIRCLE_CROSS() {
      return ANSI.color(UNICODE.CIRCLE_CROSS_RAW, ANSI.RED);
    },
    get ELLIPSIS() {
      return UNICODE.supported ? `…` : `...`;
    },
  };
  return UNICODE;
};

const UNICODE = createUnicode({
  supported: process.env.FORCE_UNICODE === "1" || isUnicodeSupported(),
  ANSI,
});

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

const setPrecision = (
  number,
  { decimals = 1, decimalsWhenSmall = decimals } = {},
) => {
  return setDecimalsPrecision(number, {
    decimals,
    decimalsWhenSmall,
    transform: parseInt,
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

const unitShort = {
  year: "y",
  month: "m",
  week: "w",
  day: "d",
  hour: "h",
  minute: "m",
  second: "s",
};

const humanizeDuration = (
  ms,
  { short, rounded = true, decimals } = {},
) => {
  // ignore ms below meaningfulMs so that:
  // humanizeDuration(0.5) -> "0 second"
  // humanizeDuration(1.1) -> "0.001 second" (and not "0.0011 second")
  // This tool is meant to be read by humans and it would be barely readable to see
  // "0.0001 second" (stands for 0.1 millisecond)
  // yes we could return "0.1 millisecond" but we choosed consistency over precision
  // so that the prefered unit is "second" (and does not become millisecond when ms is super small)
  if (ms < 1) {
    return short ? "0s" : "0 second";
  }
  const { primary, remaining } = parseMs(ms);
  if (!remaining) {
    return humanizeDurationUnit(primary, {
      decimals:
        decimals === undefined ? (primary.name === "second" ? 1 : 0) : decimals,
      short,
      rounded,
    });
  }
  return `${humanizeDurationUnit(primary, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
  })} and ${humanizeDurationUnit(remaining, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
  })}`;
};
const humanizeDurationUnit = (unit, { decimals, short, rounded }) => {
  const count = rounded
    ? setRoundedPrecision(unit.count, { decimals })
    : setPrecision(unit.count, { decimals });
  let name = unit.name;
  if (short) {
    name = unitShort[name];
    return `${count}${name}`;
  }
  if (count <= 1) {
    return `${count} ${name}`;
  }
  return `${count} ${name}s`;
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

const humanizeFileSize = (numberOfBytes, { decimals, short } = {}) => {
  return inspectBytes(numberOfBytes, { decimals, short });
};

const humanizeMemory = (metricValue, { decimals, short } = {}) => {
  return inspectBytes(metricValue, { decimals, fixedDecimals: true, short });
};

const inspectBytes = (
  number,
  { fixedDecimals = false, decimals, short } = {},
) => {
  if (number === 0) {
    return `0 B`;
  }
  const exponent = Math.min(
    Math.floor(Math.log10(number) / 3),
    BYTE_UNITS.length - 1,
  );
  const unitNumber = number / Math.pow(1000, exponent);
  const unitName = BYTE_UNITS[exponent];
  if (decimals === undefined) {
    if (unitNumber < 100) {
      decimals = 1;
    } else {
      decimals = 0;
    }
  }
  const unitNumberRounded = setRoundedPrecision(unitNumber, {
    decimals,
    decimalsWhenSmall: 1,
  });
  const value = fixedDecimals
    ? unitNumberRounded.toFixed(decimals)
    : unitNumberRounded;
  if (short) {
    return `${value}${unitName}`;
  }
  return `${value} ${unitName}`;
};

const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

const formatDefault = (v) => v;

const generateContentFrame = ({
  content,
  line,
  column,

  linesAbove = 3,
  linesBelow = 0,
  lineMaxWidth = 120,
  lineNumbersOnTheLeft = true,
  lineMarker = true,
  columnMarker = true,
  format = formatDefault,
} = {}) => {
  const lineStrings = content.split(/\r?\n/);
  if (line === 0) line = 1;
  if (column === undefined) {
    columnMarker = false;
    column = 1;
  }
  if (column === 0) column = 1;

  let lineStartIndex = line - 1 - linesAbove;
  if (lineStartIndex < 0) {
    lineStartIndex = 0;
  }
  let lineEndIndex = line - 1 + linesBelow;
  if (lineEndIndex > lineStrings.length - 1) {
    lineEndIndex = lineStrings.length - 1;
  }
  if (columnMarker) {
    // human reader deduce the line when there is a column marker
    lineMarker = false;
  }
  if (line - 1 === lineEndIndex) {
    lineMarker = false; // useless because last line
  }
  let lineIndex = lineStartIndex;

  let columnsBefore;
  let columnsAfter;
  if (column > lineMaxWidth) {
    columnsBefore = column - Math.ceil(lineMaxWidth / 2);
    columnsAfter = column + Math.floor(lineMaxWidth / 2);
  } else {
    columnsBefore = 0;
    columnsAfter = lineMaxWidth;
  }
  let columnMarkerIndex = column - 1 - columnsBefore;

  let source = "";
  while (lineIndex <= lineEndIndex) {
    const lineString = lineStrings[lineIndex];
    const lineNumber = lineIndex + 1;
    const isLastLine = lineIndex === lineEndIndex;
    const isMainLine = lineNumber === line;
    lineIndex++;

    {
      if (lineMarker) {
        if (isMainLine) {
          source += `${format(">", "marker_line")} `;
        } else {
          source += "  ";
        }
      }
      if (lineNumbersOnTheLeft) {
        // fill with spaces to ensure if line moves from 7,8,9 to 10 the display is still great
        const asideSource = `${fillLeft$1(lineNumber, lineEndIndex + 1)} |`;
        source += `${format(asideSource, "line_number_aside")} `;
      }
    }
    {
      source += truncateLine(lineString, {
        start: columnsBefore,
        end: columnsAfter,
        prefix: "…",
        suffix: "…",
        format,
      });
    }
    {
      if (columnMarker && isMainLine) {
        source += `\n`;
        if (lineMarker) {
          source += "  ";
        }
        if (lineNumbersOnTheLeft) {
          const asideSpaces = `${fillLeft$1(lineNumber, lineEndIndex + 1)} | `
            .length;
          source += " ".repeat(asideSpaces);
        }
        source += " ".repeat(columnMarkerIndex);
        source += format("^", "marker_column");
      }
    }
    if (!isLastLine) {
      source += "\n";
    }
  }
  return source;
};

const truncateLine = (line, { start, end, prefix, suffix, format }) => {
  const lastIndex = line.length;

  if (line.length === 0) {
    // don't show any ellipsis if the line is empty
    // because it's not truncated in that case
    return "";
  }

  const startTruncated = start > 0;
  const endTruncated = lastIndex > end;

  let from = startTruncated ? start + prefix.length : start;
  let to = endTruncated ? end - suffix.length : end;
  if (to > lastIndex) to = lastIndex;

  if (start >= lastIndex || from === to) {
    return "";
  }
  let result = "";
  while (from < to) {
    result += format(line[from], "char");
    from++;
  }
  if (result.length === 0) {
    return "";
  }
  if (startTruncated && endTruncated) {
    return `${format(prefix, "marker_overflow_left")}${result}${format(
      suffix,
      "marker_overflow_right",
    )}`;
  }
  if (startTruncated) {
    return `${format(prefix, "marker_overflow_left")}${result}`;
  }
  if (endTruncated) {
    return `${result}${format(suffix, "marker_overflow_right")}`;
  }
  return result;
};

const fillLeft$1 = (value, biggestValue, char = " ") => {
  const width = String(value).length;
  const biggestWidth = String(biggestValue).length;
  let missingWidth = biggestWidth - width;
  let padded = "";
  while (missingWidth--) {
    padded += char;
  }
  padded += value;
  return padded;
};

const createCallOrderer = () => {
  const queue = [];
  const callWhenPreviousExecutionAreDone = (executionIndex, callback) => {
    if (queue[executionIndex]) {
      throw new Error(`${executionIndex} already used`);
    }

    let allBeforeAreDone = true;
    if (executionIndex > 0) {
      let beforeIndex = executionIndex - 1;
      do {
        const value = queue[beforeIndex];
        if (!value) {
          allBeforeAreDone = false;
          break;
        }
      } while (beforeIndex--);
    }
    if (!allBeforeAreDone) {
      queue[executionIndex] = callback;
      return;
    }
    queue[executionIndex] = true;
    callback();
    let afterIndex = executionIndex + 1;
    while (afterIndex < queue.length) {
      const value = queue[afterIndex];
      if (value === undefined) {
        break;
      }
      if (typeof value === "function") {
        queue[afterIndex] = true;
        value();
      }
      afterIndex++;
    }
  };
  return callWhenPreviousExecutionAreDone;
};

const renderBigSection = (params) => {
  return renderSection({
    width: 45,
    ...params,
  });
};

const renderSection = ({
  title,
  content,
  dashColor = ANSI.GREY,
  width = 38,
  bottomSeparator = true,
}) => {
  let section = "";

  if (title) {
    const titleWidth = stripAnsi(title).length;
    const minWidthRequired = `--- … ---`.length;
    const needsTruncate = titleWidth + minWidthRequired >= width;
    if (needsTruncate) {
      const titleTruncated = title.slice(0, width - minWidthRequired);
      const leftDashes = ANSI.color("---", dashColor);
      const rightDashes = ANSI.color("---", dashColor);
      section += `${leftDashes} ${titleTruncated}… ${rightDashes}`;
    } else {
      const remainingWidth = width - titleWidth - 2; // 2 for spaces around the title
      const dashLeftCount = Math.floor(remainingWidth / 2);
      const dashRightCount = remainingWidth - dashLeftCount;
      const leftDashes = ANSI.color("-".repeat(dashLeftCount), dashColor);
      const rightDashes = ANSI.color("-".repeat(dashRightCount), dashColor);
      section += `${leftDashes} ${title} ${rightDashes}`;
    }
    section += "\n";
  } else {
    const topDashes = ANSI.color(`-`.repeat(width), dashColor);
    section += topDashes;
    section += "\n";
  }
  section += `${content}`;
  if (bottomSeparator) {
    section += "\n";
    const bottomDashes = ANSI.color(`-`.repeat(width), dashColor);
    section += bottomDashes;
  }
  return section;
};

const renderDetails = (data) => {
  const details = [];
  for (const key of Object.keys(data)) {
    const value = data[key];
    let valueString = "";
    valueString += ANSI.color(`${key}:`, ANSI.GREY);
    const useNonGreyAnsiColor =
      typeof value === "string" && value.includes("\x1b");
    valueString += " ";
    valueString += useNonGreyAnsiColor
      ? value
      : ANSI.color(String(value), ANSI.GREY);
    details.push(valueString);
  }
  if (details.length === 0) {
    return "";
  }

  let string = "";
  string += ` ${ANSI.color("(", ANSI.GREY)}`;
  string += details.join(ANSI.color(", ", ANSI.GREY));
  string += ANSI.color(")", ANSI.GREY);
  return string;
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

const createMeasureTextWidth = ({ stripAnsi }) => {
  const segmenter = new Intl.Segmenter();
  const defaultIgnorableCodePointRegex = /^\p{Default_Ignorable_Code_Point}$/u;

  const measureTextWidth = (
    string,
    {
      ambiguousIsNarrow = true,
      countAnsiEscapeCodes = false,
      skipEmojis = false,
    } = {},
  ) => {
    if (typeof string !== "string" || string.length === 0) {
      return 0;
    }

    if (!countAnsiEscapeCodes) {
      string = stripAnsi(string);
    }

    if (string.length === 0) {
      return 0;
    }

    let width = 0;
    const eastAsianWidthOptions = { ambiguousAsWide: !ambiguousIsNarrow };

    for (const { segment: character } of segmenter.segment(string)) {
      const codePoint = character.codePointAt(0);

      // Ignore control characters
      if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) {
        continue;
      }

      // Ignore zero-width characters
      if (
        (codePoint >= 0x20_0b && codePoint <= 0x20_0f) || // Zero-width space, non-joiner, joiner, left-to-right mark, right-to-left mark
        codePoint === 0xfe_ff // Zero-width no-break space
      ) {
        continue;
      }

      // Ignore combining characters
      if (
        (codePoint >= 0x3_00 && codePoint <= 0x3_6f) || // Combining diacritical marks
        (codePoint >= 0x1a_b0 && codePoint <= 0x1a_ff) || // Combining diacritical marks extended
        (codePoint >= 0x1d_c0 && codePoint <= 0x1d_ff) || // Combining diacritical marks supplement
        (codePoint >= 0x20_d0 && codePoint <= 0x20_ff) || // Combining diacritical marks for symbols
        (codePoint >= 0xfe_20 && codePoint <= 0xfe_2f) // Combining half marks
      ) {
        continue;
      }

      // Ignore surrogate pairs
      if (codePoint >= 0xd8_00 && codePoint <= 0xdf_ff) {
        continue;
      }

      // Ignore variation selectors
      if (codePoint >= 0xfe_00 && codePoint <= 0xfe_0f) {
        continue;
      }

      // This covers some of the above cases, but we still keep them for performance reasons.
      if (defaultIgnorableCodePointRegex.test(character)) {
        continue;
      }

      if (!skipEmojis && emojiRegex().test(character)) {
        if (process.env.CAPTURING_SIDE_EFFECTS) {
          if (character === "✔️") {
            width += 2;
            continue;
          }
        }
        width += measureTextWidth(character, {
          skipEmojis: true,
          countAnsiEscapeCodes: true, // to skip call to stripAnsi
        });
        continue;
      }

      width += eastAsianWidth(codePoint, eastAsianWidthOptions);
    }

    return width;
  };
  return measureTextWidth;
};

const measureTextWidth = createMeasureTextWidth({
  stripAnsi: stripVTControlCharacters,
});

/*
 * see also https://github.com/vadimdemedes/ink
 */


const createDynamicLog = ({
  stream = process.stdout,
  clearTerminalAllowed,
  onVerticalOverflow = () => {},
  onWriteFromOutside = () => {},
} = {}) => {
  const { columns = 80, rows = 24 } = stream;
  const dynamicLog = {
    destroyed: false,
    onVerticalOverflow,
    onWriteFromOutside,
  };

  let lastOutput = "";
  let lastOutputFromOutside = "";
  let clearAttemptResult;
  let writing = false;

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
    for (const logLine of logLines) {
      const width = measureTextWidth(logLine);
      if (width === 0) {
        visualLineCount++;
      } else {
        visualLineCount += Math.ceil(width / columns);
      }
    }

    if (visualLineCount > rows) {
      if (clearTerminalAllowed) {
        clearAttemptResult = true;
        return clearTerminal;
      }
      // the whole log cannot be cleared because it's vertically to long
      // (longer than terminal height)
      // readline.moveCursor cannot move cursor higher than screen height
      // it means we would only clear the visible part of the log
      // better keep the log untouched
      clearAttemptResult = false;
      dynamicLog.onVerticalOverflow();
      return "";
    }

    clearAttemptResult = true;
    return eraseLines(visualLineCount);
  };

  const update = (string) => {
    if (dynamicLog.destroyed) {
      throw new Error("Cannot write log after destroy");
    }
    let stringToWrite = string;
    if (lastOutput) {
      if (lastOutputFromOutside) {
        // We don't want to clear logs written by other code,
        // it makes output unreadable and might erase precious information
        // To detect this we put a spy on the stream.
        // The spy is required only if we actually wrote something in the stream
        // something else than this code has written in the stream
        // so we just write without clearing (append instead of replacing)
        lastOutput = "";
        lastOutputFromOutside = "";
      } else {
        stringToWrite = `${getErasePreviousOutput()}${string}`;
      }
    }
    writing = true;
    stream.write(stringToWrite);
    lastOutput = string;
    writing = false;
    clearAttemptResult = undefined;
  };

  const clearDuringFunctionCall = (
    callback,
    ouputAfterCallback = lastOutput,
  ) => {
    // 1. Erase the current log
    // 2. Call callback (expect to write something on stdout)
    // 3. Restore the current log
    // During step 2. we expect a "write from outside" so we uninstall
    // the stream spy during function call
    update("");

    writing = true;
    callback(update);
    lastOutput = "";
    writing = false;

    update(ouputAfterCallback);
  };

  const writeFromOutsideEffect = (value) => {
    if (!lastOutput) {
      // we don't care if the log never wrote anything
      // or if last update() wrote an empty string
      return;
    }
    if (writing) {
      return;
    }
    lastOutputFromOutside = value;
    dynamicLog.onWriteFromOutside(value);
  };

  let removeStreamSpy;
  if (stream === process.stdout) {
    const removeStdoutSpy = spyStreamOutput(
      process.stdout,
      writeFromOutsideEffect,
    );
    const removeStderrSpy = spyStreamOutput(
      process.stderr,
      writeFromOutsideEffect,
    );
    removeStreamSpy = () => {
      removeStdoutSpy();
      removeStderrSpy();
    };
  } else {
    removeStreamSpy = spyStreamOutput(stream, writeFromOutsideEffect);
  }

  const destroy = () => {
    dynamicLog.destroyed = true;
    if (removeStreamSpy) {
      removeStreamSpy();
      removeStreamSpy = null;
      lastOutput = "";
      lastOutputFromOutside = "";
    }
  };

  Object.assign(dynamicLog, {
    update,
    destroy,
    stream,
    clearDuringFunctionCall,
  });
  return dynamicLog;
};

// maybe https://github.com/gajus/output-interceptor/tree/v3.0.0 ?
// the problem with listening data on stdout
// is that node.js will later throw error if stream gets closed
// while something listening data on it
const spyStreamOutput = (stream, callback) => {
  let output = "";
  let installed = true;
  const originalWrite = stream.write;
  stream.write = function (...args /* chunk, encoding, callback */) {
    output += args;
    callback(output);
    return originalWrite.call(this, ...args);
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

const urlToExtension = (url) => {
  const pathname = urlToPathname(url);
  return pathnameToExtension(pathname);
};

const transformUrlPathname = (url, transformer) => {
  if (typeof url === "string") {
    const urlObject = new URL(url);
    const { pathname } = urlObject;
    const pathnameTransformed = transformer(pathname);
    if (pathnameTransformed === pathname) {
      return url;
    }
    let { origin } = urlObject;
    // origin is "null" for "file://" urls with Node.js
    if (origin === "null" && urlObject.href.startsWith("file:")) {
      origin = "file://";
    }
    const { search, hash } = urlObject;
    const urlWithPathnameTransformed = `${origin}${pathnameTransformed}${search}${hash}`;
    return urlWithPathnameTransformed;
  }
  const pathnameTransformed = transformer(url.pathname);
  url.pathname = pathnameTransformed;
  return url;
};
const ensurePathnameTrailingSlash = (url) => {
  return transformUrlPathname(url, (pathname) => {
    return pathname.endsWith("/") ? pathname : `${pathname}/`;
  });
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
      } catch {
        return {
          valid: false,
          value,
          message: `must be a valid url`,
        };
      }
    }
  } else if (
    value &&
    typeof value === "object" &&
    typeof value.href === "string"
  ) {
    value = value.href;
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
      } catch {
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
      return 1;
    }
    if (!rightPartExists) {
      return -1;
    }

    const leftPartIsLast = i === leftPartArray.length - 1;
    const rightPartIsLast = i === rightPartArray.length - 1;
    // folder comes first
    if (leftPartIsLast && !rightPartIsLast) {
      return 1;
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
    return 1;
  }
  if (leftLength > rightLength) {
    return -1;
  }
  return 0;
};

const isWindows$2 = process.platform === "win32";
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
  } catch {
    throw new Error(`absolute url expect but got ${url}`);
  }

  if (!isWindows$2) {
    return url;
  }

  try {
    baseUrl = String(new URL(baseUrl));
  } catch {
    throw new Error(
      `absolute baseUrl expect but got ${baseUrl} to ensure windows drive letter on ${url}`,
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
      `drive letter expect on baseUrl but got ${baseUrl} to ensure windows drive letter on ${url}`,
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

const generateWindowsEPERMErrorMessage = (
  error,
  { operation, path },
) => {
  const pathLengthIsExceedingUsualLimit = String(path).length >= 256;
  let message = "";

  if (operation) {
    message += `error while trying to fix windows EPERM after ${operation} on ${path}`;
  }

  if (pathLengthIsExceedingUsualLimit) {
    message += "\n";
    message += `Maybe because path length is exceeding the usual limit of 256 characters of windows OS?`;
    message += "\n";
  }
  message += "\n";
  message += error.stack;
  return message;
};

const writeEntryPermissions = async (source, permissions) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);

  let binaryFlags;
  {
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

/*
 * - stats object documentation on Node.js
 *   https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_class_fs_stats
 */


const isWindows$1 = process.platform === "win32";

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
    ...(isWindows$1
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
                generateWindowsEPERMErrorMessage(e, {
                  operation: "stats",
                  path: sourcePath,
                }),
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

const writeEntryPermissionsSync = (source, permissions) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);

  let binaryFlags;
  {
    binaryFlags = permissions;
  }

  chmodSync(new URL(sourceUrl), binaryFlags);
};

/*
 * - stats object documentation on Node.js
 *   https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_class_fs_stats
 */


const isWindows = process.platform === "win32";

const readEntryStatSync = (
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

  return statSyncNaive(sourcePath, {
    followLink,
    ...handleNotFoundOption,
    ...(isWindows
      ? {
          // Windows can EPERM on stat
          handlePermissionDeniedError: (error) => {
            console.error(
              `trying to fix windows EPERM after stats on ${sourcePath}`,
            );

            try {
              // unfortunately it means we mutate the permissions
              // without being able to restore them to the previous value
              // (because reading current permission would also throw)
              writeEntryPermissionsSync(sourceUrl, 0o666);
              const stats = statSyncNaive(sourcePath, {
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
                generateWindowsEPERMErrorMessage(e, {
                  operation: "stats",
                  path: sourcePath,
                }),
              );
              throw error;
            }
          },
        }
      : {}),
  });
};

const statSyncNaive = (
  sourcePath,
  {
    followLink,
    handleNotFoundError = null,
    handlePermissionDeniedError = null,
  } = {},
) => {
  const nodeMethod = followLink ? statSync : lstatSync;

  try {
    const stats = nodeMethod(sourcePath);
    return stats;
  } catch (error) {
    if (handleNotFoundError && error.code === "ENOENT") {
      return handleNotFoundError(error);
    }
    if (
      handlePermissionDeniedError &&
      (error.code === "EPERM" || error.code === "EACCES")
    ) {
      return handlePermissionDeniedError(error);
    }
    throw error;
  }
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

const ensureParentDirectories = async (destination) => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);
  const destinationParentPath = dirname(destinationPath);

  await writeDirectory(destinationParentPath, {
    recursive: true,
    allowUseless: true,
  });
};

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

const removeEntrySync = (
  source,
  {
    allowUseless = false,
    recursive = false,
    maxRetries = 3,
    retryDelay = 100,
    onlyContent = false,
  } = {},
) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);
  const sourceStats = readEntryStatSync(sourceUrl, {
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
    removeNonDirectory$1(
      sourceUrl.endsWith("/") ? sourceUrl.slice(0, -1) : sourceUrl);
  } else if (sourceStats.isDirectory()) {
    const directoryUrl = ensurePathnameTrailingSlash(sourceUrl);
    removeDirectorySync$1(directoryUrl, {
      recursive,
      maxRetries,
      retryDelay,
      onlyContent,
    });
  }
};

const removeNonDirectory$1 = (sourceUrl) => {
  const sourcePath = urlToFileSystemPath(sourceUrl);
  const attempt = () => {
    unlinkSyncNaive(sourcePath);
  };
  attempt();
};

const unlinkSyncNaive = (sourcePath, { handleTemporaryError = null } = {}) => {
  try {
    unlinkSync(sourcePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }
    if (
      handleTemporaryError &&
      (error.code === "EBUSY" ||
        error.code === "EMFILE" ||
        error.code === "ENFILE" ||
        error.code === "ENOENT")
    ) {
      handleTemporaryError(error);
      return;
    }
    throw error;
  }
};

const removeDirectorySync$1 = (
  rootDirectoryUrl,
  { maxRetries, retryDelay, recursive, onlyContent },
) => {
  const visit = (sourceUrl) => {
    const sourceStats = readEntryStatSync(sourceUrl, {
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
      visitFile(sourceUrl);
    } else if (sourceStats.isSymbolicLink()) {
      visitSymbolicLink(sourceUrl);
    } else if (sourceStats.isDirectory()) {
      visitDirectory(`${sourceUrl}/`);
    }
  };

  const visitDirectory = (directoryUrl) => {
    const directoryPath = urlToFileSystemPath(directoryUrl);
    const optionsFromRecursive = recursive
      ? {
          handleNotEmptyError: () => {
            removeDirectoryContent(directoryUrl);
            visitDirectory(directoryUrl);
          },
        }
      : {};
    removeDirectorySyncNaive(directoryPath, {
      ...optionsFromRecursive,
      // Workaround for https://github.com/joyent/node/issues/4337
      ...(process.platform === "win32"
        ? {
            handlePermissionError: (error) => {
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
                  generateWindowsEPERMErrorMessage(openOrCloseError, {
                    path: directoryPath,
                    operation: "readir",
                  }),
                );
                throw error;
              }
              removeDirectorySyncNaive(directoryPath, {
                ...optionsFromRecursive,
              });
            },
          }
        : {}),
    });
  };

  const removeDirectoryContent = (directoryUrl) => {
    const entryNames = readdirSync(new URL(directoryUrl));
    for (const entryName of entryNames) {
      const url = resolveUrl(entryName, directoryUrl);
      visit(url);
    }
  };

  const visitFile = (fileUrl) => {
    removeNonDirectory$1(fileUrl);
  };

  const visitSymbolicLink = (symbolicLinkUrl) => {
    removeNonDirectory$1(symbolicLinkUrl);
  };

  if (onlyContent) {
    removeDirectoryContent(rootDirectoryUrl);
  } else {
    visitDirectory(rootDirectoryUrl);
  }
};

const removeDirectorySyncNaive = (
  directoryPath,
  { handleNotEmptyError = null, handlePermissionError = null } = {},
) => {
  try {
    rmdirSync(directoryPath);
  } catch (error) {
    if (handlePermissionError && error.code === "EPERM") {
      handlePermissionError(error);
      return;
    }
    if (error.code === "ENOENT") {
      return;
    }
    if (
      handleNotEmptyError &&
      // linux os
      (error.code === "ENOTEMPTY" ||
        // SunOS
        error.code === "EEXIST")
    ) {
      handleNotEmptyError(error);
      return;
    }
    throw error;
  }
};

const removeDirectorySync = (url, options = {}) => {
  return removeEntrySync(url, {
    ...options,
    recursive: true,
  });
};

const writeDirectorySync = (
  destination,
  { recursive = true, allowUseless = false, force } = {},
) => {
  const destinationUrl = assertAndNormalizeDirectoryUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);

  let destinationStats;
  try {
    destinationStats = readEntryStatSync(destinationUrl, {
      nullIfNotFound: true,
      followLink: false,
    });
  } catch (e) {
    if (e.code === "ENOTDIR") {
      let previousNonDirUrl = destinationUrl;
      // we must try all parent directories as long as it fails with ENOTDIR
      findSelfOrAncestorDirectoryUrl(destinationUrl, (ancestorUrl) => {
        try {
          statSync(new URL(ancestorUrl));
          return true;
        } catch (e) {
          if (e.code === "ENOTDIR") {
            previousNonDirUrl = ancestorUrl;
            return false;
          }
          throw e;
        }
      });
      if (force) {
        unlinkSync(
          new URL(
            previousNonDirUrl
              // remove trailing slash
              .slice(0, -1),
          ),
        );
        destinationStats = null;
      } else {
        throw new Error(
          `cannot write directory at ${destinationPath} because there is a file at ${urlToFileSystemPath(
            previousNonDirUrl,
          )}`,
        );
      }
    } else {
      throw e;
    }
  }

  if (destinationStats) {
    if (destinationStats.isDirectory()) {
      if (allowUseless) {
        return;
      }
      throw new Error(`directory already exists at ${destinationPath}`);
    }
    if (force) {
      unlinkSync(destinationPath);
    } else {
      const destinationType = statsToType(destinationStats);
      throw new Error(
        `cannot write directory at ${destinationPath} because there is a ${destinationType}`,
      );
    }
  }

  try {
    mkdirSync(destinationPath, { recursive });
  } catch (error) {
    if (allowUseless && error.code === "EEXIST") {
      return;
    }
    throw error;
  }
};

const writeFileSync = (destination, content = "", { force } = {}) => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationUrlObject = new URL(destinationUrl);
  if (content && content instanceof URL) {
    content = readFileSync(content);
  }
  try {
    writeFileSync$1(destinationUrlObject, content);
  } catch (error) {
    if (error.code === "EISDIR") {
      // happens when directory existed but got deleted and now it's a file
      if (force) {
        removeDirectorySync(destinationUrlObject);
        writeFileSync$1(destinationUrlObject, content);
      } else {
        throw error;
      }
    }
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      writeDirectorySync(new URL("./", destinationUrlObject), {
        force,
        recursive: true,
      });
      writeFileSync$1(destinationUrlObject, content);
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
                  generateWindowsEPERMErrorMessage(openOrCloseError, {
                    operation: "readdir",
                    path: directoryPath,
                  }),
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

const ensureEmptyDirectorySync = (source) => {
  const stat = readEntryStatSync(source, {
    nullIfNotFound: true,
    followLink: false,
  });

  if (stat === null) {
    // if there is nothing, create a directory
    writeDirectorySync(source, { allowUseless: true });
    return;
  }
  if (stat.isDirectory()) {
    removeEntrySync(source, {
      recursive: true,
      onlyContent: true,
      allowUseless: true,
    });
    return;
  }

  const sourceType = statsToType(stat);
  const sourcePath = urlToFileSystemPath(assertAndNormalizeFileUrl(source));
  throw new Error(
    `ensureEmptyDirectorySync expect directory at ${sourcePath}, found ${sourceType} instead`,
  );
};

const ensureEmptyDirectory = async (source) => {
  const stats = await readEntryStat(source, {
    nullIfNotFound: true,
    followLink: false,
  });
  if (stats === null) {
    // if there is nothing, create a directory
    await writeDirectory(source, { allowUseless: true });
    return;
  }
  if (stats.isDirectory()) {
    // if there is a directory remove its content and done
    await removeEntry(source, {
      allowUseless: true,
      recursive: true,
      onlyContent: true,
    });
    return;
  }

  const sourceType = statsToType(stats);
  const sourcePath = urlToFileSystemPath(assertAndNormalizeFileUrl(source));
  throw new Error(
    `ensureEmptyDirectory expect directory at ${sourcePath}, found ${sourceType} instead`,
  );
};

const countAvailableCpus = () => {
  if (typeof availableParallelism === "function") {
    return availableParallelism();
  }
  const cpuArray = cpus();
  return cpuArray.length || 1;
};

const getAvailableMemory = () => totalmem();

const getOsVersion = () => release();

const startMeasuringTotalCpuUsage = () => {
  let previousCpuArray = cpus();
  let previousMs = Date.now();
  let previousCpuUsage = cpuUsage();

  const overall = {
    inactive: 100,
    active: 0,
    system: 0,
    user: 0,
  };
  const thisProcess = {
    active: 0,
    system: 0,
    user: 0,
  };
  const details = previousCpuArray.map(() => {
    return {
      inactive: 100,
      active: 0,
      system: 0,
      user: 0,
    };
  });

  const samples = [];
  const interval = setInterval(() => {
    let cpuArray = cpus();
    const ms = Date.now();
    const ellapsedMs = ms - previousMs;
    const cpuUsageSampleArray = [];
    let overallSystemMs = 0;
    let overallUserMs = 0;
    let overallInactiveMs = 0;
    let overallActiveMs = 0;
    let overallMsEllapsed = 0;
    let index = 0;
    for (const cpu of cpuArray) {
      const previousCpuTimes = previousCpuArray[index].times;
      const cpuTimes = cpu.times;
      const systemMs = cpuTimes.sys - previousCpuTimes.sys;
      const userMs = cpuTimes.user - previousCpuTimes.user;
      const activeMs = systemMs + userMs;
      const inactiveMs = ellapsedMs - activeMs;
      const cpuUsageSample = {
        inactive: inactiveMs / ellapsedMs,
        active: activeMs / ellapsedMs,
        system: systemMs / ellapsedMs,
        user: userMs / ellapsedMs,
      };
      cpuUsageSampleArray.push(cpuUsageSample);

      overallSystemMs += systemMs;
      overallUserMs += userMs;
      overallInactiveMs += inactiveMs;
      overallActiveMs += activeMs;
      overallMsEllapsed += ellapsedMs;
      index++;
    }
    const overallUsageSample = {
      inactive: overallInactiveMs / overallMsEllapsed,
      active: overallActiveMs / overallMsEllapsed,
      system: overallSystemMs / overallMsEllapsed,
      user: overallUserMs / overallMsEllapsed,
    };
    previousCpuArray = cpuArray;
    previousMs = ms;

    const processCpuUsage = cpuUsage();
    const thisProcessSystemMs = Math.round(
      (processCpuUsage.system - previousCpuUsage.system) / 1000,
    );
    const thisProcessUserMs = Math.round(
      (processCpuUsage.user - previousCpuUsage.user) / 1000,
    );
    previousCpuUsage = processCpuUsage;

    const thisProcessActiveMs = thisProcessSystemMs + thisProcessUserMs;
    const thisProcessInactiveMs = overallMsEllapsed - thisProcessActiveMs;
    const thisProcessSample = {
      inactive: thisProcessInactiveMs / overallMsEllapsed,
      active: thisProcessActiveMs / overallMsEllapsed,
      system: thisProcessSystemMs / overallMsEllapsed,
      user: thisProcessUserMs / overallMsEllapsed,
    };
    samples.push({
      cpuUsageSampleArray,
      overallUsageSample,
      thisProcessSample,
    });
    if (samples.length === 10) {
      {
        let index = 0;
        for (const detail of details) {
          let systemSum = 0;
          let userSum = 0;
          let inactiveSum = 0;
          let activeSum = 0;
          for (const sample of samples) {
            const { cpuUsageSampleArray } = sample;
            const cpuUsageSample = cpuUsageSampleArray[index];
            inactiveSum += cpuUsageSample.inactive;
            activeSum += cpuUsageSample.active;
            systemSum += cpuUsageSample.system;
            userSum += cpuUsageSample.user;
          }
          Object.assign(detail, {
            inactive: inactiveSum / samples.length,
            active: activeSum / samples.length,
            system: systemSum / samples.length,
            user: userSum / samples.length,
          });
          index++;
        }
      }
      {
        let overallSystemSum = 0;
        let overallUserSum = 0;
        let overallInactiveSum = 0;
        let overallActiveSum = 0;
        for (const sample of samples) {
          const { overallUsageSample } = sample;
          overallSystemSum += overallUsageSample.system;
          overallUserSum += overallUsageSample.user;
          overallInactiveSum += overallUsageSample.inactive;
          overallActiveSum += overallUsageSample.active;
        }
        Object.assign(overall, {
          inactive: overallInactiveSum / samples.length,
          active: overallActiveSum / samples.length,
          system: overallSystemSum / samples.length,
          user: overallUserSum / samples.length,
        });
      }
      {
        let thisProcessSystemSum = 0;
        let thisProcessUserSum = 0;
        let thisProcessInactiveSum = 0;
        let thisProcessActiveSum = 0;
        for (const sample of samples) {
          const { thisProcessSample } = sample;
          thisProcessSystemSum += thisProcessSample.system;
          thisProcessUserSum += thisProcessSample.user;
          thisProcessInactiveSum += thisProcessSample.inactive;
          thisProcessActiveSum += thisProcessSample.active;
        }
        Object.assign(thisProcess, {
          inactive: thisProcessInactiveSum / samples.length,
          active: thisProcessActiveSum / samples.length,
          system: thisProcessSystemSum / samples.length,
          user: thisProcessUserSum / samples.length,
        });
      }
      samples.length = 0;
    }
  }, 15);
  interval.unref();

  return {
    overall,
    thisProcess,
    details,
    stop: () => {
      clearInterval(interval);
    },
  };
};

const startMonitoringMetric = (measure) => {
  const metrics = [];
  const takeMeasure = () => {
    const value = measure();
    metrics.push(value);
    return value;
  };

  const info = {
    start: takeMeasure(),
    min: null,
    max: null,
    median: null,
    end: null,
  };
  return {
    info,
    measure: takeMeasure,
    end: () => {
      info.end = takeMeasure();
      metrics.sort((a, b) => a - b);
      info.min = metrics[0];
      info.max = metrics[metrics.length - 1];
      info.median = medianFromSortedArray(metrics);
      metrics.length = 0;
    },
  };
};

const medianFromSortedArray = (array) => {
  const length = array.length;
  const isOdd = length % 2 === 1;
  if (isOdd) {
    const medianNumberIndex = (length - 1) / 2;
    const medianNumber = array[medianNumberIndex];
    return medianNumber;
  }
  const rightMiddleNumberIndex = length / 2;
  const leftMiddleNumberIndex = rightMiddleNumberIndex - 1;
  const leftMiddleNumber = array[leftMiddleNumberIndex];
  const rightMiddleNumber = array[rightMiddleNumberIndex];
  const medianNumber = (leftMiddleNumber + rightMiddleNumber) / 2;
  return medianNumber;
};

// https://gist.github.com/GaetanoPiazzolla/c40e1ebb9f709d091208e89baf9f4e00


const startMonitoringCpuUsage = () => {
  const cpuUsage = startMeasuringTotalCpuUsage();
  const processCpuUsageMonitoring = startMonitoringMetric(() => {
    return cpuUsage.thisProcess.active;
  });
  const osCpuUsageMonitoring = startMonitoringMetric(() => {
    return cpuUsage.overall.active;
  });
  const result = [processCpuUsageMonitoring, osCpuUsageMonitoring];
  result.stop = cpuUsage.stop;
  return result;
};

const startMonitoringMemoryUsage = () => {
  const processMemoryUsageMonitoring = startMonitoringMetric(() => {
    return memoryUsage().rss;
  });
  const osMemoryUsageMonitoring = startMonitoringMetric(() => {
    const total = totalmem();
    const free = freemem();
    return total - free;
  });
  const stop = () => {
    processMemoryUsageMonitoring.stop();
    osMemoryUsageMonitoring.stop();
  };
  const result = [processMemoryUsageMonitoring, osMemoryUsageMonitoring];
  result.stop = stop;
  return result;
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

const importWithRequire = createRequire(import.meta.url);

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

const listRelativeFileUrlToCover = async ({
  signal,
  rootDirectoryUrl,
  coverageInclude,
}) => {
  const matchingFileResultArray = await collectFiles({
    signal,
    directoryUrl: rootDirectoryUrl,
    associations: { cover: coverageInclude },
    predicate: ({ cover }) => cover,
  });
  return matchingFileResultArray.map(({ relativeUrl }) => relativeUrl);
};

const getMissingFileByFileCoverage = async ({
  signal,
  rootDirectoryUrl,
  coverageInclude,
  fileByFileCoverage,
}) => {
  const relativeUrlsToCover = await listRelativeFileUrlToCover({
    signal,
    rootDirectoryUrl,
    coverageInclude,
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

const composeV8AndIstanbul = (
  v8FileByFileCoverage,
  istanbulFileByFileCoverage,
  { warn, v8ConflictWarning },
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
      if (v8ConflictWarning) {
        warn({
          code: "V8_COVERAGE_CONFLICT",
          message: createDetailedMessage(
            `Coverage conflict on "${key}", found two coverage that cannot be merged together: v8 and istanbul. The istanbul coverage will be ignored.`,
            {
              "details": `This happens when a file is executed on a runtime using v8 coverage (node or chromium) and on runtime using istanbul coverage (firefox or webkit)`,
              "suggestion":
                "disable this warning with coverage.v8ConflictWarning: false",
              "suggestion 2": `force coverage using istanbul with coverage.methodForBrowsers: "istanbul"`,
            },
          ),
        });
      }
      fileByFileCoverage[key] = v8Coverage;
    } else {
      fileByFileCoverage[key] = istanbulFileByFileCoverage[key];
    }
  });

  return fileByFileCoverage;
};

const filterV8Coverage = async (
  v8Coverage,
  { rootDirectoryUrl, coverageInclude },
) => {
  const associations = URL_META.resolveAssociations(
    { cover: coverageInclude },
    rootDirectoryUrl,
  );
  const urlShouldBeCovered = (url) => {
    const { cover } = URL_META.applyAssociations({
      url: new URL(url, rootDirectoryUrl).href,
      associations,
    });
    return cover;
  };

  const v8CoverageFiltered = {
    ...v8Coverage,
    result: v8Coverage.result.filter((fileReport) =>
      urlShouldBeCovered(fileReport.url),
    ),
  };
  return v8CoverageFiltered;
};

const composeTwoV8Coverages = (firstV8Coverage, secondV8Coverage) => {
  if (secondV8Coverage.result.length === 0) {
    return firstV8Coverage;
  }
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

const readNodeV8CoverageDirectory = async ({
  logger,
  warn,
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
    warn({
      code: "V8_COVERAGE_EMPTY",
      message: `v8 coverage directory is empty at ${NODE_V8_COVERAGE}`,
    });
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

const generateCoverage = async (
  testPlanResult,
  { signal, logger, warn, rootDirectoryUrl, coverage },
) => {
  // collect v8 and istanbul coverage from executions
  let { v8Coverage, fileByFileIstanbulCoverage } =
    await getCoverageFromTestPlanResults(testPlanResult.results, {
      signal,
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
          coverage.methodForNodeJs !== "NODE_V8_COVERAGE"
        ) {
          warn({
            code: "EXECUTION_COVERAGE_FILE_NOT_FOUND",
            message: `"${executionName}" execution of ${file} did not properly write coverage into ${executionResult.coverageFileUrl}`,
          });
        }
      },
    });

  if (coverage.methodForNodeJs === "NODE_V8_COVERAGE") {
    await readNodeV8CoverageDirectory({
      logger,
      warn,
      signal,
      onV8Coverage: async (nodeV8Coverage) => {
        const nodeV8CoverageLight = await filterV8Coverage(nodeV8Coverage, {
          rootDirectoryUrl,
          coverageInclude: coverage.include,
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
        {
          warn,
          v8ConflictWarning: coverage.v8ConflictWarning,
        },
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
  if (coverage.includeMissing) {
    const missingFileByFileCoverage = await getMissingFileByFileCoverage({
      signal,
      rootDirectoryUrl,
      coverageInclude: coverage.include,
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

const getCoverageFromTestPlanResults = async (
  executionResults,
  { signal, onMissing },
) => {
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);

  try {
    let v8Coverage;
    let fileByFileIstanbulCoverage;

    // collect v8 and istanbul coverage from executions
    for (const file of Object.keys(executionResults)) {
      const executionResultForFile = executionResults[file];
      for (const executionName of Object.keys(executionResultForFile)) {
        operation.throwIfAborted();

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
            continue;
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
      }
    }

    return {
      v8Coverage,
      fileByFileIstanbulCoverage,
    };
  } finally {
    await operation.end();
  }
};

const isV8Coverage = (coverage) => Boolean(coverage.result);

const githubAnnotationFromError = (
  error,
  { rootDirectoryUrl, execution },
) => {
  const annotation = {
    annotation_level: "failure",
    path: execution.fileRelativeUrl,
    start_line: 1,
    end_line: 1,
    title: `Error while executing ${execution.fileRelativeUrl} on ${execution.runtimeName}@${execution.runtimeVersion}`,
  };
  const exception = asException(error, { rootDirectoryUrl });
  if (exception.site && typeof exception.site.line === "number") {
    annotation.path = urlToRelativeUrl(exception.site.url, rootDirectoryUrl);
    annotation.start_line = exception.site.line;
    annotation.end_line = exception.site.line;
    annotation.start_column = exception.site.column;
    annotation.end_column = exception.site.column;
  }
  annotation.message = exception.stack;
  return annotation;
};

const asException = (error, { rootDirectoryUrl }) => {
  const exception = {
    isException: true,
    stack: "",
    site: {},
  };
  if (error === null || error === undefined || typeof error === "string") {
    exception.message = String(error);
    return exception;
  }
  if (error) {
    exception.message = error.message;
    if (error.isException) {
      Object.assign(exception, error);
      exception.stack = replaceUrls$1(
        error.stack,
        ({ match, url, line = 1, column = 1 }) => {
          if (urlIsInsideOf(url, rootDirectoryUrl)) {
            const relativeUrl = urlToRelativeUrl(url, rootDirectoryUrl);
            match = stringifyUrlSite({ url: relativeUrl, line, column });
          }
          return match;
        },
      );
    } else if (error.stack) {
      let firstSite = true;
      exception.stack = replaceUrls$1(
        error.stack,
        ({ match, url, line = 1, column = 1 }) => {
          if (urlIsInsideOf(url, rootDirectoryUrl)) {
            const relativeUrl = urlToRelativeUrl(url, rootDirectoryUrl);
            match = stringifyUrlSite({ url: relativeUrl, line, column });
          }
          if (firstSite) {
            firstSite = false;
            exception.site.url = url;
            exception.site.line = line;
            exception.site.column = column;
          }
          return match;
        },
      );
    }

    return exception;
  }
  exception.message = error;
  return exception;
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

const replaceUrls$1 = (source, replace) => {
  return source.replace(/(?:https?|ftp|file):\/\/\S+/g, (match) => {
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
        line: lineString ? parseInt(lineString) : undefined,
        column: columnString ? parseInt(columnString) : undefined,
      });
    } else {
      const linePattern = /:([0-9]+)$/;
      const lineMatch = match.match(linePattern);
      if (lineMatch) {
        const lineString = lineMatch[0];
        replacement = replace({
          match: lineMatch,
          url: match.slice(0, -lineString.length),
          line: lineString ? parseInt(lineString) : undefined,
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

const createIsInsideFragment = (fragment, total) => {
  let [dividend, divisor] = fragment.split("/");
  dividend = parseInt(dividend);
  divisor = parseInt(divisor);
  const groupSize = Math.ceil(total / divisor);
  let from;
  let to;
  if (groupSize === 0) {
    if (dividend === 1) {
      from = 0;
      to = 0;
    } else {
      from = Infinity;
      to = -1;
    }
  } else if (dividend === 1) {
    from = 0;
    to = groupSize;
  } else {
    from = (dividend - 1) * groupSize;
    if (dividend === divisor) {
      to = total;
    } else {
      to = from + groupSize;
    }
  }
  return (index) => {
    if (index < from) return false;
    if (index >= to) return false;
    return true;
  };
};

// `Error: yo
// at Object.execute (http://127.0.0.1:57300/build/src/__test__/file-throw.js:9:13)
// at doExec (http://127.0.0.1:3000/src/__test__/file-throw.js:452:38)
// at postOrderExec (http://127.0.0.1:3000/src/__test__/file-throw.js:448:16)
// at http://127.0.0.1:3000/src/__test__/file-throw.js:399:18`.replace(/(?:https?|ftp|file):\/\/(.*+)$/gm, (...args) => {
//   debugger
// })
const replaceUrls = (source, replace) => {
  return source.replace(/(?:https?|ftp|file):\/\/\S+/g, (match) => {
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
          url: match.slice(0, -lineString.length),
          line: lineString ? parseInt(lineString) : null,
        });
      } else {
        replacement = replace({
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

const formatErrorForTerminal = (
  error,
  { rootDirectoryUrl, mainFileRelativeUrl, mockFluctuatingValues, tryColors },
) => {
  if (!error.stack) {
    return error.message;
  }

  let ansiSupported = ANSI.supported;
  if (!tryColors) {
    ANSI.supported = false;
  }

  let text = "";
  {
    if (
      error.site &&
      error.site.url &&
      error.site.url.startsWith("file:") &&
      typeof error.site.line === "number"
    ) {
      try {
        const content = readFileSync(new URL(error.site.url), "utf8");
        text += generateContentFrame({
          content,
          line: error.site.line,
          column: error.site.column,
          linesAbove: 2,
          linesBelow: 0,
          lineMaxWidth: process.stdout.columns,
          format: (string, type) => {
            return {
              line_number_aside: () => ANSI.color(string, ANSI.GREY),
              char: () => string,
              marker_overflow_left: () => ANSI.color(string, ANSI.GREY),
              marker_overflow_right: () => ANSI.color(string, ANSI.GREY),
              marker_line: () => ANSI.color(string, ANSI.RED),
              marker_column: () => ANSI.color(string, ANSI.RED),
            }[type]();
          },
        });
        text += `\n`;
      } catch {}
    }
  }
  text += `${error.name}: ${error.message}`;
  {
    const stringifyUrlSite = ({ url, line, column, urlIsMain }) => {
      let urlAsPath = String(url).startsWith("file:")
        ? urlToFileSystemPath(url)
        : url;
      if (mockFluctuatingValues) {
        const rootDirectoryPath = urlToFileSystemPath(rootDirectoryUrl);
        urlAsPath = urlAsPath.replace(rootDirectoryPath, "[mock]");
        if (process.platform === "win32") {
          urlAsPath = urlAsPath.replace(/\\/g, "/");
        }
      }
      if (urlIsMain) {
        urlAsPath = ANSI.effect(urlAsPath, ANSI.BOLD);
      }
      if (typeof line === "number" && typeof column === "number") {
        return `${urlAsPath}:${line}:${column}`;
      }
      if (typeof line === "number") {
        return `${urlAsPath}:${line}`;
      }
      return urlAsPath;
    };

    let stackTrace = "";
    const stackFrames = error.stackFrames;
    if (stackFrames && stackFrames.length) {
      let atLeastOneNonNative = false;
      let lastStackFrameForMain;
      const mainFileUrl = new URL(mainFileRelativeUrl, rootDirectoryUrl).href;
      for (const stackFrame of stackFrames) {
        if (stackFrame.url === mainFileUrl) {
          lastStackFrameForMain = stackFrame;
        }
        if (!stackFrame.native) {
          atLeastOneNonNative = true;
        }
      }

      for (const stackFrame of stackFrames) {
        if (atLeastOneNonNative && stackFrame.native) {
          continue;
        }
        let stackFrameString = stackFrame.raw;
        stackFrameString = replaceUrls(
          stackFrameString,
          ({ url, line, column }) => {
            const replacement = stringifyUrlSite({
              url,
              urlIsMain: stackFrame === lastStackFrameForMain,
              line,
              column,
            });
            return replacement;
          },
        );
        if (stackTrace) stackTrace += "\n";
        stackTrace += stackFrameString;
      }
    } else if (error.stackTrace) {
      stackTrace = replaceUrls(error.stackTrace, ({ url, line, column }) => {
        const replacement = stringifyUrlSite({
          url,
          line,
          column,
        });
        return replacement;
      });
    } else if (error.site) {
      stackTrace += `  ${stringifyUrlSite({
        url: error.site.url,
        line: error.site.line,
        column: error.site.column,
      })}`;
    }

    if (stackTrace) {
      text += `\n${stackTrace}`;
    }
  }

  if (!tryColors) {
    ANSI.supported = ansiSupported;
  }

  return text;
};

/*
 *                                 label
 *           ┌───────────────────────┴────────────────────────────────┐
 *           │                               │                        │
 *       description                     runtime info                 │
 *  ┌────────┴─────────┐               ┌─────┴───────┐                │
 *  │                  │               │       │     │                │
 * icon number        file            group duration memory intermediate summary
 * ┌┴┐┌───┴─┐ ┌────────┴─────────┐ ┌───┴────┐┌─┴─┐ ┌─┴──┐  ┌──────────┴──────────┐
 *  ✔ 001/100 tests/file.test.html [chromium/10.4s/14.5MB] (2 completed, 1 failed)
 *  ------- console (i1 ✖1) -------
 *  i info
 *  ✖ error
 *  -------------------------------
 *  ---------- error -------
 *  1 | throw new Error("test");
 *      ^
 *  Error: test
 *    at file://demo/file.test.js:1:1
 *  ------------------------
 */

const reporterList = ({
  animated = true,
  mockFluctuatingValues, // used for snapshot testing logs
  platformInfo,
  memoryUsage: memoryUsage$1,
  cpuUsage,
  spy = () => {
    return {
      write: (log) => {
        process.stdout.write(log);
      },
      end: () => {},
    };
  },
  fileUrl,
}) => {
  const animatedLogEnabled =
    animated &&
    // canEraseProcessStdout
    process.stdout.isTTY &&
    // if there is an error during execution npm will mess up the output
    // (happens when npm runs several command in a workspace)
    // so we enable hot replace only when !process.exitCode (no error so far)
    process.exitCode !== 1;

  const logOptions = {
    platformInfo,
    memoryUsage: memoryUsage$1,
    cpuUsage,
    mockFluctuatingValues,
    group: false,
    intermediateSummary: !animatedLogEnabled,
  };

  let startMs = Date.now();

  const reporters = [
    {
      reporter: "list",
      beforeAll: async (testPlanResult) => {
        const applyColorOnFileRelativeUrl = createApplyColorOnFileRelativeUrl(
          testPlanResult.rootDirectoryUrl,
        );
        logOptions.applyColorOnFileRelativeUrl = applyColorOnFileRelativeUrl;

        let spyReturnValue = await spy();
        let write = spyReturnValue.write;
        let end = spyReturnValue.end;
        spyReturnValue = undefined;

        logOptions.group = Object.keys(testPlanResult.groups).length > 1;
        write(renderIntro(testPlanResult, logOptions));
        if (
          !animatedLogEnabled ||
          Object.keys(testPlanResult.results).length === 0
        ) {
          return {
            afterEachInOrder: (execution, testPlanResult, testPlanHelpers) => {
              const log = renderExecutionLog(
                execution,
                logOptions,
                testPlanResult,
                testPlanHelpers,
              );
              if (log) {
                write(log);
              }
            },
            afterAll: async () => {
              await write(renderOutro(testPlanResult, logOptions));
              write = undefined;
              if (end) {
                await end();
                end = undefined;
              }
            },
          };
        }

        let dynamicLog = createDynamicLog({
          stream: { write },
        });
        const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
        let frameIndex = 0;
        let oneExecutionWritten = false;
        const memoryHeapUsedAtStart = memoryUsage().heapUsed;
        const renderDynamicLog = (testPlanResult) => {
          frameIndex = frameIndex === frames.length - 1 ? 0 : frameIndex + 1;
          let dynamicLogContent = "";
          dynamicLogContent += `${frames[frameIndex]} `;
          dynamicLogContent += renderStatusRepartition(
            testPlanResult.counters,
            {
              showProgression: true,
            },
          );

          const msEllapsed = Date.now() - startMs;
          const infos = [];
          const duration = humanizeDuration(msEllapsed, {
            short: true,
            decimals: 0,
            rounded: false,
          });
          infos.push(ANSI.color(duration, ANSI.GREY));
          let memoryUsageColor = ANSI.GREY;
          const memoryHeapUsed = memoryUsage().heapUsed;
          if (memoryHeapUsed > 2.5 * memoryHeapUsedAtStart) {
            memoryUsageColor = ANSI.YELLOW;
          } else if (memoryHeapUsed > 1.5 * memoryHeapUsedAtStart) {
            memoryUsageColor = null;
          }
          const memoryHeapUsedFormatted = humanizeMemory(memoryHeapUsed, {
            short: true,
            decimals: 0,
          });
          infos.push(ANSI.color(memoryHeapUsedFormatted, memoryUsageColor));

          const infoFormatted = infos.join(ANSI.color(`/`, ANSI.GREY));
          dynamicLogContent += ` ${ANSI.color(
            "[",
            ANSI.GREY,
          )}${infoFormatted}${ANSI.color("]", ANSI.GREY)}`;

          if (oneExecutionWritten) {
            dynamicLogContent = `\n${dynamicLogContent}`;
          }
          dynamicLogContent = `${dynamicLogContent}\n`;
          return dynamicLogContent;
        };
        dynamicLog.update(renderDynamicLog(testPlanResult));
        const interval = setInterval(() => {
          dynamicLog.update(renderDynamicLog(testPlanResult));
        }, 150);

        return {
          warn: (warning) => {
            dynamicLog.clearDuringFunctionCall(() => {
              console.warn(warning.message);
            });
          },
          afterEachInOrder: (execution, testPlanResult, testPlanHelpers) => {
            oneExecutionWritten = true;
            dynamicLog.clearDuringFunctionCall(
              () => {
                const log = renderExecutionLog(
                  execution,
                  logOptions,
                  testPlanResult,
                  testPlanHelpers,
                );
                if (log) {
                  write(log);
                }
              },
              // regenerate the dynamic log to put the leading "\n"
              // because of oneExecutionWritten becoming true
              renderDynamicLog(testPlanResult),
            );
          },
          afterAll: async () => {
            dynamicLog.update("");
            dynamicLog.destroy();
            dynamicLog = null;
            clearInterval(interval);
            await write(renderOutro(testPlanResult, logOptions));
            write = undefined;
            await end();
            end = undefined;
          },
        };
      },
    },
  ];

  if (animated && fileUrl) {
    reporters.push(
      reporterList({
        animated: false,
        platformInfo,
        memoryUsage: memoryUsage$1,
        cpuUsage,
        mockFluctuatingValues, // used for snapshot testing logs
        spy: () => {
          let rawOutput = "";
          return {
            write: (log) => {
              rawOutput += stripAnsi(log);
              writeFileSync(fileUrl, rawOutput);
            },
            afterAll: () => {},
          };
        },
      }),
    );
  }

  return reporters;
};

const createApplyColorOnFileRelativeUrl = (rootDirectoryUrl) => {
  const packageExistsMap = new Map();
  const directoryHasPackageJsonFile = (directoryUrl) => {
    if (packageExistsMap.has(directoryUrl)) {
      return packageExistsMap.get(directoryUrl);
    }
    const packageJsonFileUrl = new URL("./package.json", directoryUrl);
    if (existsSync(packageJsonFileUrl)) {
      packageExistsMap.set(directoryUrl, true);
      return true;
    }
    packageExistsMap.set(directoryUrl, false);
    return false;
  };
  const applyColorOnFileRelativeUrl = (fileRelativeUrl, color) => {
    let parts = fileRelativeUrl.split("/");
    const filename = parts.pop();
    let i = 0;
    while (i < parts.length) {
      const directoryRelativeUrl = parts.slice(0, i + 1).join("/");
      const directoryUrl = new URL(`${directoryRelativeUrl}/`, rootDirectoryUrl)
        .href;
      if (directoryHasPackageJsonFile(directoryUrl)) {
        if (i === 0) {
          return ANSI.color(fileRelativeUrl, color);
        }
        // all the things before in grey
        // all the things after in the color
        const before = parts.slice(0, i).join("/");
        const packageDirectory = parts[i];
        const packageDirectoryStylized = ANSI.color(
          ANSI.effect(packageDirectory, ANSI.UNDERLINE),
          color,
        );
        let pathColored = ANSI.color(`${before}/`, color);
        if (i === parts.length - 1) {
          pathColored += packageDirectoryStylized;
          pathColored += ANSI.color(`/${filename}`, color);
          return pathColored;
        }
        const after = parts.slice(i + 1).join("/");
        pathColored += packageDirectoryStylized;
        pathColored += ANSI.color(`/${after}/${filename}`, color);
        return pathColored;
      }
      i++;
    }
    return ANSI.color(fileRelativeUrl, color);
  };
  return applyColorOnFileRelativeUrl;
};

const renderIntro = (testPlanResult, logOptions) => {
  const directory = logOptions.mockFluctuatingValues
    ? "/mock/"
    : urlToFileSystemPath(testPlanResult.rootDirectoryUrl);
  const numberOfFiles = Object.keys(testPlanResult.results).length;
  const { counters } = testPlanResult;
  const { planified } = counters;

  let title;
  if (planified === 0) {
    title = `nothing to execute`;
  } else if (planified === 1) {
    title = `1 execution ready`;
  } else {
    title = `${planified} executions ready`;
  }
  const lines = [];
  lines.push(`directory: ${directory}`);
  if (numberOfFiles === 0) {
    let testPlanLog = "";
    testPlanLog += "{";
    testPlanLog += "\n";
    const single = testPlanResult.patterns.length === 1;
    for (const pattern of testPlanResult.patterns) {
      testPlanLog += "  ";
      testPlanLog += JSON.stringify(pattern);
      testPlanLog += ": ";
      testPlanLog += "...";
      if (!single) {
        testPlanLog += ",";
      }
      testPlanLog += "\n";
    }
    testPlanLog += "}";
    lines.push(`testPlan: ${testPlanLog}`);
  }
  if (testPlanResult.fragment) {
    lines.push(
      `fragment: ${testPlanResult.fragment}, executing only ${testPlanResult.fragmentStart}:${testPlanResult.fragmentEnd}`,
    );
  }
  if (logOptions.platformInfo) {
    {
      let osLine = `os: `;
      if (logOptions.mockFluctuatingValues) {
        osLine += `os@<mock>`;
      } else {
        osLine += `${testPlanResult.os.name}@${testPlanResult.os.version}`;
      }
      osLine += renderDetails({
        cpu: logOptions.mockFluctuatingValues
          ? "<mock>"
          : testPlanResult.os.availableCpu,
        memory: logOptions.mockFluctuatingValues
          ? "<mock>GB"
          : humanizeMemory(testPlanResult.os.availableMemory, {
              short: true,
              decimals: 0,
            }),
      });
      lines.push(osLine);
      // TODO: an option to log how many cpu, memory etc we'll use?
    }
    {
      const runtime = logOptions.mockFluctuatingValues
        ? `node@mock`
        : `${testPlanResult.runtime.name}@${testPlanResult.runtime.version}`;
      let runtimeLine = `runtime: ${runtime}`;
      lines.push(runtimeLine);
    }
  }
  return `${renderBigSection({
    title,
    content: lines.join("\n"),
  })}\n`;
};

const renderExecutionLog = (
  execution,
  logOptions,
  testPlanResult,
  { getPreviousExecution, getNextExecution },
) => {
  if (execution.skipped) {
    const skipReason = execution.skipReason;
    const prev = getPreviousExecution(execution);
    if (prev && prev.skipped && prev.skipReason === skipReason) {
      return "";
    }
    let nextExecutionSkippedWithSameReason = 0;
    let next = getNextExecution(execution);
    while (next) {
      if (!next.skipped || next.skipReason !== skipReason) {
        break;
      }
      nextExecutionSkippedWithSameReason++;
      next = getNextExecution(next);
    }
    if (nextExecutionSkippedWithSameReason) {
      const skippedGroupLog = descriptionFormatters.skippedGroup({
        from: execution.index,
        to: execution.index + nextExecutionSkippedWithSameReason,
        skipReason,
      });
      return `${skippedGroupLog}\n`;
    }
  }

  let log = "";
  // label
  {
    const label = renderExecutionLabel(execution, logOptions);
    log += label;
  }
  // console calls
  {
    const { consoleCalls = [] } = execution.result;
    const consoleOutput = renderConsole(consoleCalls);
    if (consoleOutput) {
      log += `\n${consoleOutput}`;
    }
  }
  // errors
  {
    const errorOutput = renderErrors(execution, logOptions);
    if (errorOutput) {
      log += `\n${errorOutput}`;
    }
  }
  // const { columns = 80 } = process.stdout;
  // log = wrapAnsi(log, columns, {
  //   trim: false,
  //   hard: true,
  //   wordWrap: false,
  // });
  return `${log}\n`;
};

const renderExecutionLabel = (execution, logOptions) => {
  let label = "";

  // description
  {
    const description = descriptionFormatters[execution.result.status](
      execution,
      logOptions,
    );
    label += description;
  }
  // runtimeInfo
  {
    const infos = [];
    if (logOptions.group) {
      infos.push(ANSI.color(execution.group, ANSI.GREY));
    }
    const { timings, memoryUsage } = execution.result;
    if (timings) {
      const duration = timings.executionEnd - timings.executionStart;
      if (logOptions.mockFluctuatingValues) {
        infos.push(ANSI.color(`<mock>ms`, ANSI.GREY));
      } else {
        let color = ANSI.GREY;
        if (duration > 0.8 * execution.params.allocatedMs) {
          color = ANSI.YELLOW;
        } else if (duration > 0.3 * execution.params.allocatedMs) {
          color = null;
        }
        infos.push(
          ANSI.color(humanizeDuration(duration, { short: true }), color),
        );
      }
    }
    if (logOptions.memoryUsage && typeof memoryUsage === "number") {
      if (logOptions.mockFluctuatingValues) {
        infos.push(ANSI.color(`<mock>MB`, ANSI.GREY));
      } else {
        infos.push(
          ANSI.color(humanizeMemory(memoryUsage, { short: true }), ANSI.GREY),
        );
      }
    }
    if (infos.length) {
      const runtimeInfo = infos.join(ANSI.color(`/`, ANSI.GREY));
      label += ` ${ANSI.color("[", ANSI.GREY)}${runtimeInfo}${ANSI.color(
        "]",
        ANSI.GREY,
      )}`;
    }
  }
  // intersummary
  if (
    logOptions.intermediateSummary ||
    execution.counters.timedout ||
    execution.counters.failed
  ) {
    let intermediateSummary = "";
    intermediateSummary += renderStatusRepartition(execution.countersInOrder);
    label += ` (${intermediateSummary})`;
  }

  return label;
};
const descriptionFormatters = {
  executing: ({ fileRelativeUrl }, { applyColorOnFileRelativeUrl }) => {
    return applyColorOnFileRelativeUrl(fileRelativeUrl, COLOR_EXECUTING);
  },
  skippedGroup: ({ from, to, skipReason }) => {
    let description = `${UNICODE.CIRCLE_DOTTED_RAW} ${from + 1}:${to + 1} skipped`;
    if (skipReason) {
      description += ` (${skipReason})`;
    }
    return ANSI.color(description, COLOR_SKIPPED);
  },
  skipped: (
    { index, countersInOrder, fileRelativeUrl, skipReason },
    { applyColorOnFileRelativeUrl },
  ) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total, "0");
    let skipped = ANSI.color(
      `${UNICODE.CIRCLE_DOTTED_RAW} ${number}`,
      COLOR_SKIPPED,
    );
    skipped += ANSI.color(`/${total}`, COLOR_SKIPPED);
    skipped += " ";
    skipped += ANSI.color("skipped", COLOR_SKIPPED);
    skipped += " ";
    skipped += applyColorOnFileRelativeUrl(fileRelativeUrl, COLOR_SKIPPED);
    if (skipReason) {
      skipped += " ";
      skipped += ANSI.color(`(${skipReason})`, COLOR_SKIPPED);
    }
    return skipped;
  },
  aborted: (
    { index, countersInOrder, fileRelativeUrl },
    { applyColorOnFileRelativeUrl },
  ) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total, "0");
    let aborted = ANSI.color(`${UNICODE.FAILURE_RAW} ${number}`, COLOR_ABORTED);
    aborted += ANSI.color(`/${total}`, COLOR_ABORTED);
    aborted += " ";
    aborted += applyColorOnFileRelativeUrl(fileRelativeUrl, COLOR_ABORTED);
    return aborted;
  },
  cancelled: (
    { index, countersInOrder, fileRelativeUrl },
    { applyColorOnFileRelativeUrl },
  ) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total, "0");
    let cancelled = ANSI.color(
      `${UNICODE.FAILURE_RAW} ${number}`,
      COLOR_CANCELLED,
    );
    cancelled += ANSI.color(`/${total}`, COLOR_CANCELLED);
    cancelled += " ";
    cancelled += applyColorOnFileRelativeUrl(fileRelativeUrl, COLOR_CANCELLED);
    return cancelled;
  },
  timedout: (
    { index, countersInOrder, fileRelativeUrl, params },
    { applyColorOnFileRelativeUrl },
  ) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total, "0");
    let timedout = ANSI.color(
      `${UNICODE.FAILURE_RAW} ${number}`,
      COLOR_TIMEOUT,
    );
    timedout += ANSI.color(`/${total}`, COLOR_TIMEOUT);
    timedout += " ";
    timedout += applyColorOnFileRelativeUrl(fileRelativeUrl, COLOR_TIMEOUT);
    timedout += " ";
    timedout += ANSI.color(
      `timeout after ${params.allocatedMs}ms`,
      COLOR_TIMEOUT,
    );
    return timedout;
  },
  failed: (
    { index, countersInOrder, fileRelativeUrl },
    { applyColorOnFileRelativeUrl },
  ) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total, "0");
    let failed = ANSI.color(`${UNICODE.FAILURE_RAW} ${number}`, COLOR_FAILED);
    failed += ANSI.color(`/${total}`, COLOR_FAILED);
    failed += " ";
    failed += applyColorOnFileRelativeUrl(fileRelativeUrl, COLOR_FAILED);
    return failed;
  },
  completed: (
    { index, countersInOrder, fileRelativeUrl },
    { applyColorOnFileRelativeUrl },
  ) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total, "0");
    let completed = ANSI.color(`${UNICODE.OK_RAW} ${number}`, COLOR_COMPLETED);
    completed += ANSI.color(`/${total}`, COLOR_COMPLETED);
    completed += " ";
    completed += applyColorOnFileRelativeUrl(fileRelativeUrl, COLOR_COMPLETED);
    return completed;
  },
};

const COLOR_EXECUTING = ANSI.BLUE;
const COLOR_SKIPPED = ANSI.GREY;
const COLOR_ABORTED = ANSI.MAGENTA;
const COLOR_CANCELLED = ANSI.GREY;
const COLOR_TIMEOUT = ANSI.MAGENTA;
const COLOR_FAILED = ANSI.RED;
const COLOR_COMPLETED = ANSI.GREEN;
const fillLeft = (value, biggestValue, char = " ") => {
  const width = String(value).length;
  const biggestWidth = String(biggestValue).length;
  let missingWidth = biggestWidth - width;
  let padded = "";
  while (missingWidth--) {
    padded += char;
  }
  padded += value;
  return padded;
};
// const fillRight = (value, biggestValue, char = " ") => {
//   const width = String(value).length;
//   const biggestWidth = String(biggestValue).length;
//   let missingWidth = biggestWidth - width;
//   let padded = "";
//   padded += value;
//   while (missingWidth--) {
//     padded += char;
//   }
//   return padded;
// };

const renderConsole = (consoleCalls) => {
  if (consoleCalls.length === 0) {
    return "";
  }
  const consoleRepartition = {
    debug: 0,
    info: 0,
    warning: 0,
    error: 0,
    log: 0,
  };
  consoleCalls.forEach((consoleCall) => {
    consoleRepartition[consoleCall.type]++;
  });
  const consoleOutput = renderConsoleOutput(consoleCalls);
  const consoleSummary = renderConsoleSummary(consoleRepartition);
  return renderSection({
    title: consoleSummary,
    content: consoleOutput,
  });
};
const renderConsoleSummary = (consoleRepartition) => {
  const { debug, info, warning, error } = consoleRepartition;
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
const renderConsoleOutput = (consoleCalls) => {
  // inside Node.js you can do process.stdout.write()
  // and in that case the consoleCall is not suffixed with "\n"
  // we want to keep these calls together in the output
  const regroupedCalls = [];
  let everyCallIsLog = true;
  consoleCalls.forEach((consoleCall, index) => {
    if (everyCallIsLog && consoleCall.type !== "log") {
      everyCallIsLog = false;
    }
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
  let index = 0;
  for (const regroupedCall of regroupedCalls) {
    const text = regroupedCall.text;
    const textFormatted = prefixFirstAndIndentRemainingLines({
      prefix: everyCallIsLog ? "" : CONSOLE_ICONS[regroupedCall.type],
      text,
      trimLines: false,
      trimLastLine: index === regroupedCalls.length - 1,
    });
    consoleOutput += textFormatted;
    index++;
  }
  return consoleOutput;
};
const prefixFirstAndIndentRemainingLines = ({
  prefix,
  indentation,
  text,
  trimLines,
  trimLastLine,
}) => {
  const lines = text.split(/\r?\n/);
  const firstLine = lines.shift();
  if (indentation === undefined) {
    if (prefix) {
      indentation = "  "; // prefix + space
    } else {
      indentation = "";
    }
  }
  let result = prefix ? `${prefix} ${firstLine}` : firstLine;
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
  get debug() {
    return UNICODE.DEBUG;
  },
  get info() {
    return UNICODE.INFO;
  },
  get warning() {
    return UNICODE.WARNING;
  },
  get error() {
    return UNICODE.FAILURE;
  },
  log: " ",
};

const renderErrors = (execution, logOptions) => {
  const { errors = [] } = execution.result;
  if (errors.length === 0) {
    return "";
  }

  if (errors.length === 1) {
    return renderSection({
      dashColor: ANSI.GREY,
      title: "error",
      content: formatErrorForTerminal(errors[0], {
        rootDirectoryUrl: execution.rootDirectoryUrl,
        mainFileRelativeUrl: execution.fileRelativeUrl,
        mockFluctuatingValues: logOptions.mockFluctuatingValues,
        tryColors: true,
      }),
    });
  }

  let output = [];
  errors.forEach((error) => {
    output.push(
      prefixFirstAndIndentRemainingLines({
        prefix: `${UNICODE.CIRCLE_CROSS} `,
        indentation: "   ",
        text: formatErrorForTerminal(error, {
          rootDirectoryUrl: execution.rootDirectoryUrl,
          mainFileRelativeUrl: execution.fileRelativeUrl,
          mockFluctuatingValues: logOptions.mockFluctuatingValues,
          tryColors: true,
        }),
      }),
    );
  });
  return renderSection({
    dashColor: ANSI.GREY,
    title: `errors (${errors.length})`,
    content: output.join(`\n`),
  });
};

const renderOutro = (testPlanResult, logOptions = {}) => {
  const { counters } = testPlanResult;
  const { planified } = counters;
  if (planified === 0) {
    return "";
  }
  let title;
  if (planified === 0) {
    title = `no execution`;
  } else if (planified === 1) {
    title = `1 execution done`;
  } else {
    title = `${planified} executions done`;
  }
  return `${renderBigSection({
    title,
    content: renderOutroContent(testPlanResult, logOptions),
  })}\n`;
};

const renderOutroContent = (testPlanResult, logOptions = {}) => {
  const lines = [];
  const { counters } = testPlanResult;

  let executionLine = `status: ${renderStatusRepartition(counters)}`;
  lines.push(executionLine);

  let durationLine = `duration: `;
  const { timings } = testPlanResult;
  if (logOptions.mockFluctuatingValues) {
    durationLine += "<mock>s";
  } else {
    durationLine += humanizeDuration(timings.end, { short: true });
    const namedTimings = {
      setup: humanizeTiming(timings.executionStart),
      execution: humanizeTiming(timings.executionEnd),
      teardown: humanizeTiming(timings.teardownEnd - timings.executionEnd),
      ...(testPlanResult.coverage
        ? {
            coverage: humanizeTiming(
              timings.coverageTeardownEnd - timings.teardownEnd,
            ),
          }
        : {}),
    };
    durationLine += renderDetails(namedTimings);
  }
  lines.push(durationLine);

  if (logOptions.cpuUsage) {
    const processCpuUsage = testPlanResult.cpuUsage.process;
    let cpuUsageLine = "cpu: ";
    cpuUsageLine += `${humanizeProcessCpuUsage(processCpuUsage.end)}`;
    cpuUsageLine += renderDetails({
      med: humanizeProcessCpuUsage(processCpuUsage.median),
      min: humanizeProcessCpuUsage(processCpuUsage.min),
      max: humanizeProcessCpuUsage(processCpuUsage.max),
    });
    lines.push(cpuUsageLine);
  }
  if (logOptions.memoryUsage) {
    const processMemoryUsage = testPlanResult.memoryUsage.process;
    let memoryUsageLine = "memory: ";
    memoryUsageLine += `${humanizeProcessMemoryUsage(processMemoryUsage.end)}`;
    memoryUsageLine += renderDetails({
      med: humanizeProcessMemoryUsage(processMemoryUsage.median),
      min: humanizeProcessMemoryUsage(processMemoryUsage.min),
      max: humanizeProcessMemoryUsage(processMemoryUsage.max),
    });
    lines.push(memoryUsageLine);
  }
  return lines.join("\n");
};

const humanizeTiming = (value) => {
  return humanizeDuration(value, { short: true });
};

const humanizeProcessCpuUsage = (ratio) => {
  const percentageAsNumber = ratio * 100;
  const percentageAsNumberRounded = Math.round(percentageAsNumber);
  const percentage = `${percentageAsNumberRounded}%`;
  return percentage;
};

const humanizeProcessMemoryUsage = (value) => {
  return humanizeMemory(value, { short: true, decimals: 0 });
};

const renderStatusRepartition = (counters, { showProgression } = {}) => {
  if (counters.planified === 0) {
    return ``;
  }
  const areAll = (status) => {
    const counter = counters[status];
    if (showProgression) {
      return counter === counters.planified;
    }
    return counter === counters.executed || counter === counters.planified;
  };
  if (areAll("skipped")) {
    return `all ${ANSI.color(`skipped`, COLOR_SKIPPED)}`;
  }
  if (areAll("aborted")) {
    return `all ${ANSI.color(`aborted`, COLOR_ABORTED)}`;
  }
  if (areAll("cancelled")) {
    return `all ${ANSI.color(`cancelled`, COLOR_CANCELLED)}`;
  }
  if (areAll("timedout")) {
    return `all ${ANSI.color(`timed out`, COLOR_TIMEOUT)}`;
  }
  if (areAll("failed")) {
    return `all ${ANSI.color(`failed`, COLOR_FAILED)}`;
  }
  if (areAll("completed")) {
    return `all ${ANSI.color(`completed`, COLOR_COMPLETED)}`;
  }
  const parts = [];
  if (showProgression) {
    if (counters.executing) {
      parts.push(`${counters.executing} executing`);
    }
    if (counters.waiting) {
      parts.push(`${counters.waiting} waiting`);
    }
  }
  if (counters.timedout) {
    parts.push(
      `${counters.timedout} ${ANSI.color(`timed out`, COLOR_TIMEOUT)}`,
    );
  }
  if (counters.failed) {
    parts.push(`${counters.failed} ${ANSI.color(`failed`, COLOR_FAILED)}`);
  }
  if (counters.completed) {
    parts.push(
      `${counters.completed} ${ANSI.color(`completed`, COLOR_COMPLETED)}`,
    );
  }
  if (counters.aborted) {
    parts.push(`${counters.aborted} ${ANSI.color(`aborted`, COLOR_ABORTED)}`);
  }
  if (counters.cancelled) {
    parts.push(
      `${counters.cancelled} ${ANSI.color(`cancelled`, COLOR_CANCELLED)}`,
    );
  }
  if (counters.skipped) {
    parts.push(`${counters.skipped} ${ANSI.color(`skipped`, COLOR_SKIPPED)}`);
  }
  return `${parts.join(", ")}`;
};

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
  measureMemoryUsage = false,
  onMeasureMemoryAvailable,
  collectPerformance = false,
  coverageEnabled = false,
  coverageTempDirectoryUrl,
  runtime,
  runtimeParams,
}) => {
  if (keepRunning) {
    allocatedMs = Infinity;
  }
  if (allocatedMs === Infinity) {
    allocatedMs = 0;
  }

  const timingsOrigin = Date.now();
  const takeTiming = () => {
    return Date.now() - timingsOrigin;
  };
  const result = {
    status: "pending",
    errors: [],
    namespace: null,
    consoleCalls: null,
    timings: {
      origin: timingsOrigin,
      start: 0,
      runtimeStart: null,
      executionStart: null,
      executionEnd: null,
      runtimeEnd: null,
      end: null,
    },
    memoryUsage: null,
    performance: null,
    coverageFileUrl: null,
  };
  const onConsoleRef = { current: () => {} };
  const stopSignal = { notify: () => {} };
  const runtimeLabel = `${runtime.name}/${runtime.version}`;

  const runOperation = Abort.startOperation();
  runOperation.addAbortSignal(signal);
  let timeoutAbortSource;
  if (allocatedMs) {
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
    result.coverageFileUrl = coverageFileUrl;
    // written within the child_process/worker_thread or during runtime.run()
    // for browsers
    // (because it takes time to serialize and transfer the coverage object)
  }

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
            let runtimeStatus = "starting";
            try {
              const runResult = await runtime.run({
                signal: runOperation.signal,
                logger,
                ...runtimeParams,
                collectConsole,
                measureMemoryUsage,
                onMeasureMemoryAvailable,
                collectPerformance,
                coverageFileUrl,
                keepRunning,
                stopSignal,
                onConsole: (log) => onConsoleRef.current(log),
                onRuntimeStarted: () => {
                  runtimeStatus = "started";
                  result.timings.runtimeStart = takeTiming();
                },
                onRuntimeStopped: () => {
                  if (runtimeStatus === "stopped") return; // ignore double calls
                  runtimeStatus = "stopped";
                  result.timings.runtimeEnd = takeTiming();
                },
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
    const {
      status,
      errors,
      namespace,
      timings = {},
      memoryUsage,
      performance,
    } = winner.data;
    result.status = status;
    for (let error of errors) {
      const errorProxy = normalizeRuntimeError(error);
      result.errors.push(errorProxy);
    }
    result.namespace = namespace;
    if (timings && typeof timings.start === "number") {
      const diff = timings.origin - result.timings.origin;
      result.timings.executionStart = timings.start + diff;
      result.timings.executionEnd = timings.end + diff;

      if (result.timings.executionStart < result.timings.runtimeStart) {
        // can happen for browsers where navigationStart can be earlier
        // than when node.js calls runtimeStarted()
        result.timings.runtimeStart = result.timings.executionStart;
      }
    }
    result.memoryUsage =
      typeof memoryUsage === "number"
        ? memoryUsage < 0
          ? 0
          : memoryUsage
        : memoryUsage;
    result.performance = performance;
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
    result.timings.end = takeTiming();
    return result;
  }
};
const normalizeRuntimeError = (runtimeError) => {
  // the goal here is to obtain a "regular error"
  // that can be thrown using "throw" keyword
  // so we wrap the error hapenning inside the runtime
  // into "errorProxy" and put .stack property on it
  // the other properties are set by defineProperty so they are not enumerable
  // otherwise they would pollute the error displayed by Node.js
  const errorProxy = new Error(runtimeError.message);
  const exception = createException(runtimeError); // in case it was not done
  for (const ownPropertyName of Object.getOwnPropertyNames(exception)) {
    Object.defineProperty(errorProxy, ownPropertyName, {
      writable: true,
      configurable: true,
      value: exception[ownPropertyName],
    });
  }
  errorProxy.name = exception.name;
  errorProxy.stack = exception.stack;
  return errorProxy;
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
  { signal, allocatedMs, logger, teardownCallbackSet, shell = true },
) => {
  const spawnedProcess = spawn(webServer.command, webServer.args || [], {
    // On non-windows platforms, `detached: true` makes child process a leader of a new
    // process group, making it possible to kill child process tree with `.kill(-pid)` command.
    // @see https://nodejs.org/api/child_process.html#child_process_options_detached
    detached: process.platform !== "win32",
    stdio: ["pipe", "pipe", "pipe"],
    shell,
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
  let isAbort = false;
  let isTeardown = false;
  let processClosed = false;
  spawnedProcess.stderr.on("data", (data) => {
    logger.error(String(data));
  });
  const closedPromise = new Promise((resolve) => {
    spawnedProcess.once("exit", (exitCode, signal) => {
      processClosed = true;
      if (isAbort || isTeardown) {
        logger.debug(
          `web server process exit exitCode=${exitCode}, exitSignal=${signal}, pid=${spawnedProcess.pid}`,
        );
      } else {
        logger.error(
          `web server process premature exit exitCode=${exitCode}, exitSignal=${signal}, pid=${spawnedProcess.pid}`,
        );
      }
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
  startOperation.addAbortCallback(async () => {
    isAbort = true;
    await killProcess();
  });
  teardownCallbackSet.add(async () => {
    isTeardown = true;
    await killProcess();
  });

  const startedPromise = (async () => {
    const logScale = [100, 250, 500];
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
          `"${webServer.command}" command did not start a server at ${webServer.origin} in less than ${allocatedMs}ms`,
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

const startServerUsingModuleUrl = async (
  webServer,
  { ignoreProcessExecArgv, ...params },
) => {
  if (!existsSync(new URL(webServer.moduleUrl))) {
    throw new Error(`"${webServer.moduleUrl}" does not lead to a file`);
  }
  let command = `node`;
  if (!ignoreProcessExecArgv && process.execArgv.length > 0) {
    command += ` ${process.execArgv.join(" ")}`;
  }
  command += ` ${fileURLToPath(webServer.moduleUrl)}`;

  return startServerUsingCommand(
    {
      ...webServer,
      command,
      args: ["--jsenv-test"],
    },
    params,
  );
};

const assertAndNormalizeWebServer = async (
  webServer,
  { signal, logger, teardownCallbackSet },
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
    teardownCallbackSet,
    logger,
  });
  const serverJsonResponse = await basicFetch(
    `${webServer.origin}/.internal/server.json`,
    {
      method: "GET",
      rejectUnauthorized: false,
    },
  );
  if (
    serverJsonResponse.status === 200 &&
    String(serverJsonResponse.headers["server"]).includes("jsenv_dev_server")
  ) {
    webServer.isJsenvDevServer = true;
    if (webServer.rootDirectoryUrl === undefined) {
      const jsenvDevServerParams = await serverJsonResponse.json();
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
  {
    signal,
    teardownCallbackSet,
    logger,
    allocatedMs = 5_000,
    ignoreProcessExecArgv,
  },
) => {
  const aServerIsListening = await pingServer(webServer.origin);
  if (aServerIsListening) {
    return;
  }
  if (webServer.moduleUrl) {
    await startServerUsingModuleUrl(webServer, {
      ignoreProcessExecArgv,
      signal,
      allocatedMs,
      teardownCallbackSet,
      logger,
    });
    return;
  }
  if (webServer.command) {
    await startServerUsingCommand(webServer, {
      signal,
      allocatedMs,
      teardownCallbackSet,
      logger,
    });
    return;
  }
  throw new TypeError(
    `webServer.moduleUrl or webServer.command is required as there is no server listening "${webServer.origin}"`,
  );
};

/*
 *
 */


/**
 * Execute a list of files and log how it goes.
 * @param {Object} testPlanParameters
 * @param {string|url} testPlanParameters.rootDirectoryUrl Directory containing test files;
 * @param {Object} [testPlanParameters.webServer] Web server info; required when executing test on browsers
 * @param {Object} testPlanParameters.testPlan Object associating files with runtimes where they will be executed
 * @param {Object|false} [testPlanParameters.parallel] Maximum amount of execution running at the same time
 * @param {number} [testPlanParameters.defaultMsAllocatedPerExecution=30000] Milliseconds after which execution is aborted and considered as failed by timeout
 * @param {boolean} [testPlanParameters.failFast=false] Fails immediatly when a test execution fails
 * @param {Object|false} [testPlanParameters.coverage=false] Controls if coverage is collected during files executions
 * @return {Object} An object containing the result of all file executions
 */
const logsDefault = {
  level: "info",
  type: "list",
  animated: true,
  platformInfo: false, // maybe true as long as not executed by npm workspace?
  memoryUsage: false,
  cpuUsage: false,
  fileUrl: undefined,
};
const githubCheckDefault = {
  logLevel: "info",
  name: "Jsenv tests",
  title: "Tests execution",
  token: undefined,
  repositoryOwner: undefined,
  repositoryName: undefined,
  commitSha: undefined,
};
const coverageDefault = {
  include: {
    "./**/*.js": true,
    "./**/*.ts": true,
    "./**/*.jsx": true,
    "./**/*.tsx": true,
    "file:///**/node_modules/": false,
    "./**/.*": false,
    "./**/.*/": false,
    "./**/tests/": false,
    "./**/*.test.html": false,
    "./**/*.test.html@*.js": false,
    "./**/*.test.js": false,
    "./**/*.test.mjs": false,
  },
  includeMissing: true,
  coverageAndExecutionAllowed: false,
  methodForNodeJs: process.env.NODE_V8_COVERAGE
    ? "NODE_V8_COVERAGE"
    : "Profiler",
  // - When chromium only -> coverage generated by v8
  // - When chromium + node -> coverage generated by v8 are merged
  // - When firefox only -> coverage generated by babel+istanbul
  // - When chromium + firefox
  //   -> by default only coverage from chromium is used
  //   and a warning is logged according to coverageV8ConflictWarning
  //   -> to collect coverage from both browsers, pass coverageMethodForBrowsers: "istanbul"
  methodForBrowsers: undefined, // undefined | "playwright" | "istanbul"
  v8ConflictWarning: true,
  tempDirectoryUrl: undefined,
};
const parallelDefault = {
  max: "80%", // percentage resolved against the available cpus
  maxCpu: "80%",
  maxMemory: "50%",
};

const executeTestPlan = async ({
  logs = logsDefault,

  rootDirectoryUrl,
  webServer,
  testPlan,

  signal = new AbortController().signal,
  handleSIGINT = true,
  handleSIGUP = true,
  handleSIGTERM = true,
  updateProcessExitCode = true,
  parallel = parallelDefault,
  // https://github.com/avajs/ava/blob/main/docs/recipes/splitting-tests-ci.md
  // https://playwright.dev/docs/test-sharding
  fragment,
  fragmentByRuntime,
  fragmentBy,
  defaultMsAllocatedPerExecution = 30_000,
  failFast = false,
  // keepRunning: false to ensure runtime is stopped once executed
  // because we have what we wants: execution is completed and
  // we have associated coverage and console output
  // passsing true means all node process and browsers launched stays opened
  // (can eventually be used for debug)
  keepRunning = false,

  githubCheck = process.argv.includes("--github-check") &&
  process.env.GITHUB_WORKFLOW
    ? githubCheckDefault
    : null,
  coverage = process.argv.includes("--coverage") ? coverageDefault : null,

  reporters = [],
  ...rest
}) => {
  const teardownCallbackSet = new Set();

  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  if (handleSIGINT || handleSIGUP || handleSIGTERM) {
    operation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: handleSIGINT,
          SIGHUP: handleSIGUP,
          SIGTERM: handleSIGTERM,
        },
        ({ name }) => {
          console.log(`${name} -> abort`);
          abort();
        },
      );
    });
  }

  const cpuMonitoring = startMonitoringCpuUsage();
  operation.addEndCallback(cpuMonitoring.stop);
  const [processCpuUsageMonitoring, osCpuUsageMonitoring] = cpuMonitoring;
  const memoryMonitoring = startMonitoringMemoryUsage();
  const [processMemoryUsageMonitoring, osMemoryUsageMonitoring] =
    memoryMonitoring;

  const interval = setInterval(() => {
    processCpuUsageMonitoring.measure();
    processMemoryUsageMonitoring.measure();
  }, 500).unref();
  operation.addEndCallback(() => {
    clearInterval(interval);
  });

  const timingsOrigin = Date.now();
  const takeTiming = () => {
    return Date.now() - timingsOrigin;
  };
  const testPlanResult = {
    os: {
      name:
        process.platform === "darwin"
          ? "mac"
          : process.platform === "win32" || process.platform === "win64"
            ? "windows"
            : process.platform === "linux"
              ? "linux"
              : "other",
      version: getOsVersion(),
      availableCpu: countAvailableCpus(),
      availableMemory: getAvailableMemory(),
    },
    runtime: {
      name: "node",
      version: process.version.slice(1),
    },
    memoryUsage: {
      os: osMemoryUsageMonitoring.info,
      process: processMemoryUsageMonitoring.info,
    },
    cpuUsage: {
      os: osCpuUsageMonitoring.info,
      process: processCpuUsageMonitoring.info,
    },
    timings: {
      origin: timingsOrigin,
      executionStart: null,
      executionEnd: null,
      teardownEnd: null,
      coverageTeardownEnd: null,
      end: null,
    },
    rootDirectoryUrl: String(rootDirectoryUrl),
    patterns: Object.keys(testPlan),
    groups: {},
    fragment,
    fragmentStart: undefined,
    fragmentEnd: undefined,
    counters: {
      planified: 0,
      remaining: 0,
      waiting: 0,
      executing: 0,
      executed: 0,

      skipped: 0,
      aborted: 0,
      cancelled: 0,
      timedout: 0,
      failed: 0,
      completed: 0,
    },
    aborted: false,
    failed: false,
    coverage: null,
    results: {},
  };
  const timings = testPlanResult.timings;
  const groups = testPlanResult.groups;
  const counters = testPlanResult.counters;
  const countersInOrder = { ...counters };
  const results = testPlanResult.results;

  const warnCallbackSet = new Set();
  const warn = (warning) => {
    if (warnCallbackSet.size === 0) {
      console.warn(warning.message);
    } else {
      for (const warnCallback of warnCallbackSet) {
        warnCallback(warning);
      }
    }
  };
  const beforeEachCallbackSet = new Set();
  const beforeEachInOrderCallbackSet = new Set();
  const triggerBeforeEach = (execution, testPlanResult, testPlanHelpers) => {
    for (const beforeEachCallback of beforeEachCallbackSet) {
      const returnValue = beforeEachCallback(
        execution,
        testPlanResult,
        testPlanHelpers,
      );
      if (typeof returnValue === "function") {
        const callback = (...args) => {
          afterEachCallbackSet.delete(callback);
          return returnValue(...args);
        };
        afterEachCallbackSet.add(callback);
      }
    }
    for (const beforeEachInOrderCallback of beforeEachInOrderCallbackSet) {
      const returnValue = beforeEachInOrderCallback(
        execution,
        testPlanResult,
        testPlanHelpers,
      );
      if (typeof returnValue === "function") {
        const callback = (...args) => {
          afterEachInOrderCallbackSet.delete(callback);
          return returnValue(...args);
        };
        afterEachInOrderCallbackSet.add(callback);
      }
    }
  };
  const afterEachCallbackSet = new Set();
  const afterEachInOrderCallbackSet = new Set();
  const afterAllCallbackSet = new Set();
  let finalizeCoverage;

  try {
    let logger;
    const runtimeInfo = {
      someNeedsServer: false,
      someHasCoverageV8: false,
      someNodeRuntime: false,
    };
    // param validation and normalization
    {
      const unexpectedParamNames = Object.keys(rest);
      if (unexpectedParamNames.length > 0) {
        throw new TypeError(`${unexpectedParamNames.join(",")}: no such param`);
      }
      // logs
      {
        if (typeof logs !== "object") {
          throw new TypeError(`logs must be an object, got ${logs}`);
        }
        const unexpectedLogsKeys = Object.keys(logs).filter(
          (key) => !Object.hasOwn(logsDefault, key),
        );
        if (unexpectedLogsKeys.length > 0) {
          throw new TypeError(
            `${unexpectedLogsKeys.join(",")}: no such key on logs`,
          );
        }
        logs = { ...logsDefault, ...logs };
        logger = createLogger({ logLevel: logs.level });

        if (logs.type === "list" && logger.levels.info) {
          const listReporterOptions = {
            mockFluctuatingValues: logs.mockFluctuatingValues,
            platformInfo: logs.platformInfo,
            memoryUsage: logs.memoryUsage,
            cpuUsage: logs.cpuUsage,
            animated: logger.levels.debug ? false : logs.animated,
            fileUrl:
              logs.fileUrl === undefined
                ? new URL("./.jsenv/jsenv_tests_output.txt", rootDirectoryUrl)
                : logs.fileUrl,
          };
          reporters.push(reporterList(listReporterOptions));
        }
      }
      // rootDirectoryUrl
      {
        rootDirectoryUrl = assertAndNormalizeDirectoryUrl(
          rootDirectoryUrl,
          "rootDirectoryUrl",
        );
        if (!existsSync(new URL(rootDirectoryUrl))) {
          throw new Error(`ENOENT on rootDirectoryUrl at ${rootDirectoryUrl}`);
        }
      }
      // parallel
      {
        if (parallel === true) {
          parallel = {};
        }
        if (parallel === false) {
          parallel = { max: 1 };
        }
        if (typeof parallel !== "object") {
          throw new TypeError(`parallel must be an object, got ${parallel}`);
        }
        const unexpectedParallelKeys = Object.keys(parallel).filter(
          (key) => !Object.hasOwn(parallelDefault, key),
        );
        if (unexpectedParallelKeys.length > 0) {
          throw new TypeError(
            `${unexpectedParallelKeys.join(",")}: no such key on parallel`,
          );
        }
        parallel = { ...parallelDefault, ...parallel };
        const assertPercentageAndConvertToRatio = (string) => {
          const lastChar = string[string.length - 1];
          if (lastChar !== "%") {
            throw new TypeError(`string is not a percentage, got ${string}`);
          }
          const percentageString = string.slice(0, -1);
          const percentageNumber = parseInt(percentageString);
          if (percentageNumber <= 0) {
            return 0;
          }
          if (percentageNumber >= 100) {
            return 1;
          }
          const ratio = percentageNumber / 100;
          return ratio;
        };
        const max = parallel.max;
        if (typeof max === "string") {
          const maxAsRatio = assertPercentageAndConvertToRatio(max);
          parallel.max =
            Math.round(maxAsRatio * testPlanResult.os.availableCpu) || 1;
        } else if (typeof max === "number") {
          if (max < 1) {
            parallel.max = 1;
          }
        } else {
          throw new TypeError(
            `parallel.max must be a number or a percentage, got ${max}`,
          );
        }

        const maxMemory = parallel.maxMemory;
        if (typeof maxMemory === "string") {
          const maxMemoryAsRatio = assertPercentageAndConvertToRatio(maxMemory);
          parallel.maxMemory = Math.round(
            maxMemoryAsRatio * testPlanResult.os.availableMemory,
          );
        } else if (typeof maxMemory !== "number") {
          throw new TypeError(
            `parallel.maxMemory must be a number or a percentage, got ${maxMemory}`,
          );
        }

        const maxCpu = parallel.maxCpu;
        if (typeof maxCpu === "string") {
          const maxCpuAsRatio = assertPercentageAndConvertToRatio(maxCpu);
          parallel.maxCpu = maxCpuAsRatio;
        } else if (typeof maxCpu !== "number") {
          throw new TypeError(
            `parallel.maxCpu must be a number or a percentage, got ${maxCpu}`,
          );
        }
      }
      // fragment/fragmentByRuntime
      {
        if (fragment) {
          if (!/[0-9]+\/[0-9]+/.test(fragment)) {
            throw new TypeError(
              `fragment must look like number/number, received ${fragment}`,
            );
          }
        }
      }
      // testPlan
      {
        if (typeof testPlan !== "object") {
          throw new Error(`testPlan must be an object, got ${testPlan}`);
        }
        for (const filePattern of Object.keys(testPlan)) {
          const filePlan = testPlan[filePattern];
          if (!filePlan) continue;
          for (const executionName of Object.keys(filePlan)) {
            const executionConfig = filePlan[executionName];
            if (executionConfig === null) {
              continue;
            }
            const { runtime } = executionConfig;
            if (!runtime || runtime.disabled) {
              continue;
            }
            if (runtime.type === "browser") {
              if (runtime.capabilities && runtime.capabilities.coverageV8) {
                runtimeInfo.someHasCoverageV8 = true;
              }
              runtimeInfo.someNeedsServer = true;
            }
            if (runtime.type === "node") {
              runtimeInfo.someNodeRuntime = true;
            }
          }
        }
        testPlan = {
          "file:///**/node_modules/": null,
          ...testPlan,
          "**/.*/": null,
          "**/.jsenv/": null, // ensure it's impossible to look for ".jsenv/"
        };
      }
      // webServer
      if (runtimeInfo.someNeedsServer) {
        if (webServer.start) {
          webServer = await webServer.start();
        }
        await assertAndNormalizeWebServer(webServer, {
          signal: operation.signal,
          teardownCallbackSet,
          logger,
        });
      }
      // githubCheck
      {
        if (githubCheck && !process.env.GITHUB_TOKEN) {
          githubCheck = false;
          const suggestions = [];
          if (process.env.GITHUB_WORKFLOW_REF) {
            const workflowFileRef = process.env.GITHUB_WORKFLOW_REF;
            const refsIndex = workflowFileRef.indexOf("@refs/");
            // see "GITHUB_WORKFLOW_REF" in https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
            const workflowFilePath =
              refsIndex === -1
                ? workflowFileRef
                : workflowFileRef.slice(0, refsIndex);
            suggestions.push(`Pass github token in ${workflowFilePath} during job "${process.env.GITHUB_JOB}"
\`\`\`yml
env:
  GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
\`\`\``);
          }
          suggestions.push(`Disable github check with githubCheck: false`);
          logger.warn(
            `${UNICODE.WARNING} githubCheck requires process.env.GITHUB_TOKEN.
Integration with Github check API is disabled
To fix this warning:
- ${suggestions.join("\n- ")}
`,
          );
        }
        if (githubCheck) {
          if (githubCheck === true) {
            githubCheck = {};
          }
          if (typeof githubCheck !== "object") {
            throw new TypeError(
              `githubCheck must be an object, got ${githubCheck}`,
            );
          }
          const unexpectedKeys = Object.keys(githubCheck).filter(
            (key) => !Object.hasOwn(githubCheckDefault, key),
          );
          if (unexpectedKeys.length > 0) {
            throw new TypeError(
              `${unexpectedKeys.join(",")}: no such key on githubCheck`,
            );
          }

          const githubCheckInfoFromEnv = process.env.GITHUB_WORKFLOW
            ? readGitHubWorkflowEnv()
            : {};
          githubCheck = { ...githubCheckDefault, githubCheck };
          if (githubCheck.token === undefined) {
            githubCheck.token = githubCheckInfoFromEnv.githubToken;
          }
          if (githubCheck.repositoryOwner === undefined) {
            githubCheck.repositoryOwner =
              githubCheckInfoFromEnv.repositoryOwner;
          }
          if (githubCheck.repositoryName === undefined) {
            githubCheck.repositoryName = githubCheckInfoFromEnv.repositoryName;
          }
          if (githubCheck.commitSha === undefined) {
            githubCheck.commitSha = githubCheckInfoFromEnv.commitSha;
          }
        }
      }
      // coverage
      if (coverage) {
        if (coverage === true) {
          coverage = {};
        }
        if (typeof coverage !== "object") {
          throw new TypeError(`coverage must be an object, got ${coverage}`);
        }
        const unexpectedKeys = Object.keys(coverage).filter(
          (key) => !Object.hasOwn(coverageDefault, key),
        );
        if (unexpectedKeys.length > 0) {
          throw new TypeError(
            `${unexpectedKeys.join(",")}: no such key on coverage`,
          );
        }
        coverage = { ...coverageDefault, ...coverage };
        if (typeof coverage.include !== "object") {
          throw new TypeError(
            `coverage.include must be an object, got ${coverage.include}`,
          );
        }
        if (Object.keys(coverage.include).length === 0) {
          logger.warn(
            `coverage.include is an empty object. Nothing will be instrumented for coverage so your coverage will be empty`,
          );
        }
        if (coverage.methodForBrowsers === undefined) {
          coverage.methodForBrowsers = runtimeInfo.someHasCoverageV8
            ? "playwright"
            : "istanbul";
        }
        if (
          runtimeInfo.someNodeRuntime &&
          coverage.methodForNodeJs === "NODE_V8_COVERAGE"
        ) {
          if (process.env.NODE_V8_COVERAGE) {
            // when runned multiple times, we don't want to keep previous files in this directory
            await ensureEmptyDirectory(process.env.NODE_V8_COVERAGE);
          } else {
            coverage.methodForNodeJs = "Profiler";
            logger.warn(
              createDetailedMessage(
                `process.env.NODE_V8_COVERAGE is required to generate coverage for Node.js subprocesses`,
                {
                  "suggestion": `set process.env.NODE_V8_COVERAGE`,
                  "suggestion 2": `use coverage.methodForNodeJs: "Profiler". But it means coverage for child_process and worker_thread cannot be collected`,
                },
              ),
            );
          }
        }
        if (!coverage.coverageAndExecutionAllowed) {
          const associationsForExecute = URL_META.resolveAssociations(
            { execute: testPlan },
            "file:///",
          );
          const associationsForCover = URL_META.resolveAssociations(
            { cover: coverage.include },
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
        if (coverage.tempDirectoryUrl === undefined) {
          coverage.tempDirectoryUrl = new URL(
            "./.coverage/tmp/",
            rootDirectoryUrl,
          );
        } else {
          coverage.tempDirectoryUrl = assertAndNormalizeDirectoryUrl(
            coverage.tempDirectoryUrl,
            "coverageTempDirectoryUrl",
          );
        }
      }
    }

    const executionPlanifiedArray = [];
    const getPreviousExecution = (execution) => {
      const index = execution.index;
      return executionPlanifiedArray[index - 1] || null;
    };
    const getNextExecution = (execution) => {
      const index = execution.index;
      return executionPlanifiedArray[index + 1] || null;
    };
    const testPlanHelpers = {
      getPreviousExecution,
      getNextExecution,
    };

    // collect files to execute + fill executionPlanifiedArray
    {
      const fileResultArray = await collectFiles({
        signal,
        directoryUrl: rootDirectoryUrl,
        associations: { testPlan },
        predicate: ({ testPlan }) => testPlan,
      });

      // idéalement dans les logs on aurait un truc comme ceci:
      // --- 100 execution found ---
      // Executing only from 33 to 66 according to fragment: "2/3"

      let onlyWithinUrl;
      if (process.argv.length > 2) {
        const onlyWithin = process.argv[2];
        if (onlyWithin[0] === "@") {
          const resolutionResult = applyNodeEsmResolution({
            specifier: onlyWithin,
            parentUrl: rootDirectoryUrl,
          });
          onlyWithinUrl = resolutionResult.packageDirectoryUrl;
        } else {
          onlyWithinUrl = new URL(onlyWithin, rootDirectoryUrl);
        }
      }

      let index = 0;
      let lastExecution;
      const fileExecutionCountMap = new Map();
      for (const { relativeUrl, meta } of fileResultArray) {
        if (onlyWithinUrl) {
          const fileUrl = new URL(relativeUrl, rootDirectoryUrl).href;
          if (!urlIsInsideOf(fileUrl, onlyWithinUrl)) {
            continue;
          }
        }
        const filePlan = meta.testPlan;
        for (const groupName of Object.keys(filePlan)) {
          const stepConfig = filePlan[groupName];
          if (stepConfig === null || stepConfig === undefined) {
            continue;
          }
          if (typeof stepConfig !== "object") {
            throw new TypeError(
              createDetailedMessage(
                `found unexpected value in plan, they must be object`,
                {
                  ["file relative path"]: relativeUrl,
                  ["group"]: groupName,
                  ["value"]: stepConfig,
                },
              ),
            );
          }
          const {
            runtime,
            runtimeParams,
            allocatedMs = defaultMsAllocatedPerExecution,
            uses,
          } = stepConfig;
          const params = {
            measureMemoryUsage: true,
            measurePerformance: false,
            collectPerformance: false,
            collectConsole: true,
            allocatedMs,
            uses,
            runtime,
            runtimeParams: {
              rootDirectoryUrl,
              webServer,
              teardownCallbackSet,

              coverageEnabled: Boolean(coverage),
              coverageInclude: coverage?.include,
              coverageMethodForBrowsers: coverage?.methodForBrowsers,
              coverageMethodForNodeJs: coverage?.methodForNodeJs,
              isTestPlan: true,
              fileRelativeUrl: relativeUrl,
              ...runtimeParams,
            },
          };
          const runtimeType = runtime.type;
          const runtimeName = runtime.name;
          const runtimeVersion = runtime.version;

          let fileExecutionCount;
          if (fileExecutionCountMap.has(relativeUrl)) {
            fileExecutionCount = fileExecutionCountMap.get(relativeUrl) + 1;
            fileExecutionCountMap.set(relativeUrl, fileExecutionCount);
          } else {
            fileExecutionCount = 1;
            fileExecutionCountMap.set(relativeUrl, fileExecutionCount);
          }

          const execution = {
            name: `${relativeUrl}/${groupName}`,
            counters,
            countersInOrder,
            index,
            isLast: false,
            group: groupName,
            rootDirectoryUrl: String(rootDirectoryUrl),
            fileRelativeUrl: relativeUrl,
            fileExecutionIndex: fileExecutionCount - 1,
            fileExecutionCount: null,
            runtimeType,
            runtimeName,
            runtimeVersion,
            params,
            skipped: false,
            skipReason: "",

            // will be set by run()
            status: "planified",
            result: {},
          };
          if (typeof params.allocatedMs === "function") {
            const allocatedMsResult = params.allocatedMs(execution);
            params.allocatedMs =
              allocatedMsResult === undefined
                ? defaultMsAllocatedPerExecution
                : allocatedMsResult;
          }
          if (typeof params.uses === "function") {
            const usesResult = params.uses(execution);
            params.uses = usesResult;
          }

          lastExecution = execution;
          executionPlanifiedArray.push(execution);
          const existingResults = results[relativeUrl];
          if (existingResults) {
            existingResults[groupName] = execution.result;
          } else {
            results[relativeUrl] = {
              [groupName]: execution.result,
            };
          }
          const existingGroup = groups[groupName];
          if (existingGroup) {
            groups[groupName].count++;
          } else {
            groups[groupName] = {
              count: 1,
              runtimeType,
              runtimeName,
              runtimeVersion,
            };
          }

          if (runtime?.disabled) {
            execution.skipped = true;
            execution.skipReason =
              runtime.disabledReason || "reason not specified";
          } else if (fragmentByRuntime && runtime.name !== fragmentByRuntime) {
            execution.skipped = true;
            execution.skipReason = "runtime disabled";
          } else if (fragmentBy) {
            const fragmentByResult = fragmentBy(execution);
            if (fragmentByResult) {
              execution.skipped = true;
              execution.skipReason =
                typeof fragmentByResult === "string"
                  ? fragmentByResult
                  : `reason not specified`;
            }
          }
          index++;
        }
      }

      if (fragment) {
        const total = executionPlanifiedArray.length;
        const isInsideFragment = createIsInsideFragment(fragment, total);
        for (const execution of executionPlanifiedArray) {
          if (isInsideFragment(execution.index)) {
            const executionNumber = execution.index + 1;
            if (testPlanResult.fragmentStart === undefined) {
              testPlanResult.fragmentStart = executionNumber;
            }
            if (
              testPlanResult.fragmentEnd === undefined ||
              executionNumber > testPlanResult.fragmentEnd
            ) {
              testPlanResult.fragmentEnd = executionNumber;
            }
          } else {
            execution.skipped = true;
          }
        }
      }
      fileResultArray.length = 0;
      fileExecutionCountMap.clear();
      if (lastExecution) {
        lastExecution.isLast = true;
      }
    }

    counters.planified =
      counters.remaining =
      counters.waiting =
        executionPlanifiedArray.length;
    countersInOrder.planified =
      countersInOrder.remaining =
      countersInOrder.waiting =
        executionPlanifiedArray.length;
    if (githubCheck) {
      const githubCheckRun = await startGithubCheckRun({
        logLevel: githubCheck.logLevel,
        githubToken: githubCheck.token,
        repositoryOwner: githubCheck.repositoryOwner,
        repositoryName: githubCheck.repositoryName,
        commitSha: githubCheck.commitSha,
        checkName: githubCheck.name,
        checkTitle: githubCheck.title,
        checkSummary: `${executionPlanifiedArray.length} files will be executed`,
      });
      const annotations = [];
      reporters.push({
        beforeAll: (testPlanResult) => {
          return {
            afterEach: (execution) => {
              const { result } = execution;
              const { errors = [] } = result;
              for (const error of errors) {
                const annotation = githubAnnotationFromError(error, {
                  rootDirectoryUrl,
                  execution,
                });
                annotations.push(annotation);
              }
            },
            afterAll: async () => {
              const title = "Jsenv test results";
              const summaryText = stripAnsi(renderOutroContent(testPlanResult));
              if (testPlanResult.failed) {
                await githubCheckRun.fail({
                  title,
                  summary: summaryText,
                  annotations,
                });
                return;
              }
              await githubCheckRun.pass({
                title,
                summary: summaryText,
                annotations,
              });
            },
          };
        },
      });
    }
    timings.executionStart = takeTiming();
    // execute all
    {
      const failFastAbortController = new AbortController();
      if (failFast) {
        operation.addAbortSignal(failFastAbortController.signal);
      }

      if (coverage) {
        // when runned multiple times, we don't want to keep previous files in this directory
        await ensureEmptyDirectory(coverage.tempDirectoryUrl);
        finalizeCoverage = async () => {
          if (operation.signal.aborted) {
            // don't try to do the coverage stuff
            return;
          }
          try {
            if (coverage.methodForNodeJs === "NODE_V8_COVERAGE") {
              takeCoverage();
              // conceptually we don't need coverage anymore so it would be
              // good to call v8.stopCoverage()
              // but it logs a strange message about "result is not an object"
            }
            const testPlanCoverage = await generateCoverage(testPlanResult, {
              signal: operation.signal,
              logger,
              rootDirectoryUrl,
              coverage,
              warn,
            });
            testPlanResult.coverage = testPlanCoverage;
          } catch (e) {
            if (Abort.isAbortError(e)) {
              return;
            }
            throw e;
          }
        };
      }

      const callWhenPreviousExecutionAreDone = createCallOrderer();

      const executionRemainingSet = new Set(executionPlanifiedArray);
      const executionExecutingSet = new Set();
      const usedTagSet = new Set();
      const start = async (execution) => {
        execution.fileExecutionCount = Object.keys(
          testPlanResult.results[execution.fileRelativeUrl],
        ).length;
        mutateCountersBeforeExecutionStarts(counters, execution);
        mutateCountersBeforeExecutionStarts(countersInOrder, execution);
        executionRemainingSet.delete(execution);
        executionExecutingSet.add(execution);
        triggerBeforeEach(execution, testPlanResult, testPlanHelpers);
        if (execution.skipped) {
          execution.result.status = "skipped";
          execution.result.value = execution.skipReason;
        } else {
          if (execution.params.uses) {
            for (const tagThatWillBeUsed of execution.params.uses) {
              usedTagSet.add(tagThatWillBeUsed);
            }
          }
          execution.status = "executing";
          const executionResult = await run({
            ...execution.params,
            signal: operation.signal,
            logger,
            keepRunning,
            mirrorConsole: false, // might be executed in parallel: log would be a mess to read
            coverageEnabled: Boolean(coverage),
            coverageTempDirectoryUrl: coverage?.tempDirectoryUrl,
          });
          Object.assign(execution.result, executionResult);
          execution.status = "executed";
          if (execution.params.uses) {
            for (const tagNoLongerInUse of execution.params.uses) {
              usedTagSet.delete(tagNoLongerInUse);
            }
          }
          if (execution.result.status !== "completed") {
            testPlanResult.failed = true;
            if (updateProcessExitCode) {
              process.exitCode = 1;
            }
          }
        }
        mutateCountersAfterExecutionEnds(counters, execution);
        executionExecutingSet.delete(execution);
        for (const afterEachCallback of afterEachCallbackSet) {
          afterEachCallback(execution, testPlanResult, testPlanHelpers);
        }
        callWhenPreviousExecutionAreDone(execution.index, () => {
          mutateCountersAfterExecutionEnds(countersInOrder, execution);
          for (const afterEachInOrderCallback of afterEachInOrderCallbackSet) {
            afterEachInOrderCallback(
              execution,
              testPlanResult,
              testPlanHelpers,
            );
          }
        });
        if (testPlanResult.failed && failFast && counters.remaining) {
          logger.info(`"failFast" enabled -> cancel remaining executions`);
          failFastAbortController.abort();
          return;
        }
      };
      const startAsMuchAsPossible = async () => {
        operation.throwIfAborted();
        const promises = [];
        for (const executionCandidate of executionRemainingSet) {
          if (executionExecutingSet.size >= parallel.max) {
            break;
          }
          if (executionExecutingSet.size > 0) {
            // starting execution in parallel is limited by
            // cpu and memory only when trying to parallelize
            // if nothing is executing these limitations don't apply
            if (processMemoryUsageMonitoring.measure() > parallel.maxMemory) {
              // retry after Xms in case memory usage decreases
              const promise = (async () => {
                await operation.wait(200);
                await startAsMuchAsPossible();
              })();
              promises.push(promise);
              break;
            }
            if (processCpuUsageMonitoring.measure() > parallel.maxCpu) {
              // retry after Xms in case cpu usage decreases
              const promise = (async () => {
                await operation.wait(200);
                await startAsMuchAsPossible();
              })();
              promises.push(promise);
              break;
            }
            if (executionCandidate.params.uses) {
              const nonAvailableTag = executionCandidate.params.uses.find(
                (tagToUse) => usedTagSet.has(tagToUse),
              );
              if (nonAvailableTag) {
                logger.debug(
                  `"${nonAvailableTag}" is not available, ${executionCandidate.name} will wait until it is released by a previous execution`,
                );
                continue;
              }
            }
          }
          const promise = (async () => {
            await start(executionCandidate);
            await startAsMuchAsPossible();
          })();
          promises.push(promise);
        }
        if (promises.length === 0) {
          return;
        }
        await Promise.all(promises);
        promises.length = 0;
      };

      reporters = reporters.flat(Infinity);
      for (const reporter of reporters) {
        const {
          beforeAll,
          // TODO: if defined add them too
          // beforeEach,
          // afterEach,
          // beforeEachInOrder,
          // afterEachInOrder,
          // afterAll,
        } = reporter;
        if (beforeAll) {
          const returnValue = await beforeAll(testPlanResult);
          if (returnValue) {
            const {
              warn,
              beforeEach,
              beforeEachInOrder,
              afterEach,
              afterEachInOrder,
              afterAll,
            } = returnValue;
            if (warn) {
              warnCallbackSet.add(warn);
            }
            if (beforeEach) {
              beforeEachCallbackSet.add(beforeEach);
            }
            if (beforeEachInOrder) {
              beforeEachInOrderCallbackSet.add(beforeEachInOrder);
            }
            if (afterEach) {
              afterEachCallbackSet.add(afterEach);
            }
            if (afterEachInOrder) {
              afterEachInOrderCallbackSet.add(afterEachInOrder);
            }
            if (afterAll) {
              afterAllCallbackSet.add(afterAll);
            }
          }
        }
      }
      await startAsMuchAsPossible();
    }
    timings.executionEnd = takeTiming();
  } catch (e) {
    if (Abort.isAbortError(e)) ; else {
      throw e;
    }
  } finally {
    testPlanResult.aborted = operation.signal.aborted;
    if (testPlanResult.aborted) {
      // when execution is aborted, the remaining executions are "cancelled"
      counters.cancelled = counters.planified - counters.executed;
      counters.remaining = 0;
      countersInOrder.cancelled =
        countersInOrder.planified - countersInOrder.executed;
      countersInOrder.remaining = 0;
    }

    if (!keepRunning) {
      for (const teardownCallback of teardownCallbackSet) {
        await teardownCallback();
      }
      teardownCallbackSet.clear();
    }
    timings.teardownEnd = takeTiming();

    if (finalizeCoverage) {
      await finalizeCoverage();
    }
    timings.coverageTeardownEnd = takeTiming();
    timings.end = takeTiming();

    osMemoryUsageMonitoring.end();
    processMemoryUsageMonitoring.end();
    osCpuUsageMonitoring.end();
    processCpuUsageMonitoring.end();

    afterEachCallbackSet.clear();
    afterEachInOrderCallbackSet.clear();
    for (const afterAllCallback of afterAllCallbackSet) {
      await afterAllCallback(testPlanResult);
    }
    afterAllCallbackSet.clear();
    await operation.end();
  }

  return testPlanResult;
};

const mutateCountersBeforeExecutionStarts = (counters) => {
  counters.executing++;
  counters.waiting--;
};
const mutateCountersAfterExecutionEnds = (counters, execution) => {
  counters.executing--;
  counters.executed++;
  counters.remaining--;
  if (execution.result.status === "skipped") {
    counters.skipped++;
  } else if (execution.result.status === "aborted") {
    counters.aborted++;
  } else if (execution.result.status === "timedout") {
    counters.timedout++;
  } else if (execution.result.status === "failed") {
    counters.failed++;
  } else if (execution.result.status === "completed") {
    counters.completed++;
  }
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

const initIstanbulMiddleware = async (
  page,
  { webServer, rootDirectoryUrl, coverageInclude },
) => {
  const associations = URL_META.resolveAssociations(
    { cover: coverageInclude },
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
        route,
      });
      return;
    }
    if (inlineScriptContents.has(url)) {
      interceptInlineScript({
        url,
        route,
      });
      return;
    }
    const fsServerUrl = new URL("/@fs/", webServer.origin);
    if (url.startsWith(fsServerUrl)) {
      interceptFileSystemUrl({ url, route });
      return;
    }
    route.fallback();
  });
};

const browserPromiseCache = new Map();

const createRuntimeUsingPlaywright = ({
  browserName,
  coveragePlaywrightAPIAvailable = false,
  memoryUsageAPIAvailable = false,
  shouldIgnoreError = () => false,
  transformErrorHook = (error) => error,
  isolatedTab = false,
  headful,
  playwrightLaunchOptions = {},
  ignoreHTTPSErrors = true,
}) => {
  const browserVersion = getBrowserVersion(browserName);
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

    keepRunning,
    stopSignal,
    onConsole,
    onRuntimeStarted,
    onRuntimeStopped,
    teardownCallbackSet,
    isTestPlan,

    measureMemoryUsage,
    onMeasureMemoryAvailable,
    collectPerformance,
    coverageEnabled = false,
    coverageInclude,
    coverageMethodForBrowsers,
    coverageFileUrl,
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
    const cleanupCallbackSet = new Set();
    const cleanup = memoize(async (reason) => {
      const promises = [];
      for (const cleanupCallback of cleanupCallbackSet) {
        promises.push(cleanupCallback({ reason }));
      }
      cleanupCallbackSet.clear();
      await Promise.all(promises);
    });

    const isBrowserDedicatedToExecution = isolatedTab || !isTestPlan;
    let browserAndContextPromise = isBrowserDedicatedToExecution
      ? null
      : browserPromiseCache.get(label);
    if (!browserAndContextPromise) {
      browserAndContextPromise = (async () => {
        const options = {
          ...playwrightLaunchOptions,
          headless: headful === undefined ? !keepRunning : !headful,
        };
        if (memoryUsageAPIAvailable && measureMemoryUsage) {
          const { ignoreDefaultArgs, args } = options;
          if (ignoreDefaultArgs) {
            if (!ignoreDefaultArgs.includes("--headless")) {
              ignoreDefaultArgs.push("--headless");
            }
          } else {
            options.ignoreDefaultArgs = ["--headless"];
          }
          if (args) {
            if (!args.includes("--headless=new")) {
              args.push("--headless=new");
            }
          } else {
            options.args = ["--headless=new"];
          }
        }
        const browser = await launchBrowserUsingPlaywright({
          signal,
          browserName,
          playwrightLaunchOptions: options,
        });
        // if (browser._initializer.version) {
        //   runtime.version = browser._initializer.version;
        // }
        const browserContext = await browser.newContext({ ignoreHTTPSErrors });
        return { browser, browserContext };
      })();
      if (!isBrowserDedicatedToExecution) {
        browserPromiseCache.set(label, browserAndContextPromise);
        cleanupCallbackSet.add(() => {
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
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
    if (isBrowserDedicatedToExecution) {
      cleanupCallbackSet.add(closeBrowser);
      browser.on("disconnected", async () => {
        onRuntimeStopped();
      });
    } else {
      const disconnectedCallback = async () => {
        throw new Error("browser disconnected during execution");
      };
      browser.on("disconnected", disconnectedCallback);
      cleanupCallbackSet.add(() => {
        browser.removeListener("disconnected", disconnectedCallback);
      });
      teardownCallbackSet.add(async () => {
        browser.removeListener("disconnected", disconnectedCallback);
        logger.debug(`testPlan teardown -> closing ${browserName}`);
        await closeBrowser();
      });
    }

    const page = await browserContext.newPage();
    if (!isBrowserDedicatedToExecution) {
      page.on("close", () => {
        onRuntimeStopped();
      });
    }
    onRuntimeStarted();
    cleanupCallbackSet.add(async () => {
      try {
        await page.close();
      } catch (e) {
        if (isTargetClosedError(e)) {
          return;
        }
        throw e;
      }
    });

    const istanbulInstrumentationEnabled =
      coverageEnabled &&
      (!runtime.capabilities.coverageV8 ||
        coverageMethodForBrowsers === "istanbul");
    if (istanbulInstrumentationEnabled) {
      await initIstanbulMiddleware(page, {
        webServer,
        rootDirectoryUrl,
        coverageInclude,
      });
    }
    if (!webServer.isJsenvDevServer) {
      await initJsSupervisorMiddleware(page, {
        webServer,
        fileUrl,
        fileServerUrl,
      });
    }

    const result = {
      status: "pending",
      errors: [],
      namespace: null,
      timings: {},
      memoryUsage: null,
      performance: null,
    };
    const callbackSet = new Set();
    if (coverageEnabled) {
      if (
        runtime.capabilities.coverageV8 &&
        coverageMethodForBrowsers === "playwright"
      ) {
        await page.coverage.startJSCoverage({
          // reportAnonymousScripts: true,
        });
        callbackSet.add(async () => {
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
              coverageInclude,
            },
          );
          writeFileSync$1(
            new URL(coverageFileUrl),
            JSON.stringify(coverage, null, "  "),
          );
        });
      } else {
        callbackSet.add(() => {
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
      callbackSet.add(() => {
        const scriptExecutionResults = result.namespace;
        if (scriptExecutionResults) {
          Object.keys(scriptExecutionResults).forEach((fileRelativeUrl) => {
            delete scriptExecutionResults[fileRelativeUrl].coverage;
          });
        }
      });
    }

    if (memoryUsageAPIAvailable) {
      const getMemoryUsage = async () => {
        const memoryUsage = await page.evaluate(
          /* eslint-disable no-undef */
          /* istanbul ignore next */
          async () => {
            const { performance } = window;
            if (!performance) {
              return null;
            }
            // performance.memory is less accurate but way faster
            // https://web.dev/articles/monitor-total-page-memory-usage#legacy-api
            if (performance.memory) {
              return performance.memory.totalJSHeapSize;
            }
            // https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory
            if (
              performance.measureUserAgentSpecificMemory &&
              window.crossOriginIsolated
            ) {
              const memorySample =
                await performance.measureUserAgentSpecificMemory();
              return memorySample;
            }
            return null;
          },
          /* eslint-enable no-undef */
        );
        return memoryUsage;
      };

      if (onMeasureMemoryAvailable) {
        onMeasureMemoryAvailable(getMemoryUsage);
      }
      if (memoryUsageAPIAvailable && measureMemoryUsage) {
        callbackSet.add(async () => {
          const memoryUsage = await getMemoryUsage();
          result.memoryUsage = memoryUsage;
        });
      }
    }

    if (collectPerformance) {
      callbackSet.add(async () => {
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
    cleanupCallbackSet.add(removeConsoleListener);
    const actionOperation = Abort.startOperation();
    actionOperation.addAbortSignal(signal);

    try {
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
              if (isBrowserDedicatedToExecution) {
                browser.on("disconnected", async () => {
                  cb({ reason: "browser disconnected" });
                });
              } else {
                page.on("close", () => {
                  cb({ reason: "page closed" });
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
                    if (!window.__supervisor__) {
                      throw new Error("window.__supervisor__ is undefined");
                    }
                    const executionResultFromJsenvSupervisor =
                      await window.__supervisor__.getDocumentExecutionResult();
                    return {
                      type: "window_supervisor",
                      timings: executionResultFromJsenvSupervisor.timings,
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
      const raceHandlers = {
        aborted: () => {
          result.status = "aborted";
        },
        error: (error) => {
          result.status = "failed";
          result.errors.push(error);
        },
        // pageerror: (error) => {
        //   result.status = "failed";
        //   result.errors.push(error);
        // },
        closed: () => {
          result.status = "failed";
          result.errors.push(
            isBrowserDedicatedToExecution
              ? new Error(`browser disconnected during execution`)
              : new Error(`page closed during execution`),
          );
        },
        response: ({ executionResults, timings }) => {
          result.status = "completed";
          result.namespace = executionResults;
          result.timings = timings;
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
        },
      };
      const winner = await winnerPromise;
      raceHandlers[winner.name](winner.data);
      for (const callback of callbackSet) {
        await callback();
      }
      callbackSet.clear();
    } catch (e) {
      result.status = "failed";
      result.errors = [e];
    } finally {
      if (keepRunning) {
        stopSignal.notify = cleanup;
      } else {
        await cleanup("execution done");
      }
      return result;
    }
  };
  return runtime;
};

// see also https://github.com/microsoft/playwright/releases
const getBrowserVersion = (browserName) => {
  const playwrightPackageJsonFileUrl = import.meta.resolve(
    "playwright-core/package.json",
  );
  const playwrightBrowsersJsonFileUrl = new URL(
    "./browsers.json",
    playwrightPackageJsonFileUrl,
  );
  const browsersJson = JSON.parse(
    readFileSync(playwrightBrowsersJsonFileUrl, "utf8"),
  );
  const { browsers } = browsersJson;
  for (const browser of browsers) {
    if (browser.name === browserName) {
      return browser.browserVersion;
    }
  }
  return "unkown";
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
  playwrightLaunchOptions,
}) => {
  const launchBrowserOperation = Abort.startOperation();
  launchBrowserOperation.addAbortSignal(signal);
  const playwright = await importPlaywright({ browserName });
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
      const dependencyName = `@playwright/browser-${browserName}`;
      throw new Error(
        createDetailedMessage(
          `"playwright" not found. You need ${dependencyName} in your dependencies to use "${browserName}"`,
          {
            suggestion: `npm install --save-dev ${dependencyName}`,
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
    coveragePlaywrightAPIAvailable: true,
    memoryUsageAPIAvailable: true,
    ...params,
  });
};

const firefox = (params) => {
  return createFirefoxRuntime(params);
};

const firefoxIsolatedTab = (params) => {
  return createFirefoxRuntime({
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
        `Windows + firefox detected: executions on firefox will be ignored (firefox is flaky on windows).
To disable this warning, use disableOnWindowsBecauseFlaky: true
To ignore potential flakyness, use disableOnWindowsBecauseFlaky: false`,
      );
      disableOnWindowsBecauseFlaky = true;
    }
    if (disableOnWindowsBecauseFlaky) {
      return {
        disabled: true,
        disabledReason: "flaky on windows",
      };
    }
  }

  return createRuntimeUsingPlaywright({
    browserName: "firefox",
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
  "./js/importmap_node_loader.mjs",
  import.meta.url,
).href;

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
    } catch {
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
      } catch {
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

const NO_EXPERIMENTAL_WARNING_FILE_URL = new URL(
  "./js/no_experimental_warnings.cjs",
  import.meta.url,
).href;

const CONTROLLED_CHILD_PROCESS_URL = new URL(
  "./js/node_child_process_controlled.mjs",
  import.meta.url,
).href;

const nodeChildProcess = ({
  logProcessCommand = false,
  importmap,
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
    ...(ANSI.supported ? { FORCE_COLOR: "1" } : {}),
    ...(UNICODE.supported ? { FORCE_UNICODE: "1" } : {}),
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
      onRuntimeStarted,
      onRuntimeStopped,

      measureMemoryUsage,
      onMeasureMemoryAvailable,
      collectConsole = false,
      collectPerformance,
      coverageEnabled = false,
      coverageInclude,
      coverageMethodForNodeJs,
      coverageFileUrl,
    }) => {
      if (coverageMethodForNodeJs !== "NODE_V8_COVERAGE") {
        env.NODE_V8_COVERAGE = "";
      }
      commandLineOptions = [
        "--experimental-import-meta-resolve",
        ...commandLineOptions,
      ];
      if (onMeasureMemoryAvailable) {
        env.MEASURE_MEMORY_AT_START = "1";
      }
      if (measureMemoryUsage || onMeasureMemoryAvailable) {
        if (!commandLineOptions.includes("--expose-gc")) {
          commandLineOptions.push("--expose-gc");
        }
      }
      if (importmap) {
        env.IMPORT_MAP = JSON.stringify(importmap);
        env.IMPORT_MAP_BASE_URL = rootDirectoryUrl;
        commandLineOptions.push(
          `--experimental-loader=${IMPORTMAP_NODE_LOADER_FILE_URL}`,
        );
        commandLineOptions.push(
          `--require=${fileURLToPath(NO_EXPERIMENTAL_WARNING_FILE_URL)}`,
        );
      }

      const cleanupCallbackSet = new Set();
      const cleanup = async (reason) => {
        const promises = [];
        for (const cleanupCallback of cleanupCallbackSet) {
          promises.push(cleanupCallback({ reason }));
        }
        cleanupCallbackSet.clear();
        await Promise.all(promises);
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
      const actionOperation = Abort.startOperation();
      actionOperation.addAbortSignal(signal);
      const childProcess = fork(fileURLToPath(CONTROLLED_CHILD_PROCESS_URL), {
        execArgv,
        // silent: true,
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
        const removeReadyListener = onChildProcessMessage(
          childProcess,
          "ready",
          () => {
            removeReadyListener();
            onRuntimeStarted();
            resolve();
          },
        );
      });
      cleanupCallbackSet.add(
        onceChildProcessEvent(childProcess, "exit", () => {
          onRuntimeStopped();
        }),
      );

      const removeOutputListener = installChildProcessOutputListener(
        childProcess,
        ({ type, text }) => {
          if (type === "error" && text.startsWith("Debugger attached.")) {
            return;
          }
          if (
            type === "error" &&
            text.startsWith("Waiting for the debugger to disconnect...")
          ) {
            return;
          }

          onConsole({ type, text });
        },
      );
      const stop = memoize(async ({ gracefulStopAllocatedMs } = {}) => {
        // read all stdout before terminating
        // (no need for stderr because it's sync)
        if (collectConsole || onConsole) {
          while (childProcess.stdout.read() !== null) {}
          await new Promise((resolve) => {
            setTimeout(resolve, 50);
          });
        }

        // all libraries are facing problem on windows when trying
        // to kill a process spawning other processes.
        // "killProcessTree" is theorically correct but sometimes keep process handing forever.
        // Inside GitHub workflow the whole Virtual machine gets unresponsive and ends up being killed
        // There is no satisfying solution to this problem so we stick to the basic
        // childProcess.kill()
        if (process.platform === "win32") {
          try {
            childProcess.kill();
          } catch (e) {
            if (e.code === "EPERM") {
              return;
            }
            throw e;
          }
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

      const result = {
        status: "executing",
        errors: [],
        namespace: null,
        timings: {},
        memoryUsage: null,
        performance: null,
      };

      try {
        let executionInternalErrorCallback;
        let executionCompletedCallback;
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
              execution_internal_error: (cb) => {
                executionInternalErrorCallback = cb;
              },
              execution_completed: (cb) => {
                executionCompletedCallback = cb;
              },
            },
            resolve,
          );
        });
        const raceHandlers = {
          aborted: () => {
            result.status = "aborted";
          },
          error: (error) => {
            removeOutputListener();
            result.status = "failed";
            result.errors.push(error);
          },
          exit: ({ code }) => {
            onRuntimeStopped();
            if (code === 12) {
              result.status = "failed";
              result.errors.push(
                new Error(
                  `node process exited with 12 (the forked child process wanted to use a non-available port for debug)`,
                ),
              );
              return;
            }
            if (code === null || code === 0) {
              result.status = "completed";
              result.namespace = {};
              return;
            }
            if (
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
              new Error(
                `node process exited with code ${code} during execution`,
              ),
            );
          },
          execution_internal_error: (error) => {
            result.status = "failed";
            result.errors.push(error);
          },
          execution_completed: ({
            status,
            errors,
            namespace,
            timings,
            memoryUsage,
            performance,
            coverage,
          }) => {
            result.status = status;
            result.errors = errors;
            result.namespace = namespace;
            result.timings = timings;
            result.memoryUsage = memoryUsage;
            result.performance = performance;
            result.coverage = coverage;
          },
        };
        actionOperation.throwIfAborted();
        await childProcessReadyPromise;
        actionOperation.throwIfAborted();
        if (onMeasureMemoryAvailable) {
          onMeasureMemoryAvailable(async () => {
            let _resolve;
            const memoryUsagePromise = new Promise((resolve) => {
              _resolve = resolve;
            });
            await requestActionOnChildProcess(
              childProcess,
              {
                type: "measure-memory-usage",
              },
              ({ value }) => {
                _resolve(value);
              },
            );
            return memoryUsagePromise;
          });
        }
        await requestActionOnChildProcess(
          childProcess,
          {
            type: "execute-using-dynamic-import",
            params: {
              rootDirectoryUrl,
              fileUrl: new URL(fileRelativeUrl, rootDirectoryUrl).href,
              measureMemoryUsage,
              collectPerformance,
              coverageEnabled,
              coverageInclude,
              coverageMethodForNodeJs,
              coverageFileUrl,
              exitAfterAction: true,
            },
          },
          ({ status, value }) => {
            if (status === "error") {
              executionInternalErrorCallback(value);
            } else {
              executionCompletedCallback(value);
            }
          },
        );
        const winner = await winnerPromise;
        raceHandlers[winner.name](winner.data);
      } catch (e) {
        result.status = "failed";
        result.errors.push(e);
      } finally {
        if (keepRunning) {
          stopSignal.notify = stop;
        } else {
          await stop({
            gracefulStopAllocatedMs,
          });
          onRuntimeStopped();
        }
        await actionOperation.end();
        await cleanup();
        return result;
      }
    },
  };
};

let previousId$1 = 0;
const requestActionOnChildProcess = async (
  childProcess,
  { type, params },
  onResponse,
) => {
  const actionId = previousId$1 + 1;
  previousId$1 = actionId;

  const removeMessageListener = onChildProcessMessage(
    childProcess,
    "action-result",
    ({ id, ...payload }) => {
      if (id === actionId) {
        removeMessageListener();
        onResponse(payload);
      }
    },
  );

  const sendPromise = new Promise((resolve, reject) => {
    childProcess.send(
      {
        __jsenv__: "action",
        data: {
          id: actionId,
          type,
          params,
        },
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
  await sendPromise;
};

// http://man7.org/linux/man-pages/man7/signal.7.html
// https:// github.com/nodejs/node/blob/1d9511127c419ec116b3ddf5fc7a59e8f0f1c1e4/lib/internal/child_process.js#L472
const GRACEFUL_STOP_SIGNAL = "SIGTERM";
const STOP_SIGNAL = "SIGKILL";
// it would be more correct if GRACEFUL_STOP_FAILED_SIGNAL was SIGHUP instead of SIGKILL.
// but I'm not sure and it changes nothing so just use SIGKILL
const GRACEFUL_STOP_FAILED_SIGNAL = "SIGKILL";

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
    childProcess.stderr.removeListener("data", stdErrorDataCallback);
  };
};

const onChildProcessMessage = (childProcess, type, callback) => {
  const onmessage = (message) => {
    if (message && message.__jsenv__ === type) {
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
  "./js/node_worker_thread_controlled.mjs",
  import.meta.url,
).href;

/**
 * Create a runtime object capable to execute a file with Node.js
 * @param {Object} nodeWorkerThreadParameters
 * @param {string|url} nodeWorkerThreadParameters.importmap
 *       An object to remap import
 */
const nodeWorkerThread = ({
  importmap,
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
    ...(ANSI.supported ? { FORCE_COLOR: "1" } : {}),
    ...(UNICODE.supported ? { FORCE_UNICODE: "1" } : {}),
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
      onRuntimeStarted,
      onRuntimeStopped,

      measureMemoryUsage,
      onMeasureMemoryAvailable,
      collectConsole = false,
      collectPerformance,
      coverageEnabled = false,
      coverageInclude,
      coverageMethodForNodeJs,
      coverageFileUrl,
    }) => {
      if (coverageMethodForNodeJs !== "NODE_V8_COVERAGE") {
        env.NODE_V8_COVERAGE = "";
      }
      if (onMeasureMemoryAvailable) {
        env.MEASURE_MEMORY_AT_START = "1";
      }
      if (importmap) {
        env.IMPORT_MAP = JSON.stringify(importmap);
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

      const cleanupCallbackSet = new Set();
      const cleanup = async (reason) => {
        const promises = [];
        for (const cleanupCallback of cleanupCallbackSet) {
          promises.push(cleanupCallback({ reason }));
        }
        cleanupCallbackSet.clear();
        await Promise.all(promises);
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
        const removeReadyListener = onWorkerThreadMessage(
          workerThread,
          "ready",
          () => {
            removeReadyListener();
            onRuntimeStarted();
            resolve();
          },
        );
      });
      cleanupCallbackSet.add(
        onceWorkerThreadEvent(workerThread, "exit", () => {
          onRuntimeStopped();
        }),
      );

      const stop = memoize(async () => {
        // read all stdout before terminating
        // (no need for stderr because it's sync)
        if (collectConsole || onConsole) {
          while (workerThread.stdout.read() !== null) {}
          await new Promise((resolve) => {
            setTimeout(resolve, 50);
          });
        }
        await workerThread.terminate();
      });

      const result = {
        status: "executing",
        errors: [],
        namespace: null,
        timings: {},
        memoryUsage: null,
        performance: null,
      };

      try {
        let executionInternalErrorCallback;
        let executionCompletedCallback;
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
              execution_internal_error: (cb) => {
                executionInternalErrorCallback = cb;
              },
              execution_completed: (cb) => {
                executionCompletedCallback = cb;
              },
            },
            resolve,
          );
        });
        const raceHandlers = {
          aborted: () => {
            result.status = "aborted";
          },
          error: (error) => {
            removeOutputListener();
            result.status = "failed";
            result.errors.push(error);
          },
          exit: ({ code }) => {
            onRuntimeStopped();
            if (code === 12) {
              result.status = "failed";
              result.errors.push(
                new Error(
                  `node process exited with 12 (the forked child process wanted to use a non-available port for debug)`,
                ),
              );
              return;
            }
            if (code === null || code === 0) {
              result.status = "completed";
              result.namespace = {};
              return;
            }
            if (
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
          },
          execution_internal_error: (error) => {
            result.status = "failed";
            result.errors.push(error);
          },
          execution_completed: ({
            status,
            errors,
            namespace,
            timings,
            memoryUsage,
            performance,
            coverage,
          }) => {
            result.status = status;
            result.errors = errors;
            result.namespace = namespace;
            result.timings = timings;
            result.memoryUsage = memoryUsage;
            result.performance = performance;
            result.coverage = coverage;
          },
        };

        actionOperation.throwIfAborted();
        await workerThreadReadyPromise;
        actionOperation.throwIfAborted();
        if (onMeasureMemoryAvailable) {
          onMeasureMemoryAvailable(async () => {
            let _resolve;
            const memoryUsagePromise = new Promise((resolve) => {
              _resolve = resolve;
            });
            await requestActionOnWorkerThread(
              workerThread,
              {
                type: "measure-memory-usage",
              },
              ({ value }) => {
                _resolve(value);
              },
            );
            return memoryUsagePromise;
          });
        }
        await requestActionOnWorkerThread(
          workerThread,
          {
            type: "execute-using-dynamic-import",
            params: {
              rootDirectoryUrl,
              fileUrl: new URL(fileRelativeUrl, rootDirectoryUrl).href,
              measureMemoryUsage,
              collectPerformance,
              coverageEnabled,
              coverageInclude,
              coverageMethodForNodeJs,
              coverageFileUrl,
              exitAfterAction: true,
            },
          },
          ({ status, value }) => {
            if (status === "error") {
              executionInternalErrorCallback(value);
            } else {
              executionCompletedCallback(value);
            }
          },
        );
        const winner = await winnerPromise;
        raceHandlers[winner.name](winner.data);
      } catch (e) {
        result.status = "failed";
        result.errors.push(e);
      } finally {
        if (keepRunning) {
          stopSignal.notify = stop;
        } else {
          await stop();
          onRuntimeStopped();
        }
        await actionOperation.end();
        await cleanup();
        return result;
      }
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

let previousId = 0;
const requestActionOnWorkerThread = (
  workerThread,
  { type, params },
  onResponse,
) => {
  const actionId = previousId + 1;
  previousId = actionId;
  const removeResultListener = onWorkerThreadMessage(
    workerThread,
    "action-result",
    ({ id, ...payload }) => {
      if (id === actionId) {
        removeResultListener();
        onResponse(payload);
      }
    },
  );
  workerThread.postMessage({
    __jsenv__: "action",
    data: {
      id: actionId,
      type,
      params,
    },
  });
};

const onWorkerThreadMessage = (workerThread, type, callback) => {
  const onmessage = (message) => {
    if (message && message.__jsenv__ === type) {
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

const reportCoverageAsHtml = (
  testPlanResult,
  directoryUrl,
  { skipEmpty, skipFull } = {},
) => {
  if (testPlanResult.aborted) {
    return;
  }
  const testPlanCoverage = testPlanResult.coverage;

  const { rootDirectoryUrl } = testPlanResult;
  ensureEmptyDirectorySync(directoryUrl);
  const coverageHtmlDirectoryRelativeUrl = urlToRelativeUrl(
    directoryUrl,
    rootDirectoryUrl,
  );

  const libReport = importWithRequire("istanbul-lib-report");
  const reports = importWithRequire("istanbul-reports");
  const context = libReport.createContext({
    dir: urlToFileSystemPath(rootDirectoryUrl),
    coverageMap: istanbulCoverageMapFromCoverage(testPlanCoverage),
    sourceFinder: (path) =>
      readFileSync(new URL(path, rootDirectoryUrl), "utf8"),
  });
  const report = reports.create("html", {
    skipEmpty,
    skipFull,
    subdir: coverageHtmlDirectoryRelativeUrl,
  });
  report.execute(context);
  // const htmlCoverageDirectoryIndexFileUrl = `${directoryUrl}index.html`;
  // console.log(`-> ${urlToFileSystemPath(htmlCoverageDirectoryIndexFileUrl)}`);
};

const reportCoverageAsJson = (
  testPlanResult,
  fileUrl,
  { logs } = {},
) => {
  if (testPlanResult.aborted) {
    return;
  }
  const testPlanCoverage = testPlanResult.coverage;
  const coverageAsText = JSON.stringify(testPlanCoverage, null, "  ");
  writeFileSync(fileUrl, coverageAsText);
  if (logs) {
    console.log(
      `-> ${urlToFileSystemPath(fileUrl)} (${humanizeFileSize(
        Buffer.byteLength(coverageAsText),
      )})`,
    );
  }
};

const reportCoverageInConsole = (
  testPlanResult,
  { skipEmpty, skipFull } = {},
) => {
  if (testPlanResult.aborted) {
    return;
  }
  const testPlanCoverage = testPlanResult.coverage;
  const libReport = importWithRequire("istanbul-lib-report");
  const reports = importWithRequire("istanbul-reports");
  const context = libReport.createContext({
    coverageMap: istanbulCoverageMapFromCoverage(testPlanCoverage),
  });
  const report = reports.create("text", {
    skipEmpty,
    skipFull,
  });
  report.execute(context);
};

const createXmlGenerator = ({
  rootNodeName,
  canSelfCloseNames = [],
  canReceiveChildNames = [],
  canReceiveContentNames = [],
}) => {
  const createNode = (name, attributes = {}) => {
    const canSelfClose = canSelfCloseNames.includes(name);
    const canReceiveChild = canReceiveChildNames.includes(name);
    const canReceiveContent = canReceiveContentNames.includes(name);

    const children = [];

    const node = {
      name,
      content: "",
      children,
      attributes,
      canSelfClose,
      createNode,
      appendChild: (childNode) => {
        if (!canReceiveChild) {
          throw new Error(`cannot appendChild into ${name}`);
        }
        children.push(childNode);
        return childNode;
      },
      setContent: (value) => {
        if (!canReceiveContent) {
          throw new Error(`cannot setContent on ${name}`);
        }
        node.content = value;
      },
      renderAsString: () => {
        const renderNode = (node, { depth }) => {
          let nodeString = "";
          nodeString += `<${node.name}`;

          {
            const attributeNames = Object.keys(node.attributes);
            if (attributeNames.length) {
              let attributesSingleLine = "";
              let attributesMultiLine = "";

              for (const attributeName of attributeNames) {
                let attributeValue = node.attributes[attributeName];
                if (typeof attributeValue === "number") {
                  attributeValue = round(attributeValue);
                }
                if (attributeName === "viewBox") {
                  attributeValue = attributeValue
                    .split(",")
                    .map((v) => round(parseFloat(v.trim())))
                    .join(", ");
                }
                attributesSingleLine += ` ${attributeName}="${attributeValue}"`;
                attributesMultiLine += `\n  `;
                attributesMultiLine += "  ".repeat(depth);
                attributesMultiLine += `${attributeName}="${attributeValue}"`;
              }
              attributesMultiLine += "\n";
              attributesMultiLine += "  ".repeat(depth);

              if (attributesSingleLine.length < 100) {
                nodeString += attributesSingleLine;
              } else {
                nodeString += attributesMultiLine;
              }
            }
          }

          let innerHTML = "";
          if (node.content) {
            const contentEncoded = he.encode(node.content, { decimal: false });
            innerHTML += contentEncoded;
          }
          {
            if (node.children.length > 0) {
              for (const child of node.children) {
                innerHTML += "\n  ";
                innerHTML += "  ".repeat(depth);
                innerHTML += renderNode(child, {
                  depth: depth + 1,
                });
              }
              innerHTML += "\n";
              innerHTML += "  ".repeat(depth);
            }
          }
          if (innerHTML === "") {
            if (node.canSelfClose) {
              nodeString += `/>`;
            } else {
              nodeString += `></${node.name}>`;
            }
          } else {
            nodeString += `>`;
            nodeString += innerHTML;
            nodeString += `</${node.name}>`;
          }
          return nodeString;
        };

        return renderNode(node, {
          depth: 0,
        });
      },
    };

    return node;
  };

  return (rootNodeAttributes) => createNode(rootNodeName, rootNodeAttributes);
};

// Round: Make number values smaller in output
// Eg: 14.23734 becomes 14.24
// Credit @Chris Martin: https://stackoverflow.com/a/43012696/2816869
const round = (x) => {
  const rounded = Number(`${Math.round(`${x}e2`)}e-2`);
  return rounded;
};

// run prettier on it


const reportAsJunitXml = async (
  testPlanResult,
  fileUrl,
  { mockFluctuatingValues } = {},
) => {
  fileUrl = assertAndNormalizeFileUrl(fileUrl);

  const createRootNode = createXmlGenerator({
    rootNodeName: "testsuite",
    canReceiveChildNames: ["testsuite", "testcase", "properties"],
    canReceiveContentNames: ["failure", "error", "system-out", "system-err"],
  });
  const testSuite = createRootNode({
    time: mockFluctuatingValues ? "[mock]" : testPlanResult.timings.end,
    timestamp: mockFluctuatingValues
      ? "[mock]"
      : new Date(testPlanResult.timings.origin).toISOString().slice(0, -5), //  Date and time of when the test run was executed
    tests: testPlanResult.counters.planified,
    skipped:
      testPlanResult.counters.aborted + testPlanResult.counters.cancelled,
    failures: testPlanResult.counters.timedout + testPlanResult.counters.failed, // Total number of failed tests
  });

  for (const fileRelativeUrl of Object.keys(testPlanResult.results)) {
    const fileResults = testPlanResult.results[fileRelativeUrl];
    for (const group of Object.keys(fileResults)) {
      const executionResult = fileResults[group];
      const testCase = testSuite.createNode("testcase", {
        file: fileRelativeUrl,
        name: group,
        // duration of this execution
        time: mockFluctuatingValues
          ? "[mock]"
          : executionResult.status === "skipped"
            ? 0
            : executionResult.timings.end,
        // Date and time of when the test run was executed
        ...(executionResult.status === "skipped"
          ? {}
          : {
              timestamp: mockFluctuatingValues
                ? "[mock]"
                : new Date(executionResult.timings.origin)
                    .toISOString()
                    .slice(0, -5),
            }),
        // Total number of tests for this execution
        tests: 1,
      });
      testSuite.appendChild(testCase);

      if (executionResult.status === "skipped") {
        testCase.attributes.skipped = 1;
        const skipped = testCase.createNode("skipped", {
          message: "Execution was skipped",
        });
        testSuite.appendChild(skipped);
      } else if (executionResult.status === "aborted") {
        testCase.attributes.skipped = 1;
        const skipped = testCase.createNode("skipped", {
          message: "Execution was aborted",
        });
        testSuite.appendChild(skipped);
      } else if (executionResult.status === "timedout") {
        testCase.attributes.failures = 1;
        const failure = testCase.createNode("failure", {
          message: `Execution timeout after ${executionResult.params.allocatedMs}ms"`,
          type: "timeout",
        });
        testSuite.appendChild(failure);
      } else if (executionResult.status === "failed") {
        const [error] = executionResult.errors;
        if (
          error &&
          typeof error.name === "string" &&
          error.name.includes("AssertionError")
        ) {
          testCase.attributes.failures = 1;
          const failure = testCase.createNode("failure", {
            type: error.name,
          });
          testSuite.appendChild(failure);
          failure.setContent(
            formatErrorForTerminal(error, {
              rootDirectoryUrl: testPlanResult.rootDirectoryUrl,
              mainFileRelativeUrl: fileRelativeUrl,
              mockFluctuatingValues,
              tryColors: false,
            }),
          );
        } else {
          testCase.attributes.errors = 1;
          const errorNode = testCase.createNode("error", {
            type: error.name,
          });
          testSuite.appendChild(errorNode);
          errorNode.setContent(
            formatErrorForTerminal(error, {
              rootDirectoryUrl: testPlanResult.rootDirectoryUrl,
              mainFileRelativeUrl: fileRelativeUrl,
              mockFluctuatingValues,
              tryColors: false,
            }),
          );
        }
      }

      const groupInfo = testPlanResult.groups[group];
      const properties = {
        runtimeName: groupInfo.runtimeName,
        runtimeVersion: mockFluctuatingValues
          ? "[mock]"
          : groupInfo.runtimeVersion,
      };
      const propertiesNode = testCase.createNode("properties");
      testCase.appendChild(propertiesNode);
      for (const propertyName of Object.keys(properties)) {
        const propertyNode = propertiesNode.createNode("property", {
          name: propertyName,
          value: properties[propertyName],
        });
        propertiesNode.appendChild(propertyNode);
      }

      const { consoleCalls = [] } = executionResult;
      let stdout = "";
      let stderr = "";
      for (const consoleCall of consoleCalls) {
        if (groupInfo.runtimeType === "node") {
          if (consoleCall.type === "error") {
            stdout += consoleCall.text;
          } else {
            stderr += consoleCall.text;
          }
        } else {
          stdout += consoleCall.text;
        }
      }
      if (stdout.length) {
        const systemOut = testSuite.createNode("system-out");
        testCase.appendChild(systemOut);
        systemOut.setContent(stdout);
      }
      if (stderr.length) {
        const systemErr = testSuite.createNode("system-err");
        testCase.appendChild(systemErr);
        systemErr.setContent(stderr);
      }
    }
  }

  let junitXmlFileContent = `<?xml version="1.0" encoding="UTF-8"?>
${testSuite.renderAsString()}`;

  writeFileSync(new URL(fileUrl), junitXmlFileContent);
};

const reportAsJson = (
  testPlanResult,
  fileUrl,
  { mockFluctuatingValues } = {},
) => {
  fileUrl = assertAndNormalizeFileUrl(fileUrl);

  if (!mockFluctuatingValues) {
    writeFileSync(fileUrl, JSON.stringify(testPlanResult, null, "  "));
    return;
  }
  const testPlanResultCopy = deepCopy(testPlanResult, {});
  testPlanResultCopy.os.name = "<mock>";
  testPlanResultCopy.os.version = "<mock>";
  testPlanResultCopy.os.availableCpu = "<mock>";
  testPlanResultCopy.os.availableMemory = "<mock>";
  testPlanResultCopy.runtime.version = "<mock>";
  testPlanResultCopy.memoryUsage = "<mock>";
  testPlanResultCopy.cpuUsage = "<mock>";
  testPlanResultCopy.rootDirectoryUrl = "/mock/";
  testPlanResultCopy.timings = "<mock>";
  for (const group of Object.keys(testPlanResultCopy.groups)) {
    testPlanResultCopy.groups[group].runtimeVersion = "<mock>";
  }

  for (const relativeUrl of Object.keys(testPlanResultCopy.results)) {
    const fileResults = testPlanResultCopy.results[relativeUrl];
    for (const groupName of Object.keys(fileResults)) {
      const executionResult = fileResults[groupName];
      const { consoleCalls } = executionResult;
      if (consoleCalls) {
        for (const consoleCall of consoleCalls) {
          consoleCall.text = mockFluctuatingValuesInMessage(consoleCall.text, {
            rootDirectoryUrl: testPlanResult.rootDirectoryUrl,
          });
          consoleCall.text = consoleCall.text.replace(/\r\n/g, "\n");
        }
      }
      const { errors } = executionResult;
      if (errors) {
        for (const error of errors) {
          if (error.message) {
            error.message = mockFluctuatingValuesInMessage(error.message, {
              rootDirectoryUrl: testPlanResult.rootDirectoryUrl,
            });
          }
          if (error.stack) {
            error.stack = mockFluctuatingValuesInMessage(error.stack, {
              rootDirectoryUrl: testPlanResult.rootDirectoryUrl,
            });
          }
        }
      }
      if (executionResult.timings) {
        executionResult.timings = "<mock>";
      }
      if (Object.hasOwn(executionResult, "memoryUsage")) {
        executionResult.memoryUsage = "<mock>";
      }
      if (executionResult.performance) {
        executionResult.performance = "<mock>";
      }
      if (executionResult.coverageFileUrl) {
        executionResult.coverageFileUrl = "<mock>";
      }
    }
  }
  writeFileSync(fileUrl, JSON.stringify(testPlanResultCopy, null, "  "));
};

const mockFluctuatingValuesInMessage = (message, { rootDirectoryUrl }) => {
  return replaceUrls(message, ({ url, line, column }) => {
    let urlAsPath = String(url).startsWith("file:")
      ? urlToFileSystemPath(url)
      : url;
    const rootDirectoryPath = urlToFileSystemPath(rootDirectoryUrl);
    urlAsPath = urlAsPath.replace(rootDirectoryPath, "/mock/");
    if (process.platform === "win32") {
      urlAsPath = urlAsPath.replace(/\\/g, "/");
    }
    if (typeof line === "number" && typeof column === "number") {
      return `${urlAsPath}:${line}:${column}`;
    }
    if (typeof line === "number") {
      return `${urlAsPath}:${line}`;
    }
    return urlAsPath;
  });
};

const deepCopy = (from, into) => {
  const copyValue = (value) => {
    if (value === null) {
      return null;
    }
    if (typeof value === "object") {
      if (Array.isArray(value)) {
        return deepCopy(value, []);
      }
      return deepCopy(value, {});
    }
    return value;
  };

  if (Array.isArray(from)) {
    let i = 0;
    while (i < from.length) {
      into[i] = copyValue(from[i]);
      i++;
    }
  }
  for (const key of Object.keys(from)) {
    into[key] = copyValue(from[key]);
  }
  return into;
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
  handleSIGUP = true,
  handleSIGTERM = true,
  logLevel,
  rootDirectoryUrl,
  webServer,
  importMap,

  fileRelativeUrl,
  allocatedMs,
  mirrorConsole = true,
  keepRunning = false,

  collectConsole = false,
  measureMemoryUsage = false,
  onMeasureMemoryAvailable,
  collectPerformance = false,
  collectCoverage = false,
  coverageTempDirectoryUrl,
  runtime,
  runtimeParams,

  ignoreError = false,
}) => {
  const logger = createLogger({ logLevel });
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(
    rootDirectoryUrl,
    "rootDirectoryUrl",
  );
  const teardownCallbackSet = new Set();
  const executeOperation = Abort.startOperation();
  executeOperation.addAbortSignal(signal);
  if (handleSIGINT || handleSIGUP || handleSIGTERM) {
    executeOperation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: handleSIGINT,
          SIGHUP: handleSIGUP,
          SIGTERM: handleSIGTERM,
        },
        abort,
      );
    });
  }

  if (runtime.type === "browser") {
    await assertAndNormalizeWebServer(webServer, {
      signal,
      teardownCallbackSet,
      logger,
    });
  }

  let resultTransformer = (result) => result;
  runtimeParams = {
    rootDirectoryUrl,
    webServer,
    fileRelativeUrl,
    importMap,
    teardownCallbackSet,
    ...runtimeParams,
  };

  let result = await run({
    signal: executeOperation.signal,
    logger,
    allocatedMs,
    keepRunning,
    mirrorConsole,
    collectConsole,
    measureMemoryUsage,
    onMeasureMemoryAvailable,
    collectPerformance,
    coverageTempDirectoryUrl,
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
    for (const teardownCallback of teardownCallbackSet) {
      await teardownCallback();
    }
    await executeOperation.end();
  }
};

const inlineRuntime = (fn) => {
  return {
    type: "inline",
    name: "inline",
    version: "1",
    run: async ({
      signal = new AbortController().signal,
      onRuntimeStarted,
      onRuntimeStopped,
    }) => {
      const actionOperation = Abort.startOperation();
      actionOperation.addAbortSignal(signal);
      const result = {
        status: "executing",
        errors: [],
        namespace: null,
        timings: {},
        memoryUsage: null,
        performance: null,
      };
      try {
        let executionInternalErrorCallback;
        let executionCompletedCallback;
        const winnerPromise = new Promise((resolve) => {
          raceCallbacks(
            {
              aborted: (cb) => {
                return actionOperation.addAbortCallback(cb);
              },
              execution_internal_error: (cb) => {
                executionInternalErrorCallback = cb;
              },
              execution_completed: (cb) => {
                executionCompletedCallback = cb;
              },
            },
            resolve,
          );
        });
        try {
          onRuntimeStarted();
          const value = await fn();
          executionCompletedCallback(value);
        } catch (e) {
          executionInternalErrorCallback(e);
        }
        const raceHandlers = {
          aborted: () => {
            result.status = "aborted";
          },
          execution_internal_error: (e) => {
            result.status = "failed";
            result.errors.push(e);
          },
          execution_completed: (value) => {
            result.status = "completed";
            result.errors = [];
            result.namespace = value;
          },
        };
        const winner = await winnerPromise;
        raceHandlers[winner.name](winner.data);
      } finally {
        onRuntimeStopped();
        await actionOperation.end();
        return result;
      }
    },
  };
};

export { chromium, chromiumIsolatedTab, execute, executeTestPlan, firefox, firefoxIsolatedTab, inlineRuntime, nodeChildProcess, nodeWorkerThread, reportAsJson, reportAsJunitXml, reportCoverageAsHtml, reportCoverageAsJson, reportCoverageInConsole, reporterList, webkit, webkitIsolatedTab };
