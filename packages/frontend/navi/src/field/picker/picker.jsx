import { dispatchCustomEvent } from "@jsenv/dom";
import { useContext, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { ChevronDownSvg } from "@jsenv/navi/src/graphic/icons/chevron_updown_svg.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { createComponentResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import {
  FieldContext,
  reportDisabledToField,
  reportInteractiveToField,
  reportReadOnlyToField,
  useFieldId,
} from "../field.jsx";
import { createUICallback } from "../ui_callback.js";
import {
  DisabledContext,
  LoadingContext,
  LoadingElementContext,
  ReadOnlyContext,
  UIStateContext,
  UIStateControllerContext,
  useUIState,
  useUIStateController,
} from "../use_ui_state_controller.js";
import { useConstraints } from "../validation/hooks/use_constraints.js";
import { PickerContext, PickerElementContext } from "./picker_context.jsx";
import { pickerResolvers } from "./picker_resolvers.jsx";

const css = /* css */ `
  @layer navi {
    .navi_picker {
      --picker-border-radius: 2px;
      --picker-outline-width: 1px;
      --picker-border-width: 1px;
      --picker-font-size: 14px;
      --picker-padding-x-default: 8px;
      --picker-padding-y-default: 5px;
      --picker-outline-color: var(--navi-focus-outline-color);
      --picker-loader-color: var(--navi-loader-color);
      --picker-border-color: light-dark(#767676, #8e8e93);
      --picker-background-color: white;
      --picker-color: currentColor;
      --picker-placeholder-color: color-mix(
        in srgb,
        currentColor 60%,
        transparent
      );
      --picker-color-dimmed: color-mix(in srgb, currentColor 60%, transparent);
      --picker-right-slot-size: 1.5em;
      /* Hover */
      --picker-border-color-hover: color-mix(
        in srgb,
        var(--picker-border-color) 70%,
        black
      );
      --picker-background-color-hover: color-mix(
        in srgb,
        var(--picker-background-color) 95%,
        black
      );
      /* Readonly */
      --picker-border-color-readonly: color-mix(
        in srgb,
        var(--picker-border-color) 45%,
        transparent
      );
      --picker-background-color-readonly: var(--picker-background-color);
      --picker-color-readonly: var(--picker-color-dimmed);
      /* Disabled */
      --picker-border-color-disabled: var(--picker-border-color-readonly);
      --picker-background-color-disabled: color-mix(
        in srgb,
        var(--picker-background-color) 95%,
        grey
      );
      --picker-color-disabled: color-mix(
        in srgb,
        var(--picker-color) 95%,
        grey
      );
    }
  }

  .navi_picker {
    --x-picker-outline-width: calc(
      var(--picker-outline-width) + var(--picker-border-width)
    );
    --x-picker-outline-offset: calc(-1 * var(--picker-border-width));
    --x-picker-background-color: var(--picker-background-color);
    --x-picker-border-color: var(--picker-border-color);
    --x-picker-padding-top: var(
      --picker-padding-top,
      var(--picker-padding-y, var(--picker-padding-y-default))
    );
    --x-picker-padding-right-base: var(
      --picker-padding-right,
      var(--picker-padding-x, var(--picker-padding-x-default))
    );
    --x-picker-padding-right: calc(
      var(--x-picker-padding-right-base) + var(--picker-right-slot-size)
    );
    --x-picker-padding-left: var(
      --picker-padding-left,
      var(--picker-padding-x, var(--picker-padding-x-default))
    );
    --x-picker-padding-bottom: var(
      --picker-padding-bottom,
      var(--picker-padding-y, var(--picker-padding-y-default))
    );
    --x-picker-color: var(--picker-placeholder-color);

    position: relative;
    display: inline-flex;
    box-sizing: border-box;
    min-height: 1em;
    padding-top: var(--x-picker-padding-top);
    padding-right: var(--x-picker-padding-right);
    padding-bottom: var(--x-picker-padding-bottom);
    padding-left: var(--x-picker-padding-left);
    flex-direction: column;
    justify-content: center;
    color: var(--x-picker-color);
    font-size: var(--picker-font-size);
    text-align: inherit;
    text-overflow: ellipsis;
    white-space: nowrap;
    background-color: var(--x-picker-background-color);
    border-width: var(--picker-border-width);
    border-style: solid;
    border-color: var(--x-picker-border-color);
    border-radius: var(--picker-border-radius);
    outline-width: var(--x-picker-outline-width);
    outline-color: var(--picker-outline-color);
    outline-offset: var(--x-picker-outline-offset);
    cursor: var(--x-picker-cursor, pointer);
    user-select: none;

    .navi_picker_right_slot {
      position: absolute;
      right: 0;
      width: var(--picker-right-slot-size);
      flex-shrink: 0;
      opacity: 0.6;
    }
    .navi_picker_input {
      position: absolute;
      inset: 0;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: none;
      border: none;
      opacity: 0;
      appearance: none;
      pointer-events: none;
    }

    &[data-has-value] {
      --x-picker-color: var(--picker-color);
    }
    /* Hover */
    &[data-hover] {
      --x-picker-background-color: var(--picker-background-color-hover);
      --x-picker-border-color: var(--picker-border-color-hover);
    }
    /* Readonly */
    &[data-readonly] {
      --x-picker-border-color: var(--picker-border-color-readonly);
      --x-picker-background-color: var(--picker-background-color-readonly);
      --x-picker-color: var(--picker-color-readonly);
    }
    /* Focus */
    &[data-focus-visible] {
      --x-picker-border-color: transparent;
      outline-style: solid;
    }
    /* Disabled */
    &[data-disabled] {
      --x-picker-border-color: var(--picker-border-color-disabled);
      --x-picker-background-color: var(--picker-background-color-disabled);
      --x-picker-color: var(--picker-color-disabled);
      --x-picker-cursor: default;
    }
    /* Callout (info, warning, error) */
    &[data-callout] {
      --x-picker-border-color: var(--callout-color);
    }
  }

  .navi_picker_color_display {
    display: block;
    width: 1em;
    height: 1em;
    background-color: var(--picker-color);
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 2px;
  }
`;

/**
 * A button-like trigger that opens a picker when clicked.
 *
 * Use the `type` prop to choose what kind of picker to open:
 *   "day"      — calendar day
 *   "month"    — year + month
 *   "week"     — ISO week
 *   "time"     — hours + minutes
 *   "datetime" — date + time
 *   "color"    — color chooser
 *   "hour"     — fixed time slots (derived from min/max/step)
 *
 * When `children` are provided, the picker opens a popover or dialog instead
 * of the browser-native picker. On small screens a dialog is used automatically;
 * on larger screens a popover is used. Pass `mode="dialog"` or `mode="popover"`
 * to force one. The children are rendered inside the popup.
 *
 * Props:
 *   type        — picker variant (see above)
 *   value       — controlled value
 *   uiAction    — called with the new value when the user picks one
 *   name        — form field name
 *   placeholder — shown when no value is selected
 *   required    — marks the field as required
 *   min         — minimum allowed value; accepts a Date or a raw string
 *   max         — maximum allowed value; accepts a Date or a raw string
 *   step        — step interval
 *   disabled    — disables the picker
 *   children    — content to display inside the popup (enables popover/dialog mode)
 *   mode        — "popover" or "dialog"; auto-detected from screen size when omitted
 */
export const Picker = (props) => {
  const defaultRef = useRef(null);
  const ref = props.ref || defaultRef;
  const fieldId = useFieldId();
  const id = props.id || fieldId;
  const uiStateController = useUIStateController(props, "picker");
  const uiState = useUIState(uiStateController);

  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>
        {renderPicker(PickerInput, { ...props, ref, id })}
      </UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};
const renderPicker = createComponentResolver(pickerResolvers);
Picker.update = createUICallback({
  name: "Picker.update",
  uiAction: (value, event) => {
    return dispatchToPicker(event, "navi_picker_set_value", { value });
  },
});
Picker.close = createUICallback({
  name: "Picker.close",
  event: (e) => dispatchToPicker(e, "navi_picker_request_close"),
  uiAction: (value, event) => {
    const currentTarget = event.currentTarget;
    if (currentTarget.name && TAGNAME_FIELD_SET.has(currentTarget.tagName)) {
      if (!dispatchToPicker(event, "navi_picker_set_value", { value })) {
        return false;
      }
    }
    return dispatchToPicker(event, "navi_picker_request_close");
  },
});
const dispatchToPicker = (e, customEventName, detail) => {
  const pickerEl = e.currentTarget.closest(".navi_picker");
  if (!pickerEl) {
    return false;
  }
  return dispatchCustomEvent(pickerEl, customEventName, {
    event: e,
    ...detail,
  });
};
const TAGNAME_FIELD_SET = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON"]);

const PickerInput = (props) => {
  import.meta.css = css;
  const {
    id,
    type,
    name,
    ref,
    disabled,
    readOnly,
    loading,
    placeholder,
    ui,
    icon,
    autoFocus,
    autoFocusPreventScroll,
    onChange,
    // input constraint attributes — forwarded to hidden <input>, not the button
    required,
    min,
    max,
    step,
    children,
    ...rest
  } = props;
  const uiState = useContext(UIStateContext);
  const uiStateController = useContext(UIStateControllerContext);
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);

  const innerLoading =
    loading || (contextLoading && contextLoadingElement === ref.current);
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;

  reportReadOnlyToField(innerReadOnly);
  reportDisabledToField(innerDisabled);
  reportInteractiveToField(true);
  useAutoFocus(ref, autoFocus, { preventScroll: autoFocusPreventScroll });

  const pickerInputRef = useRef(null);
  const remainingProps = useConstraints(pickerInputRef, rest);

  return (
    <Box
      as="button"
      type="button"
      {...remainingProps}
      ref={ref}
      baseClassName="navi_picker"
      data-field=".navi_picker_input"
      navi-has-placeholder={placeholder ? "" : undefined}
      aria-busy={innerLoading}
      autoFocus={undefined}
      basePseudoState={{
        ...remainingProps.basePseudoState,
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
        ":-navi-loading": innerLoading,
      }}
      // pseudoStateSelector=".navi_picker_input"
      pseudoClasses={PICKER_PSEUDO_CLASSES}
      // we must put the id on the button and not the input
      // so that a <label> tries to give focus to the button and not the input
      id={id}
      onnavi_picker_set_value={(e) => {
        uiStateController.setUIState(e.detail.value, e);
      }}
    >
      <LoadingOutline
        loading={innerLoading}
        color="var(--picker-loader-color)"
        inset={-1}
      />
      <PickerContext.Provider
        value={{
          placeholder,
          value: uiState,
        }}
      >
        {ui === undefined ? <PickerDefaultUI /> : ui}
      </PickerContext.Provider>
      <span className="navi_picker_right_slot">
        <Icon size="m">{icon === undefined ? <ChevronDownSvg /> : icon}</Icon>
      </span>

      <input
        ref={pickerInputRef}
        className="navi_picker_input"
        type={type}
        name={name}
        value={uiState}
        required={required}
        min={min}
        max={max}
        step={step}
        tabIndex={-1}
        readOnly={innerReadOnly}
        disabled={innerDisabled}
        aria-busy={innerLoading}
        data-rendered-by=".navi_picker"
        onChange={(e) => {
          const newValue = e.currentTarget.value;
          uiStateController.setUIState(newValue, e);
          onChange?.(e);
        }}
      />
      <PickerElementContext.Provider value={ref}>
        {/* We are a field ourselve, which can contain other fields that should not inehrit our field */}
        <FieldContext.Provider value={null}>{children}</FieldContext.Provider>
      </PickerElementContext.Provider>
    </Box>
  );
};
const PICKER_PSEUDO_CLASSES = [
  ":hover",
  ":focus",
  ":focus-visible",
  ":focus-within",
  ":read-only",
  ":disabled",
  ":-navi-loading",
  ":-navi-expanded",
  ":-navi-has-value",
];
const PickerDefaultUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    return placeholder || null;
  }
  return value;
};
