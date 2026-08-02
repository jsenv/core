import { performTabNavigation } from "@jsenv/dom";
import { useContext, useEffect, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { ChevronDownSvg } from "@jsenv/navi/src/graphic/icons/chevron_updown_svg.jsx";
import { CloseSvg } from "@jsenv/navi/src/graphic/icons/close_svg.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { Text } from "@jsenv/navi/src/text/text.jsx";
import { renderSafe } from "@jsenv/navi/src/utils/render_safe.js";
import {
  ControlFacadeChildrenWrapper,
  useControlFacadeProps,
} from "../control_hooks.jsx";
import { getUIStateControllerById } from "../controller_registry.js";
import { Button } from "../input/button.jsx";
import { resolveInputProps } from "../input/resolve_input_props.js";
import { useAutoSelectReadOnly } from "../input/use_autoselect_read_only.js";
import { createOpenToken } from "../rules/control_callout.js";
import { dispatchRequestInteraction } from "../rules/control_interaction.js";
import {
  dispatchRequestClearUIState,
  dispatchRequestSetUIState,
} from "../ui_state_dom.js";
import { PickerContext } from "./picker_context.jsx";
import { PickerCustomResolver } from "./picker_custom.jsx";
import { PickerPresetResolver } from "./picker_preset.jsx";
import {
  CalendarSvg,
  ClockSvg,
  ColorSvg,
  DurationSvg,
  FileSvg,
  PencilSvg,
  PickerArrayUI,
  PickerColorUI,
  PickerControlGroupUI,
  PickerDatetimeUI,
  PickerDateUI,
  PickerDurationUI,
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

    /* Deliberately NOT positioned: the popup children live in here, and a
       layer="local" Popover/Dialog takes its nearest positioned ancestor as
       containing block — the trigger would cap it at the height of one line and
       clip it. Everything that needs a containing block (the custom-UI input
       overlay, the loading outline) lives in .navi_picker_box below instead.
       This element stays a real box so the sizing props a caller puts on the
       picker (minWidth, expandX…) still apply; the box just fills it. */
    display: inline-flex;
    box-sizing: border-box;
    max-width: 100%;
    /* Inherited properties stay here: a caller's own size/color lands on this
       element, and re-declaring them on the box below would override what it
       would otherwise inherit. */
    color: var(--x-picker-color);
    font-size: var(--picker-font-size);
    font-family: var(--picker-font-family);
    text-align: inherit;

    .navi_picker_box {
      position: relative;
      display: inline-flex;
      box-sizing: border-box;
      min-width: 0;
      max-width: 100%;
      min-height: calc(
        1lh + var(--x-picker-padding-top) + var(--x-picker-padding-bottom)
      );
      padding-top: var(--x-picker-padding-top);
      padding-right: 0;
      padding-bottom: var(--x-picker-padding-bottom);
      padding-left: 0;
      flex: 1 1 auto;
      flex-direction: row;
      align-items: center;
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
      /* user-select: none; */
      -webkit-tap-highlight-color: var(--navi-control-tap-highlight-color);
    }

    .navi_picker_value {
      display: inline-block;
      min-width: 0;
      max-width: 100%;
      margin-top: calc(-1 * var(--x-picker-padding-top));
      margin-bottom: calc(-1 * var(--x-picker-padding-bottom));
      padding-top: var(--x-picker-padding-top);
      padding-right: var(--x-picker-padding-right);
      padding-bottom: var(--x-picker-padding-bottom);
      padding-left: var(--x-picker-padding-left);
      flex-grow: 1;
      justify-content: inherit;
      pointer-events: none;
      user-select: none;

      &[navi-placeholder] {
        color: var(--picker-placeholder-color);
      }
    }
    .navi_picker_right_slot {
      display: inline-flex;
      height: 1em;
      height: 1lh;
      /* Half the horizontal padding by default, so what sits in the slot lines
         up with the gutter the value already has; slotSpacing overrides it */
      margin-right: var(
        --picker-slot-spacing,
        calc(var(--x-picker-padding-right) * 0.5)
      );
      flex-shrink: 0;
      align-items: center;
      align-self: flex-start;
      justify-content: center;
      color: var(--x-picker-icon-color);
      /* Transparent to the pointer: the chevron is decoration, and a click on
         it means "open the picker", which is what the input underneath does. */
      pointer-events: none;

      .navi_icon {
        max-height: 100%;
      }
      /* The clear button is the exception — it is a real target with its own
         intention (clear, the opposite of open), so it takes its clicks back. */
      .navi_button {
        pointer-events: auto;
      }
    }
    &[navi-single-line] {
      .navi_picker_right_slot {
        align-self: center;
      }
    }
    .navi_picker_input {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      background: none;
      border: none;
      border-radius: inherit;
      outline: none;
      cursor: inherit;
      pointer-events: auto;

      &::-webkit-calendar-picker-indicator {
        cursor: inherit;
      }
    }

    &[navi-ui-custom] {
      .navi_picker_input {
        position: absolute;
        top: calc(-1 * var(--picker-border-width));
        right: calc(-1 * var(--picker-border-width));
        bottom: calc(-1 * var(--picker-border-width));
        left: calc(-1 * var(--picker-border-width));
        /* Reset width/height for input color */
        width: auto;
        height: auto;

        opacity: 0;
        appearance: none;
      }
    }

    .navi_picker_content {
      display: contents;
      text-align: initial; /* Don't inherit picker text align */
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
    &[data-focus-within]:has(.navi_picker_input[data-focus-visible]) {
      --x-picker-border-color: transparent;

      .navi_picker_box {
        outline-style: solid;
      }
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
      --picker-border-width: 0px; /* must carry a unit (px) — used in calc() to offset the custom input overlay */
      --x-picker-border-color: transparent;
      --x-picker-background-color: transparent;
      --x-picker-icon-color: currentColor;
    }
    &[data-variant="headless"] {
      --x-picker-padding-top: 0;
      --x-picker-padding-right: 0;
      --x-picker-padding-bottom: 0;
      --x-picker-padding-left: 0;
      --picker-border-width: 0px; /* must carry a unit (px) — used in calc() to offset the custom input overlay */
      --x-picker-border-color: transparent;
      --x-picker-background-color: transparent;
      --x-picker-icon-color: currentColor;

      .navi_picker_box {
        position: absolute;
        inset: 0;
        z-index: -1;
      }
    }
  }
`;

const PickerButton = (props) => {
  import.meta.css = css;
  if (typeof props.maxLines === "string") {
    props.maxLines = parseInt(props.maxLines);
  }
  const {
    ref,
    variant,
    icon,
    iconSize = "inherit",
    placeholder,
    ui,
    maxLines = 1,
    // By default the popover is at least as wide as the trigger (min-width:
    // --anchor-width). Set true when the CONTENT should dictate the popover width
    // (e.g. a Wheel) instead of being stretched to the trigger — see
    // picker_custom.jsx.
    popupWidthFitContent,
    // Adds a clear button to the right slot, the same one type="search" puts at
    // the end of an input: a picker holds a value the user chose, and unsetting
    // it should not require reopening the popup to hunt for a "none" entry.
    clearable,
    error,
  } = props;
  const isSingleLine = maxLines === 1;
  const inputRef = useRef(null);
  const [pickerRemainingProps, inputProps, facadeChildrenProps] =
    useControlFacadeProps(
      {
        ...props,
        ref: inputRef,
      },
      {
        controlType: "picker",
      },
    );
  const uiStateController = getUIStateControllerById(inputProps.id);
  const value = uiStateController.uiState;
  const { basePseudoState, children } = inputProps;
  const loading = basePseudoState[":-navi-loading"];
  usePickerErrorCallout(uiStateController, error);

  return (
    <Box
      as="div"
      ref={ref}
      baseClassName="navi_picker"
      pseudoClasses={PICKER_BUTTON_PSEUDO_CLASSES}
      data-variant={variant}
      navi-picker=""
      navi-single-line={isSingleLine ? "" : undefined}
      navi-ui-custom={ui === "default" ? undefined : ""}
      data-popup-width-fit-content={popupWidthFitContent ? "" : undefined}
      {...pickerRemainingProps}
      basePseudoState={basePseudoState}
      styleCSSVars={PickerStyleCSSVars}
      variant={undefined}
      icon={undefined}
      iconSize={undefined}
      ui={undefined}
      maxLines={undefined}
      popupWidthFitContent={undefined}
      error={undefined}
      dayLabel={undefined}
      // This wrapper will receive keyboard event bubbling from the picker popup content
      // we re-dispatch on the input (to get escape to close for instance)
      onKeyDown={inputProps.onKeyDown}
      // in case request open/close are dispatched on the control root ->
      // redispatch them to the host
      onnavi_request_open={inputProps.onnavi_request_open}
      onnavi_request_close={inputProps.onnavi_request_close}
    >
      <span className="navi_picker_box">
        {variant === "headless" ? null : (
          <LoadingOutline
            loading={loading}
            color="var(--picker-loader-color)"
            inset={-2}
          />
        )}
        <PickerInput
          tabIndex={variant === "headless" ? -1 : undefined}
          aria-hidden={variant === "headless" ? "true" : undefined}
          {...inputProps}
          // eslint-disable-next-line react/no-children-prop
          children={undefined} // we will render children into the div
          ui={ui}
          onFocus={(e) => {
            inputProps.onFocus?.(e);
            e.target.select();
          }}
          onCopy={(e) => {
            const pickerEl = ref.current;
            if (isWithinPickerContent(e.target, pickerEl)) {
              return;
            }
            const uiState = uiStateController.uiState;
            if (uiState === undefined) {
              return;
            }
            e.preventDefault();
            const displayText =
              pickerEl.querySelector(".navi_picker_value")?.textContent ??
              String(uiState);
            e.clipboardData.setData("text/plain", displayText);
            e.clipboardData.setData(
              "application/x-navi",
              JSON.stringify(uiState),
            );
          }}
          onCut={(e) => {
            const pickerEl = ref.current;
            if (isWithinPickerContent(e.target, pickerEl)) {
              return;
            }
            const uiState = uiStateController.uiState;
            if (uiState === undefined) {
              return;
            }
            // the copy part don't need control to be interactable
            const displayText =
              pickerEl.querySelector(".navi_picker_value")?.textContent ??
              String(uiState);
            e.clipboardData.setData("text/plain", displayText);
            e.clipboardData.setData(
              "application/x-navi",
              JSON.stringify(uiState),
            );
            // the clear ui state part need control to be interactable
            dispatchRequestInteraction(pickerEl, {
              event: e,
              name: "cut",
              allowed: () => {
                dispatchRequestClearUIState(inputRef.current, e);
              },
            });
            e.preventDefault();
          }}
          onPaste={(e) => {
            const pickerEl = ref.current;
            if (isWithinPickerContent(e.target, pickerEl)) {
              // Don't intercept inside the picker popup content.
              return;
            }
            const naviData = e.clipboardData.getData("application/x-navi");
            let pasteValue;
            if (naviData) {
              try {
                pasteValue = JSON.parse(naviData);
              } catch {
                pasteValue = naviData;
              }
            } else {
              pasteValue = e.clipboardData.getData("text/plain");
            }
            dispatchRequestInteraction(pickerEl, {
              event: e,
              name: "paste",
              allowed: () => {
                dispatchRequestSetUIState(inputRef.current, pasteValue, {
                  event: e,
                });
              },
            });
            e.preventDefault();
          }}
        />
        {variant === "icon" ||
        variant === "headless" ||
        ui === "default" ? null : (
          <Text
            className="navi_picker_value"
            navi-placeholder={
              value === undefined || value === "" ? "" : undefined
            }
            maxLines={maxLines}
          >
            <PickerContext.Provider value={{ value, placeholder, maxLines }}>
              {ui === undefined ? <PickerDefaultUI /> : ui}
            </PickerContext.Provider>
          </Text>
        )}
        {variant === "headless" || ui === "default" ? null : (
          <span className="navi_picker_right_slot">
            {clearable && value !== undefined && value !== "" ? (
              <Button
                command="--navi-clear"
                commandFor={inputProps.id}
                tabIndex="-1"
                // No navi-focus-delegate, unlike the identical button inside an
                // input: handing focus back to the picker's own input is what
                // opens the popup, and clearing is the opposite intention.
                icon
                variant="discrete"
                // preventDefault, not just tabIndex="-1": a mousedown focuses
                // its target before any click happens, and this button should
                // never hold focus at all — the field keeps it.
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
              >
                <Icon size={iconSize}>
                  <CloseSvg />
                </Icon>
              </Button>
            ) : (
              <Icon size={iconSize}>
                {icon === undefined ? <ChevronDownSvg /> : icon}
              </Icon>
            )}
          </span>
        )}
      </span>
      <ControlFacadeChildrenWrapper {...facadeChildrenProps}>
        <div className="navi_picker_content">{children}</div>
      </ControlFacadeChildrenWrapper>
    </Box>
  );
};
const isWithinPickerContent = (el, pickerEl) => {
  return pickerEl.querySelector(".navi_picker_content")?.contains(el);
};

const PICKER_ERROR_TOKEN = createOpenToken();
// The `error` prop rides the control's own callout — the same surface already
// used for failing constraints — so a caller never has to decide where to put
// the message. It shows whether the popup is open or closed, and dismissing it
// discards that error: only a new `error` value raises another one.
const usePickerErrorCallout = (uiStateController, error) => {
  useEffect(() => {
    const { callout } = uiStateController.rules;
    const closeEvent = new CustomEvent("picker_error_cleared", { detail: {} });
    if (!error) {
      callout.removeOpenToken(PICKER_ERROR_TOKEN, closeEvent);
      return undefined;
    }
    callout.addOpenToken(PICKER_ERROR_TOKEN, {
      message: error === true ? "Something went wrong." : error,
      status: "error",
      skipFocus: true,
    });
    return () => {
      callout.removeOpenToken(PICKER_ERROR_TOKEN, closeEvent);
    };
  }, [error]);
};

const PickerInput = (props) => {
  const { ui, readOnly } = props;

  // After type resolution: force readOnly when the input type would open the
  // mobile keyboard. We also suppress the visual ":read-only" state so the
  // picker still looks interactive (it is — just not keyboard-typeable).
  const readOnlyForced = readOnly
    ? false
    : isOpeningKeyboardOnMobile(props.type);

  const autoSelectReadOnlyProps = useAutoSelectReadOnly(props);

  return (
    <Box
      as="input"
      {...props}
      readOnly={readOnlyForced ? true : readOnly}
      data-readonly-forced={readOnlyForced ? "" : undefined}
      // Forced readOnly only means "not typeable" — the value comes from the
      // popup, so the clear button must keep working. An explicitly readOnly
      // picker is a different intent (inert) and keeps the veto.
      data-clearable-when-readonly={readOnlyForced ? "" : undefined}
      // A forced-readonly picker trigger is button-like — it can't be typed
      // into, so it shouldn't get the browser's eager text-input focus ring on
      // mouse. Gate the ring on keyboard use instead (see pseudo_styles.js). An
      // editable picker (readOnlyForced false) keeps native input focus-visible.
      data-prevent-eager-focus-visible=""
      ui={undefined}
      className="navi_picker_input"
      pseudoClasses={PickerInputPseudoClasses}
      onKeyDown={(e) => {
        props.onKeyDown(e);
        if (e.key === "Enter") {
          // prevent form submission now that input can have focus
          e.preventDefault();
        } else if (e.key === "Tab" && ui !== "default") {
          // Ensure tab does not tab through the browser picker elements (like in input date)
          performTabNavigation(e);
        }
      }}
      {...autoSelectReadOnlyProps}
    />
  );
};
// Input types that open the software keyboard on mobile.
// When the picker's underlying input has one of these types, we force readOnly
// so tapping the picker doesn't open the keyboard (the picker manages its own UI).
const isOpeningKeyboardOnMobile = (type) => {
  if (NON_MOBILE_KEYBOARD_TYPES.has(type)) {
    return false;
  }
  return true; // default to text
};
const NON_MOBILE_KEYBOARD_TYPES = new Set([
  "date",
  "month",
  "week",
  "time",
  "datetime-local",
  "color",
]);

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
  ":focus",
  ":focus-visible",
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
  "popoverMaxHeight": "--picker-popover-max-height",
  "popupBackgroundColor": "--picker-popup-background-color",
  "popupBorderRadius": "--picker-popup-border-radius",
  "dialogBorderWidth": "--picker-dialog-border-width",
  "slotSpacing": "--picker-slot-spacing",
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
    return renderSafe(placeholder);
  }
  return renderSafe(value);
};

const PickerFirstResolver = (props) => {
  const Next = useNextResolver();
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;
  resolveInputProps(props);

  return <Next {...props} />;
};

/**
 * Button-like trigger that opens a picker (native or custom popup) when clicked.
 *
 * Without `children`, opens the browser-native picker for the given `type`.
 * With `children`, opens a popover (desktop) or dialog (mobile) containing the children.
 * Pass `mode="popover"` or `mode="dialog"` to override the automatic choice.
 *
 * @type {import("preact").FunctionComponent<{
 *   type?: "date" | "month" | "week" | "time" | "datetime" | "color" | "hour" | "navi_time" | "navi_number" | "navi_percentage",
 *   value?: any,
 *   defaultValue?: any,
 *   name?: string,
 *   placeholder?: import("preact").ComponentChildren,
 *   required?: boolean,
 *   min?: Date | string | number,
 *   max?: Date | string | number,
 *   step?: string | number,
 *   disabled?: boolean,
 *   readOnly?: boolean,
 *   error?: boolean | string,
 *   uiAction?: (value: any, event: Event) => void,
 *   action?: (value: any, event: Event) => void,
 *   children?: import("preact").ComponentChildren,
 *   mode?: "popover" | "dialog",
 *   popoverMode?: "nearby" | "overlay",
 *   positionArea?: string,
 *   popupWidthFitContent?: boolean,
 *   variant?: "icon" | "headless",
 *   icon?: import("preact").ComponentChildren,
 *   maxLines?: number,
 *   slotSpacing?: number | string,
 *   popoverMaxHeight?: number | string,
 *   popupBackgroundColor?: string,
 *   popupBorderRadius?: number | string,
 *   clearable?: boolean,
 *   popupLayer?: "top" | "local",
 *   dialogExpand?: boolean,
 *   dialogExpandX?: boolean,
 *   dialogExpandY?: boolean,
 *   ref?: import("preact").RefObject<HTMLElement>,
 *   [key: string]: any,
 * }>}
 * @param {boolean|string} [error] Something went wrong around this picker (its
 *   content failed to load, its value could not be resolved…). Shown as a
 *   callout on the trigger, open or closed — the caller has nothing to place.
 *   Dismissing it discards that error; a new `error` value raises another one.
 * @param {"nearby"|"overlay"} [popoverMode="nearby"] "overlay" lays the popover
 *   over the trigger, "nearby" leaves a small gap below it.
 * @param {string} [positionArea] Where the popup goes — relative to the trigger
 *   in popover mode, relative to the viewport in dialog mode. Same grammar as
 *   Popover/Dialog's own `positionArea` ("top", "right-end", "inset(top-left)",
 *   …). Defaults to "bottom-start" in popover mode ("inset(top-left)" when
 *   popoverMode is "overlay"), and to Dialog's own "center" in dialog mode. A
 *   popover still flips to the opposite side on its own when there isn't
 *   enough room.
 * @param {boolean} [popupWidthFitContent] By default the popup is at least as
 *   wide as the trigger. Set this to let the content size it instead, so a
 *   popup narrower than the trigger stays narrow.
 * @param {number|string} [slotSpacing] Gap kept between what sits in the right
 *   slot (the chevron, or the clear button) and the picker's own edge — same
 *   prop name Input uses for its own slots. Accepts a spacing token ("s",
 *   "m"…) like any other spacing prop, or a length. Defaults to half the
 *   horizontal padding.
 * @param {number|string} [popoverMaxHeight] Soft cap on the popover's height
 *   (default 300px). The popover shrinks below it when space is tight.
 */
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
Picker.UI.Duration = PickerDurationUI;
Picker.UI.Week = PickerWeekUI;
Picker.UI.Datetime = PickerDatetimeUI;
Picker.UI.File = PickerFileUI;
Picker.UI.Color = PickerColorUI;
Picker.UI.ControlGroup = PickerControlGroupUI;
Picker.UI.Multiple = PickerArrayUI;

Picker.UI.PencilSvg = PencilSvg;
Picker.UI.ChevronDownSvg = ChevronDownSvg;
Picker.UI.ClockSvg = ClockSvg;
Picker.UI.DurationSvg = DurationSvg;
Picker.UI.CalendarSvg = CalendarSvg;
Picker.UI.FileSvg = FileSvg;
Picker.UI.ColorSvg = ColorSvg;
