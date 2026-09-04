/**
 * Box - A Swiss Army Knife for Layout
 *
 * A regular div by default, enhanced with styling props for spacing, sizing,
 * and layout. The main value is a friendlier API over raw CSS Flexbox.
 *
 * ## Display & Layout
 *
 * - `flex` — horizontal flex container (items side by side)
 * - `flex="y"` — vertical flex container (items stacked). The prop name makes
 *   the axis explicit, avoiding the classic CSS trap where `flex-direction: column`
 *   actually stacks items vertically despite "column" feeling horizontal.
 * - `grid` — grid container
 * - `inline` — switches to inline display (works with flex and grid too)
 *
 * ## Alignment
 *
 * Instead of CSS's justify-content/align-items which swap meaning based on flex-direction:
 * - `alignX` — horizontal alignment, always
 * - `alignY` — vertical alignment, always
 *
 * ## Spacing & Sizing
 *
 * Props for margin, padding, gap, width, height, expand, shrink, and more.
 *
 * ## Pseudo-class Styles
 *
 * The `style` prop supports pseudo-class keys alongside regular CSS properties.
 * This lets you express hover, focus, and custom interaction states in one object,
 * without writing CSS or adding class names:
 *
 * ```jsx
 * <Box
 *   style={{
 *     backgroundColor: "blue",
 *     ":-navi:pressed": {
 *       backgroundColor: "darkblue",
 *     },
 *     ":hover": {
 *       backgroundColor: "lightblue",
 *     },
 *   }}
 * />
 * ```
 *
 * Styles are applied directly to the DOM (not via Preact's style prop) for two reasons:
 * 1. **Pseudo-class support**: reacting to `:hover`, `:focus`, or custom states like
 *    `:-navi:pressed` without re-rendering the component on every pseudo state change.
 * 2. **Correct initial render**: pseudo-class state must be read from the DOM node at
 *    mount time. Preact's style prop runs before the DOM exists, so the right initial
 *    style can only be determined once the node is available.
 */

import { normalizeStyles } from "@jsenv/dom";
import { createContext, isValidElement, toChildArray } from "preact";
import { useCallback, useContext, useRef } from "preact/hooks";

import {
  resolveInteractions,
  useInteractionsEffect,
} from "../control/interaction/interactions.js";
import {
  SELF_INTERACTIONS_ATTRIBUTE,
  selfInteractionsAttributeValue,
} from "../control/self_interactions.js";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { BoxFlowContext } from "./box_flow_context.jsx";
import {
  getHowToHandleStyleProp,
  getVisualChildStylePropStrategy,
  isSizeSpacingKey,
  isStyleProp,
  prepareStyleValue,
  stringifySpacingStyle,
  stringifyStyleValue,
} from "./box_style_util.js";
import { getDefaultDisplay } from "./display_defaults.js";
import {
  applyStyle,
  initPseudoStyles,
  PSEUDO_NAMED_STYLES_DEFAULT,
  PSEUDO_STATE_DEFAULT,
} from "./pseudo_styles.js";
import { useComposeElementRef } from "./ref_composition/use_element_ref.js";

export const BoxForwardedPropsContext = createContext({});

import.meta.css = /* css */ `
  /* A scrolling area, and the three layout roles that live in one. Declared
     here rather than in dialog.jsx/popover.jsx because it has nothing to do
     with popups: anything that scrolls can want a title that stays put. Those
     two just carry [data-scrollable] on their own root.

     Two shapes:
     - header/footer alone: the container itself scrolls and they stick to its
       edges;
     - a body as well: the body is the only thing that scrolls, so the other two
       simply sit outside it and need no stickiness at all.

     Padding belongs on the parts, not on the scrolling box: padding on a
     scroller sits INSIDE the scrollbars, so the content ends up centered
     between them — and a control flush against the edge of a scrolling area
     overflows it (a focus outline is drawn outside the control it belongs to)
     and raises a scrollbar of its own. */
  /* A control sitting right against the edge of what scrolls must keep its
     loading outline within its own box: the outline is drawn a couple pixels
     outside the control (see loading_outline.jsx), and that bleed alone is
     enough to make the area scrollable — a scrollbar appearing and disappearing
     as things load. Only what the scroller directly contains is against that
     edge; anything nested deeper has room around it and keeps the outline it
     asked for, hence the child combinators. Written on the outline itself
     rather than on the control, because the var inherits: setting it on a
     container would reach every control below it, edge or not. */
  [data-scrollable] > .navi_loading_outline_wrapper,
  [data-scrollable] > * > .navi_loading_outline_wrapper {
    --loading-outline-min-inset: 0px;
  }

  /* A scroller inside a box that TRAVELS keeps its leftovers to itself: what a
     list has left of a gesture once it has reached its end must not reach the
     page, or the page moves behind a travel that is already answering the same
     finger. The rule belongs to @jsenv/dom's drag_to_travel — this is the part
     of it only navi can write.

     What a browser is asked, and where, is not the same everywhere: Blink asks
     every scroll container between the pointer and the page, so containing the
     travelling box answers for everything inside it; Gecko and WebKit ask only
     the ones that actually scroll, so the box — which travels, it does not
     scroll — is walked past and the SCROLLER itself has to be told. drag_to_
     travel says it to everything inside the box for those two, and to the box
     alone on Blink, where saying it to everything turns anything that clips
     (an ellipsis, a rounded card, the invisible checkbox covering a selectable
     row) into a dead zone under the wheel — a scroll container with nothing to
     scroll, and Blink stops at it.

     Which leaves, on Blink, a travelling box that does NOT clip: nothing is
     asked, and the leftovers reach the page. RouteTravel is that box, and
     cannot be made to clip — a scroll container there would become the nearest
     one for every "position: sticky" inside the pages it holds.

     So navi contains what it KNOWS scrolls. [data-scrollable] is worn by a Box
     that ASKED for overflow auto/scroll (see below), never by one that merely
     clips: containing it costs nothing on the engines where the rule above
     already covers it, and on Blink it is what keeps a list inside a travelling
     page from taking the page with it. What is left over is a scroller nobody
     declared — a bare div with an overflow of its own, a textarea, a widget
     from elsewhere: those still hand their leftovers up, on Blink, under a box
     that does not clip. */
  [data-drag-travel*="x"] [data-scrollable] {
    overscroll-behavior-x: contain !important;
  }
  [data-drag-travel*="y"] [data-scrollable] {
    overscroll-behavior-y: contain !important;
  }

  [data-scrollable] {
    overflow: var(--x-scrollable-overflow, auto);
    /* What lands here has to land IN the area, not on its edge: a control
       scrolled flush against it reads as half-swallowed by whatever comes next
       (a footer, the edge of a popup) and the ring it draws around itself is
       cut off. The browser scrolls to a border box and knows nothing of that
       ring, so the room is reserved here instead — for its own scroll-into-view
       as much as for navi's (scroll_into_view_scoped.js in @jsenv/dom). */
    scroll-padding: var(--navi-scroll-padding, var(--navi-s));
    --box-header-z-index: var(--navi-z-index-sticky);
    --box-footer-z-index: var(--navi-z-index-sticky);
    /* The band stays inside this box: without a stacking context here, "in
       front of my body" would be read as "in front of everything on the page"
       and a header would reach past a bar or a popup — which is exactly what
       the decades in navi_z_indexes.js are there to prevent. See
       docs/z_index.md. */
    isolation: isolate;

    &[data-scrollable-overflow="scroll"] {
      --x-scrollable-overflow: scroll;
    }

    /* A real border and not a box-shadow: a shadow is drawn outside the box, so
       it lands on top of whatever comes next in the painting order and loses to
       it — a body painting its own background over the line that was meant to
       separate them. The border belongs to the part itself and is always
       visible; the pixel it adds shifts nothing, these parts never shrink. */
    /* The corners are the container's, not the part's: a header sitting at the
       top of a rounded box has to follow that curve or it paints square over
       it (a dark header in a rounded popup is where this shows). inherit and
       not a value of its own, so whoever rounds the box rounds these too. */
    > [data-header] {
      position: sticky;
      top: 0;
      z-index: var(--box-header-z-index);
      border-bottom: 1px solid var(--navi-separator-color-default);
      border-top-left-radius: inherit;
      border-top-right-radius: inherit;
    }
    > [data-footer] {
      position: sticky;
      bottom: 0;
      z-index: var(--box-footer-z-index);
      border-top: 1px solid var(--navi-separator-color-default);
      border-bottom-right-radius: inherit;
      border-bottom-left-radius: inherit;
    }

    &:has(> [data-body]) {
      /* A column, declared here rather than expected from the caller: the three
         parts only make sense stacked, and the body needs a flex context to be
         told "take what is left" below. */
      display: flex;
      flex-direction: column;
      /* the body is the only thing that scrolls */
      --x-scrollable-overflow: hidden;

      > [data-header],
      > [data-footer] {
        /* Nothing scrolls under them here — the body does that, next to them —
           so they are back to being blocks in the flow, and stacking is not
           their business anymore. */
        position: static;
        z-index: auto;
        flex-shrink: 0;
      }

      > [data-body] {
        /* Shrinks when there is not enough room (and then scrolls), but never
           grows: a short body leaves the footer right under it rather than
           pushed to the bottom of a container it does not fill.
           min-height: a flex child refuses to shrink below its content unless
           told it may, and without that the body grows instead of scrolling */
        min-height: 0;
        flex: 0 1 auto;

        /* The same reading as the header's corners above, on all four: a body
           follows the corners of the box it is drawn in — which is also what
           it clips its content to, the overflow just above. */
        border-top-left-radius: inherit;
        border-top-right-radius: inherit;
        border-bottom-right-radius: inherit;
        border-bottom-left-radius: inherit;
        /* Overflow makes it focusable via tab: apply the outline styles */
        outline-width: var(--navi-focus-outline-width);
        /* Outline must appear ON the body, not outside */
        /* Because for instance when body is within dialog or slide with overflow: hidden it would not be visible */
        outline-offset: calc(-1 * var(--navi-focus-outline-width));
        overflow: auto;
        /* Same room as the scrolling area above, on the part that took over the
           scrolling from it. */
        scroll-padding: var(--navi-scroll-padding, var(--navi-s));

        &:focus-visible {
          outline-style: solid;
        }
      }

      /* A corner a header or a footer covers is not the body's to follow:
         what the body meets there is their flat separator line, not a curve,
         and a radius against it shows the box through the gap it opens. */
      > [data-header] ~ [data-body] {
        border-top-left-radius: 0;
        border-top-right-radius: 0;
      }
      > [data-body]:has(~ [data-footer]) {
        border-bottom-right-radius: 0;
        border-bottom-left-radius: 0;
      }

      /* A body with no padding of its own holds content running edge to edge:
         whatever sits at one of its ends is drawn ON the corner the body just
         resolved, so a radius of its own there carves a notch out of it. The
         body already clips to that corner, which makes "none" the right radius
         for what lands on it — square, and the body draws the curve. The ask
         travels down as a corner claim (see group.jsx) so a navi control
         answers it wherever it sits inside. */
      > [data-body][data-body-flush] {
        > :first-child {
          --x-corner-top-left-radius: 0;
          --x-corner-top-right-radius: 0;
        }
        > :last-child {
          --x-corner-bottom-right-radius: 0;
          --x-corner-bottom-left-radius: 0;
        }
      }
    }
  }

  /* A corner claim travels down (see group.jsx) because the member joined to
     its neighbours is not always the thing that draws the frame: it can be a
     bare wrapper, a tooltip, a link, and the control inside is what has to
     square. That only holds while the wrapper adds nothing of its own. A box
     that paints a background or a border, or that insets what it holds, IS the
     frame at that spot — what is inside it sits on padding or on that
     background, never on the corner the group squared — so the claim stops
     here, exactly as a control stops it once it has answered. */
  [navi-box-frame] > * {
    --x-corner-top-left-radius: initial;
    --x-corner-top-right-radius: initial;
    --x-corner-bottom-right-radius: initial;
    --x-corner-bottom-left-radius: initial;
  }

  @layer navi {
    /*
    When using square/circle/aspectRatio prop we expect box to respect the aspect ratio.
    But within flex containers or stuff like that the min-width/min-height auto
    will prevent the item from shrinking to respect aspect-ratio
    We put that in a layer navi + a specific attribute so that it's very easy to override this
    */
    [navi-aspect-ratio] {
      min-width: 0;
      min-height: 0;
    }
  }

  /* We force a given display style using html attribute instead of inline style */
  /* No particular reason for this, logic could be moved to inline style like the rest */
  /* It was an attempt to see if attributes where a good candidate to set style based on props */
  /* Actullay it's not that much as it make the attribute and CSS complexity explode */
  /* For now it's kept here and must be outside layer navi to be able to override any given display
  Set by navi itself on their default display */
  [navi-box-flow="inline"] {
    display: inline;
  }
  [navi-box-flow="block"] {
    display: block;
  }
  [navi-box-flow="inline-block"] {
    display: inline-block;
  }
  [navi-box-flow="flex-x"] {
    display: flex;
  }
  [navi-box-flow="flex-y"] {
    display: flex;
    flex-direction: column;
  }
  [navi-box-flow="inline-flex-x"] {
    display: inline-flex;
  }
  [navi-box-flow="inline-flex-y"] {
    display: inline-flex;
    flex-direction: column;
  }
  [navi-box-flow="grid"] {
    display: grid;
    &[navi-box-flow-column] {
      grid-auto-flow: column;
    }
    &[navi-box-flow-row] {
      grid-auto-flow: row;
    }
    &[navi-box-flow-column][navi-box-flow-row] {
      grid-auto-flow: unset;
    }
  }
  [navi-box-flow="inline-grid"] {
    display: inline-grid;
    &[navi-box-flow-column] {
      grid-auto-flow: column;
    }
    &[navi-box-flow-row] {
      grid-auto-flow: row;
    }
    &[navi-box-flow-column][navi-box-flow-row] {
      grid-auto-flow: unset;
    }
  }
  /*
  To set display on component, code usually do something like: 
  .component_class { display: component_display; }

  It overrides the default behavior of [hidden] attribute!
  This needs to be explicitly handled with:
  .component_class[hidden] { display: none; }

  To avoid this extra work and potential mistakes we force the default behavior of [hidden] attribute.
  */
  [hidden] {
    display: none !important;
  }
`;

const PSEUDO_CLASSES_DEFAULT = [];
const PSEUDO_ELEMENTS_DEFAULT = [];
const STYLE_CSS_VARS_DEFAULT = {};
// An entry of styleCSSVars is the css variable the prop writes into, alone when
// the prop is named after a css style — Box then already knows how to read its
// value — or paired with the style whose values it borrows when it is not.
const readCSSVarEntry = (entry) => {
  if (Array.isArray(entry)) {
    return entry;
  }
  return [entry, null];
};
// When only pseudoStateSelector is set (no visualSelector), the box owns its
// visual identity. Only event handlers and these explicit props are forwarded
// to the inner semantic/interactive child element.
const PSEUDO_STATE_CHILD_PROP_SET = new Set(["tabIndex", "tabindex"]);

/**
 * @type {import("preact").FunctionComponent<{
 *   as?: string,
 *   className?: string,
 *   style?: import("preact").JSX.CSSProperties & { [pseudo: string]: import("preact").JSX.CSSProperties },
 *   styleCSSVars?: { [propName: string]: string | [string, string] },
 *   inline?: boolean,
 *   block?: boolean,
 *   flex?: "x" | "y" | boolean,
 *   grid?: boolean,
 *   display?: "inherit",
 *   pseudoState?: { [stateName: string]: boolean },
 *   pseudoClasses?: string[],
 *   pseudoElements?: string[],
 *   visualSelector?: string,
 *   pseudoStateSelector?: string,
 *   hasChildUsingForwardedProps?: boolean,
 *   childPropSet?: Set<string>,
 *   preventInitialTransition?: boolean,
 *   separator?: import("preact").ComponentChildren | ((index: number) => import("preact").ComponentChildren),
 *   selfInteractions?: string,
 *   interactions?: { [type: string]: "request_action" | "request_ui_action" | ((event: Event) => void) | false | null | undefined },
 *   children?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 * @param {object} [interactions] What this box answers, by interaction name
 *   (see docs/interactions.md). A plain box has no wiring of its own: it does
 *   nothing with `action` (that is a control's prop), so a click on it is
 *   declared here like any other interaction: `interactions={{ click: fn }}`.
 */
export const Box = (props) => {
  const { ref, children, separator, interactions, ...computeProps } = props;
  const parentBoxFlow = useContext(BoxFlowContext);
  // Which interactions this box answers, and with what. Read here rather than
  // on the control, so a swipe or a hold can be declared on anything — a row, a
  // card, a block of text — and reach the control it belongs to (which is what
  // carries the action, and what knows it is disabled) by looking for it.
  // Read through a ref by the effect below: what an interaction DOES is this
  // render, while WHEN it happens is wired once, at mount (see
  // useInteractionsEffect).
  const interactionsRef = useRef(null);
  interactionsRef.current = resolveInteractions(interactions);

  // What the props say about this box is worked out once per distinct set of
  // them: a parent re-rendering hands every box below it a new props object,
  // and most of the time nothing in it has changed. Handlers are the
  // exception — a closure is new on every render — so they are compared by
  // name only and put back fresh, see withCurrentHandlers.
  const renderMemoRef = useRef(null);
  const renderMemo = renderMemoRef.current;
  let computed;
  if (
    renderMemo &&
    renderMemo.parentBoxFlow === parentBoxFlow &&
    arePropsEquivalent(renderMemo.props, computeProps)
  ) {
    computed = withCurrentHandlers(renderMemo.computed, computeProps);
  } else {
    computed = computeBox(computeProps, parentBoxFlow);
  }
  renderMemoRef.current = { props: computeProps, parentBoxFlow, computed };
  const {
    TagName,
    boxFlow,
    boxFlowIsDefault,
    row,
    column,
    aspectRatio,
    visualSelector,
    innerClassName,
    selfForwardedProps,
    childForwardedProps,
    styleDeps,
  } = computed;
  const syncBox = useCallback(computed.syncBox, styleDeps);
  const finalRef = useComposeElementRef(syncBox, ref);
  useInteractionsEffect(finalRef, interactionsRef);

  let innerChildren = children;
  if (separator) {
    // Flatten nested arrays (e.g., from .map()) to treat each element as individual child
    innerChildren = applySeparatorOnChildren(innerChildren, separator);
  }

  // When hasChildUsingForwardedProps is used it means
  // Some/all the children needs to access remainingProps
  // to render and will provide a function to do so.
  if (props.hasChildUsingForwardedProps) {
    innerChildren = (
      <BoxForwardedPropsContext.Provider value={childForwardedProps}>
        {innerChildren}
      </BoxForwardedPropsContext.Provider>
    );
  }

  return (
    <TagName
      ref={finalRef}
      className={innerClassName}
      navi-box-flow={boxFlowIsDefault ? undefined : boxFlow}
      navi-box-flow-row={row ? "" : undefined}
      navi-box-flow-column={column ? "" : undefined}
      navi-aspect-ratio={aspectRatio ? aspectRatio : undefined}
      data-visual-selector={visualSelector}
      {...selfForwardedProps}
    >
      <BoxFlowContext.Provider value={boxFlow}>
        {innerChildren}
      </BoxFlowContext.Provider>
    </TagName>
  );
};

// Everything the props decide, for the JSX and for the DOM sync. Pure, which
// is what lets Box keep the previous result when the props are equivalent.
const computeBox = (props, parentBoxFlow) => {
  const {
    as: asProp = "div",
    baseClassName,
    className,

    // style management
    style,
    styleCSSVars = STYLE_CSS_VARS_DEFAULT,
    basePseudoState,
    pseudoState, // for demo purposes it's possible to control pseudo state from props
    pseudoClasses = PSEUDO_CLASSES_DEFAULT,
    pseudoElements = PSEUDO_ELEMENTS_DEFAULT,
    // visualSelector convey the following:
    // The box itself is visually "invisible", one of its descendant is responsible for visual representation
    // - Some styles will be used on the box itself (for instance margins)
    // - Some styles will be used on the visual element (for instance paddings, backgroundColor)
    // -> introduced for <Button /> with transform:scale on press
    visualSelector,
    // pseudoStateSelector convey the following:
    // The box contains content that holds pseudoState
    // -> introduced for <Input /> with a wrapped for loading, checkboxes, etc
    pseudoStateSelector,
    hasChildUsingForwardedProps,
    baseChildPropSet,
    childPropSet,
    // preventInitialTransition can be used to prevent transition on mount
    // (when transition is set via props, this is done automatically)
    // so this prop is useful only when transition is enabled from "outside" (via CSS)
    preventInitialTransition,
    // Layout roles inside a scrolling container (a Dialog, a Popover): the
    // header stays at the top and the footer at the bottom while the rest
    // scrolls, or — when a body is present — the body is what scrolls and the
    // two others simply sit outside it. Carried as data attributes because the
    // container is the one that knows how to honour them, and it only has CSS
    // to reach its children with. Same words as List.Item's own header/footer.
    header,
    footer,
    body,
    // A press landing here is aimed AT this box, not at whatever it sits in — a
    // cross an application draws in a card's corner, a badge on a row that
    // travels. Writing the attribute is the whole of it here: it is read off
    // the DOM by the controls above and by the gesture readers, and what an
    // affordance makes of the block around it is a question only a control can
    // answer (see self_interactions.js).
    selfInteractions,
    ...rest
  } = props;
  if (selfInteractions) {
    rest[SELF_INTERACTIONS_ATTRIBUTE] =
      selfInteractionsAttributeValue(selfInteractions);
  }
  let as = asProp;
  if (import.meta.dev && Object.hasOwn(rest, "action")) {
    // A control (Button, Link, a field) takes `action` off its props before
    // reaching here, so an `action` still present is one nothing will run. A
    // string is a form's own attribute and stays.
    if (typeof rest.action !== "string") {
      console.warn(
        `Box: "action" is a control's prop and a plain box does nothing with it. To answer a click, declare it as an interaction: interactions={{ click: fn }}.`,
      );
    }
  }

  // A box that scrolls is what gives header/footer/body their meaning, and
  // saying overflow="auto" is already saying it — no second prop for the same
  // fact. Dialog and Popover get it the same way, by asking for that overflow.
  const scrolls =
    isScrollingOverflow(rest.overflow) ||
    isScrollingOverflow(rest.overflowX) ||
    isScrollingOverflow(rest.overflowY);
  // <header>/<footer> rather than a div: the role is exactly what those tags
  // mean, and a screen reader gets it for free. The body stays a div — <main>
  // means "the main content of the document", which a popup's body is not.
  if (header && as === "div") {
    as = "header";
  }
  if (footer && as === "div") {
    as = "footer";
  }
  const TagName = as;
  if (scrolls) {
    rest["data-scrollable"] = "";
    if (rest.overflow === "auto" || rest.overflow === "scroll") {
      // Handed over to CSS rather than kept as an inline style: a body inside
      // makes the body the only thing that scrolls, and an inline overflow
      // would win over that rule — see [data-scrollable] in this file's CSS.
      rest["data-scrollable-overflow"] = rest.overflow;
      rest.overflow = undefined;
    }
  }
  if (header) {
    rest["data-header"] = "";
  }
  if (footer) {
    rest["data-footer"] = "";
  }
  if (body) {
    rest["data-body"] = "";
    // Padding is what decides whether the content reaches the body's own
    // corners — see the corner claims in this file's CSS.
    let flush = true;
    for (const name of PADDING_PROP_SET) {
      if (declaresSomething(rest[name])) {
        flush = false;
        break;
      }
    }
    if (flush) {
      rest["data-body-flush"] = "";
    }
  }
  // A box that paints something of its own, or that insets what it holds, is
  // the frame at that spot: the corner claims coming from a Group are about
  // ITS corners and nothing inside reaches them, so they stop here — see this
  // file's CSS.
  for (const name of FRAME_PROP_SET) {
    if (declaresSomething(rest[name])) {
      rest["navi-box-frame"] = "";
      break;
    }
  }

  const defaultDisplay = getDefaultDisplay(TagName);
  let { inline, block, flex, grid, row, column } = rest;
  // To obtain flex direction we have the following deprecated props:
  // - [deprecated] <Box column> -> <Box flex> or <Box flex="x">
  // - [deprecated] <Box row> -> <Box flex="y">
  // - [deprecated] <Box flex column> -> <Box flex="x">
  // - [deprecated] <Box flex row> -> <Box flex="y">

  if (flex === true) {
    flex = row ? "y" : "x";
  }
  if (flex === undefined && grid === undefined) {
    if (column) {
      flex = "x";
    } else if (row) {
      flex = "y";
    }
  }
  if (defaultDisplay === "inline") {
    if (inline === undefined && !block) {
      inline = true;
    }
  } else if (defaultDisplay === "block") {
    if (block === undefined && !flex && !grid) {
      block = true;
    }
  } else if (defaultDisplay === "inline-block") {
    if (inline === undefined && !block) {
      inline = true;
    }
    if (block === undefined && !flex && !grid) {
      block = true;
    }
  }
  if (
    inline &&
    (rest.width !== undefined || rest.height !== undefined) &&
    flex === undefined
  ) {
    flex = "x";
  }
  let boxFlow;
  if (inline) {
    if (flex === "x") {
      boxFlow = "inline-flex-x";
    } else if (flex === "y") {
      boxFlow = "inline-flex-y";
    } else if (grid) {
      boxFlow = "inline-grid";
    } else if (block) {
      boxFlow = "inline-block";
    } else {
      boxFlow = "inline";
    }
  } else if (flex === "x") {
    boxFlow = "flex-x";
  } else if (flex === "y") {
    boxFlow = "flex-y";
  } else if (grid) {
    boxFlow = "grid";
  } else if (block) {
    boxFlow = "block";
  } else {
    boxFlow = defaultDisplay;
  }
  // When display="inherit" is passed, adopt the parent's flow instead of computing one.
  // This lets a child Box mirror its parent's flex/grid/block layout without repeating
  // the same layout props, and is used e.g. by Button's inner content element.
  if (rest.display === "inherit") {
    boxFlow = parentBoxFlow;
  }
  const boxFlowIsDefault = boxFlow === defaultDisplay;

  // The box is only a frame and one of its descendants IS the component (a Button
  // and its content): everything, event handlers included, belongs to that
  // descendant.
  const shouldForwardAllToChild = Boolean(
    hasChildUsingForwardedProps && visualSelector && pseudoStateSelector,
  );
  const innerClassName = withPropsClassName(baseClassName, className);
  const selfForwardedProps = {};
  const childForwardedProps = {};
  let styleDeps;
  let syncBox;
  styling: {
    styleDeps = [
      // Layout and alignment props
      parentBoxFlow,
      boxFlow,

      // Style context dependencies
      styleCSSVars,
      pseudoClasses,
      pseudoElements,

      // Selectors
      visualSelector,
      pseudoStateSelector,

      preventInitialTransition,
    ];
    // The pseudo state goes into the deps as key/value entries and never as the
    // object itself: a control builds that object on every render, and its
    // identity in the deps would re-run the sync — listeners, observers, style
    // writes — on each of them, for a state that has not changed.
    let innerPseudoState;
    if (basePseudoState && pseudoState) {
      innerPseudoState = {};
      const baseStateKeys = Object.keys(basePseudoState);
      const pseudoStateKeySet = new Set(Object.keys(pseudoState));
      for (const key of baseStateKeys) {
        if (pseudoStateKeySet.has(key)) {
          pseudoStateKeySet.delete(key);
          const value = pseudoState[key];
          styleDeps.push(key, value);
          innerPseudoState[key] = value;
        } else {
          const value = basePseudoState[key];
          styleDeps.push(key, value);
          innerPseudoState[key] = value;
        }
      }
      for (const key of pseudoStateKeySet) {
        const value = pseudoState[key];
        styleDeps.push(key, value);
        innerPseudoState[key] = value;
      }
    } else if (basePseudoState) {
      innerPseudoState = basePseudoState;
      for (const key of Object.keys(basePseudoState)) {
        styleDeps.push(key, basePseudoState[key]);
      }
    } else if (pseudoState) {
      innerPseudoState = pseudoState;
      for (const key of Object.keys(pseudoState)) {
        styleDeps.push(key, pseudoState[key]);
      }
    } else {
      innerPseudoState = PSEUDO_STATE_DEFAULT;
    }
    const boxStyles = {};
    const styleContext = {
      parentBoxFlow,
      boxFlow,
      styleCSSVars,
      pseudoState: innerPseudoState,
      pseudoClasses,
      pseudoElements,
      remainingProps: rest,
      styles: boxStyles,
    };
    let boxPseudoNamedStyles = PSEUDO_NAMED_STYLES_DEFAULT;
    const canForwardToChild = hasChildUsingForwardedProps;

    const addStyle = (value, name, styleContext, stylesTarget) => {
      const mergedValue = prepareStyleValue(
        stylesTarget[name],
        value,
        name,
        styleContext,
      );
      const [cssVar] = readCSSVarEntry(styleContext.styleCSSVars[name]);
      if (cssVar) {
        addCSSVar(mergedValue, cssVar, stylesTarget);
        if (name === "borderRadius" && value === "inherit") {
          // "inherit" cannot be expressed via a CSS variable — a var() reference
          // never propagates the inherit keyword itself. So when borderRadius="inherit"
          // we must also set the inline style directly so the element actually
          // inherits the radius from its parent.
          styleDeps.push(name, value);
          stylesTarget[name] = mergedValue;
        }
        return true;
      }
      styleDeps.push(name, value); // impact box style -> add to deps
      stylesTarget[name] = mergedValue;
      return false;
    };
    const addCSSVar = (value, name, stylesTarget) => {
      styleDeps.push(name, value); // impact box style -> add to deps
      stylesTarget[name] = value;
    };
    const addStyleMaybeForwarding = (
      value,
      name,
      styleContext,
      stylesTarget,
      visualChildPropStrategy,
    ) => {
      if (!visualChildPropStrategy) {
        addStyle(value, name, styleContext, stylesTarget);
        return false;
      }
      const cssVar = styleCSSVars[name];
      if (cssVar) {
        // css var wins over visual child handling
        addStyle(value, name, styleContext, stylesTarget);
        return false;
      }
      if (visualChildPropStrategy === "copy") {
        // we stylyze ourself + forward prop to the child
        addStyle(value, name, styleContext, stylesTarget);
      }
      if (!canForwardToChild) {
        return false;
      }
      return true;
    };

    // By default ":hover", ":active" are not tracked.
    // But if code explicitely do something like:
    // style={{ ":hover": { backgroundColor: "red" } }}
    // then we'll track ":hover" state changes even for basic elements like <div>
    const pseudoClassesFromStyleSet = new Set();
    const visitProp = (
      value,
      name,
      styleContext,
      boxStylesTarget,
      styleOrigin,
    ) => {
      const isPseudoElement = name.startsWith("::");
      const isPseudoClass = name.startsWith(":");
      if (isPseudoElement || isPseudoClass) {
        styleDeps.push(name);
        pseudoClassesFromStyleSet.add(name);
        if (boxPseudoNamedStyles === PSEUDO_NAMED_STYLES_DEFAULT) {
          boxPseudoNamedStyles = {};
        }
        const pseudoStyleContext = {
          ...styleContext,
          styleCSSVars: {
            ...styleCSSVars,
            ...styleCSSVars[name],
          },
          pseudoName: name,
        };
        const pseudoStyleKeys = Object.keys(value);
        if (isPseudoElement) {
          const pseudoElementStyles = {};
          for (const key of pseudoStyleKeys) {
            visitProp(
              value[key],
              key,
              pseudoStyleContext,
              pseudoElementStyles,
              "pseudo_style",
            );
          }
          boxPseudoNamedStyles[name] = pseudoElementStyles;
          return;
        }
        const pseudoClassStyles = {};
        for (const key of pseudoStyleKeys) {
          visitProp(
            value[key],
            key,
            pseudoStyleContext,
            pseudoClassStyles,
            "pseudo_style",
          );
        }
        boxPseudoNamedStyles[name] = pseudoClassStyles;
        return;
      }

      if (styleOrigin === "style") {
        addStyle(value, name, styleContext, boxStylesTarget);
        return;
      }
      if (name.startsWith("--")) {
        addStyle(value, name, styleContext, boxStylesTarget);
        return;
      }
      const isPseudoStyle = styleOrigin === "pseudo_style";
      if (isStyleProp(name)) {
        // it's a style prop, we need first to check if we have css var to handle them
        // otherwise we decide to put it either on self or child
        const visualChildPropStrategy =
          visualSelector && getVisualChildStylePropStrategy(name);
        const getStyle = getHowToHandleStyleProp(name);
        if (
          // prop name === css style name
          !getStyle
        ) {
          const needForwarding = addStyleMaybeForwarding(
            value,
            name,
            styleContext,
            boxStylesTarget,
            visualChildPropStrategy,
          );
          if (needForwarding) {
            if (isPseudoStyle) {
              // le pseudo style est deja passé tel quel au child
            } else {
              childForwardedProps[name] = value;
            }
          }
          return;
        }
        const cssValues = getStyle(value, styleContext);
        if (!cssValues) {
          return;
        }
        let needForwarding = false;
        for (const styleName of Object.keys(cssValues)) {
          const cssValue = cssValues[styleName];
          needForwarding = addStyleMaybeForwarding(
            cssValue,
            styleName,
            styleContext,
            boxStylesTarget,
            visualChildPropStrategy,
          );
        }
        if (needForwarding) {
          if (isPseudoStyle) {
            // le pseudo style est deja passé tel quel au child
          } else {
            childForwardedProps[name] = value;
          }
        }
        return;
      }
      const cssVarEntry = styleCSSVars[name];
      if (cssVarEntry) {
        if (value !== undefined) {
          const [cssVarName, valueStyleName] = readCSSVarEntry(cssVarEntry);
          const cssValue = valueStyleName
            ? stringifyStyleValue(value, valueStyleName, styleContext)
            : value;
          if (isSizeSpacingKey(cssValue)) {
            // A size keyword reaching a custom property stays that word: every
            // declaration reading the variable is then invalid, drops back to
            // its initial value, and says nothing about it.
            console.warn(
              `"${name}" cannot take the size keyword "${cssValue}": it goes into ${cssVarName} as-is, which makes every declaration reading that variable invalid. Pass "${stringifySpacingStyle(cssValue)}" instead.`,
            );
          }
          addCSSVar(cssValue, cssVarName, boxStylesTarget);
        }
        return;
      }
      // not a style prop what do we do with it?
      // When pseudoStateSelector is set, the child element is the semantic/interactive one
      // When both selectors are set the child IS the component (e.g. Button with scale
      // transform) — forward everything so it behaves like a normal element.
      // When only pseudoStateSelector is set, the box keeps its own visual identity
      // (border, background, overflow…) and the child is just the interactive/semantic
      // element inside it. Only event handlers (onXxx) belong on that child; everything
      // else stays on the box.
      if (isPseudoStyle) {
        if (shouldForwardAllToChild) {
          // le pseudo style est deja passé tel quel au child
        } else {
          console.warn(`unsupported pseudo style key "${name}"`);
          selfForwardedProps[name] = value;
        }
      } else if (shouldForwardAllToChild) {
        childForwardedProps[name] = value;
      } else {
        selfForwardedProps[name] = value;
      }
      return;
    };

    for (const propName of Object.keys(rest)) {
      const propValue = rest[propName];
      if (baseChildPropSet?.has(propName) || childPropSet?.has(propName)) {
        if (canForwardToChild) {
          childForwardedProps[propName] = propValue;
        } else {
          selfForwardedProps[propName] = propValue;
        }
        continue;
      }
      const isDataAttribute = propName.startsWith("data-");
      if (isDataAttribute) {
        selfForwardedProps[propName] = propValue;
        continue;
      }
      // At some point I'd like to transform all data-* attribute in the DOM
      // into navi-* attribute so that when you look at the DOM you can easily understand which attributes
      // where added by navi or your code.
      // This help human to better scan the DOM
      const isNaviAttribute = propName.startsWith("navi-");
      if (isNaviAttribute) {
        selfForwardedProps[propName] = propValue;
        continue;
      }
      const isEventHandler = propName.startsWith("on");
      if (isEventHandler) {
        if (shouldForwardAllToChild) {
          childForwardedProps[propName] = propValue;
          continue;
        }
        selfForwardedProps[propName] = propValue;
        continue;
      }
      if (
        canForwardToChild &&
        pseudoStateSelector &&
        PSEUDO_STATE_CHILD_PROP_SET.has(propName)
      ) {
        childForwardedProps[propName] = propValue;
        continue;
      }
      visitProp(propValue, propName, styleContext, boxStyles, "prop");
    }
    if (typeof style === "string") {
      const styleObject = normalizeStyles(style, "css");
      for (const styleName of Object.keys(styleObject)) {
        const styleValue = styleObject[styleName];
        visitProp(styleValue, styleName, styleContext, boxStyles, "style");
      }
    } else if (style && typeof style === "object") {
      for (const styleName of Object.keys(style)) {
        const styleValue = style[styleName];
        visitProp(styleValue, styleName, styleContext, boxStyles, "style");
      }
    }

    let innerPseudoClasses;
    if (pseudoClassesFromStyleSet.size) {
      innerPseudoClasses = [...pseudoClasses];
      if (pseudoClasses !== PSEUDO_CLASSES_DEFAULT) {
        styleDeps.push(...pseudoClasses);
      }
      for (const key of pseudoClassesFromStyleSet) {
        innerPseudoClasses.push(key);
        styleDeps.push(key);
      }
    } else {
      innerPseudoClasses = pseudoClasses;
      if (pseudoClasses !== PSEUDO_CLASSES_DEFAULT) {
        styleDeps.push(...pseudoClasses);
      }
    }
    syncBox = (boxEl) => {
      const pseudoStateEl = pseudoStateSelector
        ? boxEl.querySelector(pseudoStateSelector)
        : boxEl;
      if (!pseudoStateEl) {
        console.error(
          `pseudoStateSelector "${pseudoStateSelector}" did not match any element inside the box`,
          boxEl,
        );
      }
      const visualEl = visualSelector
        ? boxEl.querySelector(visualSelector)
        : null;
      return initPseudoStyles(pseudoStateEl, {
        pseudoClasses: innerPseudoClasses,
        pseudoState: innerPseudoState,
        effect: (state) => {
          applyStyle(
            boxEl,
            boxStyles,
            state,
            boxPseudoNamedStyles,
            preventInitialTransition,
          );
        },
        elementToImpact: boxEl,
        elementListeningPseudoState:
          visualEl === pseudoStateEl ? null : visualEl,
      });
    };
  }
  const aspectRatio = rest.square || rest.circle ? "1/1" : rest.aspectRatio;
  return {
    TagName,
    boxFlow,
    boxFlowIsDefault,
    row,
    column,
    aspectRatio,
    visualSelector,
    innerClassName,
    selfForwardedProps,
    childForwardedProps,
    styleDeps,
    syncBox,
  };
};

export const applySeparatorOnChildren = (children, separator) => {
  const flattenedChildren = toChildArray(children);
  if (flattenedChildren.length <= 1) {
    return children;
  }
  const childrenWithSeparators = [];
  let i = 0;
  while (true) {
    const child = flattenedChildren[i];
    childrenWithSeparators.push(child);
    i++;
    const isLast = i === flattenedChildren.length;
    if (isLast) {
      break;
    }
    const nextChild = flattenedChildren[i];
    if (!shouldInjectSeparatorBetween(child, nextChild)) {
      continue;
    }
    // Support function separators that receive separator index
    const separatorElement =
      typeof separator === "function"
        ? separator(i - 1) // i-1 because i was incremented after pushing child
        : separator;
    childrenWithSeparators.push(separatorElement);
  }
  return childrenWithSeparators;
};
const shouldInjectSeparatorBetween = (left, right) => {
  if (isValidElement(left) && left.props?.hidden) {
    return false;
  }
  if (isValidElement(right) && right.props?.hidden) {
    return false;
  }
  return true;
};

const PADDING_PROP_SET = new Set([
  "padding",
  "paddingX",
  "paddingY",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
]);
/* What makes a box the frame at its spot: what it paints of its own, and the
   padding holding its content away from its corners. Deliberately without the
   radius props: a radius alone paints nothing — it only says how a background
   or a border already there is cut — so a box carrying just a radius is still
   a wrapper around whatever draws. */
const FRAME_PROP_SET = new Set([
  "background",
  "backgroundColor",
  "backgroundImage",
  "border",
  "borderTop",
  "borderRight",
  "borderBottom",
  "borderLeft",
  "borderWidth",
  "borderColor",
  "borderStyle",
  ...PADDING_PROP_SET,
]);
const declaresSomething = (value) => {
  if (value === undefined || value === null || value === false) {
    return false;
  }
  if (value === 0 || value === "0" || value === "none") {
    return false;
  }
  return true;
};
const isScrollingOverflow = (value) => value === "auto" || value === "scroll";

// Same props as far as computeBox is concerned. Handlers count by name only,
// see withCurrentHandlers; no style or state key starts with "on".
const arePropsEquivalent = (previousProps, props) =>
  compareTwoJsValues(previousProps, props, { keyComparator: comparePropAt });
const comparePropAt = (a, b, key, recurse) => {
  if (typeof key === "string" && key.startsWith("on")) {
    return true;
  }
  return recurse(a, b);
};
// The previous computation with this render's handlers: a handler goes where
// its name went the previous time, self or child, the split being decided by
// props that are the same. The forwarded objects keep their identity when no
// handler changed, so what reads them through context sees nothing new.
const withCurrentHandlers = (computed, props) => {
  let { selfForwardedProps, childForwardedProps } = computed;
  for (const key of Object.keys(props)) {
    if (!key.startsWith("on")) {
      continue;
    }
    const value = props[key];
    if (Object.hasOwn(childForwardedProps, key)) {
      if (childForwardedProps[key] !== value) {
        if (childForwardedProps === computed.childForwardedProps) {
          childForwardedProps = { ...childForwardedProps };
        }
        childForwardedProps[key] = value;
      }
    } else if (Object.hasOwn(selfForwardedProps, key)) {
      if (selfForwardedProps[key] !== value) {
        if (selfForwardedProps === computed.selfForwardedProps) {
          selfForwardedProps = { ...selfForwardedProps };
        }
        selfForwardedProps[key] = value;
      }
    }
  }
  if (
    selfForwardedProps === computed.selfForwardedProps &&
    childForwardedProps === computed.childForwardedProps
  ) {
    return computed;
  }
  return { ...computed, selfForwardedProps, childForwardedProps };
};
