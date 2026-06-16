import { useContext, useId, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { ChevronDownSvg } from "@jsenv/navi/src/graphic/icons/chevron_updown_svg.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { Text } from "@jsenv/navi/src/text/text.jsx";
import {
  ControlFacadeChildrenWrapper,
  useControlFacadeProps,
} from "../control_hooks.jsx";
import { resolveInputProps } from "../input/resolve_input_props.js";
import { getUIStateControllerById } from "../ui_state_controller.js";
import { PickerContext } from "./picker_context.jsx";
import { PickerCustomResolver } from "./picker_custom.jsx";
import { PickerPresetResolver } from "./picker_preset.jsx";
import {
  CalendarSvg,
  ClockSvg,
  ColorSvg,
  FileSvg,
  PencilSvg,
  PickerArrayUI,
  PickerColorUI,
  PickerControlGroupUI,
  PickerDatetimeUI,
  PickerDateUI,
  PickerFileUI,
  PickerTimeUI,
  PickerTypeResolver,
  PickerWeekUI,
} from "./picker_types.jsx";

const css = /* css */ `
  @layer navi {
    .navi_picker {
      --picker-border-radius: var(--navi-control-border-radius);
      --picker-border-width: var(--navi-control-border-width);
      /* Focus outline */
      --picker-outline-width: var(--navi-focus-outline-width);
      --picker-outline-offset: calc(-1 * var(--picker-outline-width) / 2);
      --picker-outline-color: var(--navi-focus-outline-color);
      /* Focus outline end */
      --picker-padding-x-default: var(--navi-picker-padding-x-default);
      --picker-padding-y-default: var(--navi-picker-padding-y-default);
      --picker-font-size: var(--navi-control-font-size);
      --picker-font-family: var(--navi-control-font-family);
      --picker-loader-color: var(--navi-loader-color);
      --picker-border-color: var(--navi-control-border-color);
      --picker-background-color: white;
      --picker-color: currentColor;
      --picker-placeholder-color: color-mix(
        in srgb,
        currentColor 60%,
        transparent
      );
      --picker-color-dimmed: color-mix(in srgb, currentColor 60%, transparent);
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
    --x-picker-background-color: var(--picker-background-color);
    --x-picker-border-color: var(--picker-border-color);
    --x-picker-padding-top: var(
      --picker-padding-top,
      var(
        --picker-padding-y,
        var(--picker-padding, var(--picker-padding-y-default))
      )
    );
    --x-picker-padding-right: var(
      --picker-padding-right,
      var(
        --picker-padding-x,
        var(--picker-padding, var(--picker-padding-x-default))
      )
    );
    --x-picker-padding-left: var(
      --picker-padding-left,
      var(
        --picker-padding-x,
        var(--picker-padding, var(--picker-padding-x-default))
      )
    );
    --x-picker-padding-bottom: var(
      --picker-padding-bottom,
      var(
        --picker-padding-y,
        var(--picker-padding, var(--picker-padding-y-default))
      )
    );
    --x-picker-color: var(--picker-color);
    --x-picker-icon-color: var(--picker-icon-color);

    position: relative;
    display: inline-flex;
    box-sizing: border-box;
    max-width: 100%;
    min-height: calc(
      1lh + var(--x-picker-padding-top) + var(--x-picker-padding-bottom)
    );
    padding-top: var(--x-picker-padding-top);
    padding-right: 0;
    padding-bottom: var(--x-picker-padding-bottom);
    padding-left: 0;
    flex-direction: row;
    align-items: center;
    gap: var(--navi-xs);
    color: var(--x-picker-color);
    font-size: var(--picker-font-size);
    font-family: var(--picker-font-family);
    text-align: inherit;
    text-overflow: ellipsis;
    background-color: var(--x-picker-background-color);
    border-width: var(--picker-border-width);
    border-style: solid;
    border-color: var(--x-picker-border-color);
    border-radius: var(--picker-border-radius);
    outline-width: var(--picker-outline-width);
    outline-style: none;
    outline-color: var(--picker-outline-color);
    outline-offset: var(--picker-outline-offset);
    cursor: var(--x-picker-cursor, pointer);
    pointer-events: auto;
    user-select: none;
    overflow: hidden;
    -webkit-tap-highlight-color: var(--navi-control-tap-highlight-color);

    .navi_picker_value {
      display: inline-block;
      min-width: 0;
      max-width: 100%;
      margin-inline: 0.2em;
      margin-top: calc(-1 * var(--x-picker-padding-top));
      margin-bottom: calc(-1 * var(--x-picker-padding-bottom));
      padding-top: var(--x-picker-padding-top);
      padding-right: var(--x-picker-padding-right);
      padding-bottom: var(--x-picker-padding-bottom);
      padding-left: var(--x-picker-padding-left);
      flex-grow: 1;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;

      &[navi-placeholder] {
        color: var(--picker-placeholder-color);
      }
    }
    .navi_picker_right_slot {
      display: inline-flex;
      height: 1em;
      height: 1lh;
      flex-shrink: 0;
      align-items: center;
      align-self: flex-start;
      justify-content: center;
      color: var(--x-picker-icon-color);

      .navi_icon {
        height: 100%;
        max-height: 100%;
      }
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

    .navi_picker_content {
      display: contents;
    }

    &[data-line-clamp] {
      overflow-wrap: anywhere;
      .navi_picker_value {
        display: -webkit-box;
        white-space: normal;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: var(--picker-max-lines);
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

    &[data-variant="icon"] {
      --x-picker-padding-top: 0;
      --x-picker-padding-right: 0;
      --x-picker-padding-bottom: 0;
      --x-picker-padding-left: 0;
      --picker-border-width: 0;
      --x-picker-border-color: transparent;
      --x-picker-background-color: transparent;
      --x-picker-icon-color: currentColor;
    }
  }
`;

/**
 * A button-like trigger that opens a picker when clicked.
 *
 * Use the `type` prop to choose what kind of picker to open:
 *   "date"      — calendar day
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
const PickerButton = (props) => {
  import.meta.css = css;
  if (typeof props.maxLines === "string") {
    props.maxLines = parseInt(props.maxLines);
  }
  const { ref, variant, icon, placeholder, ui, maxLines, headless } = props;
  const inputRef = useRef(null);
  const [pickerRemainingProps, inputProps, facadeChildrenProps] =
    useControlFacadeProps(
      {
        ...props,
        ref: inputRef,
      },
      {
        controlType: "picker",
        statePropName: "value",
        defaultStatePropName: "defaultValue",
        readOnlySupported: true,
      },
    );
  const uiStateController = getUIStateControllerById(inputProps.id);
  const value = uiStateController.uiState;
  const { id, basePseudoState, disabled, children } = inputProps;
  const loading = basePseudoState[":-navi-loading"];
  const hasLineClamp = maxLines && maxLines > 1;

  return (
    <Box
      as={headless ? "div" : "button"}
      ref={ref}
      baseClassName="navi_picker"
      pseudoClasses={PICKER_BUTTON_PSEUDO_CLASSES}
      disabled={disabled}
      data-line-clamp={hasLineClamp ? "" : undefined}
      data-variant={variant}
      style={{
        "--picker-max-lines": maxLines,
      }}
      navi-visually-hidden={headless ? "" : undefined}
      navi-picker=""
      {...pickerRemainingProps}
      basePseudoState={basePseudoState}
      styleCSSVars={PickerStyleCSSVars}
      // we must put the id on the button and not the input
      // so that a <label> tries to give focus to the button and not the input
      id={id}
      variant={undefined}
      icon={undefined}
      ui={undefined}
      maxLines={undefined}
      dayLabel={undefined}
      headless={undefined}
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
      onFocus={(e) => {
        if (headless) {
          inputProps.onFocus(e);
        }
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
      {variant === "icon" || headless ? null : (
        <Text
          className="navi_picker_value"
          navi-placeholder={
            value === undefined || value === "" ? "" : undefined
          }
        >
          <PickerContext.Provider value={{ value, placeholder, maxLines }}>
            {ui === undefined ? <PickerDefaultUI /> : ui}
          </PickerContext.Provider>
        </Text>
      )}
      {headless ? null : (
        <span className="navi_picker_right_slot">
          <Icon size="m">{icon === undefined ? <ChevronDownSvg /> : icon}</Icon>
        </span>
      )}
      <ControlFacadeChildrenWrapper {...facadeChildrenProps}>
        <div className="navi_picker_content">{children}</div>
      </ControlFacadeChildrenWrapper>
    </Box>
  );
};

const PickerInput = (props) => {
  return (
    <Box
      as="input"
      {...props}
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
    return placeholder;
  }
  return value;
};

const PickerFirstResolver = (props) => {
  const Next = useNextResolver();
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;
  const idDefault = useId(); // needed by ui state controller
  props.id = props.id || idDefault;

  resolveInputProps(props);

  return <Next {...props} />;
};
export const Picker = createComponentResolver([
  PickerFirstResolver,
  PickerPresetResolver,
  PickerCustomResolver,
  PickerTypeResolver,
  PickerButton,
]);

Picker.UI = PickerDefaultUI;

Picker.UI.Date = PickerDateUI;
Picker.UI.Time = PickerTimeUI;
Picker.UI.Week = PickerWeekUI;
Picker.UI.Datetime = PickerDatetimeUI;
Picker.UI.File = PickerFileUI;
Picker.UI.Color = PickerColorUI;
Picker.UI.ControlGroup = PickerControlGroupUI;
Picker.UI.Multiple = PickerArrayUI;

Picker.UI.PencilSvg = PencilSvg;
Picker.UI.ChevronDownSvg = ChevronDownSvg;
Picker.UI.ClockSvg = ClockSvg;
Picker.UI.CalendarSvg = CalendarSvg;
Picker.UI.FileSvg = FileSvg;
Picker.UI.ColorSvg = ColorSvg;
