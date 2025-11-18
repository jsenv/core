import { useContext, useLayoutEffect, useRef } from "preact/hooks";

import { useDocumentUrl } from "../../browser_integration/document_url_signal.js";
import { getLinkTargetInfo } from "../../browser_integration/link_target_info.js";
import { useIsVisited } from "../../browser_integration/use_is_visited.js";
import { closeValidationMessage } from "../../validation/custom_constraint_validation.js";
import { useConstraints } from "../../validation/hooks/use_constraints.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useRequestedActionStatus } from "../field/use_action_events.js";
import { useKeyboardShortcuts } from "../keyboard_shortcuts/keyboard_shortcuts.js";
import { Box } from "../layout/box.jsx";
import { PSEUDO_CLASSES } from "../layout/pseudo_styles.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import {
  SelectionContext,
  useSelectableElement,
} from "../selection/selection.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { Icon, applyContentSpacingOnTextChildren } from "./text.jsx";

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
      --border-radius: 2px;
      --outline-color: var(--navi-focus-outline-color);
      --color: rgb(0, 0, 238);
      --color-visited: light-dark(#6a1b9a, #ab47bc);
      --color-active: red;
      --text-decoration: underline;
      --text-decoration-hover: var(--text-decoration);
      --cursor: pointer;
    }
  }

  .navi_link {
    --x-color: var(--color);
    --x-color-hover: var(--color-hover, var(--color));
    --x-color-visited: var(--color-visited);
    --x-color-active: var(--color-active);
    --x-text-decoration: var(--text-decoration);
    --x-text-decoration-hover: var(--text-decoration-hover);
    --x-cursor: var(--cursor);

    position: relative;
    color: var(--x-color);
    text-decoration: var(--x-text-decoration);
    border-radius: var(--border-radius);
    outline-color: var(--outline-color);
    cursor: var(--x-cursor);
  }
  /* Hover */
  .navi_link[data-hover] {
    --x-color: var(--x-color-hover);
    --x-text-decoration: var(--x-text-decoration-hover);
  }
  /* Focus */
  .navi_link[data-focus] {
    position: relative;
    z-index: 1; /* Ensure focus outline is above other elements */
  }
  .navi_link[data-focus-visible] {
    outline-width: 2px;
    outline-style: solid;
  }
  /* Visited */
  .navi_link[data-visited] {
    --x-color: var(--x-color-visited);
  }
  /* Selected */
  .navi_link[aria-selected] {
    position: relative;
  }
  .navi_link[aria-selected="true"] {
    background-color: light-dark(#bbdefb, #2563eb);
  }
  .navi_link[aria-selected] input[type="checkbox"] {
    position: absolute;
    opacity: 0;
  }
  /* Active */
  .navi_link[data-active] {
    /* Redefine it otherwise [data-visited] prevails */
    --x-color: var(--x-color-active);
  }
  /* Readonly */
  .navi_link[data-readonly] > * {
    opacity: 0.5;
  }
  /* Disabled */
  .navi_link[data-disabled] {
    pointer-events: none;
  }
  .navi_link[data-disabled] > * {
    opacity: 0.5;
  }
`;

const LinkManagedByCSSVars = {
  "outlineColor": "--outline-color",
  "borderRadius": "--border-radius",
  "color": "--color",
  "cursor": "--cursor",
  "textDecoration": "--text-decoration",
  ":hover": {
    color: "--color-hover",
    textDecoration: "--text-decoration-hover",
  },
  ":active": {
    color: "--color-active",
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
  ":-navi-internal-link",
  ":-navi-external-link",
  ":-navi-anchor-link",
  ":-navi-current-link",
];
const LinkPseudoElements = ["::-navi-loader"];

Object.assign(PSEUDO_CLASSES, {
  ":-navi-internal-link": {
    attribute: "data-internal-link",
  },
  ":-navi-external-link": {
    attribute: "data-external-link",
  },
  ":-navi-anchor-link": {
    attribute: "data-anchor-link",
  },
  ":-navi-current-link": {
    attribute: "data-current-link",
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
  const {
    loading,
    readOnly,
    disabled,
    autoFocus,
    spaceToClick = true,
    constraints = [],
    onClick,
    onKeyDown,
    href,
    target,
    rel,
    preventDefault,

    // visual
    box,
    blankTargetIcon,
    anchorIcon,
    icon,
    contentSpacing = " ",

    children,

    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const visited = useIsVisited(href);

  useAutoFocus(ref, autoFocus);
  useConstraints(ref, constraints);
  const shouldDimColor = readOnly || disabled;
  useDimColorWhen(ref, shouldDimColor);
  // subscribe to document url to re-render and re-compute getLinkTargetInfo
  useDocumentUrl();
  const { targetIsSameSite, targetIsAnchor, targetIsCurrent } =
    getLinkTargetInfo(href);

  const innerTarget =
    target === undefined ? (targetIsSameSite ? "_self" : "_blank") : target;
  const innerRel =
    rel === undefined
      ? targetIsSameSite
        ? undefined
        : "noopener noreferrer"
      : rel;

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
      const innerAnchorIcon =
        anchorIcon === undefined ? targetIsAnchor : anchorIcon;
      if (innerBlankTargetIcon) {
        innerIcon =
          innerBlankTargetIcon === true ? (
            <BlankTargetLinkSvg />
          ) : (
            innerBlankTargetIcon
          );
      } else if (innerAnchorIcon) {
        innerIcon = innerAnchorIcon === true ? <AnchorLinkSvg /> : anchorIcon;
      }
    }
  } else {
    innerIcon = icon;
  }

  return (
    <Box
      {...rest}
      ref={ref}
      as="a"
      href={href}
      rel={innerRel}
      target={innerTarget === "_self" ? undefined : target}
      aria-busy={loading}
      inert={disabled}
      // Visual
      baseClassName="navi_link"
      layoutInline
      layoutColumn={box ? true : undefined}
      managedByCSSVars={LinkManagedByCSSVars}
      pseudoClasses={LinkPseudoClasses}
      pseudoElements={LinkPseudoElements}
      basePseudoState={{
        ":read-only": readOnly,
        ":disabled": disabled,
        ":visited": visited,
        ":-navi-loading": loading,
        ":-navi-internal-link": targetIsSameSite,
        ":-navi-external-link": !targetIsSameSite,
        ":-navi-anchor-link": targetIsAnchor,
        ":-navi-current-link": targetIsCurrent,
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
        color="light-dark(#355fcc, #3b82f6)"
      />
      {applyContentSpacingOnTextChildren(children, contentSpacing)}
      {innerIcon && <Icon marginLeft="xxs">{innerIcon}</Icon>}
    </Box>
  );
};
const BlankTargetLinkSvg = () => {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.0002 5H8.2002C7.08009 5 6.51962 5 6.0918 5.21799C5.71547 5.40973 5.40973 5.71547 5.21799 6.0918C5 6.51962 5 7.08009 5 8.2002V15.8002C5 16.9203 5 17.4801 5.21799 17.9079C5.40973 18.2842 5.71547 18.5905 6.0918 18.7822C6.5192 19 7.07899 19 8.19691 19H15.8031C16.921 19 17.48 19 17.9074 18.7822C18.2837 18.5905 18.5905 18.2839 18.7822 17.9076C19 17.4802 19 16.921 19 15.8031V14M20 9V4M20 4H15M20 4L13 11"
        stroke="currentColor"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
const AnchorLinkSvg = () => {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.2218 3.32234C15.3697 1.17445 18.8521 1.17445 21 3.32234C23.1479 5.47022 23.1479 8.95263 21 11.1005L17.4645 14.636C15.3166 16.7839 11.8342 16.7839 9.6863 14.636C9.48752 14.4373 9.30713 14.2271 9.14514 14.0075C8.90318 13.6796 8.97098 13.2301 9.25914 12.9419C9.73221 12.4688 10.5662 12.6561 11.0245 13.1435C11.0494 13.1699 11.0747 13.196 11.1005 13.2218C12.4673 14.5887 14.6834 14.5887 16.0503 13.2218L19.5858 9.6863C20.9526 8.31947 20.9526 6.10339 19.5858 4.73655C18.219 3.36972 16.0029 3.36972 14.636 4.73655L13.5754 5.79721C13.1849 6.18774 12.5517 6.18774 12.1612 5.79721C11.7706 5.40669 11.7706 4.77352 12.1612 4.383L13.2218 3.32234Z"
        fill="currentColor"
      />
      <path
        d="M6.85787 9.6863C8.90184 7.64233 12.2261 7.60094 14.3494 9.42268C14.7319 9.75083 14.7008 10.3287 14.3444 10.685C13.9253 11.1041 13.2317 11.0404 12.7416 10.707C11.398 9.79292 9.48593 9.88667 8.27209 11.1005L4.73655 14.636C3.36972 16.0029 3.36972 18.219 4.73655 19.5858C6.10339 20.9526 8.31947 20.9526 9.6863 19.5858L10.747 18.5251C11.1375 18.1346 11.7706 18.1346 12.1612 18.5251C12.5517 18.9157 12.5517 19.5488 12.1612 19.9394L11.1005 21C8.95263 23.1479 5.47022 23.1479 3.32234 21C1.17445 18.8521 1.17445 15.3697 3.32234 13.2218L6.85787 9.6863Z"
        fill="currentColor"
      />
    </svg>
  );
};

const PhoneSvg = () => {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
        fill="currentColor"
      />
    </svg>
  );
};

const SmsSvg = () => {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"
        fill="currentColor"
      />
    </svg>
  );
};

const EmailSvg = () => {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      />
      <path
        d="m2 6 8 5 2 1.5 2-1.5 8-5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};

const GithubSvg = () => {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"
        fill="currentColor"
      />
    </svg>
  );
};

export const CurrentLinkSvg = () => {
  return (
    <svg
      viewBox="0 0 16 16"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
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
