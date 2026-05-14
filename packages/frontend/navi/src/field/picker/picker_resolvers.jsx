import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import {
  createActionResolver,
  useActionProps,
} from "../create_action_resolver.jsx";
import { dispatchRequestAction } from "../validation/custom_constraint_validation.js";
import { PickerPopup } from "./picker_popup/picker_popup.jsx";
import { PickerHour } from "./preset/picker_hour.jsx";
import {
  PickerColor,
  PickerDatetime,
  PickerDay,
  PickerMonth,
  PickerTime,
  PickerWeek,
} from "./show_method/picker_show_method.jsx";

const PickerPresetResolver = (props) => {
  const Next = useNextResolver();
  if (props.type === "hour") {
    return <PickerHour {...props} />;
  }
  return <Next {...props} />;
};

const PickerPopupResolver = (props) => {
  const Next = useNextResolver();
  if (props.children !== undefined) {
    return <PickerPopup {...props} />;
  }
  return <Next {...props} />;
};

const PickerShowMethodResolver = (props) => {
  const Next = useNextResolver();
  if (props.type === "color") {
    return <PickerColor {...props} />;
  }
  if (props.type === "day") {
    return <PickerDay {...props} />;
  }
  if (props.type === "month") {
    return <PickerMonth {...props} />;
  }
  if (props.type === "week") {
    return <PickerWeek {...props} />;
  }
  if (props.type === "time") {
    return <PickerTime {...props} />;
  }
  if (props.type === "datetime") {
    return <PickerDatetime {...props} />;
  }
  return <Next {...props} />;
};

const PickerAction = (props) => {
  const Next = useNextResolver();
  const actionProps = useActionProps(props);

  return (
    <Next
      {...actionProps}
      onMouseDown={(e) => {
        props.onMouseDown?.(e);
        if (e.button !== 0) {
          return;
        }
        if (e.defaultPrevented) {
          return;
        }
        dispatchRequestAction(e.currentTarget, {
          event: e,
          requester: e.currentTarget,
        });
      }}
      onClick={(e) => {
        props.onClick(e);
        if (e.button !== 0) {
          return;
        }
        if (e.defaultPrevented) {
          return;
        }
        dispatchRequestAction(e.currentTarget, {
          event: e,
          requester: e.currentTarget,
        });
      }}
    />
  );
};
const PickerActionResolver = createActionResolver(PickerAction);

export const pickerResolvers = [
  PickerPresetResolver,
  PickerPopupResolver,
  PickerShowMethodResolver,
  PickerActionResolver,
];
