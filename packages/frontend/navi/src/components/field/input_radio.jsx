import { useCallback, useContext, useLayoutEffect, useRef } from "preact/hooks";

import { useConstraints } from "../../validation/hooks/use_constraints.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { Box } from "../layout/box.jsx";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { useStableCallback } from "../use_stable_callback.js";
import {
  ReportDisabledOnLabelContext,
  ReportReadOnlyOnLabelContext,
} from "./label.jsx";
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

import.meta.css = /* css */ `
  @layer navi {
    :root {
      --navi-radiomark-color: light-dark(#4476ff, #3b82f6);
    }

    .navi_radio {
      --outline-offset: 1px;
      --outline-width: 2px;
      --width: 13px;
      --height: 13px;
      --outline-color: light-dark(#4476ff, #3b82f6);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --accent-color: var(--navi-radiomark-color);
      --mark-color: var(--accent-color);

      --accent-color-checked: color-mix(
        in srgb,
        var(--accent-color) 70%,
        black
      );

      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --border-color-disabled: var(--border-color-readonly);
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --border-color-checked: var(--accent-color);
      --border-color-checked-hover: var(--accent-color-checked);
      --border-color-checked-readonly: #d3d3d3;
      --border-color-checked-disabled: #d3d3d3;
      --background-color-readonly: var(--background-color);
      --background-color-disabled: var(--background-color);
      --background-color-checked-readonly: #d3d3d3;
      --background-color-checked-disabled: var(--background-color);
      --mark-color-hover: var(--accent-color-checked);
      --mark-color-readonly: grey;
      --mark-color-disabled: #eeeeee;
    }
  }

  .navi_radio {
    position: relative;
    display: inline-flex;
    box-sizing: content-box;
  }
  .navi_radio .navi_native_field {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 0;
    opacity: 0;
    cursor: inherit;
  }
  .navi_radio .navi_radio_field {
    display: inline-flex;
    width: var(--width);
    height: var(--height);
    margin-top: 3px;
    margin-right: 3px;
    margin-left: 5px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    outline-width: var(--outline-width);
    outline-style: none;
    outline-color: var(--outline-color);
    outline-offset: var(--outline-offset);
  }
  .navi_radio_field svg {
    overflow: visible;
  }
  .navi_radio_border {
    fill: var(--background-color);
    stroke: var(--border-color);
  }
  .navi_radio_marker {
    width: 100%;
    height: 100%;
    opacity: 0;
    fill: var(--mark-color);
    transform: scale(0.3);
    transform-origin: center;
    pointer-events: none;
  }
  .navi_radio_dashed_border {
    display: none;
  }
  .navi_radio[data-transition] .navi_radio_marker {
    transition: all 0.15s ease;
  }
  .navi_radio[data-transition] .navi_radio_dashed_border {
    transition: all 0.15s ease;
  }
  .navi_radio[data-transition] .navi_radio_border {
    transition: all 0.15s ease;
  }

  /* Focus */
  .navi_radio[data-focus-visible] .navi_radio_field {
    outline-style: solid;
  }
  /* Hover */
  .navi_radio[data-hover] .navi_radio_border {
    stroke: var(--border-color-hover);
  }
  .navi_radio[data-hover] .navi_radio_marker {
    fill: var(--mark-color-hover);
  }
  /* Checked */
  .navi_radio[data-checked] .navi_radio_border {
    stroke: var(--border-color-checked);
  }
  .navi_radio[data-checked] .navi_radio_marker {
    opacity: 1;
    transform: scale(1);
  }
  .navi_radio[data-hover][data-checked] .navi_radio_border {
    stroke: var(--border-color-checked-hover);
  }
  /* Readonly */
  .navi_radio[data-readonly] .navi_radio_border {
    fill: var(--background-color-readonly);
    stroke: var(--border-color-readonly);
  }
  .navi_radio[data-readonly] .navi_radio_marker {
    fill: var(--mark-color-readonly);
  }
  .navi_radio[data-readonly] .navi_radio_dashed_border {
    display: none;
  }
  .navi_radio[data-checked][data-readonly] .navi_radio_border {
    fill: var(--background-color-checked-readonly);
    stroke: var(--border-color-checked-readonly);
  }
  .navi_radio[data-checked][data-readonly] .navi_radio_marker {
    fill: var(--mark-color-readonly);
  }
  /* Disabled */
  .navi_radio[data-disabled] .navi_radio_border {
    fill: var(--background-color-disabled);
    stroke: var(--border-color-disabled);
  }
  .navi_radio[data-disabled] .navi_radio_marker {
    fill: var(--mark-color-disabled);
  }
  .navi_radio[data-hover][data-checked][data-disabled] .navi_radio_border {
    stroke: var(--border-color-disabled);
  }
  .navi_radio[data-checked][data-disabled] .navi_radio_marker {
    fill: var(--mark-color-disabled);
  }
`;

export const InputRadio = (props) => {
  const { value = "on" } = props;
  const uiStateController = useUIStateController(props, "radio", {
    statePropName: "checked",
    fallbackState: false,
    getStateFromProp: (checked) => (checked ? value : undefined),
    getPropFromState: Boolean,
  });
  const uiState = useUIState(uiStateController);

  const radio = renderActionableComponent(props, {
    Basic: InputRadioBasic,
    WithAction: InputRadioWithAction,
    InsideForm: InputRadioInsideForm,
  });
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>{radio}</UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};

const RadioManagedByCSSVars = {
  "outlineWidth": "--outline-width",
  "borderWidth": "--border-width",
  "borderRadius": "--border-radius",
  "backgroundColor": "--background-color",
  "borderColor": "--border-color",
  "color": "--color",
  ":hover": {
    backgroundColor: "--background-color-hover",
    borderColor: "--border-color-hover",
    color: "--color-hover",
  },
  ":active": {
    borderColor: "--border-color-active",
  },
  ":read-only": {
    backgroundColor: "--background-color-readonly",
    borderColor: "--border-color-readonly",
    color: "--color-readonly",
  },
  ":disabled": {
    backgroundColor: "--background-color-disabled",
    borderColor: "--border-color-disabled",
    color: "--color-disabled",
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
    constraints = [],
    onClick,
    onInput,

    color,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;

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
  useConstraints(ref, constraints);
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

  return (
    <Box
      as="span"
      {...rest}
      ref={ref}
      baseClassName="navi_radio"
      pseudoStateSelector=".navi_native_field"
      managedByCSSVars={RadioManagedByCSSVars}
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
        color="var(--navi-loader-color)"
      />
      {renderRadioMemoized}
      <span className="navi_radio_field">
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
      </span>
    </Box>
  );
};

const InputRadioWithAction = () => {
  throw new Error(
    `<Input type="radio" /> with an action make no sense. Use <RadioList action={something} /> instead`,
  );
};

const InputRadioInsideForm = InputRadio;
