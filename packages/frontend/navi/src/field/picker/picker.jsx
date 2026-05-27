import { dispatchCustomEvent } from "@jsenv/dom";
import { useContext, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { ChevronDownSvg } from "@jsenv/navi/src/graphic/icons/chevron_updown_svg.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { createComponentResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { useFieldInterfaceProps } from "../field_hooks.jsx";
import { getFromInputValue, getToInputValue } from "../input/input_textual.jsx";
import { requestClosestAction } from "../string_actions.js";
import { createUICallback } from "../ui_callback.js";
import { dispatchRequestSetUIState } from "../ui_state_controller.js";
import { PickerContext, PickerElementContext } from "./picker_context.jsx";
import { PickerPlaceholder } from "./picker_placeholder.jsx";
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
      /* Icon */
      --picker-icon-color: #5e4e4e;
      --picker-icon-color-readonly: color-mix(
        in srgb,
        var(--picker-icon-color) 45%,
        transparent
      );
      --picker-icon-color-disabled: var(--picker-icon-color-readonly);
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
    --x-picker-color: var(--picker-color);

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
    outline-style: none;
    outline-color: var(--picker-outline-color);
    outline-offset: var(--x-picker-outline-offset);
    cursor: var(--x-picker-cursor, pointer);
    user-select: none;

    .navi_picker_placeholder {
      color: var(--picker-placeholder-color);
    }
    .navi_picker_right_slot {
      position: absolute;
      right: 0;
      width: var(--picker-right-slot-size);
      flex-shrink: 0;
      color: var(--x-picker-icon-color, var(--picker-icon-color));
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
      --x-picker-icon-color: var(--picker-icon-color-readonly);
      --x-picker-cursor: default;
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
      --x-picker-icon-color: var(--picker-icon-color-disabled);
      --x-picker-cursor: default;
    }
    /* Callout (info, warning, error) */
    &[data-callout] {
      --x-picker-border-color: var(--callout-color);
    }
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
  props.ref = props.ref || defaultRef;
  const picker = renderPicker(PickerButton, props);

  return picker;
};
// Allow to synchronously update the picker value (will also dispatch "input" on the button)
Picker.update = createUICallback({
  name: "Picker.update",
  action: (value, e) => {
    const pickerEl = e.currentTarget.closest(".navi_picker");
    if (!pickerEl) {
      return false;
    }
    return dispatchRequestSetUIState(pickerEl, value, { event: e });
  },
});
// Will allow to close the picker without updating the value
// (ideally if an update was called it should still trigger the action?)
Picker.close = createUICallback({
  name: "Picker.close",
  event: (e) => {
    return dispatchToPicker(e, "navi_picker_request_close");
  },
  action: (_, e) => {
    return dispatchToPicker(e, "navi_picker_request_close");
  },
});
// ça demande surement aussi un close
Picker.submit = createUICallback({
  name: "Picker.submit",
  event: (e) => requestClosestAction(e),
  action: (_, e) => {
    return requestClosestAction(e);
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

const renderPicker = createComponentResolver(pickerResolvers);
const PickerButton = (props) => {
  import.meta.css = css;
  const { ref, type, icon, placeholder, ui } = props;
  const inputRef = useRef(null);
  const fromInputValue = getFromInputValue(type);
  const [inputProps, pickerRemainingProps] = useFieldInterfaceProps(
    {
      ...props,
      ref: inputRef,
      // Only wait for the native "change" event (dialog close) when the picker has its own
      // action. Without an action, the change event would trigger a noop action cycle and
      // cause spurious state updates (e.g. when closing the color dialog on form submit).
      actionAfterChange: props.action === undefined ? undefined : true,
    },
    {
      primaryInteractionMode: "pointer",
      fieldType: "input",
      statePropName: "value",
      defaultStatePropName: "defaultValue",
      readOnlySupported: true,
      getUIValue: () => {
        const input = inputRef.current;
        const inputValue = input.value;
        return fromInputValue(inputValue);
      },
    },
  );
  const { id, value, basePseudoState, disabled, children } = inputProps;
  const loading = basePseudoState[":-navi-loading"];

  return (
    <Box
      as="button"
      ref={ref}
      type="button"
      baseClassName="navi_picker"
      navi-field=".navi_picker_input"
      navi-has-placeholder={placeholder ? "" : undefined}
      pseudoClasses={PICKER_BUTTON_PSEUDO_CLASSES}
      disabled={disabled}
      data-action={inputProps["data-action"]}
      {...pickerRemainingProps}
      basePseudoState={basePseudoState}
      // we must put the id on the button and not the input
      // so that a <label> tries to give focus to the button and not the input
      id={id}
      icon={undefined}
      ui={undefined}
      // The button is handling the pointer interactions
      onMouseDown={(e) => {
        inputProps.onMouseDown(e);
      }}
      onClick={(e) => {
        inputProps.onClick(e);
      }}
    >
      <LoadingOutline
        loading={loading}
        color="var(--picker-loader-color)"
        inset={-1}
      />
      <PickerContext.Provider value={{ value, placeholder }}>
        {ui === undefined ? <PickerDefaultUI /> : ui}
      </PickerContext.Provider>
      <PickerInput
        {...inputProps}
        // eslint-disable-next-line react/no-children-prop
        children={undefined} // we will render children into the button
        id={undefined}
      />

      <span className="navi_picker_right_slot">
        <Icon size="m">{icon === undefined ? <ChevronDownSvg /> : icon}</Icon>
      </span>

      {children && (
        <PickerElementContext.Provider value={ref}>
          {children}
        </PickerElementContext.Provider>
      )}
    </Box>
  );
};

const PickerInput = (props) => {
  const { type } = props;
  const toInputValue = getToInputValue(type);
  return (
    <Box
      as="input"
      navi-rendered-by=".navi_picker"
      {...props}
      value={toInputValue(props.value)}
      className="navi_picker_input"
      pseudoClasses={PickerInputPseudoClasses}
      tabIndex={-1}
      onnavi_get_managed_fields={(e) => {
        // we must check for the pickerEl content to search for a valid input because we might be a button used to validate for instance
        // no necessarily the field itself
        const pickerInput = e.currentTarget;
        let firstField;
        let sibling = pickerInput.nextElementSibling;
        while (sibling) {
          const candidate = findFieldWithName(sibling);
          if (candidate) {
            firstField = candidate;
            break;
          }
          sibling = sibling.nextElementSibling;
        }
        e.detail.respondWith(firstField);
      }}
    />
  );
};
const PICKER_BUTTON_PSEUDO_CLASSES = [
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
const PickerInputPseudoClasses = [
  ":read-only",
  ":disabled",
  ":-navi-loading",
  ":-navi-has-value",
  ":-navi-expanded",
];

const findFieldWithName = (el) => {
  const tag = el.tagName.toLowerCase();
  if (
    (tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      tag === "button") &&
    el.name
  ) {
    return el;
  }
  for (const child of el.children) {
    const found = findFieldWithName(child);
    if (found) {
      return found;
    }
  }
  return null;
};
const PickerDefaultUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    if (!placeholder) {
      return null;
    }
    return <PickerPlaceholder>{placeholder}</PickerPlaceholder>;
  }
  return value;
};
