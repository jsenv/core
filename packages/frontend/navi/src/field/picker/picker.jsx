import { dispatchCustomEvent } from "@jsenv/dom";
import { useContext, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { ChevronDownSvg } from "@jsenv/navi/src/graphic/icons/chevron_updown_svg.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { createComponentResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
// import { useFieldInterfaceProps } from "../field_hooks.jsx";
import { useStableCallback } from "@jsenv/navi/src/utils/use_stable_callback.js";
import { useOnInputValueChange } from "../input/input_value_listener.js";
import { useTextualFieldInterfaceProps } from "../input/use_textual_field_interface_props.js";
import { createUICallback } from "../ui_callback.js";
import { dispatchRequestAction } from "../validation/custom_constraint_validation.js";
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
  props.ref = props.ref || defaultRef;
  const picker = renderPicker(PickerButton, props);

  return picker;
};
const renderPicker = createComponentResolver(pickerResolvers);
const PickerButton = (props) => {
  import.meta.css = css;
  const { ref, icon, placeholder, ui, onChange } = props;
  const inputRef = useRef(null);
  const [inputFieldInterfaceProps, remainingProps] =
    useTextualFieldInterfaceProps(
      {
        ...props,
        ref: inputRef,
      },
      {
        fieldType: "picker_input",
      },
    );
  const { id, value, basePseudoState, disabled, children } =
    inputFieldInterfaceProps;
  const loading = basePseudoState[":-navi-loading"];

  const onChangeStable = useStableCallback(onChange);
  useOnInputValueChange(
    inputRef,
    (e) => {
      onChangeStable?.(e);
      const input = inputRef.current;
      dispatchRequestAction(input, { event: e });
    },
    {
      waitForChange: true,
    },
  );

  return (
    <Box
      as="button"
      ref={ref}
      type="button"
      baseClassName="navi_picker"
      navi-field=".navi_picker_input"
      navi-has-placeholder={placeholder ? "" : undefined}
      pseudoStateSelector=".navi_picker_input"
      pseudoClasses={PICKER_PSEUDO_CLASSES}
      disabled={disabled}
      {...remainingProps}
      basePseudoState={basePseudoState} // inherit input pseudo states
      // we must put the id on the button and not the input
      // so that a <label> tries to give focus to the button and not the input
      id={id}
      icon={undefined}
      ui={undefined}
      onnavi_get_managed_fields={(e) => {
        // we must check for the pickerEl content to search for a valid input because we might be a button used to validate for instance
        // no necessarily the field itself
        const pickerEl = e.currentTarget;
        const managedField = getPickerManagedField(pickerEl);
        e.detail.respondWith(managedField);
      }}
    >
      <LoadingOutline
        loading={loading}
        color="var(--picker-loader-color)"
        inset={-1}
      />
      <PickerContext.Provider value={{ placeholder, value }}>
        {ui === undefined ? <PickerDefaultUI /> : ui}
      </PickerContext.Provider>
      <PickerInput
        {...inputFieldInterfaceProps}
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
  return (
    <Box
      as="input"
      {...props}
      className="navi_picker_input"
      navi-rendered-by=".navi_picker"
      tabIndex={-1}
    />
  );
};
const getPickerManagedField = (pickerEl) => {
  let pickerInput = pickerEl.querySelector(".navi_picker_input");
  let firstField;
  let sibling = pickerInput.nextElementSibling;
  while (sibling) {
    const candidate = findFieldWithName(sibling);
    if (candidate) {
      firstField = candidate;
      return firstField;
    }
    sibling = sibling.nextElementSibling;
  }
  return null;
};
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

Picker.update = createUICallback({
  name: "Picker.update",
  action: (value, e) => {
    return dispatchToPicker(e, "navi_picker_set_value", { value });
  },
});
Picker.cancel = createUICallback({
  name: "Picker.cancel",
  event: (e) => dispatchToPicker(e, "navi_picker_request_cancel"),
  action: (_, e) => {
    return dispatchToPicker(e, "navi_picker_request_cancel");
  },
});
Picker.submit = createUICallback({
  name: "Picker.submit",
  event: (e) => dispatchToPicker(e, "navi_request_action"),
  action: (_, e) => {
    return dispatchToPicker(e, "navi_request_action");
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
