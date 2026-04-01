/* eslint-disable jsenv/no-unknown-params */

import { useContext, useRef } from "preact/hooks";

import { renderActionableComponent } from "../../action/render_actionable_component.jsx";
import { PSEUDO_CLASSES } from "../../box/pseudo_styles.js";
import {
  SelectionContext,
  useSelectableElement,
} from "../../field/selection/selection.jsx";
import { useRequestedActionStatus } from "../../field/use_action_events.js";
import { useAutoFocus } from "../../field/use_auto_focus.js";
import { closeValidationMessage } from "../../field/validation/custom_constraint_validation.js";
import { useConstraints } from "../../field/validation/hooks/use_constraints.js";
import { Icon } from "../../graphic/icon.jsx";
import { EmailSvg } from "../../graphic/icons/email_svg.jsx";
import {
  LinkAnchorSvg,
  LinkBlankTargetSvg,
  LinkGithubSvg,
  LinkSmsSvg,
} from "../../graphic/icons/link_svgs.jsx";
import { PhoneSvg } from "../../graphic/icons/phone_svg.jsx";
import { LoaderBackground } from "../../graphic/loader/loader_background.jsx";
import { useKeyboardShortcuts } from "../../keyboard/keyboard_shortcuts.js";
import { markAsOutsideTextFlow, Text } from "../../text/text.jsx";
import { TitleLevelContext } from "../../text/title.jsx";
import { useDarkBackgroundAttribute } from "../../text/use_dark_background_attribute.js";
import { useDocumentUrl } from "../browser_integration/document_url_signal.js";
import { getHrefTargetInfo } from "../browser_integration/href_target_info.js";
import { useIsVisited } from "../browser_integration/use_is_visited.js";
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
import.meta.css = /* css */ `
  @layer navi {
    .navi_link {
      --link-border-radius: unset;
      --link-outline-color: var(--navi-focus-outline-color);
      --link-loader-color: var(--navi-loader-color);
      --link-background: unset;
      --link-background-current: unset;
      --link-background-selected: light-dark(#bbdefb, #2563eb);
      --link-color: rgb(0, 0, 238);
      --link-color-visited: color-mix(in srgb, var(--link-color), black 40%);

      --link-color-active: red;
      --link-text-decoration: underline;
      --link-text-decoration-hover: var(--link-text-decoration);
      --link-cursor: pointer;
      --link-loading-outline-size: 1px;

      --link-current-indicator-size: 2px;
      --link-current-indicator-spacing: 0;
      --link-current-indicator-color: rgb(205, 52, 37);
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
    --x-link-color-active: var(--link-color-active);
    --x-link-text-decoration: var(--link-text-decoration);
    --x-link-text-decoration-hover: var(--link-text-decoration-hover);
    --x-link-cursor: var(--link-cursor);

    position: relative;
    aspect-ratio: inherit;
    /* Ensure the spacing for the loading outline is part of the <a> so that it does not create an overflow */
    padding: var(--link-loading-outline-size);
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

    &[data-dark-background] {
      --x-link-contrasting-color: white;
      --x-link-color: var(--link-color, white);
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
    /* Hover */
    &[data-hover] {
      --x-link-background: var(--x-link-background-hover);
      --x-link-color: var(--x-link-color-hover);
      --x-link-text-decoration: var(--x-link-text-decoration-hover);
    }
    &[data-focus-visible] {
      outline-width: 2px;
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
    /* Active */
    &[data-active] {
      /* Redefine it otherwise [data-visited] prevails */
      --x-link-color: var(--x-link-color-active);
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
      }
      &[data-current-effect-bold] {
        font-weight: bold;
      }
      .navi_current_indicator {
        background: var(--link-current-indicator-color);
      }
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
      position: absolute !important;
      top: 0;
      left: -1em;
      display: inline-flex;
      width: 1em;
      height: 1em;
      font-size: 1em;
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

      .navi_icon {
        vertical-align: top;
      }
    }

    &[data-appearance="text"] {
      --link-color: unset;
      --link-text-decoration: none;
    }
    &[data-appearance="icon"] {
      --link-color: unset;
      --link-text-decoration: none;
    }
    &[data-appearance="tab"] {
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
  .navi_text .navi_link[data-reveal-on-interaction] {
    top: 0.1em;
  }
  .navi_title .navi_link[data-reveal-on-interaction] {
    top: 0.25em;
  }
`;

const LinkStyleCSSVars = {
  "outlineColor": "--link-outline-color",
  "borderRadius": "--link-border-radius",
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
  ":active": {
    color: "--link-color-active",
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
const LinkPseudoClasses = [
  ":hover",
  ":active",
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
  ":-navi-href-current": {
    attribute: "data-href-current",
  },
  ":-navi-selected": {
    attribute: "data-selected",
  },
});

export const Link = (props) => {
  return renderActionableComponent(props, {
    Basic: LinkBasic,
    WithAction: LinkWithAction,
  });
};
const LinkBasic = (props) => {
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
    <LinkBasic href={url} current={innerCurrent} {...rest}>
      {children || route.buildRelativeUrl(routeParams)}
    </LinkBasic>
  );
};

const LinkPlain = (props) => {
  const titleLevel = useContext(TitleLevelContext);
  const selectionContext = useContext(SelectionContext);
  const {
    loading,
    readOnly,
    disabled,
    autoFocus,
    spaceToClick = true,
    onClick,
    onKeyDown,
    href,
    target,
    rel,
    preventDefault,
    anchor,
    value = href,

    // visual
    appearance,
    current,
    currentIndicator,
    currentEffectBold,
    currentEffectShadow,
    blankTargetIcon,
    anchorIcon,
    startIcon,
    endIcon,
    revealOnInteraction = Boolean(titleLevel),
    hrefFallback = !anchor,
    overflowEllipsis,

    children,

    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const visited = useIsVisited(href);

  const { selection, selectionController } = selectionContext || {};
  const { selected } = useSelectableElement(ref, {
    selection,
    selectionController,
  });

  useAutoFocus(ref, autoFocus);
  const remainingProps = useConstraints(ref, rest);
  const shouldDimColor = readOnly || disabled;
  useDimColorWhen(ref, shouldDimColor);
  // subscribe to document url to re-render and re-compute getHrefTargetInfo
  useDocumentUrl();
  const { isSameSite, isAnchor, isCurrent } = getHrefTargetInfo(href);
  const innerCurrent = current || isCurrent;
  useDarkBackgroundAttribute(ref, [selected, innerCurrent], {});

  const innerTarget =
    target === undefined ? (isSameSite ? "_self" : "_blank") : target;
  const innerRel =
    rel === undefined ? (isSameSite ? undefined : "noopener noreferrer") : rel;

  let innerEndIcon;
  if (endIcon === undefined) {
    // Check for special protocol or domain-specific icons first
    if (href?.startsWith("tel:")) {
      innerEndIcon = <PhoneSvg />;
    } else if (href?.startsWith("sms:")) {
      innerEndIcon = <LinkSmsSvg />;
    } else if (href?.startsWith("mailto:")) {
      innerEndIcon = <EmailSvg />;
    } else if (href?.includes("github.com")) {
      innerEndIcon = <LinkGithubSvg />;
    } else {
      // Fall back to default icon logic
      const innerBlankTargetIcon =
        blankTargetIcon === undefined
          ? innerTarget === "_blank"
          : blankTargetIcon;
      const innerAnchorIcon = anchorIcon === undefined ? isAnchor : anchorIcon;
      if (innerBlankTargetIcon) {
        innerEndIcon =
          innerBlankTargetIcon === true ? (
            <LinkBlankTargetSvg />
          ) : (
            innerBlankTargetIcon
          );
      } else if (innerAnchorIcon) {
        innerEndIcon =
          innerAnchorIcon === true ? <LinkAnchorSvg /> : anchorIcon;
      }
    }
  } else {
    innerEndIcon = endIcon;
  }

  const innerChildren = children || (hrefFallback ? href : children);
  const startIconEl = startIcon && <Icon>{startIcon}</Icon>;
  const endIconEl = innerEndIcon && <Icon>{innerEndIcon}</Icon>;

  const currentIndicatorPosition =
    currentIndicator === true ? "bottom" : currentIndicator;
  const currentIndicatorEl =
    currentIndicatorPosition === "left" ||
    currentIndicatorPosition === "right" ||
    currentIndicatorPosition === "top" ||
    currentIndicatorPosition === "bottom" ? (
      <LinkCurrentIndicator />
    ) : null;

  return (
    <Text
      as="a"
      color={anchor && !innerChildren ? "inherit" : undefined}
      id={anchor ? href.slice(1) : undefined}
      {...remainingProps}
      ref={ref}
      href={href}
      rel={innerRel}
      target={innerTarget === "_self" ? undefined : target}
      aria-busy={loading}
      inert={disabled}
      aria-current={isCurrent ? "page" : undefined}
      aria-selected={selectionContext ? selected : undefined}
      data-value={value}
      preventBoldLayoutShift={currentEffectBold}
      overflowEllipsis={overflowEllipsis}
      // Visual
      data-appearance={appearance}
      data-current-effect-bold={currentEffectBold ? "" : undefined}
      data-current-effect-shadow={currentEffectShadow ? "" : undefined}
      data-current-indicator-position={currentIndicatorPosition}
      data-anchor={anchor ? "" : undefined}
      data-interactive={onClick ? "" : undefined}
      data-reveal-on-interaction={revealOnInteraction ? "" : undefined}
      baseClassName="navi_link"
      styleCSSVars={LinkStyleCSSVars}
      pseudoClasses={LinkPseudoClasses}
      pseudoElements={LinkPseudoElements}
      basePseudoState={{
        ":read-only": readOnly,
        ":disabled": disabled,
        ":visited": visited,
        ":-navi-loading": loading,
        ":-navi-href-internal": isSameSite,
        ":-navi-href-external": !isSameSite,
        ":-navi-href-anchor": isAnchor,
        ":-navi-href-current": innerCurrent,
        ":-navi-selected": selected,
      }}
      onClick={(e) => {
        if (preventDefault) {
          e.preventDefault();
        }
        closeValidationMessage(e.target, "click");
        if (readOnly) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      onKeyDown={(e) => {
        if (spaceToClick && e.key === " ") {
          e.preventDefault(); // Prevent page scroll
          if (!readOnly && !disabled) {
            e.target.click();
          }
        }
        onKeyDown?.(e);
      }}
      childrenOutsideFlow={
        <>
          <LoaderBackground
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
      {endIconEl ? (
        overflowEllipsis ? (
          <Text overflowPinned>{endIconEl}</Text>
        ) : (
          endIconEl
        )
      ) : null}
    </Text>
  );
};

const LinkCurrentIndicator = () => {
  return <span className="navi_current_indicator" />;
};
markAsOutsideTextFlow(LinkCurrentIndicator);

const LinkWithAction = (props) => {
  const {
    shortcuts = [],
    readOnly,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    children,
    loading,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const { actionPending } = useRequestedActionStatus(ref, {
    actionOrigin: "keyboard_shortcut",
  });
  const innerLoading = Boolean(loading || actionPending);

  useKeyboardShortcuts(ref, shortcuts, {
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
  });

  return (
    <LinkBasic
      {...rest}
      ref={ref}
      loading={innerLoading}
      readOnly={readOnly || actionPending}
      data-readonly-silent={actionPending && !readOnly ? "" : undefined}
      /* When we have keyboard shortcuts the link outline is visible on focus (not solely on focus-visible) */
      data-focus-visible=""
    >
      {children}
    </LinkBasic>
  );
};
