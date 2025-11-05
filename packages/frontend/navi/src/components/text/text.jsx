import { createContext } from "preact";
import { useContext, useRef, useState } from "preact/hooks";

import { BoxFlowContext } from "../layout/layout_context.jsx";
import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import {
  resolveSpacingSize,
  withPropsStyle,
} from "../props_composition/with_props_style.js";

import.meta.css = /* css */ `
  :root {
    --navi-icon-align-y: center;
  }

  .navi_text {
    position: relative;
  }

  .navi_text[data-has-foreground] {
    display: inline-block;
  }

  .navi_text_foreground {
    position: absolute;
    inset: 0;
  }

  .navi_text[data-box] {
    display: inline-flex;
  }

  .navi_text_repositioner {
    display: inline-flex;
    vertical-align: top;
  }

  .navi_text_overflow {
    display: flex;
    box-sizing: border-box;
    width: 100%;
    flex-wrap: wrap;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  .navi_text_overflow_wrapper {
    display: flex;
    width: 0;
    flex-grow: 1;
    gap: 0.3em;
  }

  .navi_text_overflow_text {
    max-width: 100%;
    text-overflow: ellipsis;
    overflow: hidden;
  }
`;

const OverflowPinnedElementContext = createContext(null);
export const Text = (props) => {
  const { overflowEllipsis, ...rest } = props;
  if (overflowEllipsis) {
    return <TextOverflow {...rest} />;
  }
  if (props.overflowPinned) {
    return <TextOverflowPinned {...props} />;
  }
  return <TextBasic {...props} />;
};
const TextOverflow = ({ as = "div", className, children, ...rest }) => {
  const TagName = as;
  const innerClassName = withPropsClassName("navi_text_overflow", className);
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
    typo: true,
  });
  const [OverflowPinnedElement, setOverflowPinnedElement] = useState(null);

  return (
    <TagName className={innerClassName} style={innerStyle} {...remainingProps}>
      <span className="navi_text_overflow_wrapper">
        <span className="navi_text_overflow_text">
          <OverflowPinnedElementContext.Provider
            value={setOverflowPinnedElement}
          >
            {children}
          </OverflowPinnedElementContext.Provider>
        </span>
        {OverflowPinnedElement}
      </span>
    </TagName>
  );
};
const TextOverflowPinned = ({ overflowPinned, ...props }) => {
  const setOverflowPinnedElement = useContext(OverflowPinnedElementContext);
  const text = <Text {...props}></Text>;
  if (!setOverflowPinnedElement) {
    console.warn(
      "<Text overflowPinned> declared outside a <Text overflowEllipsis>",
    );
    return text;
  }
  if (overflowPinned) {
    setOverflowPinnedElement(text);
    return null;
  }
  setOverflowPinnedElement(null);
  return text;
};
const TextBasic = ({
  as = "span",
  className,
  box = false,
  gap = "xxs",
  noWrap,
  foregroundColor,
  foregroundElement,
  children,
  ...rest
}) => {
  const TagName = as;
  const innerClassName = withPropsClassName("navi_text", className);
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    base: {
      gap: box ? resolveSpacingSize(gap, "gap") : undefined,
      whiteSpace: noWrap ? "nowrap" : undefined,
    },
    layout: true,
    typo: true,
  });

  const hasForeground = Boolean(foregroundElement || foregroundColor);

  const ref = useRef();
  const text = (
    <TagName
      ref={ref}
      className={innerClassName}
      style={innerStyle}
      data-box={box ? "" : undefined}
      data-has-foreground={hasForeground ? "" : undefined}
      {...remainingProps}
    >
      <BoxFlowContext.Provider value={box ? "inline" : null}>
        {children}
        {/* https://jsfiddle.net/v5xzJ/4/ */}
        {hasForeground && (
          <span
            className="navi_text_foreground"
            style={{ backgroundColor: foregroundColor }}
          >
            {foregroundElement}
          </span>
        )}
      </BoxFlowContext.Provider>
    </TagName>
  );

  if (box) {
    return <span className="navi_text_repositioner">{text}</span>;
  }
  return text;
};

export const Icon = ({ charWidth = 2, children, ...rest }) => {
  const invisibleText = "0".repeat(charWidth);

  return (
    // eslint-disable-next-line jsenv/no-unknown-params
    <Text {...rest} className="navi_icon" foregroundElement={children}>
      <span style="opacity: 0">{invisibleText}</span>
    </Text>
  );
};

// const getSpaceWidth = (element) => {
//   const computedStyle = window.getComputedStyle(element);
//   const span = document.createElement("span");
//   const fontSize = computedStyle.fontSize;
//   const fontFamily = computedStyle.fontFamily;
//   span.style.fontSize = fontSize;
//   span.style.fontFamily = fontFamily;
//   span.style.visibility = "hidden";
//   span.style.position = "absolute";
//   span.textContent = "\u00A0";
//   document.body.appendChild(span);
//   const width = span.offsetWidth;
//   document.body.removeChild(span);
//   return width;
// };

export const Paragraph = ({ children, ...rest }) => {
  if (rest.marginTop === undefined) {
    rest.marginTop = "md";
  }
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
    typo: true,
  });

  return (
    <p {...remainingProps} style={innerStyle}>
      {children}
    </p>
  );
};
