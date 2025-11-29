import { useCallback, useContext, useLayoutEffect, useRef } from "preact/hooks";

import { useActionStatus } from "../../use_action_status.js";
import { forwardActionRequested } from "../../validation/custom_constraint_validation.js";
import { useConstraints } from "../../validation/hooks/use_constraints.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useActionBoundToOneParam } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { Box } from "../layout/box.jsx";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { useStableCallback } from "../use_stable_callback.js";
import { ReportReadOnlyOnLabelContext } from "./label.jsx";
import { useActionEvents } from "./use_action_events.js";
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

import.meta.css = /* css */ `
  @layer navi {
    .navi_input_range {
      --border-radius: 6px;
      --outline-width: 2px;
      --height: 12px;
      --rail-height: 8px;
      --handle-size: 1em;

      --outline-color: var(--navi-focus-outline-color);
      --loader-color: var(--navi-loader-color);
      --rail-border-color: rgba(181, 181, 181, 0.2);
      --track-border-color: #3e75bb;
      --track-border-color-hover: #2b568b;
      --rail-color: #efefef;
      --track-color: rgb(24, 117, 255);
      --handle-color: rgb(24, 117, 255);

      --rail-border-color-hover: color-mix(
        in srgb,
        var(--rail-border-color) 75%,
        black
      );
      --rail-color-hover: color-mix(in srgb, var(--rail-color) 95%, black);
      --track-color-hover: rgb(16, 92, 200);
      --handle-color-hover: rgb(16, 92, 200);

      --rail-color-active: color-mix(in srgb, var(--rail-color) 75%, white);
      --track-border-color-active: color-mix(
        in srgb,
        var(--track-border-color) 75%,
        white
      );
      --track-color-active: color-mix(in srgb, var(--track-color) 75%, white);
      --handle-color-active: color-mix(in srgb, var(--handle-color) 75%, white);
    }
  }

  .navi_input_range {
    --x-fill-ratio: 0;
    --x-rail-border-color: var(--rail-border-color);
    --x-track-border-color: var(--track-border-color);
    --x-rail-color: var(--rail-color);
    --x-track-color: var(--track-color);
    --x-handle-color: var(--handle-color);
    --x-handle-border: none;

    position: relative;
    box-sizing: border-box;
    width: 100%;
    height: var(--height);
    margin: 2px;
    flex-direction: inherit;
    align-items: center;
    border-radius: 2px;
    outline-width: var(--outline-width);
    outline-style: none;
    outline-color: var(--outline-color);
    outline-offset: 0px;
    cursor: inherit;

    .navi_native_input {
      position: absolute;
      inset: 0;
      margin: 0;
      opacity: 0;
      pointer-events: none;
    }

    .navi_input_range_background {
      position: absolute;
      width: 100%;
      height: var(--rail-height);
      background: var(--x-rail-color);
      /* Same color as rail-border-color without opacity */
      border: 1px solid rgba(181, 181, 181, 1);
      border-radius: var(--border-radius);
    }

    .navi_input_range_rail {
      position: absolute;
      box-sizing: border-box;
      width: 100%;
      height: var(--rail-height);

      border-width: 1px;
      border-style: solid;
      border-color: var(--x-rail-border-color);
      border-radius: var(--border-radius);
    }
    .navi_input_range_track {
      position: absolute;
      width: calc(var(--x-fill-ratio) * 100%);
      height: var(--rail-height);
      background: var(--x-track-color);
      background-clip: content-box;
      /* border: 1px solid var(--x-track-border-color); */
      border-radius: var(--border-radius);

      &:hover {
        --x-track-border-color: var(--track-border-color-hover);
        --x-track-color: var(--track-color-hover);
      }
    }
    .navi_input_range_handle {
      position: absolute;
      left: calc(var(--x-fill-ratio) * 100%);
      width: var(--handle-size);
      height: var(--handle-size);
      background: var(--x-handle-color);
      border: var(--x-handle-border);
      border-radius: 100%;
      transform: translateX(-50%);
      cursor: pointer;

      &:hover {
        --x-handle-color: var(--handle-color-hover);
      }
      &:active {
        --x-handle-color: var(--handle-color-active);
      }
    }

    /* Hover */
    &:hover {
      --x-rail-border-color: var(--rail-border-color-hover);
      --x-track-border-color: var(--track-border-color-hover);
      --x-track-color: var(--track-color-hover);
      --x-rail-color: var(--rail-color-hover);
    }
    /* Active */
    &:active {
      --x-track-border-color: var(--track-border-color-active);
      --x-track-color: var(--track-color-active);
      --x-rail-color: var(--rail-color-active);
      --x-handle-color: var(--handle-color-active);

      .navi_input_range_track {
        --x-track-border-color: var(--track-border-color-active) !important;
        --x-track-color: var(--track-color-active) !important;
      }
    }
    /* Readonly */
    &[data-readonly] {
      --x-background-color: var(--background-color-readonly);
      --x-color: var(--color-readonly);
    }
    /* Focus */
    &[data-focus-visible] {
      outline-style: solid;
    }
  }

  /* Disabled */
  .navi_input_range[data-disabled] {
    --x-background-color: var(--background-color-disabled);
    --x-color: var(--color-disabled);
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
    InsideForm: InputRangeInsideForm,
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
  "backgroundColor": "--background-color",
  "color": "--color",
  ":hover": {
    backgroundColor: "--background-color-hover",
    color: "--color-hover",
  },
  ":active": {
    borderColor: "--border-color-active",
  },
  ":read-only": {
    backgroundColor: "--background-color-readonly",
    color: "--color-readonly",
  },
  ":disabled": {
    backgroundColor: "--background-color-disabled",
    color: "--color-disabled",
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
    constraints = [],
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
  useConstraints(ref, constraints);

  const innerOnInput = useStableCallback(onInput);
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

    return (
      <Box
        {...inputProps}
        as="input"
        type="range"
        ref={ref}
        data-value={uiState}
        value={innerValue}
        onInput={(e) => {
          const inputValue = e.target.value;
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
      {...rest}
      ref={undefined}
    >
      <LoaderBackground
        loading={innerLoading}
        color="var(--loader-color)"
        inset={-1}
      />
      {renderInputMemoized}
      <div className="navi_input_range_background"></div>
      <div className="navi_input_range_track"></div>
      <div className="navi_input_range_rail"></div>

      <div className="navi_input_range_handle"></div>
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
const InputRangeInsideForm = (props) => {
  const {
    // We destructure formContext to avoid passing it to the underlying input element
    // eslint-disable-next-line no-unused-vars
    formContext,
    ...rest
  } = props;

  return <InputRangeBasic {...rest} />;
};
