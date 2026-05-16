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

import { dispatchCustomEvent } from "@jsenv/dom";
import { useContext, useMemo, useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useDebugAction } from "../navi_debug.jsx";
import { collectFormElementValues } from "./collect_form_element_values.js";
import { FormContext } from "./form_context.js";
import { useActionProps } from "./use_action_props.jsx";
import {
  LoadingContext,
  ParentUIStateControllerContext,
  ReadOnlyContext,
  UIStateContext,
  UIStateControllerContext,
  useUIGroupStateController,
  useUIState,
} from "./use_ui_state_controller.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

export const Form = (props) => {
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const uiStateController = useUIGroupStateController(props, "form", {
    childComponentType: "*",
    aggregateChildStates: (childUIStateControllers) => {
      const formValues = {};
      for (const childUIStateController of childUIStateControllers) {
        const { name, uiState, allowNameless } = childUIStateController;
        if (!name) {
          if (!allowNameless) {
            console.warn(
              "A form child component is missing a name property, its state won't be included in the form state",
              childUIStateController,
            );
          }
          continue;
        }
        formValues[name] = uiState;
      }
      return formValues;
    },
  });
  const uiState = useUIState(uiStateController);

  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>
        <FormDispatcher {...props} ref={ref} />
      </UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};
const FormDispatcher = (props) => {
  if (props.action) {
    return <FormWithAction {...props} />;
  }
  return <FormUI {...props} />;
};

const FormUI = (props) => {
  const { ref, readOnly, loading, children, ...rest } = props;
  const debugAction = useDebugAction();
  const uiStateController = useContext(UIStateControllerContext);

  // instantiate validation via useConstraints hook:
  // - receive "actionrequested" custom event ensure submit is prevented
  // (and also execute action without validation if form.submit() is ever called)
  const remainingProps = useConstraints(ref, rest);
  const innerReadOnly = readOnly || loading;
  const formContextValue = useMemo(() => {
    return { loading };
  }, [loading]);

  return (
    <Box
      data-action="toto"
      {...remainingProps}
      as="form"
      ref={ref}
      novalidate="" // make sure browser don't prevent "submit" when invalid, nor display messages
      onSubmit={(e) => {
        const form = e.currentTarget;
        e.preventDefault();
        dispatchCustomEvent(form, "navi_action_ready", {
          action: null,
          event: e,
          method: "rerun",
          requester: form,
          meta: {
            isSubmit: true,
          },
        });
      }}
      onReset={(e) => {
        // browser would empty all fields to their default values (likely empty/unchecked)
        // we want to reset to the last known external state instead
        e.preventDefault();
        debugAction(
          e,
          `form reset -> resetUIState to ${JSON.stringify(uiStateController.state)}`,
        );
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
  const { ref, action, method } = props;
  const uiStateController = useContext(UIStateControllerContext);
  const actionProps = useActionProps(props, {
    provideAction: true,
    provideActionRequester: true,
  });

  return (
    <FormUI
      data-method={action.meta?.httpVerb || method || "GET"}
      navi-submit-effect="request_action"
      {...actionProps}
      onnavi_get_managed_fields={(e) => {
        e.detail.respondWith(getFormManagedFields(e.currentTarget));
      }}
      onnavi_action_ready={(e) => {
        const form = ref.current;
        // this is not really mandatory, normally all navi fields already report
        // it's only in case we have fields that are not managed by navi
        const formElementValues = collectFormElementValues(form);
        uiStateController.setUIState(formElementValues, e);
        actionProps.onnavi_action_ready?.(e);
      }}
    />
  );
};

const getFormManagedFields = (form) => {
  const managedFields = [];
  for (const element of form.elements) {
    // if (element.name) {
    managedFields.push(element);
    // }
  }
  return managedFields;
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
