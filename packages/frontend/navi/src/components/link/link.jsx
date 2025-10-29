import { forwardRef } from "preact/compat";
import {
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "preact/hooks";

import { useIsVisited } from "../../browser_integration/use_is_visited.js";
import { closeValidationMessage } from "../../validation/custom_constraint_validation.js";
import { useConstraints } from "../../validation/hooks/use_constraints.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useRequestedActionStatus } from "../field/use_action_events.js";
import { useKeyboardShortcuts } from "../keyboard_shortcuts/keyboard_shortcuts.js";
import { useLayoutStyle } from "../layout/use_layout_style.js";
import { LoadableInlineElement } from "../loader/loader_background.jsx";
import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import { withPropsStyle } from "../props_composition/with_props_style.js";
import {
  SelectionContext,
  useSelectableElement,
} from "../selection/selection.jsx";
import { useAutoFocus } from "../use_auto_focus.js";

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
    border-radius: 2px;
  }

  .navi_link:focus {
    position: relative;
    z-index: 1; /* Ensure focus outline is above other elements */
  }

  .navi_link[data-readonly] > *,
  .navi_link[inert] > * {
    opacity: 0.5;
  }

  .navi_link[inert] {
    pointer-events: none;
  }

  .navi_link[aria-selected] {
    position: relative;
  }

  .navi_link[aria-selected] input[type="checkbox"] {
    position: absolute;
    opacity: 0;
  }

  /* Visual feedback for selected state */
  .navi_link[aria-selected="true"] {
    background-color: light-dark(#bbdefb, #2563eb);
  }

  .navi_link[data-active] {
    font-weight: bold;
  }

  .navi_link[data-visited] {
    color: light-dark(#6a1b9a, #ab47bc);
  }

  .navi_link[data-no-text-decoration] {
    text-decoration: none;
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
    children,
    autoFocus,
    active,
    visited,
    spaceToClick = true,
    constraints = [],
    onClick,
    onKeyDown,
    href,

    // visual
    className,
    style,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const isVisited = useIsVisited(href);

  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);
  const shouldDimColor = readOnly || disabled;
  useDimColorWhen(innerRef, shouldDimColor);

  const innerClassName = withPropsClassName("navi_link", className);
  const { all } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle(all, style);

  return (
    <LoadableInlineElement
      loading={loading}
      color="light-dark(#355fcc, #3b82f6)"
    >
      <a
        {...rest}
        ref={innerRef}
        href={href}
        className={innerClassName}
        style={innerStyle}
        aria-busy={loading}
        inert={disabled}
        data-field=""
        data-readonly={readOnly ? "" : undefined}
        data-active={active ? "" : undefined}
        data-visited={visited || isVisited ? "" : undefined}
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
        {children}
      </a>
    </LoadableInlineElement>
  );
});
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
