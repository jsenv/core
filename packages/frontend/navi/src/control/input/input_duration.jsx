import { parseDurationToSeconds } from "@jsenv/validity";
import { useRef } from "preact/hooks";

import { Unit } from "@jsenv/navi/src/text/unit.jsx";
import { Label } from "../field.jsx";
import { Input } from "./input.jsx";
import { InputGroup } from "./input_group.jsx";

// An input for a duration expressed as a total number of minutes (unit="minute").
// Renders hour + minute sub-inputs for ergonomic entry; the hour field is omitted
// when max < 60 (the range fits within a single minute field).
// uiAction / action are called with the total number of minutes.
export const InputDuration = ({
  name,
  value, // total minutes (number | undefined | null)
  unit, // only "minute" supported for now
  uiAction,
  ...props
}) => {
  if (unit === undefined) {
    return `InputDuration requires unit="minute"`;
  }
  if (unit !== "minute") {
    return `InputDuration only supports unit="minute" for now`;
  }

  const hiddenInputRef = useRef();
  const hiddenInput = (
    <Input
      ref={hiddenInputRef}
      type="hidden"
      name={name}
      value={value === undefined || value === null ? "" : value}
      uiAction={() => {}}
    />
  );

  return (
    <>
      {hiddenInput}
      <InputDurationAsMinutes
        value={value}
        {...props}
        uiAction={(minute, e) => {
          hiddenInputRef.current.value = minute;
          uiAction?.(minute, e);
        }}
      />
    </>
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

const InputDurationAsMinutes = (props) => {
  resolveDurationAsMinuteProps(props);
  const { max } = props;
  const showHour = max === undefined || max >= 60;

  if (showHour) {
    return <InputDurationHourAndMinute {...props} />;
  }
  return <InputDurationMinute {...props} />;
};

const InputDurationHourAndMinute = ({
  value,
  required,
  min,
  max,
  action,
  uiAction,
  unitHour,
}) => {
  const hour =
    value !== undefined && value !== null ? Math.floor(value / 60) : undefined;
  const minute = value !== undefined && value !== null ? value % 60 : undefined;
  const minHour = min !== undefined ? Math.floor(min / 60) : undefined;
  const maxHour = max !== undefined ? Math.floor(max / 60) : undefined;

  // Use refs to always read the latest derived values in callbacks,
  // even if navi Input caches the uiAction/action reference internally.
  const hourRef = useRef(hour);
  const minuteRef = useRef(minute);
  hourRef.current = hour;
  minuteRef.current = minute;

  const onUIAction = (e) => {
    const h = hourRef.current ?? 0;
    const m = minuteRef.current ?? 0;
    const totalMinutes = h * 60 + m;
    uiAction?.(totalMinutes, e);
  };
  const onAction = (context) => {
    const h = hourRef.current ?? 0;
    const m = minuteRef.current ?? 0;
    const totalMinutes = h * 60 + m;
    action?.(totalMinutes, context);
  };

  return (
    <InputGroup flex spacing="xxs" width="fit-content">
      <InputDurationHour
        required={required}
        min={minHour}
        max={maxHour}
        uiAction={(v, e) => {
          hourRef.current = v;
          onUIAction(e);
        }}
        action={
          action
            ? (v, context) => {
                hourRef.current = v;
                onAction(context);
              }
            : undefined
        }
      />
      <InputDurationMinute
        required={required}
        min={0}
        max={59}
        uiAction={(v, e) => {
          minuteRef.current = v;
          onUIAction(e);
        }}
        action={
          action
            ? (v, context) => {
                minuteRef.current = v;
                onAction(context);
              }
            : undefined
        }
        unit={unitHour}
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
  const unit = props.unit || (
    <Unit
      unit="hour"
      plural
      color="secondary"
      // We need this because ":" is inside the first input so
      // in case unit pushes to the right it should account for the space of ":"
      marginRight="1ch"
    />
  );

  return (
    <Label flex="y" textAlign="right">
      <Input
        type="navi_hour"
        unit={false}
        variant="underline"
        size="l"
        expandX
        {...props}
      >
        <Input.UI.UnitSlot>:</Input.UI.UnitSlot>
      </Input>
      {unit}
    </Label>
  );
};
