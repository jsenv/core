import { parseDurationToSeconds } from "@jsenv/validity";
import { useRef } from "preact/hooks";

import { Unit } from "@jsenv/navi/src/text/unit.jsx";
import { ControlGroup } from "../control_group.jsx";
import { ControlChildrenWrapper } from "../control_hooks.jsx";
import { Label } from "../field.jsx";
import { Input } from "./input.jsx";
import { InputGroup } from "./input_group.jsx";

// An input for a duration expressed as a total number of minutes (unit="minute").
// Renders hour + minute sub-inputs for ergonomic entry; the hour field is omitted
// when max < 60 (the range fits within a single minute field).
// uiAction / action are called with the total number of minutes.
//
// Architecture:
//   - A hidden <Input type="hidden"> is the single control registered with the
//     outer form/picker (carries the total-minutes value and the name).
//   - The hour+minute sub-inputs are wrapped in ControlChildrenWrapper(null) so
//     they are invisible to the outer parent's UI state tracking.
//   - A ControlGroup inside that null-context aggregates { hour, minute } and
//     calls uiAction with the total minutes. Its DOM events (navi_action_prevented)
//     still bubble naturally, so the sub-inputs' validation still blocks the form.
export const InputDuration = ({
  name,
  value, // total minutes (number | undefined | null)
  unit = "minute", // only "minute" supported for now
  uiAction,
  action,
  required,
  disabled,
  readOnly,
  loading,
  ...rest
}) => {
  if (unit !== "minute") {
    return `InputDuration only supports unit="minute" for now`;
  }

  const hiddenInputRef = useRef();

  return (
    <>
      {/* Face to the outer world: single hidden input the form/picker sees */}
      <Input
        ref={hiddenInputRef}
        type="hidden"
        name={name}
        value={value === undefined || value === null ? "" : value}
        uiAction={() => {}}
      />
      {/*
       * Null the outer parent context so hour/minute sub-inputs don't register
       * with the outer form or picker. DOM events still bubble up for validation.
       */}
      <ControlChildrenWrapper uiStateController={null}>
        <ControlGroup
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          loading={loading}
          uiAction={(group, event) => {
            const h = group?.hour ?? 0;
            const m = group?.minute ?? 0;
            const totalMinutes = h * 60 + m;
            if (hiddenInputRef.current) {
              hiddenInputRef.current.value = totalMinutes;
            }
            uiAction?.(totalMinutes, event);
          }}
          action={
            action
              ? async (group, info) => {
                  const h = group?.hour ?? 0;
                  const m = group?.minute ?? 0;
                  await action(h * 60 + m, info);
                }
              : undefined
          }
        >
          <InputDurationAsMinutes value={value} {...rest} />
        </ControlGroup>
      </ControlChildrenWrapper>
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

const InputDurationHourAndMinute = ({ value, min, max, unitHour }) => {
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
      />
      <InputDurationMinute value={minute} min={0} max={59} />
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
