import { durationToMinutes, durationToString, parseDuration } from "@jsenv/validity";
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

// An input for a duration expressed as a durationToString-compatible string
// (e.g. "2hour15minute", "15minute"). Both parts are raw strings so invalid
// mid-edit values ("2ahour15minute") are preserved by durationToString.
// The component renders hour + minute sub-inputs for ergonomic entry; the hour
// field is omitted when max < 60 (the range fits within a single minute field).
// uiAction / action are called with the durationToString value.
//
// Value format (produced by durationToString):
//   "2hour15minute"  — 2 hours 15 minutes
//   "2hour"          — 2 hours, no minutes
//   "15minute"       — 15 minutes (minute-only display when max < 60)
//   "2ahour15minute" — invalid mid-edit: hour part "2a", minute part "15"
// A bare number ("30") is not valid; a unit is always required.
export const InputDuration = (props) => {
  if (props.unit !== "minute") {
    return `InputDuration only supports unit="minute" for now`;
  }
  return <InputDurationAsMinutes {...props} />;
};

const InputDurationAsMinutes = (props) => {
  resolveDurationAsMinuteProps(props);
  const { max, unitHour } = props;
  const showHour = max === undefined || max >= 60;

  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  const { uiAction, action, ref } = props;
  const [groupRootProps, groupHostProps, childrenWrapperProps] =
    useControlgroupProps(
      {
        ...props,
        uiAction: (groupState, event) => {
          const hiddenInput = ref.current;
          if (hiddenInput) {
            hiddenInput.value = groupState ?? "";
          }
          uiAction?.(groupState, event);
        },
        action: action
          ? (groupState, info) => {
              return action(groupState, info);
            }
          : undefined,
      },
      {
        controlType: "duration_group",
        cascadeValidationToChildren: true,
        // Aggregates sub-input raw strings into a durationToString value
        // ("2hour15minute"). Invalid mid-edit values like "2a" are preserved
        // by durationToString. Using strings (not numbers) avoids NaN which
        // would cause a Preact signals cycle (NaN !== NaN = true).
        aggregateChildStates: (childUIStateControllers) => {
          let h = "";
          let m = "";
          for (const child of childUIStateControllers) {
            if (child.name === "hour") {
              h = child.uiState ?? "";
            }
            if (child.name === "minute") {
              m = child.uiState ?? "";
            }
          }
          const durationObj = {};
          if (showHour && h !== "") durationObj.hours = h;
          if (m !== "") durationObj.minutes = m;
          return durationToString(durationObj) ?? "";
        },
        // Reverse mapping: duration string → { hour, minute } so that when the
        // picker cancels and calls setUIState(storedValue), the sub-inputs are
        // correctly reset to their original raw string values.
        distributeChildUIState: (groupState) => {
          const components = parseDuration(groupState);
          if (!components) return { hour: undefined, minute: undefined };
          return { hour: components.hours, minute: components.minutes };
        },
      },
    );

  const { value, min, step, required, readOnly, disabled, basePseudoState } =
    groupHostProps;
  const components = parseDuration(value);
  const hourValue = components?.hours;
  const minuteValue = components?.minutes;
  const baseChildProps = {
    min,
    step,
    required,
    readOnly,
    disabled,
    basePseudoState,
  };

  const children = showHour ? (
    <InputDurationHourAndMinute
      hourValue={hourValue}
      minuteValue={minuteValue}
      min={min}
      max={max}
      unitHour={unitHour}
      {...baseChildProps}
    />
  ) : (
    <InputDurationMinute
      value={minuteValue}
      min={0}
      max={max}
      {...baseChildProps}
    />
  );

  return (
    <Box
      width="fit-content"
      {...groupRootProps}
      unit={undefined}
      unitHour={undefined}
    >
      {/* eslint-disable-next-line react/no-unknown-property */}
      <input {...groupHostProps} type="hidden" basePseudoState={undefined} />
      <ControlgroupChildrenWrapper {...childrenWrapperProps} name={undefined}>
        {children}
      </ControlgroupChildrenWrapper>
    </Box>
  );
};
const resolveDurationAsMinuteProps = (props) => {
  props.min = toMinutes(props.min);
  props.max = toMinutes(props.max);
  props.step = toMinutes(props.step);

  return props;
};
// Parse a min/max duration value to total minutes.
// Accepts: number (already minutes), or any duration string
// ("1hour", "1hour20minute", "20minute", "30second", "2hour", …).
const toMinutes = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const minutes = durationToMinutes(value);
    return minutes ?? value;
  }
  return value;
};
const InputDurationHourAndMinute = ({
  hourValue,
  minuteValue,
  min,
  max,
  unitHour,
  ...rest
}) => {
  const minHour = min !== undefined ? Math.floor(min / 60) : undefined;
  const maxHour = max !== undefined ? Math.floor(max / 60) : undefined;

  // Minute bounds depend on the current hour value: when hours are at their
  // minimum, the minute field must cover the remaining minutes; at the maximum,
  // the minute field is capped to not exceed the total.
  const hourNum = hourValue !== undefined ? Number(hourValue) : NaN;
  const hourMinutes = isFinite(hourNum) ? hourNum * 60 : undefined;
  const minuteMin =
    min !== undefined && hourMinutes !== undefined
      ? Math.max(0, min - hourMinutes)
      : 0;
  const minuteMax =
    max !== undefined && hourMinutes !== undefined
      ? Math.min(59, max - hourMinutes)
      : 59;

  return (
    <InputGroup flex spacing="xxs" width="fit-content">
      <InputDurationHour
        value={hourValue}
        min={minHour}
        max={maxHour}
        unit={unitHour}
        separator=":"
        {...rest}
      />
      <InputDurationMinute
        value={minuteValue}
        min={minuteMin}
        max={minuteMax}
        {...rest}
      />
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
        data-separator={separator || undefined}
      >
        {separator ? (
          <Input.UI.UnitSlot>{separator}</Input.UI.UnitSlot>
        ) : undefined}
      </Input>
      {unit}
    </Label>
  );
};
