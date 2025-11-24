/* eslint-disable jsenv/no-unknown-params */
import { hasCSSSizeUnit } from "@jsenv/dom";
import { createContext, toChildArray } from "preact";
import { useContext, useRef, useState } from "preact/hooks";

import { Box } from "../layout/box.jsx";
import {
  isSizeSpacingScaleKey,
  resolveSpacingSize,
} from "../layout/box_style_util.js";
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

  .navi_inline_spacer {
  }
`;

const SPACE_CHAR_SEPARATOR = <span data-navi-space=""> </span>;
const InlineSpacer = ({ value }) => {
  return (
    <span
      className="navi_inline_spacer"
      style={`padding-left: ${value}`}
    ></span>
  );
};

export const applySpacingOnTextChildren = (children, spacing) => {
  if (spacing === "pre" || spacing === "0" || spacing === 0) {
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

  let separator;
  if (spacing === undefined) {
    spacing = SPACE_CHAR_SEPARATOR;
  } else if (typeof spacing === "string") {
    if (isSizeSpacingScaleKey(spacing)) {
      separator = <InlineSpacer value={resolveSpacingSize(spacing)} />;
    } else if (hasCSSSizeUnit(spacing)) {
      separator = <InlineSpacer value={resolveSpacingSize(spacing)} />;
    } else {
      separator = spacing;
    }
  } else if (typeof spacing === "number") {
    separator = <InlineSpacer value={spacing} />;
  } else {
    separator = spacing;
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
    const currentChild = childArray[i - 1];
    const nextChild = childArray[i];
    if (endsWithWhitespace(currentChild)) {
      continue;
    }
    if (startsWithWhitespace(nextChild)) {
      continue;
    }
    childrenWithGap.push(separator);
  }
  return childrenWithGap;
};
const endsWithWhitespace = (jsxChild) => {
  if (typeof jsxChild === "string") {
    return /\s$/.test(jsxChild);
  }
  return false;
};
const startsWithWhitespace = (jsxChild) => {
  if (typeof jsxChild === "string") {
    return /^\s/.test(jsxChild);
  }
  return false;
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
      spacing="pre"
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
const TextBasic = ({ spacing = " ", selectRange, children, ...rest }) => {
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;

  useInitialTextSelection(ref, selectRange);

  return (
    <Box ref={ref} as="span" {...rest} baseClassName="navi_text">
      {applySpacingOnTextChildren(children, spacing)}
    </Box>
  );
};

/* https://jsfiddle.net/v5xzJ/4/ */
export const TextForeground = (props) => {
  return <Text {...props} className="navi_text_foreground" />;
};
