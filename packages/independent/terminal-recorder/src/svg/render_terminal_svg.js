import prettier from "prettier";
import { parseAnsi } from "./parse_ansi.js";
import { createSvgRootNode } from "./xml_generator.js";

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

export const renderTerminalSvg = async (
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
  const bodyContentWidth = paddingLeft + textWidth + paddingRight;
  const bodyContentHeight = paddingTop + textHeight + paddingBottom;
  const contentWidth = bodyContentWidth;
  const contentHeight = headerHeight + bodyContentHeight;

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
    "width": computedWidth,
    "height": computedHeight,
    backgroundColor,
  });

  background: {
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

  header: {
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

  body: {
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
      const x =
        offsetLeft + (position.x + leadingWhitespaceWidth(value)) * font.width;
      const y = offsetTop + position.y + font.lineHeight * position.y;
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
        const yOffset = font.height * 0.14;
        const ys = y - -yOffset;
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
  const formatted = await prettier.format(svgString, {
    parser: "html",
  });
  return formatted;
};

// Some SVG Implementations drop whitespaces
// https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/xml:space
// and https://codepen.io/dmail/pen/wvLvbbP
const leadingWhitespaceWidth = (text) => {
  if (text.trim() === "") {
    return 0;
  }
  const leadingSpace = text.match(/^\s*/g);
  return leadingSpace[0].length;
};
