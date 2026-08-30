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
import { TextAnchor } from "./text_anchor.jsx";
import { useInitialTextSelection } from "./use_initial_text_selection.jsx";

const css = /* css */ `
  @layer navi {
    /* Same reason as .navi_icon below: the display here is a starting point,
       and box.jsx's unlayered [navi-box-flow] attributes have to win over it.
       The rest is appearance a caller may want back. */
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
      /* Only the inline axis has something to truncate, so the clip must not
         constrain the block one: overflow hidden would make the element a
         scroll container, whose flex automatic minimum size is 0, and inside a
         column flex container shorter than 1lh the text then shrinks under its
         own line box and gets cut through the glyphs. The margin leaves room
         for ink drawn outside the advance width. */
      overflow: clip;
      overflow-wrap: normal;
      /* The padding-box keyword is redundant (it is the default box) but
         Chromium drops the declaration when a bare calc() follows. */
      overflow-clip-margin: padding-box calc((1lh - 1em) / 2);
    }

    &[data-skeleton] {
      max-width: 100%;
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

  /* ── Icon ── */

  @layer navi {
    /* Ensure data attributes from box.jsx can win to update display */
    .navi_icon {
      display: inline-flex;
      box-sizing: border-box;
      max-width: 100%;
      /* An icon never grows past the box it sits in, so a glyph can never make
         a line of text taller than the text itself. lineOverflow="allow" opts
         out, for an icon that is an affordance rather than a character — a
         control's chevron or clear button, sized to be touched, not read. */
      max-height: 100%;

      &[data-line-overflow="allow"] {
        max-height: none;
      }
    }
  }

  .navi_icon {
    white-space: nowrap;
    vertical-align: inherit;

    &[data-icon-char] {
      aspect-ratio: 1/1;
      /* The width is stated, not left to the aspect ratio. Derived through the
         ratio it would be capped by max-width: 100% of a content-sized parent
         (a button's content, a picker's slot) whose width depends on the icon —
         a cyclic percentage that iOS WebKit resolves to 0, collapsing the icon
         and the parent with it. */
      width: round(1em, 1px);
      min-width: 0;
      height: round(1em, 1px);
      max-height: round(1em, 1px);
      flex-grow: 0 !important;
      align-items: center;
      justify-content: center;

      /* fillLine: measured on the line box (1lh) instead of the character box
         (1em). The icon still stays inside the line — it just uses all of it,
         which is what an icon standing on its own in a control's slot wants,
         where a glyph sitting among letters wants to match their size. */
      &[data-fill-line] {
        width: round(1lh, 1px);
        height: round(1lh, 1px);
        max-height: round(1lh, 1px);
      }

      svg,
      img {
        width: 100%;
        height: 100%;
      }
      svg {
        overflow: visible;
      }
    }
    &[data-flow-inline] {
      width: 1em;
      height: 1em;
    }
    &[data-interactive] {
      cursor: pointer;
    }
    &[data-icon-text] {
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
  }

  /* A block icon whose width follows from its height through the aspect ratio
     has nothing for max-width: 100% to measure against when the parent is
     content-sized (same cyclic percentage as above); the height already bounds
     it. data-width-fixed alone (an explicit width) keeps the cap. */
  .navi_icon[data-height-fixed]:not([data-width-fixed]),
  .navi_icon[data-width-fixed][data-height-fixed] {
    max-width: none;
  }

  .navi_icon > svg,
  .navi_icon > img {
    width: 100%;
    height: 100%;
  }
  .navi_icon[data-width-fixed] > svg,
  .navi_icon[data-width-fixed] > img {
    width: 100%;
    height: auto;
  }
  .navi_icon[data-height-fixed] > svg,
  .navi_icon[data-height-fixed] > img {
    width: auto;
    height: 100%;
  }
  .navi_icon[data-width-fixed][data-height-fixed] > svg,
  .navi_icon[data-width-fixed][data-height-fixed] > img {
    width: 100%;
    height: 100%;
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
    //   takes up zero visual space. line-height:0 with it: a line-height
    //   inherited as a length (a control's, snapped to the pixel) would give
    //   this empty box that height, centered on the baseline — and its lower
    //   half would push the line box down under the text.
    // - Second span: a zero-width joiner (&#8203;) with padding-left set to
    //   the desired gap size. This is the only visible part.
    return (
      <span>
        <span style="font-size: 0; line-height: 0"> </span>
        <span style={`padding-left: ${value}`}>&#8203;</span>
      </span>
    );
  }
  return <span style={`padding-left: ${value}`}>&#8203;</span>;
};

// Keeps the last child from being left alone on a line of its own — an icon
// after a label, a unit after a number. It is an atomic inline, so the browser
// is free to break the line right before it, and no character can stop that (a
// word joiner does not suppress a break before an atomic inline). So the last
// word of what precedes it and the child itself go in one nowrap box instead:
// the classic widow fix, applied to the one place it is always wrong to break.
//
// Only the last word travels with it — wrapping the whole preceding child would
// stop a long label from wrapping at all.
const attachLastTextChild = (children, separator) => {
  const childArray = toChildArray(children);
  if (childArray.length < 2) {
    // Nothing to attach it to: on its own it cannot be orphaned.
    return children;
  }
  const lastChild = childArray[childArray.length - 1];
  const previousChild = childArray[childArray.length - 2];
  const before = childArray.slice(0, -2);
  const attach = (attached) => (
    <span key="attached" style="white-space: nowrap">
      {attached}
      {separator}
      {lastChild}
    </span>
  );
  if (typeof previousChild !== "string") {
    return [...before, attach(previousChild)];
  }
  const lastWordMatch = /\s+(\S+)$/.exec(previousChild);
  if (!lastWordMatch) {
    return [...before, attach(previousChild)];
  }
  return [
    ...before,
    previousChild.slice(0, lastWordMatch.index),
    attach(lastWordMatch[1]),
  ];
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
  // A reveal-on-interaction Link (e.g. the "#" anchor before a title) is
  // absolutely positioned and takes no room in the flow, so a separator after
  // it would leave a stray gap at the start of the line.
  if (leftIsNode && left.props?.revealOnInteraction) {
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
 * The typography primitive: every string an app displays goes through it, or
 * through something built on it (`Title`, `Paragraph`, `Caption`, `Link`, a
 * control's label). It accepts every `Box` prop on top of the ones below.
 * See `docs/typography.md` for the decisions behind it — truncating, rows made
 * of an icon, a text and an icon, and where a line may break.
 *
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
 *   attachLastChild?: boolean,
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
 *   How many lines the text may take before it is truncated with an ellipsis.
 *   `maxLines={1}` truncates on a single line; `maxLines={n}` (n > 1) clamps to
 *   n lines. This is the only prop to use for that — `Box`'s `lineClamp` /
 *   `overflowEllipsis` are raw CSS mappings meant for elements that are not a
 *   `Text`, and `lineClamp={1}` is never the single-line truncation you want.
 *   Truncation only happens if the element may become narrower than its
 *   content: `maxLines` sets `min-width: 0` here, but each `Box` between this
 *   one and the element that carries the width must set it too.
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
 * @param {boolean} [attachLastChild]
 *   Keeps the last child on the same line as the word before it — a trailing
 *   icon, a unit, an arrow. Without it the browser may break the line right
 *   before that child and leave it alone underneath, and no character can
 *   prevent that break. For wrapping text; a child that must survive
 *   truncation belongs outside the `Text` instead (see `docs/typography.md`).
 *   `Link` sets it on its own whenever it renders an end icon.
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
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;

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
    <Text {...props} ref={ref} data-shrinkwrap="" shrinkWrap={undefined} />
  );
};
const TextUI = (props) => {
  import.meta.css = css;
  let {
    ref,
    spacing,
    preventSpaceUnderlines = false,
    attachLastChild = false,
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
  if (attachLastChild) {
    // Before the spacing pass, so the box it makes is one child of it: the gap
    // between the text and the box is Text's own, the one inside it is written
    // here (it has to live inside the nowrap box to be unbreakable).
    children = attachLastTextChild(
      children,
      resolvedSpacing === "pre" ||
        resolvedSpacing === 0 ||
        resolvedSpacing === "0"
        ? null
        : defaultSpace,
    );
  }
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
const TextOverflow = ({ noWrap, spacing, capitalize, children, ...rest }) => {
  return (
    <Text
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
    </Text>
  );
};
const TextWithSelectRange = ({ ref, selectRange, ...props }) => {
  const defaultRef = useRef();
  const innerRef = ref || defaultRef;
  useInitialTextSelection(innerRef, selectRange);

  return <Text {...props} ref={innerRef} selectRange={undefined} />;
};

/**
 * Renders an icon — an inline SVG/emoji/text glyph that inherits the
 * surrounding text's `currentColor` and (by default) its font size, so it sits
 * on the text baseline like a character.
 *
 * Content comes from either `href` (references an external/sprite symbol via
 * `<use>`) or `children` (an inline `<svg>` element, or a string for a
 * text/emoji icon). All extra props are spread onto the underlying `Box`/`Text`
 * (sizing, spacing, color, className, data-attributes, …).
 *
 * Render mode is chosen automatically:
 * - `children` is a **string** → a text icon (`<Text data-icon-text>`).
 * - **sized** (an explicit `width`/`height`, or `flex`/`grid`) → a block icon
 *   (`<Box square>`), laid out as its own box rather than inline.
 * - otherwise → an **inline char-like** icon that flows on the text baseline
 *   (`data-icon-char`), aligned via `textAnchor`.
 *
 * Accessibility: an icon is treated as decorative (`aria-hidden`) by default
 * whenever it has no explicit size and no `onClick`; give it an explicit
 * `decorative={false}` (or make it interactive) when it conveys meaning.
 *
 * @param {object} props
 * @param {string} [props.href] - URL/id of an external SVG symbol, rendered via
 *   `<svg><use href></svg>`. Mutually exclusive with meaningful `children`.
 * @param {import("preact").ComponentChildren} [props.children] - Inline icon
 *   content: an `<svg>` element, or a string (renders as a text/emoji icon).
 * @param {boolean} [props.decorative] - Marks the icon `aria-hidden`. Defaults
 *   to `true` for an unsized, non-interactive icon; pass `false` for a
 *   meaning-bearing icon that needs to be exposed to assistive tech.
 * @param {(event: MouseEvent) => void} [props.onClick] - Makes the icon
 *   interactive (`data-interactive`, pointer cursor) and non-decorative.
 * @param {"line-top"|"char-top"|"center"|"char-center"|"char-bottom"|"line-bottom"} [props.textAnchor="center"]
 *   - Vertical alignment within the surrounding text line for the inline
 *   char-like mode, forwarded to `TextAnchor`: `"line-top"`/`"line-bottom"`
 *   align to the line box edges, `"char-top"` to the ink ascent, `"center"`
 *   centers on the line box, `"char-center"` on the capitals, `"char-bottom"`
 *   sits on the baseline. See `text_anchor.jsx`.
 * @param {{ size?: number, verticalAlign?: string }} [props.lineLayout] -
 *   Describes the surrounding line context (font size / vertical-align),
 *   forwarded to `TextAnchor` so it recomputes the vertical correction when
 *   that context changes.
 * @param {string|number} [props.width] - Explicit width; `"auto"` clears it.
 *   Any explicit size switches the icon to block (sized) mode.
 * @param {string|number} [props.height] - Explicit height; `"auto"` clears it.
 * @param {"allow"} [props.lineOverflow] - `"allow"` lets the icon be taller
 *   than the box it sits in (a line of text, a control's slot) instead of being
 *   capped by it. For an icon that is an affordance sized for the finger rather
 *   than a character sized for reading.
 * @param {boolean} [props.fillLine] - Sizes the icon on the line box (1lh)
 *   rather than on the character box (1em), so it uses the full height of the
 *   line without leaving it. Unlike `lineOverflow`, the icon still never
 *   exceeds the line.
 * @param {boolean} [props.square] - Keep a 1:1 box; combined with one explicit
 *   dimension it fixes the other too.
 * @param {boolean} [props.circle] - Like `square`, plus a circular shape.
 * @param {string|number} [props.aspectRatio] - Fixes the second dimension from
 *   the one explicit dimension.
 * @param {"x"|"y"|boolean} [props.flex] - Forces block/flex layout; auto-set to
 *   `"x"` when the icon is sized.
 * @param {boolean} [props.grid] - Forces block/grid layout.
 * @param {string} [props.className] - Merged with the base `"navi_icon"` class.
 */
export const Icon = ({
  href,
  children,
  decorative,
  onClick,
  textAnchor = "center",
  lineLayout,
  lineOverflow,
  fillLine,
  ...props
}) => {
  import.meta.css = css;

  const innerChildren = href ? (
    <svg width="100%" height="100%">
      <use href={href} />
    </svg>
  ) : (
    children
  );

  let { flex, grid, width, height } = props;
  if (width === "auto") {
    width = undefined;
  }
  if (height === "auto") {
    height = undefined;
  }
  const hasExplicitWidth = width !== undefined;
  const hasExplicitHeight = height !== undefined;
  const widthFixed =
    hasExplicitWidth ||
    (hasExplicitHeight && (props.square || props.circle || props.aspectRatio));
  const heightFixed =
    hasExplicitHeight ||
    (hasExplicitWidth && (props.square || props.circle || props.aspectRatio));
  if (widthFixed || heightFixed) {
    if (flex === undefined) {
      flex = "x";
    }
  } else if (decorative === undefined && !onClick) {
    decorative = true;
  }
  const ariaProps = decorative ? { "aria-hidden": "true" } : {};
  const textRef = useRef();

  if (typeof children === "string") {
    return (
      <Text
        {...props}
        {...ariaProps}
        data-icon-text=""
        data-line-overflow={lineOverflow}
        data-fill-line={fillLine ? "" : undefined}
      >
        {children}
      </Text>
    );
  }

  if (flex || grid) {
    return (
      <Box
        square
        {...props}
        {...ariaProps}
        flex={flex}
        baseClassName="navi_icon"
        data-width-fixed={widthFixed ? "" : undefined}
        data-height-fixed={heightFixed ? "" : undefined}
        data-interactive={onClick ? "" : undefined}
        data-line-overflow={lineOverflow}
        data-fill-line={fillLine ? "" : undefined}
        onClick={onClick}
      >
        {innerChildren}
      </Box>
    );
  }

  return (
    <TextAnchor
      childRef={textRef}
      textAnchor={textAnchor}
      textSize={props.size}
      lineLayout={lineLayout}
    >
      <Text
        {...props}
        {...ariaProps}
        className={withPropsClassName("navi_icon", props.className)}
        spacing="pre"
        data-icon-char=""
        data-line-overflow={lineOverflow}
        data-fill-line={fillLine ? "" : undefined}
        data-width-fixed={widthFixed ? "" : undefined}
        data-height-fixed={heightFixed ? "" : undefined}
        data-interactive={onClick ? "" : undefined}
        onClick={onClick}
        ref={textRef}
      >
        <span style="user-select:none">&#8203;</span>
        {innerChildren}
      </Text>
    </TextAnchor>
  );
};
