import process$1 from "node:process";
import os from "node:os";
import tty from "node:tty";

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
// https://github.com/Marak/colors.js/blob/master/lib/styles.js
// https://stackoverflow.com/a/75985833/2634179
const RESET = "\x1b[0m";

const ANSI = {
  supported: processSupportsBasicColor,

  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  MAGENTA: "\x1b[35m",
  GREY: "\x1b[90m",
  color: (text, ANSI_COLOR) => {
    return ANSI.supported ? `${ANSI_COLOR}${text}${RESET}` : text;
  },

  BOLD: "\x1b[1m",
  effect: (text, ANSI_EFFECT) => {
    return ANSI.supported ? `${ANSI_EFFECT}${text}${RESET}` : text;
  },
};

// GitHub workflow does support ANSI but "supports-color" returns false
// because stream.isTTY returns false, see https://github.com/actions/runner/issues/241
if (
  process.env.GITHUB_WORKFLOW &&
  // Check on FORCE_COLOR is to ensure it is prio over GitHub workflow check
  // in unit test we use process.env.FORCE_COLOR = 'false' to fake
  // that colors are not supported. Let it have priority
  process.env.FORCE_COLOR !== "false"
) {
  ANSI.supported = true;
}

function isUnicodeSupported() {
	if (process$1.platform !== 'win32') {
		return process$1.env.TERM !== 'linux'; // Linux console (kernel)
	}

	return Boolean(process$1.env.WT_SESSION) // Windows Terminal
		|| Boolean(process$1.env.TERMINUS_SUBLIME) // Terminus (<0.2.27)
		|| process$1.env.ConEmuTask === '{cmd::Cmder}' // ConEmu and cmder
		|| process$1.env.TERM_PROGRAM === 'Terminus-Sublime'
		|| process$1.env.TERM_PROGRAM === 'vscode'
		|| process$1.env.TERM === 'xterm-256color'
		|| process$1.env.TERM === 'alacritty'
		|| process$1.env.TERMINAL_EMULATOR === 'JetBrains-JediTerm';
}

// see also https://github.com/sindresorhus/figures


const UNICODE = {
  supported: isUnicodeSupported(),

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
};

const inspectBoolean = (value) => value.toString();

const inspectNull = () => "null";

// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/rules/numeric-separators-style.js

const inspectNumber = (value, { numericSeparator }) => {
  if (isNegativeZero(value)) {
    return "-0";
  }
  // isNaN
  // eslint-disable-next-line no-self-compare
  if (value !== value) {
    return "NaN";
  }
  if (value === Infinity) {
    return "Infinity";
  }
  if (value === -Infinity) {
    return "-Infinity";
  }
  const numberString = String(value);
  if (!numericSeparator) {
    return numberString;
  }
  const {
    number,
    mark = "",
    sign = "",
    power = "",
  } = numberString.match(
    /^(?<number>.*?)(?:(?<mark>e)(?<sign>[+-])?(?<power>\d+))?$/i,
  ).groups;
  const numberWithSeparators = formatNumber(number);
  const powerWithSeparators = addSeparator(power, {
    minimumDigits: 5,
    groupLength: 3,
  });
  return `${numberWithSeparators}${mark}${sign}${powerWithSeparators}`;
};

// Use this and instead of Object.is(value, -0)
// because in some corner cases firefox returns false
// for Object.is(-0, -0)
const isNegativeZero = (value) => {
  return value === 0 && 1 / value === -Infinity;
};

const formatNumber = (numberString) => {
  const parts = numberString.split(".");
  const [integer, fractional] = parts;

  if (parts.length === 2) {
    const integerWithSeparators = addSeparator(integer, {
      minimumDigits: 5,
      groupLength: 3,
    });
    return `${integerWithSeparators}.${fractional}`;
  }

  return addSeparator(integer, {
    minimumDigits: 5,
    groupLength: 3,
  });
};

const addSeparator = (numberString, { minimumDigits, groupLength }) => {
  if (numberString[0] === "-") {
    return `-${groupDigits(numberString.slice(1), {
      minimumDigits,
      groupLength,
    })}`;
  }
  return groupDigits(numberString, { minimumDigits, groupLength });
};

const groupDigits = (digits, { minimumDigits, groupLength }) => {
  const digitCount = digits.length;
  if (digitCount < minimumDigits) {
    return digits;
  }

  let digitsWithSeparator = digits.slice(-groupLength);
  let remainingDigits = digits.slice(0, -groupLength);
  while (remainingDigits.length) {
    const group = remainingDigits.slice(-groupLength);
    remainingDigits = remainingDigits.slice(0, -groupLength);
    digitsWithSeparator = `${group}_${digitsWithSeparator}`;
  }
  return digitsWithSeparator;
};

// const addSeparatorFromLeft = (value, { minimumDigits, groupLength }) => {
//   const { length } = value;
//   if (length < minimumDigits) {
//     return value;
//   }

//   const parts = [];
//   for (let start = 0; start < length; start += groupLength) {
//     const end = Math.min(start + groupLength, length);
//     parts.push(value.slice(start, end));
//   }
//   return parts.join("_");
// };

const DOUBLE_QUOTE = `"`;
const SINGLE_QUOTE = `'`;
const BACKTICK = "`";

const inspectString = (
  value,
  {
    quote = "auto",
    canUseTemplateString = false,
    preserveLineBreaks = false,
    quoteDefault = DOUBLE_QUOTE,
  } = {},
) => {
  quote =
    quote === "auto"
      ? determineQuote(value, { canUseTemplateString, quoteDefault })
      : quote;
  if (quote === BACKTICK) {
    return `\`${escapeTemplateStringSpecialCharacters(value)}\``;
  }
  return surroundStringWith(value, { quote, preserveLineBreaks });
};

// https://github.com/mgenware/string-to-template-literal/blob/main/src/main.ts#L1
const escapeTemplateStringSpecialCharacters = (string) => {
  string = String(string);
  let i = 0;
  let escapedString = "";
  while (i < string.length) {
    const char = string[i];
    i++;
    escapedString += isTemplateStringSpecialChar(char) ? `\\${char}` : char;
  }
  return escapedString;
};

const isTemplateStringSpecialChar = (char) =>
  templateStringSpecialChars.indexOf(char) > -1;
const templateStringSpecialChars = ["\\", "`", "$"];

const determineQuote = (
  string,
  { canUseTemplateString, quoteDefault = DOUBLE_QUOTE } = {},
) => {
  const containsDoubleQuote = string.includes(DOUBLE_QUOTE);
  if (!containsDoubleQuote) {
    return DOUBLE_QUOTE;
  }
  const containsSimpleQuote = string.includes(SINGLE_QUOTE);
  if (!containsSimpleQuote) {
    return SINGLE_QUOTE;
  }
  if (canUseTemplateString) {
    const containsBackTick = string.includes(BACKTICK);
    if (!containsBackTick) {
      return BACKTICK;
    }
  }
  const doubleQuoteCount = string.split(DOUBLE_QUOTE).length - 1;
  const singleQuoteCount = string.split(SINGLE_QUOTE).length - 1;
  if (singleQuoteCount > doubleQuoteCount) {
    return DOUBLE_QUOTE;
  }
  if (doubleQuoteCount > singleQuoteCount) {
    return SINGLE_QUOTE;
  }
  return quoteDefault;
};

const inspectChar = (char, { quote, preserveLineBreaks }) => {
  const point = char.charCodeAt(0);
  if (preserveLineBreaks && (char === "\n" || char === "\r")) {
    return char;
  }
  if (
    char === quote ||
    point === 92 ||
    point < 32 ||
    (point > 126 && point < 160) ||
    // line separators
    point === 8232 ||
    point === 8233
  ) {
    const replacement =
      char === quote
        ? `\\${quote}`
        : point === 8232
          ? "\\u2028"
          : point === 8233
            ? "\\u2029"
            : meta[point];
    return replacement;
  }
  return char;
};

// https://github.com/jsenv/jsenv-uneval/blob/6c97ef9d8f2e9425a66f2c88347e0a118d427f3a/src/internal/escapeString.js#L3
// https://github.com/jsenv/jsenv-inspect/blob/bb11de3adf262b68f71ed82b0a37d4528dd42229/src/internal/string.js#L3
// https://github.com/joliss/js-string-escape/blob/master/index.js
// http://javascript.crockford.com/remedial.html
const surroundStringWith = (string, { quote, preserveLineBreaks }) => {
  let result = "";
  let last = 0;
  const lastIndex = string.length;
  let i = 0;
  while (i < lastIndex) {
    const char = string[i];
    const replacement = inspectChar(char, { quote, preserveLineBreaks });
    if (char !== replacement) {
      if (last === i) {
        result += replacement;
      } else {
        result += `${string.slice(last, i)}${replacement}`;
      }
      last = i + 1;
    }
    i++;
  }
  if (last !== lastIndex) {
    result += string.slice(last);
  }
  return `${quote}${result}${quote}`;
};

// prettier-ignore
const meta = [
  '\\x00', '\\x01', '\\x02', '\\x03', '\\x04', '\\x05', '\\x06', '\\x07', // x07
  '\\b', '\\t', '\\n', '\\x0B', '\\f', '\\r', '\\x0E', '\\x0F',           // x0F
  '\\x10', '\\x11', '\\x12', '\\x13', '\\x14', '\\x15', '\\x16', '\\x17', // x17
  '\\x18', '\\x19', '\\x1A', '\\x1B', '\\x1C', '\\x1D', '\\x1E', '\\x1F', // x1F
  '', '', '', '', '', '', '', "\\'", '', '', '', '', '', '', '', '',      // x2F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',         // x3F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',         // x4F
  '', '', '', '', '', '', '', '', '', '', '', '', '\\\\', '', '', '',     // x5F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',         // x6F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '\\x7F',    // x7F
  '\\x80', '\\x81', '\\x82', '\\x83', '\\x84', '\\x85', '\\x86', '\\x87', // x87
  '\\x88', '\\x89', '\\x8A', '\\x8B', '\\x8C', '\\x8D', '\\x8E', '\\x8F', // x8F
  '\\x90', '\\x91', '\\x92', '\\x93', '\\x94', '\\x95', '\\x96', '\\x97', // x97
  '\\x98', '\\x99', '\\x9A', '\\x9B', '\\x9C', '\\x9D', '\\x9E', '\\x9F', // x9F
];

const inspectSymbol = (value, { nestedInspect, parenthesis }) => {
  const symbolDescription = symbolToDescription(value);
  const symbolDescriptionSource = symbolDescription
    ? nestedInspect(symbolDescription)
    : "";
  const symbolSource = `Symbol(${symbolDescriptionSource})`;

  if (parenthesis) return `${symbolSource}`;
  return symbolSource;
};

const symbolToDescription =
  "description" in Symbol.prototype
    ? (symbol) => symbol.description
    : (symbol) => {
        const toStringResult = symbol.toString();
        const openingParenthesisIndex = toStringResult.indexOf("(");
        const closingParenthesisIndex = toStringResult.indexOf(")");
        const symbolDescription = toStringResult.slice(
          openingParenthesisIndex + 1,
          closingParenthesisIndex,
        );
        return symbolDescription;
      };

const inspectUndefined = () => "undefined";

const inspectBigInt = (value) => {
  return `${value}n`;
};

const preNewLineAndIndentation = (
  value,
  { depth, indentUsingTab, indentSize },
) => {
  return `${newLineAndIndent({
    count: depth + 1,
    useTabs: indentUsingTab,
    size: indentSize,
  })}${value}`;
};

const postNewLineAndIndentation = ({ depth, indentUsingTab, indentSize }) => {
  return newLineAndIndent({
    count: depth,
    useTabs: indentUsingTab,
    size: indentSize,
  });
};

const newLineAndIndent = ({ count, useTabs, size }) => {
  if (useTabs) {
    // eslint-disable-next-line prefer-template
    return "\n" + "\t".repeat(count);
  }
  // eslint-disable-next-line prefer-template
  return "\n" + " ".repeat(count * size);
};

const wrapNewLineAndIndentation = (
  value,
  { depth, indentUsingTab, indentSize },
) => {
  return `${preNewLineAndIndentation(value, {
    depth,
    indentUsingTab,
    indentSize,
  })}${postNewLineAndIndentation({ depth, indentUsingTab, indentSize })}`;
};

const inspectConstructor = (value, { parenthesis, useNew }) => {
  let formattedString = value;
  if (parenthesis) {
    formattedString = `(${value})`;
  }
  if (useNew) {
    formattedString = `new ${formattedString}`;
  }
  return formattedString;
};

const inspectArray = (
  value,
  {
    seen = [],
    nestedInspect,
    depth,
    indentUsingTab,
    indentSize,
    parenthesis,
    useNew,
  },
) => {
  if (seen.indexOf(value) > -1) {
    return "Symbol.for('circular')";
  }
  seen.push(value);

  let valuesSource = "";
  let i = 0;
  const j = value.length;

  while (i < j) {
    const valueSource = value.hasOwnProperty(i)
      ? nestedInspect(value[i], { seen })
      : "";
    if (i === 0) {
      valuesSource += valueSource;
    } else {
      valuesSource += `,${preNewLineAndIndentation(valueSource, {
        depth,
        indentUsingTab,
        indentSize,
      })}`;
    }
    i++;
  }

  let arraySource;
  if (valuesSource.length) {
    arraySource = wrapNewLineAndIndentation(valuesSource, {
      depth,
      indentUsingTab,
      indentSize,
    });
  } else {
    arraySource = "";
  }

  arraySource = `[${arraySource}]`;

  return inspectConstructor(arraySource, { parenthesis, useNew });
};

const inspectBigIntObject = (value, { nestedInspect }) => {
  const bigIntSource = nestedInspect(value.valueOf());

  return `BigInt(${bigIntSource})`;
};

const inspectBooleanObject = (
  value,
  { nestedInspect, useNew, parenthesis },
) => {
  const booleanSource = nestedInspect(value.valueOf());
  return inspectConstructor(`Boolean(${booleanSource})`, {
    useNew,
    parenthesis,
  });
};

const inspectError = (error, { nestedInspect, useNew, parenthesis }) => {
  const messageSource = nestedInspect(error.message);

  const errorSource = inspectConstructor(
    `${errorToConstructorName(error)}(${messageSource})`,
    {
      useNew,
      parenthesis,
    },
  );
  return errorSource;
};

const errorToConstructorName = ({ name }) => {
  if (derivedErrorNameArray.includes(name)) {
    return name;
  }
  return "Error";
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Error_types
const derivedErrorNameArray = [
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError",
];

const inspectDate = (value, { nestedInspect, useNew, parenthesis }) => {
  const dateSource = nestedInspect(value.valueOf(), {
    numericSeparator: false,
  });
  return inspectConstructor(`Date(${dateSource})`, { useNew, parenthesis });
};

const inspectFunction = (
  value,
  { showFunctionBody, parenthesis, depth },
) => {
  let functionSource;
  if (showFunctionBody) {
    functionSource = value.toString();
  } else {
    const isArrowFunction = value.prototype === undefined;
    const head = isArrowFunction
      ? "() =>"
      : `function ${depth === 0 ? value.name : ""}()`;
    functionSource = `${head} {/* hidden */}`;
  }

  if (parenthesis) {
    return `(${functionSource})`;
  }
  return functionSource;
};

const inspectNumberObject = (
  value,
  { nestedInspect, useNew, parenthesis },
) => {
  const numberSource = nestedInspect(value.valueOf());
  return inspectConstructor(`Number(${numberSource})`, { useNew, parenthesis });
};

const inspectObject = (
  value,
  {
    nestedInspect,
    seen = [],
    depth,
    indentUsingTab,
    indentSize,
    objectConstructor,
    parenthesis,
    useNew,
  },
) => {
  if (seen.indexOf(value) > -1) return "Symbol.for('circular')";

  seen.push(value);

  const propertySourceArray = [];
  Object.getOwnPropertyNames(value).forEach((propertyName) => {
    const propertyNameAsNumber = parseInt(propertyName, 10);
    const propertyNameSource = nestedInspect(
      Number.isInteger(propertyNameAsNumber)
        ? propertyNameAsNumber
        : propertyName,
    );
    propertySourceArray.push({
      nameOrSymbolSource: propertyNameSource,
      valueSource: nestedInspect(value[propertyName], { seen }),
    });
  });
  Object.getOwnPropertySymbols(value).forEach((symbol) => {
    propertySourceArray.push({
      nameOrSymbolSource: `[${nestedInspect(symbol)}]`,
      valueSource: nestedInspect(value[symbol], { seen }),
    });
  });

  let propertiesSource = "";
  propertySourceArray.forEach(({ nameOrSymbolSource, valueSource }, index) => {
    if (index === 0) {
      propertiesSource += `${nameOrSymbolSource}: ${valueSource}`;
    } else {
      propertiesSource += `,${preNewLineAndIndentation(
        `${nameOrSymbolSource}: ${valueSource}`,
        {
          depth,
          indentUsingTab,
          indentSize,
        },
      )}`;
    }
  });

  let objectSource;
  if (propertiesSource.length) {
    objectSource = `${wrapNewLineAndIndentation(propertiesSource, {
      depth,
      indentUsingTab,
      indentSize,
    })}`;
  } else {
    objectSource = "";
  }

  if (objectConstructor) {
    objectSource = `Object({${objectSource}})`;
  } else {
    objectSource = `{${objectSource}}`;
  }

  return inspectConstructor(objectSource, { parenthesis, useNew });
};

const inspectRegExp = (value) => value.toString();

const inspectStringObject = (
  value,
  { nestedInspect, useNew, parenthesis },
) => {
  const stringSource = nestedInspect(value.valueOf());

  return inspectConstructor(`String(${stringSource})`, { useNew, parenthesis });
};

// primitives

const inspectMethodSymbol = Symbol.for("inspect");

const inspectValue = (value, options) => {
  const customInspect = value && value[inspectMethodSymbol];
  if (customInspect) {
    return customInspect(options);
  }
  const primitiveType = primitiveTypeFromValue(value);
  const primitiveStringifier = primitiveStringifiers[primitiveType];
  if (primitiveStringifier) {
    return primitiveStringifier(value, options);
  }
  const compositeType = compositeTypeFromObject(value);
  const compositeStringifier = compositeStringifiers[compositeType];
  if (compositeStringifier) {
    return compositeStringifier(value, options);
  }
  return inspectConstructor(
    `${compositeType}(${inspectObject(value, options)})`,
    {
      ...options,
      parenthesis: false,
    },
  );
};

const primitiveTypeFromValue = (value) => {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  return typeof value;
};
const primitiveStringifiers = {
  boolean: inspectBoolean,
  function: inspectFunction,
  null: inspectNull,
  number: inspectNumber,
  string: inspectString,
  symbol: inspectSymbol,
  undefined: inspectUndefined,
  bigint: inspectBigInt,
};
const compositeTypeFromObject = (object) => {
  if (typeof object === "object" && Object.getPrototypeOf(object) === null) {
    return "Object";
  }
  const toStringResult = toString.call(object);
  // returns format is '[object ${tagName}]';
  // and we want ${tagName}
  const tagName = toStringResult.slice("[object ".length, -1);
  if (tagName === "Object") {
    const objectConstructorName = object.constructor.name;
    if (objectConstructorName !== "Object") {
      return objectConstructorName;
    }
  }
  return tagName;
};
const { toString } = Object.prototype;

const compositeStringifiers = {
  Array: inspectArray,
  BigInt: inspectBigIntObject,
  Boolean: inspectBooleanObject,
  Error: inspectError,
  Date: inspectDate,
  Function: inspectFunction,
  Number: inspectNumberObject,
  Object: inspectObject,
  RegExp: inspectRegExp,
  String: inspectStringObject,
};

const inspect = (
  value,
  {
    parenthesis = false,
    quote = "auto",
    canUseTemplateString = true,
    useNew = false,
    objectConstructor = false,
    showFunctionBody = false,
    indentUsingTab = false,
    indentSize = 2,
    numericSeparator = true,
    preserveLineBreaks = false,
  } = {},
) => {
  const scopedInspect = (scopedValue, scopedOptions) => {
    const options = {
      ...scopedOptions,
      nestedInspect: (nestedValue, nestedOptions = {}) => {
        return scopedInspect(nestedValue, {
          ...scopedOptions,
          depth: scopedOptions.depth + 1,
          ...nestedOptions,
        });
      },
    };
    return inspectValue(scopedValue, options);
  };

  return scopedInspect(value, {
    parenthesis,
    quote,
    canUseTemplateString,
    useNew,
    objectConstructor,
    showFunctionBody,
    indentUsingTab,
    indentSize,
    numericSeparator,
    preserveLineBreaks,
    depth: 0,
  });
};

const formatDefault = (v) => v;

const inspectFileContent = ({
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

const inspectEllapsedTime = (ms, { short } = {}) => {
  if (ms < 1000) {
    return short ? "0s" : "0 second";
  }
  const { primary, remaining } = parseMs(ms);
  if (!remaining) {
    return inspectEllapsedUnit(primary, short);
  }
  return `${inspectEllapsedUnit(primary, short)} and ${inspectEllapsedUnit(
    remaining,
    short,
  )}`;
};
const inspectEllapsedUnit = (unit, short) => {
  const count =
    unit.name === "second" ? Math.floor(unit.count) : Math.round(unit.count);
  let name = unit.name;
  if (short) {
    name = unitShort[name];
    if (count <= 1) {
      return `${count}${name}`;
    }
    return `${count}${name}s`;
  }
  if (count <= 1) {
    return `${count} ${name}`;
  }
  return `${count} ${name}s`;
};
const unitShort = {
  year: "y",
  month: "m",
  week: "w",
  day: "d",
  hour: "h",
  minute: "m",
  second: "s",
};

const inspectDuration = (
  ms,
  { short, rounded = true, decimals } = {},
) => {
  // ignore ms below meaningfulMs so that:
  // inspectDuration(0.5) -> "0 second"
  // inspectDuration(1.1) -> "0.001 second" (and not "0.0011 second")
  // This tool is meant to be read by humans and it would be barely readable to see
  // "0.0001 second" (stands for 0.1 millisecond)
  // yes we could return "0.1 millisecond" but we choosed consistency over precision
  // so that the prefered unit is "second" (and does not become millisecond when ms is super small)
  if (ms < 1) {
    return short ? "0s" : "0 second";
  }
  const { primary, remaining } = parseMs(ms);
  if (!remaining) {
    return inspectDurationUnit(primary, {
      decimals:
        decimals === undefined ? (primary.name === "second" ? 1 : 0) : decimals,
      short,
      rounded,
    });
  }
  return `${inspectDurationUnit(primary, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
  })} and ${inspectDurationUnit(remaining, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
  })}`;
};
const inspectDurationUnit = (unit, { decimals, short, rounded }) => {
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

const inspectFileSize = (numberOfBytes, { decimals, short } = {}) => {
  return inspectBytes(numberOfBytes, { decimals, short });
};

const inspectMemoryUsage = (metricValue, { decimals, short } = {}) => {
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

export { ANSI, UNICODE, determineQuote, distributePercentages, inspect, inspectChar, inspectDuration, inspectEllapsedTime, inspectFileContent, inspectFileSize, inspectMemoryUsage, inspectMethodSymbol };
