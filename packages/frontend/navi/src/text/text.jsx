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

const css = /* css */ `
  @layer navi {
    .navi_text {
      &[data-skeleton] {
        border-radius: 0.2em;
      }
    }
  }

  *[data-navi-space] {
  }

  .navi_text {
    position: relative;

    /* There is a chrome specific bug that prevents text-transform: capitalize to be applied in nested DOM structure */
    /* The CSS below ensure capitalize is propagated to the bold clones */
    &[data-capitalize] {
      &::first-letter {
        text-transform: uppercase;
      }
      .navi_text_bold_clone::first-letter {
        text-transform: uppercase;
      }
      .navi_text_bold_foreground::first-letter {
        text-transform: uppercase;
      }
    }

    .navi_text_bold_wrapper,
    .navi_text_bold_clone,
    .navi_text_bold_foreground {
      display: inherit;
      width: inherit;
      min-width: inherit;
      height: inherit;
      min-height: inherit;
      flex-grow: inherit;
      align-items: inherit;
      justify-content: inherit;
      gap: inherit;
      text-align: inherit;
      border-radius: inherit;
    }

    &[data-text-overflow] {
      min-width: 0;
      flex-wrap: wrap;
      text-overflow: ellipsis;
      overflow: hidden;

      .navi_text_overflow_wrapper {
        display: flex;
        width: 100%;
        flex-grow: 1;
        gap: 0.3em;

        .navi_text_overflow_text {
          max-width: 100%;
          text-overflow: ellipsis;
          overflow: hidden;
        }
      }
    }

    &[data-skeleton] {
      /* Children stay in the DOM to preserve natural layout dimensions,
         but are hidden so only the skeleton is visible. */
      visibility: hidden;

      /* When there are no children a placeholder "W" is injected (see JSX).
         It must stretch to the full available width so the skeleton
         fills the container rather than collapsing to a single character. */
      .navi_text_skeleton_children_placeholder {
        display: inline-flex;
        width: 100%;
      }

      /* Three-level structure to respect padding AND border-radius:

         1. navi_text_skeleton_container — absolutely fills the border box
            (inset:0), then applies padding:inherit so its content box equals
            the parent's content box. line-height:normal prevents the container
            from inheriting a large line-height that would make it taller than
            the border box. border-radius:inherit passes the radius down.
            visibility:visible overrides the parent's visibility:hidden.

         2. navi_text_skeleton_inset — a relative block that fills 100% of the
            container's content box (= parent's content box). It is the
            positioned ancestor for the absolutely placed skeleton bar.
            border-radius:inherit chains the radius further down.

         3. navi_text_skeleton — the visible gradient bar. position:absolute
            inset:0 fills the inset box precisely. border-radius:inherit
            finally applies the radius at this level, which is now correctly
            sized to the content area. */
      .navi_text_skeleton_container {
        position: absolute;
        inset: 0;
        padding: inherit;
        line-height: normal;
        border-radius: inherit;
        visibility: visible;
      }

      .navi_text_skeleton_inset {
        position: relative;
        display: inline-flex;
        width: 100%;
        height: 100%;
        border-radius: inherit;
      }

      .navi_text_skeleton {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          #e0e0e0 25%,
          #f0f0f0 50%,
          #e0e0e0 75%
        );
        background-size: 200% 100%;
        border-radius: inherit;
      }

      &[data-loading] {
        .navi_text_skeleton {
          animation: navi_text_skeleton_shimmer 1.5s infinite;
        }
      }
    }
  }

  @keyframes navi_text_skeleton_shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  .navi_text_bold_wrapper {
    position: relative;
    display: inline-block;

    .navi_text_bold_clone {
      font-weight: bold;
      opacity: 0;
    }
    .navi_text_bold_foreground {
      position: absolute;
      inset: 0;
    }
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
// A space that uses padding-left instead of a real space character.
// This avoids the underline that browsers draw under spaces inside links.
const FAKE_SPACE = (
  <span data-navi-space="" style="padding-left: 0.25em">
    &#8203;
  </span>
);
const CustomWidthSpace = ({ value, useRealSpaceChar }) => {
  if (useRealSpaceChar) {
    return (
      <span>
        <span style="font-size: 0"> </span>
        <span style={`padding-left: ${value}`}>&#8203;</span>
      </span>
    );
  }
  return <span style={`padding-left: ${value}`}>&#8203;</span>;
};

const applySpacingOnTextChildren = (children, spacing, defaultSpace) => {
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

  const useRealSpaceChar = defaultSpace !== FAKE_SPACE;
  let separator;
  if (spacing === REGULAR_SPACE || spacing === FAKE_SPACE) {
    separator = defaultSpace;
  } else if (typeof spacing === "string") {
    if (isSizeSpacingScaleKey(spacing) || hasCSSSizeUnit(spacing)) {
      separator = (
        <CustomWidthSpace
          value={resolveSpacingSize(spacing)}
          useRealSpaceChar={useRealSpaceChar}
        />
      );
    } else {
      separator = spacing;
    }
  } else if (typeof spacing === "number") {
    separator = (
      <CustomWidthSpace
        value={`${spacing}px`}
        useRealSpaceChar={useRealSpaceChar}
      />
    );
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
    if (!shouldInjectSpacingBetween(currentChild, nextChild)) {
      continue;
    }
    childrenWithGap.push(separator);
  }
  return childrenWithGap;
};
const outsideTextFlowSet = new Set();
export const markAsOutsideTextFlow = (jsxElement) => {
  outsideTextFlowSet.add(jsxElement);
};
const isMarkedAsOutsideTextFlow = (jsxElement) => {
  return outsideTextFlowSet.has(jsxElement.type);
};

const isPreactNode = (jsxChild) => {
  return (
    jsxChild !== null &&
    typeof jsxChild === "object" &&
    jsxChild.type !== undefined
  );
};
const shouldInjectSpacingBetween = (left, right) => {
  const leftIsNode = isPreactNode(left);
  const rightIsNode = isPreactNode(right);
  // only inject spacing when at least one side is a preact node
  if (!leftIsNode && !rightIsNode) {
    return false;
  }
  if (leftIsNode && isMarkedAsOutsideTextFlow(left)) {
    return false;
  }
  if (rightIsNode && isMarkedAsOutsideTextFlow(right)) {
    return false;
  }
  if (rightIsNode && right.props && right.props.overflowPinned) {
    return false;
  }
  if (typeof left === "string" && /\s$/.test(left)) {
    return false;
  }
  if (typeof right === "string" && /^\s/.test(right)) {
    return false;
  }
  return true;
};

const OverflowPinnedElementContext = createContext(null);
export const Text = (props) => {
  import.meta.css = css;

  if (props.loading || props.skeleton) {
    return <TextSkeleton {...props} />;
  }
  if (props.overflowEllipsis) {
    return <TextOverflow {...props} />;
  }
  if (props.overflowPinned) {
    return <TextOverflowPinned {...props} />;
  }
  if (props.selectRange) {
    return <TextWithSelectRange {...props} />;
  }
  return <TextBasic {...props} />;
};

const TextSkeleton = ({ loading, children, ...props }) => {
  // Three-level structure — see CSS comment on [data-skeleton] for details.
  const skeletonOverlay = (
    <span className="navi_text_skeleton_container" aria-hidden="true">
      <span className="navi_text_skeleton_inset">
        <span className="navi_text_skeleton" />
      </span>
    </span>
  );
  // When there are no children, inject a full-width placeholder so the element
  // has measurable height driven by the current font-size/line-height, and the
  // skeleton fills the available width instead of shrinking to a single char.
  const hasChildren =
    children !== null && children !== undefined && children !== false;
  const innerChildren = hasChildren ? (
    children
  ) : (
    <span
      className="navi_text_skeleton_children_placeholder"
      aria-hidden="true"
    >
      W
    </span>
  );
  return (
    <Text
      data-skeleton=""
      data-loading={loading ? "" : undefined}
      {...props}
      skeleton={undefined}
      childrenOutsideFlow={skeletonOverlay}
    >
      {innerChildren}
    </Text>
  );
};
const TextOverflow = ({ noWrap, spacing, children, ...rest }) => {
  const [OverflowPinnedElement, setOverflowPinnedElement] = useState(null);

  return (
    <Text
      flex
      block
      as="div"
      nowWrap={noWrap}
      pre={!noWrap}
      // For paragraph we prefer to keep lines and only hide unbreakable long sections
      preLine={rest.as === "p"}
      {...rest}
      overflowEllipsis={undefined}
      data-text-overflow=""
      spacing="pre"
    >
      <span className="navi_text_overflow_wrapper">
        <OverflowPinnedElementContext.Provider value={setOverflowPinnedElement}>
          <Text className="navi_text_overflow_text" spacing={spacing}>
            {children}
          </Text>
        </OverflowPinnedElementContext.Provider>
        {OverflowPinnedElement}
      </span>
    </Text>
  );
};
const TextOverflowPinned = ({ overflowPinned, ...props }) => {
  const setOverflowPinnedElement = useContext(OverflowPinnedElementContext);
  const text = <Text {...props} data-overflow-pinned=""></Text>;
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
  spacing,
  preventSpaceUnderlines = false,
  boldTransition,
  boldStable,
  preventBoldLayoutShift = boldTransition,
  capitalize,
  children,
  childrenOutsideFlow,
  ...rest
}) => {
  const defaultSpace = preventSpaceUnderlines ? FAKE_SPACE : REGULAR_SPACE;
  const resolvedSpacing = spacing ?? defaultSpace;
  const boxProps = {
    "as": "span",
    "data-bold-transition": boldTransition ? "" : undefined,
    "data-capitalize": capitalize ? "" : undefined,
    ...rest,
    "baseClassName": withPropsClassName("navi_text", rest.baseClassName),
  };
  const shouldPreserveSpacing = rest.as === "pre" || rest.flex || rest.grid;
  if (shouldPreserveSpacing) {
    boxProps.spacing = resolvedSpacing;
  } else {
    children = applySpacingOnTextChildren(
      children,
      resolvedSpacing,
      defaultSpace,
    );
  }

  if (boldStable) {
    const { bold } = boxProps;
    return (
      <Box {...boxProps} bold={undefined} data-bold={bold ? "" : undefined}>
        <span className="navi_text_bold_background" aria-hidden="true">
          {children}
        </span>
        {children}
        {childrenOutsideFlow}
      </Box>
    );
  }
  if (preventBoldLayoutShift) {
    const alignX = rest.alignX || rest.align || "start";

    // La technique consiste a avoid un double gras qui force une taille
    // et la version light par dessus en position absolute
    // on la centre aussi pour donner l'impression que le gras s'applique depuis le centre
    // ne fonctionne que sur une seule ligne de texte (donc lorsque noWrap est actif)
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
        {childrenOutsideFlow}
      </Box>
    );
  }

  return (
    <Box {...boxProps}>
      {children}
      {childrenOutsideFlow}
    </Box>
  );
};

/* https://jsfiddle.net/v5xzJ/4/ */
export const TextForeground = (props) => {
  return <Text {...props} className="navi_text_foreground" />;
};
