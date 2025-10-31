import { forwardRef } from "preact/compat";
import {
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "preact/hooks";

import { useConstraints } from "../../validation/hooks/use_constraints.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import {
  LoadableInlineElement,
  LoaderBackground,
} from "../loader/loader_background.jsx";
import { withPropsStyle } from "../props_composition/with_props_style.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { initCustomField } from "./custom_field.js";
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
      position: relative;
      display: inline-flex;
      box-sizing: content-box;

      --outline-offset: 1px;
      --outline-width: 2px;
      --width: 13px;
      --height: 13px;

      --outline-color: light-dark(#4476ff, #3b82f6);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --accent-color: var(--navi-radiomark-color);
      --mark-color: var(--accent-color);

      /* light-dark(rgba(239, 239, 239, 0.3), rgba(59, 59, 59, 0.3)); */
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
    .navi_radio input {
      position: absolute;
      inset: 0;
      margin: 0;
      padding: 0;
      opacity: 0;
      cursor: inherit;
    }
    .navi_radio_field {
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
  }
`;

export const InputRadio = forwardRef((props, ref) => {
  const { value = "on" } = props;
  const uiStateController = useUIStateController(props, "radio", {
    statePropName: "checked",
    fallbackState: false,
    getStateFromProp: (checked) => (checked ? value : undefined),
    getPropFromState: Boolean,
  });
  const uiState = useUIState(uiStateController);

  const radio = renderActionableComponent(props, ref, {
    Basic: InputRadioBasic,
    WithAction: InputRadioWithAction,
    InsideForm: InputRadioInsideForm,
  });
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>{radio}</UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
});

const InputRadioBasic = forwardRef((props, ref) => {
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
    name,
    readOnly,
    disabled,
    required,
    loading,

    autoFocus,
    constraints = [],

    appeareance = "navi", // "navi" or "default"
    accentColor,
    onClick,
    onInput,
    style,
    ...rest
  } = props;
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const innerName = name || contextName;
  const innerDisabled = disabled || contextDisabled;
  const innerRequired = required || contextRequired;
  const innerLoading =
    loading || (contextLoading && contextLoadingElement === innerRef.current);
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;

  reportReadOnlyOnLabel?.(innerReadOnly);
  reportDisabledOnLabel?.(innerDisabled);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);
  const checked = Boolean(uiState);
  // we must first dispatch an event to inform all other radios they where unchecked
  // this way each other radio uiStateController knows thery are unchecked
  // we do this on "input"
  // but also when we are becoming checked from outside (hence the useLayoutEffect)
  const updateOtherRadiosInGroup = () => {
    const thisRadio = innerRef.current;
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

  const actionName = rest["data-action"];
  if (actionName) {
    delete rest["data-action"];
  }
  const inputRadio = (
    <input
      {...rest}
      ref={innerRef}
      type="radio"
      style={appeareance === "default" ? style : undefined}
      name={innerName}
      checked={checked}
      disabled={innerDisabled}
      required={innerRequired}
      data-callout-arrow-x="center"
      onClick={(e) => {
        if (innerReadOnly) {
          e.preventDefault();
        }
        onClick?.(e);
      }}
      onInput={(e) => {
        const radio = e.target;
        const radioIsChecked = radio.checked;
        if (radioIsChecked) {
          updateOtherRadiosInGroup();
        }
        uiStateController.setUIState(radioIsChecked, e);
        onInput?.(e);
      }}
      // eslint-disable-next-line react/no-unknown-property
      onresetuistate={(e) => {
        uiStateController.resetUIState(e);
      }}
      // eslint-disable-next-line react/no-unknown-property
      onsetuistate={(e) => {
        uiStateController.setUIState(e.detail.value, e);
      }}
    />
  );
  const loaderProps = {
    loading: innerLoading,
    inset: -1,
    style: {
      "--accent-color": accentColor || "light-dark(#355fcc, #4476ff)",
    },
    color: "var(--accent-color)",
  };
  if (appeareance === "navi") {
    return (
      <NaviRadio
        data-action={actionName}
        inputRef={innerRef}
        accentColor={accentColor}
        readOnly={innerReadOnly}
        disabled={innerDisabled}
        style={style}
      >
        <LoaderBackground {...loaderProps} targetSelector=".navi_radio_field">
          {inputRadio}
        </LoaderBackground>
      </NaviRadio>
    );
  }

  return (
    <LoadableInlineElement {...loaderProps} data-action={actionName}>
      {inputRadio}
    </LoadableInlineElement>
  );
});
const NaviRadio = ({
  inputRef,
  accentColor,
  readOnly,
  disabled,

  children,
  ...rest
}) => {
  const ref = useRef();
  useLayoutEffect(() => {
    return initCustomField(ref.current, inputRef.current);
  }, []);

  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    base: {
      ...(accentColor ? { "--accent-color": accentColor } : {}),
    },
    layout: true,
  });

  return (
    <span
      {...remainingProps}
      ref={ref}
      className="navi_radio"
      style={innerStyle}
      data-readonly={readOnly ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
    >
      {children}
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
    </span>
  );
};

const InputRadioWithAction = () => {
  throw new Error(
    `<Input type="radio" /> with an action make no sense. Use <RadioList action={something} /> instead`,
  );
};

const InputRadioInsideForm = InputRadio;
