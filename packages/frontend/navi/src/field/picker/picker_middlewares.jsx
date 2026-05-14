import { useContext } from "preact/hooks";

import {
  createActionMiddleware,
  useActionProps,
} from "../create_action_middeware.jsx";
import { dispatchRequestAction } from "../validation/custom_constraint_validation.js";
import { PickerDispatcherContext } from "./picker_context.jsx";
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
  const Dispatcher = useContext(PickerDispatcherContext);
  if (props.type === "hour") {
    return <PickerHour {...props} />;
  }
  return <Dispatcher {...props} />;
};

const PickerPopupMiddleware = (props) => {
  const Dispatcher = useContext(PickerDispatcherContext);
  if (props.children !== undefined) {
    return <PickerPopup {...props} />;
  }
  return <Dispatcher {...props} />;
};

const PickerShowMethodMiddleware = (props) => {
  const Dispatcher = useContext(PickerDispatcherContext);
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
  return <Dispatcher {...props} />;
};

const PickerAction = (props) => {
  const Dispatcher = useContext(PickerDispatcherContext);
  const actionProps = useActionProps(props);

  return (
    <Dispatcher
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
const PickerActionMiddleware = createActionMiddleware(
  PickerAction,
  PickerDispatcherContext,
);

export const pickerMiddlewares = [
  PickerPresetMiddleware,
  PickerPopupMiddleware,
  PickerShowMethodMiddleware,
  PickerActionMiddleware,
];
