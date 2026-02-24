import { useContext, useLayoutEffect, useRef } from "preact/hooks";

import { renderActionableComponent } from "../action/render_actionable_component.jsx";
import { Box } from "../box/box.jsx";
import { PSEUDO_CLASSES } from "../box/pseudo_styles.js";
import { LoaderBackground } from "../field/loader/loader_background.jsx";
import {
  SelectionContext,
  useSelectableElement,
} from "../field/selection/selection.jsx";
import { useRequestedActionStatus } from "../field/use_action_events.js";
import { useAutoFocus } from "../field/use_auto_focus.js";
import { closeValidationMessage } from "../field/validation/custom_constraint_validation.js";
import { useConstraints } from "../field/validation/hooks/use_constraints.js";
import { Icon } from "../graphic/icon.jsx";
import { EmailSvg } from "../graphic/icons/email_svg.jsx";
import {
  LinkAnchorSvg,
  LinkBlankTargetSvg,
} from "../graphic/icons/link_svgs.jsx";
import { useKeyboardShortcuts } from "../keyboard/keyboard_shortcuts.js";
import { applySpacingOnTextChildren } from "../text/text.jsx";
import { TitleLevelContext } from "../text/title.jsx";
import { useDocumentUrl } from "./browser_integration/document_url_signal.js";
import { getHrefTargetInfo } from "./browser_integration/href_target_info.js";
import { useIsVisited } from "./browser_integration/use_is_visited.js";

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
      --link-color-visited: light-dark(#6a1b9a, #ab47bc);
      --link-color-active: red;
      --link-text-decoration: underline;
      --link-text-decoration-hover: var(--link-text-decoration);
      --link-cursor: pointer;
    }
  }

  .navi_link {
    --x-link-color: var(--link-color);
    --x-link-color-hover: var(--link-color-hover, var(--link-color));
    --x-link-color-visited: var(--link-color-visited);
    --x-link-color-active: var(--link-color-active);
    --x-link-text-decoration: var(--link-text-decoration);
    --x-link-text-decoration-hover: var(--link-text-decoration-hover);
    --x-link-cursor: var(--link-cursor);

    position: relative;
    aspect-ratio: inherit;
    color: var(--x-link-color);
    text-decoration: var(--x-link-text-decoration);
    border-radius: var(--link-border-radius);
    outline-width: 0;
    outline-style: solid;
    outline-color: var(--link-outline-color);
    cursor: var(--x-link-cursor);

    /* Current */
    &[data-href-current] {
      --x-link-cursor: default;
    }
    /* Hover */
    &[data-hover] {
      --x-link-color: var(--x-link-color-hover);
      --x-link-text-decoration: var(--x-link-text-decoration-hover);
    }
    /* Focus */
    &[data-focus],
    &[data-focus-visible] {
      position: relative;
      z-index: 1; /* Ensure focus outline is above other elements */
    }
    &[data-focus-visible] {
      outline-width: 2px;
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
      --x-link-color: var(--link-color);
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
  return <LinkPlain {...props} />;
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
    icon,
    spacing,
    revealOnInteraction = Boolean(titleLevel),
    hrefFallback = !anchor,

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

  let innerIcon;
  if (icon === undefined) {
    // Check for special protocol or domain-specific icons first
    if (href?.startsWith("tel:")) {
      innerIcon = <PhoneSvg />;
    } else if (href?.startsWith("sms:")) {
      innerIcon = <SmsSvg />;
    } else if (href?.startsWith("mailto:")) {
      innerIcon = <EmailSvg />;
    } else if (href?.includes("github.com")) {
      innerIcon = <GithubSvg />;
    } else {
      // Fall back to default icon logic
      const innerBlankTargetIcon =
        blankTargetIcon === undefined
          ? innerTarget === "_blank"
          : blankTargetIcon;
      const innerAnchorIcon = anchorIcon === undefined ? isAnchor : anchorIcon;
      if (innerBlankTargetIcon) {
        innerIcon =
          innerBlankTargetIcon === true ? (
            <LinkBlankTargetSvg />
          ) : (
            innerBlankTargetIcon
          );
      } else if (innerAnchorIcon) {
        innerIcon = innerAnchorIcon === true ? <LinkAnchorSvg /> : anchorIcon;
      }
    }
  } else {
    innerIcon = icon;
  }

  const innerChildren = children || (hrefFallback ? href : children);

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
      <LoaderBackground loading={loading} color="var(--link-loader-color)" />
      {applySpacingOnTextChildren(innerChildren, spacing)}
      {innerIcon && (
        <Icon marginLeft={innerChildren ? "xxs" : undefined}>{innerIcon}</Icon>
      )}
    </Box>
  );
};

const PhoneSvg = () => {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
        fill="currentColor"
      />
    </svg>
  );
};

const SmsSvg = () => {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"
        fill="currentColor"
      />
    </svg>
  );
};

const GithubSvg = () => {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"
        fill="currentColor"
      />
    </svg>
  );
};

export const CurrentLinkSvg = () => {
  return (
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path
        d="m 8 0 c -3.3125 0 -6 2.6875 -6 6 c 0.007812 0.710938 0.136719 1.414062 0.386719 2.078125 l -0.015625 -0.003906 c 0.636718 1.988281 3.78125 5.082031 5.625 6.929687 h 0.003906 v -0.003906 c 1.507812 -1.507812 3.878906 -3.925781 5.046875 -5.753906 c 0.261719 -0.414063 0.46875 -0.808594 0.585937 -1.171875 l -0.019531 0.003906 c 0.25 -0.664063 0.382813 -1.367187 0.386719 -2.078125 c 0 -3.3125 -2.683594 -6 -6 -6 z m 0 3.691406 c 1.273438 0 2.308594 1.035156 2.308594 2.308594 s -1.035156 2.308594 -2.308594 2.308594 c -1.273438 -0.003906 -2.304688 -1.035156 -2.304688 -2.308594 c -0.003906 -1.273438 1.03125 -2.304688 2.304688 -2.308594 z m 0 0"
        fill="currentColor"
      />
    </svg>
  );
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
    <LinkPlain {...rest} ref={ref} data-value={value} aria-selected={selected}>
      {children}
    </LinkPlain>
  );
};

/*
 * Custom hook to apply semi-transparent color when an element should be dimmed.
 *
 * Why we do it this way:
 * 1. **Precise timing**: Captures the element's natural color exactly when transitioning
 *    from normal to dimmed state (not before, not after)
 * 2. **Avoids CSS inheritance issues**: CSS `currentColor` and `color-mix()` don't work
 *    reliably for creating true transparency that matches `opacity: 0.5`
 * 3. **Performance**: Only executes when the dimmed state actually changes, not on every render
 * 4. **Color accuracy**: Uses `color(from ... / 0.5)` syntax to preserve the exact visual
 *    appearance of `opacity: 0.5` but applied only to color
 * 5. **Works with any color**: Handles default blue, visited purple, inherited colors, etc.
 * 6. **Maintains focus outline**: Since we only dim the text color, focus outlines remain
 *    fully visible for accessibility
 */
const useDimColorWhen = (elementRef, shouldDim) => {
  const shouldDimPreviousRef = useRef();
  useLayoutEffect(() => {
    const element = elementRef.current;
    const shouldDimPrevious = shouldDimPreviousRef.current;

    if (shouldDim === shouldDimPrevious) {
      return;
    }
    shouldDimPreviousRef.current = shouldDim;
    if (shouldDim) {
      // Capture color just before applying disabled state
      const computedStyle = getComputedStyle(element);
      const currentColor = computedStyle.color;
      element.style.color = `color(from ${currentColor} srgb r g b / 0.5)`;
    } else {
      // Clear the inline style to let CSS take over
      element.style.color = "";
    }
  });
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
