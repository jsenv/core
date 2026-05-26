import { useContext, useLayoutEffect, useRef } from "preact/hooks";

import { Box, BoxForwardedPropsContext } from "../../box/box.jsx";
import { LoadingOutline } from "../../graphic/loading/loading_outline.jsx";
import { useAccentColorAttributes } from "../../utils/use_accent_color_attributes.js";
import { FIELD_PROP_SET } from "../field_context.js";
import { useFieldInterfaceProps } from "../field_hooks.jsx";

const css = /* css */ `
  @layer navi {
    .navi_input_range {
      --border-radius: 6px;
      --outline-width: 2px;
      --height: 8px;
      --thumb-size: 16px;
      --thumb-width: var(--thumb-size);
      --thumb-height: var(--thumb-size);
      --thumb-border-radius: 100%;
      --thumb-cursor: pointer;

      --outline-color: var(--navi-focus-outline-color);
      --loader-color: var(--navi-loader-color);
      --accent-color: rgb(24, 117, 255);
      --color-mix-light: black;
      --color-mix-dark: white;
      --color-mix: var(--color-mix-dark);

      --border-color: rgb(150, 150, 150);
      --track-border-color: color-mix(
        in srgb,
        var(--border-color) 35%,
        transparent
      );
      --background-color: #efefef;
      --fill-color: var(--accent-color);
      --thumb-color: var(--accent-color);
      /* Hover */
      --border-color-hover: color-mix(in srgb, var(--border-color) 75%, black);
      --track-border-color-hover: color-mix(
        in srgb,
        var(--track-border-color) 75%,
        black
      );
      --track-color-hover: color-mix(
        in srgb,
        var(--fill-color) 95%,
        var(--color-mix)
      );
      --fill-color-hover: color-mix(
        in srgb,
        var(--fill-color) 80%,
        var(--color-mix)
      );
      --thumb-color-hover: color-mix(
        in srgb,
        var(--thumb-color) 80%,
        var(--color-mix)
      );
      /* Pressed */
      --border-color-pressed: color-mix(
        in srgb,
        var(--border-color) 50%,
        transparent
      );
      --track-border-color-pressed: var(--border-color-pressed);
      --background-color-pressed: color-mix(
        in srgb,
        var(--background-color) 75%,
        white
      );
      --fill-color-pressed: color-mix(in srgb, var(--fill-color) 75%, white);
      --thumb-color-pressed: color-mix(in srgb, var(--thumb-color) 75%, white);
      /* Readonly */
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --track-border-color-readonly: var(--border-color);
      --background-color-readonly: var(--background-color);
      --fill-color-readonly: color-mix(in srgb, var(--fill-color) 30%, grey);
      --thumb-color-readonly: var(--fill-color-readonly);
      /* Disabled */
      --background-color-disabled: color-mix(
        in srgb,
        var(--background-color) 60%,
        transparent
      );
      --border-color-disabled: #b1b1b1;
      --track-border-color-disabled: var(--border-color-disabled);
      --fill-color-disabled: #cbcbcb;
      --thumb-color-disabled: #cbcbcb;
    }
  }

  .navi_input_range {
    --x-fill-ratio: 0;
    --x-border-color: var(--border-color);
    --x-track-border-color: var(--track-border-color);
    --x-background-color: var(--background-color);
    --x-fill-color: var(--fill-color);
    --x-thumb-color: var(--thumb-color);
    --x-thumb-border: none;
    --x-thumb-cursor: var(--thumb-cursor);

    position: relative;
    box-sizing: border-box;
    width: fit-content;
    height: var(--height);
    margin: 2px;
    flex-direction: inherit;
    align-items: center;
    border-radius: 2px;
    outline-width: var(--outline-width);
    outline-style: none;
    outline-color: var(--outline-color);
    outline-offset: 2px;

    .navi_native_input {
      margin: 0;
      opacity: 0;
      --webkit-appearance: none;
      min-width: inherit;
      font-size: inherit;
      appearance: none;

      &::-webkit-slider-thumb {
        width: var(--thumb-width);
        height: var(--thumb-height);
        border-radius: var(--thumb-border-radius);
        -webkit-appearance: none;
        cursor: var(--x-thumb-cursor);
      }
    }

    .navi_input_range_accent_probe {
      position: absolute;
      width: 0;
      height: 0;
      background-color: var(--accent-color);
      visibility: hidden;
      pointer-events: none;
    }

    .navi_input_range_background {
      position: absolute;
      width: 100%;
      height: var(--height);
      background: var(--x-background-color);
      border-width: 1px;
      border-style: solid;
      border-color: var(--x-border-color);
      border-radius: var(--border-radius);
    }
    .navi_input_range_track {
      position: absolute;
      box-sizing: border-box;
      width: 100%;
      height: var(--height);
      border-width: 1px;
      border-style: solid;
      border-color: var(--x-track-border-color);
      border-radius: var(--border-radius);
    }
    .navi_input_range_fill {
      position: absolute;
      width: 100%;
      height: var(--height);
      background: var(--x-fill-color);
      background-clip: content-box;
      border-radius: var(--border-radius);
      clip-path: inset(0 calc((1 - var(--x-fill-ratio)) * 100%) 0 0);
    }
    .navi_input_range_thumb {
      position: absolute;
      left: calc(
        var(--x-fill-ratio) * (100% - var(--thumb-size)) + var(--thumb-size) / 2
      );
      width: var(--thumb-width);
      height: var(--thumb-height);
      background: var(--x-thumb-color);
      border: var(--x-thumb-border);
      border-radius: var(--thumb-border-radius);
      transform: translateX(-50%);
      cursor: var(--x-thumb-cursor);
    }
    .navi_input_range_focus_proxy {
      position: absolute;
      inset: 0;
      opacity: 0;
    }

    /* Hover */
    &[data-hover] {
      --x-border-color: var(--border-color-hover);
      --x-track-border-color: var(--track-border-color-hover);
      --x-fill-color: var(--fill-color-hover);
      --x-thumb-color: var(--thumb-color-hover);
    }
    /* Pressed */
    &[data-pressed] {
      --x-border-color: var(--border-color-pressed);
      --x-track-border-color: var(--track-border-color-pressed);
      --x-background-color: var(--background-color-pressed);
      --x-fill-color: var(--fill-color-pressed);
      --x-thumb-color: var(--thumb-color-pressed);
    }
    /* Focus */
    &[data-focus-visible] {
      outline-style: solid;
    }
    /* Readonly */
    &[data-readonly] {
      --x-background-color: var(--background-color-readonly);
      --x-track-border-color: var(--track-border-color-readonly);
      --x-border-color: var(--border-color-readonly);
      --x-fill-color: var(--fill-color-readonly);
      --x-thumb-color: var(--thumb-color-readonly);
      --x-thumb-cursor: default;
    }
    /* Disabled */
    &[data-disabled] {
      --x-background-color: var(--background-color-disabled);
      --x-border-color: var(--border-color-disabled);
      --x-track-border-color: var(--track-border-color-disabled);
      --x-fill-color: var(--fill-color-disabled);
      --x-thumb-color: var(--thumb-color-disabled);
      --x-thumb-cursor: default;
      --x-accent-color: var(--accent-color-disabled);
    }
    /* Callout (info, warning, error) */
    &[data-callout] {
    }

    &[data-accent-light] {
      --color-mix: var(--color-mix-light);
    }
    &[data-accent-very-light] {
      --background-color: rgba(0, 0, 0, 0.15);
      --track-border-color: rgba(0, 0, 0, 0.25);
    }
  }
`;

export const InputRange = (props) => {
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;

  return <InputRangeFieldInterface {...props} />;
};

const InputRangeFieldInterface = (props) => {
  import.meta.css = css;
  const { ref } = props;
  const updateFillRatio = () => {
    const input = ref.current;
    if (!input) {
      return;
    }
    const inputValue = input.value;
    const ratio = (inputValue - input.min) / (input.max - input.min);
    input.parentNode.style.setProperty("--x-fill-ratio", ratio);
  };
  const [rangeProps, remainingProps] = useFieldInterfaceProps(props, {
    primaryInteractionMode: "pointer",
    fieldType: "input",
    statePropName: "value",
    defaultStatePropName: "defaultValue",
    getUIValue: () => {
      const input = ref.current;
      return input.valueAsNumber;
    },
    sideEffect: (input, uiState, e) => {
      updateFillRatio(e);
    },
    readOnlySupported: true,
  });
  const { basePseudoState } = rangeProps;
  const loading = basePseudoState[":-navi-loading"];

  const boxRef = useRef();
  useAccentColorAttributes(boxRef, props.accentColor, {
    elementSelector: ".navi_input_range_accent_probe",
  });

  return (
    <Box
      as="span"
      flex
      baseClassName="navi_input_range"
      styleCSSVars={RangeStyleCSSVars}
      pseudoStateSelector=".navi_native_input"
      visualSelector=".navi_native_input"
      pseudoClasses={RangePseudoClasses}
      pseudoElements={RangePseudoElements}
      hasChildUsingForwardedProps
      baseChildPropSet={RangeChildPropSet}
      {...remainingProps}
      basePseudoState={basePseudoState}
      ref={boxRef}
    >
      <span className="navi_input_range_accent_probe" aria-hidden="true" />
      <LoadingOutline
        loading={loading}
        color="var(--loader-color)"
        inset={-1}
      />
      <div className="navi_input_range_background" />
      <div className="navi_input_range_fill" />
      <div className="navi_input_range_track" />
      <div className="navi_input_range_thumb" />
      <RangeNativeInput {...rangeProps} updateFillRatio={updateFillRatio} />
    </Box>
  );
};
const RangeNativeInput = (props) => {
  const { updateFillRatio } = props;
  const rangeBoxProps = useContext(BoxForwardedPropsContext);

  useLayoutEffect(() => {
    updateFillRatio();
  }, []);

  return (
    <Box
      {...props}
      {...rangeBoxProps}
      as="input"
      type="range"
      baseClassName="navi_native_input"
    />
  );
};
const RangeStyleCSSVars = {
  "outlineWidth": "--outline-width",
  "borderRadius": "--border-radius",
  "borderColor": "--border-color",
  "backgroundColor": "--background-color",
  "accentColor": "--accent-color",
  ":hover": {
    borderColor: "--border-color-hover",
    backgroundColor: "--background-color-hover",
    fillColor: "--fill-color-hover",
    thumbColor: "--thumb-color-hover",
  },
  ":-navi-pressed": {
    borderColor: "--border-color-hover",
    backgroundColor: "--background-color-hover",
    fillColor: "--fill-color-pressed",
    thumbColor: "--thumb-color-pressed",
  },
  ":read-only": {
    borderColor: "--border-color-readonly",
    backgroundColor: "--background-color-readonly",
    fillColor: "--fill-color-readonly",
    thumbColor: "--thumb-color-readonly",
  },
  ":disabled": {
    borderColor: "--border-color-disabled",
    backgroundColor: "--background-color-disabled",
    fillColor: "--fill-color-disabled",
    thumbColor: "--thumb-color-disabled",
  },
};
const RangePseudoClasses = [
  ":hover",
  ":active",
  ":-navi-pressed",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];
const RangePseudoElements = ["::-navi-loader"];
const RangeChildPropSet = new Set([...FIELD_PROP_SET]);
