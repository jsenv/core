import {
  durationToISOString,
  durationToSeconds,
  parseDuration,
} from "@jsenv/validity";
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

// An input for a duration expressed as an ISO 8601 duration string
// (e.g. "PT2H15M", "PT2H15M30S"). Which sub-fields are shown
// is derived from min/max/step:
//   default (no props): hour + minute  (max defaults to 24h, step to 1min)
//   max="59minute"    : minute only    (max < 1 hour → no hour field)
//   min="0second"     : hour + minute + second (seconds unit detected in props)
//
// value/min/max/step accept both ISO 8601 strings and human-friendly strings
// (e.g. "1h30min", "2 hours", "5minute") which are converted automatically.
// uiAction / action receive an ISO 8601 string.
// The internal representation is always in seconds (min/max/step are converted).
export const InputDuration = (props) => {
  return <InputDurationImpl {...props} />;
};

const DEFAULT_MAX_SECONDS = 24 * 3600; // 86400

const InputDurationImpl = (props) => {
  const { max = DEFAULT_MAX_SECONDS } = props;
  const minDuration = parseDuration(props.min);
  const maxDuration = parseDuration(max);
  const stepDuration = parseDuration(props.step);

  const showSeconds =
    Object.hasOwn(minDuration ?? {}, "seconds") ||
    Object.hasOwn(maxDuration ?? {}, "seconds") ||
    Object.hasOwn(stepDuration ?? {}, "seconds");

  const hasValue = Object.hasOwn(props, "value");

  const { unitHour } = props;
  const minSeconds = minDuration ? durationToSeconds(minDuration) : undefined;
  const maxSeconds = durationToSeconds(maxDuration);
  const stepSeconds = stepDuration
    ? durationToSeconds(stepDuration)
    : undefined;

  const showHours = maxSeconds >= 3600;
  const showMinutes = maxSeconds >= 60;

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
          ? (groupState, info) => action(groupState, info)
          : undefined,
      },
      {
        controlType: "duration_group",
        cascadeValidationToChildren: true,
        // Aggregates sub-input values into an ISO 8601-like duration string.
        // durationToISOString preserves non-numeric mid-edit values
        // (e.g. hours="ab") between their unit markers ("PTabH30M"),
        // which round-trips correctly through parseISODuration.
        aggregateChildStates: (childUIStateControllers) => {
          let h = "";
          let m = "";
          let s = "";
          for (const child of childUIStateControllers) {
            if (child.name === "hour") h = child.uiState ?? "";
            if (child.name === "minute") m = child.uiState ?? "";
            if (child.name === "second") s = child.uiState ?? "";
          }
          const durationObj = {};
          if (showHours && h !== "") {
            durationObj.hours = h;
          }
          if (showMinutes && m !== "") {
            durationObj.minutes = m;
          }
          if (showSeconds && s !== "") {
            durationObj.seconds = s;
          }
          return durationToISOString(durationObj) ?? "";
        },
        // Reverse mapping: duration string → { hour, minute, second } so that
        // when the picker cancels and calls setUIState(storedValue), the
        // sub-inputs are correctly reset to their original raw string values.
        distributeChildUIState: (groupState) => {
          const components = parseDuration(groupState);
          if (!components) {
            return { hour: undefined, minute: undefined, second: undefined };
          }
          return {
            hour: components.hours,
            minute: components.minutes,
            second: components.seconds,
          };
        },
      },
    );

  const { value, required, readOnly, disabled, basePseudoState } =
    groupHostProps;
  // When controlled (value prop), parse the current value.
  // When uncontrolled (defaultValue prop), parse defaultValue for the initial render.
  const renderSource = hasValue ? value : props.defaultValue;
  const components = parseDuration(renderSource);
  const hourValue = components?.hours;
  const minuteValue = components?.minutes;
  const secondValue = components?.seconds;

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
        <InputDurationFields
          showHours={showHours}
          showMinutes={showMinutes}
          showSeconds={showSeconds}
          controlled={hasValue}
          hourValue={hourValue}
          minuteValue={minuteValue}
          secondValue={secondValue}
          minSeconds={minSeconds}
          maxSeconds={maxSeconds}
          stepSeconds={stepSeconds}
          unitHour={unitHour}
          required={required}
          readOnly={readOnly}
          disabled={disabled}
          basePseudoState={basePseudoState}
        />
      </ControlgroupChildrenWrapper>
    </Box>
  );
};

// Renders the appropriate combination of hour/minute/second sub-inputs based
// on which fields are active. Bounds for each field are derived from the
// current values of the other fields so that the combination stays within
// [minSeconds, maxSeconds].
const InputDurationFields = ({
  showHours,
  showMinutes,
  showSeconds,
  controlled,
  hourValue,
  minuteValue,
  secondValue,
  minSeconds,
  maxSeconds,
  stepSeconds,
  unitHour,
  ...childProps
}) => {
  const hourNum = hourValue !== undefined ? Number(hourValue) : NaN;
  const minuteNum = minuteValue !== undefined ? Number(minuteValue) : NaN;
  const hourInSeconds = isFinite(hourNum) ? hourNum * 3600 : undefined;
  const minuteInSeconds = isFinite(minuteNum) ? minuteNum * 60 : undefined;

  // Hour bounds (in hours)
  const minHours =
    minSeconds !== undefined ? Math.floor(minSeconds / 3600) : undefined;
  const maxHours = Math.floor(maxSeconds / 3600);

  // Minute bounds (in minutes), offset by the current hour value when present
  const minuteMin =
    showHours && hourInSeconds !== undefined
      ? minSeconds !== undefined
        ? Math.max(0, Math.floor((minSeconds - hourInSeconds) / 60))
        : 0
      : minSeconds !== undefined
        ? Math.floor(minSeconds / 60)
        : 0;
  const minuteMax =
    showHours && hourInSeconds !== undefined
      ? Math.min(59, Math.floor((maxSeconds - hourInSeconds) / 60))
      : Math.floor(maxSeconds / 60);

  // Second bounds (in seconds), offset by the current hour+minute values
  const baseSeconds = (hourInSeconds ?? 0) + (minuteInSeconds ?? 0);
  const secondMin =
    showMinutes && minuteInSeconds !== undefined
      ? minSeconds !== undefined
        ? Math.max(0, minSeconds - baseSeconds)
        : 0
      : minSeconds !== undefined
        ? minSeconds
        : 0;
  const secondMax =
    showMinutes && minuteInSeconds !== undefined
      ? Math.min(59, maxSeconds - baseSeconds)
      : maxSeconds;

  // Per-field step values
  const stepForMinutes =
    stepSeconds !== undefined ? stepSeconds / 60 : undefined;
  // If the step is a whole number of hours, apply it to the hour field.
  // Otherwise (step expressed in minutes/seconds) the hour field increments by 1.
  const stepForHours =
    stepSeconds !== undefined && stepSeconds % 3600 === 0
      ? stepSeconds / 3600
      : 1;

  const inputs = [];

  if (showHours) {
    inputs.push(
      <InputDurationHour
        key="hour"
        {...(controlled ? { value: hourValue } : { defaultValue: hourValue })}
        min={minHours}
        max={maxHours}
        step={stepForHours}
        unit={unitHour}
        separator={showMinutes || showSeconds ? ":" : undefined}
        {...childProps}
      />,
    );
  }

  if (showMinutes) {
    inputs.push(
      <InputDurationMinute
        key="minute"
        {...(controlled
          ? { value: minuteValue }
          : { defaultValue: minuteValue })}
        min={minuteMin}
        max={minuteMax}
        step={stepForMinutes}
        separator={showSeconds ? ":" : undefined}
        {...childProps}
      />,
    );
  }

  if (showSeconds) {
    inputs.push(
      <InputDurationSecond
        key="second"
        {...(controlled
          ? { value: secondValue }
          : { defaultValue: secondValue })}
        min={secondMin}
        max={secondMax}
        step={stepSeconds}
        {...childProps}
      />,
    );
  }

  if (inputs.length === 1) {
    return inputs[0];
  }

  return (
    <InputGroup flex spacing="xxs" width="fit-content">
      {inputs}
    </InputGroup>
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
        alignX="center"
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

const InputDurationMinute = ({ separator, ...props }) => {
  const unit = <Unit unit="minute" plural color="secondary" />;

  return (
    <Label flex="y">
      <Input
        type="navi_minute"
        name="minute"
        alignX="center"
        size="l"
        unit={false}
        variant="underline"
        expandX
        {...props}
      >
        {separator ? (
          <Input.UI.UnitSlot>{separator}</Input.UI.UnitSlot>
        ) : undefined}
      </Input>
      {unit}
    </Label>
  );
};

const InputDurationSecond = (props) => {
  const unit = <Unit unit="second" plural color="secondary" />;

  return (
    <Label flex="y">
      <Input
        type="navi_second"
        name="second"
        alignX="center"
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
