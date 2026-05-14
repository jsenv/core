import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { useActionProps } from "../create_action_resolver.jsx";
// import { dispatchRequestAction } from "../validation/custom_constraint_validation.js";

export const PickerAction = (props) => {
  const Next = useNextResolver();
  const actionProps = useActionProps(props);

  return (
    <Next
      {...actionProps}
      //   onMouseDown={(e) => {
      //     actionProps.onMouseDown?.(e);
      //     if (e.button !== 0) {
      //       return;
      //     }
      //     if (e.defaultPrevented) {
      //       return;
      //     }
      //     dispatchRequestAction(e.currentTarget, {
      //       event: e,
      //       requester: e.currentTarget,
      //     });
      //   }}
      //   onClick={(e) => {
      //     actionProps.onClick(e);
      //     if (e.button !== 0) {
      //       return;
      //     }
      //     if (e.defaultPrevented) {
      //       return;
      //     }
      //     dispatchRequestAction(e.currentTarget, {
      //       event: e,
      //       requester: e.currentTarget,
      //     });
      //   }}
    />
  );
};
