/* eslint-disable jsenv/no-unknown-params */

import { useContext, useRef } from "preact/hooks";

import { renderActionableComponent } from "../../action/render_actionable_component.jsx";
import { Box } from "../../box/box.jsx";
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
} from "../../graphic/icons/link_svgs.jsx";
import { PhoneSvg } from "../../graphic/icons/phone_svg.jsx";
import { LoaderBackground } from "../../graphic/loader/loader_background.jsx";
import { useKeyboardShortcuts } from "../../keyboard/keyboard_shortcuts.js";
import { applySpacingOnTextChildren, Text } from "../../text/text.jsx";
import { TitleLevelContext } from "../../text/title.jsx";
import { useDocumentUrl } from "../browser_integration/document_url_signal.js";
import { getHrefTargetInfo } from "../browser_integration/href_target_info.js";
import { useIsVisited } from "../browser_integration/use_is_visited.js";
import { useRouteStatus } from "../route.js";
import { ReportSelectedOnTabContext } from "../tab/tab_context.js";

import { GithubSvg, SmsSvg } from "./link_icons.jsx";
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
      --link-border-radius: 2px;
      --link-outline-color: var(--navi-focus-outline-color);
      --link-loader-color: var(--navi-loader-color);
      --link-color: rgb(0, 0, 238);
      --link-color-visited: color-mix(in srgb, var(--link-color), black 40%);

      --link-color-active: red;
      --link-text-decoration: underline;
      --link-text-decoration-hover: var(--link-text-decoration);
      --link-cursor: pointer;
      --link-loading-outline-size: 1px;
      --link-color-current: var(--link-color);
    }
  }

  .navi_link {
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
    border-radius: var(--link-border-radius);
    outline-width: 0;
    outline-style: solid;
    outline-color: var(--link-outline-color);
    cursor: var(--x-link-cursor);

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
      --x-link-color: var(--x-link-color-hover);
      --x-link-text-decoration: var(--x-link-text-decoration-hover);
    }
    &[data-focus-visible] {
      outline-width: 2px;
    }
    /* Selected */
    &[aria-selected] {
      position: relative;
    }
    &[aria-selected="true"] {
      background-color: light-dark(#bbdefb, #2563eb);
    }
    &[aria-selected] input[type="checkbox"] {
      position: absolute;
      opacity: 0;
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
      &[data-anchor] {
        /* For anchor links, we want to keep the pointer cursor to indicate interactivity */
        /* as anchor link will still scroll to the section even if it's the current page */
        --x-link-cursor: pointer;
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
    &[data-discrete] {
      --link-color: inherit;
      --link-text-decoration: none;
    }
    /* Reveal on interaction */
    &[data-reveal-on-interaction] {
      position: absolute !important;
      top: 0;
      left: -1em;
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
  ":hover": {
    color: "--link-color-hover",
    textDecoration: "--link-text-decoration-hover",
  },
  ":active": {
    color: "--link-color-active",
  },
  ":-navi-href-current": {
    color: "--link-color-current",
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
  ":-navi-href-match",
];
const LinkPseudoElements = ["::-navi-loader"];

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
  ":-navi-href-match": {
    attribute: "data-href-match",
  },
});

export const Link = (props) => {
  return renderActionableComponent(props, {
    Basic: LinkBasic,
    WithAction: LinkWithAction,
  });
};

const LinkBasic = (props) => {
  const selectionContext = useContext(SelectionContext);
  if (selectionContext) {
    return <LinkWithSelection {...props} />;
  }
  return <LinkOrRouteLink {...props} />;
};
const LinkWithSelection = (props) => {
  const { selection, selectionController } = useContext(SelectionContext);
  const { value = props.href, children, ...rest } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const { selected } = useSelectableElement(ref, {
    selection,
    selectionController,
  });

  return (
    <LinkOrRouteLink
      {...rest}
      ref={ref}
      data-value={value}
      aria-selected={selected}
    >
      {children}
    </LinkOrRouteLink>
  );
};
const LinkOrRouteLink = (props) => {
  if (props.route) {
    return <LinkWithRoute {...props} />;
  }
  return <LinkPlain {...props} />;
};
const LinkWithRoute = ({ route, routeParams, children, ...rest }) => {
  const url = route.buildUrl(routeParams);
  const reportSelectedOnTab = useContext(ReportSelectedOnTabContext);
  const { matching } = useRouteStatus(route);
  const paramsAreMatching = route.matchesParams(routeParams);
  const linkMatching = matching && paramsAreMatching;

  reportSelectedOnTab?.(linkMatching);

  return (
    <LinkBasic matching={linkMatching} href={url} {...rest}>
      {children || route.buildRelativeUrl(routeParams)}
    </LinkBasic>
  );
};

const LinkPlain = (props) => {
  const titleLevel = useContext(TitleLevelContext);
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

    // visual
    discrete,
    blankTargetIcon,
    anchorIcon,
    startIcon,
    endIcon,
    spacing,
    revealOnInteraction = Boolean(titleLevel),
    hrefFallback = !anchor,
    matching,
    overflowEllipsis,

    children,

    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const visited = useIsVisited(href);

  useAutoFocus(ref, autoFocus);
  const remainingProps = useConstraints(ref, rest);
  const shouldDimColor = readOnly || disabled;
  useDimColorWhen(ref, shouldDimColor);
  // subscribe to document url to re-render and re-compute getHrefTargetInfo
  useDocumentUrl();
  const { isSameSite, isAnchor, isCurrent } = getHrefTargetInfo(href);

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
      innerEndIcon = <SmsSvg />;
    } else if (href?.startsWith("mailto:")) {
      innerEndIcon = <EmailSvg />;
    } else if (href?.includes("github.com")) {
      innerEndIcon = <GithubSvg />;
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
  const startIconEl = startIcon && (
    <Icon marginRight={innerChildren ? "xxs" : undefined}>{startIcon}</Icon>
  );
  const endIconEl = innerEndIcon && (
    <Icon marginLeft={innerChildren ? "xxs" : undefined}>{innerEndIcon}</Icon>
  );

  // For now we don't do as for button.jsx where we always wrap button content inside <Text>
  // because link can wrap images or other non-text content and we don't want to mess with it
  // in theory this is the same for button so we'll see with time what makes more sense
  const visualChildren = overflowEllipsis ? (
    <Text
      overflowEllipsis
      // Here we can't use spaces as they would be underlined
      // (Ce would use zero width space with paddings but that's just simpler to rely on margins here)
      spacing="pre"
    >
      {startIconEl}
      {innerChildren}
      {endIconEl && <Text overflowPinned>{endIconEl}</Text>}
    </Text>
  ) : (
    <>
      {startIconEl}
      {applySpacingOnTextChildren(innerChildren, spacing)}
      {endIconEl}
    </>
  );

  return (
    <Box
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
      spacing="pre"
      // Visual
      data-anchor={anchor ? "" : undefined}
      data-reveal-on-interaction={revealOnInteraction ? "" : undefined}
      data-discrete={discrete ? "" : undefined}
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
        ":-navi-href-current": isCurrent,
        ":-navi-href-match": matching,
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
    >
      <LoaderBackground
        loading={loading}
        inset={1}
        color="var(--link-loader-color)"
      />
      {visualChildren}
    </Box>
  );
};

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
  const { actionPending } = useRequestedActionStatus(ref);
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
