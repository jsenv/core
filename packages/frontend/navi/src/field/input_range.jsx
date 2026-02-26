import {
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
} from "preact/hooks";

import { renderActionableComponent } from "../action/render_actionable_component.jsx";
import { useActionBoundToOneParam } from "../action/use_action.js";
import { useActionStatus } from "../action/use_action_status.js";
import { useExecuteAction } from "../action/use_execute_action.js";
import { Box } from "../box/box.jsx";
import { LoaderBackground } from "../graphic/loader/loader_background.jsx";
import { useStableCallback } from "../utils/use_stable_callback.js";
import { ReportReadOnlyOnLabelContext } from "./label.jsx";
import { useActionEvents } from "./use_action_events.js";
import { useAutoFocus } from "./use_auto_focus.js";
import {
  DisabledContext,
  LoadingContext,
  LoadingElementContext,
  ReadOnlyContext,
  UIStateContext,
  UIStateControllerContext,
  useUIState,
  useUIStateController,
} from "./use_ui_state_controller.js";
import { forwardActionRequested } from "./validation/custom_constraint_validation.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

import.meta.css = /* css */ `
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
      --track-color-hover: color-mix(in srgb, var(--fill-color) 95%, black);
      --fill-color-hover: color-mix(in srgb, var(--fill-color) 80%, black);
      --thumb-color-hover: color-mix(in srgb, var(--thumb-color) 80%, black);
      /* Active */
      --border-color-active: color-mix(
        in srgb,
        var(--border-color) 50%,
        transparent
      );
      --track-border-color-active: var(--border-color-active);
      --background-color-active: color-mix(
        in srgb,
        var(--background-color) 75%,
        white
      );
      --fill-color-active: color-mix(in srgb, var(--fill-color) 75%, white);
      --thumb-color-active: color-mix(in srgb, var(--thumb-color) 75%, white);
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
    /* Active */
    &[data-active] {
      --x-border-color: var(--border-color-active);
      --x-track-border-color: var(--track-border-color-active);
      --x-background-color: var(--background-color-active);
      --x-fill-color: var(--fill-color-active);
      --x-thumb-color: var(--thumb-color-active);
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
    }
  }

  /* Disabled */
  .navi_input_range[data-disabled] {
    --x-background-color: var(--background-color-disabled);
    --x-accent-color: var(--accent-color-disabled);
  }
  /* Callout (info, warning, error) */
  .navi_input_range[data-callout] {
    /* What can we do? */
  }
`;

export const InputRange = (props) => {
  const uiStateController = useUIStateController(props, "input");
  const uiState = useUIState(uiStateController);

  const input = renderActionableComponent(props, {
    Basic: InputRangeBasic,
    WithAction: InputRangeWithAction,
  });
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>{input}</UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};

const InputStyleCSSVars = {
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
  ":active": {
    borderColor: "--border-color-hover",
    backgroundColor: "--background-color-hover",
    fillColor: "--fill-color-active",
    thumbColor: "--thumb-color-active",
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
const InputPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];
const InputPseudoElements = ["::-navi-loader"];
const InputRangeBasic = (props) => {
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const reportReadOnlyOnLabel = useContext(ReportReadOnlyOnLabelContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    onInput,

    readOnly,
    disabled,
    loading,

    autoFocus,
    autoFocusVisible,
    autoSelect,

    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;

  const innerValue = uiState;
  const innerLoading =
    loading || (contextLoading && contextLoadingElement === ref.current);
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  // infom any <label> parent of our readOnly state
  reportReadOnlyOnLabel?.(innerReadOnly);
  useAutoFocus(ref, autoFocus, {
    autoFocusVisible,
    autoSelect,
  });
  const remainingProps = useConstraints(ref, rest);

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
        onresetuistate={(e) => {
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
      box
      baseClassName="navi_input_range"
      styleCSSVars={InputStyleCSSVars}
      pseudoStateSelector=".navi_native_input"
      visualSelector=".navi_native_input"
      basePseudoState={{
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
        ":-navi-loading": innerLoading,
      }}
      pseudoClasses={InputPseudoClasses}
      pseudoElements={InputPseudoElements}
      hasChildFunction
      {...remainingProps}
      ref={undefined}
    >
      <LoaderBackground
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

const InputRangeWithAction = (props) => {
  const uiState = useContext(UIStateContext);
  const {
    action,
    loading,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    cancelOnBlurInvalid,
    cancelOnEscape,
    actionErrorEffect,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const [boundAction] = useActionBoundToOneParam(action, uiState);
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
  });
  // here updating the input won't call the associated action
  // (user have to blur or press enter for this to happen)
  // so we can keep the ui state on cancel/abort/error and let user decide
  // to update ui state or retry via blur/enter as is
  useActionEvents(ref, {
    onCancel: (e, reason) => {
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
    },
    onRequested: (e) => {
      forwardActionRequested(e, boundAction);
    },
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd,
  });

  return (
    <InputRangeBasic
      data-action={boundAction.name}
      {...rest}
      ref={ref}
      loading={loading || actionLoading}
    />
  );
};
