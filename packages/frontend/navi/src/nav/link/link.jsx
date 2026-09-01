import { useContext, useLayoutEffect, useRef } from "preact/hooks";

import { PSEUDO_CLASSES } from "../../box/pseudo_styles.js";
import { triggerNaviCommand } from "../../control/commands.js";
import { useControlProps } from "../../control/control_hooks.jsx";
import {
  SelectionContext,
  useSelectableElement,
} from "../../control/selection/selection.jsx";
import { EmailSvg } from "../../graphic/icons/email_svg.jsx";
import {
  LinkBlankTargetSvg,
  LinkGithubSvg,
  LinkSmsSvg,
  ArrowTurnRightDownSvg,
} from "../../graphic/icons/link_svgs.jsx";
import { PhoneSvg } from "../../graphic/icons/phone_svg.jsx";
import { LoadingOutline } from "../../graphic/loading/loading_outline.jsx";
import { Icon, markAsOutsideTextFlow, Text } from "../../text/text.jsx";
import { useDocumentUrl } from "../browser_integration/document_url_signal.js";
import { getHrefTargetInfo } from "../browser_integration/href_target_info.js";
import { LINK_REPLACE_ATTRIBUTE } from "../browser_integration/link_replace.js";
import { useIsVisited } from "../browser_integration/use_is_visited.js";
import { BinderItemContext } from "../binder/binder_context.js";
import { NavContext } from "./nav_context.js";
import { assertRoute, useRouteStatus } from "../route.js";
import { useDimColorWhen } from "./use_dim_color.js";

/*
 * Apply opacity to child content, not the link element itself.
 *
 * Why not apply opacity directly to .navi_link?
 * - Would make focus outlines semi-transparent too (accessibility issue)
 * - We want dimmed text but full-opacity focus indicators for visibility
 *
 * This approach dims the content while preserving focus outline visibility.
 */
const css = /* css */ `
  @layer navi {
    .navi_link {
      --link-border-radius: unset;
      --link-outline-color: var(--navi-focus-outline-color);
      --link-loader-color: var(--navi-loader-color);
      --link-background: unset;
      --link-background-current: unset;
      --link-background-selected: light-dark(#bbdefb, #2563eb);
      --link-color: var(--navi-link-color);
      --link-color-visited: var(
        --navi-link-color-visited,
        color-mix(in srgb, var(--link-color), black 40%)
      );

      --link-color-pressed: var(--navi-link-color-pressed);
      --link-text-decoration: underline;
      --link-text-decoration-hover: var(--link-text-decoration);
      --link-cursor: pointer;
      --link-outline-width: 2px;

      --link-current-indicator-size: 2px;
      --link-current-indicator-spacing: 0;
      --link-current-indicator-color: var(--navi-link-current-indicator-color);
    }
  }

  .navi_link {
    --x-link-contrasting-color: black;

    --x-link-background: var(--link-background-color, var(--link-background));
    --x-link-background-hover: var(
      --link-background-color-hover,
      var(--link-background-color, var(--link-background-hover))
    );
    --x-link-background-selected: var(
      --link-background-color-selected,
      var(--link-background-selected)
    );
    --x-link-background-current: var(
      --link-background-color-current,
      var(
        --link-background-current,
        var(--link-background-color, var(--link-background))
      )
    );
    --x-link-color: var(--link-color);
    --x-link-color-hover: var(--link-color-hover, var(--link-color));
    --x-link-color-visited: var(--link-color-visited);
    --x-link-color-current: var(--link-color-current);
    --x-link-color-pressed: var(--link-color-pressed);
    --x-link-text-decoration: var(--link-text-decoration);
    --x-link-text-decoration-hover: var(--link-text-decoration-hover);
    --x-link-cursor: var(--link-cursor);

    /* Resolve padding shorthands into directional vars */
    --x-link-padding-top: var(
      --link-padding-top,
      var(--link-padding-y, var(--link-padding, 0px))
    );
    --x-link-padding-right: var(
      --link-padding-right,
      var(--link-padding-x, var(--link-padding, 0px))
    );
    --x-link-padding-bottom: var(
      --link-padding-bottom,
      var(--link-padding-y, var(--link-padding, 0px))
    );
    --x-link-padding-left: var(
      --link-padding-left,
      var(--link-padding-x, var(--link-padding, 0px))
    );

    position: relative;
    aspect-ratio: inherit;
    padding-top: var(--x-link-padding-top);
    padding-right: var(--x-link-padding-right);
    padding-bottom: var(--x-link-padding-bottom);
    padding-left: var(--x-link-padding-left);
    color: var(--x-link-color);
    text-decoration: var(--x-link-text-decoration);
    background: var(--x-link-background);
    border-radius: var(--link-border-radius);
    outline-width: 0;
    outline-style: solid;
    outline-color: var(--link-outline-color);
    cursor: var(--x-link-cursor);

    .navi_current_indicator {
      position: absolute;
      z-index: 1;
      display: flex;
      background: transparent;
      border-radius: 0.1px;
    }
    &[data-current-indicator-position="top"] {
      margin-top: var(--link-current-indicator-spacing);

      .navi_current_indicator {
        top: 0;
        left: 0;
        width: 100%;
        height: var(--link-current-indicator-size);
      }
    }
    &[data-current-indicator-position="bottom"] {
      margin-bottom: var(--link-current-indicator-spacing);

      .navi_current_indicator {
        bottom: 0;
        left: 0;
        width: 100%;
        height: var(--link-current-indicator-size);
      }
    }
    &[data-current-indicator-position="left"] {
      margin-left: var(--link-current-indicator-spacing);

      .navi_current_indicator {
        top: 0;
        left: 0;
        width: var(--link-current-indicator-size);
        height: 100%;
      }
    }
    &[data-current-indicator-position="right"] {
      margin-right: var(--link-current-indicator-spacing);

      .navi_current_indicator {
        top: 0;
        right: 0;
        width: var(--link-current-indicator-size);
        height: 100%;
      }
    }

    [data-icon-text] {
      display: inline-block; /* Allow to skip the underlining */
    }

    /* Interactive */
    &[data-interactive] {
      cursor: pointer;
    }
    /* Visited */
    &[data-visited] {
      --x-link-color: var(--x-link-color-visited);
      &[data-anchor] {
        /* Visited is meant to help user see what links he already seen / what remains to discover */
        /* But anchor links are already in the area user is currently seeing */
        /* No need for a special color for visited anchors */
        --x-link-color: var(--link-color);
      }
    }
    &[data-anchor] {
      /* Usually better to have some spacing between the anchor and the scroll top */
      scroll-margin-block: calc(1em + var(--link-outline-width) + 1px);
    }
    /* Hover */
    &[data-hover] {
      --x-link-background: var(--x-link-background-hover);
      --x-link-color: var(--x-link-color-hover);
      --x-link-text-decoration: var(--x-link-text-decoration-hover);
    }
    &[data-focus-visible] {
      outline-width: var(--link-outline-width);
    }
    /* Pressed */
    &[data-pressed] {
      /* Redefine it otherwise [data-visited] prevails */
      --x-link-color: var(--x-link-color-pressed);
    }
    /* Current */
    &[data-href-current] {
      --x-link-color: var(--link-color-current);
      --x-link-cursor: default;
      --x-link-background: var(--x-link-background-current);

      &[data-anchor] {
        /* For anchor links, we want to keep the pointer cursor to indicate interactivity */
        /* as anchor link will still scroll to the section even if it's the current page */
        --x-link-cursor: pointer;
        --x-link-color: var(--link-color-current); /* override visited */
      }
      &[data-current-effect-bold] {
        font-weight: bold;
      }
      .navi_current_indicator {
        background: var(--link-current-indicator-color);
      }
    }
    /* Selected */
    &[aria-selected] {
      position: relative;

      input[type="checkbox"] {
        position: absolute;
        opacity: 0;
      }
    }
    &[data-selected] {
      --x-link-background: var(--x-link-background-selected);
      --x-link-color: var(--link-color-selected);
    }
    /* Focus */
    &[data-focus],
    &[data-focus-visible] {
      position: relative;
      z-index: 1; /* Ensure focus outline is above other elements */
    }
    /* Readonly */
    &[data-readonly] > * {
      opacity: 0.5;
    }
    /* Disabled */
    &[data-disabled] {
      pointer-events: none;
    }
    &[data-disabled] > * {
      opacity: 0.5;
    }
    /* Reveal on interaction */
    &[data-reveal-on-interaction] {
      --anchor-spacing: 0px; /* outline width + 1px */

      display: inline-flex;
      width: round(1em, 1px);
      height: round(1em, 1px);
      /* height: 1lh; */
      margin-right: var(--anchor-spacing);
      margin-left: round(calc(-1 * calc(1em + var(--anchor-spacing))), 1px);
      align-items: center;
      justify-content: center;
      font-size: 1em;
      text-decoration: none;
      opacity: 0;
      /* The anchor link is displayed only on :hover */
      /* So we "need" a visual indicator when it's shown by focus */
      /* (even if it's focused by mouse aka not :focus-visible) */
      /* otherwise we might wonder why we see this UI element */
      &[data-focus] {
        outline-width: 2px;
      }
      &[data-hover],
      &[data-focus],
      &[data-focus-visible] {
        opacity: 1;
      }
    }

    .anchor_icon {
      margin-left: -0.1em;
    }

    &[data-variant="text"] {
      --link-color: unset;
      --link-text-decoration: none;
    }
    &[data-variant="icon"] {
      --link-color: unset;
      --link-text-decoration: none;
    }
    &[data-variant="tab"] {
      --link-background-hover: color-mix(
        in srgb,
        var(--link-background, transparent),
        var(--x-link-contrasting-color) 15%
      );
      --link-color: unset;
      --link-text-decoration: none;
      white-space: nowrap;
      user-select: none;

      &[data-current-effect-shadow][data-href-current] {
        --x-link-box-shadow-size: 0.1em;
        --x-link-box-shadow-halo: 0.3em;
        --x-link-shadow-color: color-mix(
          in srgb,
          var(--x-link-contrasting-color) 40%,
          transparent
        );

        box-shadow:
          inset 0 var(--x-link-box-shadow-size) var(--x-link-box-shadow-halo)
            var(--x-link-shadow-color),
          inset 0 calc(-1 * var(--x-link-box-shadow-size))
            var(--x-link-box-shadow-halo) var(--x-link-shadow-color),
          inset var(--x-link-box-shadow-size) 0 var(--x-link-box-shadow-halo)
            var(--x-link-shadow-color),
          inset calc(-1 * var(--x-link-box-shadow-size)) 0
            var(--x-link-box-shadow-halo) var(--x-link-shadow-color);
      }
    }
  }

  *:hover > .navi_link[data-reveal-on-interaction] {
    opacity: 1;
  }
`;

const LinkStyleCSSVars = {
  "outlineColor": "--link-outline-color",
  "borderRadius": "--link-border-radius",
  "padding": "--link-padding",
  "paddingX": "--link-padding-x",
  "paddingY": "--link-padding-y",
  "paddingTop": "--link-padding-top",
  "paddingRight": "--link-padding-right",
  "paddingBottom": "--link-padding-bottom",
  "paddingLeft": "--link-padding-left",
  "color": "--link-color",
  "cursor": "--link-cursor",
  "textDecoration": "--link-text-decoration",
  "background": "--link-background",
  "backgroundColor": "--link-background-color",
  ":hover": {
    background: "--link-background-hover",
    backgroundColor: "--link-background-color-hover",
    color: "--link-color-hover",
    textDecoration: "--link-text-decoration-hover",
  },
  ":-navi-pressed": {
    color: "--link-color-pressed",
  },
  ":-navi-href-current": {
    background: "--link-background-current",
    backgroundColor: "--link-background-color-current",
    color: "--link-color-current",
  },
  ":-navi-selected": {
    background: "--link-background-selected",
    backgroundColor: "--link-background-color-selected",
    color: "--link-color-selected",
  },
};
// A link placed inside a binder tab tells that tab whether it is the current
// one. The binder cannot know: which page an url opens is the link's business,
// and it is settled before the binder renders anything.
const useReportCurrentToBinderItem = (current) => {
  const reportCurrent = useContext(BinderItemContext);
  useLayoutEffect(() => {
    if (!reportCurrent) {
      return undefined;
    }
    reportCurrent(current);
    return () => {
      reportCurrent(false);
    };
  }, [reportCurrent, current]);
};

const LinkPseudoClasses = [
  ":hover",
  ":active",
  ":-navi-pressed",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":visited",
  ":-navi-loading",
  ":-navi-href-internal",
  ":-navi-href-external",
  ":-navi-href-anchor",
  ":-navi-href-current",
  ":-navi-selected",
];
const LinkPseudoElements = ["::-navi-loader", "::-navi-indicator"];

Object.assign(PSEUDO_CLASSES, {
  ":-navi-href-internal": {
    attribute: "data-href-internal",
  },
  ":-navi-href-external": {
    attribute: "data-href-external",
  },
  ":-navi-href-anchor": {
    attribute: "data-href-anchor",
  },
});

/**
 * An anchor (`<a>`) rendered as a navi control: it carries the full control
 * facade (name/value, pseudo-state, disabled/readOnly/loading, selection when
 * inside a `SelectionContext`) on top of the native link behavior, plus
 * navi-specific styling hooks and href-derived state.
 *
 * Href-derived behavior (all computed from `href`, recomputed on navigation):
 * - internal vs external target (`data-href-internal`/`data-href-external`),
 *   with `target`/`rel` auto-defaulted (`_self` internal, `_blank` +
 *   `noopener noreferrer` external) unless explicitly set.
 * - "current page" detection (`data-href-current`, `aria-current="page"`).
 * - anchor links (`href` starting with `#`) get `data-href-anchor`.
 * - an automatic end icon for `tel:`/`sms:`/`mailto:`/`github.com`, external
 *   (blank-target) links, and anchor links — each overridable/suppressible.
 *
 * @param {object} props
 * @param {string} [props.href] - Destination. Also the default `value`, and
 *   (when `hrefFallback`) the default visible text.
 * @param {import("../route.js").Route} [props.route] - Renders via `route`
 *   instead of a raw `href`: the URL is built from the route (see
 *   `routeParams`) and "current" is derived from whether the route matches.
 * @param {object} [props.routeParams] - Params passed to `route.buildUrl`.
 * @param {string} [props.slide] - Makes this a tab for a slide rather than for
 *   a URL: the area of a `<SlideContainer>` it goes to. The container is the one
 *   the surrounding `<Nav slideContainer={id}>` names, and it is also what says
 *   whether this tab is the current one. Nothing is written to the URL — these
 *   are places within one screen, not pages of their own — so there is no href
 *   and the tab behaves like a button.
 * @param {string} [props.target] - Native anchor target; defaults from
 *   internal/external detection when omitted.
 * @param {string} [props.rel] - Native anchor rel; defaults to
 *   `"noopener noreferrer"` for external links when omitted.
 * @param {boolean} [props.anchor] - Marks this as an in-page anchor link:
 *   sets `data-anchor`, derives `id` from `href` (the part after `#`) when no
 *   `id` is given, drops the visited color, keeps a pointer cursor even when
 *   current, and defaults `hrefFallback` to `false` (no auto text). With no
 *   children it shows the anchor icon; give it children (e.g. `"#"`) to render
 *   those instead.
 * @param {string} [props.value] - Value emitted by the control facade
 *   (`navi_value`); defaults to `href`.
 * @param {boolean} [props.current] - Forces the "current" state on (otherwise
 *   derived from the href/route).
 * @param {"text"|"icon"|"tab"} [props.variant] - Visual variant
 *   (`data-variant`); `"text"`/`"icon"` drop the link color/underline,
 *   `"tab"` renders a tab-like affordance.
 * @param {boolean|"top"|"bottom"|"left"|"right"} [props.currentIndicator] - A
 *   bar drawn on the given edge (or bottom when `true`) while current.
 * @param {boolean} [props.currentEffectBold] - Bold the text while current
 *   (reserving the bold width so layout doesn't shift).
 * @param {boolean} [props.currentEffectShadow] - Inset-shadow effect while
 *   current (used with `variant="tab"`).
 * @param {boolean|import("preact").ComponentChild} [props.startIcon] - Icon
 *   placed before the text.
 * @param {boolean|import("preact").ComponentChild} [props.endIcon] - Icon
 *   placed after the text; when omitted, an icon may be auto-chosen from the
 *   href (see above).
 * @param {boolean|import("preact").ComponentChild} [props.blankTargetIcon] -
 *   Override/suppress the auto external-link icon.
 * @param {boolean|import("preact").ComponentChild} [props.anchorIcon] -
 *   Controls the auto anchor icon shown for a childless anchor link:
 *   `true`/`undefined` uses the default chain SVG, `false` suppresses it, any
 *   other node replaces it. To render a plain `#` instead, prefer writing it as
 *   the link's children (`<Link anchor href="#x">#</Link>`).
 * @param {boolean} [props.revealOnInteraction] - Hide the link until its
 *   container is hovered/focused (`data-reveal-on-interaction`), floating it
 *   out of flow — the "#" anchor-on-hover pattern (e.g. inside a `Title`).
 * @param {boolean} [props.hrefFallback] - Use `href` as the visible text when
 *   no children are given; defaults to `true` unless `anchor`.
 * @param {string|{type?: string, duration?: number|string, direction?: "forward"|"back"}} [props.routeTransition] -
 *   What pressing THIS link asks of a route transition, for that one
 *   navigation: a type name (`"slide-x"`, `"none"`, …), or an object to also
 *   say the pace or which way it plays. It overrides field by field what
 *   `defineRouteTransition` wrote for the pair — `{ direction: "back" }` keeps
 *   the pair's movement and only turns it round, which is what the rare way
 *   round a pair usually needs. Said nowhere else, the relations answer as
 *   they always do.
 * @param {boolean} [props.replace] - Go to the destination by TAKING THE PLACE
 *   of the current history entry instead of stacking onto it: the link stays a
 *   link (an address, a middle click, the keyboard, `aria-current`), only the
 *   way there changes. What a row of tabs wants — the neighbour is a lateral
 *   move, not a step deeper, so the whole row weighs one entry and the back
 *   button leaves by where the reader came in.
 * @param {string} [props.command] - What the press asks of a control around
 *   the link — `"--navi-close"` on a link that leaves the sheet it is in.
 *   Triggered on the press, before the navigation.
 * @param {Function} [props.action] - Work the press runs, before the
 *   navigation. Nothing waits for it — not the navigation, not `command`: what
 *   the next page must find has to be written synchronously (a draft in a
 *   signal), and a request goes on its own while the page changes. Work that
 *   decides the destination navigates itself, from a `<Button action>`.
 * @param {boolean} [props.preventDefault] - Call `event.preventDefault()` on
 *   click (navigation suppressed; `onClick` still runs).
 * @param {(event: MouseEvent) => void} [props.onClick]
 * @param {import("preact").ComponentChildren} [props.children] - Link content;
 *   falls back to the route's relative URL / `href` per the rules above.
 * @param {string} [props.name] - Control facade name (links may be nameless).
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.readOnly]
 */
export const Link = (props) => {
  import.meta.css = css;

  if (props.route) {
    return <LinkWithRoute {...props} />;
  }
  return <LinkPlain {...props} />;
};
const LinkWithRoute = ({ route, routeParams, current, children, ...rest }) => {
  if (import.meta.dev) {
    assertRoute(route);
  }
  const url = route.buildUrl(routeParams);
  const { matching } = useRouteStatus(route);
  const paramsAreMatching = route.matchesParams(routeParams);
  const linkMatching = matching && paramsAreMatching;
  const innerCurrent = current || linkMatching;

  return (
    <Link href={url} current={innerCurrent} {...rest}>
      {children || route.buildRelativeUrl(routeParams)}
    </Link>
  );
};

const LinkPlain = (props) => {
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  const {
    href,
    target,
    rel,
    anchor,
    slide,
    value = href,

    // visual
    variant,
    current,
    currentIndicator,
    currentEffectBold,
    currentEffectShadow,
    blankTargetIcon,
    anchorIcon,
    startIcon,
    endIcon,
    revealOnInteraction = false,
    hrefFallback = !anchor,
    routeTransition,
    replace,

    children,
  } = props;
  if (anchor && !props.id) {
    props.id = href.slice(1);
  }

  const selectionContext = useContext(SelectionContext);
  const nav = useContext(NavContext);
  const visited = useIsVisited(href);
  const { selection, selectionController } = selectionContext || {};
  const { selected } = useSelectableElement(props.ref, {
    selection,
    selectionController,
  });

  const [controlRootProps, controlHostProps] = useControlProps(props, {
    controlType: "link",
  });
  const { basePseudoState } = controlHostProps;
  const readOnly = basePseudoState[":read-only"];
  const disabled = basePseudoState[":disabled"];
  const loading = basePseudoState[":-navi-loading"];
  const shouldDimColor = readOnly || disabled;
  useDimColorWhen(props.ref, shouldDimColor);
  // subscribe to document url to re-render and re-compute getHrefTargetInfo
  useDocumentUrl();
  const { isSameSite, isAnchor, isCurrent } = getHrefTargetInfo(href);
  // A tab that is a SLIDE is current when the container is on it — which the
  // <Nav> around reads off that container, so nothing here has to be told.
  const innerCurrent =
    current || (slide ? nav?.currentSlideArea === slide : isCurrent);
  useReportCurrentToBinderItem(innerCurrent);
  controlHostProps.basePseudoState = {
    ...basePseudoState,
    ":visited": visited,
    ":-navi-href-internal": isSameSite,
    ":-navi-href-external": !isSameSite,
    ":-navi-href-anchor": isAnchor,
    ":-navi-href-current": innerCurrent,
    ":-navi-selected": selected,
  };

  const innerTarget =
    target === undefined ? (isSameSite ? "_self" : "_blank") : target;
  const innerRel =
    rel === undefined ? (isSameSite ? undefined : "noopener noreferrer") : rel;

  let innerEndIcon;
  if (endIcon === undefined) {
    // Check for special protocol or domain-specific icons first
    if (href?.startsWith("tel:")) {
      innerEndIcon = (
        <Icon>
          <PhoneSvg />
        </Icon>
      );
    } else if (href?.startsWith("sms:")) {
      innerEndIcon = (
        <Icon>
          <LinkSmsSvg />
        </Icon>
      );
    } else if (href?.startsWith("mailto:")) {
      innerEndIcon = (
        <Icon>
          <EmailSvg />
        </Icon>
      );
    } else if (href?.includes("github.com")) {
      innerEndIcon = (
        <Icon>
          <LinkGithubSvg />{" "}
        </Icon>
      );
    }
    // Fall back to default icon logic
    else if (innerTarget === "_blank") {
      if (blankTargetIcon === undefined) {
        innerEndIcon = (
          <Icon>
            <LinkBlankTargetSvg />{" "}
          </Icon>
        );
      } else {
        innerEndIcon = blankTargetIcon;
      }
    } else if (isAnchor) {
      if (anchorIcon === undefined) {
        if (anchor) {
          if (children) {
            // keep innerEndIcon unset, we got children
          } else {
            innerEndIcon = <Icon>#</Icon>;
          }
        } else {
          innerEndIcon = (
            <Icon className="anchor_icon" textAnchor="char-bottom" size="xs">
              <ArrowTurnRightDownSvg />
            </Icon>
          );
        }
      } else {
        innerEndIcon = anchorIcon;
      }
    } else {
      innerEndIcon = anchorIcon;
    }
  } else {
    innerEndIcon = endIcon;
  }

  // What this link asks of a route transition, worn as an attribute so that
  // the navigation reads it off the element being pressed (see
  // route_transition.jsx, which owns the name and does the reading). A type is
  // a name; anything more travels as JSON, which is also how a plain <a>
  // writes it by hand.
  const routeTransitionRequest =
    routeTransition === undefined || routeTransition === null
      ? undefined
      : typeof routeTransition === "string"
        ? routeTransition
        : JSON.stringify(routeTransition);

  // Which way this link goes to the place it aims at, worn as an attribute so
  // that whoever answers the press reads it off the anchor (see
  // link_replace.js, which owns the name and does the reading).
  const replaceRequest = replace ? { [LINK_REPLACE_ATTRIBUTE]: "" } : null;

  const innerChildren = children || (hrefFallback ? href : children);
  const startIconEl = startIcon;
  const endIconEl = innerEndIcon;

  // Where the bar goes: said here, or once for the whole row by the <Nav>
  // around this link.
  const currentIndicatorAsked = currentIndicator ?? nav?.currentIndicator;
  const currentIndicatorPosition =
    currentIndicatorAsked === true ? "bottom" : currentIndicatorAsked;
  const currentIndicatorEl =
    currentIndicatorPosition === "left" ||
    currentIndicatorPosition === "right" ||
    currentIndicatorPosition === "top" ||
    currentIndicatorPosition === "bottom" ? (
      <LinkCurrentIndicator />
    ) : null;

  const { onClick, preventDefault } = props;
  // Travelling there is the container's business, said as the command anything
  // else in the page would say it with: the tab knows the name of a slide and
  // the id of the box, and nothing more about either.
  const goToSlide = (element, event) => {
    triggerNaviCommand(element, `--navi-go-to-slide:${slide}`, event);
  };

  return (
    <Text
      as="a"
      color={anchor && !innerChildren ? "inherit" : undefined}
      {...controlRootProps}
      {...controlHostProps}
      // Everything this component reads for itself is taken off the way out:
      // what is left goes on the element, and a prop that means something here
      // means nothing to an <a>. Written one by one rather than pulled out of
      // props with a rest, because props is also what the control layer above
      // was handed.
      preventDefault={undefined}
      anchor={undefined}
      slide={undefined}
      revealOnInteraction={undefined}
      variant={undefined}
      current={undefined}
      currentIndicator={undefined}
      currentEffectBold={undefined}
      currentEffectShadow={undefined}
      blankTargetIcon={undefined}
      anchorIcon={undefined}
      startIcon={undefined}
      endIcon={undefined}
      hrefFallback={undefined}
      routeTransition={undefined}
      replace={undefined}
      data-navi-route-transition-request={routeTransitionRequest}
      {...replaceRequest}
      // The control's own handlers first — the interaction gate, the caller's
      // onClick/onKeyDown, the command and the action — then what only a link
      // does. Written over the spread above, so they have to be called here.
      onClick={(e) => {
        controlHostProps.onClick(e);
        if (slide && !e.defaultPrevented) {
          goToSlide(e.currentTarget, e);
        }
        if (preventDefault) {
          e.preventDefault();
        }
      }}
      // A tab with no href is not a link the browser knows how to press: it is
      // focusable because it says so (tabIndex below) and it answers the two
      // keys a button answers, since that is what it behaves like.
      onKeyDown={(e) => {
        controlHostProps.onKeyDown(e);
        if (!slide || e.defaultPrevented) {
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToSlide(e.currentTarget, e);
        }
      }}
      href={href}
      rel={innerRel}
      target={innerTarget === "_self" ? undefined : target}
      // Which slide this tab is, and which box to say it to: read by the <Nav>
      // around it to place the row's own bar, and by the command above to find
      // the container across the document.
      data-slide-target={slide}
      commandfor={slide ? nav?.slideContainer : undefined}
      aria-controls={slide ? nav?.slideContainer : undefined}
      tabIndex={slide ? (props.tabIndex ?? 0) : props.tabIndex}
      role={slide ? "tab" : props.role}
      aria-current={isCurrent ? "page" : undefined}
      aria-selected={
        slide ? innerCurrent : selectionContext ? selected : undefined
      }
      data-value-event="navi_value"
      onnavi_value={(e) => {
        e.detail.setValue(value);
      }}
      holdSpaceForStyle={currentEffectBold ? { fontWeight: "bold" } : undefined}
      preventSpaceUnderlines
      // A trailing icon (the anchor arrow, the blank-target one) belongs to the
      // text it follows: without this the browser may break the line right
      // before it and leave it alone under a link long enough to wrap.
      attachLastChild={Boolean(endIconEl)}
      // Visual
      data-variant={variant}
      data-current-effect-bold={currentEffectBold ? "" : undefined}
      data-current-effect-shadow={currentEffectShadow ? "" : undefined}
      data-current-indicator-position={currentIndicatorPosition}
      data-anchor={anchor ? "" : undefined}
      data-interactive={
        onClick || props.command || props.action ? "" : undefined
      }
      data-reveal-on-interaction={revealOnInteraction ? "" : undefined}
      baseClassName="navi_link"
      styleCSSVars={LinkStyleCSSVars}
      pseudoClasses={LinkPseudoClasses}
      pseudoElements={LinkPseudoElements}
      childrenOutsideFlow={
        <>
          <LoadingOutline
            loading={loading}
            inset={1}
            color="var(--link-loader-color)"
          />
          {currentIndicatorEl}
        </>
      }
    >
      {startIconEl}
      {innerChildren}
      {endIconEl}
    </Text>
  );
};

// Named by the <Nav> around the link when the link is current, from its CSS:
// that is what makes the bar glide from one tab to the next (see nav.jsx).
const LinkCurrentIndicator = () => {
  return <span className="navi_current_indicator" />;
};
markAsOutsideTextFlow(LinkCurrentIndicator);
