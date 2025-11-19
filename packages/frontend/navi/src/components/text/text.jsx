/* eslint-disable jsenv/no-unknown-params */
import { createContext, toChildArray } from "preact";
import { useContext, useState } from "preact/hooks";

import { Box } from "../layout/box.jsx";

import.meta.css = /* css */ `
  .navi_text {
    position: relative;
    color: inherit;
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
