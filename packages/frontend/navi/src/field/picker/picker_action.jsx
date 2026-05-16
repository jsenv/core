import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { useActionProps } from "../use_action_props.jsx";
// import { dispatchRequestAction } from "../validation/custom_constraint_validation.js";

export const PickerAction = (props) => {
  const Next = useNextResolver();
  const actionProps = useActionProps(props);

  return <Next {...actionProps} />;
};
