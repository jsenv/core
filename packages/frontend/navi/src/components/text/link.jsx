import { forwardRef } from "preact/compat";
import {
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "preact/hooks";

import { useDocumentUrl } from "../../browser_integration/document_url_signal.js";
import { getLinkTargetInfo } from "../../browser_integration/link_target_info.js";
import { useIsVisited } from "../../browser_integration/use_is_visited.js";
import { closeValidationMessage } from "../../validation/custom_constraint_validation.js";
import { useConstraints } from "../../validation/hooks/use_constraints.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useRequestedActionStatus } from "../field/use_action_events.js";
import { useKeyboardShortcuts } from "../keyboard_shortcuts/keyboard_shortcuts.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import { withPropsStyle } from "../props_composition/with_props_style.js";
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
  .navi_link {
    position: relative;
    border-radius: 2px;
  }
  /* Focus */
  .navi_link:focus {
    position: relative;
    z-index: 1; /* Ensure focus outline is above other elements */
  }
  /* Visited */
  .navi_link[data-visited] {
    color: light-dark(#6a1b9a, #ab47bc);
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
    font-weight: bold;
  }
  /* Readonly */
  .navi_link[data-readonly] > * {
    opacity: 0.5;
  }
  /* Disabled */
  .navi_link[inert] {
    pointer-events: none;
  }
  .navi_link[inert] > * {
    opacity: 0.5;
  }
`;

export const Link = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: LinkBasic,
    WithAction: LinkWithAction,
  });
});

const LinkBasic = forwardRef((props, ref) => {
  const selectionContext = useContext(SelectionContext);
  if (selectionContext) {
    return <LinkWithSelection ref={ref} {...props} />;
  }
  return <LinkPlain ref={ref} {...props} />;
});
const LinkPlain = forwardRef((props, ref) => {
  const {
    loading,
    readOnly,
    disabled,
    autoFocus,
    active,
    visited,
    spaceToClick = true,
    constraints = [],
    onClick,
    onKeyDown,
    href,
    target,
    rel,

    // visual
    className,
    blankTargetIcon,
    anchorIcon,
    icon,
    cursorDefaultWhenCurrent,
    contentSpacing = " ",
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const isVisited = useIsVisited(href);

  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);
  const shouldDimColor = readOnly || disabled;
  useDimColorWhen(innerRef, shouldDimColor);
  // subscribe to document url to re-render and re-compute getLinkTargetInfo
  useDocumentUrl();
  const { targetIsSameSite, targetIsAnchor, targetIsCurrent } =
    getLinkTargetInfo(href);

  const innerClassName = withPropsClassName("navi_link", className);
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    base: {
      cursor:
        cursorDefaultWhenCurrent && targetIsCurrent ? "default" : undefined,
    },
    layout: true,
    typo: true,
  });

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
  } else {
    innerIcon = icon;
  }

  return (
    <a
      {...remainingProps}
      ref={innerRef}
      className={innerClassName}
      style={innerStyle}
      href={href}
      rel={innerRel}
      target={innerTarget === "_self" ? undefined : target}
      aria-busy={loading}
      inert={disabled}
      data-disabled={disabled ? "" : undefined}
      data-readonly={readOnly ? "" : undefined}
      data-active={active ? "" : undefined}
      data-visited={visited || isVisited ? "" : undefined}
      data-external={targetIsSameSite ? undefined : ""}
      data-internal={targetIsSameSite ? "" : undefined}
      data-anchor={targetIsAnchor ? "" : undefined}
      data-current={targetIsCurrent ? "" : undefined}
      onClick={(e) => {
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
      <LoaderBackground loading={loading} color="light-dark(#355fcc, #3b82f6)">
        {applyContentSpacingOnTextChildren(children, contentSpacing)}
        {innerIcon && <Icon>{innerIcon}</Icon>}
      </LoaderBackground>
    </a>
  );
});
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

const LinkWithSelection = forwardRef((props, ref) => {
  const { selection, selectionController } = useContext(SelectionContext);
  const { value = props.href, children, ...rest } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const { selected } = useSelectableElement(innerRef, {
    selection,
    selectionController,
  });

  return (
    <LinkPlain
      {...rest}
      ref={innerRef}
      data-value={value}
      aria-selected={selected}
    >
      {children}
    </LinkPlain>
  );
});

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

const LinkWithAction = forwardRef((props, ref) => {
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
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const { actionPending } = useRequestedActionStatus(innerRef);
  const innerLoading = Boolean(loading || actionPending);

  useKeyboardShortcuts(innerRef, shortcuts, {
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
  });

  return (
    <LinkBasic
      {...rest}
      ref={innerRef}
      loading={innerLoading}
      readOnly={readOnly || actionPending}
      data-readonly-silent={actionPending && !readOnly ? "" : undefined}
      /* When we have keyboard shortcuts the link outline is visible on focus (not solely on focus-visible) */
      data-focus-visible=""
    >
      {children}
    </LinkBasic>
  );
});
