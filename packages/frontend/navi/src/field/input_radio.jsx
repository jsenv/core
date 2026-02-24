import { resolveColorLuminance } from "@jsenv/dom";
import { useCallback, useContext, useLayoutEffect, useRef } from "preact/hooks";

import { renderActionableComponent } from "../action/render_actionable_component.jsx";
import { Box } from "../box/box.jsx";
import { LoaderBackground } from "../graphic/loader/loader_background.jsx";
import { useStableCallback } from "../utils/use_stable_callback.js";
import {
  ReportDisabledOnLabelContext,
  ReportReadOnlyOnLabelContext,
} from "./label.jsx";
import { useAutoFocus } from "./use_auto_focus.js";
import {
  DisabledContext,
  FieldNameContext,
  LoadingContext,
  LoadingElementContext,
  ReadOnlyContext,
  RequiredContext,
  UIStateContext,
  UIStateControllerContext,
  useUIState,
  useUIStateController,
} from "./use_ui_state_controller.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

import.meta.css = /* css */ `
  @layer navi {
    .navi_radio {
      --margin: 3px 3px 0 5px;
      --outline-offset: 1px;
      --outline-width: 2px;
      --width: 0.815em;
      --height: 0.815em;

      --outline-color: var(--navi-focus-outline-color);
      --loader-color: var(--navi-loader-color);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --accent-color: light-dark(#4476ff, #3b82f6);
      --radiomark-color: var(--accent-color);
      --border-color-checked: var(--accent-color);
      --cursor: pointer;

      --color-mix-light: black;
      --color-mix-dark: white;
      --color-mix: var(--color-mix-light);

      /* Hover */
      --border-color-hover: color-mix(in srgb, var(--border-color) 60%, black);
      --border-color-hover-checked: color-mix(
        in srgb,
        var(--border-color-checked) 80%,
        var(--color-mix)
      );
      --radiomark-color-hover: color-mix(
        in srgb,
        var(--radiomark-color) 80%,
        var(--color-mix)
      );
      /* Readonly */
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --background-color-readonly: var(--background-color);
      --radiomark-color-readonly: color-mix(
        in srgb,
        var(--radiomark-color) 30%,
        grey
      );
      --border-color-readonly-checked: color-mix(
        in srgb,
        var(--radiomark-color) 30%,
        transparent
      );
      --background-color-readonly-checked: var(--border-color-readonly-checked);
      /* Disabled */
      --border-color-disabled: var(--border-color-readonly);
      --background-color-disabled: rgba(248, 248, 248, 0.7);
      --radiomark-color-disabled: #d3d3d3;
      --border-color-checked-disabled: #d3d3d3;
      --background-color-disabled-checked: var(--background-color);

      /* Button specific */
      --button-border-width: 1px;
      --button-border-color: transparent;
      --button-background-color: transparent;
      --button-border-color-hover: color-mix(
        in srgb,
        var(--button-border-color) 70%,
        black
      );
      --button-background-color-hover: color-mix(
        in srgb,
        var(--button-border-color) 95%,
        black
      );
      --button-border-color-checked: var(--accent-color);
      --button-background-color-checked: transparent;
      --button-border-color-readonly: #eeeeee;
      --button-background-color-readonly: #d3d3d3;
      --button-border-color-disabled: var(--border-color-readonly);
      --button-background-color-disabled: var(--background-color-readonly);
    }

    &[data-dark] {
      --color-mix: var(--color-mix-dark);
    }
  }

  .navi_radio {
    --x-outline-offset: var(--outline-offset);
    --x-outline-width: var(--outline-width);
    --x-border-width: var(--border-width);
    --x-width: var(--width);
    --x-height: var(--height);
    --x-outline-color: var(--outline-color);
    --x-background-color: var(--background-color);
    --x-border-color: var(--border-color);
    --x-radiomark-color: var(--radiomark-color);
    --x-cursor: var(--cursor);

    position: relative;
    display: inline-flex;
    box-sizing: content-box;
    margin: var(--margin);

    .navi_native_field {
      position: absolute;
      inset: 0;
      margin: 0;
      padding: 0;
      border: none;
      border-radius: inherit;
      opacity: 0;
      appearance: none; /* This allows border-radius to have an effect */
      cursor: var(--x-cursor);
    }

    /* Focus */
    &[data-focus-visible] {
      z-index: 1;
      .navi_radio_field {
        outline-style: solid;
      }
    }
    /* Hover */
    &[data-hover] {
      --x-border-color: var(--border-color-hover);
      --x-radiomark-color: var(--radiomark-color-hover);
    }
    /* Checked */
    &[data-checked] {
      --x-border-color: var(--border-color-checked);

      &[data-hover] {
        --x-border-color: var(--border-color-hover-checked);
      }
    }
    /* Readonly */
    &[data-readonly] {
      --x-cursor: default;
      --x-background-color: var(--background-color-readonly);
      --x-border-color: var(--border-color-readonly);
      --x-radiomark-color: var(--radiomark-color-readonly);

      .navi_radio_dashed_border {
        display: none;
      }

      &[data-checked] {
        --x-background-color: var(--background-color-readonly-checked);
        --x-border-color: var(--border-color-readonly-checked);
        --x-radiomark-color: var(--radiomark-color-readonly);
      }
    }
    /* Disabled */
    &[data-disabled] {
      --x-cursor: default;
      --x-background-color: var(--background-color-disabled);
      --x-border-color: var(--border-color-disabled);
      --x-radiomark-color: var(--radiomark-color-disabled);

      &[data-checked] {
        --x-border-color: var(--border-color-disabled);
        --x-radiomark-color: var(--radiomark-color-disabled);
      }
    }

    .navi_radio_field {
      box-sizing: border-box;
      width: var(--x-width);
      height: var(--x-height);
      outline-width: var(--x-outline-width);
      outline-style: none;
      outline-color: var(--x-outline-color);
      outline-offset: var(--x-outline-offset);
      pointer-events: none;
    }

    /* Radio appearance */
    &[data-appearance="radio"] {
      .navi_radio_field {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;

        svg {
          overflow: visible;
        }

        .navi_radio_border {
          fill: var(--x-background-color);
          stroke: var(--x-border-color);
        }
        .navi_radio_dashed_border {
          display: none;
        }
        .navi_radio_marker {
          width: 100%;
          height: 100%;
          opacity: 0;
          fill: var(--x-radiomark-color);
          transform: scale(0.3);
          transform-origin: center;
          pointer-events: none;
        }
      }

      &[data-transition] {
        .navi_radio_border {
          transition: all 0.15s ease;
        }
        .navi_radio_dashed_border {
          transition: all 0.15s ease;
        }
        .navi_radio_marker {
          transition: all 0.15s ease;
        }
      }

      &[data-checked] {
        .navi_radio_marker {
          opacity: 1;
          transform: scale(1);
        }
      }
    }

    /* Icon appearance */
    &[data-appearance="icon"] {
      --width: auto;
      --height: auto;
      --outline-offset: 2px;
      --outline-width: 2px;
    }

    /* Button appearance */
    &[data-appearance="button"] {
      --margin: 0;
      --outline-offset: 0px;
      --width: auto;
      --height: auto;
      --padding: 2px;
      --border-color: var(--button-border-color);
      --border-color-hover: var(--button-border-color-hover);
      --background-color: var(--button-background-color);
      --background-color-hover: var(--button-background-color-hover);
      --background-color-readonly: var(--button-background-color-readonly);
      --background-color-disabled: var(--button-background-color-disabled);
      --border-color-checked: var(--button-border-color);
      --background-color-checked: var(--button-background-color);

      .navi_radio_field {
        display: inline-flex;
        box-sizing: border-box;
        padding-top: var(--padding-top, var(--padding-y, var(--padding)));
        padding-right: var(--padding-right, var(--padding-x, var(--padding)));
        padding-bottom: var(--padding-bottom, var(--padding-y, var(--padding)));
        padding-left: var(--padding-left, var(--padding-x, var(--padding)));
        align-items: center;
        justify-content: center;
        background-color: var(--x-background-color);
        border-width: var(--button-border-width);
        border-style: solid;
        border-color: var(--x-border-color);
        border-radius: var(--button-border-radius);

        .navi_icon,
        img {
          border-radius: inherit;
        }
      }

      &[data-hover] {
        --x-background-color: var(--button-background-color-hover);
        --x-border-color: var(--button-border-color-hover);
      }
      &[data-checked] {
        --x-border-color: var(--button-border-color-checked);
        --x-background-color: var(--button-background-color-checked);

        .navi_radio_field {
          box-shadow:
            inset 0 2px 4px rgba(0, 0, 0, 0.15),
            inset 0 0 0 1px var(--button-border-color-checked);
        }
      }
      &[data-disabled] {
        --x-border-color: var(--button-border-color-disabled);
        --x-background-color: var(--button-background-color-disabled);
      }
    }
  }
`;

export const InputRadio = (props) => {
  const { value = "on" } = props;
  const uiStateController = useUIStateController(props, "radio", {
    statePropName: "checked",
    fallbackState: false,
    getStateFromProp: (checked) => (checked ? value : undefined),
    getPropFromState: Boolean,
    getStateFromParent: (parentUIStateController) => {
      if (parentUIStateController.componentType === "radio_list") {
        return parentUIStateController.value === props.value;
      }
      return undefined;
    },
  });
  const uiState = useUIState(uiStateController);

  const radio = renderActionableComponent(props, {
    Basic: InputRadioBasic,
    WithAction: InputRadioWithAction,
  });
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>{radio}</UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};

const RadioStyleCSSVars = {
  "width": "--width",
  "height": "--height",
  "borderRadius": "--border-radius",
  "outlineWidth": "--outline-width",
  "borderWidth": "--border-width",
  "backgroundColor": "--background-color",
  "borderColor": "--border-color",
  "accentColor": "--accent-color",
  ":hover": {
    backgroundColor: "--background-color-hover",
    borderColor: "--border-color-hover",
  },
  ":active": {
    borderColor: "--border-color-active",
  },
  ":read-only": {
    backgroundColor: "--background-color-readonly",
    borderColor: "--border-color-readonly",
  },
  ":disabled": {
    backgroundColor: "--background-color-disabled",
    borderColor: "--border-color-disabled",
  },
};
const RadioButtonStyleCSSVars = {
  ...RadioStyleCSSVars,
  "padding": "--padding",
  "borderRadius": "--button-border-radius",
  "borderWidth": "--button-border-width",
  "borderColor": "--button-border-color",
  "backgroundColor": "--button-background-color",
  ":hover": {
    backgroundColor: "--button-background-color-hover",
    borderColor: "--button-border-color-hover",
  },
  ":read-only": {
    backgroundColor: "--button-background-color-readonly",
    borderColor: "--button-border-color-readonly",
  },
  ":disabled": {
    backgroundColor: "--button-background-color-disabled",
    borderColor: "--button-border-color-disabled",
  },
};
const RadioPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":checked",
  ":-navi-loading",
];
const RadioPseudoElements = ["::-navi-loader", "::-navi-radiomark"];
const InputRadioBasic = (props) => {
  const contextName = useContext(FieldNameContext);
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextRequired = useContext(RequiredContext);
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const reportReadOnlyOnLabel = useContext(ReportReadOnlyOnLabelContext);
  const reportDisabledOnLabel = useContext(ReportDisabledOnLabelContext);
  const {
    /* eslint-disable no-unused-vars */
    type,
    /* eslint-enable no-unused-vars */

    name,
    readOnly,
    disabled,
    required,
    loading,
    autoFocus,
    onClick,
    onInput,

    icon,
    appearance = icon ? "icon" : "radio",
    color,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;

  const innerName = name || contextName;
  const innerDisabled = disabled || contextDisabled;
  const innerRequired = required || contextRequired;
  const innerLoading =
    loading || (contextLoading && contextLoadingElement === ref.current);
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;

  reportReadOnlyOnLabel?.(innerReadOnly);
  reportDisabledOnLabel?.(innerDisabled);
  useAutoFocus(ref, autoFocus);
  const remainingProps = useConstraints(ref, rest);
  const checked = Boolean(uiState);
  // we must first dispatch an event to inform all other radios they where unchecked
  // this way each other radio uiStateController knows thery are unchecked
  // we do this on "input"
  // but also when we are becoming checked from outside (hence the useLayoutEffect)
  const updateOtherRadiosInGroup = () => {
    const thisRadio = ref.current;
    const radioList = thisRadio.closest("[data-radio-list]");
    if (!radioList) {
      return;
    }
    const radioInputs = radioList.querySelectorAll(
      `input[type="radio"][name="${thisRadio.name}"]`,
    );
    for (const radioInput of radioInputs) {
      if (radioInput === thisRadio) {
        continue;
      }
      radioInput.dispatchEvent(
        new CustomEvent("setuistate", { detail: false }),
      );
    }
  };
  useLayoutEffect(() => {
    if (checked) {
      updateOtherRadiosInGroup();
    }
  }, [checked]);

  const innerOnInput = useStableCallback((e) => {
    const radio = e.target;
    const radioIsChecked = radio.checked;
    if (radioIsChecked) {
      updateOtherRadiosInGroup();
    }
    uiStateController.setUIState(radioIsChecked, e);
    onInput?.(e);
  });
  const innerOnClick = useStableCallback((e) => {
    if (innerReadOnly) {
      e.preventDefault();
    }
    onClick?.(e);
  });
  const renderRadio = (radioProps) => (
    <Box
      {...radioProps}
      as="input"
      ref={ref}
      type="radio"
      name={innerName}
      checked={checked}
      disabled={innerDisabled}
      required={innerRequired}
      baseClassName="navi_native_field"
      data-callout-arrow-x="center"
      onClick={innerOnClick}
      onInput={innerOnInput}
      onresetuistate={(e) => {
        uiStateController.resetUIState(e);
      }}
      onsetuistate={(e) => {
        uiStateController.setUIState(e.detail.value, e);
      }}
    />
  );
  const renderRadioMemoized = useCallback(renderRadio, [
    innerName,
    checked,
    innerRequired,
  ]);

  const boxRef = useRef();
  useLayoutEffect(() => {
    const naviRadio = boxRef.current;
    const luminance = resolveColorLuminance("var(--accent-color)", naviRadio);
    if (luminance < 0.3) {
      naviRadio.setAttribute("data-dark", "");
    } else {
      naviRadio.removeAttribute("data-dark");
    }
  }, [color]);

  return (
    <Box
      as="span"
      {...remainingProps}
      ref={boxRef}
      data-appearance={appearance}
      baseClassName="navi_radio"
      pseudoStateSelector=".navi_native_field"
      styleCSSVars={
        appearance === "button" ? RadioButtonStyleCSSVars : RadioStyleCSSVars
      }
      pseudoClasses={RadioPseudoClasses}
      pseudoElements={RadioPseudoElements}
      basePseudoState={{
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
        ":-navi-loading": innerLoading,
      }}
      color={color}
      hasChildFunction
    >
      <LoaderBackground
        loading={innerLoading}
        inset={-1}
        targetSelector=".navi_radio_field"
        color="var(--loader-color)"
      />
      {renderRadioMemoized}
      <span className="navi_radio_field">
        {appearance === "radio" ? (
          <svg
            viewBox="0 0 12 12"
            aria-hidden="true"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Border circle - always visible */}
            <circle
              className="navi_radio_border"
              cx="6"
              cy="6"
              r="5.5"
              strokeWidth="1"
            />
            {/* Dashed border for readonly - calculated for even distribution */}
            <circle
              className="navi_radio_dashed_border"
              cx="6"
              cy="6"
              r="5.5"
              strokeWidth="1"
              strokeDasharray="2.16 2.16"
              strokeDashoffset="0"
            />
            {/* Inner fill circle - only visible when checked */}
            <circle className="navi_radio_marker" cx="6" cy="6" r="3.5" />
          </svg>
        ) : (
          icon
        )}
      </span>
    </Box>
  );
};

const InputRadioWithAction = () => {
  throw new Error(
    `<Input type="radio" /> with an action make no sense. Use <RadioList action={something} /> instead`,
  );
};
