import { useContext, useRef } from "preact/hooks";

import { Box, BoxForwardedPropsContext } from "../../box/box.jsx";
import { LoadingOutline } from "../../graphic/loading/loading_outline.jsx";
import { useAccentColorAttributes } from "../../utils/use_accent_color_attributes.js";
import { FIELD_PROP_SET } from "../field_context.js";
import { useFieldInterfaceProps } from "../field_hooks.jsx";
import { requestClosestAction } from "../string_actions.js";
import {
  dispatchRequestAction,
  dispatchRequestInteraction,
} from "../validation/custom_constraint_validation.js";
import { ToggleCSSVars, ToggleUI } from "./toggle_ui.jsx";

const css = /* css */ `
  @layer navi {
    .navi_checkbox {
      --margin: 3px 3px 3px 4px;
      --outline-offset: 1px;
      --outline-width: 2px;
      --border-width: 1px;
      --border-radius: 2px;
      --width: 0.815em;
      --height: 0.815em;

      --outline-color: var(--navi-focus-outline-color);
      --loader-color: var(--navi-loader-color);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --accent-color: light-dark(#4476ff, #3b82f6);
      --background-color-checked: var(--accent-color);
      --border-color-checked: var(--accent-color);
      --checkmark-color: white;
      --cursor: pointer;
      --color-mix-light: black;
      --color-mix-dark: white;
      --color-mix: var(--color-mix-dark);

      /* Hover */
      --border-color-hover: color-mix(in srgb, var(--border-color) 60%, black);
      --border-color-hover-checked: color-mix(
        in srgb,
        var(--border-color-checked) 80%,
        var(--color-mix)
      );
      --background-color-hover: var(--background-color);
      --background-color-hover-checked: color-mix(
        in srgb,
        var(--background-color-checked) 80%,
        var(--color-mix)
      );
      /* Readonly */
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --border-color-readonly-checked: #d3d3d3;
      --background-color-readonly-checked: color-mix(
        in srgb,
        var(--background-color-checked) 30%,
        grey
      );
      --checkmark-color-readonly: #eeeeee;
      /* Disabled */
      --border-color-disabled: var(--border-color-readonly);
      --background-color-disabled: rgba(248, 248, 248, 0.7);
      --checkmark-color-disabled: #eeeeee;
      --border-color-disabled-checked: #d3d3d3;
      --background-color-disabled-checked: #d3d3d3;

      /* Button specific */
      --button-border-color: light-dark(#767676, #8e8e93);
      --button-background-color: light-dark(#f3f4f6, #2d3748);
      --button-border-color-hover: color-mix(
        in srgb,
        var(--button-border-color) 70%,
        black
      );
      --button-background-color-hover: color-mix(
        in srgb,
        var(--button-background-color) 95%,
        black
      );
    }
  }

  .navi_checkbox {
    --x-background-color: var(--background-color);
    --x-border-color: var(--border-color);
    --x-checkmark-color: var(--checkmark-color);
    --x-cursor: var(--cursor);

    position: relative;
    display: inline-flex;
    box-sizing: border-box;
    width: var(--width);
    height: var(--height);
    margin: var(--margin);
    background-color: var(--x-background-color);
    border-width: var(--border-width);
    border-style: solid;
    border-color: var(--x-border-color);
    border-radius: var(--border-radius);
    outline-width: var(--outline-width);
    outline-style: none;
    outline-color: var(--outline-color);
    outline-offset: var(--outline-offset);

    .navi_real_input_checkbox {
      position: absolute;
      inset: 0;
      margin: 0;
      border: none;
      border-radius: inherit;
      opacity: 0;
      appearance: none; /* This allows border-radius to have an effect */
      cursor: var(--x-cursor);
    }

    .navi_checkbox_accent_probe {
      position: absolute;
      width: 0;
      height: 0;
      background-color: var(--accent-color);
      visibility: hidden;
      pointer-events: none;
    }

    /* Focus */
    &[data-focus-visible] {
      z-index: 1;
      outline-style: solid;
    }
    /* Hover */
    &[data-hover] {
      --x-background-color: var(--background-color-hover);
      --x-border-color: var(--border-color-hover);

      &[data-checked] {
        --x-border-color: var(--border-color-hover-checked);
        --x-background-color: var(--background-color-hover-checked);
      }
    }
    /* Checked */
    &[data-checked] {
      --x-background-color: var(--background-color-checked);
      --x-border-color: var(--border-color-checked);
    }
    /* Readonly */
    &[data-readonly],
    &[data-readonly][data-hover] {
      --x-border-color: var(--border-color-readonly);
      --x-background-color: var(--background-color-readonly);
      --x-cursor: default;

      &[data-checked] {
        --x-border-color: var(--border-color-readonly-checked);
        --x-background-color: var(--background-color-readonly-checked);
        --x-checkmark-color: var(--checkmark-color-readonly);
      }
    }
    /* Disabled */
    &[data-disabled] {
      --x-border-color: var(--border-color-disabled);
      --x-background-color: var(--background-color-disabled);
      --x-cursor: default;

      &[data-checked] {
        --x-border-color: var(--border-color-disabled-checked);
        --x-background-color: var(--background-color-disabled-checked);
        --x-checkmark-color: var(--checkmark-color-disabled);
      }
    }

    /* Accent color adaptations */
    &[data-accent-light] {
      --color-mix: var(--color-mix-light);
    }

    /* Checkbox appearance */
    &[data-appearance="checkbox"] {
      .navi_checkbox_marker {
        width: 100%;
        height: 100%;
        opacity: 0;
        stroke: var(--x-checkmark-color);
        transform: scale(0.5);
      }

      &[data-checked] {
        .navi_checkbox_marker {
          opacity: 1;
          transform: scale(1);
          transition-property: opacity, transform;
          transition-duration: 0.15s;
          transition-timing-function: ease;
        }
      }

      &[data-accent-very-light] {
        --x-background-color: rgba(0, 0, 0, 0.15);
        &[data-checked] {
          --x-background-color: var(--background-color-checked);
        }
      }
      &[data-accent-needs-dark-fg] {
        --x-checkmark-color: rgb(55, 55, 55);
      }
    }

    /* Toggle appearance */
    &[data-appearance="toggle"] {
      /* We compute ourselves the width + padding otherwise during 
      translation subpixel rounding makes the thumb feels too much to the right by 1px */
      box-sizing: content-box;
      --toggle-outer-width: calc(var(--toggle-width) + var(--toggle-padding));

      --margin: var(--toggle-margin);
      --width: var(--toggle-outer-width);
      --height: unset;
      min-width: var(--toggle-outer-width);
      --border-radius: var(--toggle-border-radius);
      --background-color: var(--toggle-background-color);
      --background-color-hover: var(--toggle-background-color-hover);
      --background-color-readonly: var(--toggle-background-color-readonly);
      --background-color-disabled: var(--toggle-background-color-disabled);
      --background-color-checked: var(--toggle-background-color-checked);
      --background-color-hover-checked: var(
        --toggle-background-color-hover-checked
      );
      --background-color-readonly-checked: var(
        --toggle-background-color-readonly-checked
      );
      --background-color-disabled-checked: var(
        --toggle-background-color-disabled-checked
      );

      position: relative;
      padding: var(--toggle-padding);
      background-color: var(--x-background-color);
      border-color: transparent;
      user-select: none;

      &[data-accent-very-light] {
        --toggle-thumb-color: rgb(55, 55, 55);
      }
    }

    &[data-appearance="icon"] {
      --margin: 0;
      --width: auto;
      --height: auto;

      background: none;
      border: none;
    }

    &[data-appearance="button"] {
      --margin: 0;
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
    }
  }
`;

export const InputCheckbox = (props) => {
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  props.value = props.value === undefined ? "on" : props.value;

  const { ref } = props;
  const fieldInterfaceProps = useFieldInterfaceProps(
    {
      // In this situation updating the ui state === calling associated action
      // so cance/abort/error have to revert the ui state to the one before user interaction
      // to show back the real state of the checkbox (not the one user tried to set)
      resetOnCancel: true,
      resetOnAbort: true,
      resetOnError: true,
      ...props,
    },
    {
      fieldType: "checkbox",
      statePropName: "checked",
      defaultStatePropName: "defaultChecked",
      readUIState: () => {
        const checkbox = ref.current;
        const checkboxIsChecked = checkbox.checked;
        return checkboxIsChecked ? props.value : undefined;
      },
      fallbackState: false,
      getStateFromProp: (checked) => (checked ? props.value : undefined),
      getPropFromState: Boolean,
    },
  );
  const { onMouseDown, onClick, onInput, onKeyDown } = props;
  const interactionProps = {
    onMouseDown: (e) => {
      onMouseDown?.(e);
      const checkbox = ref.current;
      dispatchRequestInteraction(checkbox, e);
    },
    onClick: (e) => {
      onClick?.(e);
      const checkbox = ref.current;
      dispatchRequestInteraction(checkbox, e, {
        onPrevented: () => {
          e.preventDefault();
        },
      });
    },
    onInput: (e) => {
      onInput?.(e);
      const checkbox = ref.current;
      dispatchRequestAction(checkbox, { event: e });
    },
    onKeyDown: (e) => {
      onKeyDown?.(e);
      if (e.key === "Enter") {
        requestClosestAction(e);
      }
      if (e.key === " ") {
        const checkbox = ref.current;
        dispatchRequestInteraction(checkbox, e, {
          onPrevented: () => {
            e.preventDefault();
          },
        });
      }
    },
  };

  if (props.appearance === "hidden") {
    return (
      <InputCheckboxVisuallyHidden
        {...fieldInterfaceProps}
        {...interactionProps}
      />
    );
  }
  return (
    <InputCheckboxFieldInterface
      {...fieldInterfaceProps}
      {...interactionProps}
    />
  );
};

const InputCheckboxVisuallyHidden = (props) => {
  return (
    <BoxForwardedPropsContext.Provider value={undefined}>
      <RealInputCheckbox
        pseudoClasses={CheckboxPseudoClasses}
        {...props}
        appearance={undefined}
        navi-visually-hidden=""
      />
    </BoxForwardedPropsContext.Provider>
  );
};

const InputCheckboxFieldInterface = (props) => {
  import.meta.css = css;
  const {
    accentColor,
    icon,
    appearance = icon ? "icon" : "checkbox", // "checkbox", "toggle", "icon", "button"
    ...rest
  } = props;
  const { ref, basePseudoState, checked } = props;
  const loading = basePseudoState[":-navi-loading"];
  const boxRef = useRef();
  useAccentColorAttributes(boxRef, accentColor, {
    elementSelector: ".navi_checkbox_accent_probe",
  });
  let visualVnode;
  if (appearance === "icon") {
    visualVnode = (
      <div className="navi_checkbox_icon" aria-hidden="true">
        {Array.isArray(icon) ? icon[checked ? 1 : 0] : icon}
      </div>
    );
  } else if (appearance === "toggle") {
    visualVnode = <ToggleUI />;
  } else {
    visualVnode = (
      <Box
        className="navi_checkbox_marker"
        as="svg"
        viewBox="0 0 12 12"
        aria-hidden="true"
      >
        <path d="M10.5 2L4.5 9L1.5 5.5" fill="none" strokeWidth="2" />
      </Box>
    );
  }

  return (
    <Box
      as="span"
      // Checkbox displayed as button are usually squarish
      // (passsing any custom width/height would auto disable aspectRatio forced by the square prop)
      square={appearance === "button" ? true : undefined}
      {...rest}
      ref={boxRef}
      data-appearance={appearance}
      baseClassName="navi_checkbox"
      navi-field=".navi_real_input_checkbox"
      pseudoStateSelector=".navi_real_input_checkbox"
      styleCSSVars={
        appearance === "toggle"
          ? CheckboxToggleStyleCSSVars
          : appearance === "button"
            ? CheckboxButtonStyleCSSVars
            : CheckboxStyleCSSVars
      }
      pseudoClasses={CheckboxPseudoClasses}
      pseudoElements={CheckboxPseudoElements}
      accentColor={accentColor}
      hasChildUsingForwardedProps
      baseChildPropSet={CheckboxChildPropSet}
    >
      <span className="navi_checkbox_accent_probe" aria-hidden="true" />
      <LoadingOutline
        loading={loading}
        inset={-1}
        color="var(--loader-color)"
      />
      {visualVnode}
      <RealInputCheckbox ref={ref} />
    </Box>
  );
};
const RealInputCheckbox = (props) => {
  const checkboxProps = useContext(BoxForwardedPropsContext);
  return (
    <Box
      {...checkboxProps}
      {...props}
      as="input"
      type="checkbox"
      baseClassName="navi_real_input_checkbox"
      navi-rendered-by=".navi_checkbox"
      data-callout-arrow-x="center"
    />
  );
};
const CheckboxStyleCSSVars = {
  "width": "--width",
  "height": "--height",
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
const CheckboxToggleStyleCSSVars = {
  ...CheckboxStyleCSSVars,
  ...ToggleCSSVars,
};
const CheckboxButtonStyleCSSVars = {
  ...CheckboxStyleCSSVars,
  padding: "--button-padding",
  paddingX: "--button-padding-x",
  paddingY: "--button-padding-y",
  paddingTop: "--button-padding-top",
  paddingRight: "--button-padding-right",
  paddingBottom: "--button-padding-bottom",
  paddingLeft: "--button-padding-left",
};
const CheckboxPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":checked",
  ":-navi-loading",
];
const CheckboxPseudoElements = ["::-navi-loader", "::-navi-checkmark"];
const CheckboxChildPropSet = new Set([...FIELD_PROP_SET, "checked"]);
