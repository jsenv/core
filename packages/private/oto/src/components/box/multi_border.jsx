import { useResizeObserver } from "hooks/use_resize_observer.js";
import { resolveDimensions, resolveSize } from "oto/src/utils/size_resolver.js";
import { useLayoutEffect, useState } from "preact/hooks";

export const useMultiBorder = (ref, borders) => {
  const [fontSize, fontSizeSetter] = useState(16);
  useLayoutEffect(() => {
    let { fontSize } = window.getComputedStyle(ref.current, null);
    fontSize = parseFloat(fontSize);
    fontSizeSetter(fontSize);
  }, []);
  const [availableWidth = 0, availableHeight = 0] = useResizeObserver({
    ref,
  });

  let solidBorderFullSize = 0;
  let outsideBorderFullSize = 0;
  let borderFullSize = 0;
  const resolvedBorders = [];
  let solidOuterBorderRadius;
  for (const border of borders) {
    let { size = 1, strokeSize = 0, radius = 0, spacing = 0 } = border;
    const resolvedBorder = {
      ...border,
      strokeSize,
      size: resolveSize(size, {
        availableSize: availableWidth,
        fontSize,
      }),
      radius: resolveSize(radius, {
        availableSize: availableWidth,
        fontSize,
      }),
      spacing: resolveSize(spacing, {
        availableSize: availableWidth,
        fontSize,
      }),
    };
    const sizeTakenByBorder =
      resolvedBorder.size + resolvedBorder.strokeSize + resolvedBorder.spacing;
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
      maxHeight,
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
      maxHeight,
    });
    resolvedBorder.width = cornerWidth;
    resolvedBorder.height = cornerHeight;
    resolvedBorder.x = x;
    resolvedBorder.y = y;
    resolvedBorder.rectangleWidth = remainingWidth;
    resolvedBorder.rectangleHeight = remainingHeight;

    const sizeTakenByBorder =
      resolvedBorder.size + resolvedBorder.strokeSize + resolvedBorder.spacing;
    x += sizeTakenByBorder;
    y += sizeTakenByBorder;
    remainingWidth -= sizeTakenByBorder * 2;
    remainingHeight -= sizeTakenByBorder * 2;
  }

  const multiBorderProps = {
    borders: resolvedBorders,
    borderFullSize,
    width: rectangleWidth,
    height: rectangleHeight,
  };

  const parentStyles = {};
  if (solidBorderFullSize) {
    parentStyles.borderWidth = `${solidBorderFullSize}px`;
    parentStyles.borderColor = "transparent";
    parentStyles.borderStyle = "solid";
    // parentStyles.backgroundClip = "padding-box";
    parentStyles.borderRadius = solidOuterBorderRadius;
  }

  return [parentStyles, multiBorderProps];
};

export const MultiBorder = ({ borders, borderFullSize, width, height }) => {
  if (borders.length === 0) {
    return null;
  }
  const children = [];
  let index = 0;
  for (const border of borders) {
    children.push(<Borders key={index} {...border} />);
    index++;
  }
  return (
    <div
      name="multi_border"
      style={{
        position: "absolute",
        inset: `-${borderFullSize}px`,
        pointerEvents: "none",
      }}
    >
      <svg style={{ overflow: "visible" }} width={width} height={height}>
        {children}
      </svg>
    </div>
  );
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
  opacity,
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
    strokeSize,
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
    strokeSize,
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
    strokeSize,
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
    strokeSize,
  });

  if (width * 2 === rectangleWidth && height * 2 === rectangleHeight) {
    const bordersPaths = {
      // it's ok to add all paths together because:
      // - they don't overlao
      // - they can be null and null + null gives 0 which will be ignored
      //   by <Border> component that will not try to render a path
      //   being null
      fill:
        topLeftPaths.fill +
        topRightPaths.fill +
        bottomRightPaths.fill +
        bottomLeftPaths.fill,
      stroke:
        topLeftPaths.stroke +
        topRightPaths.stroke +
        bottomRightPaths.stroke +
        bottomLeftPaths.stroke,
    };
    return (
      <g name="borders" data-radius={radius} data-size={size}>
        <Border
          name="border"
          paths={bordersPaths}
          color={color}
          strokeColor={strokeColor}
          opacity={opacity}
        ></Border>
      </g>
    );
  }

  return (
    <g name="corners" data-radius={radius} data-size={size}>
      <Border
        name="top_left"
        paths={topLeftPaths}
        color={color}
        strokeColor={strokeColor}
        opacity={opacity}
      />
      <Border
        name="top_right"
        paths={topRightPaths}
        color={color}
        strokeColor={strokeColor}
        opacity={opacity}
      />
      <Border
        name="bottom_right"
        paths={bottomRightPaths}
        color={color}
        strokeColor={strokeColor}
        opacity={opacity}
      />
      <Border
        name="bottom_left"
        paths={bottomLeftPaths}
        color={color}
        strokeColor={strokeColor}
        opacity={opacity}
      />
    </g>
  );
};

const Border = ({ name, paths, color, strokeColor, opacity }) => {
  if (paths.stroke) {
    return (
      <>
        <path
          name={`${name}_stroke`}
          d={paths.stroke}
          fill={strokeColor}
          opacity={opacity}
        />
        <path
          name={`${name}_fill`}
          d={paths.fill}
          fill={color}
          opacity={opacity}
        />
      </>
    );
  }
  if (paths.fill) {
    return (
      <path
        name={`${name}_fill`}
        d={paths.fill}
        fill={color}
        opacity={opacity}
      />
    );
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
  strokeSize,
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
      radius,
    });
    const fill = buildPath({
      x: fillX,
      y: fillY,
      width,
      height,
      size,
      radius: radius - strokeSize / 2,
    });
    return { stroke, fill };
  }
  const fill = buildPath({
    x,
    y,
    width,
    height,
    size,
    radius,
  });
  return { fill };
};
const buildTopLeftCornerPath = ({
  isStroke,
  x,
  y,
  width,
  height,
  size,
  radius,
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
    d.push(
      `a ${outerRadiusX},${outerRadiusY} 0 0 1 ${outerRadiusDX},-${outerRadiusDY}`,
    );
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
      d.push(
        `a ${innerRadiusX},${innerRadiusY} 0 0 0 -${innerRadiusX},${innerRadiusY}`,
      );
      if (rightLineHeight > 0) {
        d.push(`v ${rightLineHeight}`);
      }
      d.push(`h -${sizeX}`);
    } else {
      d.push(
        `v ${sizeY}`,
        `h -${width - sizeX}`,
        `v ${height - sizeY}`,
        `h -${sizeX}`,
      );
    }
  } else {
    d.push(
      `M ${x},${y + height}`,
      `v -${height}`,
      `h ${width}`,
      `v ${sizeY}`,
      `h -${width - sizeX}`,
      `v ${height - sizeY}`,
      `h -${sizeX}`,
    );
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
  radius,
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
    d.push(
      `a ${outerRadiusX},${outerRadiusY} 0 0 1 ${outerRadiusDX},${outerRadiusDY}`,
    );
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
      d.push(
        `a ${innerRadiusX},${innerRadiusY} 0 0 0 -${innerRadiusX},-${innerRadiusY}`,
      );
      if (bottomLineWidth > 0) {
        d.push(`h -${bottomLineWidth}`);
      }
      d.push(`v -${sizeY}`);
    } else {
      d.push(
        `h -${sizeX}`,
        `v -${height - sizeY}`,
        `h -${width - sizeX}`,
        `v -${sizeY}`,
      );
    }
  } else {
    d = [
      `M ${x - width},${y}`,
      `h ${width}`,
      `v ${height}`,
      `h -${sizeX}`,
      `v -${height - sizeY}`,
      `h -${width - sizeX}`,
      `v -${sizeY}`,
    ];
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
  radius,
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
    d.push(
      `a ${outerRadiusX},${outerRadiusY} 0 0 1 -${outerRadiusDX},${outerRadiusDY}`,
    );
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
      d.push(
        `a ${innerRadiusX},${innerRadiusY} 0 0 0 ${innerRadiusX},-${innerRadiusY}`,
      );
      if (leftLineHeight > 0) {
        d.push(`v -${leftLineHeight}`);
      }
      d.push(`h ${sizeX}`);
    } else {
      d.push(
        `v -${sizeY}`,
        `h ${width - sizeX}`,
        `v -${height - sizeY}`,
        `h ${sizeX}`,
      );
    }
  } else {
    d.push(
      `M ${x},${y - height}`,
      `v ${height}`,
      `h -${width}`,
      `v -${size}`,
      `h ${width - size}`,
      `v -${height - size}`,
      `h ${size}`,
    );
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
  radius,
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
    d.push(
      `a ${outerRadiusX},${outerRadiusY} 0 0 1 -${outerRadiusDX},-${outerRadiusDY}`,
    );
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
      d.push(
        `a ${innerRadiusX},${innerRadiusY} 0 0 0 ${innerRadiusX},${innerRadiusY}`,
      );
      if (topLineWidth > 0) {
        d.push(`h ${topLineWidth}`);
      }
      d.push(`v ${sizeY}`);
    } else {
      d.push(
        `h ${sizeX}`,
        `v ${height - sizeY}`,
        `h ${width - sizeX}`,
        `v ${sizeY}`,
      );
    }
  } else {
    d.push(
      `M ${x + width},${y}`,
      `h -${width}`,
      `v -${height}`,
      `h ${size}`,
      `v ${height - size}`,
      `h ${width - size}`,
      `v ${size}`,
    );
  }
  d.push("z");
  d = d.join(" ");
  return d;
};
