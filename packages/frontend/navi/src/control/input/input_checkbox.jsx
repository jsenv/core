import { useRef } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { LoadingOutline } from "../../graphic/loading/loading_outline.jsx";
import { useAccentColorAttributes } from "../../utils/use_accent_color_attributes.js";
import { SwitchCSSVars, SwitchUI } from "./switch_ui.jsx";
import { useCheckableProps } from "./use_checkable_props.js";

const css = /* css */ `
  @layer navi {
    .navi_checkbox {
      --border-radius: var(--navi-control-border-radius);
      --border-width: var(--navi-control-border-width);
      /* Focus outline */
      --outline-width: var(--navi-focus-outline-width);
      --outline-offset: calc(var(--outline-width) / 2);
      --outline-color: var(--navi-focus-outline-color);
      /* Focus outline end */
      --margin: 3px 3px 3px 4px;
      --font-size: var(--navi-control-font-size);
      --font-family: var(--navi-control-font-family);
      --width: round(1em, 1px);
      --height: round(1em, 1px);
      --loader-color: var(--navi-loader-color);
      --border-color: var(--navi-control-border-color);
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
    min-width: var(--width); /* Do not allow to shrink */
    height: var(--height);
    min-height: var(--height); /* Do not allow to shrink */
    margin: var(--margin);
    font-size: var(--font-size);
    font-family: var(--font-family);
    background-color: var(--x-background-color);
    border-width: var(--border-width);
    border-style: solid;
    border-color: var(--x-border-color);
    border-radius: var(--border-radius);
    outline-width: var(--outline-width);
    outline-style: none;
    outline-color: var(--outline-color);
    outline-offset: var(--outline-offset);

    .navi_control_input {
      position: absolute;
      inset: 0;
      margin: 0;
      border: none;
      border-radius: inherit;
      opacity: 0;
      appearance: none; /* This allows border-radius to have an effect */
      cursor: var(--x-cursor);
      -webkit-tap-highlight-color: var(--navi-control-tap-highlight-color);
    }

    .navi_checkbox_accent_probe {
      position: absolute;
      width: 0;
      height: 0;
      background-color: var(--accent-color);
      visibility: hidden;
      pointer-events: none;
    }

    .navi_checkbox_icon {
      display: flex;
      aspect-ratio: inherit;
      height: 1em;
      align-items: center;
      justify-content: center;
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

    /* Switch appearance */
    &[data-appearance="switch"] {
      --switch-outer-width: calc(var(--switch-width) + var(--switch-padding));
      --margin: var(--switch-margin);
      --width: var(--switch-outer-width);
      --height: unset;
      --border-radius: var(--switch-border-radius);
      --background-color: var(--switch-background-color);
      --background-color-hover: var(--switch-background-color-hover);
      --background-color-readonly: var(--switch-background-color-readonly);
      --background-color-disabled: var(--switch-background-color-disabled);
      --background-color-checked: var(--switch-background-color-checked);
      --background-color-hover-checked: var(
        --switch-background-color-hover-checked
      );
      --background-color-readonly-checked: var(
        --switch-background-color-readonly-checked
      );
      --background-color-disabled-checked: var(
        --switch-background-color-disabled-checked
      );

      position: relative;
      /* We compute ourselves the width + padding otherwise during */
      /* translation subpixel rounding makes the thumb feels too much to the right by 1px */
      /* We use !important to win over anything that would be set globally */
      box-sizing: content-box !important;
      min-width: var(--switch-outer-width);
      padding: var(--switch-padding);
      background-color: var(--x-background-color);
      border-color: transparent;
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

  if (props.headless) {
    return <InputCheckboxHeadless {...props} headless={undefined} />;
  }
  return <InputCheckboxFieldInterface {...props} />;
};

const InputCheckboxHeadless = (props) => {
  const [checkboxRootProps, checkboxHostProps] = useCheckableProps(props);

  return (
    <RealInputCheckbox
      pseudoClasses={CheckboxPseudoClasses}
      navi-visually-hidden=""
      navi-focus-delegate=""
      aria-hidden="true"
      {...checkboxRootProps}
      {...checkboxHostProps}
    />
  );
};

const InputCheckboxFieldInterface = (props) => {
  import.meta.css = css;
  const [checkboxRootProps, checkboxHostProps] = useCheckableProps(props);
  const {
    icon,
    switch: switchProp,
    appearance = icon ? "icon" : switchProp ? "switch" : "checkbox", // "checkbox", "switch", "icon", "button"
    accentColor,
  } = props;
  const { basePseudoState, checked } = checkboxHostProps;
  const loading = basePseudoState[":-navi-loading"];
  const boxRef = useRef();
  useAccentColorAttributes(boxRef, accentColor, {
    elementSelector: ".navi_checkbox_accent_probe",
  });
  let visualVnode;
  if (appearance === "icon" || icon) {
    visualVnode = (
      <div className="navi_checkbox_icon" aria-hidden="true">
        {Array.isArray(icon) ? icon[checked ? 1 : 0] : icon}
      </div>
    );
  } else if (appearance === "switch") {
    visualVnode = <SwitchUI />;
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
      {...checkboxRootProps}
      ref={boxRef}
      appearance={undefined}
      switch={undefined}
      icon={undefined}
      data-appearance={appearance}
      baseClassName="navi_checkbox"
      pseudoStateSelector=".navi_control_input"
      styleCSSVars={
        appearance === "switch"
          ? CheckboxSwitchStyleCSSVars
          : appearance === "button"
            ? CheckboxButtonStyleCSSVars
            : CheckboxStyleCSSVars
      }
      basePseudoState={basePseudoState}
      pseudoClasses={CheckboxPseudoClasses}
      pseudoElements={CheckboxPseudoElements}
    >
      <span className="navi_checkbox_accent_probe" aria-hidden="true" />
      <LoadingOutline
        loading={loading}
        inset={-1}
        color="var(--loader-color)"
      />
      {visualVnode}
      <RealInputCheckbox
        {...checkboxHostProps}
        switch={switchProp ? "" : undefined}
      />
    </Box>
  );
};
const RealInputCheckbox = (props) => {
  return (
    <Box
      {...props}
      as="input"
      type="checkbox"
      baseClassName="navi_control_input"
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
const CheckboxSwitchStyleCSSVars = {
  ...CheckboxStyleCSSVars,
  ...SwitchCSSVars,
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
