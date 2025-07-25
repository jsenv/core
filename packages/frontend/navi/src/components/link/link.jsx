import { closeValidationMessage, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useLayoutEffect, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import {
  useRegisterSelectionValue,
  useSelectionContext,
} from "../selection/selection_context.jsx";
import { useActionEvents } from "../use_action_events.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { useKeyboardShortcuts } from "../use_keyboard_shortcuts.js";

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

  .navi_link_container {
    position: relative;
    display: inline-flex;
    flex: 1;
  }

  .navi_link_checkbox {
    position: absolute;
    opacity: 0;
  }

  /* Visual feedback for selected state */
  .navi_link[data-selected] {
    background-color: light-dark(#bbdefb, #2563eb);
  }
`;

export const Link = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: LinkBasic,
    WithAction: LinkWithAction,
  });
});

const LinkBasic = forwardRef((props, ref) => {
  const selectionContext = useSelectionContext();

  if (selectionContext) {
    return (
      <LinkWithSelection
        ref={ref}
        selectionContext={selectionContext}
        {...props}
      />
    );
  }
  return <LinkPlain ref={ref} {...props} />;
});

const LinkPlain = forwardRef((props, ref) => {
  const {
    className = "",
    loading,
    readOnly,
    disabled,
    children,
    autoFocus,
    spaceToClick = true,
    constraints = [],
    onClick,
    onKeyDown,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  const shouldDimColor = readOnly || disabled;
  useDimColorWhen(innerRef, shouldDimColor);

  return (
    <LoaderBackground loading={loading} color="light-dark(#355fcc, #3b82f6)">
      <a
        {...rest}
        ref={innerRef}
        className={["navi_link", ...className.split(" ")].join(" ")}
        aria-busy={loading}
        inert={disabled}
        data-field
        data-readonly={readOnly ? "" : undefined}
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
    </LoaderBackground>
  );
});

const LinkWithSelection = forwardRef((props, ref) => {
  const {
    // Selection props
    selectionContext,
    name,
    value,
    children,
    onClick,
    ...rest
  } = props;

  const checkboxRef = useRef();
  const isSelected = selectionContext.isSelected(value);

  // Register this link with the selection context using the custom hook
  useRegisterSelectionValue(value);

  const handleLinkClick = (e) => {
    const isMultiSelect = e.metaKey || e.ctrlKey;
    const isShiftSelect = e.shiftKey;
    const isSingleSelect = !isMultiSelect && !isShiftSelect;

    if (isSingleSelect) {
      // Single select - replace entire selection with just this item
      selectionContext.set([value], e);
    } else if (isMultiSelect) {
      e.preventDefault(); // Prevent navigation
      selectionContext.toggle(value, e);
    } else if (isShiftSelect) {
      e.preventDefault(); // Prevent navigation
      selectionContext.addFromLastSelectedTo(value, e);
    }

    // Fall back to original onClick
    onClick?.(e);
  };

  return (
    <div className="navi_link_container">
      <input
        ref={checkboxRef}
        type="checkbox"
        name={name}
        value={value}
        checked={isSelected}
        // Prevent direct checkbox interaction - only via link clicks
        disabled
        className="navi_link_checkbox"
        aria-label={`Select ${typeof children === "string" ? children : "item"}`}
        tabIndex={-1} // Don't interfere with link tab order
      />
      <LinkPlain
        ref={ref}
        {...rest}
        onClick={handleLinkClick}
        data-selected={isSelected ? "" : undefined}
      >
        {children}
      </LinkPlain>
    </div>
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
    children,
    shortcuts = [],
    onKeyDown,
    readOnly,
    loading,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [shortcutAction, onKeyDownForShortcuts] =
    useKeyboardShortcuts(shortcuts);
  const { loading: actionLoading } = useActionStatus(shortcutAction);
  const innerLoading = Boolean(loading || actionLoading);
  const executeAction = useExecuteAction(innerRef);
  useActionEvents(innerRef, {
    onAction: executeAction,
    onPrevented: onActionPrevented,
    onAbort: onActionAbort,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd,
  });

  return (
    <LinkBasic
      ref={innerRef}
      {...rest}
      loading={innerLoading}
      readOnly={readOnly || actionLoading}
      data-readonly-silent={actionLoading && !readOnly ? "" : undefined}
      /* When we have keyboard shortcuts the link outline is visible on focus (not solely on focus-visible) */
      data-focus-visible={shortcuts.length > 0 ? "" : undefined}
      onKeyDown={(e) => {
        onKeyDownForShortcuts(e);
        onKeyDown?.(e);
      }}
    >
      {children}
    </LinkBasic>
  );
});
