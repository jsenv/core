import { createContext, toChildArray } from "preact";
import { useContext, useState } from "preact/hooks";

import { Box } from "../layout/box.jsx";
import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import { withPropsStyle } from "../props_composition/with_props_style.js";

import.meta.css = /* css */ `
  :root {
    --navi-icon-align-y: center;
  }

  .navi_text {
    position: relative;
  }

  .navi_char_slot_invisible {
    opacity: 0;
  }

  .navi_text[data-has-foreground] {
    display: inline-block;
  }

  .navi_text_foreground {
    position: absolute;
    inset: 0;
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
  foregroundColor,
  foregroundElement,
  contentSpacing = " ",
  className,
  box,
  children,
  ...rest
}) => {
  const innerClassName = withPropsClassName("navi_text", className);
  const hasForeground = Boolean(foregroundElement || foregroundColor);
  const text = (
    <Box
      {...rest}
      className={innerClassName}
      layoutInline={box ? true : undefined}
      as={as}
      data-has-foreground={hasForeground ? "" : undefined}
    >
      {applyContentSpacingOnTextChildren(children, contentSpacing)}
      {/* https://jsfiddle.net/v5xzJ/4/ */}
      {hasForeground && (
        <span
          className="navi_text_foreground"
          style={{ backgroundColor: foregroundColor }}
        >
          {foregroundElement}
        </span>
      )}
    </Box>
  );
  return text;
};

export const CharSlot = ({
  charWidth = 1,
  // 0 (zéro) is the real char width
  // but 2 zéros gives too big icons
  // while 1 "W" gives a nice result
  baseChar = "W",
  "aria-label": ariaLabel,
  role,
  decorative = false,
  children,
  ...rest
}) => {
  const invisibleText = baseChar.repeat(charWidth);
  const ariaProps = decorative
    ? { "aria-hidden": "true" }
    : { role, "aria-label": ariaLabel };

  return (
    <Text {...rest} {...ariaProps} foregroundElement={children}>
      <span className="navi_char_slot_invisible" aria-hidden="true">
        {invisibleText}
      </span>
    </Text>
  );
};
export const Icon = (props) => {
  return <CharSlot decorative {...props} />;
};

export const Paragraph = ({ contentSpacing = " ", children, ...rest }) => {
  if (rest.marginTop === undefined) {
    rest.marginTop = "md";
  }

  return (
    <Box as="p" {...rest}>
      {applyContentSpacingOnTextChildren(children, contentSpacing)}
    </Box>
  );
};

export const applyContentSpacingOnTextChildren = (children, contentSpacing) => {
  if (contentSpacing === "pre") {
    return children;
  }

  if (!children) {
    return children;
  }
  const childArray = toChildArray(children);
  const childCount = childArray.length;
  if (childCount <= 1) {
    return children;
  }
  const childrenWithGap = [];
  let i = 0;
  while (true) {
    const child = childArray[i];
    childrenWithGap.push(child);
    i++;
    if (i === childCount) {
      break;
    }
    childrenWithGap.push(contentSpacing);
  }
  return childrenWithGap;
};
