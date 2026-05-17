import { dispatchCustomEvent } from "@jsenv/dom";
import { useCallback, useContext, useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import {
  dispatchRequestAction,
  dispatchRequestInteraction,
} from "@jsenv/navi/src/field/validation/custom_constraint_validation.js";
import { LoadingOutline } from "../../graphic/loading/loading_outline.jsx";
import { useAccentColorAttributes } from "../../utils/use_accent_color_attributes.js";
import { useFieldId } from "../field.jsx";
import { FieldNameContext, RequiredContext } from "../field_context.js";
import { fieldPropSet } from "../field_prop_set.js";
import { requestClosestAction } from "../string_actions.js";
import { useFieldProps } from "../use_field_props.jsx";

const css = /* css */ `
  @layer navi {
    .navi_radio {
      --margin: 3px 3px 0 5px;
      --outline-offset: 1px;
      --outline-width: 2px;
      --width: 0.815em;
      --height: 0.815em;

      --color-mix-light: black;
      --color-mix-dark: white;
      --color-mix: var(--color-mix-dark);

      --outline-color: var(--navi-focus-outline-color);
      --loader-color: var(--navi-loader-color);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --accent-color: light-dark(#4476ff, #3b82f6);
      --radiomark-color: var(--accent-color);
      --border-color-checked: var(--accent-color);
      --cursor: pointer;

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
    box-sizing: border-box;
    width: var(--x-width);
    height: var(--x-height);
    margin: var(--margin);
    outline-width: var(--x-outline-width);
    outline-style: none;
    outline-color: var(--x-outline-color);
    outline-offset: var(--x-outline-offset);

    .navi_radio_accent_probe {
      position: absolute;
      width: 0;
      height: 0;
      background-color: var(--accent-color);
      visibility: hidden;
      pointer-events: none;
    }

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
      outline-style: solid;
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

    &[data-accent-light] {
      --color-mix: var(--color-mix-light);
    }

    &[data-accent-very-light] {
      --x-background-color: rgba(0, 0, 0, 0.15);
      &[data-checked] {
        --x-background-color: rgba(0, 0, 0, 0.15);
      }
    }

    /* Radio appearance */
    &[data-appearance="radio"] {
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
      --border-color: var(--button-border-color);
      --border-color-hover: var(--button-border-color-hover);
      --background-color: var(--button-background-color);
      --background-color-hover: var(--button-background-color-hover);
      --background-color-readonly: var(--button-background-color-readonly);
      --background-color-disabled: var(--button-background-color-disabled);
      --border-color-checked: var(--button-border-color);
      --background-color-checked: var(--button-background-color);

      padding-top: var(
        --button-padding-top,
        var(
          --button-padding-y,
          var(--button-padding, var(--button-padding-y-default))
        )
      );
      padding-right: var(
        --button-padding-right,
        var(
          --button-padding-x,
          var(--button-padding, var(--button-padding-x-default))
        )
      );
      padding-bottom: var(
        --button-padding-bottom,
        var(
          --button-padding-y,
          var(--button-padding, var(--button-padding-y-default))
        )
      );
      padding-left: var(
        --button-padding-left,
        var(
          --button-padding-x,
          var(--button-padding, var(--button-padding-x-default))
        )
      );
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

      &[data-hover] {
        --x-background-color: var(--button-background-color-hover);
        --x-border-color: var(--button-border-color-hover);
      }
      &[data-checked] {
        --x-border-color: var(--button-border-color-checked);
        --x-background-color: var(--button-background-color-checked);

        box-shadow:
          inset 0 2px 4px rgba(0, 0, 0, 0.15),
          inset 0 0 0 1px var(--button-border-color-checked);
      }
      &[data-disabled] {
        --x-border-color: var(--button-border-color-disabled);
        --x-background-color: var(--button-background-color-disabled);
      }
    }
  }
`;

export const InputRadio = (props) => {
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  const fieldId = useFieldId();
  props.id = props.id || fieldId;
  props.value = props.value === undefined ? "on" : props.value;
  const contextFieldName = useContext(FieldNameContext);
  const contextRequired = useContext(RequiredContext);
  props.name = props.name === undefined ? contextFieldName : props.name;
  props.required =
    props.required === undefined ? contextRequired : props.required;

  return <InputRadioField {...props} />;
};

const InputRadioField = (props) => {
  import.meta.css = css;
  const {
    ref,
    /* eslint-disable no-unused-vars */
    type,
    /* eslint-enable no-unused-vars */
    name,
    required,
    onClick,
    onInput,
    onKeyDown,
    icon,
    appearance = icon ? "icon" : "radio",
    color,
    accentColor,
  } = props;
  const fieldProps = useFieldProps(props, {
    fieldType: "radio",
    readUIState: () => {
      const radio = ref.current;
      const radioIsChecked = radio.checked;
      return radioIsChecked ? props.value : undefined;
    },
    statePropName: "checked",
    fallbackState: false,
    getStateFromProp: (checked) => (checked ? props.value : undefined),
    getPropFromState: Boolean,
    getStateFromParent: (parentUIStateController) => {
      if (parentUIStateController.componentType === "radio_list") {
        return parentUIStateController.uiState === props.value;
      }
      return undefined;
    },
  });
  const { value, basePseudoState } = fieldProps;
  const disabled = basePseudoState[":disabled"];
  const readOnly = basePseudoState[":read-only"];
  const loading = basePseudoState[":-navi-loading"];

  const checked = Boolean(value);
  // we must first dispatch an event to inform all other radios they where unchecked
  // this way each other radio uiStateController knows thery are unchecked
  // we do this on "input"
  // but also when we are becoming checked from outside (hence the useLayoutEffect)
  const updateOtherRadiosInGroup = (e) => {
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
      // Dispatch "navi_set_ui_state" with value: false to set the sibling radio's uiState to false (unchecked).
      // Each radio's own uiState is a boolean (true = checked, false = unchecked).
      // This is necessary because the group controller aggregates child states to determine
      // the selected value — it needs all siblings to be unchecked before the newly checked
      // radio propagates its state up, otherwise aggregation may find multiple "truthy" children.
      // suppressParentNotification: true prevents the group from aggregating and calling uiAction during
      // this intermediate state (all unchecked) — only the clicked radio's setUIState triggers aggregation.
      dispatchCustomEvent(radioInput, "navi_set_ui_state", {
        event: e,
        value: false,
        suppressParentNotification: true,
      });
    }
  };
  useLayoutEffect(() => {
    if (checked) {
      updateOtherRadiosInGroup();
    }
  }, [checked]);

  const renderRadio = (radioProps) => {
    return (
      <Box
        {...radioProps}
        as="input"
        ref={ref}
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        required={required}
        data-readonly={readOnly ? "" : undefined}
        aria-busy={loading}
        baseClassName="navi_native_field"
        data-callout-arrow-x="center"
      />
    );
  };
  const renderRadioMemoized = useCallback(renderRadio, [
    name,
    checked,
    disabled,
    readOnly,
    loading,
  ]);

  const boxRef = useRef();
  useAccentColorAttributes(boxRef, accentColor, {
    elementSelector: ".navi_radio_accent_probe",
  });

  let visualVNode;
  if (appearance === "radio") {
    visualVNode = (
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
    );
  } else {
    visualVNode = icon;
  }

  return (
    <Box
      as="span"
      // Radio displayed as button are usually squarish
      // (passsing any custom width/height would auto disable aspectRatio forced by the square prop)
      square={appearance === "button" ? true : undefined}
      {...fieldProps}
      ref={boxRef}
      data-field=".navi_native_field"
      data-appearance={appearance}
      baseClassName="navi_radio"
      pseudoStateSelector=".navi_native_field"
      styleCSSVars={
        appearance === "button" ? RadioButtonStyleCSSVars : RadioStyleCSSVars
      }
      pseudoClasses={RadioPseudoClasses}
      pseudoElements={RadioPseudoElements}
      color={color}
      hasChildFunction
      baseChildPropSet={RadioChildPropSet}
      onClick={(e) => {
        onClick?.(e);
        const radio = ref.current;
        const allowed = dispatchRequestInteraction(radio, e);
        if (!allowed) {
          e.preventDefault(); // prevent click to toggle
        }
      }}
      onInput={(e) => {
        onInput?.(e);
        const radio = ref.current;
        const radioIsChecked = radio.checked;
        if (radioIsChecked) {
          updateOtherRadiosInGroup(e);
        }
        dispatchRequestAction(radio, {
          event: e,
        });
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.key === "Enter") {
          requestClosestAction(e);
        }
      }}
    >
      <span className="navi_radio_accent_probe" aria-hidden="true" />
      <LoadingOutline
        loading={loading}
        inset={-1}
        color="var(--loader-color)"
      />
      {visualVNode}
      {renderRadioMemoized}
    </Box>
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
  "padding": "--button-padding",
  "paddingX": "--button-padding-x",
  "paddingY": "--button-padding-y",
  "paddingTop": "--button-padding-top",
  "paddingRight": "--button-padding-right",
  "paddingBottom": "--button-padding-bottom",
  "paddingLeft": "--button-padding-left",
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
const RadioChildPropSet = new Set([...fieldPropSet]);
