import { createSupportsColor, isUnicodeSupported, stripAnsi, emojiRegex, eastAsianWidth, clearTerminal, eraseLines } from "./jsenv_core_node_modules.js";
import { extname } from "node:path";
import { readFileSync as readFileSync$1, existsSync, readdir, chmod, stat, lstat, chmodSync, statSync, lstatSync, promises, readdirSync, openSync, closeSync, unlinkSync, rmdirSync, mkdirSync, writeFileSync as writeFileSync$1, unlink, rmdir, watch, realpathSync } from "node:fs";
import crypto, { createHash } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
import { cpus, totalmem, freemem } from "node:os";
import { cpuUsage, memoryUsage } from "node:process";
import { stripVTControlCharacters } from "node:util";

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
      ...(SIGINT_CALLBACK ),
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

/*
 * data:[<mediatype>][;base64],<data>
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs#syntax
 */

const DATA_URL = {
  parse: (string) => {
    const afterDataProtocol = string.slice("data:".length);
    const commaIndex = afterDataProtocol.indexOf(",");
    const beforeComma = afterDataProtocol.slice(0, commaIndex);

    let contentType;
    let base64Flag;
    if (beforeComma.endsWith(`;base64`)) {
      contentType = beforeComma.slice(0, -`;base64`.length);
      base64Flag = true;
    } else {
      contentType = beforeComma;
      base64Flag = false;
    }

    contentType =
      contentType === "" ? "text/plain;charset=US-ASCII" : contentType;
    const afterComma = afterDataProtocol.slice(commaIndex + 1);
    return {
      contentType,
      base64Flag,
      data: afterComma,
    };
  },

  stringify: ({ contentType, base64Flag = true, data }) => {
    if (!contentType || contentType === "text/plain;charset=US-ASCII") {
      // can be a buffer or a string, hence check on data.length instead of !data or data === ''
      if (data.length === 0) {
        return `data:,`;
      }
      if (base64Flag) {
        return `data:;base64,${data}`;
      }
      return `data:,${data}`;
    }
    if (base64Flag) {
      return `data:${contentType};base64,${data}`;
    }
    return `data:${contentType},${data}`;
  },
};

const createDetailedMessage$1 = (message, details = {}) => {
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

const getPrecision = (number) => {
  if (Math.floor(number) === number) return 0;
  const [, decimals] = number.toString().split(".");
  return decimals.length || 0;
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

const UNIT_MS = {
  year: 31_557_600_000,
  month: 2_629_000_000,
  week: 604_800_000,
  day: 86_400_000,
  hour: 3_600_000,
  minute: 60_000,
  second: 1000,
};
const UNIT_KEYS = Object.keys(UNIT_MS);
const SMALLEST_UNIT_NAME = UNIT_KEYS[UNIT_KEYS.length - 1];
const TIME_DICTIONARY_EN = {
  year: { long: "year", plural: "years", short: "y" },
  month: { long: "month", plural: "months", short: "m" },
  week: { long: "week", plural: "weeks", short: "w" },
  day: { long: "day", plural: "days", short: "d" },
  hour: { long: "hour", plural: "hours", short: "h" },
  minute: { long: "minute", plural: "minutes", short: "m" },
  second: { long: "second", plural: "seconds", short: "s" },
  joinDuration: (primary, remaining) => `${primary} and ${remaining}`,
};
const TIME_DICTIONARY_FR = {
  year: { long: "an", plural: "ans", short: "a" },
  month: { long: "mois", plural: "mois", short: "m" },
  week: { long: "semaine", plural: "semaines", short: "s" },
  day: { long: "jour", plural: "jours", short: "j" },
  hour: { long: "heure", plural: "heures", short: "h" },
  minute: { long: "minute", plural: "minutes", short: "m" },
  second: { long: "seconde", plural: "secondes", short: "s" },
  joinDuration: (primary, remaining) => `${primary} et ${remaining}`,
};

const humanizeDuration = (
  ms,
  {
    short,
    rounded = true,
    decimals,
    lang = "en",
    timeDictionnary = lang === "fr" ? TIME_DICTIONARY_FR : TIME_DICTIONARY_EN,
  } = {},
) => {
  // ignore ms below meaningfulMs so that:
  // humanizeDuration(0.5) -> "0 second"
  // humanizeDuration(1.1) -> "0.001 second" (and not "0.0011 second")
  // This tool is meant to be read by humans and it would be barely readable to see
  // "0.0001 second" (stands for 0.1 millisecond)
  // yes we could return "0.1 millisecond" but we choosed consistency over precision
  // so that the prefered unit is "second" (and does not become millisecond when ms is super small)
  if (ms < 1) {
    return short
      ? `0${timeDictionnary.second.short}`
      : `0 ${timeDictionnary.second.long}`;
  }
  const { primary, remaining } = parseMs(ms);
  if (!remaining) {
    return humanizeDurationUnit(primary, {
      decimals:
        decimals === undefined ? (primary.name === "second" ? 1 : 0) : decimals,
      short,
      rounded,
      timeDictionnary,
    });
  }
  const primaryText = humanizeDurationUnit(primary, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
    timeDictionnary,
  });
  const remainingText = humanizeDurationUnit(remaining, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
    timeDictionnary,
  });
  return timeDictionnary.joinDuration(primaryText, remainingText);
};
const humanizeDurationUnit = (
  unit,
  { decimals, short, rounded, timeDictionnary },
) => {
  const count = rounded
    ? setRoundedPrecision(unit.count, { decimals })
    : setPrecision(unit.count, { decimals });
  const name = unit.name;
  if (short) {
    const unitText = timeDictionnary[name].short;
    return `${count}${unitText}`;
  }
  if (count <= 1) {
    const unitText = timeDictionnary[name].long;
    return `${count} ${unitText}`;
  }
  const unitText = timeDictionnary[name].plural;
  return `${count} ${unitText}`;
};

const parseMs = (ms) => {
  let firstUnitName = SMALLEST_UNIT_NAME;
  let firstUnitCount = ms / UNIT_MS[SMALLEST_UNIT_NAME];
  const firstUnitIndex = UNIT_KEYS.findIndex((unitName) => {
    if (unitName === SMALLEST_UNIT_NAME) {
      return false;
    }
    const msPerUnit = UNIT_MS[unitName];
    const unitCount = Math.floor(ms / msPerUnit);
    if (unitCount) {
      firstUnitName = unitName;
      firstUnitCount = unitCount;
      return true;
    }
    return false;
  });
  if (firstUnitName === SMALLEST_UNIT_NAME) {
    return {
      primary: {
        name: firstUnitName,
        count: firstUnitCount,
      },
    };
  }
  const remainingMs = ms - firstUnitCount * UNIT_MS[firstUnitName];
  const remainingUnitName = UNIT_KEYS[firstUnitIndex + 1];
  const remainingUnitCount = remainingMs / UNIT_MS[remainingUnitName];
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

const distributePercentages = (
  namedNumbers,
  { maxPrecisionHint = 2 } = {},
) => {
  const numberNames = Object.keys(namedNumbers);
  if (numberNames.length === 0) {
    return {};
  }
  if (numberNames.length === 1) {
    const firstNumberName = numberNames[0];
    return { [firstNumberName]: "100 %" };
  }
  const numbers = numberNames.map((name) => namedNumbers[name]);
  const total = numbers.reduce((sum, value) => sum + value, 0);
  const ratios = numbers.map((number) => number / total);
  const percentages = {};
  ratios.pop();
  ratios.forEach((ratio, index) => {
    const percentage = ratio * 100;
    percentages[numberNames[index]] = percentage;
  });
  const lowestPercentage = (1 / Math.pow(10, maxPrecisionHint)) * 100;
  let precision = 0;
  Object.keys(percentages).forEach((name) => {
    const percentage = percentages[name];
    if (percentage < lowestPercentage) {
      // check the amout of meaningful decimals
      // and that what we will use
      const percentageRounded = setRoundedPrecision(percentage);
      const percentagePrecision = getPrecision(percentageRounded);
      if (percentagePrecision > precision) {
        precision = percentagePrecision;
      }
    }
  });
  let remainingPercentage = 100;

  Object.keys(percentages).forEach((name) => {
    const percentage = percentages[name];
    const percentageAllocated = setRoundedPrecision(percentage, {
      decimals: precision,
    });
    remainingPercentage -= percentageAllocated;
    percentages[name] = percentageAllocated;
  });
  const lastName = numberNames[numberNames.length - 1];
  percentages[lastName] = setRoundedPrecision(remainingPercentage, {
    decimals: precision,
  });
  return percentages;
};

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
        const asideSource = `${fillLeft(lineNumber, lineEndIndex + 1)} |`;
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
          const asideSpaces = `${fillLeft(lineNumber, lineEndIndex + 1)} | `
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

const startSpinner = ({
  dynamicLog,
  frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  fps = 20,
  keepProcessAlive = false,
  stopOnWriteFromOutside = true,
  stopOnVerticalOverflow = true,
  render = () => "",
  effect = () => {},
  animated = dynamicLog.stream.isTTY,
}) => {
  let frameIndex = 0;
  let interval;
  let running = true;

  const spinner = {
    message: undefined,
  };

  const update = (message) => {
    spinner.message = running
      ? `${frames[frameIndex]} ${message}\n`
      : `${message}\n`;
    return spinner.message;
  };
  spinner.update = update;

  let cleanup;
  if (animated && ANSI.supported) {
    running = true;
    cleanup = effect();
    dynamicLog.update(update(render()));

    interval = setInterval(() => {
      frameIndex = frameIndex === frames.length - 1 ? 0 : frameIndex + 1;
      dynamicLog.update(update(render()));
    }, 1000 / fps);
    if (!keepProcessAlive) {
      interval.unref();
    }
  } else {
    dynamicLog.update(update(render()));
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
    if (dynamicLog && message) {
      dynamicLog.update(update(message));
      dynamicLog = null;
    }
  };
  spinner.stop = stop;

  if (stopOnVerticalOverflow) {
    dynamicLog.onVerticalOverflow = stop;
  }
  if (stopOnWriteFromOutside) {
    dynamicLog.onWriteFromOutside = stop;
  }

  return spinner;
};

const createTaskLog = (
  label,
  { disabled = false, animated = true, stopOnWriteFromOutside } = {},
) => {
  if (disabled) {
    return {
      setRightText: () => {},
      done: () => {},
      happen: () => {},
      fail: () => {},
    };
  }
  if (animated && process.env.CAPTURING_SIDE_EFFECTS) {
    animated = false;
  }
  const startMs = Date.now();
  const dynamicLog = createDynamicLog();
  let message = label;
  const taskSpinner = startSpinner({
    dynamicLog,
    render: () => message,
    stopOnWriteFromOutside,
    animated,
  });
  return {
    setRightText: (value) => {
      message = `${label} ${value}`;
    },
    done: () => {
      const msEllapsed = Date.now() - startMs;
      taskSpinner.stop(
        `${UNICODE.OK} ${label} (done in ${humanizeDuration(msEllapsed)})`,
      );
    },
    happen: (message) => {
      taskSpinner.stop(
        `${UNICODE.INFO} ${message} (at ${new Date().toLocaleTimeString()})`,
      );
    },
    fail: (message = `failed to ${label}`) => {
      taskSpinner.stop(`${UNICODE.FAILURE} ${message}`);
    },
  };
};

// consider switching to https://babeljs.io/docs/en/babel-code-frame
// https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/css-syntax-error.js#L43
// https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/terminal-highlight.js#L50
// https://github.com/babel/babel/blob/eea156b2cb8deecfcf82d52aa1b71ba4995c7d68/packages/babel-code-frame/src/index.js#L1


const stringifyUrlSite = (
  { url, line, column, content },
  { showCodeFrame = true, ...params } = {},
) => {
  let string = url;

  if (typeof line === "number") {
    string += `:${line}`;
    if (typeof column === "number") {
      string += `:${column}`;
    }
  }

  if (!showCodeFrame || typeof line !== "number" || !content) {
    return string;
  }

  const sourceLoc = generateContentFrame({
    content,
    line,
    column});
  return `${string}
${sourceLoc}`;
};

const pathnameToExtension$1 = (pathname) => {
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

const urlToScheme$1 = (url) => {
  const urlString = String(url);
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) {
    return "";
  }

  const scheme = urlString.slice(0, colonIndex);
  return scheme;
};

const urlToResource = (url) => {
  const scheme = urlToScheme$1(url);

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

const urlToPathname$1 = (url) => {
  const resource = urlToResource(url);
  const pathname = resourceToPathname(resource);
  return pathname;
};

const urlToFilename$1 = (url) => {
  const pathname = urlToPathname$1(url);
  return pathnameToFilename(pathname);
};

const pathnameToFilename = (pathname) => {
  const pathnameBeforeLastSlash = pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  const slashLastIndex = pathnameBeforeLastSlash.lastIndexOf("/");
  const filename =
    slashLastIndex === -1
      ? pathnameBeforeLastSlash
      : pathnameBeforeLastSlash.slice(slashLastIndex + 1);
  return filename;
};

const urlToBasename = (url, removeAllExtensions) => {
  const filename = urlToFilename$1(url);
  const basename = filenameToBasename(filename);
  {
    return basename;
  }
};

const filenameToBasename = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  const basename =
    dotLastIndex === -1 ? filename : filename.slice(0, dotLastIndex);
  return basename;
};

const urlToExtension$1 = (url) => {
  const pathname = urlToPathname$1(url);
  return pathnameToExtension$1(pathname);
};

const setUrlExtension = (
  url,
  extension,
  { trailingSlash = "preserve" } = {},
) => {
  return transformUrlPathname(url, (pathname) => {
    const currentExtension = urlToExtension$1(url);
    if (typeof extension === "function") {
      extension = extension(currentExtension);
    }
    const pathnameWithoutExtension = currentExtension
      ? pathname.slice(0, -currentExtension.length)
      : pathname;

    if (pathnameWithoutExtension.endsWith("/")) {
      let pathnameWithExtension;
      pathnameWithExtension = pathnameWithoutExtension.slice(0, -1);
      pathnameWithExtension += extension;
      if (trailingSlash === "preserve") {
        pathnameWithExtension += "/";
      }
      return pathnameWithExtension;
    }
    let pathnameWithExtension = pathnameWithoutExtension;
    pathnameWithExtension += extension;
    return pathnameWithExtension;
  });
};

const setUrlFilename = (url, filename) => {
  const parentPathname = new URL("./", url).pathname;
  return transformUrlPathname(url, (pathname) => {
    if (typeof filename === "function") {
      filename = filename(pathnameToFilename(pathname));
    }
    return `${parentPathname}${filename}`;
  });
};

const setUrlBasename = (url, basename) => {
  return setUrlFilename(url, (filename) => {
    if (typeof basename === "function") {
      basename = basename(filenameToBasename(filename));
    }
    return `${basename}${urlToExtension$1(url)}`;
  });
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

const asUrlWithoutSearch = (url) => {
  url = String(url);
  if (url.includes("?")) {
    const urlObject = new URL(url);
    urlObject.search = "";
    return urlObject.href;
  }
  return url;
};

const isValidUrl$1 = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const asSpecifierWithoutSearch = (specifier) => {
  if (isValidUrl$1(specifier)) {
    return asUrlWithoutSearch(specifier);
  }
  const [beforeQuestion] = specifier.split("?");
  return beforeQuestion;
};

// normalize url search params:
// Using URLSearchParams to alter the url search params
// can result into "file:///file.css?css_module"
// becoming "file:///file.css?css_module="
// we want to get rid of the "=" and consider it's the same url
const normalizeUrl = (url) => {
  const calledWithString = typeof url === "string";
  const urlObject = calledWithString ? new URL(url) : url;
  let urlString = urlObject.href;

  if (!urlString.includes("?")) {
    return url;
  }
  // disable on data urls (would mess up base64 encoding)
  if (urlString.startsWith("data:")) {
    return url;
  }
  urlString = urlString.replace(/[=](?=&|$)/g, "");
  if (calledWithString) {
    return urlString;
  }
  urlObject.href = urlString;
  return urlObject;
};

const injectQueryParamsIntoSpecifier = (specifier, params) => {
  if (isValidUrl$1(specifier)) {
    return injectQueryParams(specifier, params);
  }
  const [beforeQuestion, afterQuestion = ""] = specifier.split("?");
  const searchParams = new URLSearchParams(afterQuestion);
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value === undefined) {
      searchParams.delete(key);
    } else {
      searchParams.set(key, value);
    }
  });
  let paramsString = searchParams.toString();
  if (paramsString) {
    paramsString = paramsString.replace(/[=](?=&|$)/g, "");
    return `${beforeQuestion}?${paramsString}`;
  }
  return beforeQuestion;
};

const injectQueryParams = (url, params) => {
  const calledWithString = typeof url === "string";
  const urlObject = calledWithString ? new URL(url) : url;
  const { searchParams } = urlObject;
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value === undefined) {
      searchParams.delete(key);
    } else {
      searchParams.set(key, value);
    }
  }
  return normalizeUrl(calledWithString ? urlObject.href : urlObject);
};

const injectQueryParamWithoutEncoding = (url, key, value) => {
  const urlObject = new URL(url);
  let { origin, pathname, search, hash } = urlObject;
  // origin is "null" for "file://" urls with Node.js
  if (origin === "null" && urlObject.href.startsWith("file:")) {
    origin = "file://";
  }
  if (search === "") {
    search = `?${key}=${value}`;
  } else {
    search += `${key}=${value}`;
  }
  return `${origin}${pathname}${search}${hash}`;
};
const injectQueryParamIntoSpecifierWithoutEncoding = (
  specifier,
  key,
  value,
) => {
  if (isValidUrl$1(specifier)) {
    return injectQueryParamWithoutEncoding(specifier, key, value);
  }
  const [beforeQuestion, afterQuestion = ""] = specifier.split("?");
  const searchParams = new URLSearchParams(afterQuestion);
  let search = searchParams.toString();
  if (search === "") {
    search = `?${key}=${value}`;
  } else {
    search = `?${search}&${key}=${value}`;
  }
  return `${beforeQuestion}${search}`;
};

const renderUrlOrRelativeUrlFilename = (urlOrRelativeUrl, renderer) => {
  const questionIndex = urlOrRelativeUrl.indexOf("?");
  const beforeQuestion =
    questionIndex === -1
      ? urlOrRelativeUrl
      : urlOrRelativeUrl.slice(0, questionIndex);
  const afterQuestion =
    questionIndex === -1 ? "" : urlOrRelativeUrl.slice(questionIndex);
  const beforeLastSlash = beforeQuestion.endsWith("/")
    ? beforeQuestion.slice(0, -1)
    : beforeQuestion;
  const slashLastIndex = beforeLastSlash.lastIndexOf("/");
  const beforeFilename =
    slashLastIndex === -1 ? "" : beforeQuestion.slice(0, slashLastIndex + 1);
  const filename =
    slashLastIndex === -1
      ? beforeQuestion
      : beforeQuestion.slice(slashLastIndex + 1);
  const dotLastIndex = filename.lastIndexOf(".");
  const basename =
    dotLastIndex === -1 ? filename : filename.slice(0, dotLastIndex);
  const extension = dotLastIndex === -1 ? "" : filename.slice(dotLastIndex);
  const newFilename = renderer({
    basename,
    extension,
  });
  return `${beforeFilename}${newFilename}${afterQuestion}`;
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
      pathnameToParentPathname$1(baseSpecificPathname);
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

const pathnameToParentPathname$1 = (pathname) => {
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

const resolveUrl$1 = (specifier, baseUrl) => {
  if (typeof baseUrl === "undefined") {
    throw new TypeError(`baseUrl missing to resolve ${specifier}`);
  }
  return String(new URL(specifier, baseUrl));
};

const urlIsOrIsInsideOf = (url, otherUrl) => {
  const urlObject = new URL(url);
  const otherUrlObject = new URL(otherUrl);

  if (urlObject.origin !== otherUrlObject.origin) {
    return false;
  }

  const urlPathname = urlObject.pathname;
  const otherUrlPathname = otherUrlObject.pathname;
  if (urlPathname === otherUrlPathname) {
    return true;
  }

  const isInside = urlPathname.startsWith(otherUrlPathname);
  return isInside;
};

const fileSystemPathToUrl = (value) => {
  if (!isFileSystemPath(value)) {
    throw new Error(`value must be a filesystem path, got ${value}`);
  }
  return String(pathToFileURL(value));
};

const getCallerPosition = () => {
  const { prepareStackTrace } = Error;
  Error.prepareStackTrace = (error, stack) => {
    Error.prepareStackTrace = prepareStackTrace;
    return stack;
  };
  const { stack } = new Error();
  const callerCallsite = stack[2];
  const fileName = callerCallsite.getFileName();
  return {
    url:
      fileName && isFileSystemPath(fileName)
        ? fileSystemPathToUrl(fileName)
        : fileName,
    line: callerCallsite.getLineNumber(),
    column: callerCallsite.getColumnNumber(),
  };
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
    const comparison = leftPart.localeCompare(rightPart, undefined, {
      numeric: true,
      sensitivity: "base",
    });
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

const compareFileUrls = (a, b) => {
  return comparePathnames(new URL(a).pathname, new URL(b).pathname);
};

const isWindows$3 = process.platform === "win32";
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

  if (!isWindows$3) {
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

const lookupPackageDirectory = (currentUrl) => {
  return findSelfOrAncestorDirectoryUrl(currentUrl, (ancestorDirectoryUrl) => {
    const potentialPackageJsonFileUrl = `${ancestorDirectoryUrl}package.json`;
    return existsSync(new URL(potentialPackageJsonFileUrl));
  });
};

const createLookupPackageDirectory = () => {
  const cache = new Map();
  const lookupPackageDirectoryWithCache = (currentUrl) => {
    const directoryUrls = [];
    currentUrl = String(currentUrl);
    if (currentUrl.endsWith("/")) {
      directoryUrls.push(currentUrl);
    } else {
      const directoryUrl = new URL("./", currentUrl).href;
      directoryUrls.push(directoryUrl);
      currentUrl = directoryUrl;
    }
    while (currentUrl !== "file:///") {
      const fromCache = cache.get(currentUrl);
      if (fromCache !== undefined) {
        return fromCache;
      }
      const packageJsonUrlCandidate = `${currentUrl}package.json`;
      if (existsSync(new URL(packageJsonUrlCandidate))) {
        for (const directoryUrl of directoryUrls) {
          cache.set(directoryUrl, currentUrl);
        }
        return currentUrl;
      }
      const directoryUrl = getParentDirectoryUrl(currentUrl);
      directoryUrls.push(directoryUrl);
      currentUrl = directoryUrl;
    }
    for (const directoryUrl of directoryUrls) {
      cache.set(directoryUrl, null);
    }
    return null;
  };
  lookupPackageDirectoryWithCache.clearCache = () => {
    cache.clear();
  };
  return lookupPackageDirectoryWithCache;
};

const readPackageAtOrNull = (packageDirectoryUrl) => {
  const packageJsonFileUrl = new URL("./package.json", packageDirectoryUrl);
  let packageJsonFileContentBuffer;
  try {
    packageJsonFileContentBuffer = readFileSync$1(packageJsonFileUrl, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") {
      return null;
    }
    throw e;
  }
  const packageJsonFileContentString = String(packageJsonFileContentBuffer);
  try {
    const packageJsonFileContentObject = JSON.parse(
      packageJsonFileContentString,
    );
    return packageJsonFileContentObject;
  } catch {
    throw new Error(`Invalid package configuration at ${packageJsonFileUrl}`);
  }
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
  if (!hasScheme$1(value)) {
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
const hasScheme$1 = (specifier) => /^[a-zA-Z]+:/.test(specifier);

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


const isWindows$1 = process.platform === "win32";

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
    ...(isWindows$1
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

const readFileSync = (value, { as } = {}) => {
  const fileUrl = assertAndNormalizeFileUrl(value);
  if (as === undefined) {
    const contentType = CONTENT_TYPE.fromUrlExtension(fileUrl);
    if (CONTENT_TYPE.isJson(contentType)) {
      as = "json";
    } else if (CONTENT_TYPE.isTextual(contentType)) {
      as = "string";
    } else {
      as = "buffer";
    }
  }
  const buffer = readFileSync$1(new URL(fileUrl));
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
      const url = resolveUrl$1(entryName, directoryUrl);
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
    content = readFileSync$1(content);
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
        const url = resolveUrl$1(name, directoryUrl);
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

const updateJsonFileSync = (fileUrl, values = {}) => {
  try {
    const jsonString = readFileSync(fileUrl, { as: "string" });
    const json = JSON.parse(jsonString);
    const newContent = { ...json };
    for (const key of Object.keys(values)) {
      const value = values[key];
      newContent[key] = value;
    }
    let jsonFormatted;
    if (jsonString.startsWith("{\n")) {
      jsonFormatted = JSON.stringify(newContent, null, "  ");
    } else {
      jsonFormatted = JSON.stringify(newContent);
    }
    writeFileSync(fileUrl, jsonFormatted);
  } catch (e) {
    if (e.code === "ENOENT") {
      writeFileSync(fileUrl, JSON.stringify(values));
      return;
    }
    throw e;
  }
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

const clearDirectorySync = (
  initialDirectoryUrl,
  secondArg,
  thirdArg,
) => {
  let removePatterns = {};
  if (secondArg && typeof secondArg === "object") {
    removePatterns = secondArg;
  } else {
    removePatterns = {};
    let clearPatterns = secondArg || "**/*";
    let keepPatterns = [];

    if (typeof keepPatterns === "string") {
      keepPatterns = [keepPatterns];
    }
    if (Array.isArray(keepPatterns)) {
      for (const keepPattern of keepPatterns) {
        Object.assign(removePatterns, {
          [keepPattern]: false,
        });
      }
    }
    if (typeof clearPatterns === "string") {
      clearPatterns = [clearPatterns];
    }
    if (Array.isArray(clearPatterns)) {
      let someClearPatternHandleNodeModules = false;
      for (const clearPattern of clearPatterns) {
        Object.assign(removePatterns, {
          [clearPatterns]: true,
        });
        if (
          !someClearPatternHandleNodeModules &&
          clearPattern.includes("node_modules")
        ) {
          someClearPatternHandleNodeModules = true;
        }
      }
      Object.assign(removePatterns, {
        "**/.*": false,
        "**/.*/": false,
      });
      if (!someClearPatternHandleNodeModules) {
        Object.assign(removePatterns, {
          "**/node_modules/": false,
        });
      }
    }
  }

  const associations = URL_META.resolveAssociations(
    { remove: removePatterns },
    initialDirectoryUrl,
  );
  const visitDirectory = (directoryUrl) => {
    let entryNames;
    try {
      entryNames = readdirSync(new URL(directoryUrl));
    } catch (e) {
      if (e.code === "ENOENT") {
        return;
      }
      throw e;
    }

    for (const entryName of entryNames) {
      const entryUrl = new URL(entryName, directoryUrl);
      let entryStat;
      try {
        entryStat = readEntryStatSync(entryUrl);
      } catch (e) {
        if (e && e.code === "ENOENT") {
          continue;
        }
        throw e;
      }

      if (entryStat.isDirectory()) {
        const subDirectoryUrl = new URL(`${entryName}/`, directoryUrl);
        const meta = URL_META.applyAssociations({
          url: subDirectoryUrl,
          associations,
        });
        if (meta.remove) {
          removeEntrySync(subDirectoryUrl, {
            recursive: true,
            allowUseless: true,
          });
          continue;
        }
        if (
          !URL_META.urlChildMayMatch({
            url: subDirectoryUrl,
            associations,
            predicate: ({ remove }) => remove,
          })
        ) {
          continue;
        }
        visitDirectory(subDirectoryUrl);
        continue;
      }

      const meta = URL_META.applyAssociations({
        url: entryUrl,
        associations,
      });
      if (meta.remove) {
        removeEntrySync(entryUrl, { allowUseless: true });
        continue;
      }
    }
  };
  visitDirectory(initialDirectoryUrl);
};

const callOnceIdlePerFile = (callback, idleMs) => {
  const timeoutIdMap = new Map();
  return (fileEvent) => {
    const { relativeUrl } = fileEvent;
    let timeoutId = timeoutIdMap.get(relativeUrl);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      callback(fileEvent);
    }, idleMs);
    if (timeoutId.unref) {
      timeoutId.unref();
    }
    timeoutIdMap.set(relativeUrl, timeoutId);
  };
};

const isWindows = process.platform === "win32";

const createWatcher = (sourcePath, options) => {
  const watcher = watch(sourcePath, options);

  if (isWindows) {
    watcher.on("error", async (error) => {
      // https://github.com/joyent/node/issues/4337
      if (error.code === "EPERM") {
        try {
          const fd = openSync(sourcePath, "r");
          closeSync(fd);
        } catch (e) {
          if (e.code === "ENOENT") {
            return;
          }
          console.error(
            generateWindowsEPERMErrorMessage(error, {
              operation: "watch",
              path: sourcePath,
            }),
          );
          throw error;
        }
      } else {
        throw error;
      }
    });
  }

  return watcher;
};

const guardTooFastSecondCallPerFile = (
  callback,
  cooldownBetweenFileEvents = 40,
) => {
  const previousCallMsMap = new Map();
  return (fileEvent) => {
    const { relativeUrl } = fileEvent;
    const previousCallMs = previousCallMsMap.get(relativeUrl);
    const nowMs = Date.now();
    if (previousCallMs) {
      const msEllapsed = nowMs - previousCallMs;
      if (msEllapsed < cooldownBetweenFileEvents) {
        previousCallMsMap.delete(relativeUrl);
        return;
      }
    }
    previousCallMsMap.set(relativeUrl, nowMs);
    callback(fileEvent);
  };
};

const trackResources = () => {
  const callbackArray = [];

  const registerCleanupCallback = (callback) => {
    if (typeof callback !== "function")
      throw new TypeError(`callback must be a function
callback: ${callback}`);
    callbackArray.push(callback);
    return () => {
      const index = callbackArray.indexOf(callback);
      if (index > -1) callbackArray.splice(index, 1);
    };
  };

  const cleanup = async (reason) => {
    const localCallbackArray = callbackArray.slice();
    await Promise.all(localCallbackArray.map((callback) => callback(reason)));
  };

  return { registerCleanupCallback, cleanup };
};

const isLinux = process.platform === "linux";
const fsWatchSupportsRecursive = !isLinux;

const registerDirectoryLifecycle = (
  source,
  {
    debug = false,
    added,
    updated,
    removed,
    watchPatterns = {
      "./**/*": true,
    },
    notifyExistent = false,
    keepProcessAlive = true,
    recursive = false,
    // filesystem might dispatch more events than expect
    // Code can use "cooldownBetweenFileEvents" to prevent that
    // BUT it is UNADVISED to rely on this as explained later (search for "is lying" in this file)
    // For this reason"cooldownBetweenFileEvents" should be reserved to scenarios
    // like unit tests
    cooldownBetweenFileEvents = 0,
    idleMs = 50,
  },
) => {
  const sourceUrl = assertAndNormalizeDirectoryUrl(source);
  if (!undefinedOrFunction(added)) {
    throw new TypeError(`added must be a function or undefined, got ${added}`);
  }
  if (!undefinedOrFunction(updated)) {
    throw new TypeError(
      `updated must be a function or undefined, got ${updated}`,
    );
  }
  if (!undefinedOrFunction(removed)) {
    throw new TypeError(
      `removed must be a function or undefined, got ${removed}`,
    );
  }
  if (idleMs) {
    if (updated) {
      updated = callOnceIdlePerFile(updated, idleMs);
    }
  }
  if (cooldownBetweenFileEvents) {
    if (added) {
      added = guardTooFastSecondCallPerFile(added, cooldownBetweenFileEvents);
    }
    if (updated) {
      updated = guardTooFastSecondCallPerFile(
        updated,
        cooldownBetweenFileEvents,
      );
    }
    if (removed) {
      removed = guardTooFastSecondCallPerFile(
        removed,
        cooldownBetweenFileEvents,
      );
    }
  }

  const associations = URL_META.resolveAssociations(
    { watch: watchPatterns },
    sourceUrl,
  );
  const getWatchPatternValue = ({ url, type }) => {
    if (type === "directory") {
      let firstMeta = false;
      URL_META.urlChildMayMatch({
        url: `${url}/`,
        associations,
        predicate: ({ watch }) => {
          if (watch) {
            firstMeta = watch;
          }
          return watch;
        },
      });
      return firstMeta;
    }
    const { watch } = URL_META.applyAssociations({ url, associations });
    return watch;
  };
  const tracker = trackResources();
  const infoMap = new Map();
  const readEntryInfo = (url) => {
    try {
      const relativeUrl = urlToRelativeUrl(url, source);
      const previousInfo = infoMap.get(relativeUrl);
      const stat = readEntryStatSync(new URL(url));
      const type = statsToType(stat);
      const patternValue = previousInfo
        ? previousInfo.patternValue
        : getWatchPatternValue({ url, type });
      return {
        previousInfo,
        url,
        relativeUrl,
        type,
        stat,
        patternValue,
      };
    } catch (e) {
      if (
        e.code === "ENOENT" ||
        e.code === "EACCES" ||
        e.code === "EPERM" ||
        e.code === "ENOTDIR" // happens on mac12 sometimes
      ) {
        return {
          type: null,
          stat: null,
        };
      }
      throw e;
    }
  };

  const handleDirectoryEvent = ({
    directoryRelativeUrl,
    filename,
    eventType,
  }) => {
    if (filename) {
      if (directoryRelativeUrl) {
        handleChange(`${directoryRelativeUrl}/${filename}`);
        return;
      }
      handleChange(`${filename}`);
      return;
    }
    if (eventType === "rename") {
      if (!removed && !added) {
        return;
      }
      // we might receive `rename` without filename
      // in that case we try to find ourselves which file was removed.
      let relativeUrlCandidateArray = Array.from(infoMap.keys());
      if (recursive && !fsWatchSupportsRecursive) {
        relativeUrlCandidateArray = relativeUrlCandidateArray.filter(
          (relativeUrlCandidate) => {
            if (!directoryRelativeUrl) {
              // ensure entry is top level
              if (relativeUrlCandidate.includes("/")) {
                return false;
              }
              return true;
            }
            // entry not inside this directory
            if (!relativeUrlCandidate.startsWith(directoryRelativeUrl)) {
              return false;
            }
            const afterDirectory = relativeUrlCandidate.slice(
              directoryRelativeUrl.length + 1,
            );
            // deep inside this directory
            if (afterDirectory.includes("/")) {
              return false;
            }
            return true;
          },
        );
      }
      const removedEntryRelativeUrl = relativeUrlCandidateArray.find(
        (relativeUrlCandidate) => {
          try {
            readEntryStatSync(new URL(relativeUrlCandidate, sourceUrl));
            return false;
          } catch (e) {
            if (e.code === "ENOENT") {
              return true;
            }
            throw e;
          }
        },
      );
      if (removedEntryRelativeUrl) {
        handleEntryLost(infoMap.get(removedEntryRelativeUrl));
      }
    }
  };

  const handleChange = (relativeUrl) => {
    const entryUrl = new URL(relativeUrl, sourceUrl).href;
    const entryInfo = readEntryInfo(entryUrl);
    if (entryInfo.type === null) {
      const previousEntryInfo = infoMap.get(relativeUrl);
      if (!previousEntryInfo) {
        // on MacOS it's possible to receive a "rename" event for
        // a file that does not exists...
        return;
      }
      if (debug) {
        console.debug(`"${relativeUrl}" removed`);
      }
      handleEntryLost(previousEntryInfo);
      return;
    }
    const { previousInfo } = entryInfo;
    if (!previousInfo) {
      if (debug) {
        console.debug(`"${relativeUrl}" added`);
      }
      handleEntryFound(entryInfo);
      return;
    }
    if (entryInfo.type !== previousInfo.type) {
      // it existed and was replaced by something else
      // we don't handle this as an update. We rather say the resource
      // is lost and something else is found (call removed() then added())
      handleEntryLost(previousInfo);
      handleEntryFound(entryInfo);
      return;
    }
    if (entryInfo.type === "directory") {
      // a directory cannot really be updated in way that matters for us
      // filesystem is trying to tell us the directory content have changed
      // but we don't care about that
      // we'll already be notified about what has changed
      return;
    }
    // something has changed at this relativeUrl (the file existed and was not deleted)
    // it's possible to get there without a real update
    // (file content is the same and file mtime is the same).
    // In short filesystem is sometimes "lying"
    // Not trying to guard against that because:
    // - hurt perfs a lot
    // - it happens very rarely
    // - it's not really a concern in practice
    // - filesystem did not send an event out of nowhere:
    //   something occured but we don't know exactly what
    // maybe we should exclude some stuff as done in
    // https://github.com/paulmillr/chokidar/blob/b2c4f249b6cfa98c703f0066fb4a56ccd83128b5/lib/nodefs-handler.js#L366
    if (debug) {
      console.debug(`"${relativeUrl}" modified`);
    }
    handleEntryUpdated(entryInfo);
  };
  const handleEntryFound = (entryInfo, { notify = true } = {}) => {
    const seenSet = new Set();
    const applyEntryDiscoveredEffects = (entryInfo) => {
      seenSet.add(entryInfo.url);
      infoMap.set(entryInfo.relativeUrl, entryInfo);
      if (entryInfo.type === "directory") {
        const directoryUrl = entryInfo.url.endsWith("/")
          ? entryInfo.url
          : `${entryInfo.url}/`;
        let entryNameArray;
        try {
          const directoryUrlObject = new URL(directoryUrl);
          entryNameArray = readdirSync(directoryUrlObject);
        } catch (e) {
          if (
            e.code === "ENOENT" ||
            e.code === "EACCES" ||
            e.code === "EPERM" ||
            e.code === "ENOTDIR"
          ) {
            return;
          }
          throw e;
        }
        for (const entryName of entryNameArray) {
          const childEntryUrl = new URL(entryName, directoryUrl).href;
          if (seenSet.has(childEntryUrl)) {
            continue;
          }
          const childEntryInfo = readEntryInfo(childEntryUrl);
          if (childEntryInfo.type !== null && childEntryInfo.patternValue) {
            applyEntryDiscoveredEffects(childEntryInfo);
          }
        }
        // we must watch manually every directory we find
        if (!fsWatchSupportsRecursive) {
          try {
            const watcher = createWatcher(urlToFileSystemPath(entryInfo.url), {
              persistent: keepProcessAlive,
            });
            tracker.registerCleanupCallback(() => {
              watcher.close();
            });
            watcher.on("change", (eventType, filename) => {
              handleDirectoryEvent({
                directoryRelativeUrl: entryInfo.relativeUrl,
                filename: filename
                  ? // replace back slashes with slashes
                    filename.replace(/\\/g, "/")
                  : "",
                eventType,
              });
            });
          } catch (e) {
            if (
              e.code === "ENOENT" ||
              e.code === "EACCES" ||
              e.code === "EPERM" ||
              e.code === "ENOTDIR"
            ) {
              return;
            }
            throw e;
          }
        }
      }
      if (added && entryInfo.patternValue && notify) {
        added({
          relativeUrl: entryInfo.relativeUrl,
          type: entryInfo.type,
          patternValue: entryInfo.patternValue,
          mtime: entryInfo.stat.mtimeMs,
        });
      }
    };
    applyEntryDiscoveredEffects(entryInfo);
    seenSet.clear();
  };
  const handleEntryLost = (entryInfo) => {
    infoMap.delete(entryInfo.relativeUrl);
    if (removed && entryInfo.patternValue) {
      removed({
        relativeUrl: entryInfo.relativeUrl,
        type: entryInfo.type,
        patternValue: entryInfo.patternValue,
        mtime: entryInfo.stat.mtimeMs,
      });
    }
  };
  const handleEntryUpdated = (entryInfo) => {
    if (updated && entryInfo.patternValue && shouldCallUpdated(entryInfo)) {
      infoMap.set(entryInfo.relativeUrl, entryInfo);
      updated({
        relativeUrl: entryInfo.relativeUrl,
        type: entryInfo.type,
        patternValue: entryInfo.patternValue,
        mtime: entryInfo.stat.mtimeMs,
        previousMtime: entryInfo.previousInfo.stat.mtimeMs,
      });
    }
  };

  handleEntryFound(readEntryInfo(sourceUrl), {
    notify: notifyExistent,
  });
  if (debug) {
    const relativeUrls = Array.from(infoMap.keys());
    if (relativeUrls.length === 0) {
      console.debug(`No file found`);
    } else {
      console.debug(
        `${relativeUrls.length} file found: 
${relativeUrls.join("\n")}`,
      );
    }
  }
  const watcher = createWatcher(urlToFileSystemPath(sourceUrl), {
    recursive: recursive && fsWatchSupportsRecursive,
    persistent: keepProcessAlive,
  });
  tracker.registerCleanupCallback(() => {
    watcher.close();
  });
  watcher.on("change", (eventType, fileSystemPath) => {
    handleDirectoryEvent({
      ...fileSystemPathToDirectoryRelativeUrlAndFilename(fileSystemPath),
      eventType,
    });
  });

  return tracker.cleanup;
};

const shouldCallUpdated = (entryInfo) => {
  const { stat, previousInfo } = entryInfo;
  if (!stat.atimeMs) {
    return true;
  }
  if (stat.atimeMs <= stat.mtimeMs) {
    return true;
  }
  if (stat.mtimeMs !== previousInfo.stat.mtimeMs) {
    return true;
  }
  return true;
};

const undefinedOrFunction = (value) => {
  return typeof value === "undefined" || typeof value === "function";
};

const fileSystemPathToDirectoryRelativeUrlAndFilename = (path) => {
  if (!path) {
    return {
      directoryRelativeUrl: "",
      filename: "",
    };
  }

  const normalizedPath = path.replace(/\\/g, "/"); // replace back slashes with slashes
  const slashLastIndex = normalizedPath.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return {
      directoryRelativeUrl: "",
      filename: normalizedPath,
    };
  }

  const directoryRelativeUrl = normalizedPath.slice(0, slashLastIndex);
  const filename = normalizedPath.slice(slashLastIndex + 1);
  return {
    directoryRelativeUrl,
    filename,
  };
};

/*
 * - Buffer documentation on Node.js
 *   https://nodejs.org/docs/latest-v13.x/api/buffer.html
 * - eTag documentation on MDN
 *   https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
 */


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

// https://nodejs.org/api/packages.html#resolving-user-conditions
const readCustomConditionsFromProcessArgs = () => {
  if (process.env.IGNORE_PACKAGE_CONDITIONS) {
    return [];
  }
  const packageConditions = [];
  for (const arg of process.execArgv) {
    if (arg.includes("-C=")) {
      const packageCondition = arg.slice(0, "-C=".length);
      packageConditions.push(packageCondition);
    }
    if (arg.includes("--conditions=")) {
      const packageCondition = arg.slice("--conditions=".length);
      packageConditions.push(packageCondition);
    }
  }
  return packageConditions;
};

const asDirectoryUrl = (url) => {
  const { pathname } = new URL(url);
  if (pathname.endsWith("/")) {
    return url;
  }
  return new URL("./", url).href;
};

const getParentUrl = (url) => {
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

const isValidUrl = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const urlToFilename = (url) => {
  const { pathname } = new URL(url);
  const pathnameBeforeLastSlash = pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  const slashLastIndex = pathnameBeforeLastSlash.lastIndexOf("/");
  const filename =
    slashLastIndex === -1
      ? pathnameBeforeLastSlash
      : pathnameBeforeLastSlash.slice(slashLastIndex + 1);
  return filename;
};

const urlToExtension = (url) => {
  const filename = urlToFilename(url);
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) return "";
  // if (dotLastIndex === pathname.length - 1) return ""
  const extension = filename.slice(dotLastIndex);
  return extension;
};

const defaultLookupPackageScope = (url) => {
  let scopeUrl = asDirectoryUrl(url);
  while (scopeUrl !== "file:///") {
    if (scopeUrl.endsWith("node_modules/")) {
      return null;
    }
    const packageJsonUrlObject = new URL("package.json", scopeUrl);
    if (existsSync(packageJsonUrlObject)) {
      return scopeUrl;
    }
    scopeUrl = getParentUrl(scopeUrl);
  }
  return null;
};

const defaultReadPackageJson = (packageUrl) => {
  const packageJsonFileUrl = new URL("./package.json", packageUrl);
  let packageJsonFileContentBuffer;
  try {
    packageJsonFileContentBuffer = readFileSync$1(packageJsonFileUrl, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") {
      return null;
    }
    throw e;
  }
  const packageJsonFileContentString = String(packageJsonFileContentBuffer);
  try {
    const packageJsonFileContentObject = JSON.parse(
      packageJsonFileContentString,
    );
    return packageJsonFileContentObject;
  } catch {
    throw new Error(`Invalid package configuration at ${packageJsonFileUrl}`);
  }
};

// https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/tools/node_modules/eslint/node_modules/%40babel/core/lib/vendor/import-meta-resolve.js#L2473

const createInvalidModuleSpecifierError = (
  reason,
  specifier,
  { parentUrl },
) => {
  const error = new Error(
    `Invalid module "${specifier}" ${reason} imported from ${fileURLToPath(
      parentUrl,
    )}`,
  );
  error.code = "INVALID_MODULE_SPECIFIER";
  return error;
};

const createInvalidPackageTargetError = (
  reason,
  target,
  { parentUrl, packageDirectoryUrl, key, isImport },
) => {
  let message;
  if (key === ".") {
    message = `Invalid "exports" main target defined in ${fileURLToPath(
      packageDirectoryUrl,
    )}package.json imported from ${fileURLToPath(parentUrl)}; ${reason}`;
  } else {
    message = `Invalid "${
      isImport ? "imports" : "exports"
    }" target ${JSON.stringify(target)} defined for "${key}" in ${fileURLToPath(
      packageDirectoryUrl,
    )}package.json imported from ${fileURLToPath(parentUrl)}; ${reason}`;
  }
  const error = new Error(message);
  error.code = "INVALID_PACKAGE_TARGET";
  return error;
};

const createPackagePathNotExportedError = (
  subpath,
  { parentUrl, packageDirectoryUrl },
) => {
  let message;
  if (subpath === ".") {
    message = `No "exports" main defined in ${fileURLToPath(
      packageDirectoryUrl,
    )}package.json imported from ${fileURLToPath(parentUrl)}`;
  } else {
    message = `Package subpath "${subpath}" is not defined by "exports" in ${fileURLToPath(
      packageDirectoryUrl,
    )}package.json imported from ${fileURLToPath(parentUrl)}`;
  }
  const error = new Error(message);
  error.code = "PACKAGE_PATH_NOT_EXPORTED";
  return error;
};

const createModuleNotFoundError = (specifier, { parentUrl }) => {
  const error = new Error(
    `Cannot find "${specifier}" imported from ${fileURLToPath(parentUrl)}`,
  );
  error.code = "MODULE_NOT_FOUND";
  return error;
};

const createPackageImportNotDefinedError = (
  specifier,
  { parentUrl, packageDirectoryUrl },
) => {
  const error = new Error(
    `Package import specifier "${specifier}" is not defined in ${fileURLToPath(
      packageDirectoryUrl,
    )}package.json imported from ${fileURLToPath(parentUrl)}`,
  );
  error.code = "PACKAGE_IMPORT_NOT_DEFINED";
  return error;
};

const isSpecifierForNodeBuiltin = (specifier) => {
  return (
    specifier.startsWith("node:") ||
    NODE_BUILTIN_MODULE_SPECIFIERS.includes(specifier)
  );
};

const NODE_BUILTIN_MODULE_SPECIFIERS = [
  "assert",
  "assert/strict",
  "async_hooks",
  "buffer_ieee754",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "_debugger",
  "diagnostics_channel",
  "dgram",
  "dns",
  "domain",
  "events",
  "freelist",
  "fs",
  "fsevents",
  "fs/promises",
  "_http_agent",
  "_http_client",
  "_http_common",
  "_http_incoming",
  "_http_outgoing",
  "_http_server",
  "http",
  "http2",
  "https",
  "inspector",
  "_linklist",
  "module",
  "net",
  "node-inspect/lib/_inspect",
  "node-inspect/lib/internal/inspect_client",
  "node-inspect/lib/internal/inspect_repl",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "smalloc",
  "sqlite",
  "_stream_duplex",
  "_stream_transform",
  "_stream_wrap",
  "_stream_passthrough",
  "_stream_readable",
  "_stream_writable",
  "stream",
  "stream/promises",
  "string_decoder",
  "sys",
  "timers",
  "_tls_common",
  "_tls_legacy",
  "_tls_wrap",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8/tools/arguments",
  "v8/tools/codemap",
  "v8/tools/consarray",
  "v8/tools/csvparser",
  "v8/tools/logreader",
  "v8/tools/profile_view",
  "v8/tools/splaytree",
  "v8",
  "vm",
  "worker_threads",
  "zlib",
  // global is special
  "global",
];

/*
 * https://nodejs.org/api/esm.html#resolver-algorithm-specification
 * https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/lib/internal/modules/esm/resolve.js#L1
 * deviations from the spec:
 * - take into account "browser", "module" and "jsnext"
 * - the check for isDirectory -> throw is delayed is descoped to the caller
 * - the call to real path ->
 *   delayed to the caller so that we can decide to
 *   maintain symlink as facade url when it's outside project directory
 *   or use the real path when inside
 */

const applyNodeEsmResolution = ({
  specifier,
  parentUrl,
  conditions = [...readCustomConditionsFromProcessArgs(), "node", "import"],
  lookupPackageScope = defaultLookupPackageScope,
  readPackageJson = defaultReadPackageJson,
  preservesSymlink = false,
}) => {
  const resolution = applyPackageSpecifierResolution(specifier, {
    parentUrl: String(parentUrl),
    conditions,
    lookupPackageScope,
    readPackageJson,
    preservesSymlink,
  });
  const { url } = resolution;
  if (url.startsWith("file:")) {
    if (url.includes("%2F") || url.includes("%5C")) {
      throw createInvalidModuleSpecifierError(
        `must not include encoded "/" or "\\" characters`,
        specifier,
        {
          parentUrl,
        },
      );
    }
    return resolution;
  }
  return resolution;
};

const createResolutionResult = (data) => {
  return data;
};

const applyPackageSpecifierResolution = (specifier, resolutionContext) => {
  const { parentUrl } = resolutionContext;
  // relative specifier
  if (
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    if (specifier[0] !== "/") {
      const browserFieldResolution = applyBrowserFieldResolution(
        specifier,
        resolutionContext,
      );
      if (browserFieldResolution) {
        return browserFieldResolution;
      }
    }
    return createResolutionResult({
      type: "relative_specifier",
      url: new URL(specifier, parentUrl).href,
    });
  }
  if (specifier[0] === "#") {
    return applyPackageImportsResolution(specifier, resolutionContext);
  }
  try {
    const urlObject = new URL(specifier);
    if (specifier.startsWith("node:")) {
      return createResolutionResult({
        type: "node_builtin_specifier",
        url: specifier,
      });
    }
    return createResolutionResult({
      type: "absolute_specifier",
      url: urlObject.href,
    });
  } catch {
    // bare specifier
    const browserFieldResolution = applyBrowserFieldResolution(
      specifier,
      resolutionContext,
    );
    if (browserFieldResolution) {
      return browserFieldResolution;
    }
    const packageResolution = applyPackageResolve(specifier, resolutionContext);
    const search = new URL(specifier, "file:///").search;
    if (search && !new URL(packageResolution.url).search) {
      packageResolution.url = `${packageResolution.url}${search}`;
    }
    return packageResolution;
  }
};

const applyBrowserFieldResolution = (specifier, resolutionContext) => {
  const { parentUrl, conditions, lookupPackageScope, readPackageJson } =
    resolutionContext;
  const browserCondition = conditions.includes("browser");
  if (!browserCondition) {
    return null;
  }
  const packageDirectoryUrl = lookupPackageScope(parentUrl);
  if (!packageDirectoryUrl) {
    return null;
  }
  const packageJson = readPackageJson(packageDirectoryUrl);
  if (!packageJson) {
    return null;
  }
  const { browser } = packageJson;
  if (!browser) {
    return null;
  }
  if (typeof browser !== "object") {
    return null;
  }
  let url;
  if (specifier.startsWith(".")) {
    const specifierUrl = new URL(specifier, parentUrl).href;
    const specifierRelativeUrl = specifierUrl.slice(packageDirectoryUrl.length);
    const secifierRelativeNotation = `./${specifierRelativeUrl}`;
    const browserMapping = browser[secifierRelativeNotation];
    if (typeof browserMapping === "string") {
      url = new URL(browserMapping, packageDirectoryUrl).href;
    } else if (browserMapping === false) {
      url = `file:///@ignore/${specifierUrl.slice("file:///")}`;
    }
  } else {
    const browserMapping = browser[specifier];
    if (typeof browserMapping === "string") {
      url = new URL(browserMapping, packageDirectoryUrl).href;
    } else if (browserMapping === false) {
      url = `file:///@ignore/${specifier}`;
    }
  }
  if (url) {
    return createResolutionResult({
      type: "field:browser",
      isMain: true,
      packageDirectoryUrl,
      packageJson,
      url,
    });
  }
  return null;
};

const applyPackageImportsResolution = (
  internalSpecifier,
  resolutionContext,
) => {
  const { parentUrl, lookupPackageScope, readPackageJson } = resolutionContext;
  if (internalSpecifier === "#" || internalSpecifier.startsWith("#/")) {
    throw createInvalidModuleSpecifierError(
      "not a valid internal imports specifier name",
      internalSpecifier,
      resolutionContext,
    );
  }
  const packageDirectoryUrl = lookupPackageScope(parentUrl);
  if (packageDirectoryUrl !== null) {
    const packageJson = readPackageJson(packageDirectoryUrl);
    const { imports } = packageJson;
    if (imports !== null && typeof imports === "object") {
      const resolved = applyPackageImportsExportsResolution(internalSpecifier, {
        ...resolutionContext,
        packageDirectoryUrl,
        packageJson,
        isImport: true,
      });
      if (resolved) {
        return resolved;
      }
    }
  }
  throw createPackageImportNotDefinedError(internalSpecifier, {
    ...resolutionContext,
    packageDirectoryUrl,
  });
};

const applyPackageResolve = (packageSpecifier, resolutionContext) => {
  const { parentUrl, conditions, readPackageJson, preservesSymlink, isImport } =
    resolutionContext;
  if (packageSpecifier === "") {
    throw new Error("invalid module specifier");
  }
  if (
    conditions.includes("node") &&
    isSpecifierForNodeBuiltin(packageSpecifier)
  ) {
    return createResolutionResult({
      type: "node_builtin_specifier",
      url: `node:${packageSpecifier}`,
    });
  }
  let { packageName, packageSubpath } = parsePackageSpecifier(packageSpecifier);
  if (
    packageName[0] === "." ||
    packageName.includes("\\") ||
    packageName.includes("%")
  ) {
    throw createInvalidModuleSpecifierError(
      `is not a valid package name`,
      packageName,
      resolutionContext,
    );
  }
  if (isImport && packageSubpath.endsWith("/")) {
    throw new Error("invalid module specifier");
  }
  const questionCharIndex = packageName.indexOf("?");
  if (questionCharIndex > -1) {
    packageName = packageName.slice(0, questionCharIndex);
  }
  const selfResolution = applyPackageSelfResolution(packageSubpath, {
    ...resolutionContext,
    packageName,
  });
  if (selfResolution) {
    return selfResolution;
  }
  let currentUrl = parentUrl;
  while (currentUrl !== "file:///") {
    const packageDirectoryFacadeUrl = new URL(
      `node_modules/${packageName}/`,
      currentUrl,
    ).href;
    if (!existsSync(new URL(packageDirectoryFacadeUrl))) {
      currentUrl = getParentUrl(currentUrl);
      continue;
    }
    const packageDirectoryUrl = preservesSymlink
      ? packageDirectoryFacadeUrl
      : resolvePackageSymlink(packageDirectoryFacadeUrl);
    const packageJson = readPackageJson(packageDirectoryUrl);
    if (packageJson !== null) {
      const { exports: exports$1 } = packageJson;
      if (exports$1 !== null && exports$1 !== undefined) {
        return applyPackageExportsResolution(packageSubpath, {
          ...resolutionContext,
          packageDirectoryUrl,
          packageJson,
          exports: exports$1,
        });
      }
    }
    return applyLegacySubpathResolution(packageSubpath, {
      ...resolutionContext,
      packageDirectoryUrl,
      packageJson,
    });
  }
  throw createModuleNotFoundError(packageName, resolutionContext);
};

const applyPackageSelfResolution = (packageSubpath, resolutionContext) => {
  const { parentUrl, packageName, lookupPackageScope, readPackageJson } =
    resolutionContext;
  const packageDirectoryUrl = lookupPackageScope(parentUrl);
  if (!packageDirectoryUrl) {
    return undefined;
  }
  const packageJson = readPackageJson(packageDirectoryUrl);
  if (!packageJson) {
    return undefined;
  }
  if (packageJson.name !== packageName) {
    return undefined;
  }
  const { exports: exports$1 } = packageJson;
  if (!exports$1) {
    const subpathResolution = applyLegacySubpathResolution(packageSubpath, {
      ...resolutionContext,
      packageDirectoryUrl,
      packageJson,
    });
    if (subpathResolution && subpathResolution.type !== "subpath") {
      return subpathResolution;
    }
    return undefined;
  }
  return applyPackageExportsResolution(packageSubpath, {
    ...resolutionContext,
    packageDirectoryUrl,
    packageJson,
  });
};

// https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/lib/internal/modules/esm/resolve.js#L642
const applyPackageExportsResolution = (packageSubpath, resolutionContext) => {
  if (packageSubpath === ".") {
    const mainExport = applyMainExportResolution(resolutionContext);
    if (!mainExport) {
      throw createPackagePathNotExportedError(
        packageSubpath,
        resolutionContext,
      );
    }
    const resolved = applyPackageTargetResolution(mainExport, {
      ...resolutionContext,
      key: ".",
    });
    if (resolved) {
      return resolved;
    }
    throw createPackagePathNotExportedError(packageSubpath, resolutionContext);
  }
  const packageExportsInfo = readExports(resolutionContext);
  if (
    packageExportsInfo.type === "object" &&
    packageExportsInfo.allKeysAreRelative
  ) {
    const resolved = applyPackageImportsExportsResolution(packageSubpath, {
      ...resolutionContext,
      isImport: false,
    });
    if (resolved) {
      return resolved;
    }
  }
  throw createPackagePathNotExportedError(packageSubpath, resolutionContext);
};

const applyPackageImportsExportsResolution = (matchKey, resolutionContext) => {
  const { packageJson, isImport } = resolutionContext;
  const matchObject = isImport ? packageJson.imports : packageJson.exports;

  if (!matchKey.includes("*") && matchObject.hasOwnProperty(matchKey)) {
    const target = matchObject[matchKey];
    return applyPackageTargetResolution(target, {
      ...resolutionContext,
      key: matchKey,
      isImport,
    });
  }
  const expansionKeys = Object.keys(matchObject)
    .filter((key) => key.split("*").length === 2)
    .sort(comparePatternKeys);
  for (const expansionKey of expansionKeys) {
    const [patternBase, patternTrailer] = expansionKey.split("*");
    if (matchKey === patternBase) continue;
    if (!matchKey.startsWith(patternBase)) continue;
    if (patternTrailer.length > 0) {
      if (!matchKey.endsWith(patternTrailer)) continue;
      if (matchKey.length < expansionKey.length) continue;
    }
    const target = matchObject[expansionKey];
    const subpath = matchKey.slice(
      patternBase.length,
      matchKey.length - patternTrailer.length,
    );
    return applyPackageTargetResolution(target, {
      ...resolutionContext,
      key: matchKey,
      subpath,
      pattern: true,
      isImport,
    });
  }
  return null;
};

const applyPackageTargetResolution = (target, resolutionContext) => {
  const {
    conditions,
    packageDirectoryUrl,
    packageJson,
    key,
    subpath = "",
    pattern = false,
    isImport = false,
  } = resolutionContext;

  if (typeof target === "string") {
    if (pattern === false && subpath !== "" && !target.endsWith("/")) {
      throw new Error("invalid module specifier");
    }
    if (target.startsWith("./")) {
      const targetUrl = new URL(target, packageDirectoryUrl).href;
      if (!targetUrl.startsWith(packageDirectoryUrl)) {
        throw createInvalidPackageTargetError(
          `target must be inside package`,
          target,
          resolutionContext,
        );
      }
      return createResolutionResult({
        type: isImport ? "field:imports" : "field:exports",
        isMain: subpath === "" || subpath === ".",
        packageDirectoryUrl,
        packageJson,
        url: pattern
          ? targetUrl.replaceAll("*", subpath)
          : new URL(subpath, targetUrl).href,
      });
    }
    if (!isImport || target.startsWith("../") || isValidUrl(target)) {
      throw createInvalidPackageTargetError(
        `target must starst with "./"`,
        target,
        resolutionContext,
      );
    }
    return applyPackageResolve(
      pattern ? target.replaceAll("*", subpath) : `${target}${subpath}`,
      {
        ...resolutionContext,
        parentUrl: packageDirectoryUrl,
      },
    );
  }
  if (Array.isArray(target)) {
    if (target.length === 0) {
      return null;
    }
    let lastResult;
    let i = 0;
    while (i < target.length) {
      const targetValue = target[i];
      i++;
      try {
        const resolved = applyPackageTargetResolution(targetValue, {
          ...resolutionContext,
          key: `${key}[${i}]`,
          subpath,
          pattern,
          isImport,
        });
        if (resolved) {
          return resolved;
        }
        lastResult = resolved;
      } catch (e) {
        if (e.code === "INVALID_PACKAGE_TARGET") {
          continue;
        }
        lastResult = e;
      }
    }
    if (lastResult) {
      throw lastResult;
    }
    return null;
  }
  if (target === null) {
    return null;
  }
  if (typeof target === "object") {
    const keys = Object.keys(target);
    for (const key of keys) {
      if (Number.isInteger(key)) {
        throw new Error("Invalid package configuration");
      }
      let matched;
      if (key === "default") {
        matched = true;
      } else {
        for (const conditionCandidate of conditions) {
          if (conditionCandidate === key) {
            matched = true;
            break;
          }
          if (conditionCandidate.includes("*")) {
            const conditionCandidateRegex = new RegExp(
              `^${conditionCandidate.replace(/\*/g, "(.*)")}$`,
            );
            if (conditionCandidateRegex.test(key)) {
              matched = true;
              break;
            }
          }
        }
      }
      if (matched) {
        const targetValue = target[key];
        const resolved = applyPackageTargetResolution(targetValue, {
          ...resolutionContext,
          key,
          subpath,
          pattern,
          isImport,
        });
        if (resolved) {
          return resolved;
        }
      }
    }
    return null;
  }
  throw createInvalidPackageTargetError(
    `target must be a string, array, object or null`,
    target,
    resolutionContext,
  );
};

const readExports = ({ packageDirectoryUrl, packageJson }) => {
  const packageExports = packageJson.exports;
  if (Array.isArray(packageExports)) {
    return {
      type: "array",
    };
  }
  if (packageExports === null) {
    return {};
  }
  if (typeof packageExports === "object") {
    const keys = Object.keys(packageExports);
    const relativeKeys = [];
    const conditionalKeys = [];
    keys.forEach((availableKey) => {
      if (availableKey.startsWith(".")) {
        relativeKeys.push(availableKey);
      } else {
        conditionalKeys.push(availableKey);
      }
    });
    const hasRelativeKey = relativeKeys.length > 0;
    if (hasRelativeKey && conditionalKeys.length > 0) {
      throw new Error(
        `Invalid package configuration: cannot mix relative and conditional keys in package.exports
--- unexpected keys ---
${conditionalKeys.map((key) => `"${key}"`).join("\n")}
--- package directory url ---
${packageDirectoryUrl}`,
      );
    }
    return {
      type: "object",
      hasRelativeKey,
      allKeysAreRelative: relativeKeys.length === keys.length,
    };
  }
  if (typeof packageExports === "string") {
    return { type: "string" };
  }
  return {};
};

const parsePackageSpecifier = (packageSpecifier) => {
  if (packageSpecifier[0] === "@") {
    const firstSlashIndex = packageSpecifier.indexOf("/");
    if (firstSlashIndex === -1) {
      throw new Error("invalid module specifier");
    }
    const secondSlashIndex = packageSpecifier.indexOf("/", firstSlashIndex + 1);
    if (secondSlashIndex === -1) {
      return {
        packageName: packageSpecifier,
        packageSubpath: ".",
        isScoped: true,
      };
    }
    const packageName = packageSpecifier.slice(0, secondSlashIndex);
    const afterSecondSlash = packageSpecifier.slice(secondSlashIndex + 1);
    const packageSubpath = `./${afterSecondSlash}`;
    return {
      packageName,
      packageSubpath,
      isScoped: true,
    };
  }
  const firstSlashIndex = packageSpecifier.indexOf("/");
  if (firstSlashIndex === -1) {
    return {
      packageName: packageSpecifier,
      packageSubpath: ".",
    };
  }
  const packageName = packageSpecifier.slice(0, firstSlashIndex);
  const afterFirstSlash = packageSpecifier.slice(firstSlashIndex + 1);
  if (afterFirstSlash === "") {
    return {
      packageName,
      packageSubpath: "/",
    };
  }
  const packageSubpath = `./${afterFirstSlash}`;
  return {
    packageName,
    packageSubpath,
  };
};

const applyMainExportResolution = (resolutionContext) => {
  const { packageJson } = resolutionContext;
  const packageExportsInfo = readExports(resolutionContext);
  if (
    packageExportsInfo.type === "array" ||
    packageExportsInfo.type === "string"
  ) {
    return packageJson.exports;
  }
  if (packageExportsInfo.type === "object") {
    if (packageExportsInfo.hasRelativeKey) {
      return packageJson.exports["."];
    }
    return packageJson.exports;
  }
  return undefined;
};

const applyLegacySubpathResolution = (packageSubpath, resolutionContext) => {
  const { packageDirectoryUrl, packageJson } = resolutionContext;

  if (packageSubpath === ".") {
    return applyLegacyMainResolution(packageSubpath, resolutionContext);
  }
  const browserFieldResolution = applyBrowserFieldResolution(
    packageSubpath,
    resolutionContext,
  );
  if (browserFieldResolution) {
    return browserFieldResolution;
  }
  return createResolutionResult({
    type: "subpath",
    isMain: packageSubpath === ".",
    packageDirectoryUrl,
    packageJson,
    url: new URL(packageSubpath, packageDirectoryUrl).href,
  });
};

const applyLegacyMainResolution = (packageSubpath, resolutionContext) => {
  const { conditions, packageDirectoryUrl, packageJson } = resolutionContext;
  for (const condition of conditions) {
    const conditionResolver = mainLegacyResolvers[condition];
    if (!conditionResolver) {
      continue;
    }
    const resolved = conditionResolver(resolutionContext);
    if (resolved) {
      return createResolutionResult({
        type: resolved.type,
        isMain: resolved.isMain,
        packageDirectoryUrl,
        packageJson,
        url: new URL(resolved.path, packageDirectoryUrl).href,
      });
    }
  }
  return createResolutionResult({
    type: "field:main", // the absence of "main" field
    isMain: true,
    packageDirectoryUrl,
    packageJson,
    url: new URL("index.js", packageDirectoryUrl).href,
  });
};
const mainLegacyResolvers = {
  import: ({ packageJson }) => {
    if (typeof packageJson.module === "string") {
      return { type: "field:module", isMain: true, path: packageJson.module };
    }
    if (typeof packageJson.jsnext === "string") {
      return { type: "field:jsnext", isMain: true, path: packageJson.jsnext };
    }
    if (typeof packageJson.main === "string") {
      return { type: "field:main", isMain: true, path: packageJson.main };
    }
    return null;
  },
  browser: ({ packageDirectoryUrl, packageJson }) => {
    const browserMain = (() => {
      if (typeof packageJson.browser === "string") {
        return packageJson.browser;
      }
      if (
        typeof packageJson.browser === "object" &&
        packageJson.browser !== null
      ) {
        return packageJson.browser["."];
      }
      return "";
    })();

    if (!browserMain) {
      if (typeof packageJson.module === "string") {
        return {
          type: "field:module",
          isMain: true,
          path: packageJson.module,
        };
      }
      return null;
    }
    if (
      typeof packageJson.module !== "string" ||
      packageJson.module === browserMain
    ) {
      return {
        type: "field:browser",
        isMain: true,
        path: browserMain,
      };
    }
    const browserMainUrlObject = new URL(browserMain, packageDirectoryUrl);
    const content = readFileSync$1(browserMainUrlObject, "utf-8");
    if (
      (/typeof exports\s*==/.test(content) &&
        /typeof module\s*==/.test(content)) ||
      /module\.exports\s*=/.test(content)
    ) {
      return {
        type: "field:module",
        isMain: true,
        path: packageJson.module,
      };
    }
    return {
      type: "field:browser",
      isMain: true,
      path: browserMain,
    };
  },
  node: ({ packageJson, conditions }) => {
    if (conditions.includes("import") && !conditions.includes("require")) {
      if (typeof packageJson.module === "string") {
        return { type: "field:module", isMain: true, path: packageJson.module };
      }
      if (typeof packageJson.jsnext === "string") {
        return { type: "field:jsnext", isMain: true, path: packageJson.jsnext };
      }
    }
    if (typeof packageJson.main === "string") {
      return { type: "field:main", isMain: true, path: packageJson.main };
    }
    return null;
  },
};
mainLegacyResolvers.require = mainLegacyResolvers.node;

const comparePatternKeys = (keyA, keyB) => {
  if (!keyA.endsWith("/") && !keyA.includes("*")) {
    throw new Error("Invalid package configuration");
  }
  if (!keyB.endsWith("/") && !keyB.includes("*")) {
    throw new Error("Invalid package configuration");
  }
  const aStarIndex = keyA.indexOf("*");
  const baseLengthA = aStarIndex > -1 ? aStarIndex + 1 : keyA.length;
  const bStarIndex = keyB.indexOf("*");
  const baseLengthB = bStarIndex > -1 ? bStarIndex + 1 : keyB.length;
  if (baseLengthA > baseLengthB) {
    return -1;
  }
  if (baseLengthB > baseLengthA) {
    return 1;
  }
  if (aStarIndex === -1) {
    return 1;
  }
  if (bStarIndex === -1) {
    return -1;
  }
  if (keyA.length > keyB.length) {
    return -1;
  }
  if (keyB.length > keyA.length) {
    return 1;
  }
  return 0;
};

const resolvePackageSymlink = (packageDirectoryUrl) => {
  const packageDirectoryPath = realpathSync(new URL(packageDirectoryUrl));
  const packageDirectoryResolvedUrl = pathToFileURL(packageDirectoryPath).href;
  return `${packageDirectoryResolvedUrl}/`;
};

const applyFileSystemMagicResolution = (
  fileUrl,
  { fileStat, magicDirectoryIndex, magicExtensions },
) => {
  const result = {
    stat: null,
    url: fileUrl,
    magicExtension: "",
    magicDirectoryIndex: false,
    lastENOENTError: null,
  };

  if (fileStat === undefined) {
    try {
      fileStat = readEntryStatSync(new URL(fileUrl));
    } catch (e) {
      if (e.code === "ENOENT") {
        result.lastENOENTError = e;
        fileStat = null;
      } else {
        throw e;
      }
    }
  }

  if (fileStat && fileStat.isFile()) {
    result.stat = fileStat;
    result.url = fileUrl;
    return result;
  }
  if (fileStat && fileStat.isDirectory()) {
    if (magicDirectoryIndex) {
      const indexFileSuffix = fileUrl.endsWith("/") ? "index" : "/index";
      const indexFileUrl = `${fileUrl}${indexFileSuffix}`;
      const subResult = applyFileSystemMagicResolution(indexFileUrl, {
        magicDirectoryIndex: false,
        magicExtensions,
      });
      return {
        ...result,
        ...subResult,
        magicDirectoryIndex: true,
      };
    }
    result.stat = fileStat;
    result.url = fileUrl;
    return result;
  }

  if (magicExtensions && magicExtensions.length) {
    const parentUrl = new URL("./", fileUrl).href;
    const urlFilename = urlToFilename(fileUrl);
    for (const extensionToTry of magicExtensions) {
      const urlCandidate = `${parentUrl}${urlFilename}${extensionToTry}`;
      let stat;
      try {
        stat = readEntryStatSync(new URL(urlCandidate));
      } catch (e) {
        if (e.code === "ENOENT") {
          stat = null;
        } else {
          throw e;
        }
      }
      if (stat) {
        result.stat = stat;
        result.url = `${fileUrl}${extensionToTry}`;
        result.magicExtension = extensionToTry;
        return result;
      }
    }
  }
  // magic extension not found
  return result;
};

const getExtensionsToTry = (magicExtensions, importer) => {
  if (!magicExtensions) {
    return [];
  }
  const extensionsSet = new Set();
  magicExtensions.forEach((magicExtension) => {
    if (magicExtension === "inherit") {
      const importerExtension = urlToExtension(importer);
      extensionsSet.add(importerExtension);
    } else {
      extensionsSet.add(magicExtension);
    }
  });
  return Array.from(extensionsSet.values());
};

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

// default runtimeCompat corresponds to
// "we can keep <script type="module"> intact":
// so script_type_module + dynamic_import + import_meta
const browserDefaultRuntimeCompat = {
  // android: "8",
  chrome: "64",
  edge: "79",
  firefox: "67",
  ios: "12",
  opera: "51",
  safari: "11.3",
  samsung: "9.2",
};

const nodeDefaultRuntimeCompat = {
  node: process.version.slice(1),
};

const versionFromValue = (value) => {
  if (typeof value === "number") {
    return numberToVersion(value);
  }
  if (typeof value === "string") {
    return stringToVersion(value);
  }
  throw new TypeError(`version must be a number or a string, got ${value}`);
};

const numberToVersion = (number) => {
  return {
    major: number,
    minor: 0,
    patch: 0,
  };
};

const stringToVersion = (string) => {
  if (string.indexOf(".") > -1) {
    const parts = string.split(".");
    return {
      major: Number(parts[0]),
      minor: parts[1] ? Number(parts[1]) : 0,
      patch: parts[2] ? Number(parts[2]) : 0,
    };
  }

  if (isNaN(string)) {
    return {
      major: 0,
      minor: 0,
      patch: 0,
    };
  }

  return {
    major: Number(string),
    minor: 0,
    patch: 0,
  };
};

const compareTwoVersions = (versionA, versionB) => {
  const semanticVersionA = versionFromValue(versionA);
  const semanticVersionB = versionFromValue(versionB);
  const majorDiff = semanticVersionA.major - semanticVersionB.major;
  if (majorDiff > 0) {
    return majorDiff;
  }
  if (majorDiff < 0) {
    return majorDiff;
  }
  const minorDiff = semanticVersionA.minor - semanticVersionB.minor;
  if (minorDiff > 0) {
    return minorDiff;
  }
  if (minorDiff < 0) {
    return minorDiff;
  }
  const patchDiff = semanticVersionA.patch - semanticVersionB.patch;
  if (patchDiff > 0) {
    return patchDiff;
  }
  if (patchDiff < 0) {
    return patchDiff;
  }
  return 0;
};

const versionIsBelow = (versionSupposedBelow, versionSupposedAbove) => {
  return compareTwoVersions(versionSupposedBelow, versionSupposedAbove) < 0;
};

const findHighestVersion = (...values) => {
  if (values.length === 0) throw new Error(`missing argument`);
  return values.reduce((highestVersion, value) => {
    if (versionIsBelow(highestVersion, value)) {
      return value;
    }
    return highestVersion;
  });
};

const featuresCompatMap = {
  script_type_module: {
    edge: "16",
    firefox: "60",
    chrome: "61",
    safari: "10.1",
    opera: "48",
    ios: "10.3",
    android: "61",
    samsung: "8.2",
  },
  document_current_script: {
    edge: "12",
    firefox: "4",
    chrome: "29",
    safari: "8",
    opera: "16",
    android: "4.4",
    samsung: "4",
  },
  // https://caniuse.com/?search=import.meta
  import_meta: {
    android: "9",
    chrome: "64",
    edge: "79",
    firefox: "62",
    ios: "12",
    opera: "51",
    safari: "11.1",
    samsung: "9.2",
  },
  import_meta_resolve: {
    chrome: "107",
    edge: "105",
    firefox: "106",
    node: "20.0.0",
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#browser_compatibility
  import_dynamic: {
    android: "8",
    chrome: "63",
    edge: "79",
    firefox: "67",
    ios: "11.3",
    opera: "50",
    safari: "11.3",
    samsung: "8.0",
    node: "13.2",
  },
  top_level_await: {
    edge: "89",
    chrome: "89",
    firefox: "89",
    opera: "75",
    safari: "15",
    samsung: "15",
    ios: "15",
    node: "14.8",
  },
  // https://caniuse.com/import-maps
  importmap: {
    edge: "89",
    chrome: "89",
    opera: "76",
    samsung: "15",
    firefox: "108",
    safari: "16.4",
  },
  import_type_json: {
    chrome: "123",
    safari: "17.2",
  },
  import_type_css: {
    chrome: "123",
  },
  import_type_text: {},
  // https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet#browser_compatibility
  new_stylesheet: {
    chrome: "73",
    edge: "79",
    opera: "53",
    android: "73",
  },
  // https://caniuse.com/?search=worker
  worker: {
    ie: "10",
    edge: "12",
    firefox: "3.5",
    chrome: "4",
    opera: "11.5",
    safari: "4",
    ios: "5",
    android: "4.4",
  },
  // https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker#browser_compatibility
  worker_type_module: {
    chrome: "80",
    edge: "80",
    opera: "67",
    android: "80",
  },
  worker_importmap: {},
  service_worker: {
    edge: "17",
    firefox: "44",
    chrome: "40",
    safari: "11.1",
    opera: "27",
    ios: "11.3",
    android: "12.12",
  },
  service_worker_type_module: {
    chrome: "80",
    edge: "80",
    opera: "67",
    android: "80",
  },
  service_worker_importmap: {},
  shared_worker: {
    chrome: "4",
    edge: "79",
    firefox: "29",
    opera: "10.6",
  },
  shared_worker_type_module: {
    chrome: "80",
    edge: "80",
    opera: "67",
  },
  shared_worker_importmap: {},
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis#browser_compatibility
  global_this: {
    edge: "79",
    firefox: "65",
    chrome: "71",
    safari: "12.1",
    opera: "58",
    ios: "12.2",
    android: "94",
    node: "12",
  },
  async_generator_function: {
    chrome: "63",
    opera: "50",
    edge: "79",
    firefox: "57",
    safari: "12",
    node: "10",
    ios: "12",
    samsung: "8",
    electron: "3",
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#browser_compatibility
  template_literals: {
    chrome: "41",
    edge: "12",
    firefox: "34",
    opera: "28",
    safari: "9",
    ios: "9",
    android: "4",
    node: "4",
  },
  arrow_function: {
    chrome: "47",
    opera: "34",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "0.36",
  },
  const_bindings: {
    chrome: "41",
    opera: "28",
    edge: "12",
    firefox: "46",
    safari: "10",
    node: "4",
    ie: "11",
    ios: "10",
    samsung: "3.4",
    electron: "0.22",
  },
  object_properties_shorthand: {
    chrome: "43",
    opera: "30",
    edge: "12",
    firefox: "33",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    electron: "0.28",
  },
  reserved_words: {
    chrome: "13",
    opera: "10.50",
    edge: "12",
    firefox: "2",
    safari: "3.1",
    node: "0.10",
    ie: "9",
    android: "4.4",
    ios: "6",
    phantom: "2",
    samsung: "1",
    electron: "0.20",
  },
  symbols: {
    chrome: "38",
    opera: "25",
    edge: "12",
    firefox: "36",
    safari: "9",
    ios: "9",
    samsung: "4",
    node: "0.12",
  },
};

const RUNTIME_COMPAT = {
  featuresCompatMap,

  add: (originalRuntimeCompat, feature) => {
    const featureCompat = getFeatureCompat(feature);
    const runtimeCompat = {
      ...originalRuntimeCompat,
    };
    Object.keys(originalRuntimeCompat).forEach((runtimeName) => {
      const secondVersion = featureCompat[runtimeName]; // the version supported by the feature
      if (secondVersion) {
        const firstVersion = originalRuntimeCompat[runtimeName];
        runtimeCompat[runtimeName] = findHighestVersion(
          firstVersion,
          secondVersion,
        );
      }
    });
    return runtimeCompat;
  },

  isSupported: (
    runtimeCompat,
    feature,
    featureCompat = getFeatureCompat(feature),
  ) => {
    const runtimeNames = Object.keys(runtimeCompat);
    const runtimeWithoutCompat = runtimeNames.find((runtimeName) => {
      const runtimeVersion = runtimeCompat[runtimeName];
      const runtimeVersionCompatible = featureCompat[runtimeName] || "Infinity";
      const highestVersion = findHighestVersion(
        runtimeVersion,
        runtimeVersionCompatible,
      );
      return highestVersion !== runtimeVersion;
    });
    return !runtimeWithoutCompat;
  },
};

const getFeatureCompat = (feature) => {
  if (typeof feature === "string") {
    const compat = featuresCompatMap[feature];
    if (!compat) {
      throw new Error(`"${feature}" feature is unknown`);
    }
    return compat;
  }
  if (typeof feature !== "object") {
    throw new TypeError(
      `feature must be a string or an object, got ${feature}`,
    );
  }
  return feature;
};

const inferRuntimeCompatFromClosestPackage = async (
  sourceUrl,
  { runtimeType },
) => {
  const packageDirectoryUrl = lookupPackageDirectory(sourceUrl);
  if (!packageDirectoryUrl) {
    return null;
  }
  const packageJSON = readPackageAtOrNull(packageDirectoryUrl);
  if (!packageJSON) {
    return null;
  }

  if (runtimeType === "browser") {
    const browserlist = packageJSON.browserlist;
    if (!browserlist) {
      return null;
    }
    const namespace = await import("./browserslist_index/browserslist_index.js");
    const browserslist = namespace.default;
    const browserslistConfig = browserslist(browserlist);
    const runtimeCompat = {};
    for (const browserNameAndVersion of browserslistConfig) {
      let [name, version] = browserNameAndVersion.split(" ");
      if (name === "ios_saf") {
        name = "ios";
      }
      if (Object.keys(browserDefaultRuntimeCompat).includes(name)) {
        runtimeCompat[name] = version;
      }
    }
    return runtimeCompat;
  }

  const engines = packageJSON.engines;
  if (!engines) {
    return null;
  }
  const node = engines.node;
  const versionMatch = node.match(/[0-9*.]+/);
  if (!versionMatch) {
    return null;
  }
  return {
    node: versionMatch[0],
  };
};

const isSupportedAlgorithm = (algo) => {
  return SUPPORTED_ALGORITHMS.includes(algo);
};

// https://www.w3.org/TR/SRI/#priority
const getPrioritizedHashFunction = (firstAlgo, secondAlgo) => {
  const firstIndex = SUPPORTED_ALGORITHMS.indexOf(firstAlgo);
  const secondIndex = SUPPORTED_ALGORITHMS.indexOf(secondAlgo);
  if (firstIndex === secondIndex) {
    return "";
  }
  if (firstIndex < secondIndex) {
    return secondAlgo;
  }
  return firstAlgo;
};

const applyAlgoToRepresentationData = (algo, data) => {
  const base64Value = crypto.createHash(algo).update(data).digest("base64");
  return base64Value;
};

// keep this ordered by collision resistance as it is also used by "getPrioritizedHashFunction"
const SUPPORTED_ALGORITHMS = ["sha256", "sha384", "sha512"];

// see https://w3c.github.io/webappsec-subresource-integrity/#parse-metadata
const parseIntegrity = (string) => {
  const integrityMetadata = {};
  string
    .trim()
    .split(/\s+/)
    .forEach((token) => {
      const { isValid, algo, base64Value, optionExpression } =
        parseAsHashWithOptions(token);
      if (!isValid) {
        return;
      }
      if (!isSupportedAlgorithm(algo)) {
        return;
      }
      const metadataList = integrityMetadata[algo];
      const metadata = { base64Value, optionExpression };
      integrityMetadata[algo] = metadataList
        ? [...metadataList, metadata]
        : [metadata];
    });
  return integrityMetadata;
};

// see https://w3c.github.io/webappsec-subresource-integrity/#the-integrity-attribute
const parseAsHashWithOptions = (token) => {
  const dashIndex = token.indexOf("-");
  if (dashIndex === -1) {
    return { isValid: false };
  }
  const beforeDash = token.slice(0, dashIndex);
  const afterDash = token.slice(dashIndex + 1);
  const questionIndex = afterDash.indexOf("?");
  const algo = beforeDash;
  if (questionIndex === -1) {
    const base64Value = afterDash;
    const isValid = BASE64_REGEX.test(afterDash);
    return { isValid, algo, base64Value };
  }
  const base64Value = afterDash.slice(0, questionIndex);
  const optionExpression = afterDash.slice(questionIndex + 1);
  const isValid =
    BASE64_REGEX.test(afterDash) && VCHAR_REGEX.test(optionExpression);
  return { isValid, algo, base64Value, optionExpression };
};

const BASE64_REGEX = /^[A-Za-z0-9+/=]+$/;
const VCHAR_REGEX = /^[\x21-\x7E]+$/;

// https://www.w3.org/TR/SRI/#does-response-match-metadatalist
const validateResponseIntegrity = (
  { url, type, dataRepresentation },
  integrity,
) => {
  if (!isResponseEligibleForIntegrityValidation({ type })) {
    return false;
  }
  const integrityMetadata = parseIntegrity(integrity);
  const algos = Object.keys(integrityMetadata);
  if (algos.length === 0) {
    return true;
  }
  let strongestAlgo = algos[0];
  algos.slice(1).forEach((algoCandidate) => {
    strongestAlgo =
      getPrioritizedHashFunction(strongestAlgo, algoCandidate) || strongestAlgo;
  });
  const metadataList = integrityMetadata[strongestAlgo];
  const actualBase64Value = applyAlgoToRepresentationData(
    strongestAlgo,
    dataRepresentation,
  );
  const acceptedBase64Values = metadataList.map(
    (metadata) => metadata.base64Value,
  );
  const someIsMatching = acceptedBase64Values.includes(actualBase64Value);
  if (someIsMatching) {
    return true;
  }
  const error = new Error(
    `Integrity validation failed for resource "${url}". The integrity found for this resource is "${strongestAlgo}-${actualBase64Value}"`,
  );
  error.code = "EINTEGRITY";
  error.algorithm = strongestAlgo;
  error.found = actualBase64Value;
  throw error;
};

// https://www.w3.org/TR/SRI/#is-response-eligible-for-integrity-validation
const isResponseEligibleForIntegrityValidation = (response) => {
  return ["basic", "cors", "default"].includes(response.type);
};

const assertImportMap = (value) => {
  if (value === null) {
    throw new TypeError(`an importMap must be an object, got null`);
  }

  const type = typeof value;
  if (type !== "object") {
    throw new TypeError(`an importMap must be an object, received ${value}`);
  }

  if (Array.isArray(value)) {
    throw new TypeError(
      `an importMap must be an object, received array ${value}`,
    );
  }
};

// duplicated from @jsenv/log to avoid the dependency
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

const hasScheme = (string) => {
  return /^[a-zA-Z]{2,}:/.test(string);
};

const pathnameToParentPathname = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return "/";
  }

  return pathname.slice(0, slashLastIndex + 1);
};

const urlToScheme = (urlString) => {
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) return "";
  return urlString.slice(0, colonIndex);
};

const urlToOrigin = (urlString) => {
  const scheme = urlToScheme(urlString);

  if (scheme === "file") {
    return "file://";
  }

  if (scheme === "http" || scheme === "https") {
    const secondProtocolSlashIndex = scheme.length + "://".length;
    const pathnameSlashIndex = urlString.indexOf("/", secondProtocolSlashIndex);

    if (pathnameSlashIndex === -1) return urlString;
    return urlString.slice(0, pathnameSlashIndex);
  }

  return urlString.slice(0, scheme.length + 1);
};

const urlToPathname = (urlString) => {
  return ressourceToPathname(urlToRessource(urlString));
};

const urlToRessource = (urlString) => {
  const scheme = urlToScheme(urlString);

  if (scheme === "file") {
    return urlString.slice("file://".length);
  }

  if (scheme === "https" || scheme === "http") {
    // remove origin
    const afterProtocol = urlString.slice(scheme.length + "://".length);
    const pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
    return afterProtocol.slice(pathnameSlashIndex);
  }

  return urlString.slice(scheme.length + 1);
};

const ressourceToPathname = (ressource) => {
  const searchSeparatorIndex = ressource.indexOf("?");
  return searchSeparatorIndex === -1
    ? ressource
    : ressource.slice(0, searchSeparatorIndex);
};

// could be useful: https://url.spec.whatwg.org/#url-miscellaneous


const resolveUrl = (specifier, baseUrl) => {
  if (baseUrl) {
    if (typeof baseUrl !== "string") {
      throw new TypeError(writeBaseUrlMustBeAString({ baseUrl, specifier }));
    }
    if (!hasScheme(baseUrl)) {
      throw new Error(writeBaseUrlMustBeAbsolute({ baseUrl, specifier }));
    }
  }

  if (hasScheme(specifier)) {
    return specifier;
  }

  if (!baseUrl) {
    throw new Error(writeBaseUrlRequired({ baseUrl, specifier }));
  }

  // scheme relative
  if (specifier.slice(0, 2) === "//") {
    return `${urlToScheme(baseUrl)}:${specifier}`;
  }

  // origin relative
  if (specifier[0] === "/") {
    return `${urlToOrigin(baseUrl)}${specifier}`;
  }

  const baseOrigin = urlToOrigin(baseUrl);
  const basePathname = urlToPathname(baseUrl);

  if (specifier === ".") {
    const baseDirectoryPathname = pathnameToParentPathname(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}`;
  }

  // pathname relative inside
  if (specifier.slice(0, 2) === "./") {
    const baseDirectoryPathname = pathnameToParentPathname(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}${specifier.slice(2)}`;
  }

  // pathname relative outside
  if (specifier.slice(0, 3) === "../") {
    let unresolvedPathname = specifier;
    const importerFolders = basePathname.split("/");
    importerFolders.pop();

    while (unresolvedPathname.slice(0, 3) === "../") {
      unresolvedPathname = unresolvedPathname.slice(3);
      // when there is no folder left to resolved
      // we just ignore '../'
      if (importerFolders.length) {
        importerFolders.pop();
      }
    }

    const resolvedPathname = `${importerFolders.join(
      "/",
    )}/${unresolvedPathname}`;
    return `${baseOrigin}${resolvedPathname}`;
  }

  // bare
  if (basePathname === "") {
    return `${baseOrigin}/${specifier}`;
  }
  if (basePathname[basePathname.length] === "/") {
    return `${baseOrigin}${basePathname}${specifier}`;
  }
  return `${baseOrigin}${pathnameToParentPathname(basePathname)}${specifier}`;
};

const writeBaseUrlMustBeAString = ({
  baseUrl,
  specifier,
}) => `baseUrl must be a string.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const writeBaseUrlMustBeAbsolute = ({
  baseUrl,
  specifier,
}) => `baseUrl must be absolute.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const writeBaseUrlRequired = ({
  baseUrl,
  specifier,
}) => `baseUrl required to resolve relative specifier.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const tryUrlResolution = (string, url) => {
  const result = resolveUrl(string, url);
  return hasScheme(result) ? result : null;
};

const resolveSpecifier = (specifier, importer) => {
  if (
    specifier === "." ||
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    return resolveUrl(specifier, importer);
  }

  if (hasScheme(specifier)) {
    return specifier;
  }

  return null;
};

const applyImportMap = ({
  importMap,
  specifier,
  importer,
  createBareSpecifierError = ({ specifier, importer }) => {
    return new Error(
      createDetailedMessage(`Unmapped bare specifier.`, {
        specifier,
        importer,
      }),
    );
  },
  onImportMapping = () => {},
}) => {
  assertImportMap(importMap);
  if (typeof specifier !== "string") {
    throw new TypeError(
      createDetailedMessage("specifier must be a string.", {
        specifier,
        importer,
      }),
    );
  }
  if (importer) {
    if (typeof importer !== "string") {
      throw new TypeError(
        createDetailedMessage("importer must be a string.", {
          importer,
          specifier,
        }),
      );
    }
    if (!hasScheme(importer)) {
      throw new Error(
        createDetailedMessage(`importer must be an absolute url.`, {
          importer,
          specifier,
        }),
      );
    }
  }

  const specifierUrl = resolveSpecifier(specifier, importer);
  const specifierNormalized = specifierUrl || specifier;

  const { scopes } = importMap;
  if (scopes && importer) {
    const scopeSpecifierMatching = Object.keys(scopes).find(
      (scopeSpecifier) => {
        return (
          scopeSpecifier === importer ||
          specifierIsPrefixOf(scopeSpecifier, importer)
        );
      },
    );
    if (scopeSpecifierMatching) {
      const scopeMappings = scopes[scopeSpecifierMatching];
      const mappingFromScopes = applyMappings(
        scopeMappings,
        specifierNormalized,
        scopeSpecifierMatching,
        onImportMapping,
      );
      if (mappingFromScopes !== null) {
        return mappingFromScopes;
      }
    }
  }

  const { imports } = importMap;
  if (imports) {
    const mappingFromImports = applyMappings(
      imports,
      specifierNormalized,
      undefined,
      onImportMapping,
    );
    if (mappingFromImports !== null) {
      return mappingFromImports;
    }
  }

  if (specifierUrl) {
    return specifierUrl;
  }

  throw createBareSpecifierError({ specifier, importer });
};

const applyMappings = (
  mappings,
  specifierNormalized,
  scope,
  onImportMapping,
) => {
  const specifierCandidates = Object.keys(mappings);

  let i = 0;
  while (i < specifierCandidates.length) {
    const specifierCandidate = specifierCandidates[i];
    i++;
    if (specifierCandidate === specifierNormalized) {
      const address = mappings[specifierCandidate];
      onImportMapping({
        scope,
        from: specifierCandidate,
        to: address,
        before: specifierNormalized,
        after: address,
      });
      return address;
    }
    if (specifierIsPrefixOf(specifierCandidate, specifierNormalized)) {
      const address = mappings[specifierCandidate];
      const afterSpecifier = specifierNormalized.slice(
        specifierCandidate.length,
      );
      const addressFinal = tryUrlResolution(afterSpecifier, address);
      onImportMapping({
        scope,
        from: specifierCandidate,
        to: address,
        before: specifierNormalized,
        after: addressFinal,
      });
      return addressFinal;
    }
  }

  return null;
};

const specifierIsPrefixOf = (specifierHref, href) => {
  return (
    specifierHref[specifierHref.length - 1] === "/" &&
    href.startsWith(specifierHref)
  );
};

// https://github.com/systemjs/systemjs/blob/89391f92dfeac33919b0223bbf834a1f4eea5750/src/common.js#L136

const composeTwoImportMaps = (leftImportMap, rightImportMap) => {
  assertImportMap(leftImportMap);
  assertImportMap(rightImportMap);

  const importMap = {};

  const leftImports = leftImportMap.imports;
  const rightImports = rightImportMap.imports;
  const leftHasImports = Boolean(leftImports);
  const rightHasImports = Boolean(rightImports);
  if (leftHasImports && rightHasImports) {
    importMap.imports = composeTwoMappings(leftImports, rightImports);
  } else if (leftHasImports) {
    importMap.imports = { ...leftImports };
  } else if (rightHasImports) {
    importMap.imports = { ...rightImports };
  }

  const leftScopes = leftImportMap.scopes;
  const rightScopes = rightImportMap.scopes;
  const leftHasScopes = Boolean(leftScopes);
  const rightHasScopes = Boolean(rightScopes);
  if (leftHasScopes && rightHasScopes) {
    importMap.scopes = composeTwoScopes(
      leftScopes,
      rightScopes,
      importMap.imports || {},
    );
  } else if (leftHasScopes) {
    importMap.scopes = { ...leftScopes };
  } else if (rightHasScopes) {
    importMap.scopes = { ...rightScopes };
  }

  return importMap;
};

const composeTwoMappings = (leftMappings, rightMappings) => {
  const mappings = {};

  Object.keys(leftMappings).forEach((leftSpecifier) => {
    if (objectHasKey(rightMappings, leftSpecifier)) {
      // will be overidden
      return;
    }
    const leftAddress = leftMappings[leftSpecifier];
    const rightSpecifier = Object.keys(rightMappings).find((rightSpecifier) => {
      return compareAddressAndSpecifier(leftAddress, rightSpecifier);
    });
    mappings[leftSpecifier] = rightSpecifier
      ? rightMappings[rightSpecifier]
      : leftAddress;
  });

  Object.keys(rightMappings).forEach((rightSpecifier) => {
    mappings[rightSpecifier] = rightMappings[rightSpecifier];
  });

  return mappings;
};

const objectHasKey = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const compareAddressAndSpecifier = (address, specifier) => {
  const addressUrl = resolveUrl(address, "file:///");
  const specifierUrl = resolveUrl(specifier, "file:///");
  return addressUrl === specifierUrl;
};

const composeTwoScopes = (leftScopes, rightScopes, imports) => {
  const scopes = {};

  Object.keys(leftScopes).forEach((leftScopeKey) => {
    if (objectHasKey(rightScopes, leftScopeKey)) {
      // will be merged
      scopes[leftScopeKey] = leftScopes[leftScopeKey];
      return;
    }
    const topLevelSpecifier = Object.keys(imports).find(
      (topLevelSpecifierCandidate) => {
        return compareAddressAndSpecifier(
          leftScopeKey,
          topLevelSpecifierCandidate,
        );
      },
    );
    if (topLevelSpecifier) {
      scopes[imports[topLevelSpecifier]] = leftScopes[leftScopeKey];
    } else {
      scopes[leftScopeKey] = leftScopes[leftScopeKey];
    }
  });

  Object.keys(rightScopes).forEach((rightScopeKey) => {
    if (objectHasKey(scopes, rightScopeKey)) {
      scopes[rightScopeKey] = composeTwoMappings(
        scopes[rightScopeKey],
        rightScopes[rightScopeKey],
      );
    } else {
      scopes[rightScopeKey] = {
        ...rightScopes[rightScopeKey],
      };
    }
  });

  return scopes;
};

const sortImports = (imports) => {
  const mappingsSorted = {};

  Object.keys(imports)
    .sort(compareLengthOrLocaleCompare)
    .forEach((name) => {
      mappingsSorted[name] = imports[name];
    });

  return mappingsSorted;
};

const sortScopes = (scopes) => {
  const scopesSorted = {};

  Object.keys(scopes)
    .sort(compareLengthOrLocaleCompare)
    .forEach((scopeSpecifier) => {
      scopesSorted[scopeSpecifier] = sortImports(scopes[scopeSpecifier]);
    });

  return scopesSorted;
};

const compareLengthOrLocaleCompare = (a, b) => {
  return b.length - a.length || a.localeCompare(b);
};

const normalizeImportMap = (importMap, baseUrl) => {
  assertImportMap(importMap);

  if (!isStringOrUrl(baseUrl)) {
    throw new TypeError(formulateBaseUrlMustBeStringOrUrl({ baseUrl }));
  }

  const { imports, scopes } = importMap;

  return {
    imports: imports ? normalizeMappings(imports, baseUrl) : undefined,
    scopes: scopes ? normalizeScopes(scopes, baseUrl) : undefined,
  };
};

const isStringOrUrl = (value) => {
  if (typeof value === "string") {
    return true;
  }

  if (typeof URL === "function" && value instanceof URL) {
    return true;
  }

  return false;
};

const normalizeMappings = (mappings, baseUrl) => {
  const mappingsNormalized = {};

  Object.keys(mappings).forEach((specifier) => {
    const address = mappings[specifier];

    if (typeof address !== "string") {
      console.warn(
        formulateAddressMustBeAString({
          address,
          specifier,
        }),
      );
      return;
    }

    const specifierResolved = resolveSpecifier(specifier, baseUrl) || specifier;

    const addressUrl = tryUrlResolution(address, baseUrl);
    if (addressUrl === null) {
      console.warn(
        formulateAdressResolutionFailed({
          address,
          baseUrl,
          specifier,
        }),
      );
      return;
    }

    if (specifier.endsWith("/") && !addressUrl.endsWith("/")) {
      console.warn(
        formulateAddressUrlRequiresTrailingSlash({
          address,
          specifier,
        }),
      );
      return;
    }
    mappingsNormalized[specifierResolved] = addressUrl;
  });

  return sortImports(mappingsNormalized);
};

const normalizeScopes = (scopes, baseUrl) => {
  const scopesNormalized = {};

  Object.keys(scopes).forEach((scopeSpecifier) => {
    const scopeMappings = scopes[scopeSpecifier];
    const scopeUrl = tryUrlResolution(scopeSpecifier, baseUrl);
    if (scopeUrl === null) {
      console.warn(
        formulateScopeResolutionFailed({
          scope: scopeSpecifier,
          baseUrl,
        }),
      );
      return;
    }
    const scopeValueNormalized = normalizeMappings(scopeMappings, baseUrl);
    scopesNormalized[scopeUrl] = scopeValueNormalized;
  });

  return sortScopes(scopesNormalized);
};

const formulateBaseUrlMustBeStringOrUrl = ({
  baseUrl,
}) => `baseUrl must be a string or an url.
--- base url ---
${baseUrl}`;

const formulateAddressMustBeAString = ({
  specifier,
  address,
}) => `Address must be a string.
--- address ---
${address}
--- specifier ---
${specifier}`;

const formulateAdressResolutionFailed = ({
  address,
  baseUrl,
  specifier,
}) => `Address url resolution failed.
--- address ---
${address}
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const formulateAddressUrlRequiresTrailingSlash = ({
  addressURL,
  address,
  specifier,
}) => `Address must end with /.
--- address url ---
${addressURL}
--- address ---
${address}
--- specifier ---
${specifier}`;

const formulateScopeResolutionFailed = ({
  scope,
  baseUrl,
}) => `Scope url resolution failed.
--- scope ---
${scope}
--- base url ---
${baseUrl}`;

const pathnameToExtension = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex !== -1) {
    pathname = pathname.slice(slashLastIndex + 1);
  }

  const dotLastIndex = pathname.lastIndexOf(".");
  if (dotLastIndex === -1) return "";
  // if (dotLastIndex === pathname.length - 1) return ""
  return pathname.slice(dotLastIndex);
};

const resolveImport = ({
  specifier,
  importer,
  importMap,
  defaultExtension = false,
  createBareSpecifierError,
  onImportMapping = () => {},
}) => {
  let url;
  if (importMap) {
    url = applyImportMap({
      importMap,
      specifier,
      importer,
      createBareSpecifierError,
      onImportMapping,
    });
  } else {
    url = resolveUrl(specifier, importer);
  }

  if (defaultExtension) {
    url = applyDefaultExtension({ url, importer, defaultExtension });
  }

  return url;
};

const applyDefaultExtension = ({ url, importer, defaultExtension }) => {
  if (urlToPathname(url).endsWith("/")) {
    return url;
  }

  if (typeof defaultExtension === "string") {
    const extension = pathnameToExtension(url);
    if (extension === "") {
      return `${url}${defaultExtension}`;
    }
    return url;
  }

  if (defaultExtension === true) {
    const extension = pathnameToExtension(url);
    if (extension === "" && importer) {
      const importerPathname = urlToPathname(importer);
      const importerExtension = pathnameToExtension(importerPathname);
      return `${url}${importerExtension}`;
    }
  }

  return url;
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

const JS_QUOTES = {
  pickBest: (string, { canUseTemplateString, defaultQuote = DOUBLE } = {}) => {
    // check default first, once tested do no re-test it
    if (!string.includes(defaultQuote)) {
      return defaultQuote;
    }
    if (defaultQuote !== DOUBLE && !string.includes(DOUBLE)) {
      return DOUBLE;
    }
    if (defaultQuote !== SINGLE && !string.includes(SINGLE)) {
      return SINGLE;
    }
    if (
      canUseTemplateString &&
      defaultQuote !== BACKTICK &&
      !string.includes(BACKTICK)
    ) {
      return BACKTICK;
    }
    return defaultQuote;
  },

  escapeSpecialChars: (
    string,
    {
      quote = "pickBest",
      canUseTemplateString,
      defaultQuote,
      allowEscapeForVersioning = false,
    },
  ) => {
    quote =
      quote === "pickBest"
        ? JS_QUOTES.pickBest(string, { canUseTemplateString, defaultQuote })
        : quote;
    const replacements = JS_QUOTE_REPLACEMENTS[quote];
    let result = "";
    let last = 0;
    let i = 0;
    while (i < string.length) {
      const char = string[i];
      i++;
      if (isEscaped(i - 1, string)) continue;
      const replacement = replacements[char];
      if (replacement) {
        if (
          allowEscapeForVersioning &&
          char === quote &&
          string.slice(i, i + 6) === "+__v__"
        ) {
          let isVersioningConcatenation = false;
          let j = i + 6; // start after the +
          while (j < string.length) {
            const lookAheadChar = string[j];
            j++;
            if (
              lookAheadChar === "+" &&
              string[j] === quote &&
              !isEscaped(j - 1, string)
            ) {
              isVersioningConcatenation = true;
              break;
            }
          }
          if (isVersioningConcatenation) {
            // it's a concatenation
            // skip until the end of concatenation (the second +)
            // and resume from there
            i = j + 1;
            continue;
          }
        }
        if (last === i - 1) {
          result += replacement;
        } else {
          result += `${string.slice(last, i - 1)}${replacement}`;
        }
        last = i;
      }
    }
    if (last !== string.length) {
      result += string.slice(last);
    }
    return `${quote}${result}${quote}`;
  },
};

const DOUBLE = `"`;
const SINGLE = `'`;
const BACKTICK = "`";
const lineEndingEscapes = {
  "\n": "\\n",
  "\r": "\\r",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};
const JS_QUOTE_REPLACEMENTS = {
  [DOUBLE]: {
    '"': '\\"',
    ...lineEndingEscapes,
  },
  [SINGLE]: {
    "'": "\\'",
    ...lineEndingEscapes,
  },
  [BACKTICK]: {
    "`": "\\`",
    "$": "\\$",
  },
};

const COLORS = {
  RED: ANSI.RED,
  BLUE: ANSI.BLUE,
  YELLOW: ANSI.YELLOW,
  GREEN: ANSI.GREEN,
  MAGENTA: ANSI.MAGENTA,
  CYAN: ANSI.CYAN,
  WHITE: ANSI.WHITE,
  BLACK: ANSI.BLACK,
  GREY: ANSI.GREY,
};

const pickBorderColor = (...borders) => {
  if (borders.length === 0) {
    return borders[0].color;
  }
  if (borders.lenth === 2) {
    const [first, second] = borders;
    const firstColor = first.color;
    const secondColor = second.color;
    return compareTwoColors(firstColor, secondColor) === 1
      ? secondColor
      : firstColor;
  }
  return borders.map((border) => border.color).sort()[0];
};

const compareTwoColors = (a, b) => {
  if (!b && !a) {
    return 0;
  }
  if (!b) {
    return 1;
  }
  if (!a) {
    return 1;
  }
  const aPrio = COLORS_PRIO.indexOf(a);
  const bPrio = COLORS_PRIO.indexOf(b);
  return aPrio - bPrio;
};
const COLORS_PRIO = [
  COLORS.GREY,
  COLORS.WHITE,
  COLORS.BLACK,
  COLORS.BLUE,
  COLORS.CYAN,
  COLORS.MAGENTA,
  COLORS.GREEN,
  COLORS.YELLOW,
  COLORS.RED,
];

const groupDigits = (digitsAsString) => {
  const digitCount = digitsAsString.length;
  if (digitCount < 4) {
    return digitsAsString;
  }

  let digitsWithSeparator = digitsAsString.slice(-3);
  let remainingDigits = digitsAsString.slice(0, -3);
  while (remainingDigits.length) {
    const group = remainingDigits.slice(-3);
    remainingDigits = remainingDigits.slice(0, -3);
    digitsWithSeparator = `${group}_${digitsWithSeparator}`;
  }
  return digitsWithSeparator;
};

const tokenizeInteger = (integerValue) => {
  const integerAsString = String(integerValue);
  const exponentIndex = integerAsString.indexOf("e");
  if (exponentIndex === -1) {
    return { integer: integerAsString };
  }
  const digitsAsString = integerAsString.slice(0, exponentIndex);
  const digitsValue = parseFloat(digitsAsString);
  const digitParts = tokenizeNonExponentialFloat(digitsValue);
  const digitsInteger = digitParts.integer;
  const digitsDecimal = digitParts.decimal;
  const afterExponent = integerAsString.slice(exponentIndex + 2); // "e" + "+"
  const numberOfTrailingZero = parseInt(afterExponent);
  let integer = "";
  integer = digitsInteger;
  integer += digitsDecimal;
  integer += afterExponent;
  integer += "0".repeat(numberOfTrailingZero);
  return { integer };
};

// see https://github.com/shrpne/from-exponential/blob/master/src/index.js
// https://github.com/shrpne/from-exponential/blob/master/test/index.test.js
const tokenizeFloat = (floatValue) => {
  const floatAsString = String(floatValue);
  const exponentIndex = floatAsString.indexOf("e");
  if (exponentIndex === -1) {
    return tokenizeNonExponentialFloat(floatValue);
  }
  let decimal = "";
  let numberOfLeadingZero;
  const digitsAsString = floatAsString.slice(0, exponentIndex);
  const digitsValue = parseFloat(digitsAsString);
  const digitParts = tokenizeNonExponentialFloat(digitsValue);
  const digitsInteger = digitParts.integer;
  const digitsDecimal = digitParts.decimal;
  const decimalSeparator = digitsDecimal ? digitParts.decimalSeparator : ".";
  const afterExponent = floatAsString.slice(exponentIndex + 2); // "e" + "-"
  numberOfLeadingZero = parseInt(afterExponent);
  decimal += "0".repeat(numberOfLeadingZero);
  decimal += digitsInteger;
  decimal += digitsDecimal;
  return {
    integer: "0",
    decimalSeparator,
    decimal,
  };
};

const tokenizeNonExponentialFloat = (floatValue) => {
  const floatString = String(floatValue);
  const integer = Math.floor(floatValue);
  const integerAsString = String(integer);
  const decimalSeparator = floatString[integerAsString.length];
  const decimal = floatString.slice(integerAsString.length + 1);
  return {
    integer: integerAsString,
    decimalSeparator,
    decimal,
  };
};

// tokenizeFloat(1.2e-7);
// tokenizeFloat(2e-7);

/**
 * https://www.w3.org/TR/xml-entity-names/025.html?fbclid=IwZXh0bgNhZW0CMTEAAR0jL81PDwl6kfzRMUvjOSIfmuesvCdqr11lQpOS-9bpx7u1Q2LD1G7fJ1E_aem_URrWt-55lP_byLA6tjLleQ
 * https://www.w3schools.com/charsets/ref_utf_box.asp
 *
 *
 */


// blank node is a fluid node that will take whatever size it will be requested to take
// this is useful to enforce a given amount of space is taken in x/y
// It is used to implement borders because any cell can suddenly
// enable a border on X/Y meaning all previous cells must now have blank spaces where the border is
const blankNode = {
  type: "blank",
  rects: [
    { width: "fill", render: ({ columnWidth }) => " ".repeat(columnWidth) },
  ],
};
const createBlankNode = () => {
  return blankNode;
};

const getHorizontalLineChar = (style, bold) => {
  const char = {
    solid: ["─", "━"],
    dash: ["╌", "╍"],
    dash_3: ["┄", "┅"],
    dash_4: ["┈", "┉"],
    double: ["═", "═"],
  }[style][bold ? 1 : 0];
  return char;
};
const getVerticalLineChar = (style, bold) => {
  const char = {
    solid: ["│", "┃"],
    dash: ["╎", "╏"],
    dash_3: ["┆", "┇"],
    dash_4: ["┊", "┋"],
    double: ["║", "║"],
  }[style][bold ? 1 : 0];
  return char;
};

// sides
const createBorderLeftNode = ({ style = "solid", bold, color }) => {
  const char = getVerticalLineChar(style, bold);
  return {
    type: "border_left",
    rects: [{ width: 1, color, render: char }],
    xAlign: "end",
    yAlign: "center",
    yPadChar: char,
  };
};
const createBorderRightNode = ({ style = "solid", bold, color }) => {
  const char = getVerticalLineChar(style, bold);
  return {
    type: "border_right",
    rects: [{ width: 1, color, render: char }],
    xAlign: "start",
    yAlign: "center",
    yPadChar: char,
  };
};
const createBorderTopNode = ({ style = "solid", bold, color }) => {
  const char = getHorizontalLineChar(style, bold);
  return {
    type: "border_top",
    rects: [
      {
        width: "fill",
        color,
        render: ({ columnWidth }) => char.repeat(columnWidth),
      },
    ],
    yAlign: "end",
  };
};
const createBorderBottomNode = ({ style = "solid", bold, color }) => {
  const char = getHorizontalLineChar(style, bold);
  return {
    type: "border_bottom",
    rects: [
      {
        width: "fill",
        color,
        render: ({ columnWidth }) => char.repeat(columnWidth),
      },
    ],
    yAlign: "start",
  };
};
// half sides
const createBorderHalfLeftNode = ({ style = "solid", bold, color }) => {
  return {
    type: "border_half_left",
    rects: [
      {
        width: 1,
        color,
        render: bold ? "╸" : "╴",
      },
    ],
    xAlign: "end",
    xPadChar: getHorizontalLineChar(style, bold),
    yAlign: "end",
  };
};
const createBorderHalfRightNode = ({ style = "solid", bold, color }) => {
  return {
    type: "border_half_right",
    rects: [
      {
        width: 1,
        color,
        render: bold ? "╺" : "╶",
      },
    ],
    xAlign: "end",
    xPadChar: getHorizontalLineChar(style, bold),
    yAlign: "end",
  };
};
const createBorderHalfUpNode = ({ style = "solid", bold, color }) => {
  return {
    type: "border_half_up",
    rects: [
      {
        width: 1,
        color,
        render: bold ? "╹" : "╵",
      },
    ],
    xAlign: "start",
    yAlign: "start",
    yPadChar: getVerticalLineChar(style, bold),
  };
};
const createBorderHalfDownNode = ({ style = "solid", bold, color }) => {
  return {
    type: "border_half_down",
    rects: [
      {
        width: 1,
        color,
        render: bold ? "╻" : "╷",
      },
    ],
    xAlign: "end",
    yAlign: "start",
    yPadChar: getVerticalLineChar(style, bold),
  };
};

const topLeftCharProps = {
  "╔": { xPadChar: "║", yPadChar: "═" },
  "╒": { xPadChar: "═", yPadChar: "│" },
  "╓": { xPadChar: "─", yPadChar: "║" },
  "┌": { xPadChar: "│", yPadChar: "─" },
  "┏": { xPadChar: "┃", yPadChar: "━" },
  "┍": { xPadChar: "━", yPadChar: "│" },
  "┎": { xPadChar: "┃", yPadChar: "─" },
  "╭": { xPadChar: "│", yPadChar: "─" },
};
const createBorderTopLeftNode = (topBorder, leftBorder) => {
  const color = pickBorderColor(topBorder, leftBorder);
  const rounded = topBorder.rounded && leftBorder.rounded;
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = topLeftCharProps[char];
    return {
      type: "border_top_left",
      rects: [{ width: 1, color, render: char }],
      xAlign: "start",
      yAlign: "start",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const topIsDouble = topBorder.style === "double";
    const leftIsDouble = leftBorder.style === "double";
    const bothAreDouble = topIsDouble && leftIsDouble;
    if (bothAreDouble) {
      return innerCreateBorder("╔");
    }
    const onlyTopIsDouble = topIsDouble && !leftIsDouble;
    if (onlyTopIsDouble) {
      return innerCreateBorder("╒");
    }
    const onlyLeftIsDouble = leftIsDouble && !topIsDouble;
    if (onlyLeftIsDouble) {
      return innerCreateBorder("╓");
    }
  }

  // bold
  const topIsBold = topBorder.bold;
  const leftIsBold = leftBorder.bold;
  const noneAreBold = !topIsBold && !leftIsBold;
  if (noneAreBold) {
    return innerCreateBorder(rounded ? "╭" : "┌");
  }
  const bothAreBold = topIsBold && leftIsBold;
  if (bothAreBold) {
    return innerCreateBorder("┏");
  }
  const onlyTopIsBold = topIsBold && !leftIsBold;
  if (onlyTopIsBold) {
    return innerCreateBorder("┍");
  }
  // only left is bold
  return innerCreateBorder("┎");
};

const topRightCharProps = {
  "╗": { xPadChar: "║", yPadChar: "═" },
  "╕": { xPadChar: "═", yPadChar: "│" },
  "╖": { xPadChar: "─", yPadChar: "║" },
  "┐": { xPadChar: "│", yPadChar: "─" },
  "┓": { xPadChar: "┃", yPadChar: "━" },
  "┑": { xPadChar: "━", yPadChar: "│" },
  "┒": { xPadChar: "┃", yPadChar: "─" },
  "╮": { xPadChar: "│", yPadChar: "─" },
};
const createBorderTopRightNode = (topBorder, rightBorder) => {
  const color = pickBorderColor(topBorder, rightBorder);
  const rounded = topBorder.rounded && rightBorder.rounded;
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = topRightCharProps[char];
    return {
      type: "border_top_right",
      rects: [{ width: 1, color, render: char }],
      xAlign: "end",
      yAlign: "start",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const topIsDouble = topBorder.style === "double";
    const rightIsDouble = rightBorder.style === "double";
    const bothAreDouble = topIsDouble && rightIsDouble;
    if (bothAreDouble) {
      return innerCreateBorder("╗");
    }
    const onlyTopIsDouble = topIsDouble && !rightIsDouble;
    if (onlyTopIsDouble) {
      return innerCreateBorder("╕");
    }
    const onlyRightIsDouble = rightIsDouble && !topIsDouble;
    if (onlyRightIsDouble) {
      return innerCreateBorder("╖");
    }
  }

  const topIsBold = topBorder.bold;
  const rightIsBold = rightBorder.bold;
  const noneAreBold = !topIsBold && !rightIsBold;
  if (noneAreBold) {
    return innerCreateBorder(rounded ? "╮" : "┐");
  }
  const bothAreBold = topIsBold && rightIsBold;
  if (bothAreBold) {
    return innerCreateBorder("┓");
  }
  const onlyTopIsBold = topIsBold && !rightIsBold;
  if (onlyTopIsBold) {
    return innerCreateBorder("┑");
  }
  // only right is bold
  return innerCreateBorder("┒");
};
const bottomRightCharProps = {
  "╝": { xPadChar: "║", yPadChar: "═" },
  "╛": { xPadChar: "═", yPadChar: "│" },
  "╜": { xPadChar: "─", yPadChar: "║" },
  "┘": { xPadChar: "│", yPadChar: "─" },
  "┛": { xPadChar: "┃", yPadChar: "━" },
  "┙": { xPadChar: "━", yPadChar: "│" },
  "┚": { xPadChar: "┃", yPadChar: "─" },
  "╯": { xPadChar: "│", yPadChar: "─" },
};
const createBorderBottomRightNode = (bottomBorder, rightBorder) => {
  const color = pickBorderColor(bottomBorder, rightBorder);
  const rounded = bottomBorder.rounded && rightBorder.rounded;
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = bottomRightCharProps[char];
    return {
      type: "border_bottom_right",
      rects: [{ width: 1, color, render: char }],
      xAlign: "end",
      yAlign: "end",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const bottomIsDouble = bottomBorder.style === "double";
    const rightIsDouble = rightBorder.style === "double";
    const bothAreDouble = bottomIsDouble && rightIsDouble;
    if (bothAreDouble) {
      return innerCreateBorder("╝");
    }
    const onlyBottomIsDouble = bottomIsDouble && !rightIsDouble;
    if (onlyBottomIsDouble) {
      return innerCreateBorder("╛");
    }
    const onlyRightIsDouble = rightIsDouble && !bottomIsDouble;
    if (onlyRightIsDouble) {
      return innerCreateBorder("╜");
    }
  }

  const bottomIsBold = bottomBorder.bold;
  const rightIsBold = rightBorder.bold;
  const noneAreBold = !bottomIsBold && !rightIsBold;
  if (noneAreBold) {
    return innerCreateBorder(rounded ? "╯" : "┘");
  }
  const bothAreBold = bottomIsBold && rightIsBold;
  if (bothAreBold) {
    return innerCreateBorder("┛");
  }
  const onlyBottomIsBold = bottomIsBold && !rightIsBold;
  if (onlyBottomIsBold) {
    return innerCreateBorder("┙");
  }
  // only right is bold
  return innerCreateBorder("┚");
};
const bottomLeftCharProps = {
  "╚": { xPadChar: "║", yPadChar: "═" },
  "╘": { xPadChar: "═", yPadChar: "│" },
  "╙": { xPadChar: "─", yPadChar: "║" },
  "└": { xPadChar: "│", yPadChar: "─" },
  "┗": { xPadChar: "┃", yPadChar: "━" },
  "┕": { xPadChar: "━", yPadChar: "│" },
  "┖": { xPadChar: "┃", yPadChar: "─" },
  "╰": { xPadChar: "│", yPadChar: "─" },
};
const createBorderBottomLeftNode = (bottomBorder, leftBorder) => {
  const color = pickBorderColor(bottomBorder, leftBorder);
  const rounded = bottomBorder.rounded && leftBorder.rounded;
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = bottomLeftCharProps[char];
    return {
      type: "border_bottom_left",
      rects: [{ width: 1, color, render: char }],
      xAlign: "start",
      yAlign: "end",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const bottomIsDouble = bottomBorder.style === "double";
    const leftIsDouble = leftBorder.style === "double";
    const bothAreDouble = bottomIsDouble && leftIsDouble;
    if (bothAreDouble) {
      return innerCreateBorder("╚");
    }
    const onlyBottomIsDouble = bottomIsDouble && !leftIsDouble;
    if (onlyBottomIsDouble) {
      return innerCreateBorder("╘");
    }
    const onlyLeftIsDouble = leftIsDouble && !bottomIsDouble;
    if (onlyLeftIsDouble) {
      return innerCreateBorder("╙");
    }
  }

  const bottomIsBold = bottomBorder.bold;
  const leftIsBold = leftBorder.bold;
  const noneAreBold = !bottomIsBold && !leftIsBold;
  if (noneAreBold) {
    return innerCreateBorder(rounded ? "╰" : "└");
  }
  const bothAreBold = bottomIsBold && leftIsBold;
  if (bothAreBold) {
    return innerCreateBorder("┗");
  }
  const onlyBottomIsBold = bottomIsBold && !leftIsBold;
  if (onlyBottomIsBold) {
    return innerCreateBorder("┕");
  }
  // only left is bold
  return innerCreateBorder("┖");
};

// intersections between 3 borders
/**
 * notons aussi que pour double le cas ou 3 bord et 4 borde se connecte ne supporte pas
 * qu'un des axes ne soit pas double (left/right style et top/bottom peutvent changer mais par exemple il
 * n'y a pas de cher pour le cas suivant:
 *
 * ═ ─
 *  ║
 *
 * Les seuls connecteur dispo sont:
 *
 * ╦, ╥ et ╤
 *
 * donnant ainsi
 *
 * ═╦─  ou   ═╥─  ou  ═╤─
 *  ║         ║        ║
 *
 * ah mais on peut faire ça: (utiliser le top right corner)
 * et ça rend pas trop mal
 *
 * ═╗─
 *  ║
 */
const borderMidTopCharProps = {
  "╦": { xPadChar: "║", yPadChar: "═" },
  "╤": { xPadChar: "═", yPadChar: "│" },
  "╥": { xPadChar: "─", yPadChar: "║" },
  "╗": { xPadChar: ["═", "─"], yPadChar: "║" },
  "╔": { xPadChar: ["─", "═"], yPadChar: "║" },
  "┌": { xPadChar: ["═", "─"], yPadChar: "│" },
  "┐": { xPadChar: ["─", "═"], yPadChar: "│" },
  "┬": { xPadChar: "─", yPadChar: "│" },
  "┳": { xPadChar: "━", yPadChar: "┃" },
  "┯": { xPadChar: "━", yPadChar: "│" },
  "┱": { xPadChar: ["━", "─"], yPadChar: "┃" },
  "┲": { xPadChar: ["─", "━"], yPadChar: "┃" },
  "┭": { xPadChar: ["━", "─"], yPadChar: "│" },
  "┮": { xPadChar: ["─", "━"], yPadChar: "┃" },
  "┰": { xPadChar: "─", yPadChar: "┃" },
};
const createBorderMidTopNode = (
  westBorderTop,
  downBorder,
  eastBorderTop,
) => {
  const color = pickBorderColor(westBorderTop, downBorder, eastBorderTop);
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = borderMidTopCharProps[char];
    return {
      type: "border_mid_top",
      rects: [{ width: 1, color, render: char }],
      xAlign: "center",
      yAlign: "start",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const westIsDouble = westBorderTop.style === "double";
    const downIsDouble = downBorder.style === "double";
    const eastIsDouble = eastBorderTop.style === "double";
    const allAreDouble = westIsDouble && downIsDouble && eastIsDouble;
    if (allAreDouble) {
      return innerCreateBorder("╦");
    }
    const onlyXIsDouble = westIsDouble && !downIsDouble && eastIsDouble;
    if (onlyXIsDouble) {
      return innerCreateBorder("╤");
    }
    const onlyYIsDouble = !westIsDouble && downIsDouble && !eastIsDouble;
    if (onlyYIsDouble) {
      return innerCreateBorder("╥");
    }
    const onlyWestAndDownAreDouble =
      westIsDouble && downIsDouble && !eastIsDouble;
    if (onlyWestAndDownAreDouble) {
      return innerCreateBorder("╗");
    }
    const onlyEastAndDownAreDouble =
      !westIsDouble && downIsDouble && eastIsDouble;
    if (onlyEastAndDownAreDouble) {
      return innerCreateBorder("╔");
    }
    const onlyWestIsDouble = westIsDouble && !downIsDouble && !eastIsDouble;
    if (onlyWestIsDouble) {
      return innerCreateBorder("┌");
    }
    const onlyEastIsDouble = !westIsDouble && !downIsDouble && eastIsDouble;
    if (onlyEastIsDouble) {
      return innerCreateBorder("┐");
    }
  }

  const westIsBold = westBorderTop.bold;
  const downIsBold = downBorder.bold;
  const rightIsBold = eastBorderTop.bold;
  const noneAreBold = !westIsBold && !downIsBold && !rightIsBold;
  if (noneAreBold) {
    return innerCreateBorder("┬");
  }
  const allAreBold = westIsBold && downIsBold && rightIsBold;
  if (allAreBold) {
    return innerCreateBorder("┳");
  }
  const westAndEastAreBold = westIsBold && !downIsBold && rightIsBold;
  if (westAndEastAreBold) {
    return innerCreateBorder("┯");
  }
  const westAndDownAreBold = westIsBold && downIsBold && !rightIsBold;
  if (westAndDownAreBold) {
    return innerCreateBorder("┱");
  }
  const eastAndDownAreBold = !westIsBold && downIsBold && rightIsBold;
  if (eastAndDownAreBold) {
    return innerCreateBorder("┲");
  }
  const onlyWestIsBold = westIsBold && !downIsBold && !rightIsBold;
  if (onlyWestIsBold) {
    return innerCreateBorder("┭");
  }
  const onlyEastIsBold = !westIsBold && !downIsBold && rightIsBold;
  if (onlyEastIsBold) {
    return innerCreateBorder("┮");
  }
  // only down is bold
  return innerCreateBorder("┰");
};
const borderMidBottomCharProps = {
  "╩": { xPadChar: "║", yPadChar: "═" },
  "╧": { xPadChar: "═", yPadChar: "│" },
  "╨": { xPadChar: "─", yPadChar: "║" },
  "╝": { xPadChar: ["═", "─"], yPadChar: "║" },
  "╚": { xPadChar: ["─", "═"], yPadChar: "║" },
  "└": { xPadChar: ["═", "─"], yPadChar: "│" },
  "┘": { xPadChar: ["─", "═"], yPadChar: "│" },
  "┴": { xPadChar: "─", yPadChar: "│" },
  "┻": { xPadChar: "━", yPadChar: "┃" },
  "┷": { xPadChar: "━", yPadChar: "│" },
  "┹": { xPadChar: ["━", "─"], yPadChar: "┃" },
  "┺": { xPadChar: ["─", "━"], yPadChar: "┃" },
  "┵": { xPadChar: ["━", "─"], yPadChar: "│" },
  "┶": { xPadChar: ["─", "━"], yPadChar: "┃" },
  "┸": { xPadChar: "─", yPadChar: "┃" },
};
const createBorderMidBottomNode = (
  westBorderBottom,
  upBorder,
  eastBorderBottom,
) => {
  const color = pickBorderColor(westBorderBottom, eastBorderBottom, upBorder);
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = borderMidBottomCharProps[char];
    return {
      type: "border_mid_bottom",
      rects: [{ width: 1, color, render: char }],
      xAlign: "center",
      yAlign: "end",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const westIsDouble = westBorderBottom.style === "double";
    const upIsDouble = upBorder.style === "double";
    const eastIsDouble = eastBorderBottom.style === "double";
    const allAreDouble = westIsDouble && upIsDouble && eastIsDouble;
    if (allAreDouble) {
      return innerCreateBorder("╩");
    }
    const onlyXIsDouble = westIsDouble && !upIsDouble && eastIsDouble;
    if (onlyXIsDouble) {
      return innerCreateBorder("╧");
    }
    const onlyYIsDouble = !westIsDouble && upIsDouble && !eastIsDouble;
    if (onlyYIsDouble) {
      return innerCreateBorder("╨");
    }
    const onlyWestAndUpAreDouble = westIsDouble && upIsDouble && !eastIsDouble;
    if (onlyWestAndUpAreDouble) {
      return innerCreateBorder("╝");
    }
    const onlyEastAndUpAreDouble = !westIsDouble && upIsDouble && eastIsDouble;
    if (onlyEastAndUpAreDouble) {
      return innerCreateBorder("╚");
    }
    const onlyWestIsDouble = westIsDouble && !upIsDouble && !eastIsDouble;
    if (onlyWestIsDouble) {
      return innerCreateBorder("└");
    }
    const onlyEastIsDouble = !westIsDouble && !upIsDouble && eastIsDouble;
    if (onlyEastIsDouble) {
      return innerCreateBorder("┘");
    }
  }

  const leftIsBold = westBorderBottom.bold;
  const upIsBold = upBorder.bold;
  const rightIsBold = eastBorderBottom.bold;
  const noneAreBold = !leftIsBold && !upIsBold && !rightIsBold;
  if (noneAreBold) {
    return innerCreateBorder("┴");
  }
  const allAreBold = leftIsBold && upIsBold && rightIsBold;
  if (allAreBold) {
    return innerCreateBorder("┻");
  }
  const leftAndRightAreBold = leftIsBold && !upIsBold && rightIsBold;
  if (leftAndRightAreBold) {
    return innerCreateBorder("┷");
  }
  const leftAndUpAreBold = leftIsBold && upIsBold && !rightIsBold;
  if (leftAndUpAreBold) {
    return innerCreateBorder("┹");
  }
  const rightAndUpAreBold = !leftIsBold && upIsBold && rightIsBold;
  if (rightAndUpAreBold) {
    return innerCreateBorder("┺");
  }
  const onlyLeftIsBold = leftIsBold && !upIsBold && !rightIsBold;
  if (onlyLeftIsBold) {
    return innerCreateBorder("┵");
  }
  const onlyRightIsBold = !leftIsBold && !upIsBold && rightIsBold;
  if (onlyRightIsBold) {
    return innerCreateBorder("┶");
  }
  // only up is bold
  return innerCreateBorder("┸");
};
const borderMifLeftCharProps = {
  "╠": { xPadChar: "═", yPadChar: "║" },
  "╟": { xPadChar: "─", yPadChar: "║" },
  "╞": { xPadChar: "═", yPadChar: "│" },
  "╚": { xPadChar: "═", yPadChar: ["║", "│"] },
  "╔": { xPadChar: "═", yPadChar: ["│", "║"] },
  "┌": { xPadChar: "─", yPadChar: ["║", "│"] },
  "└": { xPadChar: "─", yPadChar: ["│", "║"] },
  "├": { xPadChar: "─", yPadChar: "│" },
  "┣": { xPadChar: "━", yPadChar: "┃" },
  "┠": { xPadChar: "─", yPadChar: "┃" },
  "┢": { xPadChar: "━", yPadChar: ["│", "┃"] },
  "┡": { xPadChar: "━", yPadChar: ["┃", "│"] },
  "┞": { xPadChar: "─", yPadChar: ["┃", "│"] },
  "┝": { xPadChar: "━", yPadChar: "│" },
  "┟": { xPadChar: "─", yPadChar: ["│", "┃"] },
};
const createBorderMidLeftNode = (
  northBorder,
  middleBorder,
  southBorder,
) => {
  const color = pickBorderColor(middleBorder, northBorder, southBorder);
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = borderMifLeftCharProps[char];
    return {
      type: "border_mid_left",
      rects: [{ width: 1, color, render: char }],
      xAlign: "start",
      yAlign: "center",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const upIsDouble = northBorder.style === "double";
    const middleIsDouble = middleBorder.style === "double";
    const downIsDouble = southBorder.style === "double";
    const allAreDouble = upIsDouble && middleIsDouble && downIsDouble;
    if (allAreDouble) {
      return innerCreateBorder("╠");
    }
    const onlyYIsDouble = upIsDouble && !middleIsDouble && downIsDouble;
    if (onlyYIsDouble) {
      return innerCreateBorder("╟");
    }
    const onlyXIsDouble = !upIsDouble && middleIsDouble && !downIsDouble;
    if (onlyXIsDouble) {
      return innerCreateBorder("╞");
    }
    const onlyUpAndLeftAreDouble =
      upIsDouble && middleIsDouble && !downIsDouble;
    if (onlyUpAndLeftAreDouble) {
      return innerCreateBorder("╚");
    }
    const onlyDownAndLeftAreDouble =
      !upIsDouble && middleIsDouble && downIsDouble;
    if (onlyDownAndLeftAreDouble) {
      return innerCreateBorder("╔");
    }
    const onlyUpIsDouble = upIsDouble && !middleIsDouble && !downIsDouble;
    if (onlyUpIsDouble) {
      return innerCreateBorder("┌");
    }
    const onlyDownIsDouble = !upIsDouble && !middleIsDouble && downIsDouble;
    if (onlyDownIsDouble) {
      return innerCreateBorder("└");
    }
  }

  const upIsBold = northBorder.bold;
  const middleIsBold = middleBorder.bold;
  const downIsBold = southBorder.bold;
  const nothingIsBold = !upIsBold && !middleIsBold && !downIsBold;
  if (nothingIsBold) {
    return innerCreateBorder("├");
  }
  const allAreBold = upIsBold && middleIsBold && downIsBold;
  if (allAreBold) {
    return innerCreateBorder("┣");
  }
  const upAndDownAreBold = upIsBold && !middleIsBold && downIsBold;
  if (upAndDownAreBold) {
    return innerCreateBorder("┠");
  }
  const middleAndDownAreBold = !upIsBold && middleIsBold && downIsBold;
  if (middleAndDownAreBold) {
    return innerCreateBorder("┢");
  }
  const middleAndUpAreBold = upIsBold && middleIsBold && !downIsBold;
  if (middleAndUpAreBold) {
    return innerCreateBorder("┡");
  }
  const onlyUpIsBold = upIsBold && !middleIsBold && !downIsBold;
  if (onlyUpIsBold) {
    return innerCreateBorder("┞");
  }
  const onlyMiddleIsBold = !upIsBold && middleIsBold && !downIsBold;
  if (onlyMiddleIsBold) {
    return innerCreateBorder("┝");
  }
  // only down is bold
  return innerCreateBorder("┟");
};
const borderMidRightCharProps = {
  "╣": { xPadChar: "║", yPadChar: "═" },
  "╢": { xPadChar: "─", yPadChar: "║" },
  "╡": { xPadChar: "═", yPadChar: "│" },
  "╝": { xPadChar: "═", yPadChar: ["║", "│"] },
  "╗": { xPadChar: "═", yPadChar: ["│", "║"] },
  "┘": { xPadChar: "─", yPadChar: ["║", "│"] },
  "└": { xPadChar: "─", yPadChar: ["│", "║"] },
  "┤": { xPadChar: "─", yPadChar: "│" },
  "┫": { xPadChar: "━", yPadChar: "┃" },
  "┨": { xPadChar: "─", yPadChar: "┃" },
  "┪": { xPadChar: "━", yPadChar: ["│", "┃"] },
  "┩": { xPadChar: "━", yPadChar: ["│", "┃"] },
  "┦": { xPadChar: "─", yPadChar: ["┃", "│"] },
  "┥": { xPadChar: "━", yPadChar: "│" },
  "┧": { xPadChar: "─", yPadChar: ["│", "┃"] },
};
const createBorderMidRightNode = (
  northBorder,
  middleBorder,
  southBorder,
) => {
  const color = pickBorderColor(middleBorder, northBorder, southBorder);
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = borderMidRightCharProps[char];
    return {
      type: "border_mid_right",
      rects: [{ width: 1, color, render: char }],
      xAlign: "end",
      yAlign: "center",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const upIsDouble = northBorder.style === "double";
    const middleIsDouble = middleBorder.style === "double";
    const downIsDouble = southBorder.style === "double";
    const allAreDouble = upIsDouble && middleIsDouble && downIsDouble;
    if (allAreDouble) {
      return innerCreateBorder("╣");
    }
    const onlyYIsDouble = upIsDouble && !middleIsDouble && downIsDouble;
    if (onlyYIsDouble) {
      return innerCreateBorder("╢");
    }
    const onlyXIsDouble = !upIsDouble && middleIsDouble && !downIsDouble;
    if (onlyXIsDouble) {
      return innerCreateBorder("╡");
    }
    const onlyUpAndRightAreDouble =
      upIsDouble && middleIsDouble && !downIsDouble;
    if (onlyUpAndRightAreDouble) {
      return innerCreateBorder("╝");
    }
    const onlyDownAndRightAreDouble =
      !upIsDouble && middleIsDouble && downIsDouble;
    if (onlyDownAndRightAreDouble) {
      return innerCreateBorder("╗");
    }
    const onlyUpIsDouble = upIsDouble && !middleIsDouble && !downIsDouble;
    if (onlyUpIsDouble) {
      return innerCreateBorder("┘");
    }
    const onlyDownIsDouble = !upIsDouble && !middleIsDouble && downIsDouble;
    if (onlyDownIsDouble) {
      return innerCreateBorder("└");
    }
  }

  const upIsBold = northBorder.bold;
  const middleIsBold = middleBorder.bold;
  const downIsBold = southBorder.bold;
  const noneAreBold = !upIsBold && !middleIsBold && !downIsBold;
  if (noneAreBold) {
    return innerCreateBorder("┤");
  }
  const allAreBold = upIsBold && middleIsBold && downIsBold;
  if (allAreBold) {
    return innerCreateBorder("┫");
  }
  const upAndDownAreBold = upIsBold && !middleIsBold && downIsBold;
  if (upAndDownAreBold) {
    return innerCreateBorder("┨");
  }
  const middleAndDownAreBold = !upIsBold && middleIsBold && downIsBold;
  if (middleAndDownAreBold) {
    return innerCreateBorder("┪");
  }
  const middleAndUpAreBold = upIsBold && middleIsBold && !downIsBold;
  if (middleAndUpAreBold) {
    return innerCreateBorder("┩");
  }
  const onlyUpIsBold = upIsBold && !middleIsBold && !downIsBold;
  if (onlyUpIsBold) {
    return innerCreateBorder("┦");
  }
  const onlyMiddleIsBold = !upIsBold && middleIsBold && !downIsBold;
  if (onlyMiddleIsBold) {
    return innerCreateBorder("┥");
  }
  // only down is bold
  return innerCreateBorder("┧");
};

// intersection between 4 borders
const borderMidCharProps = {
  "╬": { xPadChar: "═", yPadChar: "║" },
  "╫": { xPadChar: "─", yPadChar: "║" },
  "╪": { xPadChar: "═", yPadChar: "│" },
  "╝": { xPadChar: ["═", "─"], yPadChar: ["║", "│"] },
  "╗": { xPadChar: ["═", "─"], yPadChar: ["│", "║"] },
  "╔": { xPadChar: ["─", "═"], yPadChar: ["│", "║"] },
  "╚": { xPadChar: ["─", "═"], yPadChar: ["║", "│"] },
  "╣": { xPadChar: ["═", "─"], yPadChar: "║" },
  "╠": { xPadChar: ["─", "═"], yPadChar: "║" },
  "╦": { xPadChar: "═", yPadChar: ["│", "║"] },
  "╩": { xPadChar: "═", yPadChar: ["║", "│"] },
  "├": { xPadChar: ["═", "─"], yPadChar: "│" },
  "┤": { xPadChar: ["─", "═"], yPadChar: "│" },
  "┬": { xPadChar: "─", yPadChar: ["║", "│"] },
  "┴": { xPadChar: "─", yPadChar: ["│", "║"] },
  "┼": { xPadChar: "─", yPadChar: "│" },
  "╋": { xPadChar: "━", yPadChar: "┃" },
  "┿": { xPadChar: "━", yPadChar: "│" },
  "╂": { xPadChar: "─", yPadChar: "┃" },
  "╅": { xPadChar: ["━", "─"], yPadChar: ["│", "┃"] },
  "╃": { xPadChar: ["━", "─"], yPadChar: ["┃", "│"] },
  "╄": { xPadChar: ["─", "━"], yPadChar: ["┃", "│"] },
  "╆": { xPadChar: ["─", "━"], yPadChar: ["│", "┃"] },
  "╉": { xPadChar: ["━", "─"], yPadChar: "┃" },
  "╇": { xPadChar: "━", yPadChar: ["┃", "│"] },
  "╊": { xPadChar: ["─", "━"], yPadChar: "┃" },
  "╈": { xPadChar: "━", yPadChar: ["│", "┃"] },
  "┽": { xPadChar: ["━", "─"], yPadChar: "│" },
  "╀": { xPadChar: "─", yPadChar: ["┃", "│"] },
  "┾": { xPadChar: ["─", "━"], yPadChar: "│" },
  "╁": { xPadChar: "─", yPadChar: ["│", "┃"] },
};
const createBorderMidNode = (
  leftBorder,
  upBorder,
  rightBorder,
  downBorder,
) => {
  const color = pickBorderColor(upBorder, leftBorder, rightBorder, downBorder);
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = borderMidCharProps[char];
    return {
      type: "border_mid",
      rects: [{ width: 1, color, render: char }],
      xAlign: "center",
      yAlign: "center",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const leftIsDouble = leftBorder.style === "double";
    const upIsDouble = upBorder.style === "double";
    const rightIsDouble = rightBorder.style === "double";
    const downIsDouble = downBorder.style === "double";
    const allAreDouble =
      leftIsDouble && upIsDouble && rightIsDouble && downIsDouble;
    if (allAreDouble) {
      return innerCreateBorder("╬");
    }
    const onlyXIsDouble =
      leftIsDouble && !upIsDouble && rightIsDouble && !downIsDouble;
    if (onlyXIsDouble) {
      return innerCreateBorder("╪");
    }
    const onlyYIsDouble =
      !leftIsDouble && upIsDouble && !rightIsDouble && downIsDouble;
    if (onlyYIsDouble) {
      return innerCreateBorder("╫");
    }
    const onlyLeftAndUpAndDownAreDouble =
      leftIsDouble && upIsDouble && downIsDouble && !rightIsDouble;
    if (onlyLeftAndUpAndDownAreDouble) {
      return innerCreateBorder("╣");
    }
    const onlyLeftUpRightAreDouble =
      leftIsDouble && upIsDouble && !rightIsDouble && downIsDouble;
    if (onlyLeftUpRightAreDouble) {
      return innerCreateBorder("╩");
    }
    const onlyUpAndRightAndDownAreDouble =
      !leftIsDouble && upIsDouble && rightIsDouble && downIsDouble;
    if (onlyUpAndRightAndDownAreDouble) {
      return innerCreateBorder("╠");
    }
    const onlyRightDownLeftAreDouble =
      leftIsDouble && !upIsDouble && rightIsDouble && downIsDouble;
    if (onlyRightDownLeftAreDouble) {
      return innerCreateBorder("╦");
    }
    const onlyLeftAndUpAreDouble =
      leftIsDouble && upIsDouble && !rightIsDouble && !downIsDouble;
    if (onlyLeftAndUpAreDouble) {
      return innerCreateBorder("╝");
    }
    const onlyLeftAndDownAreDouble =
      leftIsDouble && !upIsDouble && !rightIsDouble && downIsDouble;
    if (onlyLeftAndDownAreDouble) {
      return innerCreateBorder("╗");
    }
    const onlyRightAndDownAreDouble =
      !leftIsDouble && upIsDouble && rightIsDouble && downIsDouble;
    if (onlyRightAndDownAreDouble) {
      return innerCreateBorder("╔");
    }
    const onlyRightAndUpAreDouble =
      !leftIsDouble && upIsDouble && !rightIsDouble && downIsDouble;
    if (onlyRightAndUpAreDouble) {
      return innerCreateBorder("╚");
    }
    const onlyLeftIsDouble =
      leftIsDouble && !upIsDouble && !rightIsDouble && !downIsDouble;
    if (onlyLeftIsDouble) {
      return innerCreateBorder("├");
    }
    const onlyRightIsDouble =
      !leftIsDouble && !upIsDouble && rightIsDouble && !downIsDouble;
    if (onlyRightIsDouble) {
      return innerCreateBorder("┤");
    }
    const onlyUpIsDouble =
      !leftIsDouble && upIsDouble && !rightIsDouble && !downIsDouble;
    if (onlyUpIsDouble) {
      return innerCreateBorder("┬");
    }
    const onlyDownIsDouble =
      !leftIsDouble && !upIsDouble && !rightIsDouble && downIsDouble;
    if (onlyDownIsDouble) {
      return innerCreateBorder("┴");
    }
  }

  const leftIsBold = leftBorder.bold;
  const rightIsBold = rightBorder.bold;
  const downIsBold = downBorder.bold;
  const upIsBold = upBorder.bold;
  const noneAreBold = !leftIsBold && !rightIsBold && !downIsBold && !upIsBold;
  if (noneAreBold) {
    return innerCreateBorder("┼");
  }
  const allAreBold = leftIsBold && rightIsBold && downIsBold && upIsBold;
  if (allAreBold) {
    return innerCreateBorder("╋");
  }
  const leftAndRightAreBold =
    leftIsBold && rightIsBold && !downIsBold && !upIsBold;
  if (leftAndRightAreBold) {
    return innerCreateBorder("┿");
  }
  const upAndDownAreBold =
    !leftIsBold && !rightIsBold && downIsBold && upIsBold;
  if (upAndDownAreBold) {
    return innerCreateBorder("╂");
  }
  const leftAndDownAreBold =
    leftIsBold && !rightIsBold && downIsBold && !upIsBold;
  if (leftAndDownAreBold) {
    return innerCreateBorder("╅");
  }
  const leftAndUpAreBold =
    leftIsBold && !rightIsBold && !downIsBold && upIsBold;
  if (leftAndUpAreBold) {
    return innerCreateBorder("╃");
  }
  const rightAndUpAreBold =
    !leftIsBold && rightIsBold && !downIsBold && upIsBold;
  if (rightAndUpAreBold) {
    return innerCreateBorder("╄");
  }
  const rightAndDownAreBold =
    !leftIsBold && rightIsBold && downIsBold && !upIsBold;
  if (rightAndDownAreBold) {
    return innerCreateBorder("╆");
  }
  const leftAndRightAndDownAreBold =
    leftIsBold && rightIsBold && downIsBold && !upIsBold;
  if (leftAndRightAndDownAreBold) {
    return innerCreateBorder("╉");
  }
  const leftAndRightAndUpAreBold =
    leftIsBold && rightIsBold && !downIsBold && upIsBold;
  if (leftAndRightAndUpAreBold) {
    return innerCreateBorder("╇");
  }
  const upAndRightAndDownAreBold =
    !leftIsBold && rightIsBold && downIsBold && upIsBold;
  if (upAndRightAndDownAreBold) {
    return innerCreateBorder("╊");
  }
  const rightAndDownAndLeftAreBold =
    leftIsBold && rightIsBold && !downIsBold && upIsBold;
  if (rightAndDownAndLeftAreBold) {
    return innerCreateBorder("╈");
  }
  const onlyLeftIsBold = leftIsBold && !rightIsBold && !downIsBold && !upIsBold;
  if (onlyLeftIsBold) {
    return innerCreateBorder("┽");
  }
  const onlyUpIsBold = !leftIsBold && !rightIsBold && !downIsBold && upIsBold;
  if (onlyUpIsBold) {
    return innerCreateBorder("╀");
  }
  const onlyRightIsBold =
    !leftIsBold && rightIsBold && !downIsBold && !upIsBold;
  if (onlyRightIsBold) {
    return innerCreateBorder("┾");
  }
  // only down is bold
  return innerCreateBorder("╁");
};

const createSkippedColumnTopNode = () => {
  return {
    type: "skipped_column_top",
    rects: [
      {
        width: "fill",
        color: COLORS.GREY,
        render: ({ columnWidth }) => "┈".repeat(columnWidth),
      },
    ],
    yAlign: "end",
  };
};
const createSkippedColumnBottomNode = () => {
  return {
    type: "skipped_column_bottom",
    rects: [
      {
        width: "fill",
        color: COLORS.GREY,
        render: ({ columnWidth }) => "┈".repeat(columnWidth),
      },
    ],
    yAlign: "start",
  };
};
const createSkippedColumnTopRightNode = () => {
  return {
    type: "skipped_column_top_right",
    rects: [{ width: 1, color: COLORS.GREY, render: "→" }],
    xAlign: "end",
    yAlign: "start",
    xPadChar: "┈",
  };
};
const createSkippedColumnBottomRightNode = () => {
  return {
    type: "skipped_column_bottom_right",
    rects: [{ width: 1, color: COLORS.GREY, render: "→" }],
    xAlign: "end",
    yAlign: "end",
    xPadChar: "┈",
  };
};

const createSkippedRowLeftNode = () => {
  return {
    type: "skipped_row_left",
    rects: [{ width: 1, color: COLORS.GREY, render: "┊" }],
    xAlign: "end",
    yAlign: "center",
    yPadChar: "┊",
  };
};
const createSkippedRowRightNode = () => {
  return {
    type: "skipped_row_right",
    rects: [{ width: 1, color: COLORS.GREY, render: "┊" }],
    xAlign: "end",
    yAlign: "center",
    yPadChar: "┊",
  };
};
const createSkippedRowBottomLeftNode = () => {
  return {
    type: "skipped_row_bottom_left",
    rects: [{ width: 1, color: COLORS.GREY, render: "↓" }],
    xAlign: "start",
    yAlign: "center",
    yPadChar: "┊",
  };
};
const createSkippedRowBottomRightNode = () => {
  return {
    type: "skipped_row_bottom_right",
    rects: [{ width: 1, color: COLORS.GREY, render: "↓" }],
    xAlign: "end",
    yAlign: "end",
    yPadChar: "┊",
  };
};

const leftSlot = {
  type: "left",
  adapt: (cell) => {
    const { isSkippedRow, borderLeft } = cell;
    if (isSkippedRow) {
      return createSkippedRowLeftNode();
    }
    if (borderLeft) {
      return createBorderLeftNode(borderLeft);
    }
    return createBlankNode();
  },
};
const rightSlot = {
  type: "right",
  adapt: (cell) => {
    const { isSkippedColumn, isSkippedRow, borderRight } = cell;
    if (isSkippedRow) {
      return createSkippedRowRightNode();
    }
    if (isSkippedColumn) {
      return createBlankNode();
    }
    if (borderRight) {
      return createBorderRightNode(borderRight);
    }
    return createBlankNode();
  },
};
const topSlot = {
  type: "top",
  adapt: (cell) => {
    const { isSkippedColumn, borderTop } = cell;
    if (isSkippedColumn) {
      return createSkippedColumnTopNode();
    }
    if (borderTop) {
      return createBorderTopNode(borderTop);
    }
    return createBlankNode();
  },
};
const bottomSlot = {
  type: "bottom",
  adapt: (cell) => {
    const { isSkippedRow, isSkippedColumn, borderBottom } = cell;
    if (isSkippedColumn) {
      return createSkippedColumnBottomNode();
    }
    if (isSkippedRow) {
      return createBlankNode();
    }
    if (borderBottom) {
      return createBorderBottomNode(borderBottom);
    }
    return createBlankNode();
  },
};
const topLeftSlot = {
  type: "top_left",
  adapt: (cell) => {
    const { borderTop, borderLeft, westCell, northCell } = cell;
    if (!borderTop && !borderLeft) {
      return createBlankNode();
    }

    let northConnected =
      northCell && !northCell.borderBottom && northCell.borderLeft;
    let westConnected = westCell && westCell.borderTop && !westCell.borderRight;
    let northWestConnected = northConnected && westConnected;
    if (borderTop && borderLeft) {
      if (northWestConnected) {
        return createBorderMidNode(
          westCell.borderTop,
          northCell.borderLeft,
          borderTop,
          borderLeft,
        );
      }
      if (westConnected) {
        return createBorderMidTopNode(
          borderTop,
          borderLeft,
          westCell.borderTop,
        );
      }
      if (northConnected) {
        return createBorderMidLeftNode(
          northCell.borderLeft,
          borderTop,
          borderLeft,
        );
      }
      return createBorderTopLeftNode(borderTop, borderLeft);
    }
    if (borderLeft) {
      northConnected =
        northCell && (northCell.borderBottom || northCell.borderLeft);
      northWestConnected = northConnected && westConnected;
      if (northWestConnected) {
        return createBorderMidRightNode(
          northCell.borderLeft || northCell.westCell.borderRight,
          westCell.borderTop,
          borderLeft,
        );
      }
      if (westConnected) {
        return createBorderTopRightNode(westCell.borderTop, borderLeft);
      }
      if (northConnected) {
        return createBorderLeftNode(borderLeft);
      }
      return createBorderHalfDownNode(borderLeft);
    }
    // borderTop
    westConnected = westCell && (westCell.borderTop || westCell.borderRight);
    northWestConnected = northConnected && westConnected;
    if (northWestConnected) {
      return createBorderMidBottomNode(
        borderTop,
        northCell.borderLeft,
        westCell.borderTop || northCell.westCell.borderBottom,
      );
    }
    if (northConnected) {
      return createBorderBottomLeftNode(borderTop, northCell.borderLeft);
    }
    if (westConnected) {
      return createBorderTopNode(borderTop);
    }
    return createBorderHalfRightNode(borderTop);
  },
};
const topRightSlot = {
  type: "top_right",
  adapt: (cell) => {
    const { isSkippedColumn, borderTop, borderRight, eastCell, northCell } =
      cell;
    if (isSkippedColumn) {
      return createSkippedColumnTopRightNode();
    }
    if (!borderTop && !borderRight) {
      return createBlankNode();
    }

    let northConnected =
      northCell && !northCell.borderBottom && northCell.borderRight;
    let eastConnected = eastCell && eastCell.borderTop && !eastCell.borderLeft;
    let northEastConnected = northConnected && eastConnected;
    if (borderTop && borderRight) {
      if (northEastConnected) {
        return createBorderMidNode(
          borderTop,
          northCell.borderRight,
          eastCell.borderTop,
          borderRight,
        );
      }
      if (northConnected) {
        return createBorderMidRightNode(
          northCell.borderRight,
          borderTop,
          borderRight,
        );
      }
      if (eastConnected) {
        return createBorderMidTopNode(
          borderTop,
          borderRight,
          eastCell.borderTop,
        );
      }
      return createBorderTopRightNode(borderTop, borderRight);
    }
    if (borderRight) {
      northConnected =
        northCell && (northCell.borderBottom || northCell.borderRight);
      northEastConnected = northConnected && eastConnected;
      if (northEastConnected) {
        return createBorderMidLeftNode(
          northCell.borderRight || northCell.eastCell.borderLeft,
          eastCell.borderTop,
          borderRight,
        );
      }
      if (northConnected) {
        return createBorderRightNode(
          northCell.borderRight || northCell.borderBottom,
        );
      }
      if (eastConnected) {
        return createBorderTopLeftNode(eastCell.borderTop, borderRight);
      }
      return createBorderHalfDownNode(borderRight);
    }
    // borderTop
    eastConnected = eastCell && (eastCell.borderTop || eastCell.borderLeft);
    northEastConnected = northConnected && eastConnected;
    if (northEastConnected) {
      return createBorderMidBottomNode(
        borderTop,
        northCell.borderRight,
        eastCell.borderTop || eastCell.northCell.borderBottom,
      );
    }
    if (northConnected) {
      return createBorderBottomRightNode(borderTop, northCell.borderRight);
    }
    if (eastConnected) {
      return createBorderTopNode(borderTop);
    }
    return createBorderHalfLeftNode(borderTop);
  },
};
const bottomRightSlot = {
  type: "bottom_right",
  adapt: (cell) => {
    const {
      isSkippedRow,
      isSkippedColumn,
      borderBottom,
      borderRight,
      eastCell,
      southCell,
    } = cell;
    if (isSkippedRow) {
      return createSkippedRowBottomRightNode();
    }
    if (isSkippedColumn) {
      return createSkippedColumnBottomRightNode();
    }
    if (!borderBottom && !borderRight) {
      return createBlankNode();
    }

    let southConnected =
      southCell && !southCell.borderTop && southCell.borderRight;
    let eastConnected =
      eastCell && eastCell.borderBottom && !eastCell.borderLeft;
    let southEastConnected = southConnected && eastConnected;
    if (borderBottom && borderRight) {
      if (southEastConnected) {
        return createBorderMidNode(
          borderBottom,
          borderRight,
          eastCell.borderBottom,
          southCell.borderRight,
        );
      }
      if (eastConnected) {
        return createBorderMidBottomNode(
          borderBottom,
          borderRight,
          eastCell.borderBottom,
        );
      }
      if (southConnected) {
        return createBorderMidRightNode(
          borderRight,
          borderBottom,
          southCell.borderRight,
        );
      }
      return createBorderBottomRightNode(borderBottom, borderRight);
    }
    if (borderRight) {
      southConnected =
        southCell && (southCell.borderTop || southCell.borderRight);
      southEastConnected = southConnected && eastConnected;
      if (southEastConnected) {
        return createBorderMidTopNode(
          borderRight,
          southCell.borderTop || southCell.eastCell.borderBottom,
          eastCell.borderBottom,
        );
      }
      if (eastConnected) {
        return createBorderBottomLeftNode(eastCell.borderBottom, borderRight);
      }
      if (southConnected) {
        return createBorderRightNode(borderRight);
      }
      return createBorderHalfUpNode(borderRight);
    }
    // border bottom
    eastConnected = eastCell && (eastCell.borderBottom || eastCell.borderLeft);
    southEastConnected = southConnected && eastConnected;
    if (southEastConnected) {
      return createBorderMidTopNode(
        borderBottom,
        southCell.borderRight,
        eastCell.borderBottom || eastCell.southCell.borderTop,
      );
    }
    if (southConnected) {
      return createBorderTopRightNode(borderBottom, southCell.borderRight);
    }
    if (eastConnected) {
      return createBorderBottomNode(borderBottom);
    }
    return createBorderHalfLeftNode(borderBottom);
  },
};
const bottomLeftSlot = {
  type: "bottom_left",
  adapt: (cell) => {
    const { isSkippedRow, borderBottom, borderLeft, westCell, southCell } =
      cell;
    if (isSkippedRow) {
      return createSkippedRowBottomLeftNode();
    }
    if (!borderBottom && !borderLeft) {
      return createBlankNode();
    }

    let southConnected =
      southCell && !southCell.borderTop && southCell.borderLeft;
    let westConnected =
      westCell && westCell.borderBottom && !westCell.borderRight;
    let southWestConnected = southConnected && westConnected;
    if (borderBottom && borderLeft) {
      if (southWestConnected) {
        return createBorderMidNode(
          westCell.borderBottom,
          borderLeft,
          borderBottom,
          southCell.borderLeft,
        );
      }
      if (southConnected) {
        return createBorderMidLeftNode(
          borderLeft,
          borderBottom,
          southCell.borderLeft,
        );
      }
      if (westConnected) {
        return createBorderMidBottomNode(
          borderBottom,
          borderLeft,
          westCell.borderBottom,
        );
      }
      return createBorderBottomLeftNode(borderBottom, borderLeft);
    }
    if (borderLeft) {
      southConnected =
        southCell && (southCell.borderTop || southCell.borderLeft);
      southWestConnected = southConnected && westConnected;
      if (southWestConnected) {
        return createBorderMidRightNode(
          borderLeft,
          southCell.borderTop || southCell.westCell.borderBottom,
          southCell.borderLeft || southCell.westCell.borderRight,
        );
      }
      if (westConnected) {
        return createBorderBottomRightNode(westCell.borderBottom, borderLeft);
      }
      if (southConnected) {
        return createBorderLeftNode(borderLeft);
      }
      return createBorderHalfUpNode(borderLeft);
    }
    // borderBottom
    westConnected = westCell && (westCell.borderBottom || westCell.borderRight);
    southWestConnected = southConnected && westConnected;
    if (southWestConnected) {
      return createBorderMidTopNode(
        westCell.borderBottom || southCell.borderTop,
        southCell.borderLeft,
        borderBottom,
      );
    }
    if (southConnected) {
      return createBorderTopLeftNode(borderBottom, southCell.borderLeft);
    }
    if (westConnected) {
      return createBorderBottomNode(borderBottom);
    }
    return createBorderHalfRightNode(borderBottom);
  },
};

/**
 *
 * https://github.com/Automattic/cli-table
 * https://github.com/tecfu/tty-table
 * https://github.com/zaftzaft/terminal-table
 *
 * - number alignnment
 *
 * NICE TO HAVE/TO INVESTIGATE
 *
 * - colspan/rowspan
 *
 * - test border style conflict (double -> single heavy)
 *
 * - maxWidth on the table (defaults to stdout.columns, will put ... at the end of the cell when it exceeds the remaining width
 *
 * - un nouveau style pour les border: "ascii"
 * sep: "|",
 * topLeft: "+", topMid: "+", top: "-", topRight: "+",
 * midLeft: "|", midMid: "+", mid: "-", midRight: "|",
 * botLeft: "+", botMid: "+", bot: "-", botRight: "+"
 */


const renderTable = (
  inputGrid,
  {
    ansi,
    indent = 0,
    borderCollapse,
    borderSeparatedOnColorConflict,
    borderSpacing = 0,
    cornersOnly = false,
    cellMaxWidth = 50,
    cellMaxHeight = 10,
    maxColumns = 10,
    maxRows = 20,
    fixLastRow = false,
  } = {},
) => {
  if (!Array.isArray(inputGrid)) {
    throw new TypeError(`The first arg must be an array, got ${inputGrid}`);
  }
  if (inputGrid.length === 0) {
    return "";
  }
  if (maxRows < 2) {
    maxRows = 2;
  }
  if (maxColumns < 2) {
    maxColumns = 2;
  }

  let grid = [];
  // create cells and fill grid
  {
    let y = 0;
    for (const inputRow of inputGrid) {
      let x = 0;
      const row = [];
      for (const inputCell of inputRow) {
        const cell = createCell(inputCell, {
          x,
          y,
          cellMaxWidth,
          cellMaxHeight,
        });
        row[x] = cell;
        x++;
      }
      grid[y] = row;
      y++;
    }
  }
  // max rows
  {
    const rowCount = grid.length;
    if (rowCount > maxRows) {
      const firstRow = grid[0];
      const gridRespectingMaxRows = [];
      let skippedRowIndexArray = [];
      let y = 0;
      while (y < rowCount) {
        const row = grid[y];
        if (y === 0) {
          gridRespectingMaxRows.push(row);
        } else if (gridRespectingMaxRows.length < maxRows - 1) {
          gridRespectingMaxRows.push(row);
        } else if (fixLastRow && rowCount > 1 && y === rowCount - 1) ; else {
          skippedRowIndexArray.push(y);
        }
        y++;
      }
      // push a row
      const skippedRowCount = skippedRowIndexArray.length;
      const rowShowingSkippedRows = [];
      let x = 0;
      while (x < firstRow.length) {
        const cellModel = grid[skippedRowIndexArray[0]][x];
        cellModel.isSkippedRow = true;
        cellModel.color = COLORS.GREY;
        cellModel.updateValue(`${skippedRowCount} rows`);
        rowShowingSkippedRows.push(cellModel);
        x++;
      }
      gridRespectingMaxRows.push(rowShowingSkippedRows);
      if (fixLastRow && rowCount > 1) {
        gridRespectingMaxRows.push(grid[rowCount - 1]);
      }
      grid = gridRespectingMaxRows;
    }
  }
  // max columns
  {
    const firstRow = grid[0];
    const columnCount = firstRow.length;
    if (columnCount > maxColumns) {
      let y = 0;
      while (y < grid.length) {
        const row = grid[y];
        const cellModel = row[maxColumns - 1];
        const skippedColumnCount = columnCount - maxColumns + 1;
        const rowRespectingMaxColumns = row.slice(0, maxColumns - 1);
        cellModel.isSkippedColumn = true;
        cellModel.color = COLORS.GREY;
        cellModel.spacingLeft = 1;
        cellModel.spacingRight = 0;
        cellModel.updateValue(`${skippedColumnCount} columns`);
        rowRespectingMaxColumns.push(cellModel);
        grid[y] = rowRespectingMaxColumns;
        y++;
      }
    }
  }

  const columnWithLeftSlotSet = new Set();
  const columnWithRightSlotSet = new Set();
  const rowHasTopSlot = (y) => topSlotRowMap.has(y);
  const rowHasBottomSlot = (y) => bottomSlotRowMap.has(y);
  const columnHasLeftSlot = (x) => columnWithLeftSlotSet.has(x);
  const columnHasRightSlot = (x) => columnWithRightSlotSet.has(x);
  const leftSlotRowMap = new Map();
  const rightSlotRowMap = new Map();
  const topSlotRowMap = new Map();
  const bottomSlotRowMap = new Map();
  // detect borders
  {
    const onBorderLeft = (x, y) => {
      columnWithLeftSlotSet.add(x);
      const leftSlotRow = leftSlotRowMap.get(y);
      if (!leftSlotRow) {
        const leftSlotRow = [];
        leftSlotRowMap.set(y, leftSlotRow);
        leftSlotRow[x] = leftSlot;
      } else {
        leftSlotRow[x] = leftSlot;
      }
    };
    const onBorderRight = (x, y) => {
      columnWithRightSlotSet.add(x);
      const rightSlotRow = rightSlotRowMap.get(y);
      if (!rightSlotRow) {
        const rightSlotRow = [];
        rightSlotRowMap.set(y, rightSlotRow);
        rightSlotRow[x] = rightSlot;
      } else {
        rightSlotRow[x] = rightSlot;
      }
    };
    const onBorderTop = (x, y) => {
      const topSlotRow = topSlotRowMap.get(y);
      if (!topSlotRow) {
        const topSlotRow = [];
        topSlotRowMap.set(y, topSlotRow);
        topSlotRow[x] = topSlot;
      } else {
        topSlotRow[x] = topSlot;
      }
    };
    const onBorderBottom = (x, y) => {
      const bottomSlotRow = bottomSlotRowMap.get(y);
      if (!bottomSlotRow) {
        const bottomSlotRow = [];
        bottomSlotRowMap.set(y, bottomSlotRow);
        bottomSlotRow[x] = bottomSlot;
      } else {
        bottomSlotRow[x] = bottomSlot;
      }
    };

    let y = 0;
    while (y < grid.length) {
      let x = 0;
      const row = grid[y];
      while (x < row.length) {
        const cell = row[x];
        const {
          border,
          borderLeft = border,
          borderRight = border,
          borderTop = border,
          borderBottom = border,
        } = cell;
        const westCell = x === 0 ? null : row[x - 1];
        const northCell = y === 0 ? null : grid[y - 1][x];
        cell.westCell = westCell;
        cell.northCell = northCell;
        if (westCell) {
          westCell.eastCell = cell;
        }
        if (northCell) {
          northCell.southCell = cell;
        }
        if (borderLeft) {
          onBorderLeft(x, y);
        }
        if (borderRight) {
          onBorderRight(x, y);
        }
        if (borderTop) {
          onBorderTop(x, y);
        }
        if (borderBottom) {
          onBorderBottom(x, y);
        }
        x++;
      }
      y++;
    }
  }
  // border collapse
  if (borderCollapse) {
    const getHowToCollapseBorders = (borderToCollapse, intoBorder) => {
      if (
        borderSeparatedOnColorConflict &&
        borderToCollapse.color !== intoBorder.color
      ) {
        return null;
      }
      return () => {
        const collapsedBorder = { ...intoBorder };
        if (!intoBorder.style && borderToCollapse.style) {
          collapsedBorder.style = borderToCollapse.style;
        }
        if (!intoBorder.color && borderToCollapse.color) {
          collapsedBorder.color = borderToCollapse.color;
        }
        return collapsedBorder;
      };
    };

    const collapsePreviousRowBottomBorders = (y) => {
      const firstCellInThatRow = grid[y][0];
      let cellInThatRow = firstCellInThatRow;
      const collapseCallbackSet = new Set();
      while (cellInThatRow) {
        const borderTop = cellInThatRow.borderTop;
        if (!borderTop) {
          return false;
        }
        const northCell = cellInThatRow.northCell;
        const northCellBorderBottom = northCell.borderBottom;
        if (!northCellBorderBottom) {
          cellInThatRow = cellInThatRow.eastCell;
          continue;
        }
        const collapseBorders = getHowToCollapseBorders(
          northCellBorderBottom,
          borderTop,
        );
        if (!collapseBorders) {
          return false;
        }
        const cell = cellInThatRow;
        collapseCallbackSet.add(() => {
          cell.borderTop = collapseBorders();
          northCell.borderBottom = null;
        });
        cellInThatRow = cellInThatRow.eastCell;
      }
      for (const collapseCallback of collapseCallbackSet) {
        collapseCallback();
      }
      bottomSlotRowMap.delete(y - 1);
      return true;
    };
    const collapseTopBorders = (y) => {
      const firstCellInThatRow = grid[y][0];
      let cellInThatRow = firstCellInThatRow;
      const collapseCallbackSet = new Set();
      while (cellInThatRow) {
        const borderTop = cellInThatRow.borderTop;
        if (!borderTop) {
          cellInThatRow = cellInThatRow.eastCell;
          continue;
        }
        const northCell = cellInThatRow.northCell;
        const northCellBorderBottom = northCell.borderBottom;
        if (!northCellBorderBottom) {
          return false;
        }
        const collapseBorders = getHowToCollapseBorders(
          borderTop,
          northCellBorderBottom,
        );
        if (!collapseBorders) {
          return false;
        }
        const cell = cellInThatRow;
        collapseCallbackSet.add(() => {
          northCell.borderBottom = collapseBorders();
          cell.borderTop = null;
        });
        cellInThatRow = cellInThatRow.eastCell;
      }
      for (const collapseCallback of collapseCallbackSet) {
        collapseCallback();
      }
      topSlotRowMap.delete(y);
      return true;
    };
    const collapsePreviousColumnRightBorders = (x) => {
      const firstCellInThatColumn = grid[0][x];
      let cellInThatColumn = firstCellInThatColumn;
      const collapseCallbackSet = new Set();
      while (cellInThatColumn) {
        const border = cellInThatColumn.borderLeft;
        if (!border) {
          return false;
        }
        const westCell = cellInThatColumn.westCell;
        const westCellBorderRight = westCell.borderRight;
        if (!westCellBorderRight) {
          cellInThatColumn = cellInThatColumn.southCell;
          continue;
        }
        const collapseBorders = getHowToCollapseBorders(
          westCellBorderRight,
          border,
        );
        if (!collapseBorders) {
          return false;
        }
        const cell = cellInThatColumn;
        collapseCallbackSet.add(() => {
          cell.borderLeft = collapseBorders();
          westCell.borderRight = null;
        });
        cellInThatColumn = cellInThatColumn.southCell;
      }
      for (const collapseCallback of collapseCallbackSet) {
        collapseCallback();
      }
      let y = 0;
      while (y < grid.length) {
        const rightSlotRow = rightSlotRowMap.get(y);
        if (rightSlotRow) {
          rightSlotRow[x - 1] = undefined;
        }
        y++;
      }
      columnWithRightSlotSet.delete(x - 1);
      return true;
    };
    const collapseLeftBorders = (x) => {
      const firstCellInThatColumn = grid[0][x];
      let cellInThatColumn = firstCellInThatColumn;
      const collapseCallbackSet = new Set();
      while (cellInThatColumn) {
        const border = cellInThatColumn.borderLeft;
        if (!border) {
          cellInThatColumn = cellInThatColumn.southCell;
          continue;
        }
        const westCell = cellInThatColumn.westCell;
        const otherBorder = westCell.borderRight;
        if (!otherBorder) {
          return false;
        }
        const collapseBorders = getHowToCollapseBorders(border, otherBorder);
        if (!collapseBorders) {
          return false;
        }
        const cell = cellInThatColumn;
        collapseCallbackSet.add(() => {
          westCell.borderRight = collapseBorders();
          cell.borderLeft = null;
        });
        cellInThatColumn = cellInThatColumn.southCell;
      }
      for (const collapseCallback of collapseCallbackSet) {
        collapseCallback();
      }
      let y = 0;
      while (y < grid.length) {
        const leftSlotRow = leftSlotRowMap.get(y);
        if (leftSlotRow) {
          leftSlotRow[x] = undefined;
        }
        y++;
      }
      columnWithLeftSlotSet.delete(x);
      return true;
    };

    {
      let y = 0;
      while (y < grid.length) {
        let x = 0;
        const row = grid[y];
        while (x < row.length) {
          if (
            x !== row.length - 1 &&
            columnHasRightSlot(x) &&
            columnHasLeftSlot(x + 1)
          ) {
            collapsePreviousColumnRightBorders(x + 1);
          }
          if (x > 0 && columnHasLeftSlot(x) && columnHasRightSlot(x - 1)) {
            collapseLeftBorders(x);
          }
          x++;
        }
        if (
          y !== grid.length - 1 &&
          rowHasBottomSlot(y) &&
          rowHasTopSlot(y + 1)
        ) {
          collapsePreviousRowBottomBorders(y + 1);
        }
        if (y > 0 && rowHasTopSlot(y) && rowHasBottomSlot(y - 1)) {
          collapseTopBorders(y);
        }
        y++;
      }
    }
  }
  // fill holes in slot rows
  {
    let y = 0;
    while (y < grid.length) {
      let leftSlotRow = leftSlotRowMap.get(y);
      let rightSlotRow = rightSlotRowMap.get(y);
      const topSlotRow = topSlotRowMap.get(y);
      const bottomSlotRow = bottomSlotRowMap.get(y);
      let x = 0;
      while (x < grid[y].length) {
        if (leftSlotRow) {
          if (!leftSlotRow[x] && columnHasLeftSlot(x)) {
            leftSlotRow[x] = leftSlot;
          }
        } else if (columnHasLeftSlot(x)) {
          leftSlotRow = [];
          leftSlotRowMap.set(y, leftSlotRow);
          leftSlotRow[x] = leftSlot;
        }

        if (rightSlotRow) {
          if (!rightSlotRow[x] && columnHasRightSlot(x)) {
            rightSlotRow[x] = rightSlot;
          }
        } else if (columnHasRightSlot(x)) {
          rightSlotRow = [];
          rightSlotRowMap.set(y, rightSlotRow);
          rightSlotRow[x] = rightSlot;
        }

        if (topSlotRow && !topSlotRow[x]) {
          topSlotRow[x] = topSlot;
        }
        if (bottomSlotRow && !bottomSlotRow[x]) {
          bottomSlotRow[x] = bottomSlot;
        }
        x++;
      }
      y++;
    }
  }
  // create corners
  const topLeftSlotRowMap = new Map();
  const topRightSlotRowMap = new Map();
  const bottomLeftSlotRowMap = new Map();
  const bottomRightSlotRowMap = new Map();
  {
    let y = 0;
    while (y < grid.length) {
      const leftSlotRow = leftSlotRowMap.get(y);
      const rightSlotRow = rightSlotRowMap.get(y);
      if (!leftSlotRow && !rightSlotRow) {
        y++;
        continue;
      }
      const topSlotRow = topSlotRowMap.get(y);
      const bottomSlotRow = bottomSlotRowMap.get(y);
      if (!topSlotRow && !bottomSlotRow) {
        y++;
        continue;
      }
      const topLeftSlotRow = [];
      const topRightSlotRow = [];
      const bottomLeftSlotRow = [];
      const bottomRightSlotRow = [];
      let x = 0;
      while (x < grid[y].length) {
        const leftSlot = leftSlotRow && leftSlotRow[x];
        const rightSlot = rightSlotRow && rightSlotRow[x];

        if (topSlotRow && leftSlot) {
          topLeftSlotRow[x] = topLeftSlot;
        }
        if (topSlotRow && rightSlot) {
          topRightSlotRow[x] = topRightSlot;
        }
        if (bottomSlotRow && leftSlot) {
          bottomLeftSlotRow[x] = bottomLeftSlot;
        }
        if (bottomSlotRow && rightSlot) {
          bottomRightSlotRow[x] = bottomRightSlot;
        }
        x++;
      }
      if (topLeftSlotRow.length) {
        topLeftSlotRowMap.set(y, topLeftSlotRow);
      }
      if (topRightSlotRow.length) {
        topRightSlotRowMap.set(y, topRightSlotRow);
      }
      if (bottomLeftSlotRow.length) {
        bottomLeftSlotRowMap.set(y, bottomLeftSlotRow);
      }
      if (bottomRightSlotRow.length) {
        bottomRightSlotRowMap.set(y, bottomRightSlotRow);
      }
      y++;
    }
  }
  // replace slots with content that will be rendered in that slot (border or blank)
  {
    let y = 0;
    while (y < grid.length) {
      const row = grid[y];
      const leftSlotRow = leftSlotRowMap.get(y);
      const rightSlotRow = rightSlotRowMap.get(y);
      const topSlotRow = topSlotRowMap.get(y);
      const bottomSlotRow = bottomSlotRowMap.get(y);
      const topLeftSlotRow = topLeftSlotRowMap.get(y);
      const topRightSlotRow = topRightSlotRowMap.get(y);
      const bottomLeftSlotRow = bottomLeftSlotRowMap.get(y);
      const bottomRightSlotRow = bottomRightSlotRowMap.get(y);
      let x = 0;
      while (x < row.length) {
        const cell = row[x];
        const adapt = (slot) => {
          const node = slot.adapt(cell);
          if (node.type === "blank") {
            return node;
          }
          if (cornersOnly) {
            if (
              node.type === "border_left" ||
              node.type === "border_right" ||
              node.type === "border_top" ||
              node.type === "border_bottom" ||
              node.type === "border_half_left" ||
              node.type === "border_half_right" ||
              node.type === "border_half_up" ||
              node.type === "border_half_down"
            ) {
              return createBlankNode();
            }
          }
          if (borderSpacing) {
            if (slot.type === "top_left") {
              if (!cell.northCell || !cell.northCell.borderBottom) {
                node.spacingTop = borderSpacing;
              }
              if (!cell.westCell || !cell.westCell.borderRight) {
                node.spacingLeft = borderSpacing;
              }
            }
            if (slot.type === "top_right") {
              if (!cell.northCell || !cell.northCell.borderBottom) {
                node.spacingTop = borderSpacing;
              }
              node.spacingRight = borderSpacing;
            }
            if (slot.type === "bottom_left") {
              node.spacingBottom = borderSpacing;
              if (!cell.westCell || !cell.westCell.borderRight) {
                node.spacingLeft = borderSpacing;
              }
            }
            if (slot.type === "bottom_right") {
              node.spacingBottom = borderSpacing;
              node.spacingRight = borderSpacing;
            }
          }
          return node;
        };

        if (leftSlotRow) {
          const leftSlot = leftSlotRow[x];
          if (leftSlot) {
            const leftSlotNode = adapt(leftSlot);
            leftSlotRow[x] = leftSlotNode;
          }
        }
        if (rightSlotRow) {
          const rightSlot = rightSlotRow[x];
          if (rightSlot) {
            const rightSlotNode = adapt(rightSlot);
            rightSlotRow[x] = rightSlotNode;
          }
        }
        if (topSlotRow) {
          const topSlot = topSlotRow[x];
          const topSlotNode = adapt(topSlot);
          topSlotRow[x] = topSlotNode;
        }
        if (bottomSlotRow) {
          const bottomSlot = bottomSlotRow[x];
          const bottomSlotNode = adapt(bottomSlot);
          bottomSlotRow[x] = bottomSlotNode;
        }
        // corners
        if (topLeftSlotRow) {
          const topLeftSlot = topLeftSlotRow[x];
          if (topLeftSlot) {
            const topLeftSlotNode = adapt(topLeftSlot);
            topLeftSlotRow[x] = topLeftSlotNode;
          }
        }
        if (topRightSlotRow) {
          const topRightSlot = topRightSlotRow[x];
          if (topRightSlot) {
            const topRightSlotNode = adapt(topRightSlot);
            topRightSlotRow[x] = topRightSlotNode;
          }
        }
        if (bottomRightSlotRow) {
          const bottomRightSlot = bottomRightSlotRow[x];
          if (bottomRightSlot) {
            const bottomRightSlotNode = adapt(bottomRightSlot);
            bottomRightSlotRow[x] = bottomRightSlotNode;
          }
        }
        if (bottomLeftSlotRow) {
          const bottomLeftSlot = bottomLeftSlotRow[x];
          if (bottomLeftSlot) {
            const bottomLeftSlotNode = adapt(bottomLeftSlot);
            bottomLeftSlotRow[x] = bottomLeftSlotNode;
          }
        }
        x++;
      }
      y++;
    }
  }

  // number align
  {
    const largestIntegerInColumnMap = new Map();
    const largestFloatInColumnMap = new Map();
    const formatCallbackSet = new Set();

    let y = 0;
    while (y < grid.length) {
      const row = grid[y];
      let x = 0;
      while (x < row.length) {
        const cell = row[x];
        const { value, format } = cell;

        if (format !== "size" && isFinite(value) && value !== "") {
          if (value % 1 === 0) {
            const { integer } = tokenizeInteger(Math.abs(value));
            const integerFormatted = groupDigits(integer);
            const integerWidth = measureTextWidth(integerFormatted);
            const largestIntegerInColumn =
              largestIntegerInColumnMap.get(x) || 0;
            if (integerWidth > largestIntegerInColumn) {
              largestIntegerInColumnMap.set(x, integerWidth);
            }
            formatCallbackSet.add(() => {
              const integerColumnWidth = largestIntegerInColumnMap.get(cell.x);
              let integerText = integerFormatted;
              if (integerWidth < integerColumnWidth) {
                const padding = integerColumnWidth - integerWidth;
                integerText = " ".repeat(padding) + integerFormatted;
              }
              const floatWidth = largestFloatInColumnMap.get(cell.x);
              if (floatWidth) {
                integerText += " ".repeat(floatWidth);
              }
              cell.updateValue(integerText);
            });
          } else {
            const { integer, decimalSeparator, decimal } = tokenizeFloat(
              Math.abs(value),
            );
            const integerFormatted = groupDigits(integer);
            const integerWidth = measureTextWidth(integerFormatted);
            const floatFormatted = groupDigits(decimal);
            const floatWidth = measureTextWidth(floatFormatted);
            const largestFloatInColumn = largestFloatInColumnMap.get(x) || 0;
            if (floatWidth > largestFloatInColumn) {
              largestFloatInColumnMap.set(x, floatWidth);
            }
            formatCallbackSet.add(() => {
              const integerColumnWidth = largestIntegerInColumnMap.get(cell.x);
              const floatColumnWidth = largestFloatInColumnMap.get(cell.x);
              let floatText = integerFormatted;
              if (integerWidth < integerColumnWidth) {
                const padding = integerColumnWidth - integerWidth;
                floatText = " ".repeat(padding) + integerFormatted;
              }
              floatText += decimalSeparator;
              floatText += decimal;
              if (floatWidth < floatColumnWidth) {
                const padding = floatColumnWidth - floatWidth;
                floatText += " ".repeat(padding - 1);
              }
              cell.updateValue(floatText);
            });
          }
        }
        x++;
      }
      y++;
    }

    for (const formatCallback of formatCallbackSet) {
      formatCallback();
    }
  }

  // measure column and row dimensions (biggest of all cells in the column/row)
  const columnWidthMap = new Map();
  const rowHeightMap = new Map();
  const leftColumnWidthMap = new Map();
  const rightColumnWidthMap = new Map();
  const topRowHeightMap = new Map();
  const bottomRowHeightMap = new Map();
  {
    const measureNode = (node) => {
      const {
        rects,
        spacing = 0,
        spacingLeft = spacing,
        spacingRight = spacing,
        spacingTop = spacing,
        spacingBottom = spacing,
      } = node;
      let nodeWidth = -1;
      for (const rect of rects) {
        let { width } = rect;
        if (width === "fill") {
          continue;
        }
        if (spacingLeft || spacingRight) {
          width += spacingLeft + spacingRight;
          rect.width = width;
          const { render } = rect;
          if (typeof render === "function") {
            rect.render = (...args) => {
              const text = render(...args);
              return " ".repeat(spacingLeft) + text + " ".repeat(spacingRight);
            };
          } else {
            rect.render =
              " ".repeat(spacingLeft) + render + " ".repeat(spacingRight);
          }
        }
        if (width > nodeWidth) {
          nodeWidth = width;
        }
      }
      if (spacingTop) {
        let lineToInsertAbove = spacingTop;
        while (lineToInsertAbove--) {
          rects.unshift({
            width: "fill",
            render: ({ columnWidth }) => " ".repeat(columnWidth),
          });
        }
      }
      if (spacingBottom) {
        let lineToInsertBelow = spacingBottom;
        while (lineToInsertBelow--) {
          rects.push({
            width: "fill",
            render: ({ columnWidth }) => " ".repeat(columnWidth),
          });
        }
      }
      const nodeHeight = rects.length;
      return [nodeWidth, nodeHeight];
    };

    let y = 0;
    for (const line of grid) {
      const topSlotRow = topSlotRowMap.get(y);
      const bottomSlotRow = bottomSlotRowMap.get(y);
      const leftSlotRow = leftSlotRowMap.get(y);
      const rightSlotRow = rightSlotRowMap.get(y);
      const topLeftSlotRow = topLeftSlotRowMap.get(y);
      const topRightSlotRow = topRightSlotRowMap.get(y);
      const bottomLeftSlotRow = bottomLeftSlotRowMap.get(y);
      const bottomRightSlotRow = bottomRightSlotRowMap.get(y);
      let x = 0;
      for (const cell of line) {
        if (topSlotRow) {
          const topSlot = topSlotRow[x];
          if (topSlot) {
            const [, topNodeHeight] = measureNode(topSlot);
            const topRowHeight = topRowHeightMap.get(y) || -1;
            if (topNodeHeight > topRowHeight) {
              topRowHeightMap.set(y, topNodeHeight);
            }
          }
        }
        if (bottomSlotRow) {
          const bottomSlot = bottomSlotRow[x];
          if (bottomSlot) {
            const [, bottomNodeHeight] = measureNode(bottomSlot);
            const bottomRowHeight = bottomRowHeightMap.get(y) || -1;
            if (bottomNodeHeight > bottomRowHeight) {
              bottomRowHeightMap.set(y, bottomNodeHeight);
            }
          }
        }
        if (leftSlotRow) {
          const leftSlot = leftSlotRow[x];
          if (leftSlot) {
            const [leftNodeWidth] = measureNode(leftSlot);
            const leftColumnWidth = leftColumnWidthMap.get(x) || -1;
            if (leftNodeWidth > leftColumnWidth) {
              leftColumnWidthMap.set(x, leftNodeWidth);
            }
          }
        }
        if (rightSlotRow) {
          const rightSlot = rightSlotRow[x];
          if (rightSlot) {
            const [rightNodeWidth] = measureNode(rightSlot);
            const rightColumnWidth = rightColumnWidthMap.get(x) || -1;
            if (rightNodeWidth > rightColumnWidth) {
              rightColumnWidthMap.set(x, rightNodeWidth);
            }
          }
        }
        if (topLeftSlotRow) {
          const topLeftSlot = topLeftSlotRow[x];
          if (topLeftSlot) {
            const [topLeftNodeWidth, topLeftNodeHeight] =
              measureNode(topLeftSlot);
            const leftColumnWidth = leftColumnWidthMap.get(x) || -1;
            if (topLeftNodeWidth > leftColumnWidth) {
              leftColumnWidthMap.set(x, topLeftNodeWidth);
            }
            const topRowHeight = topRowHeightMap.get(y) || -1;
            if (topLeftNodeHeight > topRowHeight) {
              topRowHeightMap.set(y, topLeftNodeHeight);
            }
          }
        }
        if (topRightSlotRow) {
          const topRightSlot = topRightSlotRow[x];
          if (topRightSlot) {
            const [topRightNodeWidth, topRightNodeHeight] =
              measureNode(topRightSlot);
            const rightColumnWidth = rightColumnWidthMap.get(x) || -1;
            if (topRightNodeWidth > rightColumnWidth) {
              rightColumnWidthMap.set(x, topRightNodeWidth);
            }
            const topRowHeight = topRowHeightMap.get(y) || -1;
            if (topRightNodeHeight > topRowHeight) {
              topRowHeightMap.set(y, topRightNodeHeight);
            }
          }
        }
        if (bottomLeftSlotRow) {
          const bottomLeftSlot = bottomLeftSlotRow[x];
          if (bottomLeftSlot) {
            const [bottomLeftNodeWidth, bottomLeftNodeHeight] =
              measureNode(bottomLeftSlot);
            const leftColumnWidth = leftColumnWidthMap.get(x) || -1;
            if (bottomLeftNodeWidth > leftColumnWidth) {
              leftColumnWidthMap.set(x, bottomLeftNodeWidth);
            }
            const bottomRowHeight = bottomRowHeightMap.get(y) || -1;
            if (bottomLeftNodeHeight > bottomRowHeight) {
              bottomRowHeightMap.set(y, bottomLeftNodeHeight);
            }
          }
        }
        if (bottomRightSlotRow) {
          const bottomRightSlot = bottomRightSlotRow[x];
          if (bottomRightSlot) {
            const [bottomRightNodeWidth, bottomRightNodeHeight] =
              measureNode(bottomRightSlot);
            const rightColumnWidth = rightColumnWidthMap.get(x) || -1;
            if (bottomRightNodeWidth > rightColumnWidth) {
              rightColumnWidthMap.set(x, bottomRightNodeWidth);
            }
            const bottomRowHeight = bottomRowHeightMap.get(y) || -1;
            if (bottomRightNodeHeight > bottomRowHeight) {
              bottomRowHeightMap.set(y, bottomRightNodeHeight);
            }
          }
        }

        const columnWidth = columnWidthMap.get(x) || -1;
        const rowHeight = rowHeightMap.get(y) || -1;
        const [cellWidth, cellHeight] = measureNode(cell);
        if (cellWidth > columnWidth) {
          columnWidthMap.set(x, cellWidth);
        }
        if (cellHeight > rowHeight) {
          rowHeightMap.set(y, cellHeight);
        }
        x++;
      }
      y++;
    }
  }

  // render table
  let log = "";
  {
    const renderRow = (
      nodeArray,
      { cells, rowHeight, leftSlotRow, rightSlotRow },
    ) => {
      let rowText = "";
      let lastLineIndex = rowHeight;
      let lineIndex = 0;
      while (lineIndex !== lastLineIndex) {
        let x = 0;
        let lineText = "";
        for (const node of nodeArray) {
          const cell = cells[x];
          const nodeLineText = renderNode(node, {
            cell,
            columnWidth: columnWidthMap.get(x),
            rowHeight,
            lineIndex,
          });
          let leftSlotLineText;
          let rightSlotLineText;
          if (leftSlotRow) {
            const leftSlot = leftSlotRow[x];
            if (leftSlot) {
              leftSlotLineText = renderNode(leftSlot, {
                cell,
                columnWidth: leftColumnWidthMap.get(x),
                rowHeight,
                lineIndex,
              });
            }
          }
          if (rightSlotRow) {
            const rightSlot = rightSlotRow[x];
            if (rightSlot) {
              rightSlotLineText = renderNode(rightSlot, {
                cell,
                columnWidth: rightColumnWidthMap.get(x),
                rowHeight,
                lineIndex,
              });
            }
          }
          if (leftSlotLineText && rightSlotLineText) {
            lineText += leftSlotLineText + nodeLineText + rightSlotLineText;
          } else if (leftSlotLineText) {
            lineText += leftSlotLineText + nodeLineText;
          } else if (rightSlotLineText) {
            lineText += nodeLineText + rightSlotLineText;
          } else {
            lineText += nodeLineText;
          }
          x++;
        }
        lineIndex++;
        if (indent && log) {
          rowText = " ".repeat(indent) + rowText;
        }
        rowText += lineText;
        rowText += "\n";
      }
      return rowText;
    };
    const renderNode = (node, { cell, columnWidth, rowHeight, lineIndex }) => {
      let { xAlign, xPadChar = " ", yAlign, yPadChar = " ", rects } = node;

      const nodeHeight = rects.length;
      let rect;
      if (yAlign === "start") {
        if (lineIndex < nodeHeight) {
          rect = rects[lineIndex];
        }
      } else if (yAlign === "center") {
        const lineMissingAbove = Math.floor((rowHeight - nodeHeight) / 2);
        // const bottomSpacing = rowHeight - cellHeight - topSpacing;
        const lineStartIndex = lineMissingAbove;
        const lineEndIndex = lineMissingAbove + nodeHeight;

        if (lineIndex < lineStartIndex) {
          if (Array.isArray(yPadChar)) {
            yPadChar = yPadChar[0];
          }
        } else if (lineIndex < lineEndIndex) {
          const rectIndex = lineIndex - lineStartIndex;
          rect = rects[rectIndex];
        } else if (Array.isArray(yPadChar)) {
          yPadChar = yPadChar[1];
        }
      } else {
        const lineStartIndex = rowHeight - nodeHeight;
        if (lineIndex >= lineStartIndex) {
          const rectIndex = lineIndex - lineStartIndex;
          rect = rects[rectIndex];
        }
      }

      const applyStyles = (text, { backgroundColor, color, bold }) => {
        if (!ansi) {
          return text;
        }
        let textWithStyles = text;

        {
          if (typeof backgroundColor === "function") {
            backgroundColor = backgroundColor(cell, { columnWidth });
          }
          if (backgroundColor) {
            textWithStyles = ANSI.backgroundColor(
              textWithStyles,
              backgroundColor,
            );
          }
        }
        {
          if (typeof color === "function") {
            color = color(cell, { columnWidth });
          }
          if (color === undefined && backgroundColor === COLORS.WHITE) {
            color = COLORS.BLACK;
          }
          if (color) {
            textWithStyles = ANSI.color(textWithStyles, color);
          }
        }
        {
          if (typeof bold === "function") {
            bold = bold(cell, { columnWidth });
          }
          if (bold) {
            textWithStyles = ANSI.effect(textWithStyles, ANSI.BOLD);
          }
        }
        return textWithStyles;
      };

      if (rect) {
        let { width, render } = rect;
        let rectText;
        if (typeof render === "function") {
          rectText = render({
            ansi,
            cell,
            columnWidth,
          });
        } else {
          rectText = render;
        }
        if (width === "fill") {
          return applyStyles(rectText, rect);
        }
        return applyStyles(
          applyXAlign(rectText, {
            width,
            desiredWidth: columnWidth,
            align: xAlign,
            padChar: xPadChar,
          }),
          rect,
        );
      }
      return applyStyles(
        applyXAlign(yPadChar, {
          width: 1,
          desiredWidth: columnWidth,
          align: xAlign,
          padChar: " ",
        }),
        node,
      );
    };

    let y = 0;
    for (const row of grid) {
      {
        const topSlotRow = topSlotRowMap.get(y);
        if (topSlotRow) {
          const topSlotRowText = renderRow(topSlotRow, {
            cells: row,
            rowHeight: topRowHeightMap.get(y),
            leftSlotRow: topLeftSlotRowMap.get(y),
            rightSlotRow: topRightSlotRowMap.get(y),
          });
          log += topSlotRowText;
        }
      }
      {
        const contentRowText = renderRow(row, {
          cells: row,
          rowHeight: rowHeightMap.get(y),
          leftSlotRow: leftSlotRowMap.get(y),
          rightSlotRow: rightSlotRowMap.get(y),
        });
        log += contentRowText;
      }
      {
        const bottomSlotRow = bottomSlotRowMap.get(y);
        if (bottomSlotRow) {
          const bottomSlotRowText = renderRow(bottomSlotRow, {
            cells: row,
            rowHeight: bottomRowHeightMap.get(y),
            leftSlotRow: bottomLeftSlotRowMap.get(y),
            rightSlotRow: bottomRightSlotRowMap.get(y),
          });
          log += bottomSlotRowText;
        }
      }
      y++;
    }
    if (log.endsWith("\n")) {
      log = log.slice(0, -1); // remove last "\n"
    }
  }
  return log;
};

const applyXAlign = (text, { width, desiredWidth, align, padChar }) => {
  const missingWidth = desiredWidth - width;
  if (missingWidth < 0) {
    // never supposed to happen because the width of a column
    // is the biggest width of all cells in this column
    return text;
  }
  if (missingWidth === 0) {
    return text;
  }
  // if (align === "fill") {
  //   let textRepeated = "";
  //   let widthFilled = 0;
  //   while (true) {
  //     textRepeated += text;
  //     widthFilled += width;
  //     if (widthFilled >= desiredWidth) {
  //       break;
  //     }
  //   }
  //   return textRepeated;
  // }
  if (align === "start") {
    return text + padChar.repeat(missingWidth);
  }
  if (align === "center") {
    const widthMissingLeft = Math.floor(missingWidth / 2);
    const widthMissingRight = missingWidth - widthMissingLeft;
    let padStartChar = padChar;
    let padEndChar = padChar;
    if (Array.isArray(padChar)) {
      padStartChar = padChar[0];
      padEndChar = padChar[1];
    }
    return (
      padStartChar.repeat(widthMissingLeft) +
      text +
      padEndChar.repeat(widthMissingRight)
    );
  }
  // "end"
  return padChar.repeat(missingWidth) + text;
};

const createCell = (
  {
    value,
    color,
    backgroundColor,
    format,
    bold,
    unit,
    unitColor,
    spacing = 0,
    spacingLeft = spacing || 1,
    spacingRight = spacing || 1,
    spacingTop = spacing,
    spacingBottom = spacing,
    xAlign = "start", // "start", "center", "end"
    yAlign = "start", // "start", "center", "end"
    maxWidth,
    maxHeight,
    border,
    borderLeft = border,
    borderRight = border,
    borderTop = border,
    borderBottom = border,
  },
  { x, y, cellMaxWidth, cellMaxHeight },
) => {
  if (maxWidth === undefined) {
    maxWidth = cellMaxWidth;
  } else if (maxWidth < 1) {
    maxWidth = 1;
  }
  if (maxHeight === undefined) {
    maxHeight = cellMaxHeight;
  } else if (maxHeight < 1) {
    maxHeight = 1;
  }

  if (format === "size") {
    const size = humanizeFileSize(value);
    const parts = size.split(" ");
    value = parts[0];
    unit = parts[1];
  }

  const rects = [];
  const updateValue = (value) => {
    cell.value = value;
    rects.length = 0;
    let text = String(value);
    let lines = text.split("\n");
    const lineCount = lines.length;
    let skippedLineCount;
    let lastLineIndex = lineCount - 1;
    if (lineCount > maxHeight) {
      lines = lines.slice(0, maxHeight - 1);
      lastLineIndex = maxHeight - 1;
      skippedLineCount = lineCount - maxHeight + 1;
      lines.push(`↓ ${skippedLineCount} lines ↓`);
    }

    let lineIndex = 0;

    for (const line of lines) {
      const isLastLine = lineIndex === lastLineIndex;
      let lineWidth = measureTextWidth(line);
      let lineText = line;
      if (lineWidth > maxWidth) {
        const skippedBoilerplate = "…";
        // const skippedCharCount = lineWidth - maxWidth - skippedBoilerplate.length;
        lineText = lineText.slice(0, maxWidth - skippedBoilerplate.length);
        lineText += skippedBoilerplate;
        lineWidth = maxWidth;
      }
      if (isLastLine && unit) {
        lineWidth += ` ${unit}`.length;
      }
      rects.push({
        width: lineWidth,
        render: ({ ansi }) => {
          if (isLastLine && unit) {
            const unitWithStyles =
              ansi && unitColor ? ANSI.color(unit, unitColor) : unit;
            lineText += ` ${unitWithStyles}`;
            return lineText;
          }
          return lineText;
        },
        backgroundColor: cell.backgroundColor,
        color: cell.color,
        bold: cell.bold,
      });
      lineIndex++;
    }
    if (skippedLineCount) {
      rects[rects.length - 1].color = COLORS.GREY;
    }
  };

  const cell = {
    type: "content",
    xAlign,
    yAlign,
    spacingLeft,
    spacingRight,
    spacingTop,
    spacingBottom,
    format,
    backgroundColor,
    color,
    bold,
    rects,
    x,
    y,
    updateValue,

    border,
    borderLeft,
    borderRight,
    borderTop,
    borderBottom,
  };

  updateValue(value);

  return cell;
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

export { ANSI, Abort, CONTENT_TYPE, DATA_URL, JS_QUOTES, RUNTIME_COMPAT, UNICODE, URL_META, applyFileSystemMagicResolution, applyNodeEsmResolution, asSpecifierWithoutSearch, asUrlWithoutSearch, assertAndNormalizeDirectoryUrl, browserDefaultRuntimeCompat, bufferToEtag, clearDirectorySync, compareFileUrls, comparePathnames, composeTwoImportMaps, createDetailedMessage$1 as createDetailedMessage, createDynamicLog, createLogger, createLookupPackageDirectory, createTaskLog, distributePercentages, ensureEmptyDirectory, ensurePathnameTrailingSlash, ensureWindowsDriveLetter, errorToHTML, escapeRegexpSpecialChars, generateContentFrame, getCallerPosition, getExtensionsToTry, humanizeDuration, humanizeFileSize, humanizeMemory, inferRuntimeCompatFromClosestPackage, injectQueryParamIntoSpecifierWithoutEncoding, injectQueryParams, injectQueryParamsIntoSpecifier, isFileSystemPath, isSpecifierForNodeBuiltin, lookupPackageDirectory, moveUrl, nodeDefaultRuntimeCompat, normalizeImportMap, normalizeUrl, raceProcessTeardownEvents, readCustomConditionsFromProcessArgs, readEntryStatSync, readPackageAtOrNull, registerDirectoryLifecycle, renderBigSection, renderDetails, renderTable, renderUrlOrRelativeUrlFilename, resolveImport, setUrlBasename, setUrlExtension, setUrlFilename, startMonitoringCpuUsage, startMonitoringMemoryUsage, stringifyUrlSite, updateJsonFileSync, urlIsOrIsInsideOf, urlToBasename, urlToExtension$1 as urlToExtension, urlToFileSystemPath, urlToFilename$1 as urlToFilename, urlToPathname$1 as urlToPathname, urlToRelativeUrl, validateResponseIntegrity, writeFileSync };
