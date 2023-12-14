import { parseAnsi } from "./parse_ansi.js";

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
    // Assume we would like a Retina-ready image
    scale = 1,

    foregroundColor,
    backgroundColor,
  } = {},
) => {
  let svg = ``;
  const { rows, columns, chunks } = parseAnsi(ansi);

  const font = {
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
  const width = paddingLeft + textAreaWidth + paddingRight;
  const height = paddingTop + textAreaHeight + paddingBottom;
  const offsetTop = paddingTop + font.lineHeight - font.emHeightDescent;
  const offsetLeft = paddingLeft;

  svg += openSvgTag("svg", {
    "xmlns": "http://www.w3.org/2000/svg",
    "font-family": font.family,
    "font-size": font.size,
    "viewBox": `0, 0, ${round(width)}, ${round(height)}`,
    backgroundColor,
  });
  svg += "\n  ";
  svg += openSvgTag("g", { fill: foregroundColor });
  svg += "\n    ";
  svg += selfClosingSvgTag("rect", {
    x: 0,
    y: 0,
    width,
    height,
    color: backgroundColor,
  });

  for (const chunk of chunks) {
    const { type, value, position, style } = chunk;
    if (type !== "text") {
      continue;
    }

    const x = offsetLeft + adjustXforWhitespace(value, position.x) * font.width;
    const y = offsetTop + (position.y + font.lineHeight * position.y);
    const w = font.width * value.length;
    const fontStyle = {};
    const attrs = {};
    let opacity = 1;

    if (style.bold) {
      attrs["font-weight"] = "bold";
    }
    if (style.italic) {
      attrs["font-style"] = "italic";
    }
    if (style.dim) {
      opacity = 0.5;
    }

    if (style.backgroundColor) {
      const backgroundColor = opts.colors[style.backgroundColor];
      svg += selfClosingSvgTag("rect", {
        x,
        y: y - font.lineHeight + font.emHeightDescent,
        width: w,
        height: font.lineHeight + 1,
        color: backgroundColor,
        ...(opacity ? { opacity } : {}),
      });
    }

    let foregroundColorScoped;
    if (style.foregroundColor) {
      foregroundColorScoped = opts.colors[style.foregroundColor];
      attrs["fill"] = foregroundColor;
    }

    // Underline & Strikethrough:
    // Some SVG implmentations do not support underline and
    // strikethrough for <text> elements (see Sketch 49.2)

    if (style.underline) {
      const yOffset = font.height * 0.14;
      const ys = y - -yOffset;
      const xw = x + w;
      svg += selfClosingSvgTag("path", {
        d: `M${x},${ys} L${xw},${ys} Z`,
        color: foregroundColorScoped || foregroundColor,
      });
    }

    if (style.strikethrough) {
      const yOffset = font.height * 0.3;
      const ys = y - yOffset;
      const xw = x + w;
      svg += selfClosingSvgTag("path", {
        d: `M${x},${ys} L${xw},${ys} Z`,
        color: foregroundColorScoped || foregroundColor,
      });
    }

    // Do not output elements containing whitespace with no style
    if (
      value.replace(/ /g, "").length === 0 &&
      Object.keys(attrs).length === 0
    ) {
      continue;
    }

    svg += openSvgTag("text", {
      x,
      y,
      fontStyle,
    });
    const entified = he.encode(value, { decimal: false });
    svg += entified;
    svg += "\n</text>";
  }

  svg += `</g></svg>`;

  return svg;
};

const openSvgTag = (name, attrs = {}) => {
  let openTagString = "";

  openTagString += `<${name}`;
  write_attributes: {
    const attributeNames = Object.keys(attrs);
    if (attributeNames.length) {
      openTagString += " ";
      for (const attributeName of attributeNames) {
        let attributeValue = attrs[attributeName];
        if (
          attributeName === "width" ||
          attributeName === "height" ||
          attributeName === "x" ||
          attributeName === "y"
        ) {
          attributeValue = round(attributeValue);
        }
        openTagString += `${attributeName}=${attributeValue}`;
      }
    }
  }
  openTagString += ">";
  return openTagString;
};

const selfClosingSvgTag = (name, attrs) => {
  return `${openSvgTag(name, attrs).slice(1)}/>`;
};

// Some SVG Implementations drop whitespaces
// https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/xml:space
const adjustXforWhitespace = (text, x) => {
  const leadingSpace = text.match(/^\s*/g);
  return x + leadingSpace[0].length;
};

// Round: Make number values smaller in output
// Eg: 14.23734 becomes 14.24
// Credit @Chris Martin: https://stackoverflow.com/a/43012696/2816869
const round = (x) => {
  const rounded = Number(`${Math.round(`${x}e2`)}e-2`);
  return rounded;
};
