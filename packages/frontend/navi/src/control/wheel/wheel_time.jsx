/**
 * A time of day, and a span between two of them, set by turning rather than by
 * typing. A wheel only ever shows values that exist: there is no half-written
 * hour to bound and correct under the fingers, which is what a time typed digit
 * by digit puts a field through ("1" on its way to "18").
 *
 * `TimeWheel` is a `WheelGroup` of two `Wheel`s and carries a single "HH:MM",
 * like `TimeSpin` — the two are interchangeable in a form. `TimeRangeWheel` is
 * two of those and carries `{ start, end }`, with the rule such a pair always
 * has: the end comes after the start. Here that rule is lived rather than
 * checked — the bounds push each other while they turn, so what the wheels show
 * is always a span. The send-time constraint stays underneath for what pushing
 * cannot fix (a start so late the span no longer fits in the day).
 */

import { useId, useMemo, useRef } from "preact/hooks";

import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { Text } from "@jsenv/navi/src/text/text.jsx";
import { ControlGroup } from "../control_group.jsx";
import {
  formatTimeParts,
  minutesFromTime,
  parseTimeParts,
  timeFromMinutes,
} from "../picker/time_helpers.js";
import {
  dispatchRequestSetUIState,
  getUIStateFromElement,
} from "../ui_state_dom.js";
import { Wheel, WheelGroup } from "./wheel.jsx";

const HOUR_COUNT = 24;
const MINUTES_PER_HOUR = 60;
const LAST_MINUTE_OF_DAY = 23 * 60 + 59;

/**
 * @type {import("preact").FunctionComponent<{
 *   name?: string,
 *   value?: string,
 *   defaultValue?: string,
 *   signal?: import("@preact/signals").Signal<string>,
 *   minuteStep?: number,
 *   loop?: boolean,
 *   separator?: import("preact").ComponentChildren,
 *   hourLabel?: string,
 *   minuteLabel?: string,
 *   size?: string,
 *   visibleCount?: number,
 *   wheelProps?: object,
 *   [key: string]: any,
 * }>}
 * @param {string} [value] The time shown, as "HH:MM".
 * @param {number} [minuteStep=1] How many minutes apart the values on the
 *   minute wheel are — 15 for quarters of an hour.
 * @param {boolean} [loop=true] The wheels go round: 23h then 0h, 59 minutes
 *   then 0. What a clock does. Say `loop={false}` for two ends one cannot turn
 *   past.
 * @param {import("preact").ComponentChildren} [separator] What is written
 *   between the hours and the minutes. "h" in French, ":" elsewhere.
 * @param {object} [wheelProps] Anything a `Wheel` takes, said once for both of
 *   them — `visibleCount`, `itemWidth`, `glideSpeed`.
 */
export const TimeWheel = ({
  minuteStep = 1,
  loop = true,
  separator = naviI18n("time.hour_separator"),
  hourLabel = naviI18n("time.hour_label"),
  minuteLabel = naviI18n("time.minute_label"),
  size,
  wheelProps,
  ...rest
}) => {
  const minutes = useMemo(() => {
    const minuteList = [];
    let minute = 0;
    while (minute < MINUTES_PER_HOUR) {
      minuteList.push(minute);
      minute += minuteStep;
    }
    return minuteList;
  }, [minuteStep]);

  return (
    <WheelGroup
      aggregateChildStates={aggregateTime}
      distributeChildUIState={distributeTime}
      {...rest}
    >
      <Wheel
        name="hour"
        type="integer"
        bounded={!loop}
        size={size}
        aria-label={hourLabel}
        {...wheelProps}
      >
        {HOURS.map((hour) => (
          <Wheel.Item key={hour} value={hour} paddingX="s">
            {padTwo(hour)}
          </Wheel.Item>
        ))}
      </Wheel>
      {/* The separator is written as big as the times it stands between: one
          time, one size. */}
      <WheelGroup.Separator size={size}>{separator}</WheelGroup.Separator>
      <Wheel
        name="minute"
        type="integer"
        bounded={!loop}
        size={size}
        aria-label={minuteLabel}
        {...wheelProps}
      >
        {minutes.map((minute) => (
          <Wheel.Item key={minute} value={minute} paddingX="s">
            {padTwo(minute)}
          </Wheel.Item>
        ))}
      </Wheel>
    </WheelGroup>
  );
};

/**
 * @type {import("preact").FunctionComponent<{
 *   name?: string,
 *   value?: { start?: string, end?: string },
 *   defaultValue?: { start?: string, end?: string },
 *   signal?: import("@preact/signals").Signal<{ start?: string, end?: string }>,
 *   minuteStep?: number,
 *   minDuration?: number,
 *   loop?: boolean,
 *   size?: string,
 *   startLabel?: import("preact").ComponentChildren,
 *   endLabel?: import("preact").ComponentChildren,
 *   timeProps?: object,
 *   [key: string]: any,
 * }>}
 * @param {{ start?: string, end?: string }} [value] The span shown, as two
 *   "HH:MM".
 * @param {import("preact").ComponentChildren} [startLabel] What is written
 *   before the first time ("De"), and `endLabel` between the two ("à"). Say
 *   `null` for neither.
 * @param {number} [minuteStep=1] How many minutes apart the values on both
 *   minute wheels are.
 * @param {number} [minDuration=0] How long the span must last at least, in
 *   minutes. Zero by default: a span of no length is a span all the same, only
 *   one that goes backwards is not. It is what the bounds keep between them as
 *   they turn — turn the start into the end and the end moves along, keeping
 *   that much room.
 * @param {object} [timeProps] Anything a `TimeWheel` takes, said once for both
 *   of them. `startTimeProps`/`endTimeProps` say it to one of the two, and win
 *   over this one.
 */
export const TimeRangeWheel = ({
  minuteStep = 1,
  minDuration = 0,
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
  const startRef = useRef(null);
  const endRef = useRef(null);

  // What the pair does while it is being turned: the bound that just moved is
  // the one the user is holding, so it stays where it was put and the OTHER one
  // gives way. A refusal at the end of the gesture would leave the person to
  // undo what they just did.
  const keepBoundsApart = (movedSide, movedTime, e) => {
    const movedMinutes = minutesFromTime(movedTime);
    if (movedMinutes === null) {
      return;
    }
    const otherEl = movedSide === "start" ? endRef.current : startRef.current;
    if (!otherEl) {
      return;
    }
    const otherMinutes = minutesFromTime(getUIStateFromElement(otherEl));
    if (otherMinutes === null) {
      return;
    }
    const duration =
      movedSide === "start"
        ? otherMinutes - movedMinutes
        : movedMinutes - otherMinutes;
    if (duration >= minDuration) {
      return;
    }
    let pushedMinutes =
      movedSide === "start"
        ? movedMinutes + minDuration
        : movedMinutes - minDuration;
    // The day has ends the wheels do not: pushed past midnight, the other bound
    // would come back round on the wrong side of the one that pushed it. It
    // stops at the edge instead, and the span that no longer fits is what the
    // send-time constraint is there to say (see time_range_constraint.js).
    if (pushedMinutes < 0) {
      pushedMinutes = 0;
    } else if (pushedMinutes > LAST_MINUTE_OF_DAY) {
      pushedMinutes = LAST_MINUTE_OF_DAY;
    }
    dispatchRequestSetUIState(otherEl, timeFromMinutes(pushedMinutes), {
      event: e,
    });
  };

  return (
    <ControlGroup flex alignY="center" spacing="s" size={size} {...rest}>
      {startLabel === null ? null : <Text size={size}>{startLabel}</Text>}
      <TimeWheel
        id={startId}
        ref={startRef}
        name="start"
        minuteStep={minuteStep}
        loop={loop}
        size={size}
        uiAction={(value, e) => keepBoundsApart("start", value, e)}
        {...timeProps}
        {...startTimeProps}
      />
      {endLabel === null ? null : <Text size={size}>{endLabel}</Text>}
      <TimeWheel
        ref={endRef}
        name="end"
        minuteStep={minuteStep}
        loop={loop}
        size={size}
        uiAction={(value, e) => keepBoundsApart("end", value, e)}
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

const HOURS = Array.from({ length: HOUR_COUNT }, (_, hour) => hour);

const padTwo = (value) => String(value).padStart(2, "0");

// The two wheels as one value, "HH:MM".
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
  return formatTimeParts(hour, minute);
};

// The way back: what the group is set to (a value given to it, a form being
// reset, the other bound pushing it) lands on the wheel it belongs to.
const distributeTime = (groupState, childUIStateController) => {
  const parts = parseTimeParts(groupState);
  if (!parts) {
    return undefined;
  }
  return parts[childUIStateController.name];
};
