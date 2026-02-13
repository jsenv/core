import { createSupportsColor, isUnicodeSupported, emojiRegex, eastAsianWidth, clearTerminal, eraseLines } from "./jsenv_core_node_modules.js";
import { stripVTControlCharacters } from "node:util";
import { readFileSync, existsSync, chmodSync, statSync, lstatSync, readdirSync, openSync, closeSync, unlinkSync, rmdirSync, mkdirSync, writeFileSync as writeFileSync$1, watch, realpathSync } from "node:fs";
import { extname } from "node:path";
import crypto, { createHash } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";

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

const prefixFirstAndIndentRemainingLines = (
  text,
  { prefix, indentation, trimLines, trimLastLine },
) => {
  const lines = text.split(/\r?\n/);
  const firstLine = lines.shift();
  if (indentation === undefined) {
    {
      indentation = "  "; // prefix + space
    }
  }
  let result = `${prefix} ${firstLine}` ;
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

const formatError = (error) => {
  let text = "";
  text += error.stack;
  const { cause } = error;
  if (cause) {
    const formatCause = (cause, depth) => {
      let causeText = prefixFirstAndIndentRemainingLines(cause.stack, {
        prefix: "  [cause]:",
        indentation: "  ".repeat(depth + 1),
      });
      const nestedCause = cause.cause;
      if (nestedCause) {
        const nestedCauseText = formatCause(nestedCause, depth + 1);
        causeText += `\n${nestedCauseText}`;
      }
      return causeText;
    };
    const causeText = formatCause(cause, 0);
    text += `\n${causeText}`;
  }
  return text;
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

const lookupPackageDirectory = (currentUrl) => {
  return findSelfOrAncestorDirectoryUrl(currentUrl, (ancestorDirectoryUrl) => {
    const potentialPackageJsonFileUrl = `${ancestorDirectoryUrl}package.json`;
    return existsSync(new URL(potentialPackageJsonFileUrl));
  });
};

const readPackageAtOrNull = (packageDirectoryUrl) => {
  const packageJsonFileUrl = new URL("./package.json", packageDirectoryUrl);
  let packageJsonFileContentBuffer;
  try {
    packageJsonFileContentBuffer = readFileSync(packageJsonFileUrl, "utf8");
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
    removeNonDirectory(
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

const removeNonDirectory = (sourceUrl) => {
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
    removeNonDirectory(fileUrl);
  };

  const visitSymbolicLink = (symbolicLinkUrl) => {
    removeNonDirectory(symbolicLinkUrl);
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
    packageJsonFileContentBuffer = readFileSync(packageJsonFileUrl, "utf8");
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

export { ANSI, CONTENT_TYPE, DATA_URL, JS_QUOTES, RUNTIME_COMPAT, URL_META, applyFileSystemMagicResolution, applyNodeEsmResolution, asSpecifierWithoutSearch, asUrlWithoutSearch, assertAndNormalizeDirectoryUrl, bufferToEtag, compareFileUrls, composeTwoImportMaps, createDetailedMessage$1 as createDetailedMessage, createLogger, createTaskLog, ensurePathnameTrailingSlash, ensureWindowsDriveLetter, errorToHTML, formatError, generateContentFrame, getCallerPosition, getExtensionsToTry, injectQueryParams, injectQueryParamsIntoSpecifier, isFileSystemPath, isSpecifierForNodeBuiltin, lookupPackageDirectory, memoizeByFirstArgument, moveUrl, normalizeImportMap, normalizeUrl, readCustomConditionsFromProcessArgs, readEntryStatSync, readPackageAtOrNull, registerDirectoryLifecycle, resolveImport, setUrlBasename, setUrlExtension, setUrlFilename, stringifyUrlSite, urlIsOrIsInsideOf, urlToBasename, urlToExtension$1 as urlToExtension, urlToFileSystemPath, urlToFilename$1 as urlToFilename, urlToPathname$1 as urlToPathname, urlToRelativeUrl, validateResponseIntegrity, writeFileSync };
