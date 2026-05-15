import {
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
} from "preact/hooks";

import { useActionBoundToOneParam } from "../../action/use_action.js";
import { useActionStatus } from "../../action/use_action_status.js";
import { useExecuteAction } from "../../action/use_execute_action.js";
import { Box } from "../../box/box.jsx";
import { LoadingOutline } from "../../graphic/loading/loading_outline.jsx";
import { useAutoFocus } from "../../utils/focus/use_auto_focus.js";
import { useAccentColorAttributes } from "../../utils/use_accent_color_attributes.js";
import { useStableCallback } from "../../utils/use_stable_callback.js";
import {
  reportDisabledToField,
  reportInteractiveToField,
  reportReadOnlyToField,
  useFieldId,
} from "../field.jsx";
import { fieldPropSet } from "../field_prop_set.js";
import { useOnRequestAction } from "../use_action_events.js";
import { ActionRequesterContext } from "../use_action_props.jsx";
import {
  DisabledContext,
  LoadingContext,
  ReadOnlyContext,
  UIStateContext,
  UIStateControllerContext,
  useUIState,
  useUIStateController,
} from "../use_ui_state_controller.js";
import { useConstraints } from "../validation/hooks/use_constraints.js";

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
  const ref = props.ref || defaultRef;
  const fieldId = useFieldId();
  const id = props.id || fieldId;

  const uiStateController = useUIStateController(props, "input");
  const uiState = useUIState(uiStateController);

  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>
        <InputRangeDispatcher {...props} ref={ref} id={id} />
      </UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};

const InputRangeDispatcher = (props) => {
  if (props.action) {
    return <InputRangeWithAction {...props} />;
  }
  return <InputRangeUI {...props} />;
};

const InputRangeUI = (props) => {
  import.meta.css = css;
  const {
    ref,
    onInput,

    readOnly,
    disabled,
    loading,

    autoFocus,
    autoFocusVisible,
    autoSelect,

    ...rest
  } = props;
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const actionRequester = useContext(ActionRequesterContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);

  const innerValue = uiState;
  const innerLoading =
    loading || (contextLoading && actionRequester === ref.current);
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  // infom any <label> parent of our readOnly state
  reportReadOnlyToField(innerReadOnly);
  reportDisabledToField(innerDisabled);
  reportInteractiveToField(true);
  useAutoFocus(ref, autoFocus, {
    focusVisible: autoFocusVisible,
    autoSelect,
  });
  const remainingProps = useConstraints(ref, rest);
  const { accentColor } = remainingProps;

  const boxRef = useRef();
  useAccentColorAttributes(boxRef, accentColor, {
    elementSelector: ".navi_input_range_accent_probe",
  });
  const innerOnInput = useStableCallback(onInput);
  const focusProxyId = `input_range_focus_proxy_${useId()}`;
  const inertButFocusable = innerReadOnly && !innerDisabled;
  const renderInput = (inputProps) => {
    const updateFillRatio = () => {
      const input = ref.current;
      if (!input) {
        return;
      }
      const inputValue = input.value;
      const ratio = (inputValue - input.min) / (input.max - input.min);
      input.parentNode.style.setProperty("--x-fill-ratio", ratio);
    };

    useLayoutEffect(() => {
      updateFillRatio();
    }, []);

    // we must disable the input when readOnly to prevent drag and keyboard interactions effectively
    // for some reason we have to do this here instead of just giving the disabled attribute
    // via props, as for some reason preact won't set it correctly on the input element in that case
    // this means however that the input is no longer focusable
    // we have to put an other focusable element somewhere
    useLayoutEffect(() => {
      const input = ref.current;
      if (!input) {
        return;
      }

      const focusProxy = document.querySelector(`#${focusProxyId}`);
      if (innerReadOnly) {
        if (document.activeElement === input) {
          focusProxy.focus({ preventScroll: true });
        }
        input.setAttribute("focus-proxy", focusProxyId);
        input.disabled = innerReadOnly;
      } else {
        if (document.activeElement === focusProxy) {
          input.focus({ preventScroll: true });
        }
        if (!innerDisabled) {
          input.disabled = false;
        }
        input.removeAttribute("focus-proxy");
      }
    }, [innerReadOnly, innerDisabled]);

    return (
      <Box
        {...inputProps}
        as="input"
        type="range"
        ref={ref}
        data-value={uiState}
        value={innerValue}
        onInput={(e) => {
          const inputValue = e.target.valueAsNumber;
          uiStateController.setUIState(inputValue, e);
          innerOnInput?.(e);
          updateFillRatio();
        }}
        onnavi_request_reset_ui_state={(e) => {
          uiStateController.resetUIState(e);
        }}
        onsetuistate={(e) => {
          uiStateController.setUIState(e.detail.value, e);
          updateFillRatio();
        }}
        // style management
        baseClassName="navi_native_input"
      />
    );
  };

  const renderInputMemoized = useCallback(renderInput, [
    uiState,
    innerValue,
    innerOnInput,
    innerDisabled,
    innerReadOnly,
  ]);

  return (
    <Box
      as="span"
      flex
      baseClassName="navi_input_range"
      styleCSSVars={RangeStyleCSSVars}
      pseudoStateSelector=".navi_native_input"
      visualSelector=".navi_native_input"
      basePseudoState={{
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
        ":-navi-loading": innerLoading,
      }}
      pseudoClasses={RangePseudoClasses}
      pseudoElements={RangePseudoElements}
      hasChildFunction
      baseChildPropSet={RangeChildPropSet}
      {...remainingProps}
      ref={boxRef}
      autoFocus={undefined} // See use_auto_focus.js
    >
      <span className="navi_input_range_accent_probe" aria-hidden="true" />
      <LoadingOutline
        loading={innerLoading}
        color="var(--loader-color)"
        inset={-1}
      />
      <div className="navi_input_range_background" />
      <div className="navi_input_range_fill" />
      <div className="navi_input_range_track" />
      <div className="navi_input_range_thumb" />
      <div
        id={focusProxyId}
        className="navi_input_range_focus_proxy"
        tabIndex={inertButFocusable ? "0" : "-1"}
      />
      {renderInputMemoized}
    </Box>
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
const RangeChildPropSet = new Set([...fieldPropSet]);

const InputRangeWithAction = (props) => {
  const {
    ref,
    action,
    actionDebounce,
    actionAfterChange,
    loading,
    onCancel,
    onActionPrevented,
    onActionAbort,
    onActionError,
    onActionEnd,
    cancelOnBlurInvalid,
    cancelOnEscape,
    actionErrorEffect,
    ...rest
  } = props;
  const uiStateController = useContext(UIStateControllerContext);
  const [boundAction] = useActionBoundToOneParam(
    action,
    uiStateController.uiStateSignal,
  );
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
  });
  const onRequestAction = useOnRequestAction();

  return (
    <InputRangeDispatcher
      data-action={boundAction.name}
      data-action-debounce={actionDebounce}
      data-action-after-change={actionAfterChange ? "" : undefined}
      {...rest}
      ref={ref}
      action={undefined}
      loading={loading || actionLoading}
      onnavi_cancel={(e) => {
        const { reason } = e.detail;
        if (reason.startsWith("blur_invalid")) {
          if (!cancelOnBlurInvalid) {
            return;
          }
          if (
            // error prevent cancellation until the user closes it (or something closes it)
            e.detail.failedConstraintInfo.level === "error" &&
            e.detail.failedConstraintInfo.reportStatus !== "closed"
          ) {
            return;
          }
        }
        if (reason === "escape_key") {
          if (!cancelOnEscape) {
            return;
          }
        }
        onCancel?.(e, reason);
      }}
      onnavi_request_action={(e) => {
        onRequestAction(boundAction, e);
      }}
      onnavi_action_prevented={onActionPrevented}
      onnavi_action_ready={executeAction}
      onnavi_action_abort={onActionAbort}
      onnavi_action_error={onActionError}
      onnavi_action_end={onActionEnd}
    />
  );
};
