/* eslint-disable jsenv/no-unknown-params */
import { createContext, toChildArray } from "preact";
import { useContext, useState } from "preact/hooks";

import { Box } from "../layout/box.jsx";

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
const TextOverflow = ({
  as = "div",
  contentSpacing = " ",
  noWrap,
  pre = !noWrap,
  children,
  ...rest
}) => {
  const [OverflowPinnedElement, setOverflowPinnedElement] = useState(null);

  return (
    <Text
      {...rest}
      as={as}
      layoutColumn
      expandX
      pre={pre}
      nowWrap={noWrap}
      contentSpacing="pre"
      style="text-overflow: ellipsis; overflow: hidden; flex-wrap: wrap;"
    >
      <span className="navi_text_overflow_wrapper">
        <span className="navi_text_overflow_text">
          <OverflowPinnedElementContext.Provider
            value={setOverflowPinnedElement}
          >
            {applyContentSpacingOnTextChildren(children, contentSpacing)}
          </OverflowPinnedElementContext.Provider>
        </span>
        {OverflowPinnedElement}
      </span>
    </Text>
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
  box,
  children,
  ...rest
}) => {
  const hasForeground = Boolean(foregroundElement || foregroundColor);
  const text = (
    <Box
      {...rest}
      baseClassName="navi_text"
      layoutInline={box ? true : undefined}
      as={as}
      data-has-foreground={hasForeground ? "" : undefined}
      baseStyle={{ whiteSpace: "pre-wrap" }}
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

  // Helper function to check if a value ends with whitespace
  const endsWithWhitespace = (value) => {
    if (typeof value === "string") {
      return /\s$/.test(value);
    }
    return false;
  };

  // Helper function to check if a value starts with whitespace
  const startsWithWhitespace = (value) => {
    if (typeof value === "string") {
      return /^\s/.test(value);
    }
    return false;
  };

  const childrenWithGap = [];
  let i = 0;
  while (true) {
    const child = childArray[i];
    childrenWithGap.push(child);
    i++;
    if (i === childCount) {
      break;
    }

    // Check if we should skip adding contentSpacing
    const currentChild = childArray[i - 1];
    const nextChild = childArray[i];
    const shouldSkipSpacing =
      endsWithWhitespace(currentChild) || startsWithWhitespace(nextChild);

    if (!shouldSkipSpacing) {
      childrenWithGap.push(contentSpacing);
    }
  }
  return childrenWithGap;
};
