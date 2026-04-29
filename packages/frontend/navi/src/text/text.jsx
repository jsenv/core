import { hasCSSSizeUnit } from "@jsenv/dom";
import { createContext, toChildArray } from "preact";
import { useContext, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { isSizeSpacingScaleKey } from "../box/box_style_util.js";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { useDarkBackgroundAttribute } from "./use_dark_background_attribute.js";
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

    &[data-dark-background] {
      color: white;
    }

    /* There is a chrome specific bug that prevents text-transform: capitalize to be applied in nested DOM structure */
    /* The CSS below ensure capitalize is propagated to the bold clones */
    &[data-capitalize] {
      &::first-letter {
        text-transform: uppercase;
      }
      .navi_text_sizer_placeholder::first-letter {
        text-transform: uppercase;
      }
      .navi_text_sizer_overlay::first-letter {
        text-transform: uppercase;
      }
    }

    .navi_text_sizer,
    .navi_text_sizer_placeholder,
    .navi_text_sizer_overlay {
      display: inherit;
      width: inherit;
      min-width: inherit;
      height: inherit;
      min-height: inherit;
      flex-grow: inherit;
      align-items: inherit;
      align-self: inherit;
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
      overflow-wrap: normal;

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

  .navi_text_sizer {
    position: relative;
    display: inline-block;

    .navi_text_sizer_placeholder {
      opacity: 0;
    }
    .navi_text_sizer_overlay {
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
  .navi_text[data-contains-absolute-child] {
    display: inline-block;
  }
  .navi_text[data-bold] {
    .navi_text_bold_background {
      opacity: 1;
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
    if (
      isSizeSpacingScaleKey(spacing) ||
      hasCSSSizeUnit(spacing) ||
      spacing.startsWith("var(")
    ) {
      separator = (
        <CustomWidthSpace value={spacing} useRealSpaceChar={useRealSpaceChar} />
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
/**
 * Text component for rendering inline or block text with layout-stable style changes.
 *
 * Most props are forwarded to the underlying `Box` component (as, style, bold, noWrap, …).
 * The props listed below are specific to Text.
 *
 * @param {object} props
 *
 * @param {boolean} [props.overflowEllipsis]
 *   Truncates overflowing text with an ellipsis.
 *
 * @param {boolean} [props.overflowPinned]
 *   Must be used inside a `<Text overflowEllipsis>` parent.
 *   Pins this element outside the truncated text flow (e.g. a badge or icon).
 *
 * @param {string} [props.spacing]
 *   Controls the separator injected between child nodes.
 *   Accepts a size/spacing scale key, a CSS length, or `"pre"` / `0` to disable.
 *   Defaults to a regular space character (or a padding-based fake space when
 *   `preventSpaceUnderlines` is active).
 *
 * @param {boolean} [props.loading]
 *   Renders a shimmer skeleton in place of the text.
 *
 * @param {boolean} [props.skeleton]
 *   Same as `loading` but without the shimmer animation.
 *
 * @param {boolean} [props.preventSpaceUnderlines]
 *   Replaces real space characters between children with padding-based spaces
 *   to avoid the underline browsers draw under spaces inside links.
 *
 * @param {object} [props.holdSpaceForStyle]
 *   Prevents layout shifts when text styles change (font-weight, font-size, …).
 *   Pass an object of CSS-in-JS style properties representing the "maximum" state of the text.
 *   An invisible placeholder is rendered with those styles to reserve the space,
 *   and the real visible text is layered on top via `position: absolute`.
 *   Only works reliably with single-line (`noWrap`) text.
 *   Example: `holdSpaceForStyle={{ fontWeight: "bold", fontSize: "1.5rem" }}`
 *
 * @param {boolean} [props.boldStable]
 *   Alternative to `holdSpaceForStyle` for multi-line text.
 *   Keeps a consistent visual width regardless of font-weight by painting normal-weight
 *   text on top of a bold background using `background-clip: text`.
 *   Does not support font-size changes.
 *
 * @param {boolean} [props.capitalize]
 *   Applies `text-transform: uppercase` to the first letter via CSS.
 *
 * @param {string|Array} [props.selectRange]
 *   Selects a portion of the text on mount. Forwarded to `useInitialTextSelection`.
 *
 * @param {*} [props.childrenOutsideFlow]
 *   Rendered after children but outside the text flow (useful for overlays
 *   like the skeleton container).
 */
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
  boldStable,
  holdSpaceForStyle,
  capitalize,
  children,
  childrenOutsideFlow,
  basePseudoState,
  ...rest
}) => {
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const bgDeps = basePseudoState ? Object.values(basePseudoState) : [];
  useDarkBackgroundAttribute(ref, bgDeps);
  const defaultSpace = preventSpaceUnderlines ? FAKE_SPACE : REGULAR_SPACE;
  const resolvedSpacing = spacing ?? defaultSpace;
  const boxProps = {
    "as": "span",
    "data-capitalize": capitalize ? "" : undefined,
    ...rest,
    ref,
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
      <Box
        {...boxProps}
        bold={undefined}
        data-bold={bold ? "" : undefined}
        data-contains-absolute-child=""
      >
        <span className="navi_text_bold_background" aria-hidden="true">
          {children}
        </span>
        {children}
        {childrenOutsideFlow}
      </Box>
    );
  }
  if (holdSpaceForStyle) {
    // The sizer technique prevents layout shifts when styles that affect text dimensions change.
    // - navi_text_sizer_placeholder: invisible, rendered with holdSpaceForStyle applied so it
    //   always occupies the "maximum" dimensions (e.g. bold + larger font-size).
    // - navi_text_sizer_overlay: absolutely positioned on top, renders the actual visible text
    //   with its current style. Transitions can be applied on this element from the outside.
    return (
      <Box {...boxProps}>
        <span className="navi_text_sizer">
          <span
            className="navi_text_sizer_placeholder"
            aria-hidden="true"
            style={holdSpaceForStyle}
          >
            {children}
          </span>
          <span className="navi_text_sizer_overlay">{children}</span>
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
