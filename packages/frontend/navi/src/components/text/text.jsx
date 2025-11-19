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

  .navi_text[data-has-foreground] {
    display: inline-block;
  }

  .navi_text_foreground {
    position: absolute;
    inset: 0;
    display: inline-flex;
    box-sizing: border-box;
    align-items: center;
    justify-content: start;
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

  .navi_icon_char {
    display: flex;
    aspect-ratio: 1 / 1;
    height: 100%;
    max-height: 1em;
    align-items: center;
    justify-content: center;
  }
  .navi_icon_char > svg {
    width: 100%;
    height: 100%;
  }
  .navi_icon[data-width] svg {
    width: 100%;
    height: auto;
  }
  .navi_icon[data-height] svg {
    width: auto;
    height: 100%;
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
  contentSpacing = " ",
  children,
  ...rest
}) => {
  const text = (
    <Box {...rest} baseClassName="navi_text" as={as}>
      {applyContentSpacingOnTextChildren(children, contentSpacing)}
    </Box>
  );
  return text;
};

/* https://jsfiddle.net/v5xzJ/4/ */
export const TextForeground = ({ children, ...props }) => {
  return (
    <Text {...props} className="navi_text_foreground">
      {children}
    </Text>
  );
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
    <Text {...rest} {...ariaProps} data-has-foreground="" data-char-slot="">
      <span className="navi_char_slot_invisible" aria-hidden="true">
        {invisibleText}
      </span>
      <TextForeground>{children}</TextForeground>
    </Text>
  );
};
export const Icon = ({ href, children, ...props }) => {
  const innerChildren = href ? (
    <svg width="100%" height="100%">
      <use href={href} />
    </svg>
  ) : (
    children
  );

  let { box, width, height } = props;
  if (width !== undefined || height !== undefined) {
    box = true;
  }

  if (box) {
    return (
      <Box
        {...props}
        baseClassName="navi_icon"
        data-width={width}
        data-height={height}
      >
        {innerChildren}
      </Box>
    );
  }

  return (
    <CharSlot decorative {...props}>
      <span className="navi_icon_char">{innerChildren}</span>
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
