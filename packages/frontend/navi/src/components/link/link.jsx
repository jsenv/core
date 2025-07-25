import { closeValidationMessage, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useLayoutEffect, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useSelectionContext } from "../selection/selection_context.jsx";
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
    display: inline-block;
  }

  .navi_link_checkbox {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Visual feedback for selected state */
  .navi_link_container:has(.navi_link_checkbox:checked) .navi_link {
    background-color: light-dark(#e3f2fd, #1e3a8a);
    /* outline: 2px solid light-dark(#1976d2, #3b82f6); */
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
  const handleSelectionChange = selectionContext.onSelectionChange;

  const handleLinkClick = (e) => {
    const isMultiSelect = e.metaKey || e.ctrlKey;
    const isShiftSelect = e.shiftKey;
    const isSingleSelect = !isMultiSelect && !isShiftSelect;
    const checkbox = checkboxRef.current;

    if (selectionContext) {
      // Use context-based selection
      if (isSingleSelect) {
        // Normal click - navigate to the link
        onClick?.(e);
        return;
      }

      if (isMultiSelect) {
        e.preventDefault(); // Prevent navigation
        const newChecked = !checkbox.checked;
        checkbox.checked = newChecked;
        handleSelectionChange?.(newChecked, {
          shiftKey: e.shiftKey,
          metaKey: e.metaKey,
          ctrlKey: e.ctrlKey,
          value,
        });
        return;
      }

      if (isShiftSelect) {
        e.preventDefault(); // Prevent navigation
        checkbox.checked = true;
        handleSelectionChange?.(true, {
          shiftKey: e.shiftKey,
          metaKey: e.metaKey,
          ctrlKey: e.ctrlKey,
          value,
        });
        return;
      }
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
        className="navi_link_checkbox"
        aria-label={`Select ${typeof children === "string" ? children : "item"}`}
        tabIndex={-1} // Don't interfere with link tab order
      />
      <LinkPlain ref={ref} {...rest} onClick={handleLinkClick}>
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
