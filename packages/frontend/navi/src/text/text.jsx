// https://jsfiddle.net/v5xzJ/4/

import { hasCSSSizeUnit, measureLongestVisualLineWidth } from "@jsenv/dom";
import { isValidElement, toChildArray } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import {
  isSizeSpacingKey,
  stringifySpacingStyle,
} from "../box/box_style_util.js";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { useInitialTextSelection } from "./use_initial_text_selection.jsx";

const css = /* css */ `
  @layer navi {
    .navi_text {
      &[data-skeleton] {
        border-radius: 0.2em;
      }

      &[data-capitalize] {
        text-transform: capitalize;

        .navi_text_sizer {
          .navi_text {
            display: inline-block; /* We need inline-block to match the pseudo element */
          }
        }
      }
      &[data-shrinkwrap] {
        display: inline-block;
      }
    }
  }

  time.navi_text {
    font-variant-numeric: tabular-nums;
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
      display: block;
      min-width: 0;
      text-overflow: ellipsis;
      overflow: hidden;
      overflow-wrap: normal;
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
    // Two-span trick: we want a real space character in the DOM so that
    // copy-pasting the text produces an actual space, but we also want
    // full control over the visual width of that gap.
    // - First span: contains the real space but rendered at font-size:0 so it
    //   takes up zero visual space.
    // - Second span: a zero-width joiner (&#8203;) with padding-left set to
    //   the desired gap size. This is the only visible part.
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
    if (isSizeSpacingKey(spacing)) {
      const value = stringifySpacingStyle(spacing);
      separator = (
        <CustomWidthSpace value={value} useRealSpaceChar={useRealSpaceChar} />
      );
    } else if (hasCSSSizeUnit(spacing) || spacing.startsWith("var(")) {
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

const shouldInjectSpacingBetween = (left, right) => {
  const leftIsNode = isValidElement(left);
  const rightIsNode = isValidElement(right);
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
  if (typeof left === "string" && /\s$/.test(left)) {
    return false;
  }
  if (typeof right === "string" && /^\s/.test(right)) {
    return false;
  }
  return true;
};

/**
 * @type {import("preact").FunctionComponent<{
 *   children?: import("preact").ComponentChildren,
 *   as?: string,
 *   className?: string,
 *   style?: import("preact").JSX.CSSProperties,
 *   bold?: boolean,
 *   noWrap?: boolean,
 *   maxLines?: number,
 *   spacing?: string | number | import("preact").ComponentChildren,
 *   loading?: boolean,
 *   skeleton?: boolean,
 *   preventSpaceUnderlines?: boolean,
 *   holdSpaceForStyle?: import("preact").JSX.CSSProperties,
 *   boldStable?: boolean,
 *   shrinkWrap?: boolean,
 *   capitalize?: boolean,
 *   selectRange?: string | [number, number],
 *   childrenOutsideFlow?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 *
 * @param {number} [maxLines]
 *   Truncates overflowing text with an ellipsis. `maxLines={1}` produces a
 *   single-line truncation; `maxLines={n}` (n > 1) uses `-webkit-line-clamp`
 *   to allow up to n lines before clipping.
 *
 * @param {string|number} [spacing]
 *   Separator injected between child nodes. Accepts a size token (`"s"`, `"m"`, …),
 *   a CSS length string, a number (interpreted as px), or `"pre"` / `0` to
 *   disable spacing entirely. Defaults to a regular space character.
 *
 * @param {boolean} [loading]
 *   Renders a shimmer skeleton animation in place of the text content.
 *
 * @param {boolean} [skeleton]
 *   Same as `loading` but without the shimmer animation — a static grey bar.
 *
 * @param {boolean} [preventSpaceUnderlines]
 *   Replaces real space characters between children with padding-based spaces.
 *   Useful inside `<a>` elements where browsers draw an underline under spaces.
 *
 * @param {import("preact").JSX.CSSProperties} [holdSpaceForStyle]
 *   Prevents layout shifts when text styles change (e.g. font-weight, font-size).
 *   Pass the CSS properties representing the "largest" visual state of the text.
 *   An invisible placeholder rendered with those styles reserves the space; the
 *   real visible text is layered on top via `position: absolute`.
 *   Best combined with `noWrap` — does not work reliably on multi-line text.
 *
 * @param {boolean} [boldStable]
 *   Alternative to `holdSpaceForStyle` for multi-line text. Keeps a consistent
 *   visual width across bold/normal transitions by painting normal-weight text
 *   over a bold background using `background-clip: text`. Does not handle
 *   font-size changes.
 *
 * @param {boolean} [shrinkWrap]
 *   Forces the element width to match its longest visual line, preventing the
 *   text block from being wider than its content when inside a flex/grid container.
 *
 * @param {boolean} [capitalize]
 *   Uppercases the first letter of the text content via CSS.
 *
 * @param {string|[number,number]} [selectRange]
 *   Selects a portion of the text on mount. Pass a substring to search for, or
 *   a `[start, end]` character-offset tuple.
 *
 * @param {import("preact").ComponentChildren} [childrenOutsideFlow]
 *   Rendered after children but outside the text spacing/flow logic. Used
 *   internally for overlays such as the skeleton container.
 */
export const Text = (props) => {
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;

  return <TextDispatcher {...props} ref={ref} />;
};

const TextDispatcher = (props) => {
  if (props.loading || props.skeleton) {
    return <TextSkeleton {...props} />;
  }
  if (props.shrinkWrap) {
    return <TextShrinkWrap {...props} />;
  }
  if (props.maxLines === 1 || props.maxLines === "1") {
    return <TextOverflow {...props} />;
  }
  if (props.selectRange) {
    return <TextWithSelectRange {...props} />;
  }
  return <TextUI {...props} />;
};
const TextShrinkWrap = (props) => {
  const { ref } = props;

  const applyWidth = () => {
    const text = ref.current;
    // Reset any previously forced width so we measure the natural size
    text.style.width = "";
    const optimalWidth = measureLongestVisualLineWidth(text);
    if (optimalWidth === null) {
      return;
    }
    text.style.width = `${Math.ceil(optimalWidth)}px`;
  };

  useLayoutEffect(() => {
    const text = ref.current;
    if (!text) {
      return;
    }
    applyWidth();
  });
  useLayoutEffect(() => {
    // Re-compute whenever the parent resizes (covers cases where the parent
    // has an independent size constraint, e.g. max-width, flex layout).
    // We also listen to window resize because when the parent's width is
    // driven solely by the text itself (no external constraint), the parent
    // won't change size when the viewport changes — so the ResizeObserver
    // alone would never fire.
    const text = ref.current;
    if (!text) {
      return undefined;
    }
    const parent = text.parentElement;
    let observer;
    if (parent) {
      observer = new ResizeObserver(applyWidth);
      observer.observe(parent);
    }
    window.addEventListener("resize", applyWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", applyWidth);
    };
  }, []);

  return (
    <TextDispatcher {...props} data-shrinkwrap="" shrinkWrap={undefined} />
  );
};
const TextUI = (props) => {
  import.meta.css = css;
  let {
    ref,
    spacing,
    preventSpaceUnderlines = false,
    boldStable,
    holdSpaceForStyle,
    capitalize,
    children,
    childrenOutsideFlow,
    shrinkWrap,
    ...rest
  } = props;
  const defaultSpace = preventSpaceUnderlines ? FAKE_SPACE : REGULAR_SPACE;
  const resolvedSpacing = spacing ?? defaultSpace;
  const boxProps = {
    "as": "span",
    "data-capitalize": capitalize ? "" : undefined,
    "data-shrinkwrap": shrinkWrap ? "" : undefined,
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
    <TextDispatcher
      data-skeleton=""
      data-loading={loading ? "" : undefined}
      {...props}
      skeleton={undefined}
      childrenOutsideFlow={skeletonOverlay}
    >
      {innerChildren}
    </TextDispatcher>
  );
};
const TextOverflow = ({ noWrap, spacing, capitalize, children, ...rest }) => {
  return (
    <TextDispatcher
      block
      as="div"
      pre={noWrap === undefined ? true : undefined}
      // For paragraph we prefer to keep lines and only hide unbreakable long sections
      preLine={rest.as === "p" ? true : undefined}
      noWrap={noWrap}
      {...rest}
      maxLines={undefined}
      data-text-overflow=""
      spacing={spacing}
      capitalize={capitalize}
    >
      {children}
    </TextDispatcher>
  );
};
const TextWithSelectRange = ({ ref, selectRange, ...props }) => {
  useInitialTextSelection(ref, selectRange);

  return <TextDispatcher {...props} ref={ref} selectRange={undefined} />;
};
