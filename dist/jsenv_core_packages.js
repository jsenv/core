import stripAnsi from "strip-ansi";
import stringWidth from "string-width";
import { createSupportsColor, isUnicodeSupported, clearTerminal, eraseLines, createSupportsColor$1, isUnicodeSupported$1, clearTerminal$1, eraseLines$1, createSupportsColor$2, isUnicodeSupported$2, clearTerminal$2, eraseLines$2 } from "./jsenv_core_node_modules.js";
import { existsSync, chmodSync, statSync, lstatSync, readdirSync, openSync, closeSync, unlinkSync, rmdirSync, mkdirSync, readFileSync, writeFileSync as writeFileSync$2, watch, realpathSync, readdir, chmod, stat, lstat, promises, unlink, rmdir } from "node:fs";
import { extname } from "node:path";
import crypto, { createHash } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
import { parseJsUrls, parseHtml, visitHtmlNodes, analyzeScriptNode, getHtmlNodeAttribute, getHtmlNodeText, stringifyHtmlAst, setHtmlNodeAttributes, applyBabelPlugins, injectJsImport, visitJsAstUntil } from "@jsenv/ast";
import { createMagicSource, composeTwoSourcemaps, sourcemapConverter } from "@jsenv/sourcemap";
import { createRequire } from "node:module";
import { convertJsModuleToJsClassic, systemJsClientFileUrlDefault } from "@jsenv/js-module-fallback";

/*
 * data:[<mediatype>][;base64],<data>
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs#syntax
 */

/* eslint-env browser, node */

const DATA_URL$1 = {
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

const createDetailedMessage$3 = (message, details = {}) => {
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

// https://github.com/Marak/colors.js/blob/master/lib/styles.js
// https://stackoverflow.com/a/75985833/2634179
const RESET$2 = "\x1b[0m";

const createAnsi$2 = ({ supported }) => {
  const ANSI = {
    supported,

    RED: "\x1b[31m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    BLUE: "\x1b[34m",
    MAGENTA: "\x1b[35m",
    CYAN: "\x1b[36m",
    GREY: "\x1b[90m",
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
      return `${color}${text}${RESET$2}`;
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
      return `${effect}${text}${RESET$2}`;
    },
  };

  return ANSI;
};

const processSupportsBasicColor$2 = createSupportsColor(process.stdout).hasBasic;

const ANSI$2 = createAnsi$2({
  supported:
    process.env.FORCE_COLOR === "1" ||
    processSupportsBasicColor$2 ||
    // GitHub workflow does support ANSI but "supports-color" returns false
    // because stream.isTTY returns false, see https://github.com/actions/runner/issues/241
    process.env.GITHUB_WORKFLOW,
});

// see also https://github.com/sindresorhus/figures

const createUnicode$2 = ({ supported, ANSI }) => {
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

const UNICODE$2 = createUnicode$2({
  supported: process.env.FORCE_UNICODE === "1" || isUnicodeSupported(),
  ANSI: ANSI$2,
});

const setRoundedPrecision$2 = (
  number,
  { decimals = 1, decimalsWhenSmall = decimals } = {},
) => {
  return setDecimalsPrecision$2(number, {
    decimals,
    decimalsWhenSmall,
    transform: Math.round,
  });
};

const setPrecision$2 = (
  number,
  { decimals = 1, decimalsWhenSmall = decimals } = {},
) => {
  return setDecimalsPrecision$2(number, {
    decimals,
    decimalsWhenSmall,
    transform: parseInt,
  });
};

const setDecimalsPrecision$2 = (
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

const unitShort$2 = {
  year: "y",
  month: "m",
  week: "w",
  day: "d",
  hour: "h",
  minute: "m",
  second: "s",
};

const humanizeDuration$2 = (
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
  const { primary, remaining } = parseMs$2(ms);
  if (!remaining) {
    return humanizeDurationUnit$2(primary, {
      decimals:
        decimals === undefined ? (primary.name === "second" ? 1 : 0) : decimals,
      short,
      rounded,
    });
  }
  return `${humanizeDurationUnit$2(primary, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
  })} and ${humanizeDurationUnit$2(remaining, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
  })}`;
};
const humanizeDurationUnit$2 = (unit, { decimals, short, rounded }) => {
  const count = rounded
    ? setRoundedPrecision$2(unit.count, { decimals })
    : setPrecision$2(unit.count, { decimals });
  let name = unit.name;
  if (short) {
    name = unitShort$2[name];
    return `${count}${name}`;
  }
  if (count <= 1) {
    return `${count} ${name}`;
  }
  return `${count} ${name}s`;
};
const MS_PER_UNITS$2 = {
  year: 31_557_600_000,
  month: 2_629_000_000,
  week: 604_800_000,
  day: 86_400_000,
  hour: 3_600_000,
  minute: 60_000,
  second: 1000,
};

const parseMs$2 = (ms) => {
  const unitNames = Object.keys(MS_PER_UNITS$2);
  const smallestUnitName = unitNames[unitNames.length - 1];
  let firstUnitName = smallestUnitName;
  let firstUnitCount = ms / MS_PER_UNITS$2[smallestUnitName];
  const firstUnitIndex = unitNames.findIndex((unitName) => {
    if (unitName === smallestUnitName) {
      return false;
    }
    const msPerUnit = MS_PER_UNITS$2[unitName];
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
  const remainingMs = ms - firstUnitCount * MS_PER_UNITS$2[firstUnitName];
  const remainingUnitName = unitNames[firstUnitIndex + 1];
  const remainingUnitCount = remainingMs / MS_PER_UNITS$2[remainingUnitName];
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

const formatDefault$1 = (v) => v;

const generateContentFrame$1 = ({
  content,
  line,
  column,

  linesAbove = 3,
  linesBelow = 0,
  lineMaxWidth = 120,
  lineNumbersOnTheLeft = true,
  lineMarker = true,
  columnMarker = true,
  format = formatDefault$1,
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
      source += truncateLine$1(lineString, {
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

const truncateLine$1 = (line, { start, end, prefix, suffix, format }) => {
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

const LOG_LEVEL_OFF$2 = "off";

const LOG_LEVEL_DEBUG$2 = "debug";

const LOG_LEVEL_INFO$2 = "info";

const LOG_LEVEL_WARN$2 = "warn";

const LOG_LEVEL_ERROR$2 = "error";

const createLogger$2 = ({ logLevel = LOG_LEVEL_INFO$2 } = {}) => {
  if (logLevel === LOG_LEVEL_DEBUG$2) {
    return {
      level: "debug",
      levels: { debug: true, info: true, warn: true, error: true },
      debug: debug$2,
      info: info$2,
      warn: warn$2,
      error: error$2,
    };
  }
  if (logLevel === LOG_LEVEL_INFO$2) {
    return {
      level: "info",
      levels: { debug: false, info: true, warn: true, error: true },
      debug: debugDisabled$2,
      info: info$2,
      warn: warn$2,
      error: error$2,
    };
  }
  if (logLevel === LOG_LEVEL_WARN$2) {
    return {
      level: "warn",
      levels: { debug: false, info: false, warn: true, error: true },
      debug: debugDisabled$2,
      info: infoDisabled$2,
      warn: warn$2,
      error: error$2,
    };
  }
  if (logLevel === LOG_LEVEL_ERROR$2) {
    return {
      level: "error",
      levels: { debug: false, info: false, warn: false, error: true },
      debug: debugDisabled$2,
      info: infoDisabled$2,
      warn: warnDisabled$2,
      error: error$2,
    };
  }
  if (logLevel === LOG_LEVEL_OFF$2) {
    return {
      level: "off",
      levels: { debug: false, info: false, warn: false, error: false },
      debug: debugDisabled$2,
      info: infoDisabled$2,
      warn: warnDisabled$2,
      error: errorDisabled$2,
    };
  }
  throw new Error(`unexpected logLevel.
--- logLevel ---
${logLevel}
--- allowed log levels ---
${LOG_LEVEL_OFF$2}
${LOG_LEVEL_ERROR$2}
${LOG_LEVEL_WARN$2}
${LOG_LEVEL_INFO$2}
${LOG_LEVEL_DEBUG$2}`);
};

const debug$2 = (...args) => console.debug(...args);

const debugDisabled$2 = () => {};

const info$2 = (...args) => console.info(...args);

const infoDisabled$2 = () => {};

const warn$2 = (...args) => console.warn(...args);

const warnDisabled$2 = () => {};

const error$2 = (...args) => console.error(...args);

const errorDisabled$2 = () => {};

/*
 * see also https://github.com/vadimdemedes/ink
 */


const createDynamicLog$2 = ({
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
      const width = stringWidth(logLine);
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
    const removeStdoutSpy = spyStreamOutput$2(
      process.stdout,
      writeFromOutsideEffect,
    );
    const removeStderrSpy = spyStreamOutput$2(
      process.stderr,
      writeFromOutsideEffect,
    );
    removeStreamSpy = () => {
      removeStdoutSpy();
      removeStderrSpy();
    };
  } else {
    removeStreamSpy = spyStreamOutput$2(stream, writeFromOutsideEffect);
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
const spyStreamOutput$2 = (stream, callback) => {
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

const startSpinner$2 = ({
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
  if (animated && ANSI$2.supported) {
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

const createTaskLog$2 = (
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
  const dynamicLog = createDynamicLog$2();
  let message = label;
  const taskSpinner = startSpinner$2({
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
        `${UNICODE$2.OK} ${label} (done in ${humanizeDuration$2(msEllapsed)})`,
      );
    },
    happen: (message) => {
      taskSpinner.stop(
        `${UNICODE$2.INFO} ${message} (at ${new Date().toLocaleTimeString()})`,
      );
    },
    fail: (message = `failed to ${label}`) => {
      taskSpinner.stop(`${UNICODE$2.FAILURE} ${message}`);
    },
  };
};

// consider switching to https://babeljs.io/docs/en/babel-code-frame
// https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/css-syntax-error.js#L43
// https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/terminal-highlight.js#L50
// https://github.com/babel/babel/blob/eea156b2cb8deecfcf82d52aa1b71ba4995c7d68/packages/babel-code-frame/src/index.js#L1


const stringifyUrlSite$1 = (
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

  const sourceLoc = generateContentFrame$1({
    content,
    line,
    column});
  return `${string}
${sourceLoc}`;
};

const pathnameToExtension$4 = (pathname) => {
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

const resourceToPathname$2 = (resource) => {
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

const urlToScheme$4 = (url) => {
  const urlString = String(url);
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) {
    return "";
  }

  const scheme = urlString.slice(0, colonIndex);
  return scheme;
};

const urlToResource$2 = (url) => {
  const scheme = urlToScheme$4(url);

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

const urlToPathname$4 = (url) => {
  const resource = urlToResource$2(url);
  const pathname = resourceToPathname$2(resource);
  return pathname;
};

const urlToFilename$3 = (url) => {
  const pathname = urlToPathname$4(url);
  return pathnameToFilename$1(pathname);
};

const pathnameToFilename$1 = (pathname) => {
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

const urlToBasename$1 = (url, removeAllExtensions) => {
  const filename = urlToFilename$3(url);
  const basename = filenameToBasename$1(filename);
  {
    return basename;
  }
};

const filenameToBasename$1 = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  const basename =
    dotLastIndex === -1 ? filename : filename.slice(0, dotLastIndex);
  return basename;
};

const urlToExtension$4 = (url) => {
  const pathname = urlToPathname$4(url);
  return pathnameToExtension$4(pathname);
};

const urlToOrigin$3 = (url) => {
  const urlString = String(url);
  if (urlString.startsWith("file://")) {
    return `file://`;
  }
  return new URL(urlString).origin;
};

const asUrlWithoutSearch$1 = (url) => {
  url = String(url);
  if (url.includes("?")) {
    const urlObject = new URL(url);
    urlObject.search = "";
    return urlObject.href;
  }
  return url;
};

const isValidUrl$3 = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const asSpecifierWithoutSearch$1 = (specifier) => {
  if (isValidUrl$3(specifier)) {
    return asUrlWithoutSearch$1(specifier);
  }
  const [beforeQuestion] = specifier.split("?");
  return beforeQuestion;
};

// normalize url search params:
// Using URLSearchParams to alter the url search params
// can result into "file:///file.css?css_module"
// becoming "file:///file.css?css_module="
// we want to get rid of the "=" and consider it's the same url
const normalizeUrl$1 = (url) => {
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

const injectQueryParamsIntoSpecifier$1 = (specifier, params) => {
  if (isValidUrl$3(specifier)) {
    return injectQueryParams$1(specifier, params);
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

const injectQueryParams$1 = (url, params) => {
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
  return normalizeUrl$1(calledWithString ? urlObject.href : urlObject);
};

const setUrlExtension$1 = (url, extension) => {
  const origin = urlToOrigin$3(url);
  const currentExtension = urlToExtension$4(url);
  if (typeof extension === "function") {
    extension = extension(currentExtension);
  }
  const resource = urlToResource$2(url);
  const [pathname, search] = resource.split("?");
  const pathnameWithoutExtension = currentExtension
    ? pathname.slice(0, -currentExtension.length)
    : pathname;
  let newPathname;
  if (pathnameWithoutExtension.endsWith("/")) {
    newPathname = pathnameWithoutExtension.slice(0, -1);
    newPathname += extension;
    newPathname += "/";
  } else {
    newPathname = pathnameWithoutExtension;
    newPathname += extension;
  }
  return `${origin}${newPathname}${search ? `?${search}` : ""}`;
};

const setUrlFilename$1 = (url, filename) => {
  const parentPathname = new URL("./", url).pathname;
  return transformUrlPathname$2(url, (pathname) => {
    if (typeof filename === "function") {
      filename = filename(pathnameToFilename$1(pathname));
    }
    return `${parentPathname}${filename}`;
  });
};

const setUrlBasename$1 = (url, basename) => {
  return setUrlFilename$1(url, (filename) => {
    if (typeof basename === "function") {
      basename = basename(filenameToBasename$1(filename));
    }
    return `${basename}${urlToExtension$4(url)}`;
  });
};

const transformUrlPathname$2 = (url, transformer) => {
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
const ensurePathnameTrailingSlash$2 = (url) => {
  return transformUrlPathname$2(url, (pathname) => {
    return pathname.endsWith("/") ? pathname : `${pathname}/`;
  });
};

const isFileSystemPath$2 = (value) => {
  if (typeof value !== "string") {
    throw new TypeError(
      `isFileSystemPath first arg must be a string, got ${value}`,
    );
  }
  if (value[0] === "/") {
    return true;
  }
  return startsWithWindowsDriveLetter$2(value);
};

const startsWithWindowsDriveLetter$2 = (string) => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;

  const secondChar = string[1];
  if (secondChar !== ":") return false;

  return true;
};

const fileSystemPathToUrl$2 = (value) => {
  if (!isFileSystemPath$2(value)) {
    throw new Error(`value must be a filesystem path, got ${value}`);
  }
  return String(pathToFileURL(value));
};

const getCallerPosition$1 = () => {
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
      fileName && isFileSystemPath$2(fileName)
        ? fileSystemPathToUrl$2(fileName)
        : fileName,
    line: callerCallsite.getLineNumber(),
    column: callerCallsite.getColumnNumber(),
  };
};

const resolveUrl$3 = (specifier, baseUrl) => {
  if (typeof baseUrl === "undefined") {
    throw new TypeError(`baseUrl missing to resolve ${specifier}`);
  }
  return String(new URL(specifier, baseUrl));
};

const getCommonPathname$1 = (pathname, otherPathname) => {
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

const urlToRelativeUrl$1 = (
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
  const commonPathname = getCommonPathname$1(pathname, basePathname);
  if (!commonPathname) {
    const urlAsString = String(url);
    return urlAsString;
  }
  const specificPathname = pathname.slice(commonPathname.length);
  const baseSpecificPathname = basePathname.slice(commonPathname.length);
  if (baseSpecificPathname.includes("/")) {
    const baseSpecificParentPathname =
      pathnameToParentPathname$3(baseSpecificPathname);
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

const pathnameToParentPathname$3 = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return "/";
  }
  return pathname.slice(0, slashLastIndex + 1);
};

const moveUrl$1 = ({ url, from, to, preferRelative }) => {
  let relativeUrl = urlToRelativeUrl$1(url, from);
  if (relativeUrl.slice(0, 2) === "//") {
    // restore the protocol
    relativeUrl = new URL(relativeUrl, url).href;
  }
  const absoluteUrl = new URL(relativeUrl, to).href;
  if (preferRelative) {
    return urlToRelativeUrl$1(absoluteUrl, to);
  }
  return absoluteUrl;
};

const urlIsInsideOf$1 = (url, otherUrl) => {
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

const urlToFileSystemPath$1 = (url) => {
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

const validateDirectoryUrl$2 = (value) => {
  let urlString;

  if (value instanceof URL) {
    urlString = value.href;
  } else if (typeof value === "string") {
    if (isFileSystemPath$2(value)) {
      urlString = fileSystemPathToUrl$2(value);
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
    value: ensurePathnameTrailingSlash$2(urlString),
  };
};

const assertAndNormalizeDirectoryUrl$2 = (
  directoryUrl,
  name = "directoryUrl",
) => {
  const { valid, message, value } = validateDirectoryUrl$2(directoryUrl);
  if (!valid) {
    throw new TypeError(`${name} ${message}, got ${value}`);
  }
  return value;
};

const validateFileUrl$1 = (value, baseUrl) => {
  let urlString;

  if (value instanceof URL) {
    urlString = value.href;
  } else if (typeof value === "string") {
    if (isFileSystemPath$2(value)) {
      urlString = fileSystemPathToUrl$2(value);
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

const assertAndNormalizeFileUrl$1 = (
  fileUrl,
  baseUrl,
  name = "fileUrl",
) => {
  const { valid, message, value } = validateFileUrl$1(fileUrl, baseUrl);
  if (!valid) {
    throw new TypeError(`${name} ${message}, got ${fileUrl}`);
  }
  return value;
};

const comparePathnames$1 = (leftPathame, rightPathname) => {
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

const compareFileUrls$1 = (a, b) => {
  return comparePathnames$1(new URL(a).pathname, new URL(b).pathname);
};

const isWindows$6 = process.platform === "win32";
const baseUrlFallback$1 = fileSystemPathToUrl$2(process.cwd());

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

const ensureWindowsDriveLetter$1 = (url, baseUrl) => {
  try {
    url = String(new URL(url));
  } catch {
    throw new Error(`absolute url expect but got ${url}`);
  }

  if (!isWindows$6) {
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
  if (extractDriveLetter$1(afterProtocol)) {
    return url;
  }

  // drive letter was lost, restore it
  const baseUrlOrFallback = baseUrl.startsWith("file://")
    ? baseUrl
    : baseUrlFallback$1;
  const driveLetter = extractDriveLetter$1(
    baseUrlOrFallback.slice("file://".length),
  );
  if (!driveLetter) {
    throw new Error(
      `drive letter expect on baseUrl but got ${baseUrl} to ensure windows drive letter on ${url}`,
    );
  }
  return `file:///${driveLetter}:${afterProtocol}`;
};

const extractDriveLetter$1 = (resource) => {
  // we still have the windows drive letter
  if (/[a-zA-Z]/.test(resource[1]) && resource[2] === ":") {
    return resource[1];
  }
  return null;
};

const getParentDirectoryUrl$1 = (url) => {
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

const findAncestorDirectoryUrl$1 = (url, callback) => {
  url = String(url);
  while (url !== "file:///") {
    if (callback(url)) {
      return url;
    }
    url = getParentDirectoryUrl$1(url);
  }
  return null;
};

const lookupPackageDirectory$1 = (currentUrl) => {
  return findAncestorDirectoryUrl$1(currentUrl, (ancestorDirectoryUrl) => {
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
const applyPattern$1 = ({ url, pattern }) => {
  const { matched, patternIndex, index, groups } = applyMatching$1(pattern, url);
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
const applyMatching$1 = (pattern, string) => {
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
      const skipResult = skipUntilMatchIterative$1({
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
        const skipResult = skipUntilMatchIterative$1({
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
      const skipResult = skipUntilMatchIterative$1({
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
const skipUntilMatchIterative$1 = ({ pattern, string, canSkipSlash }) => {
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
    const matchAttempt = applyMatching$1(pattern, remainingString);

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

const applyPatternMatching$1 = ({ url, pattern }) => {
  assertUrlLike$1(pattern, "pattern");
  if (url && typeof url.href === "string") url = url.href;
  assertUrlLike$1(url, "url");
  return applyPattern$1({ url, pattern });
};

const resolveAssociations$1 = (associations, resolver) => {
  let resolve = () => {};
  if (typeof resolver === "function") {
    resolve = resolver;
  } else if (typeof resolver === "string") {
    const baseUrl = resolver;
    assertUrlLike$1(baseUrl, "baseUrl");
    resolve = (pattern) => new URL(pattern, baseUrl).href;
  } else if (resolver && typeof resolver.href === "string") {
    const baseUrl = resolver.href;
    assertUrlLike$1(baseUrl, "baseUrl");
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

const asFlatAssociations$1 = (associations) => {
  if (!isPlainObject$1(associations)) {
    throw new TypeError(
      `associations must be a plain object, got ${associations}`,
    );
  }
  const flatAssociations = {};
  for (const associationName of Object.keys(associations)) {
    const associationValue = associations[associationName];
    if (!isPlainObject$1(associationValue)) {
      continue;
    }
    for (const pattern of Object.keys(associationValue)) {
      const patternValue = associationValue[pattern];
      const previousValue = flatAssociations[pattern];
      if (isPlainObject$1(previousValue)) {
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

const applyAssociations$1 = ({ url, associations }) => {
  if (url && typeof url.href === "string") url = url.href;
  assertUrlLike$1(url);
  const flatAssociations = asFlatAssociations$1(associations);
  let associatedValue = {};
  for (const pattern of Object.keys(flatAssociations)) {
    const { matched } = applyPatternMatching$1({
      pattern,
      url,
    });
    if (matched) {
      const value = flatAssociations[pattern];
      associatedValue = deepAssign$1(associatedValue, value);
    }
  }
  return associatedValue;
};

const deepAssign$1 = (firstValue, secondValue) => {
  if (!isPlainObject$1(firstValue)) {
    if (isPlainObject$1(secondValue)) {
      return deepAssign$1({}, secondValue);
    }
    return secondValue;
  }
  if (!isPlainObject$1(secondValue)) {
    return secondValue;
  }
  for (const key of Object.keys(secondValue)) {
    const leftPopertyValue = firstValue[key];
    const rightPropertyValue = secondValue[key];
    firstValue[key] = deepAssign$1(leftPopertyValue, rightPropertyValue);
  }
  return firstValue;
};

const urlChildMayMatch$1 = ({ url, associations, predicate }) => {
  if (url && typeof url.href === "string") url = url.href;
  assertUrlLike$1(url, "url");
  // the function was meants to be used on url ending with '/'
  if (!url.endsWith("/")) {
    throw new Error(`url should end with /, got ${url}`);
  }
  if (typeof predicate !== "function") {
    throw new TypeError(`predicate must be a function, got ${predicate}`);
  }
  const flatAssociations = asFlatAssociations$1(associations);
  // for full match we must create an object to allow pattern to override previous ones
  let fullMatchMeta = {};
  let someFullMatch = false;
  // for partial match, any meta satisfying predicate will be valid because
  // we don't know for sure if pattern will still match for a file inside pathname
  const partialMatchMetaArray = [];
  for (const pattern of Object.keys(flatAssociations)) {
    const value = flatAssociations[pattern];
    const matchResult = applyPatternMatching$1({
      pattern,
      url,
    });
    if (matchResult.matched) {
      someFullMatch = true;
      if (isPlainObject$1(fullMatchMeta) && isPlainObject$1(value)) {
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

const applyAliases$1 = ({ url, aliases }) => {
  for (const key of Object.keys(aliases)) {
    const matchResult = applyPatternMatching$1({
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

const matches$1 = (url, patterns) => {
  return Boolean(
    applyAssociations$1({
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
const assertUrlLike$1 = (value, name = "url") => {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a url string, got ${value}`);
  }
  if (isWindowsPathnameSpecifier$1(value)) {
    throw new TypeError(
      `${name} must be a url but looks like a windows pathname, got ${value}`,
    );
  }
  if (!hasScheme$3(value)) {
    throw new TypeError(
      `${name} must be a url and no scheme found, got ${value}`,
    );
  }
};
const isPlainObject$1 = (value) => {
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
const isWindowsPathnameSpecifier$1 = (specifier) => {
  const firstChar = specifier[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = specifier[1];
  if (secondChar !== ":") return false;
  const thirdChar = specifier[2];
  return thirdChar === "/" || thirdChar === "\\";
};
const hasScheme$3 = (specifier) => /^[a-zA-Z]+:/.test(specifier);

const createFilter$1 = (patterns, url, map = (v) => v) => {
  const associations = resolveAssociations$1(
    {
      yes: patterns,
    },
    url,
  );
  return (url) => {
    const meta = applyAssociations$1({ url, associations });
    return Boolean(map(meta.yes));
  };
};

const URL_META$1 = {
  resolveAssociations: resolveAssociations$1,
  applyAssociations: applyAssociations$1,
  applyAliases: applyAliases$1,
  applyPatternMatching: applyPatternMatching$1,
  urlChildMayMatch: urlChildMayMatch$1,
  matches: matches$1,
  createFilter: createFilter$1,
};

const generateWindowsEPERMErrorMessage$1 = (
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

const writeEntryPermissionsSync$1 = (source, permissions) => {
  const sourceUrl = assertAndNormalizeFileUrl$1(source);

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


const isWindows$5 = process.platform === "win32";

const readEntryStatSync$1 = (
  source,
  { nullIfNotFound = false, followLink = true } = {},
) => {
  let sourceUrl = assertAndNormalizeFileUrl$1(source);
  if (sourceUrl.endsWith("/")) sourceUrl = sourceUrl.slice(0, -1);

  const sourcePath = urlToFileSystemPath$1(sourceUrl);

  const handleNotFoundOption = nullIfNotFound
    ? {
        handleNotFoundError: () => null,
      }
    : {};

  return statSyncNaive$1(sourcePath, {
    followLink,
    ...handleNotFoundOption,
    ...(isWindows$5
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
              writeEntryPermissionsSync$1(sourceUrl, 0o666);
              const stats = statSyncNaive$1(sourcePath, {
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
                generateWindowsEPERMErrorMessage$1(e, {
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

const statSyncNaive$1 = (
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

const statsToType$1 = (stats) => {
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  if (stats.isSymbolicLink()) return "symbolic-link";
  if (stats.isFIFO()) return "fifo";
  if (stats.isSocket()) return "socket";
  if (stats.isCharacterDevice()) return "character-device";
  if (stats.isBlockDevice()) return "block-device";
  return undefined;
};

const mediaTypeInfos$1 = {
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

const CONTENT_TYPE$1 = {
  parse: (string) => {
    const [mediaType, charset] = string.split(";");
    return { mediaType: normalizeMediaType$1(mediaType), charset };
  },

  stringify: ({ mediaType, charset }) => {
    if (charset) {
      return `${mediaType};${charset}`;
    }
    return mediaType;
  },

  asMediaType: (value) => {
    if (typeof value === "string") {
      return CONTENT_TYPE$1.parse(value).mediaType;
    }
    if (typeof value === "object") {
      return value.mediaType;
    }
    return null;
  },

  isJson: (value) => {
    const mediaType = CONTENT_TYPE$1.asMediaType(value);
    return (
      mediaType === "application/json" ||
      /^application\/\w+\+json$/.test(mediaType)
    );
  },

  isTextual: (value) => {
    const mediaType = CONTENT_TYPE$1.asMediaType(value);
    if (mediaType.startsWith("text/")) {
      return true;
    }
    const mediaTypeInfo = mediaTypeInfos$1[mediaType];
    if (mediaTypeInfo && mediaTypeInfo.isTextual) {
      return true;
    }
    // catch things like application/manifest+json, application/importmap+json
    if (/^application\/\w+\+json$/.test(mediaType)) {
      return true;
    }
    return false;
  },

  isBinary: (value) => !CONTENT_TYPE$1.isTextual(value),

  asFileExtension: (value) => {
    const mediaType = CONTENT_TYPE$1.asMediaType(value);
    const mediaTypeInfo = mediaTypeInfos$1[mediaType];
    return mediaTypeInfo ? `.${mediaTypeInfo.extensions[0]}` : "";
  },

  fromExtension: (extension) => {
    if (extension[0] === ".") {
      extension = extension.slice(1);
    }
    for (const mediaTypeCandidate of Object.keys(mediaTypeInfos$1)) {
      const mediaTypeCandidateInfo = mediaTypeInfos$1[mediaTypeCandidate];
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
    return CONTENT_TYPE$1.fromExtension(extension);
  },

  toUrlExtension: (contentType) => {
    const mediaType = CONTENT_TYPE$1.asMediaType(contentType);
    const mediaTypeInfo = mediaTypeInfos$1[mediaType];
    return mediaTypeInfo ? `.${mediaTypeInfo.extensions[0]}` : "";
  },
};

const normalizeMediaType$1 = (value) => {
  if (value === "application/javascript") {
    return "text/javascript";
  }
  return value;
};

const removeEntrySync$1 = (
  source,
  {
    allowUseless = false,
    recursive = false,
    maxRetries = 3,
    retryDelay = 100,
    onlyContent = false,
  } = {},
) => {
  const sourceUrl = assertAndNormalizeFileUrl$1(source);
  const sourceStats = readEntryStatSync$1(sourceUrl, {
    nullIfNotFound: true,
    followLink: false,
  });
  if (!sourceStats) {
    if (allowUseless) {
      return;
    }
    throw new Error(`nothing to remove at ${urlToFileSystemPath$1(sourceUrl)}`);
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
    removeNonDirectory$2(
      sourceUrl.endsWith("/") ? sourceUrl.slice(0, -1) : sourceUrl);
  } else if (sourceStats.isDirectory()) {
    const directoryUrl = ensurePathnameTrailingSlash$2(sourceUrl);
    removeDirectorySync$3(directoryUrl, {
      recursive,
      maxRetries,
      retryDelay,
      onlyContent,
    });
  }
};

const removeNonDirectory$2 = (sourceUrl) => {
  const sourcePath = urlToFileSystemPath$1(sourceUrl);
  const attempt = () => {
    unlinkSyncNaive$1(sourcePath);
  };
  attempt();
};

const unlinkSyncNaive$1 = (sourcePath, { handleTemporaryError = null } = {}) => {
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

const removeDirectorySync$3 = (
  rootDirectoryUrl,
  { maxRetries, retryDelay, recursive, onlyContent },
) => {
  const visit = (sourceUrl) => {
    const sourceStats = readEntryStatSync$1(sourceUrl, {
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
    const directoryPath = urlToFileSystemPath$1(directoryUrl);
    const optionsFromRecursive = recursive
      ? {
          handleNotEmptyError: () => {
            removeDirectoryContent(directoryUrl);
            visitDirectory(directoryUrl);
          },
        }
      : {};
    removeDirectorySyncNaive$1(directoryPath, {
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
                  generateWindowsEPERMErrorMessage$1(openOrCloseError, {
                    path: directoryPath,
                    operation: "readir",
                  }),
                );
                throw error;
              }
              removeDirectorySyncNaive$1(directoryPath, {
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
      const url = resolveUrl$3(entryName, directoryUrl);
      visit(url);
    }
  };

  const visitFile = (fileUrl) => {
    removeNonDirectory$2(fileUrl);
  };

  const visitSymbolicLink = (symbolicLinkUrl) => {
    removeNonDirectory$2(symbolicLinkUrl);
  };

  if (onlyContent) {
    removeDirectoryContent(rootDirectoryUrl);
  } else {
    visitDirectory(rootDirectoryUrl);
  }
};

const removeDirectorySyncNaive$1 = (
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

const removeDirectorySync$2 = (url, options = {}) => {
  return removeEntrySync$1(url, {
    ...options,
    recursive: true,
  });
};

const writeDirectorySync$1 = (
  destination,
  { recursive = true, allowUseless = false, force } = {},
) => {
  const destinationUrl = assertAndNormalizeDirectoryUrl$2(destination);
  const destinationPath = urlToFileSystemPath$1(destinationUrl);

  let destinationStats;
  try {
    destinationStats = readEntryStatSync$1(destinationUrl, {
      nullIfNotFound: true,
      followLink: false,
    });
  } catch (e) {
    if (e.code === "ENOTDIR") {
      let previousNonDirUrl = destinationUrl;
      // we must try all parent directories as long as it fails with ENOTDIR
      findAncestorDirectoryUrl$1(destinationUrl, (ancestorUrl) => {
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
          `cannot write directory at ${destinationPath} because there is a file at ${urlToFileSystemPath$1(
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
      const destinationType = statsToType$1(destinationStats);
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

const writeFileSync$1 = (destination, content = "", { force } = {}) => {
  const destinationUrl = assertAndNormalizeFileUrl$1(destination);
  const destinationUrlObject = new URL(destinationUrl);
  if (content && content instanceof URL) {
    content = readFileSync(content);
  }
  try {
    writeFileSync$2(destinationUrlObject, content);
  } catch (error) {
    if (error.code === "EISDIR") {
      // happens when directory existed but got deleted and now it's a file
      if (force) {
        removeDirectorySync$2(destinationUrlObject);
        writeFileSync$2(destinationUrlObject, content);
      } else {
        throw error;
      }
    }
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      writeDirectorySync$1(new URL("./", destinationUrlObject), {
        force,
        recursive: true,
      });
      writeFileSync$2(destinationUrlObject, content);
      return;
    }
    throw error;
  }
};

const callOnceIdlePerFile$1 = (callback, idleMs) => {
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

const isWindows$4 = process.platform === "win32";

const createWatcher$1 = (sourcePath, options) => {
  const watcher = watch(sourcePath, options);

  if (isWindows$4) {
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
            generateWindowsEPERMErrorMessage$1(error, {
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

const guardTooFastSecondCallPerFile$1 = (
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

const trackResources$1 = () => {
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

const isLinux$1 = process.platform === "linux";
const fsWatchSupportsRecursive$1 = !isLinux$1;

const registerDirectoryLifecycle$1 = (
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
  const sourceUrl = assertAndNormalizeDirectoryUrl$2(source);
  if (!undefinedOrFunction$1(added)) {
    throw new TypeError(`added must be a function or undefined, got ${added}`);
  }
  if (!undefinedOrFunction$1(updated)) {
    throw new TypeError(
      `updated must be a function or undefined, got ${updated}`,
    );
  }
  if (!undefinedOrFunction$1(removed)) {
    throw new TypeError(
      `removed must be a function or undefined, got ${removed}`,
    );
  }
  if (idleMs) {
    if (updated) {
      updated = callOnceIdlePerFile$1(updated, idleMs);
    }
  }
  if (cooldownBetweenFileEvents) {
    if (added) {
      added = guardTooFastSecondCallPerFile$1(added, cooldownBetweenFileEvents);
    }
    if (updated) {
      updated = guardTooFastSecondCallPerFile$1(
        updated,
        cooldownBetweenFileEvents,
      );
    }
    if (removed) {
      removed = guardTooFastSecondCallPerFile$1(
        removed,
        cooldownBetweenFileEvents,
      );
    }
  }

  const associations = URL_META$1.resolveAssociations(
    { watch: watchPatterns },
    sourceUrl,
  );
  const getWatchPatternValue = ({ url, type }) => {
    if (type === "directory") {
      let firstMeta = false;
      URL_META$1.urlChildMayMatch({
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
    const { watch } = URL_META$1.applyAssociations({ url, associations });
    return watch;
  };
  const tracker = trackResources$1();
  const infoMap = new Map();
  const readEntryInfo = (url) => {
    try {
      const relativeUrl = urlToRelativeUrl$1(url, source);
      const previousInfo = infoMap.get(relativeUrl);
      const stat = readEntryStatSync$1(new URL(url));
      const type = statsToType$1(stat);
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
      if (recursive && !fsWatchSupportsRecursive$1) {
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
            readEntryStatSync$1(new URL(relativeUrlCandidate, sourceUrl));
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
        if (!fsWatchSupportsRecursive$1) {
          try {
            const watcher = createWatcher$1(urlToFileSystemPath$1(entryInfo.url), {
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
    if (updated && entryInfo.patternValue && shouldCallUpdated$1(entryInfo)) {
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
  const watcher = createWatcher$1(urlToFileSystemPath$1(sourceUrl), {
    recursive: recursive && fsWatchSupportsRecursive$1,
    persistent: keepProcessAlive,
  });
  tracker.registerCleanupCallback(() => {
    watcher.close();
  });
  watcher.on("change", (eventType, fileSystemPath) => {
    handleDirectoryEvent({
      ...fileSystemPathToDirectoryRelativeUrlAndFilename$1(fileSystemPath),
      eventType,
    });
  });

  return tracker.cleanup;
};

const shouldCallUpdated$1 = (entryInfo) => {
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

const undefinedOrFunction$1 = (value) => {
  return typeof value === "undefined" || typeof value === "function";
};

const fileSystemPathToDirectoryRelativeUrlAndFilename$1 = (path) => {
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


const ETAG_FOR_EMPTY_CONTENT$1 = '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';

const bufferToEtag$1 = (buffer) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(`buffer expect,got ${buffer}`);
  }

  if (buffer.length === 0) {
    return ETAG_FOR_EMPTY_CONTENT$1;
  }

  const hash = createHash("sha1");
  hash.update(buffer, "utf8");

  const hashBase64String = hash.digest("base64");
  const hashBase64StringSubset = hashBase64String.slice(0, 27);
  const length = buffer.length;

  return `"${length.toString(16)}-${hashBase64StringSubset}"`;
};

// https://nodejs.org/api/packages.html#resolving-user-conditions
const readCustomConditionsFromProcessArgs$1 = () => {
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

const asDirectoryUrl$1 = (url) => {
  const { pathname } = new URL(url);
  if (pathname.endsWith("/")) {
    return url;
  }
  return new URL("./", url).href;
};

const getParentUrl$1 = (url) => {
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

const isValidUrl$2 = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const urlToFilename$2 = (url) => {
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

const urlToExtension$3 = (url) => {
  const filename = urlToFilename$2(url);
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) return "";
  // if (dotLastIndex === pathname.length - 1) return ""
  const extension = filename.slice(dotLastIndex);
  return extension;
};

const defaultLookupPackageScope$1 = (url) => {
  let scopeUrl = asDirectoryUrl$1(url);
  while (scopeUrl !== "file:///") {
    if (scopeUrl.endsWith("node_modules/")) {
      return null;
    }
    const packageJsonUrlObject = new URL("package.json", scopeUrl);
    if (existsSync(packageJsonUrlObject)) {
      return scopeUrl;
    }
    scopeUrl = getParentUrl$1(scopeUrl);
  }
  return null;
};

const defaultReadPackageJson$1 = (packageUrl) => {
  const packageJsonUrl = new URL("package.json", packageUrl);
  const buffer = readFileSync(packageJsonUrl);
  const string = String(buffer);
  try {
    return JSON.parse(string);
  } catch {
    throw new Error(`Invalid package configuration`);
  }
};

// https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/tools/node_modules/eslint/node_modules/%40babel/core/lib/vendor/import-meta-resolve.js#L2473

const createInvalidModuleSpecifierError$1 = (
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

const createInvalidPackageTargetError$1 = (
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

const createPackagePathNotExportedError$1 = (
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

const createModuleNotFoundError$1 = (specifier, { parentUrl }) => {
  const error = new Error(
    `Cannot find "${specifier}" imported from ${fileURLToPath(parentUrl)}`,
  );
  error.code = "MODULE_NOT_FOUND";
  return error;
};

const createPackageImportNotDefinedError$1 = (
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

const isSpecifierForNodeBuiltin$1 = (specifier) => {
  return (
    specifier.startsWith("node:") ||
    NODE_BUILTIN_MODULE_SPECIFIERS$1.includes(specifier)
  );
};

const NODE_BUILTIN_MODULE_SPECIFIERS$1 = [
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

const applyNodeEsmResolution$1 = ({
  specifier,
  parentUrl,
  conditions = [...readCustomConditionsFromProcessArgs$1(), "node", "import"],
  lookupPackageScope = defaultLookupPackageScope$1,
  readPackageJson = defaultReadPackageJson$1,
  preservesSymlink = false,
}) => {
  const resolution = applyPackageSpecifierResolution$1(specifier, {
    parentUrl: String(parentUrl),
    conditions,
    lookupPackageScope,
    readPackageJson,
    preservesSymlink,
  });
  const { url } = resolution;
  if (url.startsWith("file:")) {
    if (url.includes("%2F") || url.includes("%5C")) {
      throw createInvalidModuleSpecifierError$1(
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

const applyPackageSpecifierResolution$1 = (specifier, resolutionContext) => {
  const { parentUrl } = resolutionContext;
  // relative specifier
  if (
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    if (specifier[0] !== "/") {
      const browserFieldResolution = applyBrowserFieldResolution$1(
        specifier,
        resolutionContext,
      );
      if (browserFieldResolution) {
        return browserFieldResolution;
      }
    }
    return {
      type: "relative_specifier",
      url: new URL(specifier, parentUrl).href,
    };
  }
  if (specifier[0] === "#") {
    return applyPackageImportsResolution$1(specifier, resolutionContext);
  }
  try {
    const urlObject = new URL(specifier);
    if (specifier.startsWith("node:")) {
      return {
        type: "node_builtin_specifier",
        url: specifier,
      };
    }
    return {
      type: "absolute_specifier",
      url: urlObject.href,
    };
  } catch {
    // bare specifier
    const browserFieldResolution = applyBrowserFieldResolution$1(
      specifier,
      resolutionContext,
    );
    if (browserFieldResolution) {
      return browserFieldResolution;
    }
    const packageResolution = applyPackageResolve$1(specifier, resolutionContext);
    const search = new URL(specifier, "file:///").search;
    if (search && !new URL(packageResolution.url).search) {
      packageResolution.url = `${packageResolution.url}${search}`;
    }
    return packageResolution;
  }
};

const applyBrowserFieldResolution$1 = (specifier, resolutionContext) => {
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
    return {
      type: "field:browser",
      isMain: true,
      packageDirectoryUrl,
      packageJson,
      url,
    };
  }
  return null;
};

const applyPackageImportsResolution$1 = (
  internalSpecifier,
  resolutionContext,
) => {
  const { parentUrl, lookupPackageScope, readPackageJson } = resolutionContext;
  if (internalSpecifier === "#" || internalSpecifier.startsWith("#/")) {
    throw createInvalidModuleSpecifierError$1(
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
      const resolved = applyPackageImportsExportsResolution$1(internalSpecifier, {
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
  throw createPackageImportNotDefinedError$1(internalSpecifier, {
    ...resolutionContext,
    packageDirectoryUrl,
  });
};

const applyPackageResolve$1 = (packageSpecifier, resolutionContext) => {
  const { parentUrl, conditions, readPackageJson, preservesSymlink, isImport } =
    resolutionContext;
  if (packageSpecifier === "") {
    throw new Error("invalid module specifier");
  }
  if (
    conditions.includes("node") &&
    isSpecifierForNodeBuiltin$1(packageSpecifier)
  ) {
    return {
      type: "node_builtin_specifier",
      url: `node:${packageSpecifier}`,
    };
  }
  let { packageName, packageSubpath } = parsePackageSpecifier$1(packageSpecifier);
  if (
    packageName[0] === "." ||
    packageName.includes("\\") ||
    packageName.includes("%")
  ) {
    throw createInvalidModuleSpecifierError$1(
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
  const selfResolution = applyPackageSelfResolution$1(packageSubpath, {
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
      currentUrl = getParentUrl$1(currentUrl);
      continue;
    }
    const packageDirectoryUrl = preservesSymlink
      ? packageDirectoryFacadeUrl
      : resolvePackageSymlink$1(packageDirectoryFacadeUrl);
    const packageJson = readPackageJson(packageDirectoryUrl);
    if (packageJson !== null) {
      const { exports } = packageJson;
      if (exports !== null && exports !== undefined) {
        return applyPackageExportsResolution$1(packageSubpath, {
          ...resolutionContext,
          packageDirectoryUrl,
          packageJson,
          exports,
        });
      }
    }
    return applyLegacySubpathResolution$1(packageSubpath, {
      ...resolutionContext,
      packageDirectoryUrl,
      packageJson,
    });
  }
  throw createModuleNotFoundError$1(packageName, resolutionContext);
};

const applyPackageSelfResolution$1 = (packageSubpath, resolutionContext) => {
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
  const { exports } = packageJson;
  if (!exports) {
    const subpathResolution = applyLegacySubpathResolution$1(packageSubpath, {
      ...resolutionContext,
      packageDirectoryUrl,
      packageJson,
    });
    if (subpathResolution && subpathResolution.type !== "subpath") {
      return subpathResolution;
    }
    return undefined;
  }
  return applyPackageExportsResolution$1(packageSubpath, {
    ...resolutionContext,
    packageDirectoryUrl,
    packageJson,
  });
};

// https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/lib/internal/modules/esm/resolve.js#L642
const applyPackageExportsResolution$1 = (packageSubpath, resolutionContext) => {
  if (packageSubpath === ".") {
    const mainExport = applyMainExportResolution$1(resolutionContext);
    if (!mainExport) {
      throw createPackagePathNotExportedError$1(
        packageSubpath,
        resolutionContext,
      );
    }
    const resolved = applyPackageTargetResolution$1(mainExport, {
      ...resolutionContext,
      key: ".",
    });
    if (resolved) {
      return resolved;
    }
    throw createPackagePathNotExportedError$1(packageSubpath, resolutionContext);
  }
  const packageExportsInfo = readExports$1(resolutionContext);
  if (
    packageExportsInfo.type === "object" &&
    packageExportsInfo.allKeysAreRelative
  ) {
    const resolved = applyPackageImportsExportsResolution$1(packageSubpath, {
      ...resolutionContext,
      isImport: false,
    });
    if (resolved) {
      return resolved;
    }
  }
  throw createPackagePathNotExportedError$1(packageSubpath, resolutionContext);
};

const applyPackageImportsExportsResolution$1 = (matchKey, resolutionContext) => {
  const { packageJson, isImport } = resolutionContext;
  const matchObject = isImport ? packageJson.imports : packageJson.exports;

  if (!matchKey.includes("*") && matchObject.hasOwnProperty(matchKey)) {
    const target = matchObject[matchKey];
    return applyPackageTargetResolution$1(target, {
      ...resolutionContext,
      key: matchKey,
      isImport,
    });
  }
  const expansionKeys = Object.keys(matchObject)
    .filter((key) => key.split("*").length === 2)
    .sort(comparePatternKeys$1);
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
    return applyPackageTargetResolution$1(target, {
      ...resolutionContext,
      key: matchKey,
      subpath,
      pattern: true,
      isImport,
    });
  }
  return null;
};

const applyPackageTargetResolution$1 = (target, resolutionContext) => {
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
        throw createInvalidPackageTargetError$1(
          `target must be inside package`,
          target,
          resolutionContext,
        );
      }
      return {
        type: isImport ? "field:imports" : "field:exports",
        isMain: subpath === "" || subpath === ".",
        packageDirectoryUrl,
        packageJson,
        url: pattern
          ? targetUrl.replaceAll("*", subpath)
          : new URL(subpath, targetUrl).href,
      };
    }
    if (!isImport || target.startsWith("../") || isValidUrl$2(target)) {
      throw createInvalidPackageTargetError$1(
        `target must starst with "./"`,
        target,
        resolutionContext,
      );
    }
    return applyPackageResolve$1(
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
        const resolved = applyPackageTargetResolution$1(targetValue, {
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
      if (key === "default" || conditions.includes(key)) {
        const targetValue = target[key];
        const resolved = applyPackageTargetResolution$1(targetValue, {
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
  throw createInvalidPackageTargetError$1(
    `target must be a string, array, object or null`,
    target,
    resolutionContext,
  );
};

const readExports$1 = ({ packageDirectoryUrl, packageJson }) => {
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

const parsePackageSpecifier$1 = (packageSpecifier) => {
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

const applyMainExportResolution$1 = (resolutionContext) => {
  const { packageJson } = resolutionContext;
  const packageExportsInfo = readExports$1(resolutionContext);
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

const applyLegacySubpathResolution$1 = (packageSubpath, resolutionContext) => {
  const { packageDirectoryUrl, packageJson } = resolutionContext;

  if (packageSubpath === ".") {
    return applyLegacyMainResolution$1(packageSubpath, resolutionContext);
  }
  const browserFieldResolution = applyBrowserFieldResolution$1(
    packageSubpath,
    resolutionContext,
  );
  if (browserFieldResolution) {
    return browserFieldResolution;
  }
  return {
    type: "subpath",
    isMain: packageSubpath === ".",
    packageDirectoryUrl,
    packageJson,
    url: new URL(packageSubpath, packageDirectoryUrl).href,
  };
};

const applyLegacyMainResolution$1 = (packageSubpath, resolutionContext) => {
  const { conditions, packageDirectoryUrl, packageJson } = resolutionContext;
  for (const condition of conditions) {
    const conditionResolver = mainLegacyResolvers$1[condition];
    if (!conditionResolver) {
      continue;
    }
    const resolved = conditionResolver(resolutionContext);
    if (resolved) {
      return {
        type: resolved.type,
        isMain: resolved.isMain,
        packageDirectoryUrl,
        packageJson,
        url: new URL(resolved.path, packageDirectoryUrl).href,
      };
    }
  }
  return {
    type: "field:main", // the absence of "main" field
    isMain: true,
    packageDirectoryUrl,
    packageJson,
    url: new URL("index.js", packageDirectoryUrl).href,
  };
};
const mainLegacyResolvers$1 = {
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
    const content = readFileSync(browserMainUrlObject, "utf-8");
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
  node: ({ packageJson }) => {
    if (typeof packageJson.main === "string") {
      return {
        type: "field:main",
        isMain: true,
        path: packageJson.main,
      };
    }
    return null;
  },
};

const comparePatternKeys$1 = (keyA, keyB) => {
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

const resolvePackageSymlink$1 = (packageDirectoryUrl) => {
  const packageDirectoryPath = realpathSync(new URL(packageDirectoryUrl));
  const packageDirectoryResolvedUrl = pathToFileURL(packageDirectoryPath).href;
  return `${packageDirectoryResolvedUrl}/`;
};

const applyFileSystemMagicResolution$1 = (
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
      fileStat = readEntryStatSync$1(new URL(fileUrl));
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
      const subResult = applyFileSystemMagicResolution$1(indexFileUrl, {
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
    const urlFilename = urlToFilename$2(fileUrl);
    for (const extensionToTry of magicExtensions) {
      const urlCandidate = `${parentUrl}${urlFilename}${extensionToTry}`;
      let stat;
      try {
        stat = readEntryStatSync$1(new URL(urlCandidate));
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

const getExtensionsToTry$1 = (magicExtensions, importer) => {
  if (!magicExtensions) {
    return [];
  }
  const extensionsSet = new Set();
  magicExtensions.forEach((magicExtension) => {
    if (magicExtension === "inherit") {
      const importerExtension = urlToExtension$3(importer);
      extensionsSet.add(importerExtension);
    } else {
      extensionsSet.add(magicExtension);
    }
  });
  return Array.from(extensionsSet.values());
};

const versionFromValue$1 = (value) => {
  if (typeof value === "number") {
    return numberToVersion$1(value);
  }
  if (typeof value === "string") {
    return stringToVersion$1(value);
  }
  throw new TypeError(`version must be a number or a string, got ${value}`);
};

const numberToVersion$1 = (number) => {
  return {
    major: number,
    minor: 0,
    patch: 0,
  };
};

const stringToVersion$1 = (string) => {
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

const compareTwoVersions$1 = (versionA, versionB) => {
  const semanticVersionA = versionFromValue$1(versionA);
  const semanticVersionB = versionFromValue$1(versionB);
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

const versionIsBelow$1 = (versionSupposedBelow, versionSupposedAbove) => {
  return compareTwoVersions$1(versionSupposedBelow, versionSupposedAbove) < 0;
};

const findHighestVersion$1 = (...values) => {
  if (values.length === 0) throw new Error(`missing argument`);
  return values.reduce((highestVersion, value) => {
    if (versionIsBelow$1(highestVersion, value)) {
      return value;
    }
    return highestVersion;
  });
};

const featuresCompatMap$1 = {
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

const RUNTIME_COMPAT$1 = {
  featuresCompatMap: featuresCompatMap$1,

  add: (originalRuntimeCompat, feature) => {
    const featureCompat = getFeatureCompat$1(feature);
    const runtimeCompat = {
      ...originalRuntimeCompat,
    };
    Object.keys(originalRuntimeCompat).forEach((runtimeName) => {
      const secondVersion = featureCompat[runtimeName]; // the version supported by the feature
      if (secondVersion) {
        const firstVersion = originalRuntimeCompat[runtimeName];
        runtimeCompat[runtimeName] = findHighestVersion$1(
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
    featureCompat = getFeatureCompat$1(feature),
  ) => {
    const runtimeNames = Object.keys(runtimeCompat);
    const runtimeWithoutCompat = runtimeNames.find((runtimeName) => {
      const runtimeVersion = runtimeCompat[runtimeName];
      const runtimeVersionCompatible = featureCompat[runtimeName] || "Infinity";
      const highestVersion = findHighestVersion$1(
        runtimeVersion,
        runtimeVersionCompatible,
      );
      return highestVersion !== runtimeVersion;
    });
    return !runtimeWithoutCompat;
  },
};

const getFeatureCompat$1 = (feature) => {
  if (typeof feature === "string") {
    const compat = featuresCompatMap$1[feature];
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

const isSupportedAlgorithm$1 = (algo) => {
  return SUPPORTED_ALGORITHMS$1.includes(algo);
};

// https://www.w3.org/TR/SRI/#priority
const getPrioritizedHashFunction$1 = (firstAlgo, secondAlgo) => {
  const firstIndex = SUPPORTED_ALGORITHMS$1.indexOf(firstAlgo);
  const secondIndex = SUPPORTED_ALGORITHMS$1.indexOf(secondAlgo);
  if (firstIndex === secondIndex) {
    return "";
  }
  if (firstIndex < secondIndex) {
    return secondAlgo;
  }
  return firstAlgo;
};

const applyAlgoToRepresentationData$1 = (algo, data) => {
  const base64Value = crypto.createHash(algo).update(data).digest("base64");
  return base64Value;
};

// keep this ordered by collision resistance as it is also used by "getPrioritizedHashFunction"
const SUPPORTED_ALGORITHMS$1 = ["sha256", "sha384", "sha512"];

// see https://w3c.github.io/webappsec-subresource-integrity/#parse-metadata
const parseIntegrity$1 = (string) => {
  const integrityMetadata = {};
  string
    .trim()
    .split(/\s+/)
    .forEach((token) => {
      const { isValid, algo, base64Value, optionExpression } =
        parseAsHashWithOptions$1(token);
      if (!isValid) {
        return;
      }
      if (!isSupportedAlgorithm$1(algo)) {
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
const parseAsHashWithOptions$1 = (token) => {
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
    const isValid = BASE64_REGEX$1.test(afterDash);
    return { isValid, algo, base64Value };
  }
  const base64Value = afterDash.slice(0, questionIndex);
  const optionExpression = afterDash.slice(questionIndex + 1);
  const isValid =
    BASE64_REGEX$1.test(afterDash) && VCHAR_REGEX$1.test(optionExpression);
  return { isValid, algo, base64Value, optionExpression };
};

const BASE64_REGEX$1 = /^[A-Za-z0-9+/=]+$/;
const VCHAR_REGEX$1 = /^[\x21-\x7E]+$/;

// https://www.w3.org/TR/SRI/#does-response-match-metadatalist
const validateResponseIntegrity$1 = (
  { url, type, dataRepresentation },
  integrity,
) => {
  if (!isResponseEligibleForIntegrityValidation$1({ type })) {
    return false;
  }
  const integrityMetadata = parseIntegrity$1(integrity);
  const algos = Object.keys(integrityMetadata);
  if (algos.length === 0) {
    return true;
  }
  let strongestAlgo = algos[0];
  algos.slice(1).forEach((algoCandidate) => {
    strongestAlgo =
      getPrioritizedHashFunction$1(strongestAlgo, algoCandidate) || strongestAlgo;
  });
  const metadataList = integrityMetadata[strongestAlgo];
  const actualBase64Value = applyAlgoToRepresentationData$1(
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
const isResponseEligibleForIntegrityValidation$1 = (response) => {
  return ["basic", "cors", "default"].includes(response.type);
};

const jsenvPluginImportMetaResolve$1 = ({ needJsModuleFallback }) => {
  return {
    name: "jsenv:import_meta_resolve",
    appliesDuring: "*",
    init: (context) => {
      if (context.isSupportedOnCurrentClients("import_meta_resolve")) {
        return false;
      }
      if (needJsModuleFallback(context)) {
        // will be handled by systemjs, keep it untouched
        return false;
      }
      return true;
    },
    transformUrlContent: {
      js_module: async (urlInfo) => {
        const jsUrls = parseJsUrls({
          js: urlInfo.content,
          url: urlInfo.url,
          isJsModule: true,
        });
        const magicSource = createMagicSource(urlInfo.content);
        for (const jsUrl of jsUrls) {
          if (jsUrl.subtype !== "import_meta_resolve") {
            continue;
          }
          const { node } = jsUrl.astInfo;
          let reference;
          for (const referenceToOther of urlInfo.referenceToOthersSet) {
            if (
              referenceToOther.generatedSpecifier.slice(1, -1) ===
              jsUrl.specifier
            ) {
              reference = referenceToOther;
              break;
            }
          }
          magicSource.replace({
            start: node.start,
            end: node.end,
            replacement: `new URL(${reference.generatedSpecifier}, import.meta.url).href`,
          });
        }
        return magicSource.toContentAndSourcemap();
      },
    },
  };
};

/*
 * - propagate "?js_module_fallback" query string param on urls
 * - perform conversion from js module to js classic when url uses "?js_module_fallback"
 */


const systemJsClientFileUrl$1 = injectQueryParams$1(systemJsClientFileUrlDefault, {
  as_js_classic: undefined,
});

const jsenvPluginJsModuleConversion$1 = ({ remapImportSpecifier }) => {
  const isReferencingJsModule = (reference) => {
    if (
      reference.type === "js_import" ||
      reference.subtype === "system_register_arg" ||
      reference.subtype === "system_import_arg"
    ) {
      return true;
    }
    if (reference.type === "js_url" && reference.expectedType === "js_module") {
      return true;
    }
    return false;
  };

  const shouldPropagateJsModuleConversion = (reference) => {
    if (isReferencingJsModule(reference)) {
      const insideJsClassic =
        reference.ownerUrlInfo.searchParams.has("js_module_fallback");
      return insideJsClassic;
    }
    return false;
  };

  const markAsJsClassicProxy = (reference) => {
    reference.expectedType = "js_classic";
    if (!reference.filenameHint) {
      reference.filenameHint = generateJsClassicFilename$1(reference.url);
    }
  };

  const turnIntoJsClassicProxy = (reference) => {
    markAsJsClassicProxy(reference);
    return injectQueryParams$1(reference.url, {
      js_module_fallback: "",
    });
  };

  return {
    name: "jsenv:js_module_conversion",
    appliesDuring: "*",
    redirectReference: (reference) => {
      if (reference.searchParams.has("js_module_fallback")) {
        markAsJsClassicProxy(reference);
        return null;
      }
      // when search param is injected, it will be removed later
      // by "getWithoutSearchParam". We don't want to redirect again
      // (would create infinite recursion)
      if (
        reference.prev &&
        reference.prev.searchParams.has(`js_module_fallback`)
      ) {
        return null;
      }
      // We want to propagate transformation of js module to js classic to:
      // - import specifier (static/dynamic import + re-export)
      // - url specifier when inside System.register/_context.import()
      //   (because it's the transpiled equivalent of static and dynamic imports)
      // And not other references otherwise we could try to transform inline resources
      // or specifiers inside new URL()...
      if (shouldPropagateJsModuleConversion(reference)) {
        return turnIntoJsClassicProxy(reference);
      }
      return null;
    },
    fetchUrlContent: async (urlInfo) => {
      const jsModuleUrlInfo = urlInfo.getWithoutSearchParam(
        "js_module_fallback",
        {
          // override the expectedType to "js_module"
          // because when there is ?js_module_fallback it means the underlying resource
          // is a js_module
          expectedType: "js_module",
        },
      );
      if (!jsModuleUrlInfo) {
        return null;
      }
      await jsModuleUrlInfo.cook();
      let outputFormat;
      if (urlInfo.isEntryPoint && !jsModuleUrlInfo.data.usesImport) {
        // if it's an entry point without dependency (it does not use import)
        // then we can use UMD
        outputFormat = "umd";
      } else {
        // otherwise we have to use system in case it's imported
        // by an other file (for entry points)
        // or to be able to import when it uses import
        outputFormat = "system";
        urlInfo.type = "js_classic";
        urlInfo.dependencies.foundSideEffectFile({
          sideEffectFileUrl: systemJsClientFileUrl$1,
          expectedType: "js_classic",
          line: 0,
          column: 0,
        });
      }
      const { content, sourcemap } = await convertJsModuleToJsClassic({
        rootDirectoryUrl: urlInfo.context.rootDirectoryUrl,
        input: jsModuleUrlInfo.content,
        inputIsEntryPoint: urlInfo.isEntryPoint,
        inputSourcemap: jsModuleUrlInfo.sourcemap,
        inputUrl: jsModuleUrlInfo.url,
        outputUrl: urlInfo.url,
        outputFormat,
        remapImportSpecifier,
      });
      return {
        content,
        contentType: "text/javascript",
        type: "js_classic",
        originalUrl: jsModuleUrlInfo.originalUrl,
        originalContent: jsModuleUrlInfo.originalContent,
        sourcemap,
        data: jsModuleUrlInfo.data,
      };
    },
  };
};

const generateJsClassicFilename$1 = (url) => {
  const filename = urlToFilename$3(url);
  let [basename, extension] = splitFileExtension$3(filename);
  const { searchParams } = new URL(url);
  if (
    searchParams.has("as_json_module") ||
    searchParams.has("as_css_module") ||
    searchParams.has("as_text_module")
  ) {
    basename += extension;
    extension = ".js";
  }
  return `${basename}.nomodule${extension}`;
};

const splitFileExtension$3 = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return [filename, ""];
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};

/*
 * when <script type="module"> cannot be used:
 * - ?js_module_fallback is injected into the src of <script type="module">
 * - js inside <script type="module"> is transformed into classic js
 * - <link rel="modulepreload"> are converted to <link rel="preload">
 */


const jsenvPluginJsModuleFallbackInsideHtml$1 = ({
  needJsModuleFallback,
}) => {
  const turnIntoJsClassicProxy = (reference) => {
    return injectQueryParams$1(reference.url, { js_module_fallback: "" });
  };

  return {
    name: "jsenv:js_module_fallback_inside_html",
    appliesDuring: "*",
    init: needJsModuleFallback,
    redirectReference: {
      link_href: (reference) => {
        if (
          reference.prev &&
          reference.prev.searchParams.has(`js_module_fallback`)
        ) {
          return null;
        }
        if (reference.subtype === "modulepreload") {
          return turnIntoJsClassicProxy(reference);
        }
        if (
          reference.subtype === "preload" &&
          reference.expectedType === "js_module"
        ) {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
      script: (reference) => {
        if (
          reference.prev &&
          reference.prev.searchParams.has(`js_module_fallback`)
        ) {
          return null;
        }
        if (reference.expectedType === "js_module") {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
      js_url: (reference) => {
        if (
          reference.prev &&
          reference.prev.searchParams.has(`js_module_fallback`)
        ) {
          return null;
        }
        if (reference.expectedType === "js_module") {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
    },
    finalizeUrlContent: {
      html: async (urlInfo) => {
        const htmlAst = parseHtml({ html: urlInfo.content, url: urlInfo.url });
        const mutations = [];
        visitHtmlNodes(htmlAst, {
          link: (node) => {
            const rel = getHtmlNodeAttribute(node, "rel");
            if (rel !== "modulepreload" && rel !== "preload") {
              return;
            }
            const href = getHtmlNodeAttribute(node, "href");
            if (!href) {
              return;
            }
            let linkHintReference = null;
            for (const referenceToOther of urlInfo.referenceToOthersSet) {
              if (
                referenceToOther.generatedSpecifier === href &&
                referenceToOther.type === "link_href" &&
                referenceToOther.subtype === rel
              ) {
                linkHintReference = referenceToOther;
                break;
              }
            }
            if (rel === "modulepreload") {
              if (linkHintReference.expectedType === "js_classic") {
                mutations.push(() => {
                  setHtmlNodeAttributes(node, {
                    rel: "preload",
                    as: "script",
                    crossorigin: undefined,
                  });
                });
              }
            }
            if (
              rel === "preload" &&
              wasConvertedFromJsModule$1(linkHintReference)
            ) {
              mutations.push(() => {
                setHtmlNodeAttributes(node, { crossorigin: undefined });
              });
            }
          },
          script: (node) => {
            const { type } = analyzeScriptNode(node);
            if (type !== "js_module") {
              return;
            }
            const src = getHtmlNodeAttribute(node, "src");
            const text = getHtmlNodeText(node);
            let scriptReference = null;
            for (const referenceToOther of urlInfo.referenceToOthersSet) {
              if (referenceToOther.type !== "script") {
                continue;
              }
              if (src && referenceToOther.generatedSpecifier === src) {
                scriptReference = referenceToOther;
                break;
              }
              if (text) {
                if (referenceToOther.content === text) {
                  scriptReference = referenceToOther;
                  break;
                }
                if (referenceToOther.urlInfo.content === text) {
                  scriptReference = referenceToOther;
                  break;
                }
              }
            }
            if (!wasConvertedFromJsModule$1(scriptReference)) {
              return;
            }
            mutations.push(() => {
              setHtmlNodeAttributes(node, { type: undefined });
            });
          },
        });
        await Promise.all(mutations.map((mutation) => mutation()));
        return stringifyHtmlAst(htmlAst, {
          cleanupPositionAttributes: urlInfo.context.dev,
        });
      },
    },
  };
};

const wasConvertedFromJsModule$1 = (reference) => {
  if (reference.expectedType === "js_classic") {
    // check if a prev version was using js module
    if (reference.original) {
      if (reference.original.expectedType === "js_module") {
        return true;
      }
    }
  }
  return false;
};

/*
 * when {type: "module"} cannot be used on web workers:
 * - new Worker("worker.js", { type: "module" })
 *   transformed into
 *   new Worker("worker.js?js_module_fallback", { type: " lassic" })
 * - navigator.serviceWorker.register("service_worker.js", { type: "module" })
 *   transformed into
 *   navigator.serviceWorker.register("service_worker.js?js_module_fallback", { type: "classic" })
 * - new SharedWorker("shared_worker.js", { type: "module" })
 *   transformed into
 *   new SharedWorker("shared_worker.js?js_module_fallback", { type: "classic" })
 */


const jsenvPluginJsModuleFallbackOnWorkers$1 = () => {
  const turnIntoJsClassicProxy = (reference) => {
    reference.mutation = (magicSource) => {
      const { typePropertyNode } = reference.astInfo;
      magicSource.replace({
        start: typePropertyNode.value.start,
        end: typePropertyNode.value.end,
        replacement: JSON.stringify("classic"),
      });
    };
    return injectQueryParams$1(reference.url, { js_module_fallback: "" });
  };

  const createWorkerPlugin = (subtype) => {
    return {
      name: `jsenv:js_module_fallback_on_${subtype}`,
      appliesDuring: "*",
      init: (context) => {
        if (Object.keys(context.runtimeCompat).toString() === "node") {
          return false;
        }
        if (context.isSupportedOnCurrentClients(`${subtype}_type_module`)) {
          return false;
        }

        return true;
      },
      redirectReference: {
        js_url: (reference) => {
          if (reference.expectedType !== "js_module") {
            return null;
          }
          if (reference.expectedSubtype !== subtype) {
            return null;
          }
          return turnIntoJsClassicProxy(reference);
        },
      },
    };
  };

  return [
    createWorkerPlugin("worker"),
    createWorkerPlugin("service_worker"),
    createWorkerPlugin("shared_worker"),
  ];
};

const require$1 = createRequire(import.meta.url);

const jsenvPluginTopLevelAwait$1 = ({ needJsModuleFallback }) => {
  return {
    name: "jsenv:top_level_await",
    appliesDuring: "*",
    init: (context) => {
      if (context.isSupportedOnCurrentClients("top_level_await")) {
        return false;
      }
      if (needJsModuleFallback(context)) {
        // will be handled by systemjs, keep it untouched
        return false;
      }
      return true;
    },
    transformUrlContent: {
      js_module: async (urlInfo) => {
        const usesTLA = await usesTopLevelAwait$1(urlInfo);
        if (!usesTLA) {
          return null;
        }
        const { code, map } = await applyBabelPlugins({
          babelPlugins: [
            [
              require$1("babel-plugin-transform-async-to-promises"),
              {
                // Maybe we could pass target: "es6" when we support arrow function
                // https://github.com/rpetrich/babel-plugin-transform-async-to-promises/blob/92755ff8c943c97596523e586b5fa515c2e99326/async-to-promises.ts#L55
                topLevelAwait: "simple",
                // enable once https://github.com/rpetrich/babel-plugin-transform-async-to-promises/pull/83
                // externalHelpers: true,
                // externalHelpersPath: JSON.parse(
                //   context.referenceUtils.inject({
                //     type: "js_import",
                //     expectedType: "js_module",
                //     specifier:
                //       "babel-plugin-transform-async-to-promises/helpers.mjs",
                //   })[0],
                // ),
              },
            ],
          ],
          input: urlInfo.content,
          inputIsJsModule: true,
          inputUrl: urlInfo.originalUrl,
          outputUrl: urlInfo.generatedUrl,
        });
        return {
          content: code,
          sourcemap: map,
        };
      },
    },
  };
};

const usesTopLevelAwait$1 = async (urlInfo) => {
  if (!urlInfo.content.includes("await ")) {
    return false;
  }
  const { metadata } = await applyBabelPlugins({
    babelPlugins: [babelPluginMetadataUsesTopLevelAwait$1],
    input: urlInfo.content,
    inputIsJsModule: true,
    inputUrl: urlInfo.originalUrl,
    outputUrl: urlInfo.generatedUrl,
  });
  return metadata.usesTopLevelAwait;
};

const babelPluginMetadataUsesTopLevelAwait$1 = () => {
  return {
    name: "metadata-uses-top-level-await",
    visitor: {
      Program: (programPath, state) => {
        let usesTopLevelAwait = false;
        programPath.traverse({
          AwaitExpression: (path) => {
            const closestFunction = path.getFunctionParent();
            if (!closestFunction || closestFunction.type === "Program") {
              usesTopLevelAwait = true;
              path.stop();
            }
          },
        });
        state.file.metadata.usesTopLevelAwait = usesTopLevelAwait;
      },
    },
  };
};

const jsenvPluginJsModuleFallback$1 = ({ remapImportSpecifier } = {}) => {
  const needJsModuleFallback = (context) => {
    if (Object.keys(context.clientRuntimeCompat).includes("node")) {
      return false;
    }
    if (
      context.versioning &&
      context.versioningViaImportmap &&
      !context.isSupportedOnCurrentClients("importmap")
    ) {
      return true;
    }
    if (
      !context.isSupportedOnCurrentClients("script_type_module") ||
      !context.isSupportedOnCurrentClients("import_dynamic") ||
      !context.isSupportedOnCurrentClients("import_meta")
    ) {
      return true;
    }
    return false;
  };

  return [
    jsenvPluginJsModuleFallbackInsideHtml$1({ needJsModuleFallback }),
    jsenvPluginJsModuleFallbackOnWorkers$1(),
    jsenvPluginJsModuleConversion$1({ remapImportSpecifier }),
    // must come after jsModuleFallback because it's related to the module format
    // so we want to want to know the module format before transforming things
    // - top level await
    // - import.meta.resolve()
    jsenvPluginImportMetaResolve$1({ needJsModuleFallback }),
    jsenvPluginTopLevelAwait$1({ needJsModuleFallback }),
  ];
};

const convertJsClassicToJsModule$1 = async ({
  isWebWorker,
  input,
  inputSourcemap,
  inputUrl,
  outputUrl,
}) => {
  const { code, map } = await applyBabelPlugins({
    babelPlugins: [[babelPluginReplaceTopLevelThis$1, { isWebWorker }]],
    input,
    inputIsJsModule: false,
    inputUrl,
    outputUrl,
  });
  const sourcemap = await composeTwoSourcemaps(inputSourcemap, map);
  return {
    content: code,
    sourcemap,
  };
};

const babelPluginReplaceTopLevelThis$1 = () => {
  return {
    name: "replace-top-level-this",
    visitor: {
      Program: (programPath, state) => {
        const { isWebWorker } = state.opts;
        programPath.traverse({
          ThisExpression: (path) => {
            const closestFunction = path.getFunctionParent();
            if (!closestFunction) {
              path.replaceWithSourceString(isWebWorker ? "self" : "window");
            }
          },
        });
      },
    },
  };
};

/*
 * Js modules might not be able to import js meant to be loaded by <script>
 * Among other things this happens for a top level this:
 * - With <script> this is window
 * - With an import this is undefined
 * Example of this: https://github.com/video-dev/hls.js/issues/2911
 *
 * This plugin fix this issue by rewriting top level this into window
 * and can be used like this for instance import("hls?as_js_module")
 */


const jsenvPluginAsJsModule$1 = () => {
  const markAsJsModuleProxy = (reference) => {
    reference.expectedType = "js_module";
    if (!reference.filenameHint) {
      const filename = urlToFilename$3(reference.url);
      const [basename] = splitFileExtension$2(filename);
      reference.filenameHint = `${basename}.mjs`;
    }
  };

  return {
    name: "jsenv:as_js_module",
    appliesDuring: "*",
    redirectReference: (reference) => {
      if (reference.searchParams.has("as_js_module")) {
        markAsJsModuleProxy(reference);
      }
    },
    fetchUrlContent: async (urlInfo) => {
      const jsClassicUrlInfo = urlInfo.getWithoutSearchParam("as_js_module", {
        // override the expectedType to "js_classic"
        // because when there is ?as_js_module it means the underlying resource
        // is js_classic
        expectedType: "js_classic",
      });
      if (!jsClassicUrlInfo) {
        return null;
      }
      await jsClassicUrlInfo.cook();
      const { content, sourcemap } = await convertJsClassicToJsModule$1({
        input: jsClassicUrlInfo.content,
        inputSourcemap: jsClassicUrlInfo.sourcemap,
        inputUrl: jsClassicUrlInfo.url,
        outputUrl: jsClassicUrlInfo.generatedUrl,
        isWebWorker: isWebWorkerUrlInfo$1(urlInfo),
      });
      return {
        content,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: jsClassicUrlInfo.originalUrl,
        originalContent: jsClassicUrlInfo.originalContent,
        sourcemap,
        data: jsClassicUrlInfo.data,
      };
    },
  };
};

const isWebWorkerUrlInfo$1 = (urlInfo) => {
  return (
    urlInfo.subtype === "worker" ||
    urlInfo.subtype === "service_worker" ||
    urlInfo.subtype === "shared_worker"
  );
};

const splitFileExtension$2 = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return [filename, ""];
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};

/*
 * Generated helpers
 * - https://github.com/babel/babel/commits/main/packages/babel-helpers/src/helpers.ts
 * File helpers
 * - https://github.com/babel/babel/tree/main/packages/babel-helpers/src/helpers
 *
 */
const babelHelperClientDirectoryUrl$1 = new URL(
  "./babel_helpers/",
  import.meta.url,
).href;

// we cannot use "@jsenv/core/src/*" because babel helper might be injected
// into node_modules not depending on "@jsenv/core"
const getBabelHelperFileUrl$1 = (babelHelperName) => {
  const babelHelperFileUrl = new URL(
    `./${babelHelperName}/${babelHelperName}.js`,
    babelHelperClientDirectoryUrl$1,
  ).href;
  return babelHelperFileUrl;
};

const babelHelperNameFromUrl$1 = (url) => {
  if (!url.startsWith(babelHelperClientDirectoryUrl$1)) {
    return null;
  }
  const afterBabelHelperDirectory = url.slice(
    babelHelperClientDirectoryUrl$1.length,
  );
  const babelHelperName = afterBabelHelperDirectory.slice(
    0,
    afterBabelHelperDirectory.indexOf("/"),
  );
  return babelHelperName;
};

// named import approach found here:
// https://github.com/rollup/rollup-plugin-babel/blob/18e4232a450f320f44c651aa8c495f21c74d59ac/src/helperPlugin.js#L1

// for reference this is how it's done to reference
// a global babel helper object instead of using
// a named import
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-plugin-external-helpers/src/index.js

const babelPluginBabelHelpersAsJsenvImports$1 = (
  babel,
  { getImportSpecifier },
) => {
  return {
    name: "babel-helper-as-jsenv-import",
    pre: (file) => {
      const cachedHelpers = {};
      file.set("helperGenerator", (name) => {
        // the list of possible helpers name
        // https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13
        if (!file.availableHelper(name)) {
          return undefined;
        }
        if (cachedHelpers[name]) {
          return cachedHelpers[name];
        }
        const filePath = file.opts.filename;
        const fileUrl = pathToFileURL(filePath).href;
        if (babelHelperNameFromUrl$1(fileUrl) === name) {
          return undefined;
        }
        const babelHelperImportSpecifier = getBabelHelperFileUrl$1(name);
        const helper = injectJsImport({
          programPath: file.path,
          from: getImportSpecifier(babelHelperImportSpecifier),
          nameHint: `_${name}`,
          // disable interop, useless as we work only with js modules
          importedType: "es6",
          // importedInterop: "uncompiled",
        });
        cachedHelpers[name] = helper;
        return helper;
      });
    },
  };
};

// copied from
// https://github.com/babel/babel/blob/e498bee10f0123bb208baa228ce6417542a2c3c4/packages/babel-compat-data/data/plugins.json#L1
// https://github.com/babel/babel/blob/master/packages/babel-compat-data/data/plugins.json#L1
// Because this is an hidden implementation detail of @babel/preset-env
// it could be deprecated or moved anytime.
// For that reason it makes more sens to have it inlined here
// than importing it from an undocumented location.
// Ideally it would be documented or a separate module

const babelPluginCompatMap$1 = {
  "transform-numeric-separator": {
    chrome: "75",
    opera: "62",
    edge: "79",
    firefox: "70",
    safari: "13",
    node: "12.5",
    ios: "13",
    samsung: "11",
    electron: "6",
  },
  "proposal-class-properties": {
    chrome: "74",
    opera: "61",
    edge: "79",
    node: "12",
    electron: "6.1",
  },
  "proposal-private-methods": {
    chrome: "84",
    opera: "71",
  },
  "proposal-nullish-coalescing-operator": {
    chrome: "80",
    opera: "67",
    edge: "80",
    firefox: "72",
    safari: "13.1",
    node: "14",
    electron: "8.1",
  },
  "transform-optional-chaining": {
    chrome: "80",
    opera: "67",
    edge: "80",
    firefox: "74",
    safari: "13.1",
    node: "14",
    electron: "8.1",
  },
  "transform-json-strings": {
    chrome: "66",
    opera: "53",
    edge: "79",
    firefox: "62",
    safari: "12",
    node: "10",
    ios: "12",
    samsung: "9",
    electron: "3",
  },
  "transform-optional-catch-binding": {
    chrome: "66",
    opera: "53",
    edge: "79",
    firefox: "58",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    electron: "3",
  },
  "proposal-decorators": {},
  "transform-parameters": {
    chrome: "49",
    opera: "36",
    edge: "18",
    firefox: "53",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "0.37",
  },
  "proposal-async-generator-functions": {
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
  "transform-object-rest-spread": {
    chrome: "60",
    opera: "47",
    edge: "79",
    firefox: "55",
    safari: "11.1",
    node: "8.3",
    ios: "11.3",
    samsung: "8",
    electron: "2",
  },
  "transform-dotall-regex": {
    chrome: "62",
    opera: "49",
    edge: "79",
    firefox: "78",
    safari: "11.1",
    node: "8.10",
    ios: "11.3",
    samsung: "8",
    electron: "3",
  },
  "transform-unicode-property-regex": {
    chrome: "64",
    opera: "51",
    edge: "79",
    firefox: "78",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    electron: "3",
  },
  "transform-named-capturing-groups-regex": {
    chrome: "64",
    opera: "51",
    edge: "79",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    electron: "3",
  },
  "transform-async-to-generator": {
    chrome: "55",
    opera: "42",
    edge: "15",
    firefox: "52",
    safari: "11",
    node: "7.6",
    ios: "11",
    samsung: "6",
    electron: "1.6",
  },
  "transform-exponentiation-operator": {
    chrome: "52",
    opera: "39",
    edge: "14",
    firefox: "52",
    safari: "10.1",
    node: "7",
    ios: "10.3",
    samsung: "6",
    electron: "1.3",
  },
  "transform-template-literals": {
    chrome: "41",
    opera: "28",
    edge: "13",
    electron: "0.22",
    firefox: "34",
    safari: "13",
    node: "4",
    ios: "13",
    samsung: "3.4",
  },
  "transform-literals": {
    chrome: "44",
    opera: "31",
    edge: "12",
    firefox: "53",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    electron: "0.30",
  },
  "transform-function-name": {
    chrome: "51",
    opera: "38",
    edge: "79",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    electron: "1.2",
  },
  "transform-arrow-functions": {
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
  "transform-block-scoped-functions": {
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
  "transform-classes": {
    chrome: "46",
    opera: "33",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36",
  },
  "transform-object-super": {
    chrome: "46",
    opera: "33",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36",
  },
  "transform-shorthand-properties": {
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
  "transform-duplicate-keys": {
    chrome: "42",
    opera: "29",
    edge: "12",
    firefox: "34",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "3.4",
    electron: "0.25",
  },
  "transform-computed-properties": {
    chrome: "44",
    opera: "31",
    edge: "12",
    firefox: "34",
    safari: "7.1",
    node: "4",
    ios: "8",
    samsung: "4",
    electron: "0.30",
  },
  "transform-for-of": {
    chrome: "51",
    opera: "38",
    edge: "15",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    electron: "1.2",
  },
  "transform-sticky-regex": {
    chrome: "49",
    opera: "36",
    edge: "13",
    firefox: "3",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "0.37",
  },
  "transform-unicode-escapes": {
    chrome: "44",
    opera: "31",
    edge: "12",
    firefox: "53",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    electron: "0.30",
  },
  "transform-unicode-regex": {
    chrome: "50",
    opera: "37",
    edge: "13",
    firefox: "46",
    safari: "12",
    node: "6",
    ios: "12",
    samsung: "5",
    electron: "1.1",
  },
  "transform-spread": {
    chrome: "46",
    opera: "33",
    edge: "13",
    firefox: "36",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36",
  },
  "transform-destructuring": {
    chrome: "51",
    opera: "38",
    edge: "15",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    electron: "1.2",
  },
  "transform-block-scoping": {
    chrome: "49",
    opera: "36",
    edge: "14",
    firefox: "51",
    safari: "11",
    node: "6",
    ios: "11",
    samsung: "5",
    electron: "0.37",
  },
  "transform-typeof-symbol": {
    chrome: "38",
    opera: "25",
    edge: "12",
    firefox: "36",
    safari: "9",
    node: "0.12",
    ios: "9",
    samsung: "3",
    electron: "0.20",
  },
  "transform-new-target": {
    chrome: "46",
    opera: "33",
    edge: "14",
    firefox: "41",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36",
  },
  "transform-regenerator": {
    chrome: "50",
    opera: "37",
    edge: "13",
    firefox: "53",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "1.1",
  },
  "transform-member-expression-literals": {
    chrome: "7",
    opera: "12",
    edge: "12",
    firefox: "2",
    safari: "5.1",
    node: "0.10",
    ie: "9",
    android: "4",
    ios: "6",
    phantom: "2",
    samsung: "1",
    electron: "0.20",
  },
  "transform-property-literals": {
    chrome: "7",
    opera: "12",
    edge: "12",
    firefox: "2",
    safari: "5.1",
    node: "0.10",
    ie: "9",
    android: "4",
    ios: "6",
    phantom: "2",
    samsung: "1",
    electron: "0.20",
  },
  "transform-reserved-words": {
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
};

// copy of transform-async-to-generator
// so that async is not transpiled when supported
babelPluginCompatMap$1["transform-async-to-promises"] =
  babelPluginCompatMap$1["transform-async-to-generator"];

babelPluginCompatMap$1["regenerator-transform"] =
  babelPluginCompatMap$1["transform-regenerator"];

const requireBabelPlugin$1 = createRequire(import.meta.url);

const getBaseBabelPluginStructure$1 = ({
  url,
  isSupported,
  // isJsModule,
  // getImportSpecifier,
}) => {
  const isBabelPluginNeeded = (babelPluginName) => {
    return !isSupported(babelPluginName, babelPluginCompatMap$1[babelPluginName]);
  };

  const babelPluginStructure = {};
  if (isBabelPluginNeeded("transform-numeric-separator")) {
    babelPluginStructure["transform-numeric-separator"] = requireBabelPlugin$1(
      "@babel/plugin-transform-numeric-separator",
    );
  }
  if (isBabelPluginNeeded("transform-json-strings")) {
    babelPluginStructure["transform-json-strings"] = requireBabelPlugin$1(
      "@babel/plugin-transform-json-strings",
    );
  }
  if (isBabelPluginNeeded("transform-object-rest-spread")) {
    babelPluginStructure["transform-object-rest-spread"] = requireBabelPlugin$1(
      "@babel/plugin-transform-object-rest-spread",
    );
  }
  if (isBabelPluginNeeded("transform-optional-catch-binding")) {
    babelPluginStructure["transform-optional-catch-binding"] =
      requireBabelPlugin$1("@babel/plugin-transform-optional-catch-binding");
  }
  if (isBabelPluginNeeded("transform-unicode-property-regex")) {
    babelPluginStructure["transform-unicode-property-regex"] =
      requireBabelPlugin$1("@babel/plugin-transform-unicode-property-regex");
  }
  // if (isBabelPluginNeeded("proposal-decorators") && content.includes("@")) {
  //   babelPluginStructure["proposal-decorators"] = [
  //     requireBabelPlugin("@babel/plugin-proposal-decorators"),
  //     {
  //       version: "2023-05",
  //     },
  //   ];
  // }
  if (isBabelPluginNeeded("transform-async-to-promises")) {
    babelPluginStructure["transform-async-to-promises"] = [
      requireBabelPlugin$1("babel-plugin-transform-async-to-promises"),
      {
        topLevelAwait: "ignore", // will be handled by "jsenv:top_level_await" plugin
        externalHelpers: false,
        // enable once https://github.com/rpetrich/babel-plugin-transform-async-to-promises/pull/83
        // externalHelpers: isJsModule,
        // externalHelpersPath: isJsModule ? getImportSpecifier(
        //     "babel-plugin-transform-async-to-promises/helpers.mjs",
        //   ) : null
      },
    ];
  }
  if (isBabelPluginNeeded("transform-arrow-functions")) {
    babelPluginStructure["transform-arrow-functions"] = requireBabelPlugin$1(
      "@babel/plugin-transform-arrow-functions",
    );
  }
  if (isBabelPluginNeeded("transform-block-scoped-functions")) {
    babelPluginStructure["transform-block-scoped-functions"] =
      requireBabelPlugin$1("@babel/plugin-transform-block-scoped-functions");
  }
  if (isBabelPluginNeeded("transform-block-scoping")) {
    babelPluginStructure["transform-block-scoping"] = requireBabelPlugin$1(
      "@babel/plugin-transform-block-scoping",
    );
  }
  if (isBabelPluginNeeded("transform-classes")) {
    babelPluginStructure["transform-classes"] = requireBabelPlugin$1(
      "@babel/plugin-transform-classes",
    );
  }
  if (isBabelPluginNeeded("transform-computed-properties")) {
    babelPluginStructure["transform-computed-properties"] = requireBabelPlugin$1(
      "@babel/plugin-transform-computed-properties",
    );
  }
  if (isBabelPluginNeeded("transform-destructuring")) {
    babelPluginStructure["transform-destructuring"] = requireBabelPlugin$1(
      "@babel/plugin-transform-destructuring",
    );
  }
  if (isBabelPluginNeeded("transform-dotall-regex")) {
    babelPluginStructure["transform-dotall-regex"] = requireBabelPlugin$1(
      "@babel/plugin-transform-dotall-regex",
    );
  }
  if (isBabelPluginNeeded("transform-duplicate-keys")) {
    babelPluginStructure["transform-duplicate-keys"] = requireBabelPlugin$1(
      "@babel/plugin-transform-duplicate-keys",
    );
  }
  if (isBabelPluginNeeded("transform-exponentiation-operator")) {
    babelPluginStructure["transform-exponentiation-operator"] =
      requireBabelPlugin$1("@babel/plugin-transform-exponentiation-operator");
  }
  if (isBabelPluginNeeded("transform-for-of")) {
    babelPluginStructure["transform-for-of"] = requireBabelPlugin$1(
      "@babel/plugin-transform-for-of",
    );
  }
  if (isBabelPluginNeeded("transform-function-name")) {
    babelPluginStructure["transform-function-name"] = requireBabelPlugin$1(
      "@babel/plugin-transform-function-name",
    );
  }
  if (isBabelPluginNeeded("transform-literals")) {
    babelPluginStructure["transform-literals"] = requireBabelPlugin$1(
      "@babel/plugin-transform-literals",
    );
  }
  if (isBabelPluginNeeded("transform-new-target")) {
    babelPluginStructure["transform-new-target"] = requireBabelPlugin$1(
      "@babel/plugin-transform-new-target",
    );
  }
  if (isBabelPluginNeeded("transform-object-super")) {
    babelPluginStructure["transform-object-super"] = requireBabelPlugin$1(
      "@babel/plugin-transform-object-super",
    );
  }
  if (isBabelPluginNeeded("transform-parameters")) {
    babelPluginStructure["transform-parameters"] = requireBabelPlugin$1(
      "@babel/plugin-transform-parameters",
    );
  }
  if (isBabelPluginNeeded("transform-regenerator")) {
    babelPluginStructure["transform-regenerator"] = [
      requireBabelPlugin$1("@babel/plugin-transform-regenerator"),
      {
        asyncGenerators: true,
        generators: true,
        async: false,
      },
    ];
  }
  if (isBabelPluginNeeded("transform-shorthand-properties")) {
    babelPluginStructure["transform-shorthand-properties"] = [
      requireBabelPlugin$1("@babel/plugin-transform-shorthand-properties"),
    ];
  }
  if (isBabelPluginNeeded("transform-spread")) {
    babelPluginStructure["transform-spread"] = [
      requireBabelPlugin$1("@babel/plugin-transform-spread"),
    ];
  }
  if (isBabelPluginNeeded("transform-sticky-regex")) {
    babelPluginStructure["transform-sticky-regex"] = [
      requireBabelPlugin$1("@babel/plugin-transform-sticky-regex"),
    ];
  }
  if (isBabelPluginNeeded("transform-template-literals")) {
    babelPluginStructure["transform-template-literals"] = [
      requireBabelPlugin$1("@babel/plugin-transform-template-literals"),
    ];
  }
  if (
    isBabelPluginNeeded("transform-typeof-symbol") &&
    // prevent "typeof" to be injected into itself:
    // - not needed
    // - would create infinite attempt to transform typeof
    url !== getBabelHelperFileUrl$1("typeof")
  ) {
    babelPluginStructure["transform-typeof-symbol"] = [
      requireBabelPlugin$1("@babel/plugin-transform-typeof-symbol"),
    ];
  }
  if (isBabelPluginNeeded("transform-unicode-regex")) {
    babelPluginStructure["transform-unicode-regex"] = [
      requireBabelPlugin$1("@babel/plugin-transform-unicode-regex"),
    ];
  }
  return babelPluginStructure;
};

const injectSideEffectFileIntoBabelAst$1 = ({
  programPath,
  sideEffectFileUrl,
  getSideEffectFileSpecifier,
  babel,
  isJsModule,
  asImport = true,
}) => {
  if (isJsModule && asImport) {
    injectJsImport({
      programPath,
      from: getSideEffectFileSpecifier(sideEffectFileUrl),
      sideEffect: true,
    });
    return;
  }
  const sidEffectFileContent = readFileSync(new URL(sideEffectFileUrl), "utf8");
  const sideEffectFileContentAst = babel.parse(sidEffectFileContent);
  if (isJsModule) {
    injectAstAfterImport$1(programPath, sideEffectFileContentAst);
    return;
  }
  const bodyNodePaths = programPath.get("body");
  bodyNodePaths[0].insertBefore(sideEffectFileContentAst.program.body);
};

const injectAstAfterImport$1 = (programPath, ast) => {
  const bodyNodePaths = programPath.get("body");
  const notAnImportIndex = bodyNodePaths.findIndex(
    (bodyNodePath) => bodyNodePath.node.type !== "ImportDeclaration",
  );
  const notAnImportNodePath = bodyNodePaths[notAnImportIndex];
  if (notAnImportNodePath) {
    notAnImportNodePath.insertBefore(ast.program.body);
  } else {
    bodyNodePaths[0].insertBefore(ast.program.body);
  }
};

const newStylesheetClientFileUrl$1 = new URL(
  "./client/new_stylesheet.js",
  import.meta.url,
).href;

const babelPluginNewStylesheetInjector$1 = (
  babel,
  { babelHelpersAsImport, getImportSpecifier },
) => {
  return {
    name: "new-stylesheet-injector",
    visitor: {
      Program: (path, state) => {
        const { sourceType } = state.file.opts.parserOpts;
        const isJsModule = sourceType === "module";
        injectSideEffectFileIntoBabelAst$1({
          programPath: path,
          isJsModule,
          asImport: babelHelpersAsImport,
          sideEffectFileUrl: newStylesheetClientFileUrl$1,
          getSideEffectFileSpecifier: getImportSpecifier,
          babel,
        });
      },
    },
  };
};

const analyzeConstructableStyleSheetUsage$1 = (urlInfo) => {
  if (urlInfo.url === newStylesheetClientFileUrl$1) {
    return null;
  }
  // const { runtimeCompat } = urlInfo.kitchen.context;
  // const runtimeNames = runtimeCompat ? Object.keys(runtimeCompat) : [];
  // let someRuntimeIsBrowser = false;
  // for (const runtimeName of runtimeNames) {
  //   if (
  //     runtimeName === "chrome" ||
  //     runtimeName === "edge" ||
  //     runtimeName === "firefox" ||
  //     runtimeName === "opera" ||
  //     runtimeName === "safari" ||
  //     runtimeName === "samsung"
  //   ) {
  //     someRuntimeIsBrowser = true;
  //     break;
  //   }
  // }
  // if (!someRuntimeIsBrowser) {
  //   // we are building only for nodejs, no need to analyze constructable stylesheet usage
  //   return null;
  // }
  const node = visitJsAstUntil(urlInfo.contentAst, {
    NewExpression: (node) => {
      return isNewCssStyleSheetCall$1(node);
    },
    MemberExpression: (node) => {
      return isDocumentAdoptedStyleSheets$1(node);
    },
    ImportExpression: (node) => {
      const source = node.source;
      if (source.type !== "Literal" || typeof source.value === "string") {
        // Non-string argument, probably a variable or expression, e.g.
        // import(moduleId)
        // import('./' + moduleName)
        return false;
      }
      if (hasImportTypeCssAttribute$1(node)) {
        return node;
      }
      if (hasCssModuleQueryParam$1(source)) {
        return source;
      }
      return false;
    },
    ImportDeclaration: (node) => {
      const { source } = node;
      if (hasCssModuleQueryParam$1(source)) {
        return source;
      }
      if (hasImportTypeCssAttribute$1(node)) {
        return node;
      }
      return false;
    },
    ExportAllDeclaration: (node) => {
      const { source } = node;
      if (hasCssModuleQueryParam$1(source)) {
        return source;
      }
      return false;
    },
    ExportNamedDeclaration: (node) => {
      const { source } = node;
      if (!source) {
        // This export has no "source", so it's probably
        // a local variable or function, e.g.
        // export { varName }
        // export const constName = ...
        // export function funcName() {}
        return false;
      }
      if (hasCssModuleQueryParam$1(source)) {
        return source;
      }
      return false;
    },
  });
  return node
    ? {
        line: node.loc.start.line,
        column: node.loc.start.column,
      }
    : null;
};

const isNewCssStyleSheetCall$1 = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "CSSStyleSheet"
  );
};

const isDocumentAdoptedStyleSheets$1 = (node) => {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === "document" &&
    node.property.type === "Identifier" &&
    node.property.name === "adoptedStyleSheets"
  );
};

const hasCssModuleQueryParam$1 = (node) => {
  return (
    node.type === "Literal" &&
    typeof node.value === "string" &&
    new URL(node.value, "https://jsenv.dev").searchParams.has(`css_module`)
  );
};

const hasImportTypeCssAttribute$1 = (node) => {
  const importAttributes = getImportAttributes$1(node);
  return Boolean(importAttributes.type === "css");
};

const getImportAttributes$1 = (importNode) => {
  const importAttributes = {};
  if (importNode.attributes) {
    importNode.attributes.forEach((importAttributeNode) => {
      importAttributes[importAttributeNode.key.name] =
        importAttributeNode.value.value;
    });
  }
  return importAttributes;
};

const regeneratorRuntimeClientFileUrl$1 = new URL(
  "./client/regenerator_runtime.js",
  import.meta.url,
).href;

const babelPluginRegeneratorRuntimeInjector$1 = (
  babel,
  { babelHelpersAsImport, getImportSpecifier },
) => {
  return {
    name: "regenerator-runtime-injector",
    visitor: {
      Program: (path, state) => {
        const { sourceType } = state.file.opts.parserOpts;
        const isJsModule = sourceType === "module";
        injectSideEffectFileIntoBabelAst$1({
          programPath: path,
          isJsModule,
          asImport: babelHelpersAsImport,
          sideEffectFileUrl: regeneratorRuntimeClientFileUrl$1,
          getSideEffectFileSpecifier: getImportSpecifier,
          babel,
        });
      },
    },
  };
};

const analyzeRegeneratorRuntimeUsage$1 = (urlInfo) => {
  if (urlInfo.url === regeneratorRuntimeClientFileUrl$1) {
    return null;
  }
  const ast = urlInfo.contentAst;
  const node = visitJsAstUntil(ast, {
    Identifier: (node) => {
      if (node.name === "regeneratorRuntime") {
        return node;
      }
      return false;
    },
  });
  return node
    ? {
        line: node.loc.start.line,
        column: node.loc.start.column,
      }
    : null;
};

const jsenvPluginBabel$1 = ({ babelHelpersAsImport = true } = {}) => {
  const transformWithBabel = async (urlInfo) => {
    const isJsModule = urlInfo.type === "js_module";
    const getImportSpecifier = (clientFileUrl) => {
      const jsImportReference = urlInfo.dependencies.inject({
        type: "js_import",
        expectedType: "js_module",
        specifier: clientFileUrl,
      });
      return JSON.parse(jsImportReference.generatedSpecifier);
    };
    const isSupported = urlInfo.context.isSupportedOnCurrentClients;
    const babelPluginStructure = getBaseBabelPluginStructure$1({
      url: urlInfo.originalUrl,
      isSupported});

    if (!isSupported("async_generator_function")) {
      const regeneratorRuntimeUsage = analyzeRegeneratorRuntimeUsage$1(urlInfo);
      if (regeneratorRuntimeUsage) {
        if (isJsModule && babelHelpersAsImport) {
          babelPluginStructure["new-stylesheet-injector"] = [
            babelPluginRegeneratorRuntimeInjector$1,
            { babelHelpersAsImport, getImportSpecifier },
          ];
        } else {
          urlInfo.dependencies.foundSideEffectFile({
            sideEffectFileUrl: regeneratorRuntimeClientFileUrl$1,
            expectedType: "js_classic",
            specifierLine: regeneratorRuntimeUsage.line,
            specifierColumn: regeneratorRuntimeUsage.column,
          });
        }
      }
    }
    if (!isSupported("new_stylesheet")) {
      const constructableStyleSheetUsage =
        analyzeConstructableStyleSheetUsage$1(urlInfo);
      if (constructableStyleSheetUsage) {
        if (isJsModule && babelHelpersAsImport) {
          babelPluginStructure["new-stylesheet-injector"] = [
            babelPluginNewStylesheetInjector$1,
            { babelHelpersAsImport, getImportSpecifier },
          ];
        } else {
          urlInfo.dependencies.foundSideEffectFile({
            sideEffectFileUrl: regeneratorRuntimeClientFileUrl$1,
            expectedType: "js_classic",
            specifierLine: constructableStyleSheetUsage.line,
            specifierColumn: constructableStyleSheetUsage.column,
          });
        }
      }
    }
    if (
      isJsModule &&
      babelHelpersAsImport &&
      Object.keys(babelPluginStructure).length > 0
    ) {
      babelPluginStructure["babel-helper-as-jsenv-import"] = [
        babelPluginBabelHelpersAsJsenvImports$1,
        { getImportSpecifier },
      ];
    }

    const babelPlugins = Object.keys(babelPluginStructure).map(
      (babelPluginName) => babelPluginStructure[babelPluginName],
    );
    const { code, map } = await applyBabelPlugins({
      babelPlugins,
      options: {
        generatorOpts: {
          retainLines: urlInfo.context.dev,
        },
      },
      input: urlInfo.content,
      inputIsJsModule: isJsModule,
      inputUrl: urlInfo.originalUrl,
      outputUrl: urlInfo.generatedUrl,
    });
    return {
      content: code,
      sourcemap: map,
    };
  };

  return {
    name: "jsenv:babel",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: transformWithBabel,
      js_module: transformWithBabel,
    },
  };
};

const applyCssTranspilation$1 = async ({
  input,
  inputUrl,
  runtimeCompat,
}) => {
  // https://lightningcss.dev/docs.html
  const { transform } = await import("lightningcss");
  const targets = runtimeCompatToTargets$3(runtimeCompat);
  const { code, map } = transform({
    filename: urlToFileSystemPath$1(inputUrl),
    code: Buffer.from(input),
    targets,
    minify: false,
    drafts: {
      nesting: true,
      customMedia: true,
    },
  });
  return { content: String(code), sourcemap: map };
};

const runtimeCompatToTargets$3 = (runtimeCompat) => {
  const targets = {};
  ["chrome", "firefox", "ie", "opera", "safari"].forEach((runtimeName) => {
    const version = runtimeCompat[runtimeName];
    if (version) {
      targets[runtimeName] = versionToBits$3(version);
    }
  });
  return targets;
};

const versionToBits$3 = (version) => {
  const [major, minor = 0, patch = 0] = version
    .split("-")[0]
    .split(".")
    .map((v) => parseInt(v, 10));
  return (major << 16) | (minor << 8) | patch;
};

const jsenvPluginCssTranspilation$1 = () => {
  return {
    name: "jsenv:css_transpilation",
    appliesDuring: "*",
    transformUrlContent: {
      css: (urlInfo) => {
        return applyCssTranspilation$1({
          input: urlInfo.content,
          inputUrl: urlInfo.originalUrl,
          runtimeCompat: urlInfo.context.runtimeCompat,
        });
      },
    },
  };
};

const isEscaped$1 = (i, string) => {
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

const JS_QUOTES$1 = {
  pickBest: (string, { canUseTemplateString, defaultQuote = DOUBLE$1 } = {}) => {
    // check default first, once tested do no re-test it
    if (!string.includes(defaultQuote)) {
      return defaultQuote;
    }
    if (defaultQuote !== DOUBLE$1 && !string.includes(DOUBLE$1)) {
      return DOUBLE$1;
    }
    if (defaultQuote !== SINGLE$1 && !string.includes(SINGLE$1)) {
      return SINGLE$1;
    }
    if (
      canUseTemplateString &&
      defaultQuote !== BACKTICK$1 &&
      !string.includes(BACKTICK$1)
    ) {
      return BACKTICK$1;
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
        ? JS_QUOTES$1.pickBest(string, { canUseTemplateString, defaultQuote })
        : quote;
    const replacements = JS_QUOTE_REPLACEMENTS$1[quote];
    let result = "";
    let last = 0;
    let i = 0;
    while (i < string.length) {
      const char = string[i];
      i++;
      if (isEscaped$1(i - 1, string)) continue;
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
              !isEscaped$1(j - 1, string)
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

const DOUBLE$1 = `"`;
const SINGLE$1 = `'`;
const BACKTICK$1 = "`";
const lineEndingEscapes$1 = {
  "\n": "\\n",
  "\r": "\\r",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};
const JS_QUOTE_REPLACEMENTS$1 = {
  [DOUBLE$1]: {
    '"': '\\"',
    ...lineEndingEscapes$1,
  },
  [SINGLE$1]: {
    "'": "\\'",
    ...lineEndingEscapes$1,
  },
  [BACKTICK$1]: {
    "`": "\\`",
    "$": "\\$",
  },
};

/*
 * Jsenv wont touch code where "specifier" or "type" is dynamic (see code below)
 * ```js
 * const file = "./style.css"
 * const type = "css"
 * import(file, { with: { type }})
 * ```
 * Jsenv could throw an error when it knows some browsers in runtimeCompat
 * do not support import attributes
 * But for now (as it is simpler) we let the browser throw the error
 */


const jsenvPluginImportAttributes$1 = ({
  json = "auto",
  css = true,
  text = "auto",
}) => {
  const transpilations = { json, css, text };
  const markAsJsModuleProxy = (reference) => {
    reference.expectedType = "js_module";
    if (!reference.filenameHint) {
      reference.filenameHint = `${urlToFilename$3(reference.url)}.js`;
    }
  };
  const turnIntoJsModuleProxy = (
    reference,
    type,
    { injectSearchParamForSideEffectImports },
  ) => {
    reference.mutation = (magicSource) => {
      if (reference.subtype === "import_dynamic") {
        const { importTypeAttributeNode } = reference.astInfo;
        magicSource.remove({
          start: importTypeAttributeNode.start,
          end: importTypeAttributeNode.end,
        });
      } else {
        const { importTypeAttributeNode } = reference.astInfo;
        const content = reference.ownerUrlInfo.content;
        const withKeywordStart = content.indexOf(
          "with",
          importTypeAttributeNode.start - " with { ".length,
        );
        const withKeywordEnd = content.indexOf(
          "}",
          importTypeAttributeNode.end,
        );
        magicSource.remove({
          start: withKeywordStart,
          end: withKeywordEnd + 1,
        });
      }
    };
    const newUrl = injectQueryParams$1(reference.url, {
      [`as_${type}_module`]: "",
      ...(injectSearchParamForSideEffectImports && reference.isSideEffectImport
        ? { side_effect: "" }
        : {}),
    });
    markAsJsModuleProxy(reference);
    return newUrl;
  };

  const createImportTypePlugin = ({
    type,
    createUrlContent,
    injectSearchParamForSideEffectImports,
  }) => {
    return {
      name: `jsenv:import_type_${type}`,
      appliesDuring: "*",
      init: (context) => {
        // transpilation is forced during build so that
        //   - avoid rollup to see import assertions
        //     We would have to tell rollup to ignore import with assertion
        //   - means rollup can bundle more js file together
        //   - means url versioning can work for css inlined in js
        if (context.build) {
          return true;
        }
        const transpilation = transpilations[type];
        if (transpilation === "auto") {
          return !context.isSupportedOnCurrentClients(`import_type_${type}`);
        }
        return transpilation;
      },
      redirectReference: (reference) => {
        if (!reference.importAttributes) {
          return null;
        }
        const { searchParams } = reference;
        if (searchParams.has(`as_${type}_module`)) {
          markAsJsModuleProxy(reference);
          return null;
        }
        // when search param is injected, it will be removed later
        // by "getWithoutSearchParam". We don't want to redirect again
        // (would create infinite recursion)
        if (
          reference.prev &&
          reference.prev.searchParams.has(`as_${type}_module`)
        ) {
          return null;
        }
        if (reference.importAttributes.type === type) {
          return turnIntoJsModuleProxy(reference, type, {
            injectSearchParamForSideEffectImports,
          });
        }
        return null;
      },
      fetchUrlContent: async (urlInfo) => {
        const originalUrlInfo = urlInfo.getWithoutSearchParam(
          `as_${type}_module`,
          {
            expectedType: type,
          },
        );
        if (!originalUrlInfo) {
          return null;
        }
        await originalUrlInfo.cook();
        if (
          injectSearchParamForSideEffectImports &&
          originalUrlInfo.searchParams.has("side_effect")
        ) {
          const urlInfoWithoutSideEffect =
            originalUrlInfo.getWithoutSearchParam("side_effect");
          if (urlInfoWithoutSideEffect) {
            await urlInfoWithoutSideEffect.kitchen.urlInfoTransformer.setContent(
              urlInfoWithoutSideEffect,
              originalUrlInfo.content,
            );
          }
        }
        return createUrlContent(originalUrlInfo);
      },
    };
  };

  const asJsonModule = createImportTypePlugin({
    type: "json",
    createUrlContent: (jsonUrlInfo) => {
      const jsonText = JSON.stringify(jsonUrlInfo.content.trim());
      let inlineContentCall;
      // here we could `export default ${jsonText}`:
      // but js engine are optimized to recognize JSON.parse
      // and use a faster parsing strategy
      if (jsonUrlInfo.context.dev) {
        inlineContentCall = `JSON.parse(
  ${jsonText},
  //# inlinedFromUrl=${jsonUrlInfo.url}
)`;
      } else {
        inlineContentCall = `JSON.parse(${jsonText})`;
      }
      return {
        content: `export default ${inlineContentCall};`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: jsonUrlInfo.originalUrl,
        originalContent: jsonUrlInfo.originalContent,
        data: jsonUrlInfo.data,
      };
    },
  });

  const asCssModule = createImportTypePlugin({
    type: "css",
    injectSearchParamForSideEffectImports: true,
    createUrlContent: (cssUrlInfo) => {
      const cssText = JS_QUOTES$1.escapeSpecialChars(cssUrlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true,
      });
      let inlineContentCall;
      if (cssUrlInfo.context.dev) {
        inlineContentCall = `new __InlineContent__(
  ${cssText},
  { type: "text/css" },
  //# inlinedFromUrl=${cssUrlInfo.url}
)`;
      } else {
        inlineContentCall = `new __InlineContent__(${cssText}, { type: "text/css" })`;
      }

      let autoInject = cssUrlInfo.searchParams.has("side_effect");
      let cssModuleAutoInjectCode = ``;
      if (autoInject) {
        if (cssUrlInfo.context.dev) {
          cssModuleAutoInjectCode = `
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== stylesheet,
    );
  });
};
`;
        } else {
          cssModuleAutoInjectCode = `
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
`;
        }
      }
      let cssModuleContent = `import ${JSON.stringify(cssUrlInfo.context.inlineContentClientFileUrl)};

const inlineContent = ${inlineContentCall};
const stylesheet = new CSSStyleSheet();
stylesheet.replaceSync(inlineContent.text);
${cssModuleAutoInjectCode}
export default stylesheet;`;

      return {
        content: cssModuleContent,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: cssUrlInfo.originalUrl,
        originalContent: cssUrlInfo.originalContent,
        data: cssUrlInfo.data,
      };
    },
  });

  const asTextModule = createImportTypePlugin({
    type: "text",
    createUrlContent: (textUrlInfo) => {
      const textPlain = JS_QUOTES$1.escapeSpecialChars(textUrlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true,
      });
      let inlineContentCall;
      if (textUrlInfo.context.dev) {
        inlineContentCall = `new __InlineContent__(
  ${textPlain},
  { type: "text/plain"},
  //# inlinedFromUrl=${textUrlInfo.url}
)`;
      } else {
        inlineContentCall = `new __InlineContent__(${textPlain}, { type: "text/plain"})`;
      }
      return {
        content: `
import ${JSON.stringify(textUrlInfo.context.inlineContentClientFileUrl)};

const inlineContent = ${inlineContentCall};

export default inlineContent.text;`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: textUrlInfo.originalUrl,
        originalContent: textUrlInfo.originalContent,
        data: textUrlInfo.data,
      };
    },
  });

  return [asJsonModule, asCssModule, asTextModule];
};

/*
 * Transforms code to make it compatible with browser that would not be able to
 * run it otherwise. For instance:
 * - const -> var
 * - async/await -> promises
 * Anything that is not standard (import.meta.dev for instance) is outside the scope
 * of this plugin
 */


const jsenvPluginTranspilation$1 = ({
  importAttributes = true,
  css = true, // TODO
  // build sets jsModuleFallback: false during first step of the build
  // and re-enable it in the second phase (when performing the bundling)
  // so that bundling is applied on js modules THEN it is converted to js classic if needed
  jsModuleFallback = true,
  babelHelpersAsImport = true,
}) => {
  if (importAttributes === true) {
    importAttributes = {};
  }
  if (jsModuleFallback === true) {
    jsModuleFallback = {};
  }
  return [
    // babel also so that rollup can bundle babel helpers for instance
    jsenvPluginBabel$1({
      babelHelpersAsImport,
    }),
    jsenvPluginAsJsModule$1(),
    ...(jsModuleFallback ? [jsenvPluginJsModuleFallback$1()] : []),
    ...(importAttributes
      ? [jsenvPluginImportAttributes$1(importAttributes)]
      : []),

    ...(css ? [jsenvPluginCssTranspilation$1()] : []),
  ];
};

// duplicated from @jsenv/log to avoid the dependency
const createDetailedMessage$2 = (message, details = {}) => {
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

  return string
};

const assertImportMap$1 = (value) => {
  if (value === null) {
    throw new TypeError(`an importMap must be an object, got null`)
  }

  const type = typeof value;
  if (type !== "object") {
    throw new TypeError(`an importMap must be an object, received ${value}`)
  }

  if (Array.isArray(value)) {
    throw new TypeError(
      `an importMap must be an object, received array ${value}`,
    )
  }
};

const hasScheme$2 = (string) => {
  return /^[a-zA-Z]{2,}:/.test(string)
};

const urlToScheme$3 = (urlString) => {
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) return ""
  return urlString.slice(0, colonIndex)
};

const urlToPathname$3 = (urlString) => {
  return ressourceToPathname$1(urlToRessource$1(urlString))
};

const urlToRessource$1 = (urlString) => {
  const scheme = urlToScheme$3(urlString);

  if (scheme === "file") {
    return urlString.slice("file://".length)
  }

  if (scheme === "https" || scheme === "http") {
    // remove origin
    const afterProtocol = urlString.slice(scheme.length + "://".length);
    const pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
    return afterProtocol.slice(pathnameSlashIndex)
  }

  return urlString.slice(scheme.length + 1)
};

const ressourceToPathname$1 = (ressource) => {
  const searchSeparatorIndex = ressource.indexOf("?");
  return searchSeparatorIndex === -1
    ? ressource
    : ressource.slice(0, searchSeparatorIndex)
};

const urlToOrigin$2 = (urlString) => {
  const scheme = urlToScheme$3(urlString);

  if (scheme === "file") {
    return "file://"
  }

  if (scheme === "http" || scheme === "https") {
    const secondProtocolSlashIndex = scheme.length + "://".length;
    const pathnameSlashIndex = urlString.indexOf("/", secondProtocolSlashIndex);

    if (pathnameSlashIndex === -1) return urlString
    return urlString.slice(0, pathnameSlashIndex)
  }

  return urlString.slice(0, scheme.length + 1)
};

const pathnameToParentPathname$2 = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return "/"
  }

  return pathname.slice(0, slashLastIndex + 1)
};

// could be useful: https://url.spec.whatwg.org/#url-miscellaneous


const resolveUrl$2 = (specifier, baseUrl) => {
  if (baseUrl) {
    if (typeof baseUrl !== "string") {
      throw new TypeError(writeBaseUrlMustBeAString$1({ baseUrl, specifier }))
    }
    if (!hasScheme$2(baseUrl)) {
      throw new Error(writeBaseUrlMustBeAbsolute$1({ baseUrl, specifier }))
    }
  }

  if (hasScheme$2(specifier)) {
    return specifier
  }

  if (!baseUrl) {
    throw new Error(writeBaseUrlRequired$1({ baseUrl, specifier }))
  }

  // scheme relative
  if (specifier.slice(0, 2) === "//") {
    return `${urlToScheme$3(baseUrl)}:${specifier}`
  }

  // origin relative
  if (specifier[0] === "/") {
    return `${urlToOrigin$2(baseUrl)}${specifier}`
  }

  const baseOrigin = urlToOrigin$2(baseUrl);
  const basePathname = urlToPathname$3(baseUrl);

  if (specifier === ".") {
    const baseDirectoryPathname = pathnameToParentPathname$2(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}`
  }

  // pathname relative inside
  if (specifier.slice(0, 2) === "./") {
    const baseDirectoryPathname = pathnameToParentPathname$2(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}${specifier.slice(2)}`
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
    return `${baseOrigin}${resolvedPathname}`
  }

  // bare
  if (basePathname === "") {
    return `${baseOrigin}/${specifier}`
  }
  if (basePathname[basePathname.length] === "/") {
    return `${baseOrigin}${basePathname}${specifier}`
  }
  return `${baseOrigin}${pathnameToParentPathname$2(basePathname)}${specifier}`
};

const writeBaseUrlMustBeAString$1 = ({
  baseUrl,
  specifier,
}) => `baseUrl must be a string.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const writeBaseUrlMustBeAbsolute$1 = ({
  baseUrl,
  specifier,
}) => `baseUrl must be absolute.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const writeBaseUrlRequired$1 = ({
  baseUrl,
  specifier,
}) => `baseUrl required to resolve relative specifier.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const tryUrlResolution$1 = (string, url) => {
  const result = resolveUrl$2(string, url);
  return hasScheme$2(result) ? result : null
};

const resolveSpecifier$1 = (specifier, importer) => {
  if (
    specifier === "." ||
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    return resolveUrl$2(specifier, importer)
  }

  if (hasScheme$2(specifier)) {
    return specifier
  }

  return null
};

const applyImportMap$1 = ({
  importMap,
  specifier,
  importer,
  createBareSpecifierError = ({ specifier, importer }) => {
    return new Error(
      createDetailedMessage$2(`Unmapped bare specifier.`, {
        specifier,
        importer,
      }),
    )
  },
  onImportMapping = () => {},
}) => {
  assertImportMap$1(importMap);
  if (typeof specifier !== "string") {
    throw new TypeError(
      createDetailedMessage$2("specifier must be a string.", {
        specifier,
        importer,
      }),
    )
  }
  if (importer) {
    if (typeof importer !== "string") {
      throw new TypeError(
        createDetailedMessage$2("importer must be a string.", {
          importer,
          specifier,
        }),
      )
    }
    if (!hasScheme$2(importer)) {
      throw new Error(
        createDetailedMessage$2(`importer must be an absolute url.`, {
          importer,
          specifier,
        }),
      )
    }
  }

  const specifierUrl = resolveSpecifier$1(specifier, importer);
  const specifierNormalized = specifierUrl || specifier;

  const { scopes } = importMap;
  if (scopes && importer) {
    const scopeSpecifierMatching = Object.keys(scopes).find(
      (scopeSpecifier) => {
        return (
          scopeSpecifier === importer ||
          specifierIsPrefixOf$1(scopeSpecifier, importer)
        )
      },
    );
    if (scopeSpecifierMatching) {
      const scopeMappings = scopes[scopeSpecifierMatching];
      const mappingFromScopes = applyMappings$1(
        scopeMappings,
        specifierNormalized,
        scopeSpecifierMatching,
        onImportMapping,
      );
      if (mappingFromScopes !== null) {
        return mappingFromScopes
      }
    }
  }

  const { imports } = importMap;
  if (imports) {
    const mappingFromImports = applyMappings$1(
      imports,
      specifierNormalized,
      undefined,
      onImportMapping,
    );
    if (mappingFromImports !== null) {
      return mappingFromImports
    }
  }

  if (specifierUrl) {
    return specifierUrl
  }

  throw createBareSpecifierError({ specifier, importer })
};

const applyMappings$1 = (
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
      return address
    }
    if (specifierIsPrefixOf$1(specifierCandidate, specifierNormalized)) {
      const address = mappings[specifierCandidate];
      const afterSpecifier = specifierNormalized.slice(
        specifierCandidate.length,
      );
      const addressFinal = tryUrlResolution$1(afterSpecifier, address);
      onImportMapping({
        scope,
        from: specifierCandidate,
        to: address,
        before: specifierNormalized,
        after: addressFinal,
      });
      return addressFinal
    }
  }

  return null
};

const specifierIsPrefixOf$1 = (specifierHref, href) => {
  return (
    specifierHref[specifierHref.length - 1] === "/" &&
    href.startsWith(specifierHref)
  )
};

// https://github.com/systemjs/systemjs/blob/89391f92dfeac33919b0223bbf834a1f4eea5750/src/common.js#L136

const composeTwoImportMaps$1 = (leftImportMap, rightImportMap) => {
  assertImportMap$1(leftImportMap);
  assertImportMap$1(rightImportMap);

  const importMap = {};

  const leftImports = leftImportMap.imports;
  const rightImports = rightImportMap.imports;
  const leftHasImports = Boolean(leftImports);
  const rightHasImports = Boolean(rightImports);
  if (leftHasImports && rightHasImports) {
    importMap.imports = composeTwoMappings$1(leftImports, rightImports);
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
    importMap.scopes = composeTwoScopes$1(
      leftScopes,
      rightScopes,
      importMap.imports || {},
    );
  } else if (leftHasScopes) {
    importMap.scopes = { ...leftScopes };
  } else if (rightHasScopes) {
    importMap.scopes = { ...rightScopes };
  }

  return importMap
};

const composeTwoMappings$1 = (leftMappings, rightMappings) => {
  const mappings = {};

  Object.keys(leftMappings).forEach((leftSpecifier) => {
    if (objectHasKey$1(rightMappings, leftSpecifier)) {
      // will be overidden
      return
    }
    const leftAddress = leftMappings[leftSpecifier];
    const rightSpecifier = Object.keys(rightMappings).find((rightSpecifier) => {
      return compareAddressAndSpecifier$1(leftAddress, rightSpecifier)
    });
    mappings[leftSpecifier] = rightSpecifier
      ? rightMappings[rightSpecifier]
      : leftAddress;
  });

  Object.keys(rightMappings).forEach((rightSpecifier) => {
    mappings[rightSpecifier] = rightMappings[rightSpecifier];
  });

  return mappings
};

const objectHasKey$1 = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const compareAddressAndSpecifier$1 = (address, specifier) => {
  const addressUrl = resolveUrl$2(address, "file:///");
  const specifierUrl = resolveUrl$2(specifier, "file:///");
  return addressUrl === specifierUrl
};

const composeTwoScopes$1 = (leftScopes, rightScopes, imports) => {
  const scopes = {};

  Object.keys(leftScopes).forEach((leftScopeKey) => {
    if (objectHasKey$1(rightScopes, leftScopeKey)) {
      // will be merged
      scopes[leftScopeKey] = leftScopes[leftScopeKey];
      return
    }
    const topLevelSpecifier = Object.keys(imports).find(
      (topLevelSpecifierCandidate) => {
        return compareAddressAndSpecifier$1(
          leftScopeKey,
          topLevelSpecifierCandidate,
        )
      },
    );
    if (topLevelSpecifier) {
      scopes[imports[topLevelSpecifier]] = leftScopes[leftScopeKey];
    } else {
      scopes[leftScopeKey] = leftScopes[leftScopeKey];
    }
  });

  Object.keys(rightScopes).forEach((rightScopeKey) => {
    if (objectHasKey$1(scopes, rightScopeKey)) {
      scopes[rightScopeKey] = composeTwoMappings$1(
        scopes[rightScopeKey],
        rightScopes[rightScopeKey],
      );
    } else {
      scopes[rightScopeKey] = {
        ...rightScopes[rightScopeKey],
      };
    }
  });

  return scopes
};

const sortImports$1 = (imports) => {
  const mappingsSorted = {};

  Object.keys(imports)
    .sort(compareLengthOrLocaleCompare$1)
    .forEach((name) => {
      mappingsSorted[name] = imports[name];
    });

  return mappingsSorted
};

const sortScopes$1 = (scopes) => {
  const scopesSorted = {};

  Object.keys(scopes)
    .sort(compareLengthOrLocaleCompare$1)
    .forEach((scopeSpecifier) => {
      scopesSorted[scopeSpecifier] = sortImports$1(scopes[scopeSpecifier]);
    });

  return scopesSorted
};

const compareLengthOrLocaleCompare$1 = (a, b) => {
  return b.length - a.length || a.localeCompare(b)
};

const normalizeImportMap$1 = (importMap, baseUrl) => {
  assertImportMap$1(importMap);

  if (!isStringOrUrl$1(baseUrl)) {
    throw new TypeError(formulateBaseUrlMustBeStringOrUrl$1({ baseUrl }))
  }

  const { imports, scopes } = importMap;

  return {
    imports: imports ? normalizeMappings$1(imports, baseUrl) : undefined,
    scopes: scopes ? normalizeScopes$1(scopes, baseUrl) : undefined,
  }
};

const isStringOrUrl$1 = (value) => {
  if (typeof value === "string") {
    return true
  }

  if (typeof URL === "function" && value instanceof URL) {
    return true
  }

  return false
};

const normalizeMappings$1 = (mappings, baseUrl) => {
  const mappingsNormalized = {};

  Object.keys(mappings).forEach((specifier) => {
    const address = mappings[specifier];

    if (typeof address !== "string") {
      console.warn(
        formulateAddressMustBeAString$1({
          address,
          specifier,
        }),
      );
      return
    }

    const specifierResolved = resolveSpecifier$1(specifier, baseUrl) || specifier;

    const addressUrl = tryUrlResolution$1(address, baseUrl);
    if (addressUrl === null) {
      console.warn(
        formulateAdressResolutionFailed$1({
          address,
          baseUrl,
          specifier,
        }),
      );
      return
    }

    if (specifier.endsWith("/") && !addressUrl.endsWith("/")) {
      console.warn(
        formulateAddressUrlRequiresTrailingSlash$1({
          address,
          specifier,
        }),
      );
      return
    }
    mappingsNormalized[specifierResolved] = addressUrl;
  });

  return sortImports$1(mappingsNormalized)
};

const normalizeScopes$1 = (scopes, baseUrl) => {
  const scopesNormalized = {};

  Object.keys(scopes).forEach((scopeSpecifier) => {
    const scopeMappings = scopes[scopeSpecifier];
    const scopeUrl = tryUrlResolution$1(scopeSpecifier, baseUrl);
    if (scopeUrl === null) {
      console.warn(
        formulateScopeResolutionFailed$1({
          scope: scopeSpecifier,
          baseUrl,
        }),
      );
      return
    }
    const scopeValueNormalized = normalizeMappings$1(scopeMappings, baseUrl);
    scopesNormalized[scopeUrl] = scopeValueNormalized;
  });

  return sortScopes$1(scopesNormalized)
};

const formulateBaseUrlMustBeStringOrUrl$1 = ({
  baseUrl,
}) => `baseUrl must be a string or an url.
--- base url ---
${baseUrl}`;

const formulateAddressMustBeAString$1 = ({
  specifier,
  address,
}) => `Address must be a string.
--- address ---
${address}
--- specifier ---
${specifier}`;

const formulateAdressResolutionFailed$1 = ({
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

const formulateAddressUrlRequiresTrailingSlash$1 = ({
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

const formulateScopeResolutionFailed$1 = ({
  scope,
  baseUrl,
}) => `Scope url resolution failed.
--- scope ---
${scope}
--- base url ---
${baseUrl}`;

const pathnameToExtension$3 = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex !== -1) {
    pathname = pathname.slice(slashLastIndex + 1);
  }

  const dotLastIndex = pathname.lastIndexOf(".");
  if (dotLastIndex === -1) return ""
  // if (dotLastIndex === pathname.length - 1) return ""
  return pathname.slice(dotLastIndex)
};

const resolveImport$1 = ({
  specifier,
  importer,
  importMap,
  defaultExtension = false,
  createBareSpecifierError,
  onImportMapping = () => {},
}) => {
  let url;
  if (importMap) {
    url = applyImportMap$1({
      importMap,
      specifier,
      importer,
      createBareSpecifierError,
      onImportMapping,
    });
  } else {
    url = resolveUrl$2(specifier, importer);
  }

  if (defaultExtension) {
    url = applyDefaultExtension$1({ url, importer, defaultExtension });
  }

  return url
};

const applyDefaultExtension$1 = ({ url, importer, defaultExtension }) => {
  if (urlToPathname$3(url).endsWith("/")) {
    return url
  }

  if (typeof defaultExtension === "string") {
    const extension = pathnameToExtension$3(url);
    if (extension === "") {
      return `${url}${defaultExtension}`
    }
    return url
  }

  if (defaultExtension === true) {
    const extension = pathnameToExtension$3(url);
    if (extension === "" && importer) {
      const importerPathname = urlToPathname$3(importer);
      const importerExtension = pathnameToExtension$3(importerPathname);
      return `${url}${importerExtension}`
    }
  }

  return url
};

const memoizeByFirstArgument = (compute) => {
  const urlCache = new Map();

  const fnWithMemoization = (url, ...args) => {
    const valueFromCache = urlCache.get(url);
    if (valueFromCache) {
      return valueFromCache;
    }
    const value = compute(url, ...args);
    urlCache.set(url, value);
    return value;
  };

  fnWithMemoization.forget = () => {
    urlCache.clear();
  };

  return fnWithMemoization;
};

const createCallbackListNotifiedOnce$1 = () => {
  let callbacks = [];
  let status = "waiting";
  let currentCallbackIndex = -1;

  const callbackListOnce = {};

  const add = (callback) => {
    if (status !== "waiting") {
      emitUnexpectedActionWarning$1({ action: "add", status });
      return removeNoop$1;
    }

    if (typeof callback !== "function") {
      throw new Error(`callback must be a function, got ${callback}`);
    }

    // don't register twice
    const existingCallback = callbacks.find((callbackCandidate) => {
      return callbackCandidate === callback;
    });
    if (existingCallback) {
      emitCallbackDuplicationWarning$1();
      return removeNoop$1;
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
      emitUnexpectedActionWarning$1({ action: "call", status });
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

const emitUnexpectedActionWarning$1 = ({ action, status }) => {
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

const emitCallbackDuplicationWarning$1 = () => {
  if (typeof process.emitWarning === "function") {
    process.emitWarning(`Trying to add a callback already in the list`, {
      CODE: "CALLBACK_DUPLICATION",
      detail: `Code is potentially executed more than it should`,
    });
  } else {
    console.warn(`Trying to add same callback twice`);
  }
};

const removeNoop$1 = () => {};

/*
 * See callback_race.md
 */

const raceCallbacks$1 = (raceDescription, winnerCallback) => {
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


const Abort$1 = {
  isAbortError: (error) => {
    return error && error.name === "AbortError";
  },

  startOperation: () => {
    return createOperation$1();
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

const createOperation$1 = () => {
  const operationAbortController = new AbortController();
  // const abortOperation = (value) => abortController.abort(value)
  const operationSignal = operationAbortController.signal;

  // abortCallbackList is used to ignore the max listeners warning from Node.js
  // this warning is useful but becomes problematic when it's expect
  // (a function doing 20 http call in parallel)
  // To be 100% sure we don't have memory leak, only Abortable.asyncCallback
  // uses abortCallbackList to know when something is aborted
  const abortCallbackList = createCallbackListNotifiedOnce$1();
  const endCallbackList = createCallbackListNotifiedOnce$1();

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
    Abort$1.throwIfAborted(operationSignal);
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
    { onAbort = callbackNoop$1, onRemove = callbackNoop$1 } = {},
  ) => {
    const applyAbortEffects = () => {
      const onAbortCallback = onAbort;
      onAbort = callbackNoop$1;
      onAbortCallback();
    };
    const applyRemoveEffects = () => {
      const onRemoveCallback = onRemove;
      onRemove = callbackNoop$1;
      onAbort = callbackNoop$1;
      onRemoveCallback();
    };

    if (operationSignal.aborted) {
      applyAbortEffects();
      applyRemoveEffects();
      return callbackNoop$1;
    }

    if (signal.aborted) {
      operationAbortController.abort();
      applyAbortEffects();
      applyRemoveEffects();
      return callbackNoop$1;
    }

    const cancelRace = raceCallbacks$1(
      {
        operation_abort: (cb) => {
          return addAbortCallback(cb);
        },
        operation_end: (cb) => {
          return addEndCallback(cb);
        },
        child_abort: (cb) => {
          return addEventListener$1(signal, "abort", cb);
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
      remove: callbackNoop$1,
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
    const forkedOperation = createOperation$1();
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

const callbackNoop$1 = () => {};

const addEventListener$1 = (target, eventName, cb) => {
  target.addEventListener(eventName, cb);
  return () => {
    target.removeEventListener(eventName, cb);
  };
};

const raceProcessTeardownEvents$1 = (processTeardownEvents, callback) => {
  return raceCallbacks$1(
    {
      ...(processTeardownEvents.SIGHUP ? SIGHUP_CALLBACK$1 : {}),
      ...(processTeardownEvents.SIGTERM ? SIGTERM_CALLBACK$1 : {}),
      ...(SIGINT_CALLBACK$1 ),
      ...(processTeardownEvents.beforeExit ? BEFORE_EXIT_CALLBACK$1 : {}),
      ...(processTeardownEvents.exit ? EXIT_CALLBACK$1 : {}),
    },
    callback,
  );
};

const SIGHUP_CALLBACK$1 = {
  SIGHUP: (cb) => {
    process.on("SIGHUP", cb);
    return () => {
      process.removeListener("SIGHUP", cb);
    };
  },
};

const SIGTERM_CALLBACK$1 = {
  SIGTERM: (cb) => {
    process.on("SIGTERM", cb);
    return () => {
      process.removeListener("SIGTERM", cb);
    };
  },
};

const BEFORE_EXIT_CALLBACK$1 = {
  beforeExit: (cb) => {
    process.on("beforeExit", cb);
    return () => {
      process.removeListener("beforeExit", cb);
    };
  },
};

const EXIT_CALLBACK$1 = {
  exit: (cb) => {
    process.on("exit", cb);
    return () => {
      process.removeListener("exit", cb);
    };
  },
};

const SIGINT_CALLBACK$1 = {
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

/* eslint-env browser, node */

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

// https://github.com/Marak/colors.js/blob/master/lib/styles.js
// https://stackoverflow.com/a/75985833/2634179
const RESET$1 = "\x1b[0m";

const createAnsi$1 = ({ supported }) => {
  const ANSI = {
    supported,

    RED: "\x1b[31m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    BLUE: "\x1b[34m",
    MAGENTA: "\x1b[35m",
    CYAN: "\x1b[36m",
    GREY: "\x1b[90m",
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
      return `${color}${text}${RESET$1}`;
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
      return `${effect}${text}${RESET$1}`;
    },
  };

  return ANSI;
};

const processSupportsBasicColor$1 = createSupportsColor$1(process.stdout).hasBasic;

const ANSI$1 = createAnsi$1({
  supported:
    process.env.FORCE_COLOR === "1" ||
    processSupportsBasicColor$1 ||
    // GitHub workflow does support ANSI but "supports-color" returns false
    // because stream.isTTY returns false, see https://github.com/actions/runner/issues/241
    process.env.GITHUB_WORKFLOW,
});

// see also https://github.com/sindresorhus/figures

const createUnicode$1 = ({ supported, ANSI }) => {
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

const UNICODE$1 = createUnicode$1({
  supported: process.env.FORCE_UNICODE === "1" || isUnicodeSupported$1(),
  ANSI: ANSI$1,
});

const setRoundedPrecision$1 = (
  number,
  { decimals = 1, decimalsWhenSmall = decimals } = {},
) => {
  return setDecimalsPrecision$1(number, {
    decimals,
    decimalsWhenSmall,
    transform: Math.round,
  });
};

const setPrecision$1 = (
  number,
  { decimals = 1, decimalsWhenSmall = decimals } = {},
) => {
  return setDecimalsPrecision$1(number, {
    decimals,
    decimalsWhenSmall,
    transform: parseInt,
  });
};

const setDecimalsPrecision$1 = (
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

const unitShort$1 = {
  year: "y",
  month: "m",
  week: "w",
  day: "d",
  hour: "h",
  minute: "m",
  second: "s",
};

const humanizeDuration$1 = (
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
  const { primary, remaining } = parseMs$1(ms);
  if (!remaining) {
    return humanizeDurationUnit$1(primary, {
      decimals:
        decimals === undefined ? (primary.name === "second" ? 1 : 0) : decimals,
      short,
      rounded,
    });
  }
  return `${humanizeDurationUnit$1(primary, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
  })} and ${humanizeDurationUnit$1(remaining, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
  })}`;
};
const humanizeDurationUnit$1 = (unit, { decimals, short, rounded }) => {
  const count = rounded
    ? setRoundedPrecision$1(unit.count, { decimals })
    : setPrecision$1(unit.count, { decimals });
  let name = unit.name;
  if (short) {
    name = unitShort$1[name];
    return `${count}${name}`;
  }
  if (count <= 1) {
    return `${count} ${name}`;
  }
  return `${count} ${name}s`;
};
const MS_PER_UNITS$1 = {
  year: 31_557_600_000,
  month: 2_629_000_000,
  week: 604_800_000,
  day: 86_400_000,
  hour: 3_600_000,
  minute: 60_000,
  second: 1000,
};

const parseMs$1 = (ms) => {
  const unitNames = Object.keys(MS_PER_UNITS$1);
  const smallestUnitName = unitNames[unitNames.length - 1];
  let firstUnitName = smallestUnitName;
  let firstUnitCount = ms / MS_PER_UNITS$1[smallestUnitName];
  const firstUnitIndex = unitNames.findIndex((unitName) => {
    if (unitName === smallestUnitName) {
      return false;
    }
    const msPerUnit = MS_PER_UNITS$1[unitName];
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
  const remainingMs = ms - firstUnitCount * MS_PER_UNITS$1[firstUnitName];
  const remainingUnitName = unitNames[firstUnitIndex + 1];
  const remainingUnitCount = remainingMs / MS_PER_UNITS$1[remainingUnitName];
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
  const unitNumberRounded = setRoundedPrecision$1(unitNumber, {
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

const renderBigSection = (params) => {
  return renderSection({
    width: 45,
    ...params,
  });
};

const renderSection = ({
  title,
  content,
  dashColor = ANSI$1.GREY,
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
      const leftDashes = ANSI$1.color("---", dashColor);
      const rightDashes = ANSI$1.color("---", dashColor);
      section += `${leftDashes} ${titleTruncated}… ${rightDashes}`;
    } else {
      const remainingWidth = width - titleWidth - 2; // 2 for spaces around the title
      const dashLeftCount = Math.floor(remainingWidth / 2);
      const dashRightCount = remainingWidth - dashLeftCount;
      const leftDashes = ANSI$1.color("-".repeat(dashLeftCount), dashColor);
      const rightDashes = ANSI$1.color("-".repeat(dashRightCount), dashColor);
      section += `${leftDashes} ${title} ${rightDashes}`;
    }
    section += "\n";
  } else {
    const topDashes = ANSI$1.color(`-`.repeat(width), dashColor);
    section += topDashes;
    section += "\n";
  }
  section += `${content}`;
  if (bottomSeparator) {
    section += "\n";
    const bottomDashes = ANSI$1.color(`-`.repeat(width), dashColor);
    section += bottomDashes;
  }
  return section;
};

const LOG_LEVEL_OFF$1 = "off";

const LOG_LEVEL_DEBUG$1 = "debug";

const LOG_LEVEL_INFO$1 = "info";

const LOG_LEVEL_WARN$1 = "warn";

const LOG_LEVEL_ERROR$1 = "error";

const createLogger$1 = ({ logLevel = LOG_LEVEL_INFO$1 } = {}) => {
  if (logLevel === LOG_LEVEL_DEBUG$1) {
    return {
      level: "debug",
      levels: { debug: true, info: true, warn: true, error: true },
      debug: debug$1,
      info: info$1,
      warn: warn$1,
      error: error$1,
    };
  }
  if (logLevel === LOG_LEVEL_INFO$1) {
    return {
      level: "info",
      levels: { debug: false, info: true, warn: true, error: true },
      debug: debugDisabled$1,
      info: info$1,
      warn: warn$1,
      error: error$1,
    };
  }
  if (logLevel === LOG_LEVEL_WARN$1) {
    return {
      level: "warn",
      levels: { debug: false, info: false, warn: true, error: true },
      debug: debugDisabled$1,
      info: infoDisabled$1,
      warn: warn$1,
      error: error$1,
    };
  }
  if (logLevel === LOG_LEVEL_ERROR$1) {
    return {
      level: "error",
      levels: { debug: false, info: false, warn: false, error: true },
      debug: debugDisabled$1,
      info: infoDisabled$1,
      warn: warnDisabled$1,
      error: error$1,
    };
  }
  if (logLevel === LOG_LEVEL_OFF$1) {
    return {
      level: "off",
      levels: { debug: false, info: false, warn: false, error: false },
      debug: debugDisabled$1,
      info: infoDisabled$1,
      warn: warnDisabled$1,
      error: errorDisabled$1,
    };
  }
  throw new Error(`unexpected logLevel.
--- logLevel ---
${logLevel}
--- allowed log levels ---
${LOG_LEVEL_OFF$1}
${LOG_LEVEL_ERROR$1}
${LOG_LEVEL_WARN$1}
${LOG_LEVEL_INFO$1}
${LOG_LEVEL_DEBUG$1}`);
};

const debug$1 = (...args) => console.debug(...args);

const debugDisabled$1 = () => {};

const info$1 = (...args) => console.info(...args);

const infoDisabled$1 = () => {};

const warn$1 = (...args) => console.warn(...args);

const warnDisabled$1 = () => {};

const error$1 = (...args) => console.error(...args);

const errorDisabled$1 = () => {};

/*
 * see also https://github.com/vadimdemedes/ink
 */


const createDynamicLog$1 = ({
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
      const width = stringWidth(logLine);
      if (width === 0) {
        visualLineCount++;
      } else {
        visualLineCount += Math.ceil(width / columns);
      }
    }

    if (visualLineCount > rows) {
      if (clearTerminalAllowed) {
        clearAttemptResult = true;
        return clearTerminal$1;
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
    return eraseLines$1(visualLineCount);
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
    const removeStdoutSpy = spyStreamOutput$1(
      process.stdout,
      writeFromOutsideEffect,
    );
    const removeStderrSpy = spyStreamOutput$1(
      process.stderr,
      writeFromOutsideEffect,
    );
    removeStreamSpy = () => {
      removeStdoutSpy();
      removeStderrSpy();
    };
  } else {
    removeStreamSpy = spyStreamOutput$1(stream, writeFromOutsideEffect);
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
const spyStreamOutput$1 = (stream, callback) => {
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

const startSpinner$1 = ({
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
  if (animated && ANSI$1.supported) {
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

const createTaskLog$1 = (
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
  const dynamicLog = createDynamicLog$1();
  let message = label;
  const taskSpinner = startSpinner$1({
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
        `${UNICODE$1.OK} ${label} (done in ${humanizeDuration$1(msEllapsed)})`,
      );
    },
    happen: (message) => {
      taskSpinner.stop(
        `${UNICODE$1.INFO} ${message} (at ${new Date().toLocaleTimeString()})`,
      );
    },
    fail: (message = `failed to ${label}`) => {
      taskSpinner.stop(`${UNICODE$1.FAILURE} ${message}`);
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

const pathnameToExtension$2 = (pathname) => {
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

const resourceToPathname$1 = (resource) => {
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

const urlToScheme$2 = (url) => {
  const urlString = String(url);
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) {
    return "";
  }

  const scheme = urlString.slice(0, colonIndex);
  return scheme;
};

const urlToResource$1 = (url) => {
  const scheme = urlToScheme$2(url);

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

const urlToPathname$2 = (url) => {
  const resource = urlToResource$1(url);
  const pathname = resourceToPathname$1(resource);
  return pathname;
};

const urlToFilename$1 = (url) => {
  const pathname = urlToPathname$2(url);
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

const urlToExtension$2 = (url) => {
  const pathname = urlToPathname$2(url);
  return pathnameToExtension$2(pathname);
};

const urlToOrigin$1 = (url) => {
  const urlString = String(url);
  if (urlString.startsWith("file://")) {
    return `file://`;
  }
  return new URL(urlString).origin;
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

const setUrlExtension = (url, extension) => {
  const origin = urlToOrigin$1(url);
  const currentExtension = urlToExtension$2(url);
  if (typeof extension === "function") {
    extension = extension(currentExtension);
  }
  const resource = urlToResource$1(url);
  const [pathname, search] = resource.split("?");
  const pathnameWithoutExtension = currentExtension
    ? pathname.slice(0, -currentExtension.length)
    : pathname;
  let newPathname;
  if (pathnameWithoutExtension.endsWith("/")) {
    newPathname = pathnameWithoutExtension.slice(0, -1);
    newPathname += extension;
    newPathname += "/";
  } else {
    newPathname = pathnameWithoutExtension;
    newPathname += extension;
  }
  return `${origin}${newPathname}${search ? `?${search}` : ""}`;
};

const setUrlFilename = (url, filename) => {
  const parentPathname = new URL("./", url).pathname;
  return transformUrlPathname$1(url, (pathname) => {
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
    return `${basename}${urlToExtension$2(url)}`;
  });
};

const transformUrlPathname$1 = (url, transformer) => {
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
const ensurePathnameTrailingSlash$1 = (url) => {
  return transformUrlPathname$1(url, (pathname) => {
    return pathname.endsWith("/") ? pathname : `${pathname}/`;
  });
};

const isFileSystemPath$1 = (value) => {
  if (typeof value !== "string") {
    throw new TypeError(
      `isFileSystemPath first arg must be a string, got ${value}`,
    );
  }
  if (value[0] === "/") {
    return true;
  }
  return startsWithWindowsDriveLetter$1(value);
};

const startsWithWindowsDriveLetter$1 = (string) => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;

  const secondChar = string[1];
  if (secondChar !== ":") return false;

  return true;
};

const fileSystemPathToUrl$1 = (value) => {
  if (!isFileSystemPath$1(value)) {
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
      fileName && isFileSystemPath$1(fileName)
        ? fileSystemPathToUrl$1(fileName)
        : fileName,
    line: callerCallsite.getLineNumber(),
    column: callerCallsite.getColumnNumber(),
  };
};

const resolveUrl$1 = (specifier, baseUrl) => {
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

const validateDirectoryUrl$1 = (value) => {
  let urlString;

  if (value instanceof URL) {
    urlString = value.href;
  } else if (typeof value === "string") {
    if (isFileSystemPath$1(value)) {
      urlString = fileSystemPathToUrl$1(value);
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
    value: ensurePathnameTrailingSlash$1(urlString),
  };
};

const assertAndNormalizeDirectoryUrl$1 = (
  directoryUrl,
  name = "directoryUrl",
) => {
  const { valid, message, value } = validateDirectoryUrl$1(directoryUrl);
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
    if (isFileSystemPath$1(value)) {
      urlString = fileSystemPathToUrl$1(value);
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

const compareFileUrls = (a, b) => {
  return comparePathnames(new URL(a).pathname, new URL(b).pathname);
};

const isWindows$3 = process.platform === "win32";
const baseUrlFallback = fileSystemPathToUrl$1(process.cwd());

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

const findAncestorDirectoryUrl = (url, callback) => {
  url = String(url);
  while (url !== "file:///") {
    if (callback(url)) {
      return url;
    }
    url = getParentDirectoryUrl(url);
  }
  return null;
};

const lookupPackageDirectory = (currentUrl) => {
  return findAncestorDirectoryUrl(currentUrl, (ancestorDirectoryUrl) => {
    const potentialPackageJsonFileUrl = `${ancestorDirectoryUrl}package.json`;
    return existsSync(new URL(potentialPackageJsonFileUrl));
  });
};

const readPackageAtOrNull = (packageDirectoryUrl) => {
  try {
    const packageFileContent = readFileSync(
      new URL("./package.json", packageDirectoryUrl),
      "utf8",
    );
    const packageJSON = JSON.parse(packageFileContent);
    return packageJSON;
  } catch {
    return null;
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
  const directoryUrl = assertAndNormalizeDirectoryUrl$1(url);
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
  const destinationUrl = assertAndNormalizeDirectoryUrl$1(destination);
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
    const directoryUrl = ensurePathnameTrailingSlash$1(sourceUrl);
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
  const destinationUrl = assertAndNormalizeDirectoryUrl$1(destination);
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
      findAncestorDirectoryUrl(destinationUrl, (ancestorUrl) => {
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
    writeFileSync$2(destinationUrlObject, content);
  } catch (error) {
    if (error.code === "EISDIR") {
      // happens when directory existed but got deleted and now it's a file
      if (force) {
        removeDirectorySync(destinationUrlObject);
        writeFileSync$2(destinationUrlObject, content);
      } else {
        throw error;
      }
    }
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      writeDirectorySync(new URL("./", destinationUrlObject), {
        force,
        recursive: true,
      });
      writeFileSync$2(destinationUrlObject, content);
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

  const removeOperation = Abort$1.startOperation();
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
      await removeDirectory(ensurePathnameTrailingSlash$1(sourceUrl), {
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
  const removeDirectoryOperation = Abort$1.startOperation();
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
  const sourceUrl = assertAndNormalizeDirectoryUrl$1(source);
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

const urlToExtension$1 = (url) => {
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
  const packageJsonUrl = new URL("package.json", packageUrl);
  const buffer = readFileSync(packageJsonUrl);
  const string = String(buffer);
  try {
    return JSON.parse(string);
  } catch {
    throw new Error(`Invalid package configuration`);
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
    return {
      type: "relative_specifier",
      url: new URL(specifier, parentUrl).href,
    };
  }
  if (specifier[0] === "#") {
    return applyPackageImportsResolution(specifier, resolutionContext);
  }
  try {
    const urlObject = new URL(specifier);
    if (specifier.startsWith("node:")) {
      return {
        type: "node_builtin_specifier",
        url: specifier,
      };
    }
    return {
      type: "absolute_specifier",
      url: urlObject.href,
    };
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
    return {
      type: "field:browser",
      isMain: true,
      packageDirectoryUrl,
      packageJson,
      url,
    };
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
    return {
      type: "node_builtin_specifier",
      url: `node:${packageSpecifier}`,
    };
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
      const { exports } = packageJson;
      if (exports !== null && exports !== undefined) {
        return applyPackageExportsResolution(packageSubpath, {
          ...resolutionContext,
          packageDirectoryUrl,
          packageJson,
          exports,
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
  const { exports } = packageJson;
  if (!exports) {
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
      return {
        type: isImport ? "field:imports" : "field:exports",
        isMain: subpath === "" || subpath === ".",
        packageDirectoryUrl,
        packageJson,
        url: pattern
          ? targetUrl.replaceAll("*", subpath)
          : new URL(subpath, targetUrl).href,
      };
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
      if (key === "default" || conditions.includes(key)) {
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
  return {
    type: "subpath",
    isMain: packageSubpath === ".",
    packageDirectoryUrl,
    packageJson,
    url: new URL(packageSubpath, packageDirectoryUrl).href,
  };
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
      return {
        type: resolved.type,
        isMain: resolved.isMain,
        packageDirectoryUrl,
        packageJson,
        url: new URL(resolved.path, packageDirectoryUrl).href,
      };
    }
  }
  return {
    type: "field:main", // the absence of "main" field
    isMain: true,
    packageDirectoryUrl,
    packageJson,
    url: new URL("index.js", packageDirectoryUrl).href,
  };
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
    const content = readFileSync(browserMainUrlObject, "utf-8");
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
  node: ({ packageJson }) => {
    if (typeof packageJson.main === "string") {
      return {
        type: "field:main",
        isMain: true,
        path: packageJson.main,
      };
    }
    return null;
  },
};

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
      const importerExtension = urlToExtension$1(importer);
      extensionsSet.add(importerExtension);
    } else {
      extensionsSet.add(magicExtension);
    }
  });
  return Array.from(extensionsSet.values());
};

const fileUrlConverter = {
  asFilePath: (fileUrl) => {
    const filePath = urlToFileSystemPath(fileUrl);
    const urlObject = new URL(fileUrl);
    const { searchParams } = urlObject;
    return `${filePath}${stringifyQuery(searchParams)}`;
  },
  asFileUrl: (filePath) => {
    return decodeURIComponent(fileSystemPathToUrl$1(filePath)).replace(
      /[=](?=&|$)/g,
      "",
    );
  },
};

const stringifyQuery = (searchParams) => {
  const search = searchParams.toString();
  return search ? `?${search}` : "";
};

const bundleJsModules = async (
  jsModuleUrlInfos,
  {
    buildDirectoryUrl,
    include,
    chunks = {},
    strictExports = false,
    isolateDynamicImports = undefined,
    preserveDynamicImports = false,
    augmentDynamicImportUrlSearchParams = () => {},
    rollup,
    rollupInput = {},
    rollupOutput = {},
    rollupPlugins = [],
  },
) => {
  const {
    signal,
    logger,
    rootDirectoryUrl,
    runtimeCompat,
    sourcemaps,
    isSupportedOnCurrentClients,
    getPluginMeta,
    kitchen,
    assetsDirectory,
  } = jsModuleUrlInfos[0].context;
  const graph = jsModuleUrlInfos[0].graph;
  if (buildDirectoryUrl === undefined) {
    buildDirectoryUrl = jsModuleUrlInfos[0].context.buildDirectoryUrl;
  }
  const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node");
  if (isolateDynamicImports === undefined && nodeRuntimeEnabled) {
    isolateDynamicImports = true;
  }

  const PATH_AND_URL_CONVERTER = {
    asFileUrl: fileUrlConverter.asFileUrl,
    asFilePath: fileUrlConverter.asFilePath,
  };

  if (isolateDynamicImports) {
    PATH_AND_URL_CONVERTER.asFileUrl = (path, stripDynamicImportId) => {
      const fileUrl = fileUrlConverter.asFileUrl(path);
      if (!stripDynamicImportId) {
        return fileUrl;
      }
      if (!fileUrl.includes("dynamic_import_id")) {
        return fileUrl;
      }
      return injectQueryParams(fileUrl, {
        dynamic_import_id: undefined,
      });
    };
  }

  const generateBundleWithRollup = async () => {
    let manualChunks;
    if (chunks) {
      let workspaces;
      let packageName;
      const packageDirectoryUrl = lookupPackageDirectory(rootDirectoryUrl);
      if (packageDirectoryUrl) {
        const packageJSON = readPackageAtOrNull(packageDirectoryUrl);
        if (packageJSON) {
          packageName = packageJSON.name;
          workspaces = packageJSON.workspaces;
        }
      }
      let nodeModuleChunkName = `node_modules`;
      let packagesChunkName = `packages`;

      if (packageName) {
        let packageNameAsFilename = packageName
          .replaceAll("@", "")
          .replaceAll("-", "_")
          .replaceAll("/", "_");
        nodeModuleChunkName = `${packageNameAsFilename}_node_modules`;
        packagesChunkName = `${packageNameAsFilename}_packages`;
      }
      if (assetsDirectory) {
        nodeModuleChunkName = `${assetsDirectory}${nodeModuleChunkName}`;
        packagesChunkName = `${assetsDirectory}${packagesChunkName}`;
      }

      chunks[nodeModuleChunkName] = {
        "file:///**/node_modules/": true,
        ...chunks.vendors,
      };
      if (workspaces) {
        const workspacePatterns = {};
        for (const workspace of workspaces) {
          const workspacePattern = new URL(
            workspace.endsWith("/*") ? workspace.slice(0, -1) : workspace,
            packageDirectoryUrl,
          ).href;
          workspacePatterns[workspacePattern] = true;
        }
        chunks[packagesChunkName] = {
          ...workspacePatterns,
          ...chunks.workspaces,
        };
      }

      const associations = URL_META.resolveAssociations(
        chunks,
        rootDirectoryUrl,
      );
      manualChunks = (id, manualChunksApi) => {
        if (rollupOutput.manualChunks) {
          const manualChunkName = rollupOutput.manualChunks(
            id,
            manualChunksApi,
          );
          if (manualChunkName) {
            return manualChunkName;
          }
        }
        const moduleInfo = manualChunksApi.getModuleInfo(id);
        if (moduleInfo.isEntry || moduleInfo.dynamicImporters.length) {
          return null;
        }
        const url = PATH_AND_URL_CONVERTER.asFileUrl(id);
        const urlObject = new URL(url);
        urlObject.search = "";
        const urlWithoutSearch = urlObject.href;
        const meta = URL_META.applyAssociations({
          url: urlWithoutSearch,
          associations,
        });
        for (const chunkNameCandidate of Object.keys(meta)) {
          if (meta[chunkNameCandidate]) {
            return chunkNameCandidate;
          }
        }
        return undefined;
      };
    }

    const resultRef = { current: null };
    const willMinifyJsModule = Boolean(getPluginMeta("willMinifyJsModule"));
    try {
      await applyRollupPlugins({
        rollup,
        rollupPlugins: [
          ...rollupPlugins,
          rollupPluginJsenv({
            signal,
            logger,
            rootDirectoryUrl,
            buildDirectoryUrl,
            graph,
            jsModuleUrlInfos,
            PATH_AND_URL_CONVERTER,
            kitchen,

            runtimeCompat,
            sourcemaps,
            include,
            preserveDynamicImports,
            augmentDynamicImportUrlSearchParams,
            isolateDynamicImports,
            strictExports,
            resultRef,
          }),
        ],
        rollupInput: {
          input: [],
          onwarn: (warning) => {
            if (warning.code === "CIRCULAR_DEPENDENCY") {
              return;
            }
            if (warning.code === "EVAL") {
              // ideally we should disable only for jsenv files
              return;
            }
            if (
              warning.code === "INVALID_ANNOTATION" &&
              warning.loc.file.includes("/node_modules/")
            ) {
              return;
            }
            if (
              warning.code === "EMPTY_BUNDLE" &&
              (warning.names.join("").endsWith("node_modules") ||
                warning.names.join("").endsWith("packages"))
            ) {
              return;
            }
            logger.warn(String(warning));
          },
          ...rollupInput,
        },
        rollupOutput: {
          compact: willMinifyJsModule,
          minifyInternalExports: willMinifyJsModule,
          generatedCode: {
            arrowFunctions: isSupportedOnCurrentClients("arrow_function"),
            constBindings: isSupportedOnCurrentClients("const_bindings"),
            objectShorthand: isSupportedOnCurrentClients(
              "object_properties_shorthand",
            ),
            reservedNamesAsProps: isSupportedOnCurrentClients("reserved_words"),
            symbols: isSupportedOnCurrentClients("symbols"),
          },
          ...rollupOutput,
          manualChunks,
        },
      });
      return resultRef.current.jsModuleBundleUrlInfos;
    } catch (e) {
      if (e.code === "MISSING_EXPORT") {
        const detailedMessage = createDetailedMessage$1(e.message, {
          frame: e.frame,
        });
        throw new Error(detailedMessage, { cause: e });
      }
      throw e;
    }
  };

  const jsModuleBundleUrlInfos = await generateBundleWithRollup();
  return jsModuleBundleUrlInfos;
};

const rollupPluginJsenv = ({
  // logger,
  rootDirectoryUrl,
  buildDirectoryUrl,
  graph,
  jsModuleUrlInfos,
  PATH_AND_URL_CONVERTER,

  kitchen,
  sourcemaps,
  include,
  preserveDynamicImports,
  isolateDynamicImports,
  augmentDynamicImportUrlSearchParams,
  strictExports,

  resultRef,
}) => {
  let _rollupEmitFile = () => {
    throw new Error("not implemented");
  };
  const format = jsModuleUrlInfos.some((jsModuleUrlInfo) =>
    jsModuleUrlInfo.filenameHint.endsWith(".cjs"),
  )
    ? "cjs"
    : "esm";
  const emitChunk = (chunk) => {
    return _rollupEmitFile({
      type: "chunk",
      ...chunk,
    });
  };
  let importCanBeBundled = () => true;
  if (include) {
    const associations = URL_META.resolveAssociations(
      { bundle: include },
      rootDirectoryUrl,
    );
    importCanBeBundled = (url) => {
      return URL_META.applyAssociations({ url, associations }).bundle;
    };
  }

  const getOriginalUrl = (rollupFileInfo, stripDynamicImportId) => {
    if (
      // - explicitely emitted by emitChunk
      // - import.meta.resolve("")
      rollupFileInfo.isEntry ||
      // - new URL("", import.meta.url)
      rollupFileInfo.isImplicitEntry
    ) {
      const { facadeModuleId } = rollupFileInfo;
      if (facadeModuleId) {
        return PATH_AND_URL_CONVERTER.asFileUrl(
          facadeModuleId,
          stripDynamicImportId,
        );
      }
    }
    if (rollupFileInfo.isDynamicEntry) {
      const { moduleIds } = rollupFileInfo;
      const lastModuleId = moduleIds[moduleIds.length - 1];
      return PATH_AND_URL_CONVERTER.asFileUrl(
        lastModuleId,
        stripDynamicImportId,
      );
    }
    return new URL(rollupFileInfo.fileName, buildDirectoryUrl).href;
  };

  const packageSideEffectsCacheMap = new Map();
  const readClosestPackageJsonSideEffects = (url) => {
    const packageDirectoryUrl = lookupPackageDirectory(url);
    if (!packageDirectoryUrl) {
      return undefined;
    }
    const fromCache = packageSideEffectsCacheMap.get(packageDirectoryUrl);
    if (fromCache) {
      return fromCache.value;
    }
    try {
      const packageFileContent = readFileSync(
        new URL("./package.json", packageDirectoryUrl),
        "utf8",
      );
      const packageJSON = JSON.parse(packageFileContent);
      return storePackageSideEffect(packageDirectoryUrl, packageJSON);
    } catch {
      return storePackageSideEffect(packageDirectoryUrl, null);
    }
  };
  const storePackageSideEffect = (packageDirectoryUrl, packageJson) => {
    if (!packageJson) {
      packageSideEffectsCacheMap.set(packageDirectoryUrl, { value: undefined });
      return undefined;
    }
    const value = packageJson.sideEffects;
    if (Array.isArray(value)) {
      const sideEffectPatterns = {};
      for (const v of value) {
        sideEffectPatterns[v] = true;
      }
      const associations = URL_META.resolveAssociations(
        { sideEffects: sideEffectPatterns },
        packageDirectoryUrl,
      );
      const isMatching = (url) => {
        const meta = URL_META.applyAssociations({ url, associations });
        return meta.sideEffects || false;
      };
      packageSideEffectsCacheMap.set(packageDirectoryUrl, {
        value: isMatching,
      });
      return isMatching;
    }
    packageSideEffectsCacheMap.set(packageDirectoryUrl, { value });
    return value;
  };

  const inferSideEffectsFromResolvedUrl = (url) => {
    if (url.startsWith("ignore:")) {
      // console.log(`may have side effect: ${url}`);
      // double ignore we must keep the import
      return null;
    }
    if (isSpecifierForNodeBuiltin(url)) {
      return false;
    }
    const closestPackageJsonSideEffects =
      readClosestPackageJsonSideEffects(url);
    if (closestPackageJsonSideEffects === undefined) {
      // console.log(`may have side effect: ${url}`);
      return null;
    }
    if (typeof closestPackageJsonSideEffects === "function") {
      const haveSideEffect = closestPackageJsonSideEffects(url);
      // if (haveSideEffect) {
      //   console.log(`have side effect: ${url}`);
      // }
      return haveSideEffect;
    }
    return closestPackageJsonSideEffects;
  };
  const getModuleSideEffects = (url, importer) => {
    if (!url.startsWith("ignore:")) {
      return inferSideEffectsFromResolvedUrl(url);
    }
    url = url.slice("ignore:".length);
    if (url.startsWith("file:")) {
      return inferSideEffectsFromResolvedUrl(url);
    }
    try {
      const result = kitchen.resolve(url, importer);
      if (result.packageDirectoryUrl) {
        storePackageSideEffect(result.packageDirectoryUrl, result.packageJson);
      }
      return inferSideEffectsFromResolvedUrl(url);
    } catch {
      return null;
    }
  };

  const resolveImport = (specifier, importer) => {
    if (specifier[0] === "/") {
      return new URL(specifier.slice(1), rootDirectoryUrl);
    }
    return new URL(specifier, importer);
  };

  const dynamicImportIdSet = new Set();
  const assignDynamicImportId = (urlImportedDynamically) => {
    const urlInfo = jsModuleUrlInfos[0].context.kitchen.graph.getUrlInfo(
      urlImportedDynamically,
    );
    let dynamicImportIdBase =
      urlInfo && urlInfo.filenameHint
        ? filenameWithoutExtension(urlInfo.filenameHint)
        : urlToBasename(urlImportedDynamically);
    let dynamicImportIdCandidate = dynamicImportIdBase;
    let positiveInteger = 1;
    while (dynamicImportIdSet.has(dynamicImportIdCandidate)) {
      dynamicImportIdCandidate = `${dynamicImportIdBase}_${positiveInteger}`;
      positiveInteger++;
    }
    const dynamicImportId = dynamicImportIdCandidate;
    dynamicImportIdSet.add(dynamicImportId);
    return dynamicImportId;
  };

  return {
    name: "jsenv",
    async buildStart() {
      _rollupEmitFile = (...args) => this.emitFile(...args);
      let previousNonEntryPointModuleId;
      for (const jsModuleUrlInfo of jsModuleUrlInfos) {
        const id = jsModuleUrlInfo.url;
        if (jsModuleUrlInfo.isEntryPoint) {
          emitChunk({
            id,
          });
          continue;
        }
        let preserveSignature;
        if (strictExports) {
          preserveSignature = "strict";
        } else {
          // When referenced only once we can enable allow-extension
          // otherwise stick to strict exports to ensure all importers
          // receive the correct exports
          let firstStrongRef = null;
          let hasMoreThanOneStrongRefFromOther = false;
          for (const referenceFromOther of jsModuleUrlInfo.referenceFromOthersSet) {
            if (referenceFromOther.isWeak) {
              continue;
            }
            if (firstStrongRef) {
              hasMoreThanOneStrongRefFromOther = true;
              break;
            }
            firstStrongRef = referenceFromOther;
          }
          preserveSignature = hasMoreThanOneStrongRefFromOther
            ? "strict"
            : "allow-extension";
        }
        emitChunk({
          id,
          implicitlyLoadedAfterOneOf: previousNonEntryPointModuleId
            ? [previousNonEntryPointModuleId]
            : null,
          preserveSignature,
        });
        if (jsModuleUrlInfo.originalUrl.startsWith("file:")) {
          previousNonEntryPointModuleId = id;
        }
      }
    },
    async generateBundle(outputOptions, rollupResult) {
      _rollupEmitFile = (...args) => this.emitFile(...args);

      const createBundledFileInfo = (rollupFileInfo) => {
        const originalUrl = getOriginalUrl(rollupFileInfo);
        const sourceUrls = Object.keys(rollupFileInfo.modules).map((id) =>
          PATH_AND_URL_CONVERTER.asFileUrl(id),
        );

        const specifierToUrlMap = new Map();
        const { imports, dynamicImports } = rollupFileInfo;
        for (const importFileName of imports) {
          if (!importFileName.startsWith("file:")) {
            const importRollupFileInfo = rollupResult[importFileName];
            if (!importRollupFileInfo) {
              // happens for external import, like "ignore:" or anything marked as external
              specifierToUrlMap.set(importFileName, importFileName);
              continue;
            }
            const importUrl = getOriginalUrl(importRollupFileInfo);
            const importerBuildUrl = new URL(
              rollupFileInfo.fileName,
              buildDirectoryUrl,
            ).href;
            const urlToImport = new URL(
              importRollupFileInfo.fileName,
              buildDirectoryUrl,
            ).href;
            const specifierRelative = urlToRelativeUrl(
              urlToImport,
              importerBuildUrl,
            );
            const rollupSpecifier =
              specifierRelative[0] === "."
                ? specifierRelative
                : `./${specifierRelative}`;
            specifierToUrlMap.set(rollupSpecifier, importUrl);
          }
        }
        for (const dynamicImportFileName of dynamicImports) {
          if (!dynamicImportFileName.startsWith("file:")) {
            const dynamicImportRollupFileInfo =
              rollupResult[dynamicImportFileName];
            if (!dynamicImportRollupFileInfo) {
              // happens for external import, like "ignore:" or anything marked as external
              specifierToUrlMap.set(
                dynamicImportFileName,
                dynamicImportFileName,
              );
              continue;
            }
            const dynamicImportUrl = getOriginalUrl(
              dynamicImportRollupFileInfo,
            );
            const rollupSpecifier = `./${dynamicImportRollupFileInfo.fileName}`;
            specifierToUrlMap.set(rollupSpecifier, dynamicImportUrl);
          }
        }

        const generatedToShareCode =
          !rollupFileInfo.isEntry &&
          !rollupFileInfo.isDynamicEntry &&
          !rollupFileInfo.isImplicitEntry;

        return {
          originalUrl,
          type: format === "esm" ? "js_module" : "common_js",
          data: {
            bundlerName: "rollup",
            bundleRelativeUrl: rollupFileInfo.fileName,
            usesImport:
              rollupFileInfo.imports.length > 0 ||
              rollupFileInfo.dynamicImports.length > 0,
            isDynamicEntry: rollupFileInfo.isDynamicEntry,
            generatedToShareCode,
          },
          sourceUrls,
          contentType: "text/javascript",
          content: rollupFileInfo.code,
          sourcemap: rollupFileInfo.map,
          // rollup is generating things like "./file.js"
          // that must be converted back to urls for jsenv
          remapReference:
            specifierToUrlMap.size > 0
              ? (reference) => {
                  if (
                    preserveDynamicImports &&
                    reference.subtype === "dynamic_import"
                  ) {
                    // when dynamic import are preserved, no need to remap them
                    return reference.specifier;
                  }
                  if (
                    reference.type !== "js_import" ||
                    reference.subtype === "import_meta_resolve"
                  ) {
                    // rollup generate specifiers only for static and dynamic imports
                    // other references (like new URL()) are ignored
                    // there is no need to remap them back
                    return reference.specifier;
                  }
                  const specifierBeforeRollup = specifierToUrlMap.get(
                    reference.specifier,
                  );
                  if (!specifierBeforeRollup) {
                    // process.emitWarning?
                    console.warn(
                      `cannot remap "${reference.specifier}" back to specifier before rollup, this is unexpected.`,
                    );
                    return reference.specifier;
                  }
                  return specifierBeforeRollup;
                }
              : undefined,
        };
      };

      const jsModuleBundleUrlInfos = {};
      const fileNames = Object.keys(rollupResult);
      const originalUrlSet = new Set();
      for (const fileName of fileNames) {
        const rollupFileInfo = rollupResult[fileName];
        // there is 3 types of file: "placeholder", "asset", "chunk"
        if (rollupFileInfo.type === "chunk") {
          const jsModuleInfo = createBundledFileInfo(rollupFileInfo);
          const originalUrl = jsModuleInfo.originalUrl;
          if (originalUrlSet.has(originalUrl)) {
            throw new Error(
              `duplicate bundle info, cannot override ${originalUrl}`,
            );
          }
          originalUrlSet.add(originalUrl);
          jsModuleBundleUrlInfos[jsModuleInfo.originalUrl] = jsModuleInfo;
        }
      }

      resultRef.current = {
        jsModuleBundleUrlInfos,
      };
    },
    outputOptions: (outputOptions) => {
      // const sourcemapFile = buildDirectoryUrl
      Object.assign(outputOptions, {
        format,
        dir: PATH_AND_URL_CONVERTER.asFilePath(rootDirectoryUrl),
        sourcemap: sourcemaps === "file" || sourcemaps === "inline",
        // sourcemapFile,
        sourcemapPathTransform: (relativePath) => {
          return new URL(relativePath, rootDirectoryUrl).href;
        },
        entryFileNames: () => {
          return `[name].js`;
        },
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.isEntry) {
            const originalFileUrl = getOriginalUrl(chunkInfo, true);
            const jsModuleUrlInfo = jsModuleUrlInfos.find(
              (candidate) => candidate.url === originalFileUrl,
            );
            if (jsModuleUrlInfo && jsModuleUrlInfo.filenameHint) {
              return jsModuleUrlInfo.filenameHint;
            }
          }
          if (chunkInfo.isDynamicEntry) {
            const originalFileUrl = getOriginalUrl(chunkInfo, true);
            const urlInfo =
              jsModuleUrlInfos[0].context.kitchen.graph.getUrlInfo(
                originalFileUrl,
              );
            if (urlInfo && urlInfo.filenameHint) {
              return urlInfo.filenameHint;
            }
          }
          return `${chunkInfo.name}.js`;
        },
      });
    },
    // https://rollupjs.org/guide/en/#resolvedynamicimport
    resolveDynamicImport: (specifier, importer) => {
      if (typeof specifier !== "string") {
        // Receiving an ASTNode (specifier is dynamic)
        return null;
      }
      if (preserveDynamicImports) {
        if (isFileSystemPath$1(importer)) {
          importer = PATH_AND_URL_CONVERTER.asFileUrl(importer);
        }
        const urlObject = resolveImport(specifier, importer);
        if (!urlObject.href.startsWith("file:")) {
          return { id: specifier, external: true };
        }
        const searchParamsToAdd =
          augmentDynamicImportUrlSearchParams(urlObject);
        if (searchParamsToAdd) {
          injectQueryParams(urlObject, searchParamsToAdd);
        }
        const id = urlObject.href;
        return { id, external: true };
      }
      if (isolateDynamicImports) {
        if (isFileSystemPath$1(importer)) {
          importer = PATH_AND_URL_CONVERTER.asFileUrl(importer);
        }
        const urlObject = resolveImport(specifier, importer);
        if (!urlObject.href.startsWith("file:")) {
          return { id: specifier, external: true };
        }
        const importId = assignDynamicImportId(urlObject.href);
        injectQueryParams(urlObject, {
          dynamic_import_id: importId,
        });
        const url = urlObject.href;
        const filePath = PATH_AND_URL_CONVERTER.asFilePath(url);
        return { id: filePath };
      }
      return null;
    },
    resolveId: (specifier, importer = rootDirectoryUrl) => {
      if (isFileSystemPath$1(importer)) {
        importer = PATH_AND_URL_CONVERTER.asFileUrl(importer);
      }
      const resolvedUrlObject = resolveImport(specifier, importer);
      const resolvedUrl = resolvedUrlObject.href;
      if (!resolvedUrl.startsWith("file:")) {
        return {
          id: resolvedUrl,
          external: true,
          moduleSideEffects: getModuleSideEffects(resolvedUrl, importer),
        };
      }
      if (!importCanBeBundled(resolvedUrl)) {
        return {
          id: resolvedUrl,
          external: true,
          moduleSideEffects: getModuleSideEffects(resolvedUrl, importer),
        };
      }
      if (resolvedUrl.startsWith("ignore:")) {
        return {
          id: resolvedUrl,
          external: true,
          moduleSideEffects: getModuleSideEffects(resolvedUrl, importer),
        };
      }
      if (importer.includes("dynamic_import_id")) {
        const importerUrlObject = new URL(importer);
        const dynamicImportId =
          importerUrlObject.searchParams.get("dynamic_import_id");
        if (dynamicImportId) {
          injectQueryParams(resolvedUrlObject, {
            dynamic_import_id: dynamicImportId,
          });
          const isolatedResolvedUrl = resolvedUrlObject.href;
          return {
            id: PATH_AND_URL_CONVERTER.asFilePath(isolatedResolvedUrl),
            external: false,
            moduleSideEffects: getModuleSideEffects(resolvedUrl, importer),
          };
        }
      }
      const urlInfo = graph.getUrlInfo(resolvedUrl);
      if (urlInfo.type === "entry_build") {
        return {
          id: resolvedUrl,
          external: true,
          moduleSideEffects: getModuleSideEffects(resolvedUrl, importer),
        };
      }
      return {
        id: PATH_AND_URL_CONVERTER.asFilePath(resolvedUrl),
        external: false,
        moduleSideEffects: getModuleSideEffects(resolvedUrl, importer),
      };
    },
    async load(rollupId) {
      const fileUrl = PATH_AND_URL_CONVERTER.asFileUrl(rollupId, true);
      const urlInfo = graph.getUrlInfo(fileUrl);
      return {
        code: urlInfo.content,
        map:
          (sourcemaps === "file" || sourcemaps === "inline") &&
          urlInfo.sourcemap
            ? sourcemapConverter.toFilePaths(urlInfo.sourcemap)
            : null,
      };
    },
  };
};

const applyRollupPlugins = async ({
  rollup,
  rollupPlugins,
  rollupInput,
  rollupOutput,
}) => {
  if (!rollup) {
    const rollupModule = await import("rollup");
    rollup = rollupModule.rollup;
  }

  const rollupReturnValue = await rollup({
    ...rollupInput,
    treeshake: {
      ...rollupInput.treeshake,
    },
    plugins: rollupPlugins,
  });
  const rollupOutputArray = await rollupReturnValue.generate(rollupOutput);
  return rollupOutputArray;
};

const filenameWithoutExtension = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return filename;
  }
  return filename.slice(0, dotLastIndex);
};

// Do not use until https://github.com/parcel-bundler/parcel-css/issues/181
const bundleCss = async (cssUrlInfos) => {
  const bundledCssUrlInfos = {};
  const { bundleAsync } = await import("lightningcss");
  const targets = runtimeCompatToTargets$2(cssUrlInfos[0].context.runtimeCompat);
  for (const cssUrlInfo of cssUrlInfos) {
    const filename = fileUrlConverter.asFilePath(cssUrlInfo.originalUrl);
    const { code, map } = await bundleAsync({
      filename,
      targets,
      minify: false,
      resolver: {
        read: (specifier) => {
          const fileUrlObject = fileUrlConverter.asFileUrl(specifier);
          const fileUrl = String(fileUrlObject);
          const urlInfo = cssUrlInfo.graph.getUrlInfo(fileUrl);
          return urlInfo.content;
        },
        resolve(specifier, from) {
          const fileUrlObject = new URL(specifier, pathToFileURL(from));
          const filePath = urlToFileSystemPath(fileUrlObject);
          return filePath;
        },
      },
    });
    bundledCssUrlInfos[cssUrlInfo.url] = {
      data: {
        bundlerName: "lightningcss",
      },
      contentType: "text/css",
      content: String(code),
      sourcemap: map,
    };
  }
  return bundledCssUrlInfos;
};

const runtimeCompatToTargets$2 = (runtimeCompat) => {
  const targets = {};
  ["chrome", "firefox", "ie", "opera", "safari"].forEach((runtimeName) => {
    const version = runtimeCompat[runtimeName];
    if (version) {
      targets[runtimeName] = versionToBits$2(version);
    }
  });
  return targets;
};

const versionToBits$2 = (version) => {
  const [major, minor = 0, patch = 0] = version
    .split("-")[0]
    .split(".")
    .map((v) => parseInt(v, 10));
  return (major << 16) | (minor << 8) | patch;
};

const jsenvPluginBundling = ({
  css = {},
  js_classic = {},
  js_module = {},
} = {}) => {
  const bundle = {};

  if (css) {
    bundle.css = (cssUrlInfos) => {
      return bundleCss(cssUrlInfos);
    };
  }
  if (js_module) {
    if (js_module === true) {
      js_module = {};
    }
    bundle.js_module = (jsModuleUrlInfos) => {
      return bundleJsModules(jsModuleUrlInfos, js_module);
    };
  }

  return {
    name: "jsenv:bundling",
    appliesDuring: "build",
    bundle,
  };
};

const minifyCss = async (cssUrlInfo) => {
  const { transform } = await import("lightningcss");

  const targets = runtimeCompatToTargets$1(cssUrlInfo.context.runtimeCompat);
  const { code, map } = transform({
    filename: urlToFileSystemPath(cssUrlInfo.originalUrl),
    code: Buffer.from(cssUrlInfo.content),
    targets,
    minify: true,
  });
  return {
    content: String(code),
    sourcemap: map,
  };
};

const runtimeCompatToTargets$1 = (runtimeCompat) => {
  const targets = {};
  ["chrome", "firefox", "ie", "opera", "safari"].forEach((runtimeName) => {
    const version = runtimeCompat[runtimeName];
    if (version) {
      targets[runtimeName] = versionToBits$1(version);
    }
  });
  return targets;
};

const versionToBits$1 = (version) => {
  const [major, minor = 0, patch = 0] = version
    .split("-")[0]
    .split(".")
    .map((v) => parseInt(v, 10));
  return (major << 16) | (minor << 8) | patch;
};

// https://github.com/kangax/html-minifier#options-quick-reference
const minifyHtml = (htmlUrlInfo, options = {}) => {
  const require = createRequire(import.meta.url);
  const { minify } = require("html-minifier");

  const {
    // usually HTML will contain a few markup, it's better to keep white spaces
    // and line breaks to favor readability. A few white spaces means very few
    // octets that won't impact performances. Removing whitespaces however will certainly
    // decrease HTML readability
    collapseWhitespace = false,
    // saving a fewline breaks won't hurt performances
    // but will help a lot readability
    preserveLineBreaks = true,
    removeComments = true,
    conservativeCollapse = false,
  } = options;

  const htmlMinified = minify(htmlUrlInfo.content, {
    collapseWhitespace,
    conservativeCollapse,
    removeComments,
    preserveLineBreaks,
  });
  return htmlMinified;
};

// https://github.com/terser-js/terser#minify-options

const minifyJs = async (jsUrlInfo, options) => {
  const url = jsUrlInfo.url;
  const content = jsUrlInfo.content;
  const sourcemap = jsUrlInfo.sourcemap;
  const isJsModule = jsUrlInfo.type === "js_module";

  const { minify } = await import("terser");
  const terserResult = await minify(
    {
      [url]: content,
    },
    {
      sourceMap: {
        ...(sourcemap ? { content: JSON.stringify(sourcemap) } : {}),
        asObject: true,
        includeSources: true,
      },
      module: isJsModule,
      // We need to preserve "new __InlineContent__()" calls to be able to recognize them
      // after minification in order to version urls inside inline content text
      keep_fnames: /__InlineContent__/,
      ...options,
    },
  );
  return {
    content: terserResult.code,
    sourcemap: terserResult.map,
  };
};

const minifyJson = (jsonUrlInfo) => {
  const { content } = jsonUrlInfo;
  if (content.startsWith("{\n")) {
    const jsonWithoutWhitespaces = JSON.stringify(JSON.parse(content));
    return jsonWithoutWhitespaces;
  }
  return null;
};

const jsenvPluginMinification = ({
  html = {},
  css = {},
  js_classic = {},
  js_module = {},
  json = {},
  svg = {},
} = {}) => {
  const htmlMinifier = html
    ? (urlInfo) => minifyHtml(urlInfo, html === true ? {} : html)
    : null;
  const svgMinifier = svg
    ? (urlInfo) => minifyHtml(urlInfo, svg === true ? {} : svg)
    : null;
  const cssMinifier = css
    ? (urlInfo) => minifyCss(urlInfo)
    : null;
  const jsClassicMinifier = js_classic
    ? (urlInfo) => minifyJs(urlInfo, js_classic === true ? {} : js_classic)
    : null;
  const jsModuleMinifier = js_module
    ? (urlInfo) => minifyJs(urlInfo, js_module === true ? {} : js_module)
    : null;
  const jsonMinifier = json
    ? (urlInfo) => minifyJson(urlInfo)
    : null;

  return {
    name: "jsenv:minification",
    appliesDuring: "build",
    meta: {
      willMinifyHtml: Boolean(html),
      willMinifySvg: Boolean(svg),
      willMinifyCss: Boolean(css),
      willMinifyJsClassic: Boolean(js_classic),
      willMinifyJsModule: Boolean(js_module),
      willMinifyJson: Boolean(json),
    },
    optimizeUrlContent: {
      html: htmlMinifier,
      svg: svgMinifier,
      css: cssMinifier,
      js_classic: jsClassicMinifier,
      js_module: jsModuleMinifier,
      json: jsonMinifier,
      importmap: jsonMinifier,
      webmanifest: jsonMinifier,
    },
  };
};

const jsenvPluginImportMetaResolve = ({ needJsModuleFallback }) => {
  return {
    name: "jsenv:import_meta_resolve",
    appliesDuring: "*",
    init: (context) => {
      if (context.isSupportedOnCurrentClients("import_meta_resolve")) {
        return false;
      }
      if (needJsModuleFallback(context)) {
        // will be handled by systemjs, keep it untouched
        return false;
      }
      return true;
    },
    transformUrlContent: {
      js_module: async (urlInfo) => {
        const jsUrls = parseJsUrls({
          js: urlInfo.content,
          url: urlInfo.url,
          isJsModule: true,
        });
        const magicSource = createMagicSource(urlInfo.content);
        for (const jsUrl of jsUrls) {
          if (jsUrl.subtype !== "import_meta_resolve") {
            continue;
          }
          const { node } = jsUrl.astInfo;
          let reference;
          for (const referenceToOther of urlInfo.referenceToOthersSet) {
            if (
              referenceToOther.generatedSpecifier.slice(1, -1) ===
              jsUrl.specifier
            ) {
              reference = referenceToOther;
              break;
            }
          }
          magicSource.replace({
            start: node.start,
            end: node.end,
            replacement: `new URL(${reference.generatedSpecifier}, import.meta.url).href`,
          });
        }
        return magicSource.toContentAndSourcemap();
      },
    },
  };
};

/*
 * - propagate "?js_module_fallback" query string param on urls
 * - perform conversion from js module to js classic when url uses "?js_module_fallback"
 */


const systemJsClientFileUrl = injectQueryParams(systemJsClientFileUrlDefault, {
  as_js_classic: undefined,
});

const jsenvPluginJsModuleConversion = ({ remapImportSpecifier }) => {
  const isReferencingJsModule = (reference) => {
    if (
      reference.type === "js_import" ||
      reference.subtype === "system_register_arg" ||
      reference.subtype === "system_import_arg"
    ) {
      return true;
    }
    if (reference.type === "js_url" && reference.expectedType === "js_module") {
      return true;
    }
    return false;
  };

  const shouldPropagateJsModuleConversion = (reference) => {
    if (isReferencingJsModule(reference)) {
      const insideJsClassic =
        reference.ownerUrlInfo.searchParams.has("js_module_fallback");
      return insideJsClassic;
    }
    return false;
  };

  const markAsJsClassicProxy = (reference) => {
    reference.expectedType = "js_classic";
    if (!reference.filenameHint) {
      reference.filenameHint = generateJsClassicFilename(reference.url);
    }
  };

  const turnIntoJsClassicProxy = (reference) => {
    markAsJsClassicProxy(reference);
    return injectQueryParams(reference.url, {
      js_module_fallback: "",
    });
  };

  return {
    name: "jsenv:js_module_conversion",
    appliesDuring: "*",
    redirectReference: (reference) => {
      if (reference.searchParams.has("js_module_fallback")) {
        markAsJsClassicProxy(reference);
        return null;
      }
      // when search param is injected, it will be removed later
      // by "getWithoutSearchParam". We don't want to redirect again
      // (would create infinite recursion)
      if (
        reference.prev &&
        reference.prev.searchParams.has(`js_module_fallback`)
      ) {
        return null;
      }
      // We want to propagate transformation of js module to js classic to:
      // - import specifier (static/dynamic import + re-export)
      // - url specifier when inside System.register/_context.import()
      //   (because it's the transpiled equivalent of static and dynamic imports)
      // And not other references otherwise we could try to transform inline resources
      // or specifiers inside new URL()...
      if (shouldPropagateJsModuleConversion(reference)) {
        return turnIntoJsClassicProxy(reference);
      }
      return null;
    },
    fetchUrlContent: async (urlInfo) => {
      const jsModuleUrlInfo = urlInfo.getWithoutSearchParam(
        "js_module_fallback",
        {
          // override the expectedType to "js_module"
          // because when there is ?js_module_fallback it means the underlying resource
          // is a js_module
          expectedType: "js_module",
        },
      );
      if (!jsModuleUrlInfo) {
        return null;
      }
      await jsModuleUrlInfo.cook();
      let outputFormat;
      if (urlInfo.isEntryPoint && !jsModuleUrlInfo.data.usesImport) {
        // if it's an entry point without dependency (it does not use import)
        // then we can use UMD
        outputFormat = "umd";
      } else {
        // otherwise we have to use system in case it's imported
        // by an other file (for entry points)
        // or to be able to import when it uses import
        outputFormat = "system";
        urlInfo.type = "js_classic";
        urlInfo.dependencies.foundSideEffectFile({
          sideEffectFileUrl: systemJsClientFileUrl,
          expectedType: "js_classic",
          line: 0,
          column: 0,
        });
      }
      const { content, sourcemap } = await convertJsModuleToJsClassic({
        rootDirectoryUrl: urlInfo.context.rootDirectoryUrl,
        input: jsModuleUrlInfo.content,
        inputIsEntryPoint: urlInfo.isEntryPoint,
        inputSourcemap: jsModuleUrlInfo.sourcemap,
        inputUrl: jsModuleUrlInfo.url,
        outputUrl: urlInfo.url,
        outputFormat,
        remapImportSpecifier,
      });
      return {
        content,
        contentType: "text/javascript",
        type: "js_classic",
        originalUrl: jsModuleUrlInfo.originalUrl,
        originalContent: jsModuleUrlInfo.originalContent,
        sourcemap,
        data: jsModuleUrlInfo.data,
      };
    },
  };
};

const generateJsClassicFilename = (url) => {
  const filename = urlToFilename$1(url);
  let [basename, extension] = splitFileExtension$1(filename);
  const { searchParams } = new URL(url);
  if (
    searchParams.has("as_json_module") ||
    searchParams.has("as_css_module") ||
    searchParams.has("as_text_module")
  ) {
    basename += extension;
    extension = ".js";
  }
  return `${basename}.nomodule${extension}`;
};

const splitFileExtension$1 = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return [filename, ""];
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};

/*
 * when <script type="module"> cannot be used:
 * - ?js_module_fallback is injected into the src of <script type="module">
 * - js inside <script type="module"> is transformed into classic js
 * - <link rel="modulepreload"> are converted to <link rel="preload">
 */


const jsenvPluginJsModuleFallbackInsideHtml = ({
  needJsModuleFallback,
}) => {
  const turnIntoJsClassicProxy = (reference) => {
    return injectQueryParams(reference.url, { js_module_fallback: "" });
  };

  return {
    name: "jsenv:js_module_fallback_inside_html",
    appliesDuring: "*",
    init: needJsModuleFallback,
    redirectReference: {
      link_href: (reference) => {
        if (
          reference.prev &&
          reference.prev.searchParams.has(`js_module_fallback`)
        ) {
          return null;
        }
        if (reference.subtype === "modulepreload") {
          return turnIntoJsClassicProxy(reference);
        }
        if (
          reference.subtype === "preload" &&
          reference.expectedType === "js_module"
        ) {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
      script: (reference) => {
        if (
          reference.prev &&
          reference.prev.searchParams.has(`js_module_fallback`)
        ) {
          return null;
        }
        if (reference.expectedType === "js_module") {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
      js_url: (reference) => {
        if (
          reference.prev &&
          reference.prev.searchParams.has(`js_module_fallback`)
        ) {
          return null;
        }
        if (reference.expectedType === "js_module") {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
    },
    finalizeUrlContent: {
      html: async (urlInfo) => {
        const htmlAst = parseHtml({ html: urlInfo.content, url: urlInfo.url });
        const mutations = [];
        visitHtmlNodes(htmlAst, {
          link: (node) => {
            const rel = getHtmlNodeAttribute(node, "rel");
            if (rel !== "modulepreload" && rel !== "preload") {
              return;
            }
            const href = getHtmlNodeAttribute(node, "href");
            if (!href) {
              return;
            }
            let linkHintReference = null;
            for (const referenceToOther of urlInfo.referenceToOthersSet) {
              if (
                referenceToOther.generatedSpecifier === href &&
                referenceToOther.type === "link_href" &&
                referenceToOther.subtype === rel
              ) {
                linkHintReference = referenceToOther;
                break;
              }
            }
            if (rel === "modulepreload") {
              if (linkHintReference.expectedType === "js_classic") {
                mutations.push(() => {
                  setHtmlNodeAttributes(node, {
                    rel: "preload",
                    as: "script",
                    crossorigin: undefined,
                  });
                });
              }
            }
            if (
              rel === "preload" &&
              wasConvertedFromJsModule(linkHintReference)
            ) {
              mutations.push(() => {
                setHtmlNodeAttributes(node, { crossorigin: undefined });
              });
            }
          },
          script: (node) => {
            const { type } = analyzeScriptNode(node);
            if (type !== "js_module") {
              return;
            }
            const src = getHtmlNodeAttribute(node, "src");
            const text = getHtmlNodeText(node);
            let scriptReference = null;
            for (const referenceToOther of urlInfo.referenceToOthersSet) {
              if (referenceToOther.type !== "script") {
                continue;
              }
              if (src && referenceToOther.generatedSpecifier === src) {
                scriptReference = referenceToOther;
                break;
              }
              if (text) {
                if (referenceToOther.content === text) {
                  scriptReference = referenceToOther;
                  break;
                }
                if (referenceToOther.urlInfo.content === text) {
                  scriptReference = referenceToOther;
                  break;
                }
              }
            }
            if (!wasConvertedFromJsModule(scriptReference)) {
              return;
            }
            mutations.push(() => {
              setHtmlNodeAttributes(node, { type: undefined });
            });
          },
        });
        await Promise.all(mutations.map((mutation) => mutation()));
        return stringifyHtmlAst(htmlAst, {
          cleanupPositionAttributes: urlInfo.context.dev,
        });
      },
    },
  };
};

const wasConvertedFromJsModule = (reference) => {
  if (reference.expectedType === "js_classic") {
    // check if a prev version was using js module
    if (reference.original) {
      if (reference.original.expectedType === "js_module") {
        return true;
      }
    }
  }
  return false;
};

/*
 * when {type: "module"} cannot be used on web workers:
 * - new Worker("worker.js", { type: "module" })
 *   transformed into
 *   new Worker("worker.js?js_module_fallback", { type: " lassic" })
 * - navigator.serviceWorker.register("service_worker.js", { type: "module" })
 *   transformed into
 *   navigator.serviceWorker.register("service_worker.js?js_module_fallback", { type: "classic" })
 * - new SharedWorker("shared_worker.js", { type: "module" })
 *   transformed into
 *   new SharedWorker("shared_worker.js?js_module_fallback", { type: "classic" })
 */


const jsenvPluginJsModuleFallbackOnWorkers = () => {
  const turnIntoJsClassicProxy = (reference) => {
    reference.mutation = (magicSource) => {
      const { typePropertyNode } = reference.astInfo;
      magicSource.replace({
        start: typePropertyNode.value.start,
        end: typePropertyNode.value.end,
        replacement: JSON.stringify("classic"),
      });
    };
    return injectQueryParams(reference.url, { js_module_fallback: "" });
  };

  const createWorkerPlugin = (subtype) => {
    return {
      name: `jsenv:js_module_fallback_on_${subtype}`,
      appliesDuring: "*",
      init: (context) => {
        if (Object.keys(context.runtimeCompat).toString() === "node") {
          return false;
        }
        if (context.isSupportedOnCurrentClients(`${subtype}_type_module`)) {
          return false;
        }

        return true;
      },
      redirectReference: {
        js_url: (reference) => {
          if (reference.expectedType !== "js_module") {
            return null;
          }
          if (reference.expectedSubtype !== subtype) {
            return null;
          }
          return turnIntoJsClassicProxy(reference);
        },
      },
    };
  };

  return [
    createWorkerPlugin("worker"),
    createWorkerPlugin("service_worker"),
    createWorkerPlugin("shared_worker"),
  ];
};

const require = createRequire(import.meta.url);

const jsenvPluginTopLevelAwait = ({ needJsModuleFallback }) => {
  return {
    name: "jsenv:top_level_await",
    appliesDuring: "*",
    init: (context) => {
      if (context.isSupportedOnCurrentClients("top_level_await")) {
        return false;
      }
      if (needJsModuleFallback(context)) {
        // will be handled by systemjs, keep it untouched
        return false;
      }
      return true;
    },
    transformUrlContent: {
      js_module: async (urlInfo) => {
        const usesTLA = await usesTopLevelAwait(urlInfo);
        if (!usesTLA) {
          return null;
        }
        const { code, map } = await applyBabelPlugins({
          babelPlugins: [
            [
              require("babel-plugin-transform-async-to-promises"),
              {
                // Maybe we could pass target: "es6" when we support arrow function
                // https://github.com/rpetrich/babel-plugin-transform-async-to-promises/blob/92755ff8c943c97596523e586b5fa515c2e99326/async-to-promises.ts#L55
                topLevelAwait: "simple",
                // enable once https://github.com/rpetrich/babel-plugin-transform-async-to-promises/pull/83
                // externalHelpers: true,
                // externalHelpersPath: JSON.parse(
                //   context.referenceUtils.inject({
                //     type: "js_import",
                //     expectedType: "js_module",
                //     specifier:
                //       "babel-plugin-transform-async-to-promises/helpers.mjs",
                //   })[0],
                // ),
              },
            ],
          ],
          input: urlInfo.content,
          inputIsJsModule: true,
          inputUrl: urlInfo.originalUrl,
          outputUrl: urlInfo.generatedUrl,
        });
        return {
          content: code,
          sourcemap: map,
        };
      },
    },
  };
};

const usesTopLevelAwait = async (urlInfo) => {
  if (!urlInfo.content.includes("await ")) {
    return false;
  }
  const { metadata } = await applyBabelPlugins({
    babelPlugins: [babelPluginMetadataUsesTopLevelAwait],
    input: urlInfo.content,
    inputIsJsModule: true,
    inputUrl: urlInfo.originalUrl,
    outputUrl: urlInfo.generatedUrl,
  });
  return metadata.usesTopLevelAwait;
};

const babelPluginMetadataUsesTopLevelAwait = () => {
  return {
    name: "metadata-uses-top-level-await",
    visitor: {
      Program: (programPath, state) => {
        let usesTopLevelAwait = false;
        programPath.traverse({
          AwaitExpression: (path) => {
            const closestFunction = path.getFunctionParent();
            if (!closestFunction || closestFunction.type === "Program") {
              usesTopLevelAwait = true;
              path.stop();
            }
          },
        });
        state.file.metadata.usesTopLevelAwait = usesTopLevelAwait;
      },
    },
  };
};

const jsenvPluginJsModuleFallback = ({ remapImportSpecifier } = {}) => {
  const needJsModuleFallback = (context) => {
    if (Object.keys(context.clientRuntimeCompat).includes("node")) {
      return false;
    }
    if (
      context.versioning &&
      context.versioningViaImportmap &&
      !context.isSupportedOnCurrentClients("importmap")
    ) {
      return true;
    }
    if (
      !context.isSupportedOnCurrentClients("script_type_module") ||
      !context.isSupportedOnCurrentClients("import_dynamic") ||
      !context.isSupportedOnCurrentClients("import_meta")
    ) {
      return true;
    }
    return false;
  };

  return [
    jsenvPluginJsModuleFallbackInsideHtml({ needJsModuleFallback }),
    jsenvPluginJsModuleFallbackOnWorkers(),
    jsenvPluginJsModuleConversion({ remapImportSpecifier }),
    // must come after jsModuleFallback because it's related to the module format
    // so we want to want to know the module format before transforming things
    // - top level await
    // - import.meta.resolve()
    jsenvPluginImportMetaResolve({ needJsModuleFallback }),
    jsenvPluginTopLevelAwait({ needJsModuleFallback }),
  ];
};

const convertJsClassicToJsModule = async ({
  isWebWorker,
  input,
  inputSourcemap,
  inputUrl,
  outputUrl,
}) => {
  const { code, map } = await applyBabelPlugins({
    babelPlugins: [[babelPluginReplaceTopLevelThis, { isWebWorker }]],
    input,
    inputIsJsModule: false,
    inputUrl,
    outputUrl,
  });
  const sourcemap = await composeTwoSourcemaps(inputSourcemap, map);
  return {
    content: code,
    sourcemap,
  };
};

const babelPluginReplaceTopLevelThis = () => {
  return {
    name: "replace-top-level-this",
    visitor: {
      Program: (programPath, state) => {
        const { isWebWorker } = state.opts;
        programPath.traverse({
          ThisExpression: (path) => {
            const closestFunction = path.getFunctionParent();
            if (!closestFunction) {
              path.replaceWithSourceString(isWebWorker ? "self" : "window");
            }
          },
        });
      },
    },
  };
};

/*
 * Js modules might not be able to import js meant to be loaded by <script>
 * Among other things this happens for a top level this:
 * - With <script> this is window
 * - With an import this is undefined
 * Example of this: https://github.com/video-dev/hls.js/issues/2911
 *
 * This plugin fix this issue by rewriting top level this into window
 * and can be used like this for instance import("hls?as_js_module")
 */


const jsenvPluginAsJsModule = () => {
  const markAsJsModuleProxy = (reference) => {
    reference.expectedType = "js_module";
    if (!reference.filenameHint) {
      const filename = urlToFilename$1(reference.url);
      const [basename] = splitFileExtension(filename);
      reference.filenameHint = `${basename}.mjs`;
    }
  };

  return {
    name: "jsenv:as_js_module",
    appliesDuring: "*",
    redirectReference: (reference) => {
      if (reference.searchParams.has("as_js_module")) {
        markAsJsModuleProxy(reference);
      }
    },
    fetchUrlContent: async (urlInfo) => {
      const jsClassicUrlInfo = urlInfo.getWithoutSearchParam("as_js_module", {
        // override the expectedType to "js_classic"
        // because when there is ?as_js_module it means the underlying resource
        // is js_classic
        expectedType: "js_classic",
      });
      if (!jsClassicUrlInfo) {
        return null;
      }
      await jsClassicUrlInfo.cook();
      const { content, sourcemap } = await convertJsClassicToJsModule({
        input: jsClassicUrlInfo.content,
        inputSourcemap: jsClassicUrlInfo.sourcemap,
        inputUrl: jsClassicUrlInfo.url,
        outputUrl: jsClassicUrlInfo.generatedUrl,
        isWebWorker: isWebWorkerUrlInfo(urlInfo),
      });
      return {
        content,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: jsClassicUrlInfo.originalUrl,
        originalContent: jsClassicUrlInfo.originalContent,
        sourcemap,
        data: jsClassicUrlInfo.data,
      };
    },
  };
};

const isWebWorkerUrlInfo = (urlInfo) => {
  return (
    urlInfo.subtype === "worker" ||
    urlInfo.subtype === "service_worker" ||
    urlInfo.subtype === "shared_worker"
  );
};

const splitFileExtension = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return [filename, ""];
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};

/*
 * Generated helpers
 * - https://github.com/babel/babel/commits/main/packages/babel-helpers/src/helpers.ts
 * File helpers
 * - https://github.com/babel/babel/tree/main/packages/babel-helpers/src/helpers
 *
 */
const babelHelperClientDirectoryUrl = new URL(
  "./babel_helpers/",
  import.meta.url,
).href;

// we cannot use "@jsenv/core/src/*" because babel helper might be injected
// into node_modules not depending on "@jsenv/core"
const getBabelHelperFileUrl = (babelHelperName) => {
  const babelHelperFileUrl = new URL(
    `./${babelHelperName}/${babelHelperName}.js`,
    babelHelperClientDirectoryUrl,
  ).href;
  return babelHelperFileUrl;
};

const babelHelperNameFromUrl = (url) => {
  if (!url.startsWith(babelHelperClientDirectoryUrl)) {
    return null;
  }
  const afterBabelHelperDirectory = url.slice(
    babelHelperClientDirectoryUrl.length,
  );
  const babelHelperName = afterBabelHelperDirectory.slice(
    0,
    afterBabelHelperDirectory.indexOf("/"),
  );
  return babelHelperName;
};

// named import approach found here:
// https://github.com/rollup/rollup-plugin-babel/blob/18e4232a450f320f44c651aa8c495f21c74d59ac/src/helperPlugin.js#L1

// for reference this is how it's done to reference
// a global babel helper object instead of using
// a named import
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-plugin-external-helpers/src/index.js

const babelPluginBabelHelpersAsJsenvImports = (
  babel,
  { getImportSpecifier },
) => {
  return {
    name: "babel-helper-as-jsenv-import",
    pre: (file) => {
      const cachedHelpers = {};
      file.set("helperGenerator", (name) => {
        // the list of possible helpers name
        // https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13
        if (!file.availableHelper(name)) {
          return undefined;
        }
        if (cachedHelpers[name]) {
          return cachedHelpers[name];
        }
        const filePath = file.opts.filename;
        const fileUrl = pathToFileURL(filePath).href;
        if (babelHelperNameFromUrl(fileUrl) === name) {
          return undefined;
        }
        const babelHelperImportSpecifier = getBabelHelperFileUrl(name);
        const helper = injectJsImport({
          programPath: file.path,
          from: getImportSpecifier(babelHelperImportSpecifier),
          nameHint: `_${name}`,
          // disable interop, useless as we work only with js modules
          importedType: "es6",
          // importedInterop: "uncompiled",
        });
        cachedHelpers[name] = helper;
        return helper;
      });
    },
  };
};

// copied from
// https://github.com/babel/babel/blob/e498bee10f0123bb208baa228ce6417542a2c3c4/packages/babel-compat-data/data/plugins.json#L1
// https://github.com/babel/babel/blob/master/packages/babel-compat-data/data/plugins.json#L1
// Because this is an hidden implementation detail of @babel/preset-env
// it could be deprecated or moved anytime.
// For that reason it makes more sens to have it inlined here
// than importing it from an undocumented location.
// Ideally it would be documented or a separate module

const babelPluginCompatMap = {
  "transform-numeric-separator": {
    chrome: "75",
    opera: "62",
    edge: "79",
    firefox: "70",
    safari: "13",
    node: "12.5",
    ios: "13",
    samsung: "11",
    electron: "6",
  },
  "proposal-class-properties": {
    chrome: "74",
    opera: "61",
    edge: "79",
    node: "12",
    electron: "6.1",
  },
  "proposal-private-methods": {
    chrome: "84",
    opera: "71",
  },
  "proposal-nullish-coalescing-operator": {
    chrome: "80",
    opera: "67",
    edge: "80",
    firefox: "72",
    safari: "13.1",
    node: "14",
    electron: "8.1",
  },
  "transform-optional-chaining": {
    chrome: "80",
    opera: "67",
    edge: "80",
    firefox: "74",
    safari: "13.1",
    node: "14",
    electron: "8.1",
  },
  "transform-json-strings": {
    chrome: "66",
    opera: "53",
    edge: "79",
    firefox: "62",
    safari: "12",
    node: "10",
    ios: "12",
    samsung: "9",
    electron: "3",
  },
  "transform-optional-catch-binding": {
    chrome: "66",
    opera: "53",
    edge: "79",
    firefox: "58",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    electron: "3",
  },
  "proposal-decorators": {},
  "transform-parameters": {
    chrome: "49",
    opera: "36",
    edge: "18",
    firefox: "53",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "0.37",
  },
  "proposal-async-generator-functions": {
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
  "transform-object-rest-spread": {
    chrome: "60",
    opera: "47",
    edge: "79",
    firefox: "55",
    safari: "11.1",
    node: "8.3",
    ios: "11.3",
    samsung: "8",
    electron: "2",
  },
  "transform-dotall-regex": {
    chrome: "62",
    opera: "49",
    edge: "79",
    firefox: "78",
    safari: "11.1",
    node: "8.10",
    ios: "11.3",
    samsung: "8",
    electron: "3",
  },
  "transform-unicode-property-regex": {
    chrome: "64",
    opera: "51",
    edge: "79",
    firefox: "78",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    electron: "3",
  },
  "transform-named-capturing-groups-regex": {
    chrome: "64",
    opera: "51",
    edge: "79",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    electron: "3",
  },
  "transform-async-to-generator": {
    chrome: "55",
    opera: "42",
    edge: "15",
    firefox: "52",
    safari: "11",
    node: "7.6",
    ios: "11",
    samsung: "6",
    electron: "1.6",
  },
  "transform-exponentiation-operator": {
    chrome: "52",
    opera: "39",
    edge: "14",
    firefox: "52",
    safari: "10.1",
    node: "7",
    ios: "10.3",
    samsung: "6",
    electron: "1.3",
  },
  "transform-template-literals": {
    chrome: "41",
    opera: "28",
    edge: "13",
    electron: "0.22",
    firefox: "34",
    safari: "13",
    node: "4",
    ios: "13",
    samsung: "3.4",
  },
  "transform-literals": {
    chrome: "44",
    opera: "31",
    edge: "12",
    firefox: "53",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    electron: "0.30",
  },
  "transform-function-name": {
    chrome: "51",
    opera: "38",
    edge: "79",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    electron: "1.2",
  },
  "transform-arrow-functions": {
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
  "transform-block-scoped-functions": {
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
  "transform-classes": {
    chrome: "46",
    opera: "33",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36",
  },
  "transform-object-super": {
    chrome: "46",
    opera: "33",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36",
  },
  "transform-shorthand-properties": {
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
  "transform-duplicate-keys": {
    chrome: "42",
    opera: "29",
    edge: "12",
    firefox: "34",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "3.4",
    electron: "0.25",
  },
  "transform-computed-properties": {
    chrome: "44",
    opera: "31",
    edge: "12",
    firefox: "34",
    safari: "7.1",
    node: "4",
    ios: "8",
    samsung: "4",
    electron: "0.30",
  },
  "transform-for-of": {
    chrome: "51",
    opera: "38",
    edge: "15",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    electron: "1.2",
  },
  "transform-sticky-regex": {
    chrome: "49",
    opera: "36",
    edge: "13",
    firefox: "3",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "0.37",
  },
  "transform-unicode-escapes": {
    chrome: "44",
    opera: "31",
    edge: "12",
    firefox: "53",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    electron: "0.30",
  },
  "transform-unicode-regex": {
    chrome: "50",
    opera: "37",
    edge: "13",
    firefox: "46",
    safari: "12",
    node: "6",
    ios: "12",
    samsung: "5",
    electron: "1.1",
  },
  "transform-spread": {
    chrome: "46",
    opera: "33",
    edge: "13",
    firefox: "36",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36",
  },
  "transform-destructuring": {
    chrome: "51",
    opera: "38",
    edge: "15",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    electron: "1.2",
  },
  "transform-block-scoping": {
    chrome: "49",
    opera: "36",
    edge: "14",
    firefox: "51",
    safari: "11",
    node: "6",
    ios: "11",
    samsung: "5",
    electron: "0.37",
  },
  "transform-typeof-symbol": {
    chrome: "38",
    opera: "25",
    edge: "12",
    firefox: "36",
    safari: "9",
    node: "0.12",
    ios: "9",
    samsung: "3",
    electron: "0.20",
  },
  "transform-new-target": {
    chrome: "46",
    opera: "33",
    edge: "14",
    firefox: "41",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36",
  },
  "transform-regenerator": {
    chrome: "50",
    opera: "37",
    edge: "13",
    firefox: "53",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "1.1",
  },
  "transform-member-expression-literals": {
    chrome: "7",
    opera: "12",
    edge: "12",
    firefox: "2",
    safari: "5.1",
    node: "0.10",
    ie: "9",
    android: "4",
    ios: "6",
    phantom: "2",
    samsung: "1",
    electron: "0.20",
  },
  "transform-property-literals": {
    chrome: "7",
    opera: "12",
    edge: "12",
    firefox: "2",
    safari: "5.1",
    node: "0.10",
    ie: "9",
    android: "4",
    ios: "6",
    phantom: "2",
    samsung: "1",
    electron: "0.20",
  },
  "transform-reserved-words": {
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
};

// copy of transform-async-to-generator
// so that async is not transpiled when supported
babelPluginCompatMap["transform-async-to-promises"] =
  babelPluginCompatMap["transform-async-to-generator"];

babelPluginCompatMap["regenerator-transform"] =
  babelPluginCompatMap["transform-regenerator"];

const requireBabelPlugin = createRequire(import.meta.url);

const getBaseBabelPluginStructure = ({
  url,
  isSupported,
  // isJsModule,
  // getImportSpecifier,
}) => {
  const isBabelPluginNeeded = (babelPluginName) => {
    return !isSupported(babelPluginName, babelPluginCompatMap[babelPluginName]);
  };

  const babelPluginStructure = {};
  if (isBabelPluginNeeded("transform-numeric-separator")) {
    babelPluginStructure["transform-numeric-separator"] = requireBabelPlugin(
      "@babel/plugin-transform-numeric-separator",
    );
  }
  if (isBabelPluginNeeded("transform-json-strings")) {
    babelPluginStructure["transform-json-strings"] = requireBabelPlugin(
      "@babel/plugin-transform-json-strings",
    );
  }
  if (isBabelPluginNeeded("transform-object-rest-spread")) {
    babelPluginStructure["transform-object-rest-spread"] = requireBabelPlugin(
      "@babel/plugin-transform-object-rest-spread",
    );
  }
  if (isBabelPluginNeeded("transform-optional-catch-binding")) {
    babelPluginStructure["transform-optional-catch-binding"] =
      requireBabelPlugin("@babel/plugin-transform-optional-catch-binding");
  }
  if (isBabelPluginNeeded("transform-unicode-property-regex")) {
    babelPluginStructure["transform-unicode-property-regex"] =
      requireBabelPlugin("@babel/plugin-transform-unicode-property-regex");
  }
  // if (isBabelPluginNeeded("proposal-decorators") && content.includes("@")) {
  //   babelPluginStructure["proposal-decorators"] = [
  //     requireBabelPlugin("@babel/plugin-proposal-decorators"),
  //     {
  //       version: "2023-05",
  //     },
  //   ];
  // }
  if (isBabelPluginNeeded("transform-async-to-promises")) {
    babelPluginStructure["transform-async-to-promises"] = [
      requireBabelPlugin("babel-plugin-transform-async-to-promises"),
      {
        topLevelAwait: "ignore", // will be handled by "jsenv:top_level_await" plugin
        externalHelpers: false,
        // enable once https://github.com/rpetrich/babel-plugin-transform-async-to-promises/pull/83
        // externalHelpers: isJsModule,
        // externalHelpersPath: isJsModule ? getImportSpecifier(
        //     "babel-plugin-transform-async-to-promises/helpers.mjs",
        //   ) : null
      },
    ];
  }
  if (isBabelPluginNeeded("transform-arrow-functions")) {
    babelPluginStructure["transform-arrow-functions"] = requireBabelPlugin(
      "@babel/plugin-transform-arrow-functions",
    );
  }
  if (isBabelPluginNeeded("transform-block-scoped-functions")) {
    babelPluginStructure["transform-block-scoped-functions"] =
      requireBabelPlugin("@babel/plugin-transform-block-scoped-functions");
  }
  if (isBabelPluginNeeded("transform-block-scoping")) {
    babelPluginStructure["transform-block-scoping"] = requireBabelPlugin(
      "@babel/plugin-transform-block-scoping",
    );
  }
  if (isBabelPluginNeeded("transform-classes")) {
    babelPluginStructure["transform-classes"] = requireBabelPlugin(
      "@babel/plugin-transform-classes",
    );
  }
  if (isBabelPluginNeeded("transform-computed-properties")) {
    babelPluginStructure["transform-computed-properties"] = requireBabelPlugin(
      "@babel/plugin-transform-computed-properties",
    );
  }
  if (isBabelPluginNeeded("transform-destructuring")) {
    babelPluginStructure["transform-destructuring"] = requireBabelPlugin(
      "@babel/plugin-transform-destructuring",
    );
  }
  if (isBabelPluginNeeded("transform-dotall-regex")) {
    babelPluginStructure["transform-dotall-regex"] = requireBabelPlugin(
      "@babel/plugin-transform-dotall-regex",
    );
  }
  if (isBabelPluginNeeded("transform-duplicate-keys")) {
    babelPluginStructure["transform-duplicate-keys"] = requireBabelPlugin(
      "@babel/plugin-transform-duplicate-keys",
    );
  }
  if (isBabelPluginNeeded("transform-exponentiation-operator")) {
    babelPluginStructure["transform-exponentiation-operator"] =
      requireBabelPlugin("@babel/plugin-transform-exponentiation-operator");
  }
  if (isBabelPluginNeeded("transform-for-of")) {
    babelPluginStructure["transform-for-of"] = requireBabelPlugin(
      "@babel/plugin-transform-for-of",
    );
  }
  if (isBabelPluginNeeded("transform-function-name")) {
    babelPluginStructure["transform-function-name"] = requireBabelPlugin(
      "@babel/plugin-transform-function-name",
    );
  }
  if (isBabelPluginNeeded("transform-literals")) {
    babelPluginStructure["transform-literals"] = requireBabelPlugin(
      "@babel/plugin-transform-literals",
    );
  }
  if (isBabelPluginNeeded("transform-new-target")) {
    babelPluginStructure["transform-new-target"] = requireBabelPlugin(
      "@babel/plugin-transform-new-target",
    );
  }
  if (isBabelPluginNeeded("transform-object-super")) {
    babelPluginStructure["transform-object-super"] = requireBabelPlugin(
      "@babel/plugin-transform-object-super",
    );
  }
  if (isBabelPluginNeeded("transform-parameters")) {
    babelPluginStructure["transform-parameters"] = requireBabelPlugin(
      "@babel/plugin-transform-parameters",
    );
  }
  if (isBabelPluginNeeded("transform-regenerator")) {
    babelPluginStructure["transform-regenerator"] = [
      requireBabelPlugin("@babel/plugin-transform-regenerator"),
      {
        asyncGenerators: true,
        generators: true,
        async: false,
      },
    ];
  }
  if (isBabelPluginNeeded("transform-shorthand-properties")) {
    babelPluginStructure["transform-shorthand-properties"] = [
      requireBabelPlugin("@babel/plugin-transform-shorthand-properties"),
    ];
  }
  if (isBabelPluginNeeded("transform-spread")) {
    babelPluginStructure["transform-spread"] = [
      requireBabelPlugin("@babel/plugin-transform-spread"),
    ];
  }
  if (isBabelPluginNeeded("transform-sticky-regex")) {
    babelPluginStructure["transform-sticky-regex"] = [
      requireBabelPlugin("@babel/plugin-transform-sticky-regex"),
    ];
  }
  if (isBabelPluginNeeded("transform-template-literals")) {
    babelPluginStructure["transform-template-literals"] = [
      requireBabelPlugin("@babel/plugin-transform-template-literals"),
    ];
  }
  if (
    isBabelPluginNeeded("transform-typeof-symbol") &&
    // prevent "typeof" to be injected into itself:
    // - not needed
    // - would create infinite attempt to transform typeof
    url !== getBabelHelperFileUrl("typeof")
  ) {
    babelPluginStructure["transform-typeof-symbol"] = [
      requireBabelPlugin("@babel/plugin-transform-typeof-symbol"),
    ];
  }
  if (isBabelPluginNeeded("transform-unicode-regex")) {
    babelPluginStructure["transform-unicode-regex"] = [
      requireBabelPlugin("@babel/plugin-transform-unicode-regex"),
    ];
  }
  return babelPluginStructure;
};

const injectSideEffectFileIntoBabelAst = ({
  programPath,
  sideEffectFileUrl,
  getSideEffectFileSpecifier,
  babel,
  isJsModule,
  asImport = true,
}) => {
  if (isJsModule && asImport) {
    injectJsImport({
      programPath,
      from: getSideEffectFileSpecifier(sideEffectFileUrl),
      sideEffect: true,
    });
    return;
  }
  const sidEffectFileContent = readFileSync(new URL(sideEffectFileUrl), "utf8");
  const sideEffectFileContentAst = babel.parse(sidEffectFileContent);
  if (isJsModule) {
    injectAstAfterImport(programPath, sideEffectFileContentAst);
    return;
  }
  const bodyNodePaths = programPath.get("body");
  bodyNodePaths[0].insertBefore(sideEffectFileContentAst.program.body);
};

const injectAstAfterImport = (programPath, ast) => {
  const bodyNodePaths = programPath.get("body");
  const notAnImportIndex = bodyNodePaths.findIndex(
    (bodyNodePath) => bodyNodePath.node.type !== "ImportDeclaration",
  );
  const notAnImportNodePath = bodyNodePaths[notAnImportIndex];
  if (notAnImportNodePath) {
    notAnImportNodePath.insertBefore(ast.program.body);
  } else {
    bodyNodePaths[0].insertBefore(ast.program.body);
  }
};

const newStylesheetClientFileUrl = new URL(
  "./client/new_stylesheet.js",
  import.meta.url,
).href;

const babelPluginNewStylesheetInjector = (
  babel,
  { babelHelpersAsImport, getImportSpecifier },
) => {
  return {
    name: "new-stylesheet-injector",
    visitor: {
      Program: (path, state) => {
        const { sourceType } = state.file.opts.parserOpts;
        const isJsModule = sourceType === "module";
        injectSideEffectFileIntoBabelAst({
          programPath: path,
          isJsModule,
          asImport: babelHelpersAsImport,
          sideEffectFileUrl: newStylesheetClientFileUrl,
          getSideEffectFileSpecifier: getImportSpecifier,
          babel,
        });
      },
    },
  };
};

const analyzeConstructableStyleSheetUsage = (urlInfo) => {
  if (urlInfo.url === newStylesheetClientFileUrl) {
    return null;
  }
  // const { runtimeCompat } = urlInfo.kitchen.context;
  // const runtimeNames = runtimeCompat ? Object.keys(runtimeCompat) : [];
  // let someRuntimeIsBrowser = false;
  // for (const runtimeName of runtimeNames) {
  //   if (
  //     runtimeName === "chrome" ||
  //     runtimeName === "edge" ||
  //     runtimeName === "firefox" ||
  //     runtimeName === "opera" ||
  //     runtimeName === "safari" ||
  //     runtimeName === "samsung"
  //   ) {
  //     someRuntimeIsBrowser = true;
  //     break;
  //   }
  // }
  // if (!someRuntimeIsBrowser) {
  //   // we are building only for nodejs, no need to analyze constructable stylesheet usage
  //   return null;
  // }
  const node = visitJsAstUntil(urlInfo.contentAst, {
    NewExpression: (node) => {
      return isNewCssStyleSheetCall(node);
    },
    MemberExpression: (node) => {
      return isDocumentAdoptedStyleSheets(node);
    },
    ImportExpression: (node) => {
      const source = node.source;
      if (source.type !== "Literal" || typeof source.value === "string") {
        // Non-string argument, probably a variable or expression, e.g.
        // import(moduleId)
        // import('./' + moduleName)
        return false;
      }
      if (hasImportTypeCssAttribute(node)) {
        return node;
      }
      if (hasCssModuleQueryParam(source)) {
        return source;
      }
      return false;
    },
    ImportDeclaration: (node) => {
      const { source } = node;
      if (hasCssModuleQueryParam(source)) {
        return source;
      }
      if (hasImportTypeCssAttribute(node)) {
        return node;
      }
      return false;
    },
    ExportAllDeclaration: (node) => {
      const { source } = node;
      if (hasCssModuleQueryParam(source)) {
        return source;
      }
      return false;
    },
    ExportNamedDeclaration: (node) => {
      const { source } = node;
      if (!source) {
        // This export has no "source", so it's probably
        // a local variable or function, e.g.
        // export { varName }
        // export const constName = ...
        // export function funcName() {}
        return false;
      }
      if (hasCssModuleQueryParam(source)) {
        return source;
      }
      return false;
    },
  });
  return node
    ? {
        line: node.loc.start.line,
        column: node.loc.start.column,
      }
    : null;
};

const isNewCssStyleSheetCall = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "CSSStyleSheet"
  );
};

const isDocumentAdoptedStyleSheets = (node) => {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === "document" &&
    node.property.type === "Identifier" &&
    node.property.name === "adoptedStyleSheets"
  );
};

const hasCssModuleQueryParam = (node) => {
  return (
    node.type === "Literal" &&
    typeof node.value === "string" &&
    new URL(node.value, "https://jsenv.dev").searchParams.has(`css_module`)
  );
};

const hasImportTypeCssAttribute = (node) => {
  const importAttributes = getImportAttributes(node);
  return Boolean(importAttributes.type === "css");
};

const getImportAttributes = (importNode) => {
  const importAttributes = {};
  if (importNode.attributes) {
    importNode.attributes.forEach((importAttributeNode) => {
      importAttributes[importAttributeNode.key.name] =
        importAttributeNode.value.value;
    });
  }
  return importAttributes;
};

const regeneratorRuntimeClientFileUrl = new URL(
  "./client/regenerator_runtime.js",
  import.meta.url,
).href;

const babelPluginRegeneratorRuntimeInjector = (
  babel,
  { babelHelpersAsImport, getImportSpecifier },
) => {
  return {
    name: "regenerator-runtime-injector",
    visitor: {
      Program: (path, state) => {
        const { sourceType } = state.file.opts.parserOpts;
        const isJsModule = sourceType === "module";
        injectSideEffectFileIntoBabelAst({
          programPath: path,
          isJsModule,
          asImport: babelHelpersAsImport,
          sideEffectFileUrl: regeneratorRuntimeClientFileUrl,
          getSideEffectFileSpecifier: getImportSpecifier,
          babel,
        });
      },
    },
  };
};

const analyzeRegeneratorRuntimeUsage = (urlInfo) => {
  if (urlInfo.url === regeneratorRuntimeClientFileUrl) {
    return null;
  }
  const ast = urlInfo.contentAst;
  const node = visitJsAstUntil(ast, {
    Identifier: (node) => {
      if (node.name === "regeneratorRuntime") {
        return node;
      }
      return false;
    },
  });
  return node
    ? {
        line: node.loc.start.line,
        column: node.loc.start.column,
      }
    : null;
};

const jsenvPluginBabel = ({ babelHelpersAsImport = true } = {}) => {
  const transformWithBabel = async (urlInfo) => {
    const isJsModule = urlInfo.type === "js_module";
    const getImportSpecifier = (clientFileUrl) => {
      const jsImportReference = urlInfo.dependencies.inject({
        type: "js_import",
        expectedType: "js_module",
        specifier: clientFileUrl,
      });
      return JSON.parse(jsImportReference.generatedSpecifier);
    };
    const isSupported = urlInfo.context.isSupportedOnCurrentClients;
    const babelPluginStructure = getBaseBabelPluginStructure({
      url: urlInfo.originalUrl,
      isSupported});

    if (!isSupported("async_generator_function")) {
      const regeneratorRuntimeUsage = analyzeRegeneratorRuntimeUsage(urlInfo);
      if (regeneratorRuntimeUsage) {
        if (isJsModule && babelHelpersAsImport) {
          babelPluginStructure["new-stylesheet-injector"] = [
            babelPluginRegeneratorRuntimeInjector,
            { babelHelpersAsImport, getImportSpecifier },
          ];
        } else {
          urlInfo.dependencies.foundSideEffectFile({
            sideEffectFileUrl: regeneratorRuntimeClientFileUrl,
            expectedType: "js_classic",
            specifierLine: regeneratorRuntimeUsage.line,
            specifierColumn: regeneratorRuntimeUsage.column,
          });
        }
      }
    }
    if (!isSupported("new_stylesheet")) {
      const constructableStyleSheetUsage =
        analyzeConstructableStyleSheetUsage(urlInfo);
      if (constructableStyleSheetUsage) {
        if (isJsModule && babelHelpersAsImport) {
          babelPluginStructure["new-stylesheet-injector"] = [
            babelPluginNewStylesheetInjector,
            { babelHelpersAsImport, getImportSpecifier },
          ];
        } else {
          urlInfo.dependencies.foundSideEffectFile({
            sideEffectFileUrl: regeneratorRuntimeClientFileUrl,
            expectedType: "js_classic",
            specifierLine: constructableStyleSheetUsage.line,
            specifierColumn: constructableStyleSheetUsage.column,
          });
        }
      }
    }
    if (
      isJsModule &&
      babelHelpersAsImport &&
      Object.keys(babelPluginStructure).length > 0
    ) {
      babelPluginStructure["babel-helper-as-jsenv-import"] = [
        babelPluginBabelHelpersAsJsenvImports,
        { getImportSpecifier },
      ];
    }

    const babelPlugins = Object.keys(babelPluginStructure).map(
      (babelPluginName) => babelPluginStructure[babelPluginName],
    );
    const { code, map } = await applyBabelPlugins({
      babelPlugins,
      options: {
        generatorOpts: {
          retainLines: urlInfo.context.dev,
        },
      },
      input: urlInfo.content,
      inputIsJsModule: isJsModule,
      inputUrl: urlInfo.originalUrl,
      outputUrl: urlInfo.generatedUrl,
    });
    return {
      content: code,
      sourcemap: map,
    };
  };

  return {
    name: "jsenv:babel",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: transformWithBabel,
      js_module: transformWithBabel,
    },
  };
};

const applyCssTranspilation = async ({
  input,
  inputUrl,
  runtimeCompat,
}) => {
  // https://lightningcss.dev/docs.html
  const { transform } = await import("lightningcss");
  const targets = runtimeCompatToTargets(runtimeCompat);
  const { code, map } = transform({
    filename: urlToFileSystemPath(inputUrl),
    code: Buffer.from(input),
    targets,
    minify: false,
    drafts: {
      nesting: true,
      customMedia: true,
    },
  });
  return { content: String(code), sourcemap: map };
};

const runtimeCompatToTargets = (runtimeCompat) => {
  const targets = {};
  ["chrome", "firefox", "ie", "opera", "safari"].forEach((runtimeName) => {
    const version = runtimeCompat[runtimeName];
    if (version) {
      targets[runtimeName] = versionToBits(version);
    }
  });
  return targets;
};

const versionToBits = (version) => {
  const [major, minor = 0, patch = 0] = version
    .split("-")[0]
    .split(".")
    .map((v) => parseInt(v, 10));
  return (major << 16) | (minor << 8) | patch;
};

const jsenvPluginCssTranspilation = () => {
  return {
    name: "jsenv:css_transpilation",
    appliesDuring: "*",
    transformUrlContent: {
      css: (urlInfo) => {
        return applyCssTranspilation({
          input: urlInfo.content,
          inputUrl: urlInfo.originalUrl,
          runtimeCompat: urlInfo.context.runtimeCompat,
        });
      },
    },
  };
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

/*
 * Jsenv wont touch code where "specifier" or "type" is dynamic (see code below)
 * ```js
 * const file = "./style.css"
 * const type = "css"
 * import(file, { with: { type }})
 * ```
 * Jsenv could throw an error when it knows some browsers in runtimeCompat
 * do not support import attributes
 * But for now (as it is simpler) we let the browser throw the error
 */


const jsenvPluginImportAttributes = ({
  json = "auto",
  css = true,
  text = "auto",
}) => {
  const transpilations = { json, css, text };
  const markAsJsModuleProxy = (reference) => {
    reference.expectedType = "js_module";
    if (!reference.filenameHint) {
      reference.filenameHint = `${urlToFilename$1(reference.url)}.js`;
    }
  };
  const turnIntoJsModuleProxy = (
    reference,
    type,
    { injectSearchParamForSideEffectImports },
  ) => {
    reference.mutation = (magicSource) => {
      if (reference.subtype === "import_dynamic") {
        const { importTypeAttributeNode } = reference.astInfo;
        magicSource.remove({
          start: importTypeAttributeNode.start,
          end: importTypeAttributeNode.end,
        });
      } else {
        const { importTypeAttributeNode } = reference.astInfo;
        const content = reference.ownerUrlInfo.content;
        const withKeywordStart = content.indexOf(
          "with",
          importTypeAttributeNode.start - " with { ".length,
        );
        const withKeywordEnd = content.indexOf(
          "}",
          importTypeAttributeNode.end,
        );
        magicSource.remove({
          start: withKeywordStart,
          end: withKeywordEnd + 1,
        });
      }
    };
    const newUrl = injectQueryParams(reference.url, {
      [`as_${type}_module`]: "",
      ...(injectSearchParamForSideEffectImports && reference.isSideEffectImport
        ? { side_effect: "" }
        : {}),
    });
    markAsJsModuleProxy(reference);
    return newUrl;
  };

  const createImportTypePlugin = ({
    type,
    createUrlContent,
    injectSearchParamForSideEffectImports,
  }) => {
    return {
      name: `jsenv:import_type_${type}`,
      appliesDuring: "*",
      init: (context) => {
        // transpilation is forced during build so that
        //   - avoid rollup to see import assertions
        //     We would have to tell rollup to ignore import with assertion
        //   - means rollup can bundle more js file together
        //   - means url versioning can work for css inlined in js
        if (context.build) {
          return true;
        }
        const transpilation = transpilations[type];
        if (transpilation === "auto") {
          return !context.isSupportedOnCurrentClients(`import_type_${type}`);
        }
        return transpilation;
      },
      redirectReference: (reference) => {
        if (!reference.importAttributes) {
          return null;
        }
        const { searchParams } = reference;
        if (searchParams.has(`as_${type}_module`)) {
          markAsJsModuleProxy(reference);
          return null;
        }
        // when search param is injected, it will be removed later
        // by "getWithoutSearchParam". We don't want to redirect again
        // (would create infinite recursion)
        if (
          reference.prev &&
          reference.prev.searchParams.has(`as_${type}_module`)
        ) {
          return null;
        }
        if (reference.importAttributes.type === type) {
          return turnIntoJsModuleProxy(reference, type, {
            injectSearchParamForSideEffectImports,
          });
        }
        return null;
      },
      fetchUrlContent: async (urlInfo) => {
        const originalUrlInfo = urlInfo.getWithoutSearchParam(
          `as_${type}_module`,
          {
            expectedType: type,
          },
        );
        if (!originalUrlInfo) {
          return null;
        }
        await originalUrlInfo.cook();
        if (
          injectSearchParamForSideEffectImports &&
          originalUrlInfo.searchParams.has("side_effect")
        ) {
          const urlInfoWithoutSideEffect =
            originalUrlInfo.getWithoutSearchParam("side_effect");
          if (urlInfoWithoutSideEffect) {
            await urlInfoWithoutSideEffect.kitchen.urlInfoTransformer.setContent(
              urlInfoWithoutSideEffect,
              originalUrlInfo.content,
            );
          }
        }
        return createUrlContent(originalUrlInfo);
      },
    };
  };

  const asJsonModule = createImportTypePlugin({
    type: "json",
    createUrlContent: (jsonUrlInfo) => {
      const jsonText = JSON.stringify(jsonUrlInfo.content.trim());
      let inlineContentCall;
      // here we could `export default ${jsonText}`:
      // but js engine are optimized to recognize JSON.parse
      // and use a faster parsing strategy
      if (jsonUrlInfo.context.dev) {
        inlineContentCall = `JSON.parse(
  ${jsonText},
  //# inlinedFromUrl=${jsonUrlInfo.url}
)`;
      } else {
        inlineContentCall = `JSON.parse(${jsonText})`;
      }
      return {
        content: `export default ${inlineContentCall};`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: jsonUrlInfo.originalUrl,
        originalContent: jsonUrlInfo.originalContent,
        data: jsonUrlInfo.data,
      };
    },
  });

  const asCssModule = createImportTypePlugin({
    type: "css",
    injectSearchParamForSideEffectImports: true,
    createUrlContent: (cssUrlInfo) => {
      const cssText = JS_QUOTES.escapeSpecialChars(cssUrlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true,
      });
      let inlineContentCall;
      if (cssUrlInfo.context.dev) {
        inlineContentCall = `new __InlineContent__(
  ${cssText},
  { type: "text/css" },
  //# inlinedFromUrl=${cssUrlInfo.url}
)`;
      } else {
        inlineContentCall = `new __InlineContent__(${cssText}, { type: "text/css" })`;
      }

      let autoInject = cssUrlInfo.searchParams.has("side_effect");
      let cssModuleAutoInjectCode = ``;
      if (autoInject) {
        if (cssUrlInfo.context.dev) {
          cssModuleAutoInjectCode = `
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== stylesheet,
    );
  });
};
`;
        } else {
          cssModuleAutoInjectCode = `
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
`;
        }
      }
      let cssModuleContent = `import ${JSON.stringify(cssUrlInfo.context.inlineContentClientFileUrl)};

const inlineContent = ${inlineContentCall};
const stylesheet = new CSSStyleSheet();
stylesheet.replaceSync(inlineContent.text);
${cssModuleAutoInjectCode}
export default stylesheet;`;

      return {
        content: cssModuleContent,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: cssUrlInfo.originalUrl,
        originalContent: cssUrlInfo.originalContent,
        data: cssUrlInfo.data,
      };
    },
  });

  const asTextModule = createImportTypePlugin({
    type: "text",
    createUrlContent: (textUrlInfo) => {
      const textPlain = JS_QUOTES.escapeSpecialChars(textUrlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true,
      });
      let inlineContentCall;
      if (textUrlInfo.context.dev) {
        inlineContentCall = `new __InlineContent__(
  ${textPlain},
  { type: "text/plain"},
  //# inlinedFromUrl=${textUrlInfo.url}
)`;
      } else {
        inlineContentCall = `new __InlineContent__(${textPlain}, { type: "text/plain"})`;
      }
      return {
        content: `
import ${JSON.stringify(textUrlInfo.context.inlineContentClientFileUrl)};

const inlineContent = ${inlineContentCall};

export default inlineContent.text;`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: textUrlInfo.originalUrl,
        originalContent: textUrlInfo.originalContent,
        data: textUrlInfo.data,
      };
    },
  });

  return [asJsonModule, asCssModule, asTextModule];
};

/*
 * Transforms code to make it compatible with browser that would not be able to
 * run it otherwise. For instance:
 * - const -> var
 * - async/await -> promises
 * Anything that is not standard (import.meta.dev for instance) is outside the scope
 * of this plugin
 */


const jsenvPluginTranspilation = ({
  importAttributes = true,
  css = true, // TODO
  // build sets jsModuleFallback: false during first step of the build
  // and re-enable it in the second phase (when performing the bundling)
  // so that bundling is applied on js modules THEN it is converted to js classic if needed
  jsModuleFallback = true,
  babelHelpersAsImport = true,
}) => {
  if (importAttributes === true) {
    importAttributes = {};
  }
  if (jsModuleFallback === true) {
    jsModuleFallback = {};
  }
  return [
    // babel also so that rollup can bundle babel helpers for instance
    jsenvPluginBabel({
      babelHelpersAsImport,
    }),
    jsenvPluginAsJsModule(),
    ...(jsModuleFallback ? [jsenvPluginJsModuleFallback()] : []),
    ...(importAttributes
      ? [jsenvPluginImportAttributes(importAttributes)]
      : []),

    ...(css ? [jsenvPluginCssTranspilation()] : []),
  ];
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
    const namespace = await import("browserslist");
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

  return string
};

const assertImportMap = (value) => {
  if (value === null) {
    throw new TypeError(`an importMap must be an object, got null`)
  }

  const type = typeof value;
  if (type !== "object") {
    throw new TypeError(`an importMap must be an object, received ${value}`)
  }

  if (Array.isArray(value)) {
    throw new TypeError(
      `an importMap must be an object, received array ${value}`,
    )
  }
};

const hasScheme = (string) => {
  return /^[a-zA-Z]{2,}:/.test(string)
};

const urlToScheme$1 = (urlString) => {
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) return ""
  return urlString.slice(0, colonIndex)
};

const urlToPathname$1 = (urlString) => {
  return ressourceToPathname(urlToRessource(urlString))
};

const urlToRessource = (urlString) => {
  const scheme = urlToScheme$1(urlString);

  if (scheme === "file") {
    return urlString.slice("file://".length)
  }

  if (scheme === "https" || scheme === "http") {
    // remove origin
    const afterProtocol = urlString.slice(scheme.length + "://".length);
    const pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
    return afterProtocol.slice(pathnameSlashIndex)
  }

  return urlString.slice(scheme.length + 1)
};

const ressourceToPathname = (ressource) => {
  const searchSeparatorIndex = ressource.indexOf("?");
  return searchSeparatorIndex === -1
    ? ressource
    : ressource.slice(0, searchSeparatorIndex)
};

const urlToOrigin = (urlString) => {
  const scheme = urlToScheme$1(urlString);

  if (scheme === "file") {
    return "file://"
  }

  if (scheme === "http" || scheme === "https") {
    const secondProtocolSlashIndex = scheme.length + "://".length;
    const pathnameSlashIndex = urlString.indexOf("/", secondProtocolSlashIndex);

    if (pathnameSlashIndex === -1) return urlString
    return urlString.slice(0, pathnameSlashIndex)
  }

  return urlString.slice(0, scheme.length + 1)
};

const pathnameToParentPathname = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return "/"
  }

  return pathname.slice(0, slashLastIndex + 1)
};

// could be useful: https://url.spec.whatwg.org/#url-miscellaneous


const resolveUrl = (specifier, baseUrl) => {
  if (baseUrl) {
    if (typeof baseUrl !== "string") {
      throw new TypeError(writeBaseUrlMustBeAString({ baseUrl, specifier }))
    }
    if (!hasScheme(baseUrl)) {
      throw new Error(writeBaseUrlMustBeAbsolute({ baseUrl, specifier }))
    }
  }

  if (hasScheme(specifier)) {
    return specifier
  }

  if (!baseUrl) {
    throw new Error(writeBaseUrlRequired({ baseUrl, specifier }))
  }

  // scheme relative
  if (specifier.slice(0, 2) === "//") {
    return `${urlToScheme$1(baseUrl)}:${specifier}`
  }

  // origin relative
  if (specifier[0] === "/") {
    return `${urlToOrigin(baseUrl)}${specifier}`
  }

  const baseOrigin = urlToOrigin(baseUrl);
  const basePathname = urlToPathname$1(baseUrl);

  if (specifier === ".") {
    const baseDirectoryPathname = pathnameToParentPathname(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}`
  }

  // pathname relative inside
  if (specifier.slice(0, 2) === "./") {
    const baseDirectoryPathname = pathnameToParentPathname(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}${specifier.slice(2)}`
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
    return `${baseOrigin}${resolvedPathname}`
  }

  // bare
  if (basePathname === "") {
    return `${baseOrigin}/${specifier}`
  }
  if (basePathname[basePathname.length] === "/") {
    return `${baseOrigin}${basePathname}${specifier}`
  }
  return `${baseOrigin}${pathnameToParentPathname(basePathname)}${specifier}`
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
  return hasScheme(result) ? result : null
};

const resolveSpecifier = (specifier, importer) => {
  if (
    specifier === "." ||
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    return resolveUrl(specifier, importer)
  }

  if (hasScheme(specifier)) {
    return specifier
  }

  return null
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
    )
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
    )
  }
  if (importer) {
    if (typeof importer !== "string") {
      throw new TypeError(
        createDetailedMessage("importer must be a string.", {
          importer,
          specifier,
        }),
      )
    }
    if (!hasScheme(importer)) {
      throw new Error(
        createDetailedMessage(`importer must be an absolute url.`, {
          importer,
          specifier,
        }),
      )
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
        )
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
        return mappingFromScopes
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
      return mappingFromImports
    }
  }

  if (specifierUrl) {
    return specifierUrl
  }

  throw createBareSpecifierError({ specifier, importer })
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
      return address
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
      return addressFinal
    }
  }

  return null
};

const specifierIsPrefixOf = (specifierHref, href) => {
  return (
    specifierHref[specifierHref.length - 1] === "/" &&
    href.startsWith(specifierHref)
  )
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

  return importMap
};

const composeTwoMappings = (leftMappings, rightMappings) => {
  const mappings = {};

  Object.keys(leftMappings).forEach((leftSpecifier) => {
    if (objectHasKey(rightMappings, leftSpecifier)) {
      // will be overidden
      return
    }
    const leftAddress = leftMappings[leftSpecifier];
    const rightSpecifier = Object.keys(rightMappings).find((rightSpecifier) => {
      return compareAddressAndSpecifier(leftAddress, rightSpecifier)
    });
    mappings[leftSpecifier] = rightSpecifier
      ? rightMappings[rightSpecifier]
      : leftAddress;
  });

  Object.keys(rightMappings).forEach((rightSpecifier) => {
    mappings[rightSpecifier] = rightMappings[rightSpecifier];
  });

  return mappings
};

const objectHasKey = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const compareAddressAndSpecifier = (address, specifier) => {
  const addressUrl = resolveUrl(address, "file:///");
  const specifierUrl = resolveUrl(specifier, "file:///");
  return addressUrl === specifierUrl
};

const composeTwoScopes = (leftScopes, rightScopes, imports) => {
  const scopes = {};

  Object.keys(leftScopes).forEach((leftScopeKey) => {
    if (objectHasKey(rightScopes, leftScopeKey)) {
      // will be merged
      scopes[leftScopeKey] = leftScopes[leftScopeKey];
      return
    }
    const topLevelSpecifier = Object.keys(imports).find(
      (topLevelSpecifierCandidate) => {
        return compareAddressAndSpecifier(
          leftScopeKey,
          topLevelSpecifierCandidate,
        )
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

  return scopes
};

const sortImports = (imports) => {
  const mappingsSorted = {};

  Object.keys(imports)
    .sort(compareLengthOrLocaleCompare)
    .forEach((name) => {
      mappingsSorted[name] = imports[name];
    });

  return mappingsSorted
};

const sortScopes = (scopes) => {
  const scopesSorted = {};

  Object.keys(scopes)
    .sort(compareLengthOrLocaleCompare)
    .forEach((scopeSpecifier) => {
      scopesSorted[scopeSpecifier] = sortImports(scopes[scopeSpecifier]);
    });

  return scopesSorted
};

const compareLengthOrLocaleCompare = (a, b) => {
  return b.length - a.length || a.localeCompare(b)
};

const normalizeImportMap = (importMap, baseUrl) => {
  assertImportMap(importMap);

  if (!isStringOrUrl(baseUrl)) {
    throw new TypeError(formulateBaseUrlMustBeStringOrUrl({ baseUrl }))
  }

  const { imports, scopes } = importMap;

  return {
    imports: imports ? normalizeMappings(imports, baseUrl) : undefined,
    scopes: scopes ? normalizeScopes(scopes, baseUrl) : undefined,
  }
};

const isStringOrUrl = (value) => {
  if (typeof value === "string") {
    return true
  }

  if (typeof URL === "function" && value instanceof URL) {
    return true
  }

  return false
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
      return
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
      return
    }

    if (specifier.endsWith("/") && !addressUrl.endsWith("/")) {
      console.warn(
        formulateAddressUrlRequiresTrailingSlash({
          address,
          specifier,
        }),
      );
      return
    }
    mappingsNormalized[specifierResolved] = addressUrl;
  });

  return sortImports(mappingsNormalized)
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
      return
    }
    const scopeValueNormalized = normalizeMappings(scopeMappings, baseUrl);
    scopesNormalized[scopeUrl] = scopeValueNormalized;
  });

  return sortScopes(scopesNormalized)
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

const pathnameToExtension$1 = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex !== -1) {
    pathname = pathname.slice(slashLastIndex + 1);
  }

  const dotLastIndex = pathname.lastIndexOf(".");
  if (dotLastIndex === -1) return ""
  // if (dotLastIndex === pathname.length - 1) return ""
  return pathname.slice(dotLastIndex)
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

  return url
};

const applyDefaultExtension = ({ url, importer, defaultExtension }) => {
  if (urlToPathname$1(url).endsWith("/")) {
    return url
  }

  if (typeof defaultExtension === "string") {
    const extension = pathnameToExtension$1(url);
    if (extension === "") {
      return `${url}${defaultExtension}`
    }
    return url
  }

  if (defaultExtension === true) {
    const extension = pathnameToExtension$1(url);
    if (extension === "" && importer) {
      const importerPathname = urlToPathname$1(importer);
      const importerExtension = pathnameToExtension$1(importerPathname);
      return `${url}${importerExtension}`
    }
  }

  return url
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

// https://github.com/Marak/colors.js/blob/master/lib/styles.js
// https://stackoverflow.com/a/75985833/2634179
const RESET = "\x1b[0m";

const createAnsi = ({ supported }) => {
  const ANSI = {
    supported,

    RED: "\x1b[31m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    BLUE: "\x1b[34m",
    MAGENTA: "\x1b[35m",
    CYAN: "\x1b[36m",
    GREY: "\x1b[90m",
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
      return `${color}${text}${RESET}`;
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
      return `${effect}${text}${RESET}`;
    },
  };

  return ANSI;
};

const processSupportsBasicColor = createSupportsColor$2(process.stdout).hasBasic;

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
  supported: process.env.FORCE_UNICODE === "1" || isUnicodeSupported$2(),
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
      const width = stringWidth(logLine);
      if (width === 0) {
        visualLineCount++;
      } else {
        visualLineCount += Math.ceil(width / columns);
      }
    }

    if (visualLineCount > rows) {
      if (clearTerminalAllowed) {
        clearAttemptResult = true;
        return clearTerminal$2;
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
    return eraseLines$2(visualLineCount);
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

export { ANSI$2 as ANSI, ANSI$1, Abort$1 as Abort, Abort as Abort$1, CONTENT_TYPE$1 as CONTENT_TYPE, CONTENT_TYPE as CONTENT_TYPE$1, DATA_URL$1 as DATA_URL, DATA_URL as DATA_URL$1, JS_QUOTES$1 as JS_QUOTES, JS_QUOTES as JS_QUOTES$1, RUNTIME_COMPAT$1 as RUNTIME_COMPAT, RUNTIME_COMPAT as RUNTIME_COMPAT$1, UNICODE$1 as UNICODE, URL_META$1 as URL_META, URL_META as URL_META$1, applyFileSystemMagicResolution$1 as applyFileSystemMagicResolution, applyFileSystemMagicResolution as applyFileSystemMagicResolution$1, applyNodeEsmResolution$1 as applyNodeEsmResolution, applyNodeEsmResolution as applyNodeEsmResolution$1, asSpecifierWithoutSearch$1 as asSpecifierWithoutSearch, asSpecifierWithoutSearch as asSpecifierWithoutSearch$1, asUrlWithoutSearch$1 as asUrlWithoutSearch, asUrlWithoutSearch as asUrlWithoutSearch$1, assertAndNormalizeDirectoryUrl$2 as assertAndNormalizeDirectoryUrl, assertAndNormalizeDirectoryUrl$1, assertAndNormalizeDirectoryUrl as assertAndNormalizeDirectoryUrl$2, browserDefaultRuntimeCompat, bufferToEtag$1 as bufferToEtag, bufferToEtag as bufferToEtag$1, clearDirectorySync, compareFileUrls$1 as compareFileUrls, compareFileUrls as compareFileUrls$1, comparePathnames, composeTwoImportMaps$1 as composeTwoImportMaps, composeTwoImportMaps as composeTwoImportMaps$1, createDetailedMessage$3 as createDetailedMessage, createDetailedMessage$1, createDynamicLog$1 as createDynamicLog, createLogger$2 as createLogger, createLogger$1, createLogger as createLogger$2, createTaskLog$2 as createTaskLog, createTaskLog$1, createTaskLog as createTaskLog$2, defaultLookupPackageScope$1 as defaultLookupPackageScope, defaultLookupPackageScope as defaultLookupPackageScope$1, defaultReadPackageJson$1 as defaultReadPackageJson, defaultReadPackageJson as defaultReadPackageJson$1, ensureEmptyDirectory, ensurePathnameTrailingSlash$2 as ensurePathnameTrailingSlash, ensurePathnameTrailingSlash$1, ensureWindowsDriveLetter$1 as ensureWindowsDriveLetter, ensureWindowsDriveLetter as ensureWindowsDriveLetter$1, escapeRegexpSpecialChars, generateContentFrame$1 as generateContentFrame, generateContentFrame as generateContentFrame$1, getCallerPosition$1 as getCallerPosition, getCallerPosition as getCallerPosition$1, getExtensionsToTry$1 as getExtensionsToTry, getExtensionsToTry as getExtensionsToTry$1, humanizeDuration$1 as humanizeDuration, humanizeMemory, inferRuntimeCompatFromClosestPackage, injectQueryParamIntoSpecifierWithoutEncoding, injectQueryParamsIntoSpecifier$1 as injectQueryParamsIntoSpecifier, injectQueryParamsIntoSpecifier as injectQueryParamsIntoSpecifier$1, isFileSystemPath$2 as isFileSystemPath, isFileSystemPath$1, jsenvPluginBundling, jsenvPluginJsModuleFallback, jsenvPluginMinification, jsenvPluginTranspilation$1 as jsenvPluginTranspilation, jsenvPluginTranspilation as jsenvPluginTranspilation$1, lookupPackageDirectory$1 as lookupPackageDirectory, lookupPackageDirectory as lookupPackageDirectory$1, memoizeByFirstArgument, moveUrl$1 as moveUrl, moveUrl as moveUrl$1, nodeDefaultRuntimeCompat, normalizeImportMap$1 as normalizeImportMap, normalizeImportMap as normalizeImportMap$1, normalizeUrl$1 as normalizeUrl, normalizeUrl as normalizeUrl$1, raceProcessTeardownEvents$1 as raceProcessTeardownEvents, raceProcessTeardownEvents as raceProcessTeardownEvents$1, readCustomConditionsFromProcessArgs$1 as readCustomConditionsFromProcessArgs, readCustomConditionsFromProcessArgs as readCustomConditionsFromProcessArgs$1, readEntryStatSync$1 as readEntryStatSync, readEntryStatSync as readEntryStatSync$1, registerDirectoryLifecycle$1 as registerDirectoryLifecycle, registerDirectoryLifecycle as registerDirectoryLifecycle$1, renderBigSection, renderUrlOrRelativeUrlFilename, resolveImport$1 as resolveImport, resolveImport as resolveImport$1, setUrlBasename$1 as setUrlBasename, setUrlBasename as setUrlBasename$1, setUrlExtension$1 as setUrlExtension, setUrlExtension as setUrlExtension$1, setUrlFilename$1 as setUrlFilename, setUrlFilename as setUrlFilename$1, stringifyUrlSite$1 as stringifyUrlSite, stringifyUrlSite as stringifyUrlSite$1, urlIsInsideOf$1 as urlIsInsideOf, urlIsInsideOf as urlIsInsideOf$1, urlToBasename$1 as urlToBasename, urlToBasename as urlToBasename$1, urlToExtension$4 as urlToExtension, urlToExtension$2 as urlToExtension$1, urlToExtension as urlToExtension$2, urlToFileSystemPath$1 as urlToFileSystemPath, urlToFileSystemPath as urlToFileSystemPath$1, urlToFilename$3 as urlToFilename, urlToFilename$1, urlToPathname$4 as urlToPathname, urlToPathname$2 as urlToPathname$1, urlToPathname as urlToPathname$2, urlToRelativeUrl$1 as urlToRelativeUrl, urlToRelativeUrl as urlToRelativeUrl$1, validateResponseIntegrity$1 as validateResponseIntegrity, validateResponseIntegrity as validateResponseIntegrity$1, writeFileSync$1 as writeFileSync, writeFileSync as writeFileSync$1 };
