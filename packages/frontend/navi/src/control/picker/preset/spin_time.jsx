/**
 * A time of day, and a span between two of them, written the way a clock
 * writes them: two digits, an "h" (a ":" in English) between hours and
 * minutes, and one frame around the whole thing — "07h00" is one value, not a
 * 7 beside a 0.
 *
 * `TimeSpin` is a `SpinGroup` of two `NumberSpin`s: it takes and hands back a
 * single "HH:MM", so a form carries one field for it. `TimeRangeSpin` is two
 * of those, and it carries `{ start, end }` — with the one rule such a pair
 * always has, "the end comes after the start", checked when the form is sent
 * (see time_range_constraint.js).
 */

import { useId } from "preact/hooks";

import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { Text } from "@jsenv/navi/src/text/text.jsx";
import { ControlGroup } from "../../control_group.jsx";
import { NumberSpin, SpinGroup } from "../picker_spin.jsx";

const HOUR_MAX = 23;
const MINUTE_MAX = 59;

/**
 * @type {import("preact").FunctionComponent<{
 *   name?: string,
 *   value?: string,
 *   defaultValue?: string,
 *   signal?: import("@preact/signals").Signal<string>,
 *   minuteStep?: number,
 *   pad?: number,
 *   loop?: boolean,
 *   separator?: import("preact").ComponentChildren,
 *   hourLabel?: string,
 *   minuteLabel?: string,
 *   [key: string]: any,
 * }>}
 * @param {string} [value] The time shown, as "HH:MM".
 * @param {number} [minuteStep=1] How many minutes a press on a minute chevron
 *   covers — 15 for quarters of an hour.
 * @param {boolean} [loop=true] The hours and the minutes go round: 23h then 0h,
 *   59 minutes then 0. What a clock does — and there is no first or last hour
 *   of a day to stop at. Say `loop={false}` for two ends one cannot step past.
 * @param {number} [pad=2] How many digits an hour and a minute are written on:
 *   a clock says "07:00", never "7:0". Say `pad={0}` for the bare numbers.
 * @param {import("preact").ComponentChildren} [separator] What is written
 *   between the hours and the minutes. "h" in French, ":" elsewhere.
 * Everything a box takes is taken here too — `width`, `borderRadius`, `size`.
 */
export const TimeSpin = ({
  minuteStep = 1,
  pad = 2,
  loop = true,
  separator = naviI18n("time.hour_separator"),
  hourLabel = naviI18n("time.hour_label"),
  minuteLabel = naviI18n("time.minute_label"),
  ...rest
}) => (
  <SpinGroup
    aggregateChildStates={aggregateTime}
    distributeChildUIState={distributeTime}
    {...rest}
  >
    <NumberSpin
      name="hour"
      min={0}
      max={HOUR_MAX}
      pad={pad}
      loop={loop}
      controlProps={{ "aria-label": hourLabel }}
    />
    <SpinGroup.Separator>{separator}</SpinGroup.Separator>
    <NumberSpin
      name="minute"
      min={0}
      max={MINUTE_MAX}
      step={minuteStep}
      pad={pad}
      loop={loop}
      controlProps={{ "aria-label": minuteLabel }}
    />
  </SpinGroup>
);

// The two fields as one value, "HH:MM" — and nothing at all while one of them
// is empty: half a time is not a time, and a form has nothing to send about it.
const aggregateTime = (childUIStateControllers) => {
  let hour = "";
  let minute = "";
  for (const child of childUIStateControllers) {
    if (child.name === "hour") {
      hour = child.uiState ?? "";
    }
    if (child.name === "minute") {
      minute = child.uiState ?? "";
    }
  }
  if (hour === "" || minute === "") {
    return undefined;
  }
  return `${padTwo(hour)}:${padTwo(minute)}`;
};

// The way back: what the group is set to (a picked value, a form being reset)
// lands on the field it belongs to.
const distributeTime = (groupState, childUIStateController) => {
  const parts = parseTime(groupState);
  if (!parts) {
    return undefined;
  }
  return parts[childUIStateController.name];
};

const parseTime = (time) => {
  if (typeof time !== "string") {
    return null;
  }
  const match = /^(\d{1,2}):(\d{1,2})/.exec(time);
  if (!match) {
    return null;
  }
  // Numbers: what an hour and a minute are held as. How they are written —
  // "07" — is the field's business (see NumberSpin's `pad`).
  return { hour: Number(match[1]), minute: Number(match[2]) };
};

const padTwo = (value) => String(value).padStart(2, "0");

/**
 * @type {import("preact").FunctionComponent<{
 *   name?: string,
 *   value?: { start?: string, end?: string },
 *   defaultValue?: { start?: string, end?: string },
 *   minuteStep?: number,
 *   minDuration?: number,
 *   pad?: number,
 *   timeProps?: object,
 *   loop?: boolean,
 *   size?: string,
 *   startLabel?: import("preact").ComponentChildren,
 *   endLabel?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 * @param {{ start?: string, end?: string }} [value] The span shown, as two
 *   "HH:MM".
 * @param {import("preact").ComponentChildren} [startLabel] What is written
 *   before the first time ("De"), and `endLabel` between the two ("à"). Say
 *   `null` for neither.
 * @param {number} [minuteStep=1] How many minutes a press on a minute chevron
 *   covers, on both times.
 * @param {object} [timeProps] Anything a `TimeSpin` takes, said once for both
 *   of them — a radius, a width. `startTimeProps`/`endTimeProps` say it to one
 *   of the two, and win over this one.
 * @param {number} [minDuration=0] How long the span must last at least, in
 *   minutes. Zero by default: a span of no length is a span all the same, only
 *   one that goes backwards is not. Checked when the form is sent, and the
 *   answer is given on the end time.
 */
export const TimeRangeSpin = ({
  minuteStep = 1,
  minDuration = 0,
  pad = 2,
  loop = true,
  size,
  startLabel = naviI18n("time_range.from"),
  endLabel = naviI18n("time_range.to"),
  timeProps,
  startTimeProps,
  endTimeProps,
  ...rest
}) => {
  const startId = useId();
  return (
    <ControlGroup flex alignY="center" spacing="s" size={size} {...rest}>
      {/* The words are written as big as the times they name: one span, one
          size. */}
      {startLabel === null ? null : <Text size={size}>{startLabel}</Text>}
      <TimeSpin
        id={startId}
        name="start"
        minuteStep={minuteStep}
        pad={pad}
        loop={loop}
        size={size}
        {...timeProps}
        {...startTimeProps}
      />
      {endLabel === null ? null : <Text size={size}>{endLabel}</Text>}
      <TimeSpin
        name="end"
        minuteStep={minuteStep}
        pad={pad}
        loop={loop}
        size={size}
        // Which time it comes after, and how much room there must be between
        // the two: said on the LATER of the two, so the answer is given where
        // the time one would have to move is (see time_range_constraint.js).
        data-time-after={startId}
        data-time-min-duration={minDuration}
        {...timeProps}
        {...endTimeProps}
      />
    </ControlGroup>
  );
};
