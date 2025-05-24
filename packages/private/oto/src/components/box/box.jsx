import { getAvailableHeight, getAvailableWidth } from "@jsenv/dom";
import { FOCUSED_OUTLINE_COLOR } from "oto/src/globals/colors.js";
import { forwardRef } from "preact/compat";
import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";
import "./box.css" with { type: "css" };
import { getInnerSpacingStyles } from "./inner_spacing_styles.js";
import { MultiBorder, useMultiBorder } from "./multi_border.jsx";

export const borderWithStroke = ({
  color = "black",
  size = 2,
  strokeColor,
  strokeSize = 1,
  radius = 0,
  opacity,
}) => {
  return [
    {
      size: strokeSize,
      color: strokeColor,
      radius,
      opacity,
    },
    {
      size,
      color,
      radius: radius - strokeSize,
      opacity,
    },
    {
      size: strokeSize,
      color: strokeColor,
      radius: radius - strokeSize - size,
      opacity,
    },
  ];
};
export const borderOutsidePartial = ({
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
  radius = "0.2em",
}) => {
  return [
    {
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
      strokeColor,
    },
  ];
};

const BoxComponent = (
  {
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
  },
  ref,
) => {
  const [innerIsFocused, innerIsFocusedSetter] = useState(false);

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  useLayoutEffect(() => {
    const element = innerRef.current;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      // const { borderSizes } = getPaddingAndBorderSizes(element);
      const elementDimensions = element.getBoundingClientRect();
      const availableWidth = getAvailableWidth(element);
      const availableHeight = getAvailableHeight(element);

      const styleForXPosition = {
        alignSelf: "",
        left: "",
        marginLeft: "",
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
        marginTop: "",
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
    width: isFinite(width)
      ? `${width}px`
      : width === "..." || width === "auto"
        ? undefined
        : width,
    height: isFinite(height)
      ? `${height}px`
      : height === "..." || height === "auto"
        ? undefined
        : height,
    maxWidth: isFinite(maxWidth) ? `${maxWidth}px` : maxWidth,
    maxHeight: isFinite(maxHeight) ? `${maxHeight}px` : maxHeight,
    color,
    backgroundColor,
    cursor,
    overflow,
    overscrollBehavior,
    ...props.style,
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
    borders.unshift(
      ...borderOutsidePartial({
        width: focusedOutlineWidth,
        color: focusedOutlineColor,
        strokeColor: "black",
        size: focusedOutlineSize,
        strokeSize: focusedOutlineStrokeSize,
        radius: focusedOutlineRadius,
        spacing: focusedOutlineSpacing,
      }),
    );
  }

  Object.assign(style, styleForContentPosition);
  const spacingStyle = getInnerSpacingStyles({
    around: innerSpacing,
    x: innerSpacingX,
    y: innerSpacingY,
    top: innerSpacingTop,
    bottom: innerSpacingBottom,
    left: innerSpacingLeft,
    right: innerSpacingRight,
  });
  Object.assign(style, spacingStyle);

  const [multiBorderParentStyles, multiBorderProps] = useMultiBorder(
    innerRef,
    borders,
  );
  Object.assign(style, multiBorderParentStyles);

  return (
    <NodeName
      ref={innerRef}
      name={name}
      className={`box${className ? ` ${className}` : ""}`}
      role={role}
      data-focused={innerIsFocused || undefined}
      data-vertical={vertical || undefined}
      data-hidden={hidden || undefined}
      data-invisible={invisible || undefined}
      onClick={onClick}
      {...(focusable
        ? {
            tabIndex: NodeName === "button" ? undefined : -1,
            onFocus: () => {
              innerIsFocusedSetter(true);
            },
            onBlur: () => {
              innerIsFocusedSetter(false);
            },
          }
        : {})}
      {...props}
      style={style}
    >
      <MultiBorder {...multiBorderProps} />
      {children}
    </NodeName>
  );
};

export const Box = forwardRef(BoxComponent);

Box.div = (props) => {
  return <Box NodeName="div" {...props} />;
};
Box.canvas = (props) => {
  return <Box NodeName="canvas" {...props} />;
};
Box.button = (props) => {
  return <Box NodeName="button" {...props} />;
};
