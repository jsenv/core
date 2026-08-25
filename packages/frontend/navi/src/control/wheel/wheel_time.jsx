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
 * checked — a bound settling pushes the other out of its way, so what the
 * wheels show at rest is always a span. The send-time constraint stays
 * underneath for what pushing cannot fix (a start so late the span no longer
 * fits in the day).
 */

import { createContext } from "preact";
import { useContext, useId, useMemo, useRef } from "preact/hooks";

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
import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";
import { Wheel, WheelGroup } from "./wheel.jsx";

const css = /* css */ `
  /* The words around a span's wheels ("De", "à"): one line box, the height
     of a wheel row (--wheel-item-height re-exposed, same value as
     .navi_wheel_container), centered against the wheels by the group. The
     box's strut — this element's own font — is what places the baseline,
     exactly where a wheel row places its numbers'; and because the content
     stays in inline flow, anything written INSIDE at another size still
     sits on that same baseline. Two things this depends on: the label is a
     <Text size={size}> so its em — and therefore this line-height — is the
     SAME em as the wheel rows' (a label left at the control font under
     bigger wheels computes a shorter row and its baseline drifts); and no
     flex centering of the content (centering re-centers a smaller glyph,
     baselines are not centers). */
  .navi_time_range_label {
    --wheel-item-height: round(1.8em, 1px);

    color: var(--wheel-color, light-dark(#111, #eee));
    line-height: var(--wheel-item-height);
    white-space: nowrap;
    user-select: none;
  }
`;

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
 * @param {{min?: number, max?: number}|number[]} [hours] Which hours the wheel
 *   offers: `{ min: 7, max: 21 }` for a day that starts and ends somewhere, or
 *   the list itself. All 24 by default. Rows nobody will ever land on are rows
 *   in the way.
 * @param {boolean} [loop=true] The wheels go round: 23h then 0h, 59 minutes
 *   then 0. What a clock does. Say `loop={false}` for two ends one cannot turn
 *   past.
 * @param {import("preact").ComponentChildren} [separator] What is written
 *   between the hours and the minutes. "h" in French, ":" elsewhere.
 * @param {string} [placeholder] What the wheels show while the time holds
 *   nothing, as "HH:MM". Wheels have no blank row to land on, so their
 *   placeholder is a position rather than a grey word — shown, but not an
 *   answer: the value stays `undefined` until a wheel is turned or a real value
 *   arrives. `defaultValue` is the other half of the pair — a time that IS the
 *   answer, and where a reset goes back to.
 * @param {object} [wheelProps] Anything a `Wheel` takes, said once for both of
 *   them — `visibleCount`, `itemWidth`, `glideSpeed`.
 */
export const TimeWheel = ({
  minuteStep = 1,
  hours,
  loop = true,
  placeholder,
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
  const hourList = useMemo(
    () => resolveHourList(hours),
    [hours ? hours.min : undefined, hours ? hours.max : undefined, hours],
  );
  const { aggregateChildStates, distributeChildUIState } = useAnswered(
    placeholder,
    rest,
    aggregateTime,
    distributeTime,
  );
  const placeholderParts = parseTimeParts(placeholder);

  return (
    <WheelGroup
      aggregateChildStates={aggregateChildStates}
      distributeChildUIState={distributeChildUIState}
      {...rest}
    >
      <Wheel
        name="hour"
        type="integer"
        bounded={!loop}
        size={size}
        aria-label={hourLabel}
        defaultValue={placeholderParts ? placeholderParts.hour : undefined}
        {...wheelProps}
      >
        {hourList.map((hour) => (
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
        defaultValue={placeholderParts ? placeholderParts.minute : undefined}
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
 * @param {{min?: number, max?: number}|number[]} [hours] Which hours both
 *   wheels offer — see `TimeWheel`.
 * @param {number} [minDuration=0] How long the span must last at least, in
 *   minutes. Zero by default: a span of no length is a span all the same, only
 *   one that goes backwards is not. It is what the bounds keep between them as
 *   they turn — turn the start into the end and the end moves along, keeping
 *   that much room.
 * @param {{ start?: string, end?: string }} [placeholder] What the two wheels
 *   show while the span holds nothing — a position, since wheels have no blank
 *   row to land on, and not an answer: the value stays `undefined` until one of
 *   them is turned. One turn settles both, the untouched bound included, left
 *   where the placeholder put it. For a span that is optional ("any time of
 *   day") and still has to show hours.
 * @param {object} [timeProps] Anything a `TimeWheel` takes, said once for both
 *   of them. `startTimeProps`/`endTimeProps` say it to one of the two, and win
 *   over this one.
 */
export const TimeRangeWheel = ({
  minuteStep = 1,
  hours,
  minDuration = 0,
  loop = true,
  placeholder,
  size,
  startLabel = naviI18n("time_range.from"),
  endLabel = naviI18n("time_range.to"),
  timeProps,
  startTimeProps,
  endTimeProps,
  ...rest
}) => {
  import.meta.css = css;
  const startId = useId();
  const startRef = useRef(null);
  const endRef = useRef(null);
  // One turn settles the whole span: a start somebody chose makes the end an
  // answer too, left where the placeholder put it.
  const { answeredRef, aggregateChildStates, distributeChildUIState } =
    useAnswered(placeholder, rest, aggregateSpan, distributeSpan);

  // What the pair does once a bound SETTLES: the one that was moved stays
  // where it was put and the OTHER one gives way — a refusal at that point
  // would leave the person to undo what they just did. Settles, not while it
  // turns: a wheel under the finger holds a value nobody has chosen yet, and
  // the other bound jumping around mid-gesture answers a question that was
  // not asked. Wired on the wheel's settle EVENT (navi_wheel_settle), never
  // on `action`: an action goes through the gates, validity included, and
  // the moment this must run is precisely the moment the pair is INVALID —
  // an action-gated push would be refused by the very thing it fixes.
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
    <ControlGroup
      flex
      alignY="center"
      spacing="s"
      size={size}
      aggregateChildStates={aggregateChildStates}
      distributeChildUIState={distributeChildUIState}
      {...rest}
    >
      <AnsweredContext.Provider value={answeredRef}>
        {startLabel === null ? null : (
          <Text size={size} className="navi_time_range_label">
            {startLabel}
          </Text>
        )}
        <TimeWheel
          id={startId}
          ref={startRef}
          name="start"
          minuteStep={minuteStep}
          hours={hours}
          loop={loop}
          size={size}
          placeholder={placeholder ? placeholder.start : undefined}
          // e.detail.value is the settled WHEEL's own value (an hour, a
          // minute) — half a time. What the pair compares is this bound's
          // whole time, read off the element the listener sits on.
          onnavi_wheel_settle={(e) => {
            keepBoundsApart("start", getUIStateFromElement(e.currentTarget), e);
          }}
          {...timeProps}
          {...startTimeProps}
        />
        {endLabel === null ? null : (
          <Text size={size} className="navi_time_range_label">
            {endLabel}
          </Text>
        )}
        <TimeWheel
          ref={endRef}
          name="end"
          minuteStep={minuteStep}
          hours={hours}
          loop={loop}
          size={size}
          placeholder={placeholder ? placeholder.end : undefined}
          onnavi_wheel_settle={(e) => {
            keepBoundsApart("end", getUIStateFromElement(e.currentTarget), e);
          }}
          // Which time it comes after, and how much room there must be between
          // the two: said on the LATER of the two, so the answer is given where
          // the time one would have to move is (see time_range_constraint.js).
          data-time-after={startId}
          data-time-min-duration={minDuration}
          {...timeProps}
          {...endTimeProps}
        />
      </AnsweredContext.Provider>
    </ControlGroup>
  );
};

/**
 * Wheels always show something — there is no blank row to land on — so a pair of
 * them cannot say "nothing set" by looking empty. Their `placeholder` is
 * therefore a position rather than a grey word: shown like a value, and not one.
 * The value stays `undefined` until a wheel is turned, which is what tells "any
 * time of day" from a span somebody chose. `defaultValue` remains what it is
 * everywhere else — a time that IS the answer.
 *
 * What counts as turned is read from the value itself rather than from a
 * gesture: while nothing has moved off the placeholder, nothing is set; the
 * moment it differs, it is an answer and stays one, even turned back onto the
 * placeholder. A wheel's own `uiAction` runs after its group has aggregated, so
 * a flag set from there would always be one turn late.
 *
 * The flag is a ref rather than state because the aggregate a group is created
 * with is the one it keeps: swapping the function on a later render changes
 * nothing (see useUIGroupStateController). One stable function reading one ref.
 *
 * A pair shares ONE flag through `AnsweredContext`: turning the start settles
 * the end too, left where the placeholder put it. Each of the two times gating
 * on its own would answer half a span — and would leave the pair nothing to
 * compare its own placeholder against.
 */
const AnsweredContext = createContext(null);

const useAnswered = (
  placeholder,
  props,
  aggregateWhenAnswered,
  distributeWhenAnswered,
) => {
  const answeredFromPair = useContext(AnsweredContext);
  const ownAnsweredRef = useRef(false);
  const answeredRef = answeredFromPair || ownAnsweredRef;
  if (!placeholder || isAnswerGivenByProps(props)) {
    answeredRef.current = true;
  }
  // Inside a pair, only the pair decides: a time that gated on its own would
  // hand the pair nothing to compare, and half a span cannot be read.
  const gates = !answeredFromPair;
  const placeholderRef = useRef(placeholder);
  placeholderRef.current = placeholder;
  const scopeRef = useRef(null);
  if (!scopeRef.current) {
    scopeRef.current = {
      aggregateChildStates: (children) => {
        const aggregated = aggregateWhenAnswered(children);
        if (answeredRef.current) {
          return aggregated;
        }
        if (compareTwoJsValues(aggregated, placeholderRef.current)) {
          return undefined;
        }
        // It moved: from here on this is an answer, and stays one even when it
        // is turned back onto the placeholder — somebody chose that time.
        answeredRef.current = true;
        return aggregated;
      },
      distributeChildUIState: (groupState, child) => {
        if (placeholderRef.current && holdsNothing(groupState)) {
          // Being told there is no value is not a finger bringing a wheel back:
          // it is a clear, or the app writing `undefined`. The wheels go back to
          // showing the placeholder, and the pair is unanswered again — without
          // this the wheels would empty (a wheel has no blank row) and what they
          // still showed would climb straight back up as an answer.
          answeredRef.current = false;
          return distributeWhenAnswered(placeholderRef.current, child);
        }
        return distributeWhenAnswered(groupState, child);
      },
    };
  }
  return {
    answeredRef,
    aggregateChildStates: gates
      ? scopeRef.current.aggregateChildStates
      : aggregateWhenAnswered,
    distributeChildUIState: gates
      ? scopeRef.current.distributeChildUIState
      : distributeWhenAnswered,
  };
};

// Nothing at all: no value, an empty shape, or a shape whose every part is
// itself nothing — which is what a cleared span looks like on the way down.
const holdsNothing = (value) => {
  if (value === undefined || value === null || value === "") {
    return true;
  }
  if (typeof value !== "object") {
    return false;
  }
  return Object.values(value).every(holdsNothing);
};

const isAnswerGivenByProps = (props) =>
  props.value !== undefined ||
  props.defaultValue !== undefined ||
  (props.signal && props.signal.value !== undefined);

// Which hours the wheel offers: all of them, a slice of the day, or a list
// written by the caller. An app whose day ends at 21h has nothing to say about
// 22h and 23h, and two rows nobody will ever land on are two rows in the way.
const ALL_HOURS = Array.from({ length: HOUR_COUNT }, (_, hour) => hour);
const resolveHourList = (hours) => {
  if (hours === undefined) {
    return ALL_HOURS;
  }
  if (Array.isArray(hours)) {
    return hours;
  }
  const { min = 0, max = HOUR_COUNT - 1 } = hours;
  const hourList = [];
  let hour = min;
  while (hour <= max) {
    hourList.push(hour);
    hour += 1;
  }
  return hourList;
};

const padTwo = (value) => String(value).padStart(2, "0");

// The two times as one span, { start, end } — the shape a pair carries.
const aggregateSpan = (childUIStateControllers) => {
  const span = {};
  for (const child of childUIStateControllers) {
    if (child.name === "start" || child.name === "end") {
      span[child.name] = child.uiState;
    }
  }
  return span;
};

// The way back for a span: each time takes its own side.
const distributeSpan = (groupState, childUIStateController) => {
  if (!groupState) {
    return undefined;
  }
  return groupState[childUIStateController.name];
};

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
