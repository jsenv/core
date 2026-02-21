/* eslint-disable jsenv/no-unknown-params */
import { hasCSSSizeUnit } from "@jsenv/dom";
import { createContext, toChildArray } from "preact";
import { useContext, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import {
  isSizeSpacingScaleKey,
  resolveSpacingSize,
} from "../box/box_style_util.js";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { useInitialTextSelection } from "./use_initial_text_selection.jsx";

import.meta.css = /* css */ `
  *[data-navi-space] {
    /* user-select: none; */
  }

  .navi_text {
    position: relative;
    color: inherit;

    &[data-has-absolute-child] {
      display: inline-block;
    }
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

  .navi_custom_space {
  }

  .navi_text_bold_wrapper {
    position: relative;
    display: inline-block;
  }
  .navi_text_bold_clone {
    font-weight: bold;
    opacity: 0;
  }
  .navi_text_bold_foreground {
    position: absolute;
    inset: 0;
  }

  .navi_text_bold_background {
    position: absolute;
    top: 0;
    left: 0;
    color: currentColor;
    font-weight: normal;
    background: currentColor;
    background-clip: text;
    -webkit-background-clip: text;
    transform-origin: center;
    -webkit-text-fill-color: transparent;
    opacity: 0;
  }

  .navi_text[data-bold] {
    .navi_text_bold_background {
      opacity: 1;
    }
  }

  .navi_text[data-bold-transition] {
    .navi_text_bold_foreground {
      transition-property: font-weight;
      transition-duration: 0.3s;
      transition-timing-function: ease;
    }

    .navi_text_bold_background {
      transition-property: opacity;
      transition-duration: 0.3s;
      transition-timing-function: ease;
    }
  }
`;

const REGULAR_SPACE = <span data-navi-space=""> </span>;
const CustomWidthSpace = ({ value }) => {
  return (
    <span className="navi_custom_space" style={`padding-left: ${value}`}>
      &#8203;
    </span>
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
    spacing = REGULAR_SPACE;
  } else if (typeof spacing === "string") {
    if (isSizeSpacingScaleKey(spacing)) {
      separator = <CustomWidthSpace value={resolveSpacingSize(spacing)} />;
    } else if (hasCSSSizeUnit(spacing)) {
      separator = <CustomWidthSpace value={resolveSpacingSize(spacing)} />;
    } else {
      separator = spacing;
    }
  } else if (typeof spacing === "number") {
    separator = <CustomWidthSpace value={spacing} />;
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
  if (props.selectRange) {
    return <TextWithSelectRange {...props} />;
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
const TextWithSelectRange = ({ selectRange, ...props }) => {
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  useInitialTextSelection(ref, selectRange);
  return <Text ref={ref} {...props}></Text>;
};
const TextBasic = ({
  spacing = " ",
  boldTransition,
  boldStable,
  preventBoldLayoutShift = boldTransition,
  children,
  ...rest
}) => {
  const boxProps = {
    "as": "span",
    "data-bold-transition": boldTransition ? "" : undefined,
    ...rest,
    "baseClassName": withPropsClassName("navi_text", rest.baseClassName),
  };

  const shouldPreserveSpacing =
    rest.as === "pre" || rest.box || rest.column || rest.row;
  if (shouldPreserveSpacing) {
    boxProps.spacing = spacing;
  } else {
    children = applySpacingOnTextChildren(children, spacing);
  }

  if (boldStable) {
    const { bold } = boxProps;
    return (
      <Box
        {...boxProps}
        bold={undefined}
        data-bold={bold ? "" : undefined}
        data-has-absolute-child=""
      >
        <span className="navi_text_bold_background" aria-hidden="true">
          {children}
        </span>
        {children}
      </Box>
    );
  }
  if (preventBoldLayoutShift) {
    const alignX = rest.alignX || rest.align || "start";

    // La technique consiste a avoid un double gras qui force une taille
    // et la version light par dessus en position absolute
    // on la centre aussi pour donner l'impression que le gras s'applique depuis le centre
    // ne fonctionne que sur une seul ligne de texte (donc lorsque noWrap est actif)
    // on pourrait auto-active cela sur une prop genre boldCanChange
    return (
      <Box {...boxProps}>
        <span className="navi_text_bold_wrapper">
          <span className="navi_text_bold_clone" aria-hidden="true">
            {children}
          </span>
          <span className="navi_text_bold_foreground" data-align={alignX}>
            {children}
          </span>
        </span>
      </Box>
    );
  }

  return <Box {...boxProps}>{children}</Box>;
};

/* https://jsfiddle.net/v5xzJ/4/ */
export const TextForeground = (props) => {
  return <Text {...props} className="navi_text_foreground" />;
};
