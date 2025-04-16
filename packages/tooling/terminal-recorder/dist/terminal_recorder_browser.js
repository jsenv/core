import { emojiRegex, eastAsianWidth, stripAnsi, ansiRegex, __jsenv_default_import__ } from "./jsenv_terminal_recorder_node_modules.js";

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
  stripAnsi,
});

// inspired by https://github.com/F1LT3R/parse-ansi/blob/master/index.js


const parseAnsi = (ansi) => {
  ansi = ansi.replace(/\r\n/g, "\n"); // normalize windows line endings

  const plainText = stripAnsi(ansi);
  const lines = plainText.split("\n");
  const rows = lines.length;
  let columns = 0;
  for (const line of lines) {
    const len = line.length;
    if (len > columns) {
      columns = len;
    }
  }

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
      styleState.underline = false;
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

  const bundle = (type, value, { width = 0, height = 0 } = {}) => {
    const chunk = {
      type,
      value,
      position: {
        x,
        y,
        n: nPlain,
        raw: nAnsi,
        width,
        height,
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
      const chunk = bundle("newline", "\n", { height: 1 });
      result.chunks.push(chunk);
      x = 0;
      y += 1;
      nAnsi += 1;
      nPlain += 1;
      continue;
    }
    // Text characters
    if (delimiters.includes(word) === false) {
      const width = measureTextWidth(word);
      const chunk = bundle("text", word, { width });
      result.chunks.push(chunk);
      x += width;
      nAnsi += width;
      nPlain += width;
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

const encodeTextContent = (content) => {
  return __jsenv_default_import__.encode(content, {
    decimal: false,
  });
};

const createXmlGenerator = ({
  rootNodeName,
  canSelfCloseNames = [],
  canReceiveChildNames = [],
  canReceiveContentNames = [],
  canInjectWhitespacesAroundContentNames = [],
}) => {
  const createNode = (name, attributes = {}) => {
    const canSelfClose = canSelfCloseNames.includes(name);
    const canReceiveChild = canReceiveChildNames.includes(name);
    const canReceiveContent = canReceiveContentNames.includes(name);
    const canInjectWhitespacesAroundContent =
      canInjectWhitespacesAroundContentNames.includes(name);

    const children = [];

    const node = {
      name,
      content: "",
      contentIsSafe: false,
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
      setContent: (value, isSafe = false) => {
        if (!canReceiveContent) {
          throw new Error(`cannot setContent on ${name}`);
        }
        node.content = value;
        node.contentIsSafe = isSafe;
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
                if (attributeValue === undefined) {
                  continue;
                }
                if (typeof attributeValue === "number") {
                  attributeValue = round(attributeValue);
                }
                if (attributeName === "viewBox") {
                  attributeValue = attributeValue
                    .split(" ")
                    .map((v) => round(parseFloat(v.trim())))
                    .join(" ");
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
            if (canInjectWhitespacesAroundContent) {
              innerHTML += "\n  ";
              innerHTML += "  ".repeat(depth);
            }
            if (node.contentIsSafe) {
              innerHTML += node.content;
            } else {
              const contentEncoded = encodeTextContent(node.content);
              innerHTML += contentEncoded;
            }
            if (canInjectWhitespacesAroundContent) {
              innerHTML += "\n";
              innerHTML += "  ".repeat(depth);
            }
          }
          {
            if (node.children.length > 0) {
              for (const child of node.children) {
                innerHTML += "\n  ";
                innerHTML += "  ".repeat(depth);
                const childHtml = renderNode(child, { depth: depth + 1 });
                innerHTML += childHtml;
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

const createSvgRootNode = createXmlGenerator({
  rootNodeName: "svg",
  canSelfCloseNames: ["path", "rect", "circle"],
  canReceiveChildNames: ["svg", "foreignObject", "g"],
  canReceiveContentNames: ["text", "tspan", "style"],
  canInjectWhitespacesAroundContentNames: ["style"],
});

// Round: Make number values smaller in output
// Eg: 14.23734 becomes 14.24
// Credit @Chris Martin: https://stackoverflow.com/a/43012696/2816869
const round = (x) => {
  const rounded = Number(`${Math.round(`${x}e2`)}e-2`);
  return rounded;
};

const colorsDefault = {
  black: "#000000",
  red: "#cd5555",
  green: "#11bc79",
  yellow: "#DAA520",
  blue: "#4169E1",
  magenta: "#9932CC",
  cyan: "#008B8B",
  white: "#D3D3D3",
  gray: "#7f7f7f",
  redBright: "#FF4500",
  greenBright: "#ADFF2F",
  yellowBright: "#FFFF00",
  blueBright: "#87CEEB",
  magentaBright: "#FF00FF",
  cyanBright: "#00FFFF",
  whiteBright: "#FFFFFF",
  bgBlack: "#000000",
  bgRed: "#B22222",
  bgGreen: "#32CD32",
  bgYellow: "#DAA520",
  bgBlue: "#4169E1",
  bgMagenta: "#9932CC",
  bgCyan: "#008B8B",
  bgWhite: "#D3D3D3",
  bgGray: "#7f7f7f",
  bgRedBright: "#FF0000",
  bgGreenBright: "#ADFF2F",
  bgYellowBright: "#FFFF00",
  bgBlueBright: "#87CEEB",
  bgMagentaBright: "#FF00FF",
  bgCyanBright: "#00FFFF",
  bgWhiteBright: "#FFFFFF",
};
const headDefault = {
  height: 40,
};

const renderTerminalSvg = (
  ansi,
  {
    title = "ansi to terminal",
    // Font: (use monospace fonts for best results)
    fontFamily = "SauceCodePro Nerd Font, Source Code Pro, Courier",
    fontFace,
    // Pixel Values:
    fontSize = 14,
    lineHeight = 18,
    paddingTop = 0,
    paddingLeft = 10,
    paddingBottom = 0,
    paddingRight = 10,

    backgroundColor = "#282c34",
    foregroundColor = "#cccccc",
    colors = colorsDefault,

    // by default: fixed width of 640 + fluid height
    width = 640,
    height,
    maxWidth,
    maxHeight,
    preserveAspectRatio, // "xMidYMid slice",

    head = true,
  } = {},
) => {
  const font = {
    size: fontSize,
    width: 8.4013671875,
    height: 14,
    family: fontFamily,
    lineHeight,
    emHeightDescent: 3.4453125,
  };

  let headerHeight = 0;
  if (head) {
    if (head === true) head = {};
    const headOptions = { ...headDefault, ...head };
    headerHeight = headOptions.height;
  }

  const { rows, columns, chunks } = parseAnsi(ansi);
  const bodyTextWidth = columns * font.width;
  const bodyTextHeight = rows * (font.lineHeight + 1) + font.emHeightDescent;
  const bodyContentWidth = paddingLeft + bodyTextWidth + paddingRight;
  const bodyContentHeight = paddingTop + bodyTextHeight + paddingBottom;
  let contentWidth = bodyContentWidth;
  let contentHeight = headerHeight + bodyContentHeight;

  let computedWidth;
  if (typeof width === "number") {
    computedWidth = width;
  } else {
    computedWidth = contentWidth;
  }
  if (typeof maxWidth === "number" && computedWidth > maxWidth) {
    computedWidth = maxWidth;
  }
  let computedHeight;
  if (typeof height === "number") {
    computedHeight = height;
  } else {
    computedHeight = contentHeight;
  }
  if (typeof maxHeight === "number" && computedHeight > maxHeight) {
    computedHeight = maxHeight;
  }

  const svg = createSvgRootNode({
    "xmlns": "http://www.w3.org/2000/svg",
    "font-family": font.family,
    "font-size": font.size,
    "width": "100%",
    "viewBox": `0 0 ${computedWidth} ${computedHeight}`,
    preserveAspectRatio,
    "background-color": backgroundColor,
  });

  {
    const backgroundGroup = svg.createNode("g", {
      id: "background",
    });
    const backgroundRect = svg.createNode("rect", {
      "x": 1,
      "y": 1,
      "width": computedWidth - 2,
      "height": computedHeight - 2,
      "fill": backgroundColor,
      "stroke": "rgba(255,255,255,0.35)",
      "stroke-width": 1,
      "rx": 8,
    });
    backgroundGroup.appendChild(backgroundRect);
    svg.appendChild(backgroundGroup);
  }

  if (head) {
    {
      const headerGroup = svg.createNode("g", {
        id: "header",
      });
      const iconsGroup = svg.createNode("g", {
        transform: `translate(20,${headerHeight / 2})`,
      });
      const circleA = svg.createNode("circle", {
        cx: 0,
        cy: 0,
        r: 6,
        fill: "#ff5f57",
      });
      iconsGroup.appendChild(circleA);
      const circleB = svg.createNode("circle", {
        cx: 20,
        cy: 0,
        r: 6,
        fill: "#febc2e",
      });
      iconsGroup.appendChild(circleB);
      const circleC = svg.createNode("circle", {
        cx: 40,
        cy: 0,
        r: 6,
        fill: "#28c840",
      });
      iconsGroup.appendChild(circleC);
      headerGroup.appendChild(iconsGroup);

      const text = svg.createNode("text", {
        "fill": "#abb2bf",
        "text-anchor": "middle",
        "x": computedWidth / 2,
        "y": headerHeight / 2,
      });
      text.setContent(title);
      headerGroup.appendChild(text);
      svg.appendChild(headerGroup);
    }
  }

  {
    const bodyComputedHeight = computedHeight - headerHeight + paddingBottom;
    const foreignObject = svg.createNode("foreignObject", {
      id: "body",
      y: headerHeight,
      width: "100%",
      height: bodyComputedHeight,
      // we can't really know in advance the size of the scrollbar
      // so putting overflow: "auto"
      // is not that great as it would create a scrollbar
      // in both axes when a single one is required
      overflow: "hidden",
    });

    svg.appendChild(foreignObject);
    const bodySvg = svg.createNode("svg", {
      "width": bodyContentWidth,
      "height": bodyContentHeight,
      "font-family": "monospace",
      "font-variant-east-asian": "full-width",
      "fill": foregroundColor,
    });
    foreignObject.appendChild(bodySvg);

    const offsetLeft = paddingLeft;
    const offsetTop = paddingTop + font.lineHeight - font.emHeightDescent;
    const textContainer = svg.createNode("g", {
      // transform: `translate(${paddingLeft}, ${offsetTop})`,
    });
    bodySvg.appendChild(textContainer);

    for (const chunk of chunks) {
      const { type, value, style } = chunk;
      if (type !== "text") {
        continue;
      }
      const { position } = chunk;
      const attrs = {};

      // Some SVG Implementations drop whitespaces
      // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/xml:space
      // and https://codepen.io/dmail/pen/wvLvbbP
      if (
        // in the following case we need to preserve whitespaces:
        // - one or more leading whitespace
        // - one or more trailing whitespace
        // - 2 or more whitespace in the middle of the string
        /^\s+|\s\s|\s+$/.test(value)
      ) {
        attrs.style = "white-space:pre";
      }
      const x = offsetLeft + position.x * font.width;
      const y = offsetTop + position.y + font.lineHeight * position.y;
      const w = font.width * position.width;

      if (style.bold) {
        attrs["font-weight"] = "bold";
      }
      if (style.italic) {
        attrs["font-style"] = "italic";
      }

      let opacity = 1;
      if (style.dim) {
        opacity = 0.5;
      }
      if (style.backgroundColor) {
        const backgroundColor = colors[style.backgroundColor];
        const rect = svg.createNode("rect", {
          x,
          y: y - font.lineHeight + font.emHeightDescent,
          width: w,
          height: font.lineHeight + 1,
          fill: backgroundColor,
          ...(opacity ? { opacity } : {}),
        });
        textContainer.appendChild(rect);
      }

      let textForegroundColor;
      if (style.foregroundColor) {
        textForegroundColor = colors[style.foregroundColor];
        attrs["fill"] = textForegroundColor;
      }

      // Underline & Strikethrough:
      // Some SVG implementations do not support underline and
      // strikethrough for <text> elements (see Sketch 49.2)
      if (style.underline) {
        const ys = y - -1.9600000000000002;
        const xw = x + w;
        const path = svg.createNode("path", {
          d: `M${x},${ys} L${xw},${ys} Z`,
          stroke: textForegroundColor || foregroundColor,
        });
        textContainer.appendChild(path);
      }
      if (style.strikethrough) {
        const yOffset = font.height * 0.3;
        const ys = y - yOffset;
        const xw = x + w;
        const path = svg.createNode("path", {
          d: `M${x},${ys} L${xw},${ys} Z`,
          stroke: textForegroundColor || foregroundColor,
        });
        textContainer.appendChild(path);
      }

      if (value.trim() === "") {
        // Do not output elements containing only whitespace
        continue;
      }
      const text = svg.createNode("text", {
        x,
        y,
        ...attrs,
      });
      text.setContent(value);
      textContainer.appendChild(text);
    }
  }

  const svgString = svg.renderAsString();
  return svgString;
};

export { parseAnsi, renderTerminalSvg };
