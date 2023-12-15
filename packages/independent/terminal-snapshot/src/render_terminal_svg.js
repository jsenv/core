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

export const renderTerminalSvg = (
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
    foregroundColor = "#abb2bf",
    colors = colorsDefault,

    maxWidth = 640,
    maxHeight = 480,
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

  const headerHeight = 40;
  const textWidth = columns * font.width;
  const textHeight = rows * (font.lineHeight + 1) + font.emHeightDescent;
  const contentWidth = paddingLeft + textWidth + paddingRight;
  const contentHeight = paddingTop + headerHeight + textHeight + paddingBottom;
  const width = contentWidth > maxWidth ? maxWidth : contentWidth;
  const height = contentHeight > maxHeight ? maxHeight : contentHeight;

  const svg = startGeneratingSvg({
    "xmlns": "http://www.w3.org/2000/svg",
    "font-family": font.family,
    "font-size": font.size,
    width,
    height,
    // "viewBox": `0, 0, ${globalWidth}, ${globalHeight}`,
    backgroundColor,
  });

  background: {
    const backgroundGroup = svg.createElement("g", {
      id: "background",
    });
    const backgroundRect = svg.createElement("rect", {
      "x": 1,
      "y": 1,
      "width": width - 2,
      "height": height - 2,
      "fill": backgroundColor,
      "stroke": "rgba(255,255,255,0.35)",
      "stroke-width": 1,
      "rx": 8,
    });
    backgroundGroup.appendChild(backgroundRect);
    svg.appendChild(backgroundGroup);
  }

  header: {
    const headerGroup = svg.createElement("g", {
      id: "header",
    });
    const iconsGroup = svg.createElement("g", {
      transform: `translate(20,${headerHeight / 2})`,
    });
    const circleA = svg.createElement("circle", {
      cx: 0,
      cy: 0,
      r: 6,
      fill: "#ff5f57",
    });
    iconsGroup.appendChild(circleA);
    const circleB = svg.createElement("circle", {
      cx: 20,
      cy: 0,
      r: 6,
      fill: "#febc2e",
    });
    iconsGroup.appendChild(circleB);
    const circleC = svg.createElement("circle", {
      cx: 40,
      cy: 0,
      r: 6,
      fill: "#28c840",
    });
    iconsGroup.appendChild(circleC);
    headerGroup.appendChild(iconsGroup);

    const text = svg.createElement("text", {
      "class": "terminal-3560942001-title",
      "fill": "#abb2bf",
      "text-anchor": "middle",
      "x": width / 2,
      "y": headerHeight / 2,
    });
    text.setContent(title);
    headerGroup.appendChild(text);
    svg.appendChild(headerGroup);
  }

  body: {
    const foreignObject = svg.createElement("foreignObject", {
      id: "body",
      y: headerHeight,
      width,
      height: height - headerHeight - paddingTop - paddingBottom,
      overflow: "auto",
    });
    svg.appendChild(foreignObject);
    const bodySvg = svg.createElement("svg", {
      "width": paddingLeft + textWidth + paddingRight,
      "height": textHeight,
      "font-family": "monospace",
      "font-variant-east-asian": "full-width",
      "fill": foregroundColor,
    });
    foreignObject.appendChild(bodySvg);

    const offsetTop = paddingTop + font.lineHeight - font.emHeightDescent;
    const offsetLeft = paddingLeft;
    for (const chunk of chunks) {
      const { type, value, style } = chunk;
      if (type !== "text") {
        continue;
      }

      const { position } = chunk;
      const x =
        offsetLeft + adjustXforWhitespace(value, position.x) * font.width;
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
        const rect = svg.createElement("rect", {
          x,
          y: y - font.lineHeight + font.emHeightDescent,
          width: w,
          height: font.lineHeight + 1,
          fill: backgroundColor,
          ...(opacity ? { opacity } : {}),
        });
        bodySvg.appendChild(rect);
      }

      let textForegroundColor;
      if (style.foregroundColor) {
        textForegroundColor = colors[style.foregroundColor];
        attrs["fill"] = textForegroundColor;
      }

      // Underline & Strikethrough:
      // Some SVG implmentations do not support underline and
      // strikethrough for <text> elements (see Sketch 49.2)
      if (style.underline) {
        const yOffset = font.height * 0.14;
        const ys = y - -yOffset;
        const xw = x + w;
        const path = svg.createElement("path", {
          d: `M${x},${ys} L${xw},${ys} Z`,
          stroke: textForegroundColor || foregroundColor,
        });
        bodySvg.appendChild(path);
      }
      if (style.strikethrough) {
        const yOffset = font.height * 0.3;
        const ys = y - yOffset;
        const xw = x + w;
        const path = svg.createElement("path", {
          d: `M${x},${ys} L${xw},${ys} Z`,
          stroke: textForegroundColor || foregroundColor,
        });
        bodySvg.appendChild(path);
      }

      // Do not output elements containing whitespace with no style
      if (
        value.replace(/ /g, "").length === 0 &&
        Object.keys(attrs).length === 0
      ) {
        continue;
      }

      const text = svg.createElement("text", {
        x,
        y,
        ...attrs,
      });
      text.setContent(value);
      bodySvg.appendChild(text);
    }
  }

  return svg.renderAsString();
};

// Some SVG Implementations drop whitespaces
// https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/xml:space
const adjustXforWhitespace = (text, x) => {
  const leadingSpace = text.match(/^\s*/g);
  return x + leadingSpace[0].length;
};
