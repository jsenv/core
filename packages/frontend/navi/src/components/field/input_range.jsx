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
      --outline-width: 1px;
      --height: 12px;
      --rail-height: 8px;
      --rail-border: 1px solid #b5b5b5;
      --thumb-size: 0.9em;

      --outline-color: var(--navi-focus-outline-color);
      --loader-color: var(--navi-loader-color);
      --rail-color: #efefef;
      --track-color: #4a90e2;
      --thumb-color: #1875ff;
      --thumb-color-hover: #105cc8;
    }
  }

  .navi_input_range {
    --x-fill-ratio: 0;
    --x-rail-border: var(--rail-border);
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
    border-radius: inherit;
    border-radius: var(--border-radius);
    outline-width: var(--outline-width);
    outline-style: none;
    outline-color: var(--outline-color);
    cursor: inherit;

    .navi_native_input {
      position: absolute;
      margin: 0;
      opacity: 0.2;
      pointer-events: none;
    }

    .navi_input_range_rail {
      position: absolute;
      box-sizing: border-box;
      width: 100%;
      height: var(--rail-height);
      background: var(--x-rail-color);
      border: var(--x-rail-border);
      border-radius: inherit;
    }
    .navi_input_range_track {
      position: absolute;
      width: calc(var(--x-fill-ratio) * 100%);
      height: 4px;
      background: var(--x-track-color);
    }

    .navi_input_range_handle {
      position: absolute;
      left: calc(var(--x-fill-ratio) * 100%);
      width: var(--handle-size);
      height: var(--handle-size);
      background: var(--x-handle-color);
      border: var(--x-handle-border);
      border-radius: 100%;
      cursor: pointer;
    }
  }

  /* Readonly */
  .navi_input_range[data-readonly] {
    --x-background-color: var(--background-color-readonly);
    --x-color: var(--color-readonly);
  }
  /* Focus */
  .navi_input_range[data-focus-visible] .navi_native_input {
    outline-style: solid;
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
    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) {
        return;
      }
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

          const ratio =
            (inputValue - e.target.min) / (e.target.max - e.target.min);
          e.target.parentNode.style.setProperty("--x-fill-ratio", ratio);
        }}
        onresetuistate={(e) => {
          uiStateController.resetUIState(e);
        }}
        onsetuistate={(e) => {
          uiStateController.setUIState(e.detail.value, e);
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
      <div className="navi_input_range_rail"></div>
      <div className="navi_input_range_track"></div>
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
