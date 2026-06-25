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
import { dispatchRequestInteraction } from "../rules/control_interaction.js";
import { dispatchRequestSetUIState } from "../ui_state_dom.js";
import { Input } from "./input.jsx";
import { InputGroup } from "./input_group.jsx";

const css = /* css */ `
  .navi_input_duration {
    --duration-separator-spacing: 4px;

    .navi_label {
      &[data-separator] {
        .navi_unit {
          margin-right: 1ch;
          margin-right: calc(1ch + var(--duration-separator-spacing));
        }
      }
    }

    .navi_input {
      --padding-x: 0;

      .navi_input_slot {
        --slot-spacing: var(--duration-separator-spacing);

        margin-right: calc(var(--slot-spacing) / 2);
      }
    }
  }
`;

/**
 * An input for a duration expressed as an ISO 8601 duration string
 * (e.g. "PT2H15M", "PT2H15M30S").
 *
 * Which sub-fields are shown is derived from `min`, `max`, and `step`:
 *   - default:             H + M  (max defaults to "23h59")
 *   - max < 1 hour:        M only (e.g. max="59min")
 *   - max < 1 minute:      S only (e.g. max="59second")
 *   - max < 1 second:      MS only (e.g. max="999millisecond")
 *   - step="1hour":        H only (whole-hour step hides minutes)
 *   - max includes seconds: adds S field (e.g. max="59min59second" → M + S)
 *   - value has seconds:   adds S field read-only if step doesn't allow seconds
 *
 * `value`, `min`, `max`, `step` accept ISO 8601 strings or human-friendly
 * strings (e.g. "1h30min", "2 hours", "5minute").
 *
 * `uiAction` / `action` receive an ISO 8601 duration string.
 *
 * Loading state is displayed on the group container only — sub-inputs do not
 * carry individual loading outlines.
 *
 * @param {Object} props
 * @param {string} [props.value] - Controlled value (ISO 8601 or human-friendly)
 * @param {string} [props.defaultValue] - Uncontrolled initial value
 * @param {string} [props.min] - Minimum duration
 * @param {string} [props.max="23h59"] - Maximum duration (also controls which fields appear)
 * @param {string} [props.step] - Step between valid values (also controls which fields appear)
 * @param {string} [props.name] - Field name for form submission
 * @param {boolean} [props.readOnly]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.required]
 * @param {boolean} [props.loading]
 * @param {Function} [props.uiAction] - Called on every change with the ISO 8601 value
 * @param {Function} [props.action] - Called on form submission
 * @param {preact.ComponentChild} [props.unitHour] - Custom label for the hour sub-field
 * @param {"auto"|"left"|"center"|"right"} [props.textAlign="auto"] - Text alignment of sub-inputs.
 *   "auto" aligns each field toward its neighbouring separator (first→right, last→left, middle/solo→center).
 */
export const InputDuration = (props) => {
  import.meta.css = css;
  props.max = props.max || "23h59";
  const minDuration = parseDuration(props.min);
  const maxDuration = parseDuration(props.max);
  const stepDuration = parseDuration(props.step);

  const hasValue = Object.hasOwn(props, "value");

  const { unitHour, textAlign = "auto" } = props;
  const minSeconds = minDuration ? durationToSeconds(minDuration) : undefined;
  const maxSeconds = durationToSeconds(maxDuration);
  const stepSeconds = stepDuration
    ? durationToSeconds(stepDuration)
    : undefined;

  const renderSource = hasValue ? props.value : props.defaultValue;
  const components = parseDuration(renderSource);
  const valueHasSeconds = components?.seconds !== undefined;
  const valueHasMinutes = components?.minutes !== undefined;
  // Fractional seconds (e.g. 0.5 from "PT0.5S") also imply milliseconds.
  const valueHasMilliseconds =
    components?.milliseconds !== undefined ||
    (typeof components?.seconds === "number" && components.seconds % 1 !== 0);

  const stepHasSeconds = Object.hasOwn(stepDuration ?? {}, "seconds");
  const stepHasMilliseconds = Object.hasOwn(stepDuration ?? {}, "milliseconds");
  const showSeconds =
    Object.hasOwn(minDuration ?? {}, "seconds") ||
    Object.hasOwn(maxDuration ?? {}, "seconds") ||
    stepHasSeconds ||
    valueHasSeconds;
  const showMilliseconds =
    Object.hasOwn(minDuration ?? {}, "milliseconds") ||
    Object.hasOwn(maxDuration ?? {}, "milliseconds") ||
    stepHasMilliseconds ||
    valueHasMilliseconds;
  // Seconds/minutes field is read-only when the value has sub-step precision
  // but the step only aligns to a coarser unit — the user cannot legally edit it.
  const secondsReadOnly =
    valueHasSeconds && stepSeconds !== undefined && !stepHasSeconds && !stepHasMilliseconds;
  const millisecondsReadOnly =
    valueHasMilliseconds && stepSeconds !== undefined && !stepHasMilliseconds;

  const showHours = maxSeconds >= 3600;
  // Hide minutes when the step is a whole number of hours — entering fractional
  // hours would contradict the step, so only the hour field is shown.
  // Exception: if the current value already has minutes, show them read-only so
  // the stored precision is faithfully displayed.
  const showMinutes =
    maxSeconds >= 60 &&
    (stepSeconds === undefined || stepSeconds < 3600 || valueHasMinutes);
  const minutesReadOnly =
    valueHasMinutes && stepSeconds !== undefined && stepSeconds >= 3600;

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
          let ms = "";
          for (const child of childUIStateControllers) {
            if (child.name === "hour") h = child.uiState ?? "";
            if (child.name === "minute") m = child.uiState ?? "";
            if (child.name === "second") s = child.uiState ?? "";
            if (child.name === "millisecond") ms = child.uiState ?? "";
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
          if (showMilliseconds && ms !== "") {
            durationObj.milliseconds = ms;
          }
          return durationToISOString(durationObj) ?? "";
        },
        // Reverse mapping: duration string → { hour, minute, second, millisecond }
        // so that when the picker cancels and calls setUIState(storedValue), the
        // sub-inputs are correctly reset to their original raw string values.
        // ISO 8601 encodes milliseconds as fractional seconds (e.g. "PT0.5S" = 500ms),
        // so fractional seconds are split back into whole seconds + ms.
        distributeChildUIState: (groupState) => {
          const components = parseDuration(groupState);
          if (!components) {
            return {
              hour: undefined,
              minute: undefined,
              second: undefined,
              millisecond: undefined,
            };
          }
          const rawSeconds = components.seconds;
          let secondForField = rawSeconds;
          let millisecondForField = components.milliseconds;
          if (
            typeof rawSeconds === "number" &&
            rawSeconds % 1 !== 0 &&
            millisecondForField === undefined
          ) {
            secondForField = Math.floor(rawSeconds);
            millisecondForField = Math.round((rawSeconds % 1) * 1000);
          }
          return {
            hour: components.hours,
            minute: components.minutes,
            second: secondForField,
            millisecond: millisecondForField,
          };
        },
      },
    );

  const { required, readOnly, disabled, basePseudoState } = groupHostProps;

  const visibleFields = [];
  if (showHours) visibleFields.push("hour");
  if (showMinutes) visibleFields.push("minute");
  if (showSeconds) visibleFields.push("second");
  if (showMilliseconds) visibleFields.push("millisecond");

  const getClipboardPayload = () => {
    const isoString = ref.current?.value;
    if (!isoString) return null;
    const parsed = parseDuration(isoString);
    if (!parsed) return null;
    const rawS = parsed.seconds;
    const wholeS = rawS !== undefined ? Math.floor(rawS) : undefined;
    const ms =
      typeof rawS === "number" && rawS % 1 !== 0
        ? Math.round((rawS % 1) * 1000)
        : (parsed.milliseconds ?? undefined);
    const byField = {
      hour: parsed.hours,
      minute: parsed.minutes,
      second: wholeS,
      millisecond: ms,
    };
    const parts = visibleFields
      .filter((f) => f !== "millisecond")
      .map((f, i) => {
        const v = byField[f] ?? 0;
        return i === 0 ? String(v) : String(v).padStart(2, "0");
      });
    let plainText = parts.join(":");
    if (showMilliseconds) {
      plainText += `.${String(byField.millisecond ?? 0).padStart(3, "0")}`;
    }
    return { isoString, plainText };
  };

  const applyToGroup = (isoValue, e) => {
    const host = ref.current;
    dispatchRequestInteraction(host, {
      event: e,
      name: "subpaste",
      allowed: () => {
        dispatchRequestSetUIState(host, isoValue, { event: e });
      },
    });
    e.preventDefault();
  };

  const handleCopy = (e) => {
    const payload = getClipboardPayload();
    if (!payload) return;
    e.clipboardData.setData("text/plain", payload.plainText);
    e.clipboardData.setData("application/x-navi", payload.isoString);
    e.preventDefault();
  };

  const handleCut = (e) => {
    const payload = getClipboardPayload();
    if (!payload) return;
    e.clipboardData.setData("text/plain", payload.plainText);
    e.clipboardData.setData("application/x-navi", payload.isoString);
    applyToGroup("", e);
  };

  const FIELD_TO_KEY = {
    hour: "hours",
    minute: "minutes",
    second: "seconds",
    millisecond: "milliseconds",
  };

  const handlePaste = (e) => {
    const naviData = e.clipboardData.getData("application/x-navi");
    const textData = e.clipboardData.getData("text/plain");

    let isoValue = null;

    if (naviData && parseDuration(naviData)) {
      isoValue = naviData;
    }

    if (!isoValue && textData) {
      const parsed = parseDuration(textData);
      if (parsed) {
        isoValue = durationToISOString(parsed) ?? null;
      } else {
        // Colon-split fallback: "1:30", "1:30:45", "1:30:45.500"
        const colonParts = textData.trim().split(":");
        if (colonParts.length > 1 || visibleFields.length === 1) {
          const durationObj = {};
          colonParts.forEach((part, i) => {
            const field = visibleFields[i];
            if (!field || field === "millisecond") return;
            if (i === colonParts.length - 1 && part.includes(".")) {
              const [sec, msPart] = part.split(".");
              durationObj[FIELD_TO_KEY[field]] = parseInt(sec, 10);
              if (visibleFields[i + 1] === "millisecond") {
                durationObj.milliseconds = parseInt(
                  msPart.slice(0, 3).padEnd(3, "0"),
                  10,
                );
              }
            } else {
              durationObj[FIELD_TO_KEY[field]] = parseInt(part, 10);
            }
          });
          isoValue = durationToISOString(durationObj) ?? null;
        }
      }
    }

    if (!isoValue) return;
    applyToGroup(isoValue, e);
  };

  const hourValue = components?.hours;
  const minuteValue = components?.minutes;
  const rawSecondValue = components?.seconds;
  // ISO 8601 fractional seconds encode ms (e.g. 0.5 = 500ms); split them.
  let secondValue = rawSecondValue;
  let millisecondValue = components?.milliseconds;
  if (
    typeof rawSecondValue === "number" &&
    rawSecondValue % 1 !== 0 &&
    millisecondValue === undefined
  ) {
    secondValue = Math.floor(rawSecondValue);
    millisecondValue = Math.round((rawSecondValue % 1) * 1000);
  }

  return (
    <Box
      className="navi_input_duration"
      data-callout-arrow-x="center"
      width="fit-content"
      {...groupRootProps}
      unit={undefined}
      unitHour={undefined}
      onCopy={handleCopy}
      onCut={handleCut}
      onPaste={handlePaste}
    >
      {/* eslint-disable-next-line react/no-unknown-property */}
      <input {...groupHostProps} type="hidden" basePseudoState={undefined} />
      <ControlgroupChildrenWrapper {...childrenWrapperProps} name={undefined}>
        <InputDurationFields
          showHours={showHours}
          showMinutes={showMinutes}
          showSeconds={showSeconds}
          showMilliseconds={showMilliseconds}
          minutesReadOnly={minutesReadOnly}
          secondsReadOnly={secondsReadOnly}
          millisecondsReadOnly={millisecondsReadOnly}
          stepHasMilliseconds={stepHasMilliseconds}
          controlled={hasValue}
          hourValue={hourValue}
          minuteValue={minuteValue}
          secondValue={secondValue}
          millisecondValue={millisecondValue}
          minSeconds={minSeconds}
          maxSeconds={maxSeconds}
          stepSeconds={stepSeconds}
          unitHour={unitHour}
          textAlign={textAlign}
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
// on which fields are active.
const InputDurationFields = ({
  showHours,
  showMinutes,
  showSeconds,
  showMilliseconds,
  minutesReadOnly,
  secondsReadOnly,
  millisecondsReadOnly,
  stepHasMilliseconds,
  controlled,
  hourValue,
  minuteValue,
  secondValue,
  millisecondValue,
  minSeconds,
  maxSeconds,
  stepSeconds,
  unitHour,
  textAlign,
  // Loading is displayed on the InputGroup wrapper, not on individual sub-inputs.
  basePseudoState,
  ...childProps
}) => {
  // Hour bounds (in hours)
  const minHours = minSeconds !== undefined ? Math.floor(minSeconds / 3600) : 0;
  const maxHours = Math.floor(maxSeconds / 3600);

  // Minute bounds (in minutes).
  // When hours are also shown, keep the natural [0, 59] range — the group-level
  // constraint validates the combined total. Dynamic per-hour offsets can produce
  // negative max values (e.g. max=1h30 + current hours=2 → max=-30 for minutes).
  const minuteMin = showHours
    ? 0
    : minSeconds !== undefined
      ? Math.floor(minSeconds / 60)
      : 0;
  const minuteMax = showHours ? 59 : Math.min(59, Math.floor(maxSeconds / 60));

  // Second bounds (in seconds). Same reasoning as minutes.
  const secondMin =
    showHours || showMinutes
      ? 0
      : minSeconds !== undefined
        ? Math.floor(minSeconds)
        : 0;
  const secondMax =
    showHours || showMinutes ? 59 : Math.min(59, Math.floor(maxSeconds));

  // The step applies to the finest-grained field; coarser fields use step=1.
  const stepForMinutes =
    stepSeconds === undefined
      ? undefined
      : stepSeconds % 60 === 0
        ? stepSeconds / 60
        : 1; // sub-minute step → minute always increments by 1
  const stepForHours =
    stepSeconds !== undefined && stepSeconds % 3600 === 0
      ? stepSeconds / 3600
      : 1;
  // Millisecond bounds and step.
  const millisecondMin = 0;
  const millisecondMax = maxSeconds < 1 ? Math.floor(maxSeconds * 1000) : 999;
  // When the step has sub-second precision, derive the ms step from the
  // fractional-seconds part. Otherwise leave it undefined (free editing).
  const stepForMs = stepHasMilliseconds
    ? Math.round((stepSeconds % 1) * 1000)
    : undefined;

  const visibleUnits = [
    showHours && "hour",
    showMinutes && "minute",
    showSeconds && "second",
    showMilliseconds && "millisecond",
  ].filter(Boolean);

  const textAlignFor = (unit) => {
    if (textAlign !== "auto") return textAlign;
    const i = visibleUnits.indexOf(unit);
    if (visibleUnits.length === 1) return "center";
    if (i === 0) return "right";
    if (i === visibleUnits.length - 1) return "left";
    return "center";
  };

  const inputs = [];

  if (showHours) {
    inputs.push(
      <InputDurationPart
        key="hour"
        unit="hour"
        label={unitHour}
        textAlign={textAlignFor("hour")}
        {...(controlled ? { value: hourValue } : { defaultValue: hourValue })}
        min={minHours}
        max={maxHours}
        step={stepForHours}
        separator={showMinutes || showSeconds ? ":" : undefined}
        {...childProps}
      />,
    );
  }

  if (showMinutes) {
    inputs.push(
      <InputDurationPart
        key="minute"
        unit="minute"
        textAlign={textAlignFor("minute")}
        {...(controlled
          ? { value: minuteValue }
          : { defaultValue: minuteValue })}
        min={minuteMin}
        max={minuteMax}
        step={stepForMinutes}
        separator={showSeconds ? ":" : undefined}
        {...childProps}
        readOnly={minutesReadOnly || childProps.readOnly}
      />,
    );
  }

  if (showSeconds) {
    inputs.push(
      <InputDurationPart
        key="second"
        unit="second"
        textAlign={textAlignFor("second")}
        {...(controlled
          ? { value: secondValue }
          : { defaultValue: secondValue })}
        min={secondMin}
        max={secondMax}
        step={stepSeconds}
        separator={showMilliseconds ? "." : undefined}
        {...childProps}
        readOnly={secondsReadOnly || childProps.readOnly}
      />,
    );
  }

  if (showMilliseconds) {
    inputs.push(
      <InputDurationPart
        key="millisecond"
        unit="millisecond"
        textAlign={textAlignFor("millisecond")}
        {...(controlled
          ? { value: millisecondValue }
          : { defaultValue: millisecondValue })}
        min={millisecondMin}
        max={millisecondMax}
        step={stepForMs}
        {...childProps}
        readOnly={millisecondsReadOnly || childProps.readOnly}
      />,
    );
  }

  if (inputs.length === 1) {
    return inputs[0];
  }

  return (
    <InputGroup
      flex
      spacing="xxs"
      width="fit-content"
      basePseudoState={basePseudoState}
    >
      {inputs}
    </InputGroup>
  );
};

const InputDurationPart = ({ unit, label, separator, ...props }) => {
  const unitLabel = label ?? <Unit unit={unit} plural color="secondary" />;

  return (
    <Label flex="y" data-separator={separator || undefined}>
      <Input
        type="navi_number"
        navi-input-type={unit}
        name={unit}
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
      {unitLabel}
    </Label>
  );
};
