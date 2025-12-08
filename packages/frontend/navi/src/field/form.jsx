/**
 *
 * Here we want the same behaviour as web standards:
 *
 * 1. When submitting the form URL does not change
 * 2. When form submission id done user is redirected (by default the current one)
 *    (we can configure this using target)
 *    So for example user might be reidrect to a page with the resource he just created
 *    I could create an example where we would put a link on the page to let user see what he created
 *    but by default user stays on the form allowing to create multiple resources at once
 *    And an other where he is redirected to the resource he created
 * 3. If form submission fails ideally we should display this somewhere on the UI
 *    right now it's just logged to the console I need to see how we can achieve this
 */

import { useContext, useMemo, useRef } from "preact/hooks";

import { renderActionableComponent } from "../action/render_actionable_component.jsx";
import { useActionBoundToOneParam } from "../action/use_action.js";
import { useExecuteAction } from "../action/use_execute_action.js";
import { Box } from "../box/box.jsx";
import { collectFormElementValues } from "./collect_form_element_values.js";
import { FormActionContext, FormContext } from "./form_context.js";
import {
  useActionEvents,
  useRequestedActionStatus,
} from "./use_action_events.js";
import {
  LoadingContext,
  LoadingElementContext,
  ParentUIStateControllerContext,
  ReadOnlyContext,
  UIStateContext,
  UIStateControllerContext,
  useUIGroupStateController,
  useUIState,
} from "./use_ui_state_controller.js";
import { forwardActionRequested } from "./validation/custom_constraint_validation.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

export const Form = (props) => {
  const uiStateController = useUIGroupStateController(props, "form", {
    childComponentType: "*",
    aggregateChildStates: (childUIStateControllers) => {
      const formValues = {};
      for (const childUIStateController of childUIStateControllers) {
        const { name, uiState } = childUIStateController;
        if (!name) {
          console.warn(
            "A form child component is missing a name property, its state won't be included in the form state",
            childUIStateController,
          );
          continue;
        }
        formValues[name] = uiState;
      }
      return formValues;
    },
  });
  const uiState = useUIState(uiStateController);

  const form = renderActionableComponent(props, {
    Basic: FormBasic,
    WithAction: FormWithAction,
  });
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>{form}</UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};

const FormBasic = (props) => {
  const uiStateController = useContext(UIStateControllerContext);
  const { readOnly, loading, children, ...rest } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;

  // instantiation validation to:
  // - receive "requestsubmit" custom event ensure submit is prevented
  // (and also execute action without validation if form.submit() is ever called)
  const remainingProps = useConstraints(ref, rest);
  const innerReadOnly = readOnly || loading;
  const formContextValue = useMemo(() => {
    return { loading };
  }, [loading]);

  return (
    <Box
      {...remainingProps}
      as="form"
      ref={ref}
      onReset={(e) => {
        // browser would empty all fields to their default values (likely empty/unchecked)
        // we want to reset to the last known external state instead
        e.preventDefault();
        uiStateController.resetUIState(e);
      }}
    >
      <ParentUIStateControllerContext.Provider value={uiStateController}>
        <ReadOnlyContext.Provider value={innerReadOnly}>
          <LoadingContext.Provider value={loading}>
            <FormContext.Provider value={formContextValue}>
              {children}
            </FormContext.Provider>
          </LoadingContext.Provider>
        </ReadOnlyContext.Provider>
      </ParentUIStateControllerContext.Provider>
    </Box>
  );
};

const FormWithAction = (props) => {
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    action,
    method,
    actionErrorEffect = "show_validation_message", // "show_validation_message" or "throw"
    errorMapping,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    loading,
    children,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const [actionBoundToUIState] = useActionBoundToOneParam(action, uiState);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
    errorMapping,
  });
  const { actionPending, actionRequester: formActionRequester } =
    useRequestedActionStatus(ref);

  useActionEvents(ref, {
    onPrevented: onActionPrevented,
    onRequested: (e) => {
      forwardActionRequested(e, actionBoundToUIState);
    },
    onAction: (e) => {
      const form = ref.current;
      const formElementValues = collectFormElementValues(form);
      uiStateController.setUIState(formElementValues, e);
      executeAction(e);
    },
    onStart: onActionStart,
    onAbort: (e) => {
      // user might want to re-submit as is
      // or change the ui state before re-submitting
      // we can't decide for him
      onActionAbort?.(e);
    },
    onError: (e) => {
      // user might want to re-submit as is
      // or change the ui state before re-submitting
      // we can't decide for him
      onActionError?.(e);
    },
    onEnd: (e) => {
      // form side effect is a success
      // we can get rid of the nav state
      // that was keeping the ui state in case user navigates away without submission
      uiStateController.actionEnd(e);
      onActionEnd?.(e);
    },
  });
  const innerLoading = loading || actionPending;

  return (
    <FormBasic
      data-action={actionBoundToUIState.name}
      data-method={action.meta?.httpVerb || method || "GET"}
      {...rest}
      ref={ref}
      loading={innerLoading}
    >
      <FormActionContext.Provider value={actionBoundToUIState}>
        <LoadingElementContext.Provider value={formActionRequester}>
          {children}
        </LoadingElementContext.Provider>
      </FormActionContext.Provider>
    </FormBasic>
  );
};

// const dispatchCustomEventOnFormAndFormElements = (type, options) => {
//   const form = innerRef.current;
//   const customEvent = new CustomEvent(type, options);
//   // https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/elements
//   for (const element of form.elements) {
//     element.dispatchEvent(customEvent);
//   }
//   form.dispatchEvent(customEvent);
// };
