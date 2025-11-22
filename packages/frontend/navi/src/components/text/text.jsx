/* eslint-disable jsenv/no-unknown-params */
import { createContext, toChildArray } from "preact";
import { useContext, useRef, useState } from "preact/hooks";

import { Box } from "../layout/box.jsx";
import { useInitialTextSelection } from "./use_initial_text_selection.jsx";

import.meta.css = /* css */ `
  *[data-navi-space] {
    /* user-select: none; */
  }

  .navi_text {
    position: relative;
    color: inherit;
  }

  .navi_text_overflow {
    flex-wrap: wrap;
    text-overflow: ellipsis;
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

const INSERTED_SPACE = <span data-navi-space=""> </span>;
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

  const separator =
    contentSpacing === undefined || contentSpacing === " "
      ? INSERTED_SPACE
      : contentSpacing;

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
      childrenWithGap.push(separator);
    }
  }
  return childrenWithGap;
};

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

const TextOverflow = ({ noWrap, children, ...rest }) => {
  const [OverflowPinnedElement, setOverflowPinnedElement] = useState(null);

  return (
    <Text
      column
      as="div"
      nowWrap={noWrap}
      pre={!noWrap}
      // For paragraph we prefer to keep lines and only hide unbreakable long sections
      preLine={rest.as === "p"}
      {...rest}
      className="navi_text_overflow"
      expandX
      contentSpacing="pre"
    >
      <span className="navi_text_overflow_wrapper">
        <OverflowPinnedElementContext.Provider value={setOverflowPinnedElement}>
          <Text className="navi_text_overflow_text">{children}</Text>
        </OverflowPinnedElementContext.Provider>
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
  contentSpacing = " ",
  selectRange,
  children,
  ...rest
}) => {
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;

  useInitialTextSelection(ref, selectRange);

  return (
    <Box ref={ref} as="span" {...rest} baseClassName="navi_text">
      {applyContentSpacingOnTextChildren(children, contentSpacing)}
    </Box>
  );
};

/* https://jsfiddle.net/v5xzJ/4/ */
export const TextForeground = (props) => {
  return <Text {...props} className="navi_text_foreground" />;
};
