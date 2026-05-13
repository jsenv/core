import { useContext, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import {
  reportDisabledToField,
  reportInteractiveToField,
  reportReadOnlyToField,
  useFieldId,
} from "../field.jsx";
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
import { createDispatcher } from "./create_dispatcher.jsx";
import { PickerContext, PickerDispatcherContext } from "./picker_context.jsx";
import { pickerMiddlewares } from "./picker_middlewares.jsx";

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
      --picker-border-color: light-dark(#767676, #8e8e93);
      --picker-background-color: white;
      --picker-color: currentColor;
      --picker-placeholder-color: color-mix(
        in srgb,
        currentColor 60%,
        transparent
      );
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
      --picker-right-slot-size: 1.5em;
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
    color: var(--picker-color);
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
    cursor: pointer;
    user-select: none;
    overflow: hidden;

    &[data-hover] {
      --x-picker-background-color: var(--picker-background-color-hover);
      --x-picker-border-color: var(--picker-border-color-hover);
    }
    &[data-focus-visible] {
      --x-picker-border-color: transparent;
      outline-style: solid;
    }
    &[data-focus-within] {
      --x-picker-border-color: transparent;
      outline-style: solid;
    }
    &[data-expanded] {
      --x-picker-border-color: transparent;
      outline-style: solid;
    }
    &[data-disabled] {
      opacity: 0.5;
      cursor: default;
    }
    &[data-callout] {
      --x-picker-border-color: var(--callout-color);
    }

    .navi_picker_placeholder {
      color: var(--picker-placeholder-color);
    }
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
  }

  .navi_picker_color_display {
    position: absolute;
    top: var(--x-picker-padding-top);
    right: var(--x-picker-padding-right);
    bottom: var(--x-picker-padding-bottom);
    left: var(--x-picker-padding-left);
    display: block;
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
const renderPicker = createDispatcher(
  pickerMiddlewares,
  PickerDispatcherContext,
);

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
    onMouseDown,
    onClick,
    // input constraint attributes — forwarded to hidden <input>, not the button
    required,
    min,
    max,
    step,
    // children,
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
  const innerReadOnly = readOnly || contextReadOnly || innerLoading;
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
      navi-has-placeholder={placeholder ? "" : undefined}
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
      onMouseDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        if (innerDisabled || innerReadOnly) {
          return;
        }
        onMouseDown?.(e);
      }}
      onClick={(e) => {
        if (e.button !== 0) {
          return;
        }
        if (innerDisabled || innerReadOnly) {
          return;
        }
        onClick?.(e);
      }}
    >
      <LoadingOutline
        loading={innerLoading}
        color="var(--loader-color)"
        inset={-1}
      />
      <PickerContext.Provider
        value={{
          placeholder,
          value: uiState,
        }}
      >
        {ui}
      </PickerContext.Provider>
      <span className="navi_picker_right_slot">
        <Icon size="m">{icon}</Icon>
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
        disabled={innerDisabled || innerReadOnly}
        data-rendered-by=".navi_picker"
        onChange={(e) => {
          const newValue = e.currentTarget.value;
          uiStateController.setUIState(newValue, e);
          onChange?.(e);
        }}
      />
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
