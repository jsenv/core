import ansiRegex from "ansi-regex";
import stripAnsi from "strip-ansi";

export const parseAnsi = (ansi) => {
  const plainText = stripAnsi(ansi);
  const lines = plainText.split("\n");
  const rows = lines.length;
  let columns = 0;
  lines.forEach((line) => {
    const len = line.length;
    if (len > columns) {
      columns = len;
    }
  });

  const result = {
    raw: ansi,
    plainText,
    rows,
    columns,
    chunks: [],
  };

  let words;
  const delimiters = [];
  {
    const matches = ansi.match(ansiRegex()) || [];
    for (const match of matches) {
      if (!delimiters.includes(match)) {
        delimiters.push(match);
      }
    }
    delimiters.push("\n");

    const splitString = (str, delimiter) => {
      const result = [];
      let index = 0;
      const parts = str.split(delimiter);
      for (const part of parts) {
        result.push(part);
        if (index < parts.length - 1) {
          result.push(delimiter);
        }
        index++;
      }
      return result;
    };
    const splitArray = (array, delimiter) => {
      let result = [];
      for (const part of array) {
        let subRes = splitString(part, delimiter);
        subRes = subRes.filter((str) => {
          return Boolean(str);
        });
        result = result.concat(subRes);
      }
      return result;
    };
    const superSplit = (splittable, delimiters) => {
      if (delimiters.length === 0) {
        return splittable;
      }
      if (typeof splittable === "string") {
        const delimiter = delimiters[delimiters.length - 1];
        const split = splitString(splittable, delimiter);
        return superSplit(split, delimiters.slice(0, -1));
      }
      if (Array.isArray(splittable)) {
        const delimiter = delimiters[delimiters.length - 1];
        const split = splitArray(splittable, delimiter);
        return superSplit(split, delimiters.slice(0, -1));
      }
      return false;
    };
    words = superSplit(ansi, delimiters);
  }

  const styleStack = {
    foregroundColor: [],
    backgroundColor: [],
    boldDim: [],
  };
  const getForegroundColor = () => {
    if (styleStack.foregroundColor.length > 0) {
      return styleStack.foregroundColor[styleStack.foregroundColor.length - 1];
    }
    return false;
  };
  const getBackgroundColor = () => {
    if (styleStack.backgroundColor.length > 0) {
      return styleStack.backgroundColor[styleStack.backgroundColor.length - 1];
    }
    return false;
  };
  const getDim = () => {
    return styleStack.boldDim.includes("dim");
  };
  const getBold = () => {
    return styleStack.boldDim.includes("bold");
  };
  const styleState = {
    italic: false,
    underline: false,
    inverse: false,
    hidden: false,
    strikethrough: false,
  };
  const decoratorEffects = {
    foregroundColorOpen: (color) => styleStack.foregroundColor.push(color),
    foregroundColorClose: () => styleStack.foregroundColor.pop(),
    backgroundColorOpen: (color) => styleStack.backgroundColor.push(color),
    backgroundColorClose: () => styleStack.backgroundColor.pop(),
    boldOpen: () => styleStack.boldDim.push("bold"),
    dimOpen: () => styleStack.boldDim.push("dim"),
    boldDimClose: () => styleStack.boldDim.pop(),
    italicOpen: () => {
      styleState.italic = true;
    },
    italicClose: () => {
      styleState.italic = false;
    },
    underlineOpen: () => {
      styleState.underline = true;
    },
    underlineClose: () => {
      styleState.underline = false;
    },
    inverseOpen: () => {
      styleState.inverse = true;
    },
    inverseClose: () => {
      styleState.inverse = false;
    },
    strikethroughOpen: () => {
      styleState.strikethrough = true;
    },
    strikethroughClose: () => {
      styleState.strikethrough = false;
    },
    reset: () => {
      styleState.strikethrough = false;
      styleState.inverse = false;
      styleState.italic = false;
      styleStack.boldDim = [];
      styleStack.backgroundColor = [];
      styleStack.foregroundColor = [];
    },
  };

  let x = 0;
  let y = 0;
  let nAnsi = 0;
  let nPlain = 0;

  const bundle = (type, value) => {
    const chunk = {
      type,
      value,
      position: {
        x,
        y,
        n: nPlain,
        raw: nAnsi,
      },
    };

    if (type === "text" || type === "ansi") {
      const style = {};

      const foregroundColor = getForegroundColor();
      const backgroundColor = getBackgroundColor();
      const dim = getDim();
      const bold = getBold();

      if (foregroundColor) {
        style.foregroundColor = foregroundColor;
      }

      if (backgroundColor) {
        style.backgroundColor = backgroundColor;
      }

      if (dim) {
        style.dim = dim;
      }

      if (bold) {
        style.bold = bold;
      }

      if (styleState.italic) {
        style.italic = true;
      }

      if (styleState.underline) {
        style.underline = true;
      }

      if (styleState.inverse) {
        style.inverse = true;
      }

      if (styleState.strikethrough) {
        style.strikethrough = true;
      }

      chunk.style = style;
    }

    return chunk;
  };

  for (const word of words) {
    // Newline character
    if (word === "\n") {
      const chunk = bundle("newline", "\n");
      result.chunks.push(chunk);

      x = 0;
      y += 1;
      nAnsi += 1;
      nPlain += 1;
      continue;
    }
    // Text characters
    if (delimiters.includes(word) === false) {
      const chunk = bundle("text", word);
      result.chunks.push(chunk);

      x += word.length;
      nAnsi += word.length;
      nPlain += word.length;
      continue;
    }
    // ANSI Escape characters
    const ansiTag = ansiTags[word];
    const decorator = decorators[ansiTag];
    if (decorator) {
      const decoratorEffect = decoratorEffects[decorator];
      if (decoratorEffect) {
        decoratorEffect(ansiTag);
      }
    }
    const chunk = bundle("ansi", {
      tag: ansiTag,
      ansi: word,
      decorator,
    });
    result.chunks.push(chunk);

    nAnsi += word.length;
  }

  return result;
};

const ansiTags = {
  "\u001B[30m": "black",
  "\u001B[31m": "red",
  "\u001B[32m": "green",
  "\u001B[33m": "yellow",
  "\u001B[34m": "blue",
  "\u001B[35m": "magenta",
  "\u001B[36m": "cyan",
  "\u001B[37m": "white",

  "\u001B[90m": "gray",
  "\u001B[91m": "redBright",
  "\u001B[92m": "greenBright",
  "\u001B[93m": "yellowBright",
  "\u001B[94m": "blueBright",
  "\u001B[95m": "magentaBright",
  "\u001B[96m": "cyanBright",
  "\u001B[97m": "whiteBright",

  "\u001B[39m": "foregroundColorClose",

  "\u001B[40m": "bgBlack",
  "\u001B[41m": "bgRed",
  "\u001B[42m": "bgGreen",
  "\u001B[43m": "bgYellow",
  "\u001B[44m": "bgBlue",
  "\u001B[45m": "bgMagenta",
  "\u001B[46m": "bgCyan",
  "\u001B[47m": "bgWhite",

  "\u001B[100m": "bgGray",
  "\u001B[101m": "bgRedBright",
  "\u001B[102m": "bgGreenBright",
  "\u001B[103m": "bgYellowBright",
  "\u001B[104m": "bgBlueBright",
  "\u001B[105m": "bgMagentaBright",
  "\u001B[106m": "bgCyanBright",
  "\u001B[107m": "bgWhiteBright",

  "\u001B[49m": "backgroundColorClose",

  "\u001B[1m": "boldOpen",
  "\u001B[2m": "dimOpen",
  "\u001B[3m": "italicOpen",
  "\u001B[4m": "underlineOpen",
  "\u001B[7m": "inverseOpen",
  "\u001B[8m": "hiddenOpen",
  "\u001B[9m": "strikethroughOpen",

  "\u001B[22m": "boldDimClose",
  "\u001B[23m": "italicClose",
  "\u001B[24m": "underlineClose",
  "\u001B[27m": "inverseClose",
  "\u001B[28m": "hiddenClose",
  "\u001B[29m": "strikethroughClose",

  "\u001B[0m": "reset",
};
const decorators = {
  black: "foregroundColorOpen",
  red: "foregroundColorOpen",
  green: "foregroundColorOpen",
  yellow: "foregroundColorOpen",
  blue: "foregroundColorOpen",
  magenta: "foregroundColorOpen",
  cyan: "foregroundColorOpen",
  white: "foregroundColorOpen",

  gray: "foregroundColorOpen",
  redBright: "foregroundColorOpen",
  greenBright: "foregroundColorOpen",
  yellowBright: "foregroundColorOpen",
  blueBright: "foregroundColorOpen",
  magentaBright: "foregroundColorOpen",
  cyanBright: "foregroundColorOpen",
  whiteBright: "foregroundColorOpen",

  bgBlack: "backgroundColorOpen",
  bgRed: "backgroundColorOpen",
  bgGreen: "backgroundColorOpen",
  bgYellow: "backgroundColorOpen",
  bgBlue: "backgroundColorOpen",
  bgMagenta: "backgroundColorOpen",
  bgCyan: "backgroundColorOpen",
  bgWhite: "backgroundColorOpen",

  bgGray: "backgroundColorOpen",
  bgRedBright: "backgroundColorOpen",
  bgGreenBright: "backgroundColorOpen",
  bgYellowBright: "backgroundColorOpen",
  bgBlueBright: "backgroundColorOpen",
  bgMagentaBright: "backgroundColorOpen",
  bgCyanBright: "backgroundColorOpen",
  bgWhiteBright: "backgroundColorOpen",

  foregroundColorClose: "foregroundColorClose",
  backgroundColorClose: "backgroundColorClose",

  boldOpen: "boldOpen",
  dimOpen: "dimOpen",
  italicOpen: "italicOpen",
  underlineOpen: "underlineOpen",
  inverseOpen: "inverseOpen",
  hiddenOpen: "hiddenOpen",
  strikethroughOpen: "strikethroughOpen",

  boldDimClose: "boldDimClose",
  italicClose: "italicClose",
  underlineClose: "underlineClose",
  inverseClose: "inverseClose",
  hiddenClose: "hiddenClose",
  strikethroughClose: "strikethroughClose",

  reset: "reset",
};
