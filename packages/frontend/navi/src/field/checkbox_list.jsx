// TOFIX: select in data then reset, it reset to red/blue instead of red/blue/green

import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { InputCheckbox } from "./input/input_checkbox.jsx";
import { useActionProps } from "./use_action_props.jsx";
import { useFieldGroupProps } from "./use_field_group_props.jsx";
import {
  UIStateControllerContext,
  useUIGroupStateController,
} from "./use_ui_state_controller.js";
import { dispatchRequestAction } from "./validation/custom_constraint_validation.js";

export const CheckboxList = (props) => {
  const refDefault = useRef(null);
  const ref = props.ref || refDefault;
  const uiStateController = useUIGroupStateController(props, "checkbox_list", {
    childComponentType: "checkbox",
    aggregateChildStates: (childUIStateControllers) => {
      const values = [];
      for (const childUIStateController of childUIStateControllers) {
        if (childUIStateController.uiState) {
          values.push(childUIStateController.uiState);
        }
      }
      return values.length === 0 ? undefined : values;
    },
  });
  const checkboxList = <CheckboxListDispatcher {...props} ref={ref} />;

  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      {checkboxList}
    </UIStateControllerContext.Provider>
  );
};
export const Checkbox = InputCheckbox;

const CheckboxListDispatcher = (props) => {
  if (props.action) {
    return <CheckboxListWithAction {...props} />;
  }
  return <CheckboxListUI {...props} />;
};

const CheckboxListUI = (props) => {
  const fieldGroupProps = useFieldGroupProps(props);

  return (
    <Box
      flex
      {...fieldGroupProps}
      baseClassName="navi_checkbox_list"
      data-checkbox-list=""
    />
  );
};

const CheckboxListWithAction = (props) => {
  const remainingProps = useActionProps(
    {
      resetOnCancel: true,
      resetOnAbort: true,
      resetOnError: true,
      ...props,
    },
    {
      provideAction: true,
      provideActionRequester: true,
    },
  );

  return (
    <CheckboxListUI
      {...remainingProps}
      onChange={(e) => {
        const checkbox = e.target;
        const checkboxList = props.ref.current;
        dispatchRequestAction(checkboxList, {
          event: e,
          requester: checkbox,
        });
      }}
    />
  );
};
