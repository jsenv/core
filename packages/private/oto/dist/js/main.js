import { useResizeObserver, registerRoutes, useStructuredMemo, useKeyEffect, useDrawImage, useImageLoader, fromTransformations, useFontFace } from "/oto_packages.js";
import { d, _, u, k, D, A, F, E, d$1, w, E$1, H, q, y, T, b } from "/oto_node_modules.js";

const goblinFontUrl = new URL(__v__("/other/AGoblinAppears-o2aV.ttf"), import.meta.url).href;
new URL(__v__("/other/SuperLegendBoy-4w8Y.ttf"), import.meta.url).href;


const HOVER_TEXT_COLOR = "dodgerblue";
const FOCUSED_OUTLINE_COLOR = "white";

const getAvailableSize = (element) => {
  const { paddingSizes, borderSizes } = getPaddingAndBorderSizes(element);
  const boundingClientRect = element.getBoundingClientRect();
  let availableWidth = boundingClientRect.width;
  let availableHeight = boundingClientRect.height;
  availableWidth -=
    paddingSizes.left +
    paddingSizes.right +
    borderSizes.left +
    borderSizes.right;
  availableHeight -=
    paddingSizes.top +
    paddingSizes.bottom +
    borderSizes.top +
    borderSizes.bottom;
  if (availableWidth < 0) {
    availableWidth = 0;
  }
  if (availableHeight < 0) {
    availableHeight = 0;
  }
  return [availableWidth, availableHeight];
};

const getPaddingAndBorderSizes = (element) => {
  const {
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    borderLeftWidth,
    borderRightWidth,
    borderTopWidth,
    borderBottomWidth,
  } = window.getComputedStyle(element, null);
  return {
    paddingSizes: {
      left: parseFloat(paddingLeft),
      right: parseFloat(paddingRight),
      top: parseFloat(paddingTop),
      bottom: parseFloat(paddingBottom),
    },
    borderSizes: {
      left: parseFloat(borderLeftWidth),
      right: parseFloat(borderRightWidth),
      top: parseFloat(borderTopWidth),
      bottom: parseFloat(borderBottomWidth),
    },
  };
};













const globalObject = typeof self === "object" ? self : process;
globalObject.__InlineContent__ = function (content, { type = "text/plain" }) {
  this.text = content;
  this.type = type;
};

const inlineContent$2 = new __InlineContent__(".box {\n  font-size: inherit;\n  box-sizing: border-box;\n  align-items: flex-start;\n  display: inline-flex;\n  position: relative;\n}\n\n.box[data-vertical] {\n  flex-direction: column;\n}\n\n.box[data-invisible], .box[data-hidden] {\n  visibility: hidden;\n}\n\nbutton.box {\n  background: none;\n  border: none;\n  padding: 0;\n}\n", { type: "text/css" });
const stylesheet$2 = new CSSStyleSheet();
stylesheet$2.replaceSync(inlineContent$2.text);

document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet$2];

const getInnerSpacingStyles = ({
  around,
  left,
  top,
  x,
  y,
  right,
  bottom,
}) => {
  if (!around && !y && !x && !top && !left && !right && !bottom) {
    return {};
  }
  const style = {};
  if (around !== undefined) {
    style.padding = isFinite(around)
      ? parseInt(around)
      : SPACING_SIZES[around] || around;
  }
  if (y) {
    style.paddingTop = style.paddingBottom = isFinite(y)
      ? parseInt(y)
      : SPACING_SIZES[y] || y;
  }
  if (x) {
    style.paddingLeft = style.paddingRight = isFinite(x)
      ? parseInt(x)
      : SPACING_SIZES[x] || x;
  }
  if (top) {
    style.paddingTop = isFinite(top)
      ? parseInt(top)
      : SPACING_SIZES[top] || top;
  }
  if (left) {
    style.paddingLeft = isFinite(left)
      ? parseInt(left)
      : SPACING_SIZES[left] || left;
  }
  if (right) {
    style.paddingRight = isFinite(right)
      ? parseInt(right)
      : SPACING_SIZES[right] || right;
  }
  if (bottom) {
    style.paddingBottom = isFinite(bottom)
      ? parseInt(bottom)
      : SPACING_SIZES[bottom] || bottom;
  }

  return style;
};

const SPACING_SIZES = {
  xxl: 100,
  xl: 50,
  l: 20,
  md: 10,
  s: 5,
  xs: 2,
  xxs: 1,
};

const resolveSize = (
  size,
  { availableSize, fontSize, autoIsRelativeToFont },
) => {
  if (typeof size === "string") {
    if (size === "auto") {
      return autoIsRelativeToFont ? fontSize : availableSize;
    }
    if (size.endsWith("%")) {
      return availableSize * (parseFloat(size) / 100);
    }
    if (size.endsWith("px")) {
      return parseFloat(size);
    }
    if (size.endsWith("em")) {
      return parseFloat(size) * fontSize;
    }
    return parseFloat(size);
  }
  return size;
};

const resolveDimensions = ({
  width,
  height,
  availableWidth,
  availableHeight,
  fontSize,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
}) => {
  const ratio = availableWidth / availableHeight;
  const minWidthResolved = resolveSize(minWidth, {
    availableSize: availableWidth,
    fontSize,
  });
  const maxWidthResolved = resolveSize(maxWidth, {
    availableSize: availableWidth,
    fontSize,
  });
  const minHeightResolved = resolveSize(minHeight, {
    availableSize: availableHeight,
    fontSize,
  });
  const maxHeightResolved = resolveSize(maxHeight, {
    availableSize: availableHeight,
    fontSize,
  });
  let widthResolved;
  if (width === "auto") {
    widthResolved = height * ratio;
  } else {
    widthResolved = resolveSize(width, {
      availableSize: availableWidth,
      fontSize,
    });
  }
  if (minWidth && widthResolved < minWidthResolved) {
    widthResolved = minWidthResolved;
  }
  if (maxWidth && widthResolved > maxWidthResolved) {
    widthResolved = maxWidthResolved;
  }
  let heightResolved;
  if (height === "auto") {
    heightResolved = widthResolved / ratio;
  } else {
    heightResolved = resolveSize(height, {
      availableSize: availableHeight,
      fontSize,
    });
  }
  if (minHeight && heightResolved < minHeightResolved) {
    heightResolved = minHeightResolved;
  }
  if (maxHeight && heightResolved > maxHeightResolved) {
    heightResolved = maxHeightResolved;
  }
  return [widthResolved, heightResolved];
};

const useMultiBorder = (ref, borders) => {
  const [fontSize, fontSizeSetter] = d(16);
  _(() => {
    let {
      fontSize
    } = window.getComputedStyle(ref.current, null);
    fontSize = parseFloat(fontSize);
    fontSizeSetter(fontSize);
  }, []);
  const [availableWidth = 0, availableHeight = 0] = useResizeObserver({
    ref
  });
  let solidBorderFullSize = 0;
  let outsideBorderFullSize = 0;
  let borderFullSize = 0;
  const resolvedBorders = [];
  let solidOuterBorderRadius;
  for (const border of borders) {
    let {
      size = 1,
      strokeSize = 0,
      radius = 0,
      spacing = 0
    } = border;
    const resolvedBorder = {
      ...border,
      strokeSize,
      size: resolveSize(size, {
        availableSize: availableWidth,
        fontSize
      }),
      radius: resolveSize(radius, {
        availableSize: availableWidth,
        fontSize
      }),
      spacing: resolveSize(spacing, {
        availableSize: availableWidth,
        fontSize
      })
    };
    const sizeTakenByBorder = resolvedBorder.size + resolvedBorder.strokeSize + resolvedBorder.spacing;
    borderFullSize += sizeTakenByBorder;
    if (border.outside) {
      outsideBorderFullSize += sizeTakenByBorder;
    } else {
      solidBorderFullSize += sizeTakenByBorder;
      if (solidOuterBorderRadius === undefined) {
        solidOuterBorderRadius = resolvedBorder.radius;
      }
    }
    resolvedBorders.push(resolvedBorder);
  }
  const rectangleWidth = availableWidth + outsideBorderFullSize * 2;
  const rectangleHeight = availableHeight + outsideBorderFullSize * 2;
  let remainingWidth = rectangleWidth;
  let remainingHeight = rectangleHeight;
  let x = 0;
  let y = 0;
  for (const resolvedBorder of resolvedBorders) {
    let {
      width = "50%",
      height = "50%",
      minWidth,
      minHeight,
      maxWidth,
      maxHeight
    } = resolvedBorder;
    let [cornerWidth, cornerHeight] = resolveDimensions({
      width,
      height,
      availableWidth: remainingWidth,
      availableHeight: remainingHeight,
      fontSize,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight
    });
    resolvedBorder.width = cornerWidth;
    resolvedBorder.height = cornerHeight;
    resolvedBorder.x = x;
    resolvedBorder.y = y;
    resolvedBorder.rectangleWidth = remainingWidth;
    resolvedBorder.rectangleHeight = remainingHeight;
    const sizeTakenByBorder = resolvedBorder.size + resolvedBorder.strokeSize + resolvedBorder.spacing;
    x += sizeTakenByBorder;
    y += sizeTakenByBorder;
    remainingWidth -= sizeTakenByBorder * 2;
    remainingHeight -= sizeTakenByBorder * 2;
  }
  const multiBorderProps = {
    borders: resolvedBorders,
    borderFullSize,
    width: rectangleWidth,
    height: rectangleHeight
  };
  const parentStyles = {};
  if (solidBorderFullSize) {
    parentStyles.borderWidth = `${solidBorderFullSize}px`;
    parentStyles.borderColor = "transparent";
    parentStyles.borderStyle = "solid";

    parentStyles.borderRadius = solidOuterBorderRadius;
  }
  return [parentStyles, multiBorderProps];
};
const MultiBorder = ({
  borders,
  borderFullSize,
  width,
  height
}) => {
  if (borders.length === 0) {
    return null;
  }
  const children = [];
  let index = 0;
  for (const border of borders) {
    children.push(u(Borders, {
      ...border
    }, index));
    index++;
  }
  return u("div", {
    name: "multi_border",
    style: {
      position: "absolute",
      inset: `-${borderFullSize}px`,
      pointerEvents: "none"
    },
    children: u("svg", {
      style: {
        overflow: "visible"
      },
      width: width,
      height: height,
      children: children
    })
  });
};
const Borders = ({
  rectangleWidth,
  rectangleHeight,
  x,
  y,
  width,
  height,
  size,
  radius,
  color,
  strokeColor,
  strokeSize,
  opacity
}) => {
  const topLeftPaths = buildBorderPaths({
    name: "top_left",
    buildPath: buildTopLeftCornerPath,
    x,
    y,
    width,
    height,
    size,
    radius,
    strokeSize
  });
  const topRightPaths = buildBorderPaths({
    name: "top_right",
    buildPath: buildTopRightCornerPath,
    x: x + rectangleWidth,
    y,
    width,
    height,
    size,
    radius,
    strokeSize
  });
  const bottomRightPaths = buildBorderPaths({
    name: "bottom_right",
    buildPath: buildBottomRightCornerPath,
    x: x + rectangleWidth,
    y: y + rectangleHeight,
    width,
    height,
    size,
    radius,
    strokeSize
  });
  const bottomLeftPaths = buildBorderPaths({
    name: "bottom_left",
    buildPath: buildBottomLeftCornerPath,
    x,
    y: y + rectangleHeight,
    width,
    height,
    size,
    radius,
    strokeSize
  });
  if (width * 2 === rectangleWidth && height * 2 === rectangleHeight) {
    const bordersPaths = {





      fill: topLeftPaths.fill + topRightPaths.fill + bottomRightPaths.fill + bottomLeftPaths.fill,
      stroke: topLeftPaths.stroke + topRightPaths.stroke + bottomRightPaths.stroke + bottomLeftPaths.stroke
    };
    return u("g", {
      name: "borders",
      "data-radius": radius,
      "data-size": size,
      children: u(Border, {
        name: "border",
        paths: bordersPaths,
        color: color,
        strokeColor: strokeColor,
        opacity: opacity
      })
    });
  }
  return u("g", {
    name: "corners",
    "data-radius": radius,
    "data-size": size,
    children: [u(Border, {
      name: "top_left",
      paths: topLeftPaths,
      color: color,
      strokeColor: strokeColor,
      opacity: opacity
    }), u(Border, {
      name: "top_right",
      paths: topRightPaths,
      color: color,
      strokeColor: strokeColor,
      opacity: opacity
    }), u(Border, {
      name: "bottom_right",
      paths: bottomRightPaths,
      color: color,
      strokeColor: strokeColor,
      opacity: opacity
    }), u(Border, {
      name: "bottom_left",
      paths: bottomLeftPaths,
      color: color,
      strokeColor: strokeColor,
      opacity: opacity
    })]
  });
};
const Border = ({
  name,
  paths,
  color,
  strokeColor,
  opacity
}) => {
  if (paths.stroke) {
    return u(k, {
      children: [u("path", {
        name: `${name}_stroke`,
        d: paths.stroke,
        fill: strokeColor,
        opacity: opacity
      }), u("path", {
        name: `${name}_fill`,
        d: paths.fill,
        fill: color,
        opacity: opacity
      })]
    });
  }
  if (paths.fill) {
    return u("path", {
      name: `${name}_fill`,
      d: paths.fill,
      fill: color,
      opacity: opacity
    });
  }
  return null;
};
const buildBorderPaths = ({
  name,
  buildPath,
  x,
  y,
  width,
  height,
  size,
  radius,
  strokeSize
}) => {
  if (strokeSize) {
    let strokeWidth;
    let strokeHeight;
    let fillX;
    let fillY;
    if (name === "top_left") {
      strokeWidth = width + strokeSize;
      strokeHeight = height + strokeSize;
      fillX = x + strokeSize / 2;
      fillY = y + strokeSize / 2;
    } else if (name === "top_right") {
      strokeWidth = width + strokeSize;
      strokeHeight = height + strokeSize;
      fillX = x - strokeSize / 2;
      fillY = y + strokeSize / 2;
    } else if (name === "bottom_right") {
      strokeWidth = width + strokeSize;
      strokeHeight = height + strokeSize;
      fillX = x - strokeSize / 2;
      fillY = y - strokeSize / 2;
    } else if (name === "bottom_left") {
      strokeWidth = width + strokeSize;
      strokeHeight = height + strokeSize;
      fillX = x + strokeSize / 2;
      fillY = y - strokeSize / 2;
    }
    const stroke = buildPath({
      isStroke: true,
      x,
      y,
      width: strokeWidth,
      height: strokeHeight,
      size: size + strokeSize,
      radius
    });
    const fill = buildPath({
      x: fillX,
      y: fillY,
      width,
      height,
      size,
      radius: radius - strokeSize / 2
    });
    return {
      stroke,
      fill
    };
  }
  const fill = buildPath({
    x,
    y,
    width,
    height,
    size,
    radius
  });
  return {
    fill
  };
};
const buildTopLeftCornerPath = ({
  isStroke,
  x,
  y,
  width,
  height,
  size,
  radius
}) => {
  if (size <= 0 || width <= 0 || height <= 0) {
    return null;
  }
  let sizeX = size;
  if (sizeX > width) {
    sizeX = width;
  }
  let sizeY = size;
  if (sizeY > height) {
    sizeY = height;
  }
  let d = [];
  if (radius > 0) {
    let outerRadiusX = radius;
    let outerRadiusY = radius;
    const leftLineHeight = height - outerRadiusY;
    const topLineWidth = width - outerRadiusX;
    if (leftLineHeight < 0) {
      const xDiff = -leftLineHeight;
      if (!isStroke) {
        x += xDiff / 6;
      }
    }
    if (topLineWidth < 0) {
      const yDiff = -topLineWidth;
      if (!isStroke) {
        y += yDiff / 6;
      }
    }
    let outerRadiusDX = Math.min(outerRadiusX, width);
    let outerRadiusDY = Math.min(outerRadiusY, height);
    let innerRadiusX = outerRadiusX - sizeX;
    let innerRadiusY = outerRadiusY - sizeY;
    d.push(`M ${x},${y + height}`);
    if (leftLineHeight > 0) {
      d.push(`v -${leftLineHeight}`);
    }
    d.push(`a ${outerRadiusX},${outerRadiusY} 0 0 1 ${outerRadiusDX},-${outerRadiusDY}`);
    if (topLineWidth > 0) {
      d.push(`h ${topLineWidth}`);
    }
    if (innerRadiusX >= 0 && innerRadiusY >= 0) {
      const bottomLineWidth = width - sizeX - innerRadiusX;
      const rightLineHeight = height - sizeY - innerRadiusY;
      if (bottomLineWidth < 0) {
        const xDiff = -bottomLineWidth;
        innerRadiusX -= xDiff;
      }
      if (rightLineHeight < 0) {
        const yDiff = -rightLineHeight;
        innerRadiusY -= yDiff;
      }
      d.push(`v ${sizeY}`);
      if (bottomLineWidth > 0) {
        d.push(`h -${bottomLineWidth}`);
      }
      d.push(`a ${innerRadiusX},${innerRadiusY} 0 0 0 -${innerRadiusX},${innerRadiusY}`);
      if (rightLineHeight > 0) {
        d.push(`v ${rightLineHeight}`);
      }
      d.push(`h -${sizeX}`);
    } else {
      d.push(`v ${sizeY}`, `h -${width - sizeX}`, `v ${height - sizeY}`, `h -${sizeX}`);
    }
  } else {
    d.push(`M ${x},${y + height}`, `v -${height}`, `h ${width}`, `v ${sizeY}`, `h -${width - sizeX}`, `v ${height - sizeY}`, `h -${sizeX}`);
  }
  d.push("z");
  d = d.join(" ");
  return d;
};
const buildTopRightCornerPath = ({
  isStroke,
  x,
  y,
  width,
  height,
  size,
  radius
}) => {
  if (size <= 0 || width <= 0 || height <= 0) {
    return null;
  }
  let sizeX = size;
  if (size > width) {
    sizeX = width;
  }
  let sizeY = size;
  if (size > height) {
    sizeY = height;
  }
  let d = [];
  if (radius > 0) {
    let outerRadiusX = radius;
    let outerRadiusY = radius;
    const topLineWidth = width - outerRadiusX;
    const rightLineHeight = height - outerRadiusY;
    if (topLineWidth < 0) {
      const xDiff = -topLineWidth;
      if (!isStroke) {
        x -= xDiff / 6;
      }
    }
    if (rightLineHeight < 0) {
      const yDiff = -rightLineHeight;
      if (!isStroke) {
        y += yDiff / 6;
      }
    }
    let outerRadiusDX = Math.min(outerRadiusX, width);
    let outerRadiusDY = Math.min(outerRadiusY, height);
    let innerRadiusX = outerRadiusX - sizeX;
    let innerRadiusY = outerRadiusY - sizeY;
    d.push(`M ${x - width},${y}`);
    if (topLineWidth > 0) {
      d.push(`h ${topLineWidth}`);
    }
    d.push(`a ${outerRadiusX},${outerRadiusY} 0 0 1 ${outerRadiusDX},${outerRadiusDY}`);
    if (rightLineHeight > 0) {
      d.push(`v ${rightLineHeight}`);
    }
    if (innerRadiusX >= 0 && innerRadiusY >= 0) {
      const leftLineHeight = height - sizeY - innerRadiusY;
      const bottomLineWidth = width - sizeX - innerRadiusX;
      if (leftLineHeight < 0) {
        const yDiff = -leftLineHeight;
        innerRadiusY -= yDiff;
      }
      if (bottomLineWidth < 0) {
        const xDiff = -bottomLineWidth;
        innerRadiusX -= xDiff;
      }
      d.push(`h -${sizeX}`);
      if (leftLineHeight > 0) {
        d.push(`v -${leftLineHeight}`);
      }
      d.push(`a ${innerRadiusX},${innerRadiusY} 0 0 0 -${innerRadiusX},-${innerRadiusY}`);
      if (bottomLineWidth > 0) {
        d.push(`h -${bottomLineWidth}`);
      }
      d.push(`v -${sizeY}`);
    } else {
      d.push(`h -${sizeX}`, `v -${height - sizeY}`, `h -${width - sizeX}`, `v -${sizeY}`);
    }
  } else {
    d = [`M ${x - width},${y}`, `h ${width}`, `v ${height}`, `h -${sizeX}`, `v -${height - sizeY}`, `h -${width - sizeX}`, `v -${sizeY}`];
  }
  d.push("z");
  d = d.join(" ");
  return d;
};
const buildBottomRightCornerPath = ({
  isStroke,
  x,
  y,
  width,
  height,
  size,
  radius
}) => {
  if (size <= 0 || width <= 0 || height <= 0) {
    return null;
  }
  let sizeX = size;
  if (size > width) {
    sizeX = width;
  }
  let sizeY = size;
  if (size > height) {
    sizeY = height;
  }
  let d = [];
  if (radius > 0) {
    let outerRadiusX = radius;
    let outerRadiusY = radius;
    const rightLineHeight = height - outerRadiusY;
    const bottomLineWidth = width - outerRadiusX;
    if (rightLineHeight < 0) {
      const yDiff = -rightLineHeight;
      if (!isStroke) {
        y -= yDiff / 6;
      }
    }
    if (bottomLineWidth < 0) {
      const xDiff = -bottomLineWidth;
      if (!isStroke) {
        x -= xDiff / 6;
      }
    }
    let outerRadiusDX = Math.min(outerRadiusX, width);
    let outerRadiusDY = Math.min(outerRadiusY, height);
    let innerRadiusX = outerRadiusX - sizeX;
    let innerRadiusY = outerRadiusY - sizeY;
    d.push(`M ${x},${y - height}`);
    if (rightLineHeight > 0) {
      d.push(`v ${rightLineHeight}`);
    }
    d.push(`a ${outerRadiusX},${outerRadiusY} 0 0 1 -${outerRadiusDX},${outerRadiusDY}`);
    if (bottomLineWidth > 0) {
      d.push(`h -${bottomLineWidth}`);
    }
    if (innerRadiusX > 0 && innerRadiusY > 0) {
      const topLineWidth = width - sizeX - innerRadiusX;
      const leftLineHeight = height - sizeY - innerRadiusY;
      if (topLineWidth < 0) {
        const xDiff = -topLineWidth;
        innerRadiusX -= xDiff;
      }
      if (leftLineHeight < 0) {
        const yDiff = -leftLineHeight;
        innerRadiusY -= yDiff;
      }
      d.push(`v -${sizeY}`);
      if (topLineWidth > 0) {
        d.push(`h ${topLineWidth}`);
      }
      d.push(`a ${innerRadiusX},${innerRadiusY} 0 0 0 ${innerRadiusX},-${innerRadiusY}`);
      if (leftLineHeight > 0) {
        d.push(`v -${leftLineHeight}`);
      }
      d.push(`h ${sizeX}`);
    } else {
      d.push(`v -${sizeY}`, `h ${width - sizeX}`, `v -${height - sizeY}`, `h ${sizeX}`);
    }
  } else {
    d.push(`M ${x},${y - height}`, `v ${height}`, `h -${width}`, `v -${size}`, `h ${width - size}`, `v -${height - size}`, `h ${size}`);
  }
  d.push("z");
  d = d.join(" ");
  return d;
};
const buildBottomLeftCornerPath = ({
  isStroke,
  x,
  y,
  width,
  height,
  size,
  radius
}) => {
  if (size <= 0 || width <= 0 || height <= 0) {
    return null;
  }
  let sizeX = size;
  if (size > width) {
    sizeX = width;
  }
  let sizeY = size;
  if (size > height) {
    sizeY = height;
  }
  let d = [];
  if (radius > 0) {
    let outerRadiusX = radius;
    let outerRadiusY = radius;
    const bottomLineWidth = width - outerRadiusX;
    const leftLineHeight = height - outerRadiusY;
    if (bottomLineWidth < 0) {
      const xDiff = -bottomLineWidth;
      if (!isStroke) {
        x += xDiff / 6;
      }
    }
    if (leftLineHeight < 0) {
      const yDiff = -leftLineHeight;
      if (!isStroke) {
        y -= yDiff / 6;
      }
    }
    let outerRadiusDX = Math.min(outerRadiusX, width);
    let outerRadiusDY = Math.min(outerRadiusY, height);
    let innerRadiusX = outerRadiusX - sizeX;
    let innerRadiusY = outerRadiusY - sizeY;
    d.push(`M ${x + width},${y}`);
    if (bottomLineWidth > 0) {
      d.push(`h -${bottomLineWidth}`);
    }
    d.push(`a ${outerRadiusX},${outerRadiusY} 0 0 1 -${outerRadiusDX},-${outerRadiusDY}`);
    if (leftLineHeight > 0) {
      d.push(`v -${leftLineHeight}`);
    }
    if (innerRadiusX >= 0 && innerRadiusY >= 0) {
      const leftLineHeight = height - sizeY - innerRadiusY;
      const topLineWidth = width - sizeX - innerRadiusX;
      if (leftLineHeight < 0) {
        const yDiff = -leftLineHeight;
        innerRadiusY -= yDiff;
      }
      if (topLineWidth < 0) {
        const xDiff = -topLineWidth;
        innerRadiusX -= xDiff;
      }
      d.push(`h ${sizeX}`);
      if (leftLineHeight > 0) {
        d.push(`v ${leftLineHeight}`);
      }
      d.push(`a ${innerRadiusX},${innerRadiusY} 0 0 0 ${innerRadiusX},${innerRadiusY}`);
      if (topLineWidth > 0) {
        d.push(`h ${topLineWidth}`);
      }
      d.push(`v ${sizeY}`);
    } else {
      d.push(`h ${sizeX}`, `v ${height - sizeY}`, `h ${width - sizeX}`, `v ${sizeY}`);
    }
  } else {
    d.push(`M ${x + width},${y}`, `h -${width}`, `v -${height}`, `h ${size}`, `v ${height - size}`, `h ${width - size}`, `v ${size}`);
  }
  d.push("z");
  d = d.join(" ");
  return d;
};

const borderWithStroke = ({
  color = "black",
  size = 2,
  strokeColor,
  strokeSize = 1,
  radius = 0,
  opacity
}) => {
  return [{
    size: strokeSize,
    color: strokeColor,
    radius,
    opacity
  }, {
    size,
    color,
    radius: radius - strokeSize,
    opacity
  }, {
    size: strokeSize,
    color: strokeColor,
    radius: radius - strokeSize - size,
    opacity
  }];
};
const borderOutsidePartial = ({
  width = "30%",
  height = "auto",
  minWidth = "0.7em",
  minHeight = "0.7em",
  maxWidth = "40%",
  maxHeight = "40%",
  spacing = 0,
  size,
  color = "dodgerblue",
  opacity,
  strokeColor = "black",
  strokeSize = 1,
  radius = "0.2em"
}) => {
  return [{
    size,
    color,
    opacity,
    width,
    height,
    radius,
    outside: true,
    spacing,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    strokeSize,
    strokeColor
  }];
};
const BoxComponent = ({
  NodeName = "div",
  role,
  name,
  className,
  vertical = false,
  absolute = false,
  hidden = false,
  invisible = false,
  focusable = NodeName === "button",
  focused = false,
  focusedOutlineWidth = "30%",
  focusedOutlineColor = FOCUSED_OUTLINE_COLOR,
  focusedOutlineRadius = 0,
  focusedOutlineSize = 2,
  focusedOutlineStrokeSize = 1,
  focusedOutlineSpacing = 1,
  children,
  innerSpacing = 0,
  innerSpacingY,
  innerSpacingX,
  innerSpacingTop,
  innerSpacingLeft,
  innerSpacingRight,
  innerSpacingBottom,
  overflow,
  overscrollBehavior,
  ratio,
  color,
  backgroundColor,
  border,
  outline,
  width = "auto",
  height = "auto",
  maxWidth = ratio && height !== "auto" ? "100%" : undefined,
  maxHeight = ratio && width !== "auto" ? "100%" : undefined,
  x = "start",
  y = "start",
  contentX = "start",
  contentY = "start",
  onClick,
  cursor = onClick ? "pointer" : undefined,
  ...props
}, ref) => {
  const [innerIsFocused, innerIsFocusedSetter] = d(false);
  const innerRef = A();
  F(ref, () => innerRef.current);
  _(() => {
    const element = innerRef.current;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const elementDimensions = element.getBoundingClientRect();
      const [availableWidth, availableHeight] = getAvailableSize(element.parentNode);
      const styleForXPosition = {
        alignSelf: "",
        left: "",
        marginLeft: ""
      };
      if (x === "start") {
        if (vertical) {
          styleForXPosition.alignSelf = "flex-start";
        } else {
          styleForXPosition.left = "0";
        }
      } else if (x === "center") {
        if (vertical) {
          styleForXPosition.alignSelf = "center";
        } else {
          const elementWidth = elementDimensions.width;
          const halfWidth = (availableWidth - elementWidth) / 2;
          styleForXPosition.left = `${halfWidth}px`;
        }
      } else if (x === "end") {
        if (vertical) {
          styleForXPosition.alignSelf = "flex-end";
        } else {
          styleForXPosition.marginLeft = "auto";
        }
      } else if (isFinite(x)) {
        styleForXPosition.left = `${parseInt(x)}px`;
      }
      const styleForYPosition = {
        alignSelf: styleForXPosition.alignSelf,
        top: "",
        marginTop: ""
      };
      if (y === "start") {
        if (vertical) {
          styleForYPosition.top = "0";
        } else {
          styleForYPosition.alignSelf = "flex-start";
        }
      } else if (y === "center") {
        if (vertical) {
          const elementHeight = elementDimensions.height;
          styleForYPosition.top = `${(availableHeight - elementHeight) / 2}px`;
        } else {
          styleForYPosition.alignSelf = "center";
        }
      } else if (y === "end") {
        if (vertical) {
          styleForYPosition.top = `${availableHeight - elementDimensions.height}px`;
        } else {
          styleForYPosition.alignSelf = "flex-end";
        }
      } else if (isFinite(y)) {
        styleForYPosition.top = `${parseInt(y)}px`;
      }
      Object.assign(element.style, styleForXPosition, styleForYPosition);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [x, y, vertical]);
  const style = {
    position: absolute ? "absolute" : "relative",
    width: isFinite(width) ? `${width}px` : width === "..." || width === "auto" ? undefined : width,
    height: isFinite(height) ? `${height}px` : height === "..." || height === "auto" ? undefined : height,
    maxWidth: isFinite(maxWidth) ? `${maxWidth}px` : maxWidth,
    maxHeight: isFinite(maxHeight) ? `${maxHeight}px` : maxHeight,
    color,
    backgroundColor,
    cursor,
    overflow,
    overscrollBehavior,
    ...props.style
  };
  if (height === "..." || width === "...") {
    style.minWidth = 0;
    style.minHeight = 0;
    style.flexGrow = 1;
  }
  if (ratio) {
    style.aspectRatio = ratio;
  }
  const styleForContentPosition = {};
  if (contentX === "start") {
    if (vertical) {
      styleForContentPosition.alignItems = "flex-start";
    } else {
      styleForContentPosition.justifyContent = "flex-start";
    }
  } else if (contentX === "center") {
    if (vertical) {
      styleForContentPosition.alignItems = "center";
    } else {
      styleForContentPosition.justifyContent = "center";
    }
  } else if (contentX === "end") {
    if (vertical) {
      styleForContentPosition.alignItems = "flex-end";
    } else {
      styleForContentPosition.justifyContent = "flex-end";
    }
  }
  if (contentY === "start") {
    if (vertical) {
      styleForContentPosition.justifyContent = "flex-start";
    } else {
      styleForContentPosition.alignItems = "flex-start";
    }
  } else if (contentY === "center") {
    if (vertical) {
      styleForContentPosition.justifyContent = "center";
    } else {
      styleForContentPosition.alignItems = "center";
    }
  } else if (contentY === "end") {
    if (vertical) {
      styleForContentPosition.justifyContent = "flex-end";
    } else {
      styleForContentPosition.alignItems = "flex-end";
    }
  }
  const borders = [];
  if (outline) {
    borders.push(outline);
  }
  if (border) {
    if (Array.isArray(border)) {
      borders.push(...border);
    } else {
      borders.push(border);
    }
  }
  if (focused || innerIsFocused) {
    borders.unshift(...borderOutsidePartial({
      width: focusedOutlineWidth,
      color: focusedOutlineColor,
      strokeColor: "black",
      size: focusedOutlineSize,
      strokeSize: focusedOutlineStrokeSize,
      radius: focusedOutlineRadius,
      spacing: focusedOutlineSpacing
    }));
  }
  Object.assign(style, styleForContentPosition);
  const spacingStyle = getInnerSpacingStyles({
    around: innerSpacing,
    x: innerSpacingX,
    y: innerSpacingY,
    top: innerSpacingTop,
    bottom: innerSpacingBottom,
    left: innerSpacingLeft,
    right: innerSpacingRight
  });
  Object.assign(style, spacingStyle);
  const [multiBorderParentStyles, multiBorderProps] = useMultiBorder(innerRef, borders);
  Object.assign(style, multiBorderParentStyles);
  return u(NodeName, {
    ref: innerRef,
    name: name,
    className: `box${className ? ` ${className}` : ""}`,
    role: role,
    "data-focused": innerIsFocused || undefined,
    "data-vertical": vertical || undefined,
    "data-hidden": hidden || undefined,
    "data-invisible": invisible || undefined,
    onClick: onClick,
    ...(focusable ? {
      tabIndex: NodeName === "button" ? undefined : -1,
      onFocus: () => {
        innerIsFocusedSetter(true);
      },
      onBlur: () => {
        innerIsFocusedSetter(false);
      }
    } : {}),
    ...props,
    style: style,
    children: [u(MultiBorder, {
      ...multiBorderProps
    }), children]
  });
};
const Box = D(BoxComponent);
Box.div = props => {
  return u(Box, {
    NodeName: "div",
    ...props
  });
};
Box.canvas = props => {
  return u(Box, {
    NodeName: "canvas",
    ...props
  });
};
Box.button = props => {
  return u(Box, {
    NodeName: "button",
    ...props
  });
};

const createPlaybackAbortError = () => {
  const playbackAbortError = new Error("Playback aborted");
  playbackAbortError.name = "AbortError";
  playbackAbortError.isPlaybackAbortError = true;
  return playbackAbortError;
};

const NOOP = () => {};

const createPlaybackController = (
  content,
  { playbackPreventedSignal = d$1(false) } = {},
) => {

  const stateSignal = d$1("idle");
  let resolveFinished;
  let rejectFinished;
  const createFinishedPromise = () => {
    return new Promise((resolve, reject) => {
      resolveFinished = resolve;
      rejectFinished = reject;
    });
  };
  const cleanupCallbackSet = new Set();
  const playRequestedSignal = d$1(false);
  let resumeMethod;
  const goToState = (newState) => {
    stateSignal.value = newState;
    if (newState === "running") {
      playbackController.onstart();
    } else if (newState === "paused") {
      playbackController.onpause();
    } else if (newState === "finished") {
      playbackController.onfinish();
    } else if (newState === "removed") {
      playbackController.onremove();
    }
  };
  let contentPlaying = null;

  const playbackController = {
    stateSignal,
    onstart: NOOP,
    onpause: NOOP,
    onremove: NOOP,
    onfinish: NOOP,
    finished: createFinishedPromise(),

    play: () => {
      playRequestedSignal.value = true;
    },
    pause: () => {
      const state = stateSignal.peek();
      if (state === "running" || state === "finished") {
        playRequestedSignal.value = false;
        resumeMethod = contentPlaying.pause?.();
        goToState("paused");
      }
    },
    remove: () => {
      const state = stateSignal.peek();
      if (state === "removed") {
        return;
      }
      if (state === "running" || state === "paused" || state === "finished") {
        contentPlaying.stop?.();
        contentPlaying.remove?.();
      }
      resumeMethod = undefined;
      if (rejectFinished) {
        rejectFinished(createPlaybackAbortError());
        rejectFinished = undefined;
      }
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
      playbackController.finished = undefined;
      cleanupCallbackSet.clear();
      content = undefined;
      contentPlaying = undefined;
      goToState("removed");
    },
    finish: () => {
      const state = stateSignal.peek();
      if (state === "running" || state === "paused") {
        contentPlaying.finish?.();
        return;
      }
    },
  };

  cleanupCallbackSet.add(
    E(() => {
      const playRequested = playRequestedSignal.value;
      const playbackPrevented = playbackPreventedSignal.value;
      if (!playRequested) {
        return;
      }
      if (playbackPrevented) {
        return;
      }
      const state = stateSignal.peek();
      if (state === "running" || state === "removed") {
        return;
      }
      if (state === "idle" || state === "finished") {
        if (state === "finished") {
          playbackController.finished = createFinishedPromise();
        }
        contentPlaying = content.start({
          playbackController,
          finished: () => {
            resolveFinished();
            resolveFinished = undefined;
            goToState("finished");
            playRequestedSignal.value = false;
          },
        });
        goToState("running");
        return;
      }
      if (state === "paused") {
        resumeMethod();
        resumeMethod = undefined;
        goToState("running");
        return;
      }
    }),
  );

  return playbackController;
};

const exposePlaybackControllerProps = (playbackController, object) => {
  Object.assign(object, {
    playbackController,
    play: playbackController.play,
    pause: playbackController.pause,
    finish: playbackController.finish,
    remove: playbackController.remove,
    get finished() {
      return playbackController.finished;
    },
  });
  playbackController.onstart = () => {
    object.onstart?.();
  };
  playbackController.onpause = () => {
    object.onpause?.();
  };
  playbackController.onremove = () => {
    object.onremove?.();
  };
  playbackController.onfinish = () => {
    object.onfinish?.();
  };
};

window.addEventListener("unhandledrejection", (event) => {
  const { reason } = event;
  if (reason && reason.name === "AbortError" && reason.isPlaybackAbortError) {
    event.preventDefault();
  }
});

const { paused } = registerRoutes({
  paused: {
    urlTemplate: "?paused",
  },
});

const pausedRoute = paused;

const documentHiddenSignal = d$1(document.hidden);
document.addEventListener("visibilitychange", () => {
  documentHiddenSignal.value = document.hidden;
});

const gamePausedRouteIsActiveSignal = pausedRoute.isActiveSignal;
const pauseGame = () => {
  pausedRoute.enter();
};
const playGame = () => {
  pausedRoute.leave();
};
const gamePausedSignal = w(() => {
  const documentHidden = documentHiddenSignal.value;
  const gamePausedRouteIsActive = gamePausedRouteIsActiveSignal.value;
  return documentHidden || gamePausedRouteIsActive;
});
const useGamePaused = () => gamePausedSignal.value;

const innerVisualContentPlaybackIsPreventedSignal = d$1(false);
const visualContentPlaybackIsPreventedSignal = w(() => {
  const gamePaused = gamePausedSignal.value;
  const innerVisualContentPlaybackIsPrevented =
    innerVisualContentPlaybackIsPreventedSignal.value;
  if (gamePaused) {
    return true;
  }
  if (innerVisualContentPlaybackIsPrevented) {
    return true;
  }
  return false;
});

const useVisualContentPlaybackIsPrevented = () => {
  return visualContentPlaybackIsPreventedSignal.value;
};

const animateRatio = ({
  type = "ratio_animation",
  effect,
  duration = 300,
  fps,
  easing,
  props,
  loop = false,
  isAudio = false,
  onprogress = () => {},
  autoplay = true,
  onstart,
  onpause,
  onremove,
  onfinish,
}) => {
  const ratioAnimation = {
    duration,
    onstart,
    onpause,
    onremove,
    onfinish,
  };
  const ratioAnimationContent = {
    type,
    start: ({ finished }) => {
      const requestNext = isAudio
        ? requestAudioAnimationCallback
        : requestVisualAnimationCallback;

      let progressRatio;
      let ratio;
      let cancelNext;
      let msRemaining;
      let previousStepMs;
      const setProgressRatio = (value) => {
        progressRatio = value;
        ratio = easing ? easing(progressRatio) : progressRatio;
        effect(ratio);
        onprogress(progressRatio);
      };
      const stepMinDuration = fps ? 1000 / fps : 0;

      const next = () => {
        const stepMs = Date.now();
        const msEllapsedSincePreviousStep = stepMs - previousStepMs;
        const msRemainingAfterThisStep =
          msRemaining - msEllapsedSincePreviousStep;
        if (

          msRemainingAfterThisStep <= 0 ||

          msRemainingAfterThisStep <= 16.6
        ) {
          if (loop) {
            setProgressRatio(1);
            msRemaining = ratioAnimation.duration;
            progressRatio = 0;
            ratio = 0;
            previousStepMs = stepMs;
            cancelNext = requestNext(next);
            return;
          }
          setProgressRatio(1);
          finished();
          return;
        }
        if (msEllapsedSincePreviousStep < stepMinDuration) {
          cancelNext = requestNext(next);
          return;
        }
        previousStepMs = stepMs;
        msRemaining = msRemainingAfterThisStep;
        setProgressRatio(
          progressRatio + msEllapsedSincePreviousStep / ratioAnimation.duration,
        );
        cancelNext = requestNext(next);
      };

      progressRatio = 0;
      ratio = 0;
      msRemaining = ratioAnimation.duration;
      previousStepMs = Date.now();
      effect(0);
      cancelNext = requestNext(next);

      return {
        pause: () => {
          cancelNext();
          cancelNext = undefined;
          return () => {
            previousStepMs = Date.now();
            cancelNext = requestNext(next);
          };
        },
        finish: () => {
          if (cancelNext) {

            cancelNext();
            cancelNext = undefined;
          }
          setProgressRatio(1);
          finished();
        },
        stop: () => {
          if (cancelNext) {

            cancelNext();
            cancelNext = undefined;
          }
          previousStepMs = undefined;
          progressRatio = undefined;
          ratio = undefined;
        },
        remove: () => {

        },
      };
    },
  };
  const playbackController = createPlaybackController(ratioAnimationContent, {
    playbackPreventedSignal: isAudio
      ? undefined
      : visualContentPlaybackIsPreventedSignal,
  });
  exposePlaybackControllerProps(playbackController, ratioAnimation);
  Object.assign(ratioAnimation, props);
  if (autoplay) {
    ratioAnimation.play();
  }
  return ratioAnimation;
};
const requestAudioAnimationCallback = (callback) => {
  let timeout = setTimeout(callback, 1000 / 60);
  return () => {
    clearTimeout(timeout);
    timeout = null;
  };
};
const requestVisualAnimationCallback = (callback) => {
  let frame = requestAnimationFrame(callback);
  return () => {
    cancelAnimationFrame(frame);
    frame = null;
  };
};

const applyRatioToDiff = (from, to, ratio) => {
  if (ratio === 0) {
    return from;
  }
  if (ratio === 1) {
    return to;
  }
  return from + (to - from) * ratio;
};

const animateNumber = (
  from,
  to,
  {

    isAudio,
    duration,
    easing,
    autoplay,
    effect,
    onstart,
    onpause,
    onremove,
    onfinish,
  } = {},
) => {
  const valueSignal = d$1(from);
  const numberAnimation = animateRatio({
    type: "number_animation",
    props: {
      valueSignal,
    },
    duration,
    easing,
    isAudio,
    onstart,
    onpause,
    onremove,
    onfinish,
    effect: (ratio) => {
      const value = applyRatioToDiff(from, to, ratio);
      valueSignal.value = value;
      if (effect) {
        effect(value);
      }
    },
    autoplay,
  });
  return numberAnimation;
};



const EASING = {
  EASE: (x) => {
    return cubicBezier(x, 0.25, 0.1, 0.25, 1.0);
  },
  EASE_IN_EXPO: (x) => {
    return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
  },
  EASE_OUT_EXPO: (x) => {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
  }};

const cubicBezier = (t, initial, p1, p2, final) => {
  return (
    (1 - t) * (1 - t) * (1 - t) * initial +
    3 * (1 - t) * (1 - t) * t * p1 +
    3 * (1 - t) * t * t * p2 +
    t * t * t * final
  );
};

const volumePreferencesSignal = d$1({
  music: 1,
  sound: 1,
});
const volumePrefsLocalStorageItem = localStorage.getItem("volume_prefs");
if (volumePrefsLocalStorageItem) {
  volumePreferencesSignal.value = JSON.parse(volumePrefsLocalStorageItem);
}
E(() => {
  const volumePreferences = volumePreferencesSignal.value;
  localStorage.setItem("volume_prefs", JSON.stringify(volumePreferences));
});

const musicVolumePreferenceSignal = w(() => {
  const volumePreferences = volumePreferencesSignal.value;
  return volumePreferences.music;
});

const NO_OP$1 = () => {};


const musicGlobalVolumeRequestedSignal = d$1(1);
const musicGlobalVolumeAnimatedSignal = d$1();
const musicGlobalVolumeSignal = w(() => {
  const musicGlobalVolumeAnimated = musicGlobalVolumeAnimatedSignal.value;
  const musicGlobalVolumeRequested = musicGlobalVolumeRequestedSignal.value;
  const musicGlobalVolume =
    musicGlobalVolumeAnimated === undefined
      ? musicGlobalVolumeRequested
      : musicGlobalVolumeAnimated;
  return musicGlobalVolume;
});
const setMusicGlobalVolume = (
  value,
  { animate = true, duration = 2000 } = {},
) => {
  removeGlobalVolumeAnimation();
  if (!animate) {
    musicGlobalVolumeRequestedSignal.value = value;
    return;
  }
  const from = musicGlobalVolumeSignal.peek();
  const to = value;
  animateMusicGlobalVolume(from, to, {
    duration,
    easing: EASING.EASE_OUT_EXPO,
    onstart: () => {





      musicGlobalVolumeRequestedSignal.value = value;
    },
  });
};
let removeGlobalVolumeAnimation = NO_OP$1;
const animateMusicGlobalVolume = (from, to, props) => {
  removeGlobalVolumeAnimation();
  const globalVolumeAnimation = animateNumber(from, to, {
    ...props,


    isAudio: true,
    effect: (volumeValue) => {
      musicGlobalVolumeAnimatedSignal.value = volumeValue;
    },
    onremove: () => {
      musicGlobalVolumeAnimatedSignal.value = undefined;
      removeGlobalVolumeAnimation = NO_OP$1;
    },
    onfinish: () => {
      musicGlobalVolumeAnimatedSignal.value = undefined;
      removeGlobalVolumeAnimation = NO_OP$1;
      props.onfinish?.();
    },
  });
  removeGlobalVolumeAnimation = () => {
    globalVolumeAnimation.remove();
  };
  return globalVolumeAnimation;
};
E(() => {
  const musicVolumeBase = musicVolumePreferenceSignal.value;
  const gamePaused = gamePausedSignal.value;
  if (gamePaused) {
    setMusicGlobalVolume(musicVolumeBase * 0.2, { duration: 3000 });
  } else {
    setMusicGlobalVolume(musicVolumeBase, { duration: 3000 });
  }
});


const musicsAllMutedSignal = d$1(false);
const muteAllMusics = () => {
  musicsAllMutedSignal.value = true;
};
const unmuteAllMusics = () => {
  musicsAllMutedSignal.value = false;
};


const musicsAllPausedSignal = d$1(false);
const useMusicsAllPaused = () => {
  return musicsAllPausedSignal.value;
};
const pauseAllMusics = () => {
  musicsAllPausedSignal.value = true;
};
const playAllMusics = () => {
  musicsAllPausedSignal.value = false;
};


const playOneAtATimeSignal = d$1(true);




const { userActivation } = window.navigator;
const getUserActivationState = () => {
  if (userActivation.isActive) {
    return "active";
  }
  if (userActivation.hasBeenActive) {
    return "hasBeenActive";
  }
  return "inactive";
};

const updateState = () => {
  userActivationSignal.value = getUserActivationState();
};

const userActivationSignal = d$1(getUserActivationState());

if (userActivationSignal.peek() === "inactive") {
  const onmousedown = (mousedownEvent) => {
    if (!mousedownEvent.isTrusted) {
      return;
    }
    updateState();
    if (userActivationSignal.peek() !== "inactive") {
      document.removeEventListener("mousedown", onmousedown, { capture: true });
      document.removeEventListener("keydown", onkeydown, { capture: true });
    }
  };
  const onkeydown = (keydownEvent) => {
    if (!keydownEvent.isTrusted) {
      return;
    }
    updateState();
    if (userActivationSignal.peek() !== "inactive") {
      document.removeEventListener("mousedown", onmousedown, { capture: true });
      document.removeEventListener("keydown", onkeydown, { capture: true });
    }
  };
  document.addEventListener("mousedown", onmousedown, { capture: true });
  document.addEventListener("keydown", onkeydown, { capture: true });
}

const soundsAllMutedSignal = d$1(false);
const muteAllSounds = () => {
  soundsAllMutedSignal.value = true;
};
const unmuteAllSounds = () => {
  soundsAllMutedSignal.value = false;
};
const soundSet = new Set();

const sound = ({
  name,
  url,
  startTime = 0,
  volume = 1,
  restartOnPlay = true,
  muted,
}) => {
  const soundObject = {};
  const audio = new Audio(url);
  audio.volume = volume;
  if (startTime) {
    audio.currentTime = startTime;
  }

  {
    const muteRequestedSignal = d$1(muted);
    const mute = () => {
      muteRequestedSignal.value = true;
    };
    const unmute = () => {
      muteRequestedSignal.value = false;
    };
    E(() => {
      const muteRequested = muteRequestedSignal.value;
      const soundsAllMuted = soundsAllMutedSignal.value;
      const shouldMute = muteRequested || soundsAllMuted;
      if (shouldMute) {
        audio.muted = true;
      } else {
        audio.muted = false;
      }
    });
    Object.assign(soundObject, {
      mute,
      unmute,
    });
  }

  {
    const playRequestedSignal = d$1(false);
    const play = () => {
      playRequestedSignal.value = true;
    };
    const pause = () => {
      playRequestedSignal.value = false;
    };
    E(() => {
      const playRequested = playRequestedSignal.value;
      const userActivation = userActivationSignal.value;
      if (playRequested && userActivation !== "inactive") {
        if (restartOnPlay) {
          audio.currentTime = startTime;
        }
        audio.play();
      } else {
        audio.pause();
      }
    });
    Object.assign(soundObject, {
      play,
      pause,
    });
  }

  Object.assign(soundObject, {
    audio,
    name,
    url,
    volumeAtStart: volume,
  });
  soundSet.add(soundObject);
  return soundObject;
};

const mutedLocalStorageItem = localStorage.getItem("muted");
const mutedFromLocalStorage =
  mutedLocalStorageItem === undefined
    ? false
    : JSON.parse(mutedLocalStorageItem);
const mutedSignal = d$1(mutedFromLocalStorage || false);
const useMuted = () => {
  return mutedSignal.value;
};
const mute = () => {
  mutedSignal.value = true;
};
const unmute = () => {
  mutedSignal.value = false;
};
E(() => {
  const muted = mutedSignal.value;
  if (muted) {
    muteAllMusics();
    muteAllSounds();
  } else {
    unmuteAllMusics();
    unmuteAllSounds();
  }
  localStorage.setItem("muted", JSON.stringify(muted));
});

const ButtonMuteUnmute = () => {
  const muted = useMuted();
  if (muted) {
    return u(Box.button, {
      onClick: unmute,
      width: "32",
      children: u(AudioDisabledIcon, {})
    });
  }
  return u(Box.button, {
    onClick: mute,
    width: "32",
    children: u(AudioEnabledIcon, {})
  });
};



const AudioDisabledIcon = () => {
  return u("svg", {
    viewBox: "-1.5 0 19 19",
    children: u("path", {
      fill: "currentColor",
      d: "M7.676 4.938v9.63c0 .61-.353.756-.784.325l-2.896-2.896H2.02A1.111 1.111 0 0 1 .911 10.89V8.618a1.112 1.112 0 0 1 1.108-1.109h1.977l2.896-2.896c.43-.43.784-.284.784.325zm7.251 6.888a.554.554 0 1 1-.784.784l-2.072-2.073-2.073 2.073a.554.554 0 1 1-.784-.784l2.073-2.073L9.214 7.68a.554.554 0 0 1 .784-.783L12.07 8.97l2.072-2.073a.554.554 0 0 1 .784.783l-2.072 2.073z"
    })
  });
};
const AudioEnabledIcon = () => {
  return u("svg", {
    viewBox: "-2.5 0 19 19",
    children: u("path", {
      fill: "currentColor",
      d: "M7.365 4.785v9.63c0 .61-.353.756-.784.325l-2.896-2.896H1.708A1.112 1.112 0 0 1 .6 10.736V8.464a1.112 1.112 0 0 1 1.108-1.108h1.977L6.581 4.46c.43-.43.784-.285.784.325zm2.468 7.311a3.53 3.53 0 0 0 0-4.992.554.554 0 0 0-.784.784 2.425 2.425 0 0 1 0 3.425.554.554 0 1 0 .784.783zm1.791 1.792a6.059 6.059 0 0 0 0-8.575.554.554 0 1 0-.784.783 4.955 4.955 0 0 1 0 7.008.554.554 0 1 0 .784.784z"
    })
  });
};

const ButtonPlayPause = () => {
  const musicsAllPaused = useMusicsAllPaused();
  if (musicsAllPaused) {
    return u(Box.button, {
      onClick: () => {
        playAllMusics();
      },
      width: "32",
      children: u(PlayIconSvg, {})
    });
  }
  return u(Box.button, {
    onClick: () => {
      pauseAllMusics();
    },
    width: "32",
    children: u(PauseIconSvg, {})
  });
};
const PlayIconSvg = () => {
  return u("svg", {
    name: "play_icon",
    viewBox: "0 0 24 24",
    fill: "currentColor",
    children: u("path", {
      d: "M6 6 L16 12 L6 18 Z",
      stroke: "#000000",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    })
  });
};
const PauseIconSvg = () => {
  return u("svg", {
    name: "pause_icon",
    viewBox: "0 0 24 24",
    fill: "currentColor",
    children: u("path", {
      d: "M8 5 V19 M16 5 V19",
      stroke: "#000000",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    })
  });
};

const animateElement = (
  element,
  {
    id,
    from,
    to,
    duration = 500,
    iterations = 1,
    fill = "forwards",
    commit,
    playbackRate = 1,
    easing,
    delay,
    autoplay = true,
    onstart,
    onpause,
    onremove,
    onfinish,
  },
) => {
  const elementAnimation = {
    onstart,
    onpause,
    onremove,
    onfinish,
  };
  const elementAnimationContent = {
    type: "element_animation",
    start: ({ finished }) => {
      const fromStep = stepFromAnimationDescription(from);
      const toStep = stepFromAnimationDescription(to);
      const steps = [];
      if (fromStep) {
        steps.push(fromStep);
      }
      if (toStep) {
        steps.push(toStep);
      }

      if (easing) {
        element.style.animationTimingFunction =
          createAnimationTimingFunction(easing);
      } else {
        element.style.animationTimingFunction = "";
      }
      let keyFrames = new KeyframeEffect(element, steps, {
        id,
        duration,
        delay,
        fill,
        iterations,
      });
      let webAnimation = new Animation(keyFrames, document.timeline);
      webAnimation.playbackRate = playbackRate;

      let stopObservingElementRemoved = onceElementRemoved(element, () => {
        playbackController.remove();
      });
      const computedStyle = getComputedStyle(element);
      const shouldDisplay = computedStyle.display === "none";
      if (shouldDisplay) {
        element.style.display = null;
      }
      webAnimation.onfinish = () => {
        if (toStep) {
          if (commit) {
            try {
              webAnimation.commitStyles();
            } catch (e) {
              console.error(
                `Error during "commitStyles" on animation "${id}"`,
                element.style.display,
              );
              console.error(e);
            }
          }
        }
        if (shouldDisplay) {
          element.style.display = "none";
        }
        finished();
      };
      webAnimation.play();
      return {
        pause: () => {
          webAnimation.pause();
          return () => {
            webAnimation.play();
          };
        },
        finish: () => {
          webAnimation.finish();
        },
        stop: () => {
          if (stopObservingElementRemoved) {
            stopObservingElementRemoved();
            stopObservingElementRemoved = undefined;
          }
        },
        remove: () => {
          webAnimation.cancel();
          keyFrames = undefined;
          webAnimation = undefined;
        },
      };
    },
  };
  const playbackController = createPlaybackController(elementAnimationContent, {
    playbackPreventedSignal: visualContentPlaybackIsPreventedSignal,
  });
  exposePlaybackControllerProps(playbackController, elementAnimation);
  if (autoplay) {
    elementAnimation.play();
  }
  return elementAnimation;
};

const stepFromAnimationDescription = (animationDescription) => {
  if (!animationDescription) {
    return null;
  }
  const step = {};
  {
    const transforms = [];
    let x = animationDescription.x;
    let y = animationDescription.y;
    let angleX = animationDescription.angleX;
    let angleY = animationDescription.angleY;
    let scaleX = animationDescription.scaleX;
    if (animationDescription.mirrorX) {
      angleY = typeof angleY === "number" ? angleY + 180 : 180;
    }
    if (typeof x === "number") {
      transforms.push(`translateX(${x}px)`);
    }
    if (typeof y === "number") {
      transforms.push(`translateY(${y}px)`);
    }
    if (typeof angleX === "number") {
      transforms.push(`rotateX(${angleX}deg)`);
    }
    if (typeof angleY === "number") {
      transforms.push(`rotateY(${angleY}deg)`);
    }
    if (typeof scaleX === "number") {
      transforms.push(`scaleX(${scaleX})`);
    }
    if (transforms.length) {
      step.transform = transforms.join(" ");
    }
  }
  {
    let opacity = animationDescription.opacity;
    if (opacity !== undefined) {
      step.opacity = opacity;
    }
  }
  if (Object.keys(step).length === 0) {
    return null;
  }
  return step;
};

const createAnimationTimingFunction = (easing, steps = 10) => {
  if (easing === EASING.linear) {
    return "linear";
  }
  if (easing === EASING.EASE) {
    return "ease";
  }
  let i = 0;
  const values = [];
  const stepRatio = 1 / steps;
  let progress = 0;
  while (i < steps) {
    i++;
    const value = easing(progress);
    values.push(value);
    progress += stepRatio;
  }
  return `linear(${values.join(", ")});`;
};
const onceElementRemoved = (element, callback) => {
  const observer = new MutationObserver(function (mutations) {
    let mutationForRemoval;
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      const { removedNodes } = mutation;
      if (removedNodes.length === 0) {
        continue;
      }
      for (const removedNode of removedNodes) {
        if (removedNode === element) {
          mutationForRemoval = mutation;
          break;
        }
      }
      if (mutationForRemoval) {
        break;
      }
    }
    if (mutationForRemoval) {
      observer.disconnect();
      callback();
    }
  });
  observer.observe(element.parentNode, { childList: true });
  return () => {
    observer.disconnect();
  };
};

const Curtain = D((props, ref) => {
  const innerRef = A();
  F(ref, () => {
    return {
      show: ({
        color = "white",
        opacity = 0.5
      } = {}) => {
        const canvas = innerRef.current;
        drawCurtain(canvas, {
          color,
          opacity
        });
        canvas.style.display = "block";
      },
      hide: () => {
        const canvas = innerRef.current;
        canvas.style.display = "none";
      },
      fadeIn: async ({
        color = "black",
        toOpacity = 1
      } = {}) => {
        const canvas = innerRef.current;
        drawCurtain(canvas, {
          color,
          opacity: 1
        });
        canvas.style.display = "block";
        await animateElement(canvas, {
          to: {
            opacity: toOpacity
          }
        }).finished;
      },
      fadeOut: async ({
        toOpacity = 0
      } = {}) => {
        await animateElement(innerRef.current, {
          to: {
            opacity: toOpacity}
        }).finished;
      }
    };
  });
  return u("canvas", {
    ...props,
    ref: innerRef,
    name: "curtain",
    style: {
      width: "100%",
      height: "100%",
      position: "absolute",
      display: "none",
      opacity: 0,
      left: 0,
      top: 0
    }
  });
});
const drawCurtain = (canvas, {
  color,
  opacity
}) => {
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.closePath();
  context.globalAlpha = opacity;
  context.fillStyle = color;
  context.fill();
  context.restore();
};






















const fadeInDefaults = {
  duration: 600,
  easing: EASING.EASE_IN_EXPO,
};
const fadeOutDefaults = {
  duration: 1500,
  easing: EASING.EASE_OUT_EXPO,
};

const NO_OP = () => {};
const musicSet = new Set();

let activeMusic = null;
let previousActiveMusic = null;
const music = ({
  name,
  url,
  startTime = 0,
  volume = 1,
  loop = true,
  autoplay = false,
  restartOnPlay,
  canPlayWhilePaused,
  muted,
  volumeAnimation = true,
  fadeIn = true,
  fadeOut = true,
}) => {
  if (fadeIn === true) {
    fadeIn = {};
  }
  if (fadeOut === true) {
    fadeOut = {};
  }
  const musicObject = {};

  const audio = new Audio(url);
  audio.loop = loop;
  if (startTime) {
    audio.currentTime = startTime;
  }

  {
    const volumeAnimatedSignal = d$1();
    const volumeRequestedSignal = d$1(volume);
    const volumeSignal = w(() => {
      const musicGlobalVolume = musicGlobalVolumeSignal.value;
      const volumeAnimated = volumeAnimatedSignal.value;
      const volumeRequested = volumeRequestedSignal.value;
      const volumeToSet =
        volumeAnimated === undefined ? volumeRequested : volumeAnimated;
      const volumeToSetResolved = volumeToSet * musicGlobalVolume;



      return volumeToSetResolved;
    });
    E(() => {
      const volume = volumeSignal.value;
      audio.volume = volume;
    });

    let removeVolumeAnimation = NO_OP;
    const animateVolume = ({
      from,
      to,
      onremove = NO_OP,
      onfinish = NO_OP,
      ...rest
    }) => {
      removeVolumeAnimation();
      const volumeAnimation = animateNumber(from, to, {


        isAudio: true,
        ...rest,
        effect: (volumeValue) => {
          volumeAnimatedSignal.value = volumeValue;
        },
        onremove: () => {
          volumeAnimatedSignal.value = undefined;
          removeVolumeAnimation = NO_OP;
          onremove();
        },
        onfinish: () => {
          removeVolumeAnimation = NO_OP;
          onfinish();
        },
      });
      removeVolumeAnimation = () => {
        volumeAnimation.remove();
      };
      return volumeAnimation;
    };

    const fadeInVolume = (params) => {
      return animateVolume({
        ...fadeInDefaults,
        ...fadeIn,
        from: 0,
        to: volumeRequestedSignal.peek(),
        ...params,
      });
    };
    const fadeOutVolume = (params) => {
      return animateVolume({
        ...fadeOutDefaults,
        ...fadeOut,
        from: volumeSignal.peek(),
        to: 0,
        ...params,
      });
    };

    const setVolume = (
      value,
      { animated = volumeAnimation, duration = 500 } = {},
    ) => {
      removeVolumeAnimation();
      if (!animated) {
        volumeRequestedSignal.value = value;
        return;
      }
      const from = volumeSignal.peek();
      const to = value;
      animateVolume({
        from,
        to,
        duration,
        easing: EASING.EASE_OUT_EXPO,
        onstart: () => {
          volumeRequestedSignal.value = value;
        },
        onremove: () => {
          volumeAnimatedSignal.value = undefined;
        },
        onfinish: () => {
          volumeAnimatedSignal.value = undefined;
        },
      });
    };

    Object.assign(musicObject, {
      volumeSignal,
      volumeRequestedSignal,
      setVolume,
      fadeInVolume,
      fadeOutVolume,
      removeVolumeAnimation: () => {
        removeVolumeAnimation();
      },
    });
  }

  {
    const muteRequestedSignal = d$1(muted);
    const mute = () => {
      muteRequestedSignal.value = true;
    };
    const unmute = () => {
      muteRequestedSignal.value = false;
    };
    E(() => {
      const musicsAllMuted = musicsAllMutedSignal.value;
      const muteRequested = muteRequestedSignal.value;
      const shouldMute = musicsAllMuted || muteRequested;
      if (shouldMute) {
        audio.muted = true;
      } else {
        audio.muted = false;
      }
    });
    Object.assign(musicObject, {
      muteRequestedSignal,
      mute,
      unmute,
    });
  }

  {
    let volumeFadeoutThenPauseAnimation = null;
    const handleShouldBePaused = () => {
      if (audio.paused) {
        return;
      }
      if (!fadeOut) {
        audio.pause();
        return;
      }

      volumeFadeoutThenPauseAnimation = musicObject.fadeOutVolume({
        onremove: () => {
          volumeFadeoutThenPauseAnimation = null;

        },
        onfinish: () => {
          volumeFadeoutThenPauseAnimation = null;
          audio.pause();
        },
      });
    };
    const handleShouldBePlaying = async () => {
      if (playOneAtATimeSignal.peek() && playRequestedSignal.value) {
        if (activeMusic && activeMusic !== musicObject) {
          const musicToReplace = activeMusic;
          musicToReplace.pauseRequestedByActiveMusicSignal.value = true;
          previousActiveMusic = musicToReplace;
        }
        activeMusic = musicObject;
      }

      if (volumeFadeoutThenPauseAnimation) {
        volumeFadeoutThenPauseAnimation.remove();
      }
      if (!audio.paused) {
        return;
      }
      if (restartOnPlay) {
        audio.currentTime = startTime;
      }
      if (!fadeIn) {
        try {
          await audio.play();
        } catch {}
        return;
      }
      musicObject.fadeInVolume({
        onstart: async () => {
          try {
            await audio.play();
          } catch {}
        },
      });
    };

    const playRequestedSignal = d$1(autoplay);
    const pauseRequestedByActiveMusicSignal = d$1(false);
    E(() => {
      const documentHidden = documentHiddenSignal.value;
      const userActivation = userActivationSignal.value;
      const musicsAllPaused = musicsAllPausedSignal.value;
      const playRequested = playRequestedSignal.value;
      const pauseRequestedByActiveMusic =
        pauseRequestedByActiveMusicSignal.value;
      const shouldPlay =
        playRequested &&
        !documentHidden &&
        userActivation !== "inactive" &&
        !musicsAllPaused &&
        !pauseRequestedByActiveMusic;
      if (shouldPlay) {
        handleShouldBePlaying();
      } else {
        handleShouldBePaused();
      }
    });

    const play = () => {
      playRequestedSignal.value = true;
      pauseRequestedByActiveMusicSignal.value = false;
    };
    const pause = () => {
      playRequestedSignal.value = false;
      if (playOneAtATimeSignal.peek()) {
        if (musicObject === activeMusic) {
          activeMusic = null;
          if (previousActiveMusic) {
            const musicToReplay = previousActiveMusic;
            previousActiveMusic = null;
            musicToReplay.pauseRequestedByActiveMusicSignal.value = false;
          }
        } else if (musicObject === previousActiveMusic) {
          previousActiveMusic = null;
        }
      }
    };

    Object.assign(musicObject, {
      playRequestedSignal,
      pauseRequestedByActiveMusicSignal,
      play,
      pause,
    });
  }

  Object.assign(musicObject, {
    audio,
    canPlayWhilePaused,
    name,
    url,
    volumeAtStart: volume,
  });
  musicSet.add(musicObject);
  return musicObject;
};


















let isUpdatingText = false;
const useTextController = () => {
  const [index, indexSetter] = d(-1);
  const [paragraphs, paragraphsSetter] = d([]);
  const hasPrev = index > 0 && paragraphs.length > 0;
  const hasNext = index !== paragraphs.length - 1 && paragraphs.length > 0;
  const prev = q(() => {
    if (hasPrev) {
      indexSetter(current => current - 1);
    }
  }, [hasPrev]);
  const next = q(() => {
    if (hasNext) {
      indexSetter(current => current + 1);
    }
  }, [hasNext]);
  const onParagraphChange = q(paragraphs => {
    indexSetter(0);
    paragraphsSetter(paragraphs);
  }, []);
  return useStructuredMemo({
    index,
    hasPrev,
    hasNext,
    hasContent: paragraphs.length > 0,
    prev,
    next,
    onParagraphChange
  });
};
const useFontsReady = fontFamily => {
  const checkResult = document.fonts.check(`12px ${fontFamily}`);
  const [ready, readySetter] = d(false);
  if (checkResult) {
    return true;
  }
  document.fonts.ready.then(() => {
    readySetter(true);
  });
  return ready;
};
const TextComponent = ({
  name,
  controller,
  dx = 0,
  dy = 0,
  fontFamily = "goblin",
  fontSize = "0.7em",
  fontWeight,
  children,
  color,
  outlineColor,
  outlineSize = 1,
  letterSpacing,
  lineHeight = 1.4,
  visible = true,
  logResize,
  overflow = "visible",
  ...props
}) => {
  children = normalizeChildren(children);
  const lines = splitLines(children);
  const svgInnerRef = A();
  const textRef = A();
  const setParagraphRef = A();
  const index = controller?.index;
  const onParagraphChange = controller?.onParagraphChange;
  const fontReady = useFontsReady(fontFamily);
  const lineAsDeps = [];
  for (const line of lines) {
    for (const lineChild of line) {
      lineAsDeps.push(lineChild.type);
      lineAsDeps.push(lineChild.value);
      lineAsDeps.push(lineChild.char);
    }
  }
  const deps = [...lineAsDeps, dx, dy, lineHeight, overflow, fontSize, fontFamily, fontWeight, letterSpacing, color, outlineColor, outlineSize, onParagraphChange, fontReady];
  const [,, performSizeSideEffects] = useResizeObserver({
    ref: svgInnerRef,
    getElementToObserve: svg => svg.parentNode,
    onResize: () => {
      if (logResize) {
        console.log("update after resize");
      }
      isUpdatingText = true;
      update();
      requestAnimationFrame(() => {
        isUpdatingText = false;
      });
    },
    ignoreInitial: true
  }, deps);
  const update = () => {
    performSizeSideEffects(() => {
      const svgElement = svgInnerRef.current;
      const textElement = textRef.current;
      const computedStyle = window.getComputedStyle(svgElement, null);
      const fontSizeReference = parseFloat(computedStyle.fontSize);
      const fontSizeResolved = resolveSize(fontSize, {
        fontSize: fontSizeReference,
        autoIsRelativeToFont: true
      });
      const [paragraphs, setParagraph] = initTextFiller(lines, {
        dx,
        dy,
        lineHeight,
        overflow,
        fontSize: fontSizeResolved,
        fontFamily,
        fontWeight,
        letterSpacing,
        color,
        outlineColor,
        outlineSize,
        svgElement,
        textElement
      });
      setParagraphRef.current = setParagraph;
      if (onParagraphChange) {
        onParagraphChange(paragraphs);
      } else {
        setParagraph(0);
      }
    });
  };
  _(() => {
    update();
  }, deps);
  _(() => {
    if (typeof index === "number" && setParagraphRef.current) {
      setParagraphRef.current(controller.index);
    }
  }, [index, setParagraphRef.current]);
  return u("svg", {
    ...props,
    ref: svgInnerRef,
    xmlns: "http://www.w3.org/2000/svg",
    style: {
      ...props.style,
      display: "block",
      pointerEvents: visible ? "auto" : "none",
      dominantBaseline: "text-before-edge",
      overflow: "visible"
    },
    children: u("text", {
      ref: textRef
    })
  });
};
const Text = D(TextComponent);
Text.bold = ({
  children
}) => {
  return u(Text, {
    fontWeight: "bold",
    children: children
  });
};


const initTextFiller = (lines, {

  dx,
  dy,
  lineHeight,
  svgElement,
  textElement,
  overflow,
  fontSize,
  fontFamily,
  fontWeight,
  letterSpacing,
  color,
  outlineColor,
  outlineSize = 1
}) => {
  lines = [...lines];
  let widthTaken;
  let heightTaken;
  let hasOverflowX;
  let hasOverflowY;






  svgElement.style.opacity = "0";
  svgElement.style.width = "100vw";
  svgElement.style.height = "100vh";
  svgElement.parentNode.style.maxWidth = "100%";
  svgElement.parentNode.style.maxHeight = "100%";
  const [availableWidth, availableHeight] = getAvailableSize(svgElement.parentNode);
  svgElement.style.opacity = "";
  svgElement.style.width = "auto";
  svgElement.style.height = "auto";
  const renderLines = lines => {
    const textChildren = [];
    let lineIndex = 0;
    for (const lineChildren of lines) {
      const lineChildrenValues = [];
      for (const lineChild of lineChildren) {
        lineChildrenValues.push(lineChild.value);
      }
      textChildren.push(u(Tspan, {
        x: "0",
        y: "0",
        dx: dx,
        dy: dy + lineHeight * fontSize * lineIndex,
        fontSize: fontSize,
        fontFamily: fontFamily,
        fontWeight: fontWeight,
        letterSpacing: letterSpacing,
        color: color,
        outlineColor: outlineColor,
        outlineSize: outlineSize,
        children: lineChildrenValues
      }));
      lineIndex++;
    }

    E$1(u(k, {
      children: textChildren
    }), textElement);
    const {
      width,
      height
    } = textElement.getBoundingClientRect();
    widthTaken = width;
    heightTaken = height;
    svgElement.style.width = `${widthTaken}px`;
    svgElement.style.height = `${heightTaken}px`;





    hasOverflowX = widthTaken > availableWidth;
    hasOverflowY = heightTaken > availableHeight;
  };
  let currentParagraph;
  const paragraphs = [];
  const startNewParagraph = () => {
    endCurrentParagraph();
    currentParagraph = {
      width: 0,
      height: 0,
      lines: []
    };
    renderLines(currentParagraph.lines);
    currentParagraph.width = widthTaken;
    currentParagraph.height = heightTaken;
  };
  const addToCurrentParagraph = lineChildren => {
    currentParagraph.lines.push(lineChildren);
  };
  const endCurrentParagraph = () => {
    if (currentParagraph && currentParagraph.lines.length) {
      renderLines(currentParagraph.lines);
      currentParagraph.width = widthTaken;
      currentParagraph.height = heightTaken;
      paragraphs.push(currentParagraph);
    }
  };
  const setParagraph = paragraph => {
    renderLines(paragraph.lines);
  };
  startNewParagraph();
  let lineIndex = 0;
  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    let lineChildIndex = 0;
    let childrenFittingOnThatLine = [];
    while (lineChildIndex < line.length) {
      const lineChild = line[lineChildIndex];
      const childrenCandidateToFit = line.slice(0, lineChildIndex + 1);
      const linesCandidateToFit = [...currentParagraph.lines, childrenCandidateToFit];
      renderLines(linesCandidateToFit);
      if (!hasOverflowX) {
        childrenFittingOnThatLine.push(lineChild);

        lineChildIndex++;
        continue;
      }
      if (lineChild.char === " ") {
        childrenFittingOnThatLine = line.slice(0, lineChildIndex);
        const childrenPushedNextLine = line.slice(lineChildIndex + 1);
        lines.splice(lineIndex + 1, 0, childrenPushedNextLine);
        break;
      }
      if (lineChildIndex === 0) {
        childrenFittingOnThatLine = [lineChild];
        const childrenPushedNextLine = line.slice(lineChildIndex + 1);
        lines.splice(lineIndex + 1, 0, ...childrenPushedNextLine);
        break;
      }
      let splitIndex = -1;
      let previousChildIndex = lineChildIndex;
      while (previousChildIndex--) {
        const previousChild = line[previousChildIndex];
        if (previousChild.char === " ") {
          splitIndex = previousChildIndex;
          break;
        }
      }
      if (splitIndex === -1) {



        childrenFittingOnThatLine = line.slice(0, lineChildIndex);
        const childrenPushedNextLine = line.slice(lineChildIndex);
        lines.splice(lineIndex + 1, 0, childrenPushedNextLine);
        break;
      }
      childrenFittingOnThatLine = line.slice(0, splitIndex);
      const childrenPushedNextLine = line.slice(splitIndex + 1);
      lines.splice(lineIndex + 1, 0, childrenPushedNextLine);
      break;
    }
    if (!hasOverflowY) {

      addToCurrentParagraph(childrenFittingOnThatLine);
      lineIndex++;
      continue;
    }
    if (overflow === "ellipsis" && currentParagraph.lines.length > 0) {
      const previousLine = currentParagraph.lines[currentParagraph.lines.length - 1];
      previousLine[previousLine.length - 1] = {
        type: "char",
        value: ".",
        char: "."
      };
    }

    if (overflow === "visible") {
      addToCurrentParagraph(childrenFittingOnThatLine);
      lineIndex++;
      continue;
    }
    if (currentParagraph.length === 0) {
      addToCurrentParagraph(childrenFittingOnThatLine);
      startNewParagraph();
      lineIndex++;
      continue;
    }
    startNewParagraph();
    addToCurrentParagraph(childrenFittingOnThatLine);
    lineIndex++;
    continue;
  }
  endCurrentParagraph();
  return [paragraphs, index => {
    const p = paragraphs[index];
    if (p) {
      setParagraph(p);
    }
  }];
};
const Tspan = ({
  fontSize,
  fontFamily,
  fontWeight,
  letterSpacing,
  color,
  outlineColor,
  outlineSize = 1,
  children,
  ...props
}) => {
  const thickness = fontWeight === "bold" ? 1 : 0;
  children = H(children);
  const onlyStrings = children.every(child => typeof child === "string");
  if (onlyStrings) {
    children = children.join("");
  }
  return u("tspan", {
    "font-size": isFinite(fontSize) ? `${parseInt(fontSize)}px` : fontSize,
    "font-family": fontFamily,
    "font-weight": fontWeight,
    "letter-spacing": letterSpacing,
    fill: color === "inherit" ? "currentColor" : color,
    ...(outlineColor ? {
      "stroke": outlineColor === "inherit" ? "currentColor" : outlineColor,
      "stroke-width": thickness + outlineSize,
      "paint-order": "stroke"
    } : {}),
    ...props,
    children: children
  });
};
const normalizeChildren = children => {
  if (children === null || children === undefined) {
    return [];
  }
  if (typeof children === "number") {
    return [String(children)];
  }
  if (typeof children === "string") {
    return [children];
  }
  return children;
};
const splitLines = text => {
  const visitChildren = children => {
    if (children === null || children === undefined) {
      return [];
    }
    if (typeof children === "number") {
      children = [String(children)];
    }
    if (typeof children === "string") {
      children = [children];
    }
    const lines = [];
    let line;
    const startNewLine = () => {
      endCurrentLine();
      line = [];
    };
    const addChar = char => {
      line.push({
        type: "char",
        value: char,
        char
      });
    };
    const addChild = (child, parentChild) => {
      line.push({
        type: "component",
        value: child,
        char: typeof parentChild.value === "string" ? parentChild.value : parentChild.char
      });
    };
    const endCurrentLine = () => {
      if (line) {
        lines.push(line);
      }
    };
    startNewLine();
    for (const child of children) {
      if (typeof child === "string") {
        const chars = child.split("");
        for (const char of chars) {
          if (char === "\n") {

            startNewLine();
          } else {
            addChar(char);
          }
        }
      } else if (child.type === "br") {

        startNewLine();
      } else if (child.type.displayName?.includes("TextComponent")) {
        const {
          props
        } = child;
        const {
          children,
          ...childProps
        } = props;
        const [firstNestedLine, ...remainingNestedLines] = visitChildren(children);
        for (const part of firstNestedLine) {
          addChild(u(Tspan, {
            ...childProps,
            children: part.value
          }), part);
        }
        for (const remainingNestedLine of remainingNestedLines) {
          startNewLine();
          for (const remainingPart of remainingNestedLine) {
            addChild(u(Tspan, {
              ...childProps,
              children: remainingPart
            }), remainingPart);
          }
        }
      } else {
        addChild(child);
      }
    }
    if (line.length) {
      endCurrentLine();
    }
    return lines;
  };
  return visitChildren(text);
};













window.addEventListener("error", errorEvent => {
  if (isUpdatingText && errorEvent.message.includes("ResizeObserver loop completed with undelivered notifications.")) {
    errorEvent.stopImmediatePropagation();
    errorEvent.preventDefault();
    return;
  }
});













const MessageComponent = ({
  name,
  backgroundColor = "black",
  color = "white",
  borderColor = "white",
  borderStrokeColor = "black",
  borderSize = 5,
  borderStrokeSize = 1,
  borderRadius = 5,
  textOutlineColor = "black",
  overflow,
  textController,
  onClick,
  children,
  ...props
}, ref) => {
  return u(Box, {
    x: "center",
    y: "center",
    height: "100%",
    innerSpacing: "0.4em",
    maxWidth: "100%",
    cursor: onClick ? undefined : "default",
    backgroundColor: backgroundColor,
    border: borderWithStroke({
      color: borderColor,
      size: borderSize,
      strokeColor: borderStrokeColor,
      strokeSize: borderStrokeSize,
      radius: borderRadius
    }),
    onClick: onClick,
    ...props,
    style: {
      userSelect: "none",
      ...props.style
    },
    children: u(Text, {
      name: name,
      ref: ref,
      controller: textController,
      color: color,
      outlineColor: textOutlineColor,
      overflow: overflow,
      children: children
    })
  });
};
const Message = D(MessageComponent);

const DialogTextBoxComponent = ({
  color = "white",
  backgroundColor = "blue",
  children,
  overflow = "hidden",
  ...props
}, ref) => {
  const [text, textSetter] = d(null);
  const textController = useTextController();
  const messageElementRef = A();
  const alertPromiseRef = A();
  const timeoutRef = A(null);
  const next = event => {
    if (textController.hasNext) {
      textController.next();
    } else {
      close(event);
    }
  };
  const close = event => {
    const alertPromise = alertPromiseRef.current;
    if (!alertPromise) {
      return null;
    }
    const eventType = event?.type;
    if (eventType !== "click" && eventType !== "keydown") {
      const timeout = timeoutRef.current;
      if (timeout !== null) {
        return alertPromise;
      }
    }
    textSetter(null);
    alertPromise.resolve();
    alertPromiseRef.current = null;
    return alertPromise;
  };
  useKeyEffect({
    Enter: {
      enabled: textController.hasContent,
      callback: keyboardEvent => {
        next(keyboardEvent);
      }
    },
    Space: {
      enabled: textController.hasContent,
      callback: keyboardEvent => {
        next(keyboardEvent);
      }
    }
  });
  const alert = (text, {
    timeout
  } = {}) => {
    textSetter(text);
    let _resolve;
    const alertPromise = new Promise(resolve => {
      _resolve = resolve;
    });
    alertPromise.resolve = _resolve;
    alertPromiseRef.current = alertPromise;
    clearTimeout(timeoutRef.current);
    if (timeout) {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        close();
      }, timeout);
    }
    return {
      promise: alertPromise,
      close
    };
  };
  y(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);
  F(ref, () => {
    return {
      alert
    };
  });
  return u(Message, {
    ref: messageElementRef,
    textController: textController,
    color: color,
    backgroundColor: backgroundColor,
    invisible: !text,
    overflow: overflow,
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    innerSpacingY: "0.8em",
    innerSpacingX: "0.5em",
    onClick: clickEvent => {
      next(clickEvent);
    },
    ...props,
    children: text || children
  });
};
const DialogTextBox = D(DialogTextBoxComponent);

const Lifebar = ({
  value,
  max,
  fullColor = "yellow",
  emptyColor = "red"
}) => {
  if (max <= 40) {
    const bars = createBars(value, 40);
    return u(LifebarSvg, {
      bars: bars,
      barWidth: 2,
      fullColor: fullColor,
      emptyColor: emptyColor
    });
  }
  const moduloResult = value % 40;
  let numbersOfSmallBarsFilled;
  let numberOfMediumBarsFilled;
  if (moduloResult === 0) {
    numbersOfSmallBarsFilled = value <= 40 ? value : 40;
    numberOfMediumBarsFilled = value <= 40 ? 0 : Math.floor((value - 40) / 40);
  } else {
    numbersOfSmallBarsFilled = moduloResult;
    numberOfMediumBarsFilled = Math.floor(value / 40);
  }
  const smallBars = createBars(numbersOfSmallBarsFilled, 40);
  const numbersOfMediumBars = Math.floor((max - 40) / 40);
  if (numbersOfMediumBars <= 20) {
    const mediumBars = createBars(numberOfMediumBarsFilled, numbersOfMediumBars);
    return u("div", {
      style: "display: flex; flex-direction: column; width: 100%; height: 100%",
      children: [u("div", {
        style: "height: 70%",
        children: u(LifebarSvg, {
          bars: smallBars,
          barWidth: 2,
          emptyColor: emptyColor,
          fullColor: fullColor
        })
      }), u("div", {
        style: "height: 30%; padding-top: 1px",
        children: u("div", {
          style: "height: 100%",
          children: u(LifebarSvg, {
            bars: mediumBars,
            barWidth: 5,
            emptyColor: emptyColor,
            fullColor: fullColor
          })
        })
      })]
    });
  }
  const mediumBarsFirstRow = createBars(numberOfMediumBarsFilled, 20);
  const mediumBarsSecondRow = createBars(numberOfMediumBarsFilled - 20, numbersOfMediumBars - 20);
  return u("div", {
    style: "display: flex; flex-direction: column; width: 100%; height: 100%",
    children: [u("div", {
      style: "height: 30%",
      children: u(LifebarSvg, {
        bars: smallBars,
        barWidth: 2,
        emptyColor: emptyColor,
        fullColor: fullColor
      })
    }), u("div", {
      style: "height: 60%;",
      children: [u("div", {
        style: "height: 50%; padding-top: 1px",
        children: u("div", {
          style: "height: 100%",
          children: u(LifebarSvg, {
            bars: mediumBarsFirstRow,
            barWidth: 5,
            emptyColor: emptyColor,
            fullColor: fullColor
          })
        })
      }), u("div", {
        style: "height: 50%; padding-top: 1px",
        children: u("div", {
          style: "height: 100%",
          children: u(LifebarSvg, {
            bars: mediumBarsSecondRow,
            barWidth: 5,
            emptyColor: emptyColor,
            fullColor: fullColor
          })
        })
      })]
    })]
  });
};
const createBars = (filledCount, totalCount) => {
  const bars = [];
  let i = 0;
  while (i < totalCount) {
    bars.push({
      from: i,
      to: i + 1,
      filled: i < filledCount
    });
    i++;
  }
  return bars;
};
const LifebarSvg = ({
  barWidth,
  bars,
  barSpacing = 1,
  fullColor,
  emptyColor
}) => {
  const barHeight = 20;
  return u("svg", {
    width: "100%",
    height: "100%",
    viewBox: `0 0 120 ${barHeight}`,
    style: {
      display: "flex"
    },
    preserveAspectRatio: "none",
    children: u("g", {
      children: bars.map((bar, index) => {
        const x = index * (barWidth + barSpacing);
        return u("rect", {
          name: `life_${bar.from}:${bar.to}`,
          x: x,
          y: "0",
          width: barWidth,
          height: barHeight,
          fill: bar.filled ? fullColor : emptyColor
        }, index);
      })
    })
  });
};

const createParallelPlaybackController = (
  animations,
  { onremove = () => {}, onfinish = () => {} } = {},
) => {
  let resolveFinished;
  let rejectFinished;
  let animationFinishedCounter;
  const parallelAnimation = {
    playState: "idle",
    finished: null,
    onremove,
    onfinish,
    play: () => {
      if (parallelAnimation.playState === "running") {
        return;
      }
      if (
        parallelAnimation.playState === "paused" ||
        parallelAnimation.playState === "finished"
      ) {
        for (const animation of animations) {
          animation.play();
        }
        parallelAnimation.playState = "running";
        return;
      }
      parallelAnimation.finished = new Promise((resolve, reject) => {
        resolveFinished = resolve;
        rejectFinished = reject;
      });
      animationFinishedCounter = 0;
      for (const animation of animations) {

        animation.onfinish = () => {
          animationFinishedCounter++;
          if (animationFinishedCounter === animations.length) {
            parallelAnimation.onfinish();
            resolveFinished();
          }
        };
        animation.onremove = () => {
          parallelAnimation.remove();
        };
      }
    },
    pause: () => {
      if (parallelAnimation.playState === "paused") {
        return;
      }
      for (const animation of animations) {
        animation.pause();
      }
      parallelAnimation.playState = "paused";
    },
    finish: () => {
      if (parallelAnimation.playState === "finished") {
        return;
      }
      for (const animation of animations) {
        animation.finish();
      }
      parallelAnimation.playState = "finished";
    },
    remove: () => {
      if (parallelAnimation.playState === "removed") {
        return;
      }
      for (const animation of animations) {
        animation.remove();
      }
      parallelAnimation.playState = "removed";
      parallelAnimation.onremove();
      rejectFinished(createPlaybackAbortError());
    },
  };
  parallelAnimation.play();
  return parallelAnimation;
};

const createPlaybackSequenceController = (
  childCallbacks,
  {
    type = "sequence",
    onbeforestart = () => {},
    autoplay = true,
    onstart,
    onpause,
    onremove,
    onfinish,
  } = {},
) => {
  const sequence = {
    onstart,
    onpause,
    onremove,
    onfinish,
  };
  const sequenceContent = {
    type,
    start: ({ finished }) => {
      let childIndex;
      const getNextChild = () => {
        const isFirst = childIndex === 0;
        const isLast = childIndex === childCallbacks.length - 1;
        const childCallback = childCallbacks[childIndex];
        const nextChild = childCallback({
          index: childIndex,
          isFirst,
          isLast,
        });

        childIndex++;
        return nextChild;
      };

      let currentChild;
      childIndex = 0;
      const startNext = () => {
        if (childIndex === childCallbacks.length) {
          currentChild = undefined;
          finished();
          return;
        }
        currentChild = getNextChild();
        const state = currentChild.playbackController.stateSignal.peek();
        if (state === "running") {
          playbackController.play();
        } else if (state === "paused") {
          playbackController.pause();
        } else if (state === "finished") {
          startNext();
        }
        overrideEventCallback(currentChild, "onplay", () => {
          playbackController.play();
        });
        overrideEventCallback(currentChild, "onpause", () => {
          playbackController.pause();
        });
        overrideEventCallback(currentChild, "onfinish", () => {
          const state = playbackController.stateSignal.peek();
          if (state === "running") {
            startNext();
          }
        });
        overrideEventCallback(currentChild, "onremove", () => {
          playbackController.remove();
        });
      };
      onbeforestart();
      startNext();
      return {
        pause: () => {
          if (currentChild) {
            currentChild.pause();
            return () => {
              currentChild.play();
            };
          }
          return () => {};
        },
        finish: () => {
          if (currentChild) {
            currentChild.finish();
            while (childIndex < childCallbacks.length) {
              const nextChild = getNextChild();
              nextChild.finish();
            }
            currentChild = null;
          }
        },
        stop: () => {
          if (currentChild) {
            currentChild.stop();
            currentChild = undefined;
          }
        },
        remove: () => {
          if (currentChild) {
            currentChild.remove();
            currentChild = undefined;
          }
        },
      };
    },
  };
  const playbackController = createPlaybackController(sequenceContent);
  exposePlaybackControllerProps(playbackController, sequence);
  if (autoplay) {
    sequence.play();
  }
  return sequence;
};

const overrideEventCallback = (object, property, callback) => {
  const oldValue = object[property];
  object[property] = (...args) => {
    if (oldValue) {
      oldValue(...args);
    }
    callback(...args);
  };
  return () => {
    object[property] = oldValue;
  };
};

const PLAYBACK = {
  sequence: createPlaybackSequenceController,
  parallel: createParallelPlaybackController,
};

const animateDamageDisplay = (
  element,
  { id = "damage_display", toY = -0.4, duration, playbackRate = 0.5, ...rest },
) => {
  let from = 0;
  const interval = (to) => {
    const stepDuration = (to - from) * duration;
    from = to;
    return stepDuration;
  };
  const relativeToElementHeight = (ratio) => {
    return element.clientHeight * ratio;
  };
  const verticalMoves = [
    {
      y: relativeToElementHeight(toY),
      duration: interval(0.2),
      playbackRate: 0.2,
    },
    {
      y: relativeToElementHeight(toY / 2),
      duration: interval(0.4),
      playbackRate,
    },
    {
      y: relativeToElementHeight(toY / 4),
      duration: interval(0.6),
      playbackRate,
    },
    {
      y: relativeToElementHeight(0),
      duration: interval(1),
      playbackRate,
    },
  ];
  const steps = [];
  for (const { y, duration, playbackRate } of verticalMoves) {
    steps.push(({ index }) => {
      return animateElement(element, {
        id: `${id}_${index}`,
        to: { y },
        duration: duration / 2,
        easing: EASING.EASE,
        playbackRate,
      });
    });
    steps.push(({ index }) => {
      return animateElement(element, {
        id: `${id}_${index}`,
        to: { y: 0 },
        duration: duration / 2,
        easing: EASING.EASE,
        playbackRate,
      });
    });
  }

  let shouldDisplay;

  return PLAYBACK.sequence(steps, {
    onbeforestart: () => {
      const computedStyle = getComputedStyle(element);
      shouldDisplay = computedStyle.display === "none";
      if (shouldDisplay) {
        element.style.display = null;
      }
    },
    onfinish: () => {
      element.style.display = "none";
    },
    ...rest,
  });
};

const animateRecoilAfterHit = (element, { duration } = {}) => {
  let from = 0;
  const interval = (to) => {
    const stepDuration = (to - from) * duration;
    from = to;
    return stepDuration;
  };
  const relativeToElementHeight = (ratio) => {
    return element.clientHeight * ratio;
  };
  const verticalMoves = [
    { y: relativeToElementHeight(0.5), duration: interval(0.4) },
    { y: relativeToElementHeight(0.3), duration: interval(0.6) },
    { y: relativeToElementHeight(0.2), duration: interval(0.8) },
    { y: relativeToElementHeight(0.1), duration: interval(1) },
  ];
  const steps = [];
  for (const { y, duration } of verticalMoves) {
    steps.push(() => {
      return animateElement(element, {
        to: { y },
        duration: duration / 2,
        easing: EASING.EASE,
      });
    });
    steps.push(() => {
      return animateElement(element, {
        to: { y: 0 },
        duration: duration / 2,
        easing: EASING.EASE,
      });
    });
  }
  return PLAYBACK.sequence(steps);
};

const useFrame = (frames, { msBetweenFrames = 350, loop } = {}) => {
  const intervalRef = A();
  const frameIndexRef = A(0);
  const playStateRef = A("idle");
  const visualContentPlaybackIsPrevented =
    useVisualContentPlaybackIsPrevented();
  const [frame, frameSetter] = d(frames[0]);
  const play = q(() => {
    if (playStateRef.current === "running") {
      return;
    }
    if (playStateRef.current === "paused") ; else {
      frameIndexRef.current = 0;
    }
    playStateRef.current = "running";
    frameSetter(frames[frameIndexRef.current]);
    intervalRef.current = setInterval(() => {
      const frameIndex = frameIndexRef.current;
      if (frameIndex === frames.length - 1) {
        if (loop) {
          frameIndexRef.current = 0;
          frameSetter(frames[0]);
        } else {
          clearInterval(intervalRef.current);
        }
      } else {
        frameIndexRef.current++;
        frameSetter(frames[frameIndex + 1]);
      }
    }, msBetweenFrames);
  }, [...frames, msBetweenFrames, loop]);
  const pause = q(() => {
    if (playStateRef.current === "paused") return;
    playStateRef.current = "paused";
    clearInterval(intervalRef.current);
  }, []);

  y(() => {
    if (visualContentPlaybackIsPrevented) {
      pause();
    } else {
      play();
    }
  }, [visualContentPlaybackIsPrevented]);

  return [frame, play, pause];
};

const otoWalkASvgUrl = new URL(__v__("/other/oto_1.svg"), import.meta.url);
const otoWalkBSvgUrl = new URL(__v__("/other/oto_2.svg"), import.meta.url);
const Oto = D(({
  activity = "",

  animate = true
}, ref) => {
  const hasAnimation = activity !== "";
  const [frame, playFrameAnimation, pauseFrameAnimation] = useFrame(["a", "b"], {
    loop: true
  });
  _(() => {
    if (!animate || !hasAnimation) return () => {};
    playFrameAnimation();
    return pauseFrameAnimation;
  }, [animate, hasAnimation, playFrameAnimation, pauseFrameAnimation]);
  const url = frame === "a" ? otoWalkASvgUrl : otoWalkBSvgUrl;
  return u("img", {
    ref: ref,
    width: "100%",
    height: "auto",
    src: url
  });
});

const Digits = D(({
  children,
  ...props
}, ref) => {
  return u(Text, {
    ref: ref,
    color: "white",
    fontFamily: "goblin"

    ,
    outlineColor: "black",
    outlineSize: 2,
    letterSpacing: 2,
    lineHeight: 1.4,
    ...props,
    children: children
  });
});

const Ally = D((props, ref) => {
  const elementRef = A();
  const [damage, damageSetter] = d(null);
  const digitsElementRef = A();
  F(ref, () => {
    return {
      moveToAct: async () => {
        await animateElement(elementRef.current, {
          id: "ally_move_to_act",
          to: {
            y: -20
          },
          duration: 200
        }).finished;
      },
      moveBackToPosition: async () => {
        await animateElement(elementRef.current, {
          id: "ally_move_back_to_position",
          to: {
            y: 0
          },
          duration: 200
        }).finished;
      },
      recoilAfterHit: async () => {
        await animateRecoilAfterHit(elementRef.current, {
          duration: 500
        }).finished;
      },
      displayDamage: async value => {
        damageSetter(value);
        await animateDamageDisplay(digitsElementRef.current, {
          duration: 300,
          toY: -1.2
        }).finished;
      }
    };
  });
  return u(Box, {
    name: "ally_box",
    ratio: "1/1",
    height: "100%",
    x: "center",
    children: [u(Oto, {
      ref: elementRef,
      direction: "top",
      activity: "walking"
    }), u(Box, {
      ref: digitsElementRef,
      name: "digits_box",
      absolute: true,
      hidden: damage === null,
      width: "100%",
      height: "100%",
      children: u(Box, {
        x: "center",
        y: "end",
        children: u(Digits, {
          name: "digits",
          dx: "0.3em"
          ,
          children: damage
        })
      })
    })]
  });
});






const Img = D(({
  name,
  source,
  width,
  height,
  onFirstDisplay,
  ...props
}, ref) => {
  const innerRef = A();
  F(ref, () => innerRef.current);
  const imageAsCanvas = useImageCanvas(source, {
    width,
    height
  });
  useDrawImage(innerRef.current, imageAsCanvas, {
    onFirstDraw: onFirstDisplay
  });
  return u("canvas", {
    name: name,
    ref: innerRef,
    width: width,
    height: height,
    ...props,
    style: {
      width: "100%",
      height: "100%",
      ...props.style
    }
  });
});
const useImageCanvas = (sourceArg, {
  name,
  width,
  height
} = {}) => {
  let source;
  let sourceX;
  let sourceY;
  let sourceWidth;
  let sourceHeight;
  let sourceMirrorX;
  let sourceMirrorY;
  let sourceTransparentColor;
  if (isPlainObject(sourceArg)) {
    source = sourceArg.url || sourceArg.source;
    sourceX = sourceArg.x;
    if (sourceX === undefined) {
      sourceX = 0;
    } else {
      sourceX = parseInt(sourceX);
    }
    sourceY = sourceArg.y;
    if (sourceY === undefined) {
      sourceY = 0;
    } else {
      sourceY = parseInt(sourceY);
    }
    sourceWidth = sourceArg.width;
    sourceHeight = sourceArg.height;
    sourceTransparentColor = sourceArg.transparentColor;
    if (sourceTransparentColor === undefined) {
      sourceTransparentColor = [];
    } else if (typeof sourceTransparentColor[0] === "number") {
      sourceTransparentColor = [sourceTransparentColor];
    }
    sourceMirrorX = sourceArg.mirrorX;
    sourceMirrorY = sourceArg.mirrorY;
  }
  const [image] = useImageLoader(source);
  const [imageWidth, imageHeight] = getImageSize(image);
  if (width === undefined) {
    width = imageWidth;
  } else {
    width = parseInt(width);
  }
  if (height === undefined) {
    height = imageHeight;
  } else {
    height = parseInt(height);
  }
  if (sourceWidth === undefined) {
    sourceWidth = width;
  }
  if (sourceHeight === undefined) {
    sourceHeight = height;
  }
  const shouldReplace = T(() => createShouldReplace(sourceTransparentColor), sourceTransparentColor.map(color => `${color[0]}${color[1]}${color[2]}`));
  return T(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    if (!image) {
      return canvas;
    }
    const context = canvas.getContext("2d", {
      willReadFrequently: true
    });
    const transformations = {
      ...(sourceMirrorX || sourceMirrorY ? {
        flip: {
          x: sourceMirrorX,
          y: sourceMirrorY
        },
        translate: {
          x: sourceMirrorX ? -parseInt(width) : 0,
          y: sourceMirrorY ? -parseInt(height) : 0
        }
      } : {})
    };
    const hasTransformations = Object.keys(transformations).length > 0;
    context.clearRect(0, 0, width, height);
    if (hasTransformations) {
      context.save();
      const matrix = fromTransformations(transformations);
      context.setTransform(...matrix);

    }
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    if (hasTransformations) {
      context.restore();
    }
    if (shouldReplace) {
      const imageData = context.getImageData(0, 0, width, height);
      const pixels = imageData.data;
      for (let i = 0, n = pixels.length; i < n; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        if (shouldReplace(r, g, b)) {
          pixels[i + 3] = 0;
        }
      }
      context.putImageData(imageData, 0, 0);
    }
    return canvas;
  }, [name, image, width, height, sourceX, sourceY, sourceWidth, sourceHeight, sourceMirrorX, sourceMirrorY, shouldReplace]);
};
const getImageSize = object => {
  if (object instanceof HTMLImageElement || object instanceof SVGImageElement) {
    return [object.naturalWidth, object.naturalHeight];
  }
  if (object instanceof HTMLCanvasElement || object instanceof OffscreenCanvas) {
    return [object.width, object.height];
  }
  return [undefined, undefined];
};
const createShouldReplace = colorsToReplace => {
  if (!colorsToReplace) {
    return null;
  }
  if (colorsToReplace.length === 0) {
    return null;
  }
  if (colorsToReplace.length === 1) {
    const colorToReplace = colorsToReplace[0];
    const rToReplace = parseInt(colorToReplace[0]);
    const gToReplace = parseInt(colorToReplace[1]);
    const bToReplace = parseInt(colorToReplace[2]);
    return (r, g, b) => {
      return r === rToReplace && g === gToReplace && b === bToReplace;
    };
  }
  return (r, g, b) => {
    return colorsToReplace.some(c => {
      return r === c[0] && g === c[1] && b === c[2];
    });
  };
};
const isPlainObject = obj => {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  let proto = obj;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(obj) === proto || Object.getPrototypeOf(obj) === null;
};

const battleBackgroundsSpritesheetUrl = new URL(__v__("/other/battle_background_spritesheet.png"), import.meta.url);
const MountainAndSkyBattleBackground = D((props, ref) => {
  return u(Img, {
    ref: ref,
    name: "mountain_and_sky",
    source: {
      url: battleBackgroundsSpritesheetUrl,
      x: 260 * 1 + 5,
      y: 100 * 0 + 1
    },
    width: "254",
    height: "200",
    ...props
  });
});

const inlineContent$1 = new __InlineContent__("button {\n  outline: none;\n  position: relative;\n}\n\n.focus_ring, .active_ring {\n  color: #0000;\n  position: absolute;\n  inset: 0;\n  overflow: visible;\n}\n\n:focus-visible > .focus_ring {\n  color: #ff0;\n}\n\n@media (hover: hover) {\n  :hover > .active_ring, :active > .active_ring {\n    color: #fff3;\n  }\n}\n", { type: "text/css" });
const stylesheet$1 = new CSSStyleSheet();
stylesheet$1.replaceSync(inlineContent$1.text);

document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet$1];

const Button = ({
  children,
  color,
  ...props
}) => {
  const [hovered, hoveredSetter] = d(false);
  return u(Box.button, {
    onMouseEnter: () => {
      hoveredSetter(true);
    },
    onMouseLeave: () => {
      hoveredSetter(false);
    },
    color: hovered ? HOVER_TEXT_COLOR : color,
    ...props,
    children: children
  });
};
const ButtonMessage = ({
  children,
  width,
  height,
  ...props
}) => {
  return u(Button, {
    color: "white",
    cursor: "pointer",
    width: width,
    height: height,
    ...props,
    children: u(Message, {
      width: width,
      height: height,
      cursor: "pointer",
      color: "inherit",
      children: children
    })
  });
};

const MenuFight = ({
  onAttack
}) => {
  return u(ButtonMessage, {
    y: "end",
    onClick: () => {
      onAttack();
    },
    children: "Attaque"
  });
};

const erase = (
  canvas,
  {
    duration = 300,
    x = 0,
    y = 0,
    width = canvas.width,
    height = canvas.height,
    iterations = 4,
  } = {},
) => {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = context.getImageData(x, y, width, height);
  const allColors = imageData.data;
  const nonTransparentPixelSet = new Set();
  let pixelX = 0;
  let pixelY = 0;
  for (let i = 0, n = allColors.length; i < n; i += 4) {
    const alpha = allColors[i + 3];
    if (alpha !== 0) {
      nonTransparentPixelSet.add({
        index: i,
        x: pixelX,
        y: pixelY,
      });
      pixelX++;
      if (pixelX === width) {
        pixelX = 0;
        pixelY++;
      }
    }
  }

  const executors = [];
  let i = 0;
  const eraseStepDuration = duration / iterations;
  while (i < iterations) {
    let stepIndex = i;
    executors.push(() => {
      return animateRatio({
        type: "erase_step",
        effect: () => {},
        onstart: () => {
          for (const nonTransparentPixel of nonTransparentPixelSet) {
            const everyNthPixel = iterations - stepIndex;
            if (nonTransparentPixel.x % everyNthPixel === 0) {
              allColors[nonTransparentPixel.index + 3] = 0;
              nonTransparentPixelSet.delete(nonTransparentPixel);
            }
          }

          context.putImageData(imageData, 0, 0);
        },
        duration: eraseStepDuration,
      });
    });
    i++;
  }
  return PLAYBACK.sequence(executors);
};

const WELL_KNOWN_COLORS = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 255, 0],
};

const animateColor = (
  fromColor,
  toColor,
  {
    duration,
    easing,
    autoplay,
    effect,
    onstart,
    onpause,
    onremove,
    onfinish,
  } = {},
) => {
  if (typeof fromColor === "string") fromColor = WELL_KNOWN_COLORS[fromColor];
  if (typeof toColor === "string") toColor = WELL_KNOWN_COLORS[toColor];
  const colorSignal = d$1(fromColor);
  const [rFrom, gFrom, bFrom] = fromColor;
  const [rTo, gTo, bTo] = toColor;
  let r = rFrom;
  let g = gFrom;
  let b = bFrom;
  const colorAnimation = animateRatio({
    type: "color_animation",
    props: {
      colorSignal,
    },
    duration,
    easing,
    autoplay,
    effect: (ratio) => {
      r = applyRatioToDiff(rFrom, rTo, ratio);
      g = applyRatioToDiff(gFrom, gTo, ratio);
      b = applyRatioToDiff(bFrom, bTo, ratio);
      const color = [r, g, b];
      colorSignal.value = color;
      if (effect) {
        effect(color);
      }
    },
    onstart,
    onpause,
    onremove,
    onfinish,
  });
  return colorAnimation;
};

const glow = (
  canvas,
  {
    fromColor = "black",
    toColor = "white",
    duration = 300,
    iterations = 2,
    x = 0,
    y = 0,
    width = canvas.width,
    height = canvas.height,
    easing = EASING.EASE_OUT_EXPO,
  } = {},
) => {
  if (typeof fromColor === "string") fromColor = WELL_KNOWN_COLORS[fromColor];
  if (typeof toColor === "string") toColor = WELL_KNOWN_COLORS[toColor];
  const [rFrom, gFrom, bFrom] = fromColor;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = context.getImageData(x, y, width, height);
  const allColors = imageData.data;
  const pixelIndexes = [];
  for (let i = 0, n = allColors.length; i < n; i += 4) {
    const rCandidate = allColors[i];
    const gCandidate = allColors[i + 1];
    const bCandidate = allColors[i + 2];
    if (rCandidate === rFrom && gCandidate === gFrom && bCandidate === bFrom) {
      pixelIndexes.push(i);
    }
  }

  let currentColor = fromColor;
  const glowStepDuration = duration / (iterations * 2);
  const animateColorTo = (toColor) => {
    const colorAnimation = animateColor(currentColor, toColor, {
      effect: ([r, g, b]) => {
        for (const pixelIndex of pixelIndexes) {
          allColors[pixelIndex] = r;
          allColors[pixelIndex + 1] = g;
          allColors[pixelIndex + 2] = b;
        }

        context.putImageData(imageData, 0, 0);
        currentColor = [r, g, b];
      },
      duration: glowStepDuration,
      easing,
    });
    return colorAnimation;
  };

  const animationExecutors = [];
  let i = 0;
  while (i < iterations) {
    i++;
    animationExecutors.push(() => {
      return animateColorTo(toColor);
    });
    animationExecutors.push(() => {
      return animateColorTo(fromColor);
    });
  }
  const glowAnimation = PLAYBACK.sequence(animationExecutors);
  return glowAnimation;
};

const weaponSpriteSheetUrl = new URL(__v__("/other/weapon.png"), import.meta.url);
const WEAPON_CELLS = {
  sword_a: {
    x: 195,
    y: 265,
    width: 64,
    height: 64
  }
};
const SwordAImg = D((props, ref) => {
  const {
    x,
    y,
    width,
    height
  } = WEAPON_CELLS[`sword_a`];
  return u(Img, {
    ref: ref,
    name: "sword_a",
    source: {
      url: weaponSpriteSheetUrl,
      x,
      y
    },
    width: width,
    height: height,
    ...props
  });
});

const Opponent = D(({
  isDead,
  fightIsWaiting,
  playerIsSelectingTarget,
  name,
  imageUrl,
  imageX,
  imageY,
  imageWidth,
  imageHeight,
  imageTransparentColor,
  onSelect,
  onFirstDisplay
}, ref) => {
  const imgRef = A();
  const digitsElementRef = A();
  const weaponElementRef = A();
  const [enemyDamage, enemyDamageSetter] = d(null);
  F(ref, () => {
    return {
      glow: async () => {
        await glow(imgRef.current, {
          duration: 300
        }).finished;
      },
      erase: async () => {
        await erase(imgRef.current, {
          iterations: 4,
          duration: 300
        }).finished;
      },
      playWeaponAnimation: async () => {
        await animateElement(weaponElementRef.current, {
          id: "weapon_animation",
          from: {
            x: 25
          },
          to: {
            x: -15
          },
          duration: 200
        }).finished;
      },
      displayDamage: async value => {
        enemyDamageSetter(value);
        await animateDamageDisplay(digitsElementRef.current, {
          duration: 300
        }).finished;
      }
    };
  });
  return u(Box, {
    vertical: true,
    name: "opponent_container_box",
    width: "100%",
    height: "100%",
    x: "center",
    children: [u(Box, {
      name: "top_ui",
      width: "100%",
      innerSpacing: "0.5em",
      children: u(Message, {
        name: "opponent_name",
        hidden: !fightIsWaiting || isDead,
        innerSpacing: "0.7em",
        children: name
      })
    }), u(Box, {
      name: "opponent_box",
      ratio: "1/1",
      height: "...",
      x: "center",
      innerSpacing: "10",
      focused: playerIsSelectingTarget,
      focusedOutlineWidth: "20%",
      focusedOutlineRadius: 10,
      focusedOutlineSize: 7,
      onClick: playerIsSelectingTarget ? () => {
        onSelect();
      } : undefined,
      children: [u(Img, {
        ref: imgRef,
        source: {
          url: imageUrl,
          x: imageX,
          y: imageY,
          transparentColor: imageTransparentColor
        },
        width: imageWidth,
        height: imageHeight,
        hidden: isDead,
        onFirstDisplay: onFirstDisplay
      }), u(Box, {
        name: "weapon_box",
        absolute: true,
        ratio: "1/1",
        height: "50%",
        x: "center",
        y: "center",
        children: u(SwordAImg, {
          style: {
            display: "none"
          },
          ref: weaponElementRef
        })
      }), u(Box, {
        ref: digitsElementRef,
        name: "opponent_digits_box",
        absolute: true,
        hidden: enemyDamage === null,
        width: "100%",
        height: "100%",
        children: u(Box, {
          x: "center",
          y: "center",
          children: u(Digits, {
            name: "opponent_digits",
            children: enemyDamage
          })
        })
      })]
    })]
  });
});

const opponentSpritesheetUrl = new URL(
  __v__("/other/opponent_sprite.png"),
  import.meta.url,
);
const hpAbove = (limit) => {
  return ({ hp, hpMax }) => {
    const hpLimit =
      typeof limit === "string" ? (parseFloat(limit) / 100) * hpMax : limit;
    return hp > hpLimit;
  };
};

const taurus = {
  name: "Taurus",
  attributes: {
    hp: 55,
    attack: 1,
    defense: 0,
    speed: 2,
  },
  abilities: {
    horns: {
      name: "Cornes",
      power: 10,
    },
  },
  image: {
    url: opponentSpritesheetUrl,
    transparentColor: [0, 202, 202],
    width: 62,
    height: 62,
  },
  states: {
    full_life: {
      conditions: {
        hp: hpAbove("80%"),
      },
      image: {
        x: 450,
        y: 100,
      },
    },
    mid_life: {
      conditions: {
        hp: hpAbove("25%"),
      },
      image: {
        x: 515,
        y: 100,
      },
      abilities: {
        horns: null,
        bite: {
          name: "Morsure",
          power: 2,
        },
      },
    },
    low_life: {
      conditions: {
        hp: () => true,
      },
      image: {
        x: 580,
        y: 100,
      },
      abilities: {
        horns: null,
        bite: null,
        charge: {
          name: "Charge",
          power: 5,
        },
      },
    },
  },
};

const battleMusicUrl = new URL(__v__("/other/battle_bg_a.mp3"), import.meta.url).href;
const heroHitSoundUrl = new URL(__v__("/other/hero_hit_2.mp3"), import.meta.url).href;
const oponentDieSoundUrl = new URL(__v__("/other/opponent_die.mp3"), import.meta.url).href;
const victoryMusicUrl = new URL(__v__("/other/victory.mp3"), import.meta.url).href;
const swordASoundUrl = new URL(__v__("/other/sword_a.mp3"), import.meta.url).href;
const opponentSignal = d$1(taurus);
const opponentImageSignal = w(() => opponentSignal.value.image);
const opponentNameSignal = w(() => opponentSignal.value.name);
const opponentHpMaxSignal = w(() => opponentSignal.value.attributes.hp);
const opponentAttackSignal = w(() => opponentSignal.value.attributes.attack);
const opponentDefenseSignal = w(() => opponentSignal.value.attributes.defense);
const opponentSpeedSignal = w(() => opponentSignal.value.attributes.speed);
const opponentStatesSignal = w(() => opponentSignal.value.states);
const opponentAbilitiesSignal = w(() => opponentSignal.value.abilities);
const heroSpeedSignal = d$1(1);
const heroAttackSignal = d$1(1);
const heroDefenseSignal = d$1(1);
const weaponPowerSignal = d$1(200);
const swordSound = sound({
  url: swordASoundUrl,
  volume: 0.5,
  startTime: 0.1
});




const heroHitSound = sound({
  url: heroHitSoundUrl,
  volume: 0.7
});
const opponentDieSound = sound({
  url: oponentDieSoundUrl,
  volume: 0.7
});
const battleMusic = music({
  name: "battle",
  url: battleMusicUrl
});
const victoryMusic = music({
  name: "victory",
  url: victoryMusicUrl,
  volume: 0.5
});
const Fight = ({
  onFightEnd
}) => {
  const dialogRef = A();
  const gamePaused = useGamePaused();
  const [fightStep, fightStepSetter] = d("waiting");
  const fightIsWaiting = fightStep === "waiting";
  const playerIsSelectingTarget = fightStep === "player_is_selecting_target";
  const fightIsWon = fightStep === "won";
  const fightIsLost = fightStep === "lost";
  const fightIsOver = fightIsWon || fightIsLost;
  const opponentName = opponentNameSignal.value;
  const opponentAttack = opponentAttackSignal.value;
  const opponentDefense = opponentDefenseSignal.value;
  const opponentSpeed = opponentSpeedSignal.value;
  const opponentHpMax = opponentHpMaxSignal.value;
  const [opponentHp, opponentHpSetter] = d(opponentHpMax);
  const decreaseOpponentHp = q(value => {
    opponentHpSetter(hp => hp - value);
  }, []);
  const [opponentIsDead, opponentIsDeadSetter] = d(false);
  const opponentAbilitiesBase = opponentAbilitiesSignal.value;
  const opponentStates = opponentStatesSignal.value;
  const opponentStateKey = opponentStates ? Object.keys(opponentStates).find(key => {
    const {
      conditions
    } = opponentStates[key];
    if (conditions.hp && conditions.hp({
      hp: opponentHp,
      hpMax: opponentHpMax
    })) {
      return true;
    }
    return false;
  }) : null;
  const opponentPropsFromState = opponentStateKey ? opponentStates[opponentStateKey] : {};
  const opponentAbilities = Object.assign(opponentAbilitiesBase, opponentPropsFromState.abilities);
  let opponentImage = opponentImageSignal.value;
  if (opponentPropsFromState.image) {
    opponentImage = {
      ...opponentImage,
      ...opponentPropsFromState.image
    };
  }
  const oponentRef = A();
  const [opponentImageDisplayed, opponentImageDisplayedSetter] = d(false);
  const onOpponentFirstDisplay = q(() => {
    opponentImageDisplayedSetter(true);
  }, []);
  const heroRef = A();
  const heroAttack = heroAttackSignal.value;
  const heroDefense = heroDefenseSignal.value;
  const heroSpeed = heroSpeedSignal.value;
  const weaponPower = weaponPowerSignal.value;
  const [heroHp, heroHpSetter] = d(40);
  const decreaseHeroHp = q(value => {
    heroHpSetter(hp => hp - value);
  }, []);
  const [heroMaxHp] = d(40);
  y(() => {
    battleMusic.play();

  }, []);
  const backgroundCurtainRef = A();
  useKeyEffect({
    Escape: q(() => {
      if (playerIsSelectingTarget) {
        fightStepSetter("waiting");
      }
    }, [playerIsSelectingTarget])
  });
  const performOpponentTurn = async () => {
    fightStepSetter("opponent_turn_start");
    let abilityChoosen = null;
    for (const abilityKey of Object.keys(opponentAbilities)) {
      const ability = opponentAbilities[abilityKey];
      if (!ability) {
        continue;
      }
      abilityChoosen = ability;
      break;
    }
    let damage = opponentAttack + abilityChoosen.power - heroDefense;
    if (damage < 0) {
      damage = 0;
    }
    const oponentAlert = dialogRef.current.alert(`${opponentName} attaque avec ${abilityChoosen.name}.`, {
      timeout: 500
    });
    await oponentRef.current.glow();
    await oponentAlert.close();
    heroHitSound.play();
    await heroRef.current.recoilAfterHit();
    await new Promise(resolve => setTimeout(resolve, 150));
    await heroRef.current.displayDamage(damage);
    decreaseHeroHp(damage);
    fightStepSetter("opponent_turn_end");
  };
  const performHeroTurn = async () => {
    fightStepSetter("hero_turn_start");
    const heroAlert = dialogRef.current.alert("Hero attaque avec Epée -A-.", {
      timeout: 500
    });
    let damage = heroAttack + weaponPower - opponentDefense;
    if (damage < 0) {
      damage = 0;
    }
    await heroRef.current.moveToAct();
    backgroundCurtainRef.current.show({
      color: "white"
    });
    setTimeout(() => {
      backgroundCurtainRef.current?.hide();
    }, 200);
    swordSound.play();
    await oponentRef.current.playWeaponAnimation();
    await heroAlert.close();
    const moveBackToPositionPromise = heroRef.current.moveBackToPosition();
    await new Promise(resolve => setTimeout(resolve, 200));
    await Promise.all([oponentRef.current.displayDamage(damage), moveBackToPositionPromise]);
    decreaseOpponentHp(damage);
    fightStepSetter("hero_turn_end");
  };
  const checkTurnEndEffects = async () => {
    if (opponentHp <= 0) {
      opponentDieSound.play();
      await oponentRef.current.erase();
      opponentIsDeadSetter(true);
      await new Promise(resolve => setTimeout(resolve, 400));
      victoryMusic.play();
      fightStepSetter("won");
      onFightEnd("won");
      return;
    }
    if (heroHp <= 0) {




      fightStepSetter("lost");
      onFightEnd("lost");
      return;
    }
    if (fightStep === "hero_turn_end") {
      performOpponentTurn();
      return;
    }
    if (fightStep === "opponent_turn_end") {
      fightStepSetter("waiting");
    }
    return;
  };
  y(() => {
    if (fightStep === "hero_turn_end" || fightStep === "opponent_turn_end") {
      checkTurnEndEffects();
    }
  }, [fightStep, opponentHp]);
  const firstTurnRef = A(false);
  y(() => {
    if (gamePaused) {
      return;
    }
    if (!opponentImageDisplayed) {
      return;
    }
    if (firstTurnRef.current) {
      return;
    }
    firstTurnRef.current = true;
    if (opponentSpeed <= heroSpeed) {
      return;
    }
    performOpponentTurn();
  }, [gamePaused, opponentImageDisplayed, opponentSpeed, heroSpeed]);
  return u(k, {
    children: [u(Box, {
      vertical: true,
      name: "game",
      width: "100%",
      height: "...",
      children: [u(Box, {
        name: "background",
        absolute: true,
        width: "100%",
        height: "100%",
        children: [u(MountainAndSkyBattleBackground, {}), u(Curtain, {
          ref: backgroundCurtainRef
        })]
      }), u(Box, {
        name: "opponents_box",
        width: "100%",
        height: "55%",
        children: u(Opponent, {
          ref: oponentRef,
          fightIsWaiting: fightIsWaiting,
          playerIsSelectingTarget: playerIsSelectingTarget,
          isDead: opponentIsDead,
          name: opponentName,
          imageUrl: opponentImage.url,
          imageTransparentColor: opponentImage.transparentColor,
          imageX: opponentImage.x,
          imageY: opponentImage.y,
          imageWidth: opponentImage.width,
          imageHeight: opponentImage.height,
          onFirstDisplay: onOpponentFirstDisplay,
          onSelect: () => {
            performHeroTurn();
          }
        })
      }), u(Box, {
        name: "front_line",
        width: "100%",
        height: "10%"
      }), u(Box, {
        name: "allies_box",
        height: "15%",
        width: "100%",
        children: u(Ally, {
          ref: heroRef
        })
      }), u(Box, {
        name: "bottom_ui",
        width: "100%",
        height: "...",
        children: [u(Box, {
          absolute: true,
          width: "100%",
          height: "95%",
          contentX: "center",
          contentY: "end",
          hidden: !fightIsWaiting || fightIsOver,
          children: u(MenuFight, {
            onAttack: () => {
              if (fightIsWaiting && !gamePaused) {
                fightStepSetter("player_is_selecting_target");
              }
            }
          })
        }), u(DialogTextBox, {
          ref: dialogRef,
          absolute: true,
          width: "90%",
          height: "80%",
          contentX: "start",
          contentY: "start",
          x: "center",
          y: "center"
        })]
      })]
    }), u(Box, {
      name: "bottom_hud",
      width: "100%",
      height: "15%",
      maxHeight: "50",
      y: "end",
      innerSpacing: "xss",
      style: {
        background: "black"
      },
      children: [u(Box, {
        name: "hero_hud",
        width: "50%",
        height: "100%",
        maxHeight: "100%",
        innerSpacing: "s",
        border: borderWithStroke({
          color: "white",
          size: 2,
          strokeColor: "black"
        }),
        children: [u(Box, {
          name: "lifebar_box",
          width: "80%",
          height: "30",
          y: "center",
          children: u(Lifebar, {
            value: heroHp,
            max: heroMaxHp
          })
        }), u(Box, {
          name: "weapon_box",
          ratio: "1/1",
          width: "20%",
          x: "end",
          y: "center",
          children: u(SwordAImg, {})
        })]
      }), u(Box, {
        name: "ally_hud",
        width: "50%",
        height: "100%",
        border: borderWithStroke({
          color: "white",
          size: 2,
          strokeColor: "black"
        }),
        children: "Empty"
      })]
    })]
  });
};

const PauseDialog = ({
  visible
}) => {
  const gamePaused = useGamePaused();
  useKeyEffect({
    Escape: {
      enabled: !gamePaused,
      callback: () => {
        pauseGame();
      }
    },
    Enter: {
      enabled: gamePaused,
      callback: () => {
        playGame();
      }
    }
  });
  return u("div", {
    name: "pause_dialog",
    style: {
      position: "absolute",
      display: visible ? "flex" : "none",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center"
    },
    onClick: () => {
      playGame();
    },
    children: u("button", {
      disabled: !visible,
      children: "Play"
    })
  });
};

const inlineContent = new __InlineContent__(".app {\n  text-align: center;\n}\n\n.app_logo {\n  pointer-events: none;\n  height: 40vmin;\n}\n\n@media (prefers-reduced-motion: no-preference) {\n  .app_logo {\n    animation: 20s linear infinite app_logo_spin;\n  }\n}\n\n.app_header {\n  color: #fff;\n  background-color: #282c34;\n  flex-direction: column;\n  justify-content: center;\n  align-items: center;\n  min-height: 100vh;\n  font-size: calc(10px + 2vmin);\n  display: flex;\n}\n\n.app_link {\n  color: #61dafb;\n}\n\n@keyframes app_logo_spin {\n  from {\n    transform: rotate(0);\n  }\n\n  to {\n    transform: rotate(360deg);\n  }\n}\n", { type: "text/css" });
const stylesheet = new CSSStyleSheet();
stylesheet.replaceSync(inlineContent.text);

const Game = () => {
  _(() => {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(s => s !== stylesheet);
    };
  }, []);
  const gamePaused = useGamePaused();
  const sceneCurtainRef = A();
  return u("div", {
    style: "font-size: 16px;",
    children: [u(Box, {
      vertical: true,
      name: "screen",
      width: "400",
      height: "400",
      children: [u(Box, {
        name: "top_hud",
        width: "100%",
        height: "10%",
        backgroundColor: "red",
        border: borderWithStroke({
          color: "white",
          size: 2,
          strokeColor: "black"
        }),
        children: [u(ButtonMuteUnmute, {}), u(ButtonPlayPause, {})]
      }), u(Fight, {
        onFightEnd: () => {
          sceneCurtainRef.current.fadeIn();
        }
      }), u(Curtain, {
        ref: sceneCurtainRef
      }), u(PauseDialog, {
        visible: gamePaused
      })]
    }), u("div", {
      children: u("button", {
        onClick: () => {
          if (gamePaused) {
            playGame();
          } else {
            pauseGame();
          }
        },
        children: gamePaused ? "play" : "pause"
      })
    })]
  });
};

const GameWithErrorBoundary = () => {
  const [error] = b();
  const goblinFont = useFontFace("goblin", {
    url: goblinFontUrl
  });
  y(() => {
    {
      return null;
    }
  }, [error]);
  if (error) {
    return `An error occurred: ${error.message}`;
  }
  if (!goblinFont) {
    return "loading font";
  }
  return u(Game, {});
};
E$1(u(GameWithErrorBoundary, {}), document.querySelector("#root"));