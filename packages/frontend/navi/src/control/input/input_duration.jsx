import { parseDurationToSeconds } from "@jsenv/validity";
import { useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { Unit } from "@jsenv/navi/src/text/unit.jsx";
import {
  ControlgroupChildrenWrapper,
  useControlgroupProps,
} from "../control_hooks.jsx";
import { Label } from "../field.jsx";
import { Input } from "./input.jsx";
import { InputGroup } from "./input_group.jsx";

// An input for a duration expressed as a total number of minutes (unit="minute").
// Renders hour + minute sub-inputs for ergonomic entry; the hour field is omitted
// when max < 60 (the range fits within a single minute field).
// uiAction / action are called with the total number of minutes.
//
// Architecture:
//   - A plain <input type="hidden"> acts as both the form-submission value holder
//     and the controlgroup DOM host (receives navi-control-group props).
//   - useControlgroupProps registers this component with the outer form as a
//     single named entry; sub-inputs register with this group, not the outer form.
//   - ControlgroupChildrenWrapper cascades required/disabled/readOnly/loading and
//     provides the group controller as parent for sub-inputs.
export const InputDuration = (props) => {
  if (props.unit !== "minute") {
    return `InputDuration only supports unit="minute" for now`;
  }
  return <InputDurationAsMinutes {...props} />;
};

const InputDurationAsMinutes = (props) => {
  resolveDurationAsMinuteProps(props);
  const { max } = props;
  const showHour = max === undefined || max >= 60;

  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  const { uiAction, action, ref } = props;
  const [groupRootProps, groupHostProps, childrenWrapperProps] =
    useControlgroupProps(
      {
        ...props,
        uiAction: (group, event) => {
          const totalMinutes = (group?.hour ?? 0) * 60 + (group?.minute ?? 0);
          const hiddenInput = ref.current;
          if (hiddenInput) {
            hiddenInput.value = totalMinutes;
          }
          uiAction?.(totalMinutes, event);
        },
        action: action
          ? (group, info) => {
              const minutes = (group?.hour ?? 0) * 60 + (group?.minute ?? 0);
              return action(minutes, info);
            }
          : undefined,
      },
      {
        controlType: "duration_group",
        stateType: "object",
        cascadeValidationToChildren: true,
        aggregateChildStates: (childUIStateControllers) => {
          const groupValues = {};
          for (const child of childUIStateControllers) {
            if (child.name) {
              groupValues[child.name] = child.uiState;
            }
          }
          return groupValues;
        },
      },
    );

  const {
    value,
    min,
    step,
    unitHour,
    required,
    readOnly,
    disabled,
    basePseudoState,
  } = groupHostProps;
  const childProps = {
    value,
    min,
    max,
    step,
    required,
    unitHour,
    basePseudoState,
    readOnly,
    disabled,
  };

  const children = showHour ? (
    <InputDurationHourAndMinute {...childProps} />
  ) : (
    <InputDurationMinute {...childProps} />
  );

  return (
    <Box {...groupRootProps}>
      <input {...groupHostProps} type="hidden" />
      <ControlgroupChildrenWrapper {...childrenWrapperProps} name={undefined}>
        {children}
      </ControlgroupChildrenWrapper>
    </Box>
  );
};
const resolveDurationAsMinuteProps = (props) => {
  props.min = parseDurationToMinutes(props.min);
  props.max = parseDurationToMinutes(props.max);
  props.step = parseDurationToMinutes(props.step);

  return props;
};
// Parse a min/max duration value to total minutes.
// Accepts: number (already minutes), or any string supported by parseDurationToSeconds
// ("1h", "1h20min", "20min", "30s", "2hour", …).
const parseDurationToMinutes = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "number") {
    return value;
  }
  const seconds = parseDurationToSeconds(String(value));
  if (seconds === null) {
    return undefined;
  }
  return seconds / 60;
};
const InputDurationHourAndMinute = ({ value, min, max, unitHour, ...rest }) => {
  const hour =
    value !== undefined && value !== null ? Math.floor(value / 60) : undefined;
  const minute = value !== undefined && value !== null ? value % 60 : undefined;
  const minHour = min !== undefined ? Math.floor(min / 60) : undefined;
  const maxHour = max !== undefined ? Math.floor(max / 60) : undefined;

  return (
    <InputGroup flex spacing="xxs" width="fit-content">
      <InputDurationHour
        value={hour}
        min={minHour}
        max={maxHour}
        unit={unitHour}
        separator=":"
        {...rest}
      />
      <InputDurationMinute value={minute} min={0} max={59} {...rest} />
    </InputGroup>
  );
};
const InputDurationMinute = (props) => {
  const unit = props.unit || <Unit unit="minute" plural color="secondary" />;

  return (
    <Label flex="y">
      <Input
        type="navi_minute"
        name="minute"
        size="l"
        unit={false}
        variant="underline"
        expandX
        {...props}
      />
      {unit}
    </Label>
  );
};
const InputDurationHour = (props) => {
  const { separator } = props;
  const unit = props.unit || (
    <Unit
      unit="hour"
      plural
      color="secondary"
      // We need this because ":" is inside the first input so
      // in case unit pushes to the right it should account for the space of ":"
      marginRight={separator ? `${separator.length}ch` : undefined}
    />
  );

  return (
    <Label flex="y" textAlign="right">
      <Input
        type="navi_hour"
        name="hour"
        unit={false}
        variant="underline"
        size="l"
        expandX
        {...props}
        separator={undefined}
      >
        {separator ? (
          <Input.UI.UnitSlot>{separator}</Input.UI.UnitSlot>
        ) : undefined}
      </Input>
      {unit}
    </Label>
  );
};
