import { parseAnsi } from "./parse_ansi.js";
import { startGeneratingSvg } from "./svg_generator.js";

const colorsDefault = {
  black: "#000000",
  red: "#B22222",
  green: "#32CD32",
  yellow: "#DAA520",
  blue: "#4169E1",
  magenta: "#9932CC",
  cyan: "#008B8B",
  white: "#D3D3D3",
  gray: "#A9A9A9",
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
  bgGray: "#A9A9A9",
  bgRedBright: "#FF0000",
  bgGreenBright: "#ADFF2F",
  bgYellowBright: "#FFFF00",
  bgBlueBright: "#87CEEB",
  bgMagentaBright: "#FF00FF",
  bgCyanBright: "#00FFFF",
  bgWhiteBright: "#FFFFFF",
};

export const svgFromAnsi = (
  ansi,
  {
    // Font: (use monospace fonts for best results)
    fontFamily = "SauceCodePro Nerd Font, Source Code Pro, Courier",
    fontFace,
    // Pixel Values:
    fontSize = 14,
    lineHeight = 18,
    paddingTop = 0,
    paddingLeft = 0,
    paddingBottom = 0,
    paddingRight = 0,

    globalBackgroundColor = "#000000",
    globalForegroundColor = "#D3D3D3",
    colors = colorsDefault,
  } = {},
) => {
  const { rows, columns, chunks } = parseAnsi(ansi);
  const font = {
    size: fontSize,
    width: 8.4013671875,
    height: 14,
    face: fontFace,
    family: fontFamily,
    lineHeight,
    emHeightAscent: 10.5546875,
    emHeightDescent: 3.4453125,
  };
  const textAreaWidth = columns * font.width;
  const textAreaHeight = rows * (font.lineHeight + 1) + font.emHeightDescent;
  const globalWidth = paddingLeft + textAreaWidth + paddingRight;
  const globalHeight = paddingTop + textAreaHeight + paddingBottom;
  const offsetTop = paddingTop + font.lineHeight - font.emHeightDescent;
  const offsetLeft = paddingLeft;

  const svg = startGeneratingSvg();
  svg.setAttributes({
    "xmlns": "http://www.w3.org/2000/svg",
    "font-family": font.family,
    "font-size": font.size,
    "viewBox": `0, 0, ${globalWidth}, ${globalHeight}`,
    "backgroundColor": globalBackgroundColor,
  });
  const g = svg.createElement("g");
  g.setAttributes({
    fill: globalForegroundColor,
  });
  svg.appendChild(g);

  const rect = svg.createElement("rect");
  rect.setAttributes({
    x: 0,
    y: 0,
    width: globalWidth,
    height: globalHeight,
    fill: globalBackgroundColor,
  });
  g.appendChild(rect);

  for (const chunk of chunks) {
    const { type, value, style } = chunk;
    if (type !== "text") {
      continue;
    }

    const { position } = chunk;
    const x = offsetLeft + adjustXforWhitespace(value, position.x) * font.width;
    const y = offsetTop + (position.y + font.lineHeight * position.y);
    const w = font.width * value.length;
    const attrs = {};
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
      const rect = svg.createElement("rect");
      rect.setAttributes({
        x,
        y: y - font.lineHeight + font.emHeightDescent,
        width: w,
        height: font.lineHeight + 1,
        fill: backgroundColor,
        ...(opacity ? { opacity } : {}),
      });
      g.appendChild(rect);
    }

    let foregroundColor;
    if (style.foregroundColor) {
      foregroundColor = colors[style.foregroundColor];
      attrs["fill"] = foregroundColor;
    }

    // Underline & Strikethrough:
    // Some SVG implmentations do not support underline and
    // strikethrough for <text> elements (see Sketch 49.2)
    if (style.underline) {
      const yOffset = font.height * 0.14;
      const ys = y - -yOffset;
      const xw = x + w;
      const path = svg.createElement("path");
      path.setAttributes({
        d: `M${x},${ys} L${xw},${ys} Z`,
        stroke: foregroundColor || globalForegroundColor,
      });
      g.appendChild(path);
    }
    if (style.strikethrough) {
      const yOffset = font.height * 0.3;
      const ys = y - yOffset;
      const xw = x + w;
      const path = svg.createElement("path");
      path.setAttributes({
        d: `M${x},${ys} L${xw},${ys} Z`,
        stroke: foregroundColor || globalForegroundColor,
      });
      g.appendChild(path);
    }

    // Do not output elements containing whitespace with no style
    if (
      value.replace(/ /g, "").length === 0 &&
      Object.keys(attrs).length === 0
    ) {
      continue;
    }

    const text = svg.createElement("text");
    text.setAttributes({
      x,
      y,
      ...attrs,
    });
    text.setContent(value);
    g.appendChild(text);
  }

  return svg.renderAsString();
};

// Some SVG Implementations drop whitespaces
// https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/xml:space
const adjustXforWhitespace = (text, x) => {
  const leadingSpace = text.match(/^\s*/g);
  return x + leadingSpace[0].length;
};
