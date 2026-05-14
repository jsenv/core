import { useNextResolver } from "../../resolver/resolver.jsx";
import {
  createActionMiddleware,
  useActionProps,
} from "../create_action_middeware.jsx";
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

const PickerPresetMiddleware = (props) => {
  const Next = useNextResolver();
  if (props.type === "hour") {
    return <PickerHour {...props} />;
  }
  return <Next {...props} />;
};

const PickerPopupMiddleware = (props) => {
  const Next = useNextResolver();
  if (props.children !== undefined) {
    return <PickerPopup {...props} />;
  }
  return <Next {...props} />;
};

const PickerShowMethodMiddleware = (props) => {
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
        dispatchRequestAction(e.currentTarget, e);
      }}
      onClick={(e) => {
        props.onClick(e);
        if (e.button !== 0) {
          return;
        }
        if (e.defaultPrevented) {
          return;
        }
        dispatchRequestAction(e.currentTarget, e);
      }}
    />
  );
};
const PickerActionMiddleware = createActionMiddleware(PickerAction);

export const pickerMiddlewares = [
  PickerPresetMiddleware,
  PickerPopupMiddleware,
  PickerShowMethodMiddleware,
  PickerActionMiddleware,
];
