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
 *   separator?: import("preact").ComponentChildren,
 *   hourLabel?: string,
 *   minuteLabel?: string,
 *   [key: string]: any,
 * }>}
 * @param {string} [value] The time shown, as "HH:MM".
 * @param {number} [minuteStep=1] How many minutes a press on a minute chevron
 *   covers — 15 for quarters of an hour.
 * @param {number} [pad=2] How many digits an hour and a minute are written on:
 *   a clock says "07:00", never "7:0". Say `pad={0}` for the bare numbers.
 * @param {import("preact").ComponentChildren} [separator] What is written
 *   between the hours and the minutes. "h" in French, ":" elsewhere.
 * Everything a box takes is taken here too — `width`, `borderRadius`, `size`.
 */
export const TimeSpin = ({
  minuteStep = 1,
  pad = 2,
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
      controlProps={{ "aria-label": hourLabel }}
    />
    <SpinGroup.Separator>{separator}</SpinGroup.Separator>
    <NumberSpin
      name="minute"
      min={0}
      max={MINUTE_MAX}
      step={minuteStep}
      pad={pad}
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
  return { hour: padTwo(match[1]), minute: padTwo(match[2]) };
};

const padTwo = (value) => String(value).padStart(2, "0");

/**
 * @type {import("preact").FunctionComponent<{
 *   name?: string,
 *   value?: { start?: string, end?: string },
 *   defaultValue?: { start?: string, end?: string },
 *   minuteStep?: number,
 *   pad?: number,
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
 */
export const TimeRangeSpin = ({
  minuteStep = 1,
  pad = 2,
  size,
  startLabel = naviI18n("time_range.from"),
  endLabel = naviI18n("time_range.to"),
  startTimeProps,
  endTimeProps,
  ...rest
}) => (
  <ControlGroup
    flex
    alignY="center"
    spacing="s"
    size={size}
    // The one rule a span always has, checked when the form is sent: what the
    // two times are worth together is the group's to answer for, not either
    // time's.
    data-time-range=""
    {...rest}
  >
    {/* The words are written as big as the times they name: one span, one
        size. */}
    {startLabel === null ? null : <Text size={size}>{startLabel}</Text>}
    <TimeSpin
      name="start"
      minuteStep={minuteStep}
      pad={pad}
      size={size}
      {...startTimeProps}
    />
    {endLabel === null ? null : <Text size={size}>{endLabel}</Text>}
    <TimeSpin
      name="end"
      minuteStep={minuteStep}
      pad={pad}
      size={size}
      {...endTimeProps}
    />
  </ControlGroup>
);
