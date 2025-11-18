/* eslint-disable jsenv/no-unknown-params */
import { createContext, toChildArray } from "preact";
import { useContext, useState } from "preact/hooks";

import { Box } from "../layout/box.jsx";

import.meta.css = /* css */ `
  .navi_text {
    position: relative;
    color: inherit;
  }

  .navi_char_slot_invisible {
    opacity: 0;
  }

  .navi_icon {
    display: flex;
    aspect-ratio: 1 / 1;
    height: 100%;
    max-height: 1em;
    align-items: center;
    justify-content: center;
  }

  .navi_text[data-has-foreground] {
    display: inline-block;
  }

  .navi_text_foreground {
    position: absolute;
    inset: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
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
      box
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
  children,
  ...rest
}) => {
  const hasForeground = Boolean(foregroundElement || foregroundColor);
  const text = (
    <Box
      {...rest}
      baseClassName="navi_text"
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
export const Icon = ({ box, href, children, ...props }) => {
  const innerChildren = href ? (
    <svg width="100%" height="100%">
      <use href={href} />
    </svg>
  ) : (
    children
  );

  if (box) {
    return (
      <Box layoutInline layoutColumn {...props}>
        {innerChildren}
      </Box>
    );
  }

  return (
    <CharSlot decorative {...props}>
      <span className="navi_icon">{innerChildren}</span>
    </CharSlot>
  );
};

export const Paragraph = ({
  contentSpacing = " ",
  marginTop = "md",
  children,
  ...rest
}) => {
  return (
    <Box {...rest} as="p" marginTop={marginTop}>
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
