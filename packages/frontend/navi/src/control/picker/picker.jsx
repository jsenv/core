import { useContext, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { ChevronDownSvg } from "@jsenv/navi/src/graphic/icons/chevron_updown_svg.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { createComponentResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { useControlProps } from "../control_hooks.jsx";
import { asControlHostValue } from "../control_value.js";
import { resolveInputProps } from "../input/resolve_input_props.js";
import { PickerPlaceholder, PickerValue } from "./picker_components.jsx";
import { PickerContext } from "./picker_context.jsx";
import { pickerResolvers } from "./picker_resolvers.jsx";
import {
  PickerColorUI,
  PickerDatetimeUI,
  PickerDateUI,
  PickerFileUI,
  PickerTimeUI,
  PickerWeekUI,
} from "./picker_types.jsx";

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
      --picker-color-disabled: var(--picker-color-dimmed);
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
      var(--x-picker-padding-right-base) + var(--picker-right-slot-size) - 2px
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
    display: inline-block;
    box-sizing: border-box;
    max-width: 100%;
    min-height: calc(
      1lh + var(--x-picker-padding-top) + var(--x-picker-padding-bottom)
    );
    padding-top: var(--x-picker-padding-top);
    padding-right: var(--x-picker-padding-right);
    padding-bottom: var(--x-picker-padding-bottom);
    padding-left: var(--x-picker-padding-left);
    flex-direction: row;
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
    overflow: hidden;

    .navi_picker_value {
      display: block;
      min-width: 0;
      max-width: 100%;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    }
    .navi_picker_placeholder {
      display: block;
      max-width: 100%;
      color: var(--picker-placeholder-color);
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    }
    .navi_picker_right_slot {
      position: absolute;
      top: 0;
      right: 0;
      display: inline-flex;
      width: var(--picker-right-slot-size);
      padding-top: var(--x-picker-padding-top);
      flex-shrink: 0;
      justify-content: center;
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

    &[data-multiline] {
      overflow-wrap: anywhere;

      .navi_picker_placeholder {
        white-space: normal;
      }
      .navi_picker_value {
        white-space: normal;
      }
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

const renderPicker = createComponentResolver(pickerResolvers);
const PickerButton = (props) => {
  import.meta.css = css;
  resolveInputProps(props);
  const { ref, icon, placeholder, singleLine, ui, dayLabel } = props;
  const inputRef = useRef(null);
  const [inputProps, pickerRemainingProps, ControlChildrenWrapper] =
    useControlProps(
      {
        ...props,
        ref: inputRef,
      },
      {
        controlType: "input",
        statePropName: "value",
        defaultStatePropName: "defaultValue",
        readOnlySupported: true,
        picker: true,
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
      navi-has-placeholder={placeholder ? "" : undefined}
      pseudoClasses={PICKER_BUTTON_PSEUDO_CLASSES}
      disabled={disabled}
      data-single-line={singleLine ? "" : undefined}
      {...pickerRemainingProps}
      basePseudoState={basePseudoState}
      styleCSSVars={PickerStyleCSSVars}
      // we must put the id on the button and not the input
      // so that a <label> tries to give focus to the button and not the input
      id={id}
      icon={undefined}
      ui={undefined}
      singleLine={undefined}
      dayLabel={undefined}
      // The button is handling the pointer interactions
      onMouseDown={(e) => {
        inputProps.onMouseDown(e);
      }}
      onClick={(e) => {
        inputProps.onClick(e);
      }}
      onKeyDown={(e) => {
        // The button has the focus so he is the one handling keydown interactions
        // it's also the one wrapping other elements so keydown bubbling will reach the button
        // but neevr the input
        inputProps.onKeyDown(e);
      }}
    >
      <LoadingOutline
        loading={loading}
        color="var(--picker-loader-color)"
        inset={-1}
      />
      <PickerInput
        {...inputProps}
        // eslint-disable-next-line react/no-children-prop
        children={undefined} // we will render children into the button
        id={undefined}
        onMouseDown={undefined}
        onClick={undefined}
        onKeyDown={undefined}
      />
      <PickerContext.Provider value={{ value, placeholder, dayLabel }}>
        {ui === undefined ? <PickerDefaultUI /> : ui}
      </PickerContext.Provider>
      <span className="navi_picker_right_slot">
        <Icon size="m">{icon === undefined ? <ChevronDownSvg /> : icon}</Icon>
      </span>
      <ControlChildrenWrapper>{children}</ControlChildrenWrapper>
    </Box>
  );
};

const PickerInput = (props) => {
  const { type } = props;
  return (
    <Box
      as="input"
      {...props}
      value={asControlHostValue(props.value, { controlType: "input", type })}
      className="navi_picker_input"
      pseudoClasses={PickerInputPseudoClasses}
      tabIndex={-1} // Make input non tabbable
      navi-focus-delegate="" // Ensure callout focus the button and not the input
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

const PickerStyleCSSVars = {
  "outlineWidth": "--picker-outline-width",
  "borderWidth": "--picker-border-width",
  "borderRadius": "--picker-border-radius",
  "padding": "--picker-padding",
  "paddingX": "--picker-padding-x",
  "paddingY": "--picker-padding-y",
  "paddingTop": "--picker-padding-top",
  "paddingRight": "--picker-padding-right",
  "paddingBottom": "--picker-padding-bottom",
  "paddingLeft": "--picker-padding-left",
  "borderColor": "--picker-border-color",
  "backgroundColor": "--picker-background-color",
  "color": "--picker-color",
  ":hover": {
    backgroundColor: "--picker-background-color-hover",
    borderColor: "--picker-border-color-hover",
  },
  ":read-only": {
    backgroundColor: "--picker-background-color-readonly",
    borderColor: "--picker-border-color-readonly",
    color: "--picker-color-readonly",
  },
  ":disabled": {
    backgroundColor: "--picker-background-color-disabled",
    borderColor: "--picker-border-color-disabled",
    color: "--picker-color-disabled",
  },
};

const PickerDefaultUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    if (!placeholder) {
      return null;
    }
    return <PickerPlaceholder>{placeholder}</PickerPlaceholder>;
  }
  return <PickerValue>{value}</PickerValue>;
};
Picker.UI = PickerDefaultUI;

Picker.UI.Date = PickerDateUI;
Picker.UI.Time = PickerTimeUI;
Picker.UI.Week = PickerWeekUI;
Picker.UI.Datetime = PickerDatetimeUI;
Picker.UI.File = PickerFileUI;
Picker.UI.Color = PickerColorUI;
