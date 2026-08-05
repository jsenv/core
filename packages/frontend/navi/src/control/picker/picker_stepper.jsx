/**
 * A value one steps through, one press at a time: what is chosen sits between
 * the way back and the way on, and the two of them are the whole control.
 *
 * Days for now — DayStepper below — but nothing here is about days except how
 * one is written and what "one step" adds. The name says where this is going:
 * a picker whose value is stepped rather than typed (a month, a page, a size),
 * shown as the picker it is.
 *
 * A picker, so it lives here: what one presses in the middle IS a picker, and
 * the stepping is a way of showing it. It is headless and behind the three
 * slides — there is one value being chosen, so there is one picker for it.
 *
 * Three slides for a row with no end, kept by a looping slide container: a
 * press travels by one, then the window comes back to the middle while the
 * value moves one step under it (see its `loop`/`onLoop`). So the three are
 * only ever "the one before, this one, the one after".
 *
 * Two things take the keyboard and no more: the container (arrows step,
 * Enter/Space open the picker) and the two chevrons. What is in the middle is
 * not a control — a click on the container opens the picker by command — which
 * is what keeps the focus where the travel happens instead of moving it into a
 * slide that is about to leave.
 */

import { useContext, useId, useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { resolveSpacingSize } from "@jsenv/navi/src/box/box_style_util.js";
import {
  ChevronDownSvg,
  ChevronLeftSvg,
  ChevronRightSvg,
  ChevronUpSvg,
} from "@jsenv/navi/src/graphic/icons/chevron_stroke_svg.jsx";
import {
  Slide,
  SlideContainer,
} from "@jsenv/navi/src/layout/slide_container.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { Time } from "@jsenv/navi/src/text/time.jsx";
import { triggerNaviCommand } from "../commands.js";
import {
  DisabledContext,
  LoadingContext,
  ReadOnlyContext,
} from "../control_context.js";
import { useControlUIState } from "../control_hooks.jsx";
import {
  dispatchRequestResetUIState,
  dispatchRequestSetUIState,
} from "../ui_state_dom.js";
import { Button } from "../input/button.jsx";
import { Picker } from "./picker.jsx";

const css = /* css */ `
  .navi_picker_stepper {
    /* What the picker's own box fills: headless, it draws nothing and covers
       whatever it is inside, which is what the calendar is anchored to. */
    position: relative;
    /* Framed like every other control (see navi_css_vars.js): what one steps
       through is a value one edits, and a box around it is what says so. Said
       as CSS rather than as defaults on the Box, so borderWidth="0" or a radius
       of one's own still wins — an inline style beats a stylesheet. */
    border: var(--navi-control-border-width) solid
      var(--navi-control-border-color);
    border-radius: var(--navi-control-border-radius);
    outline-width: var(--navi-focus-outline-width);
    /* Just outside the border, never on it: the ring belongs to the whole
       control — the two chevrons included, since pressing one lands the
       keyboard here (see navi-focus-delegate below). */
    outline-color: var(--navi-focus-outline-color);
    outline-offset: var(--navi-focus-outline-width);
  }
  /* The days hold the keyboard, and this box wears their ring: the container
     fills it, so its own ring would be drawn a pixel inside this border and
     two rings that close together read as a mistake. Same offer a dialog and a
     popover answer (data-focus-outline-delegate, see slide_container.jsx), and
     the same reply — the delegate stands down.
     Said on this box too (the first selector): nothing focuses it for real —
     it is the container that takes the keyboard — but it is where the ring is
     drawn, so a demo can hold it there and show what it looks like. */
  .navi_picker_stepper[data-focus-visible],
  .navi_picker_stepper:has(
    > [data-focus-outline-delegate][data-focus-visible]
  ) {
    outline-style: solid;
  }
  .navi_picker_stepper > [data-focus-outline-delegate] {
    --navi-focus-outline-style: none;
  }
  /* Same fading every navi control does when it is not to be touched (the
     border first, the words too once it is out of service): what is inside is
     three pieces of ours, so the box says it for all of them. */
  .navi_picker_stepper[data-readonly] {
    border-color: color-mix(
      in srgb,
      var(--navi-control-border-color) 45%,
      transparent
    );

    [data-slide] {
      color: color-mix(in srgb, currentColor 60%, transparent);
    }
  }
  .navi_picker_stepper[data-disabled] {
    color: color-mix(in srgb, currentColor 40%, transparent);
    border-color: color-mix(
      in srgb,
      var(--navi-control-border-color) 30%,
      transparent
    );
  }
  /* The value takes it as padding; the two chevrons take it as their own
     --button-padding-y (a button's padding lives on its content, see
     button_ui.jsx), which is why it is said as a variable rather than applied
     here. Same number on all three: it is what makes them one line rather than
     three boxes. */
  .navi_picker_stepper [data-slide] {
    padding-block: var(--picker-stepper-padding-y);
  }
  /* Centred, always: the middle holds three values of three different lengths,
     and a value that starts where the last one ended reads as a jump. */
  .navi_picker_stepper [data-slide] {
    text-align: center;
    overflow: hidden;
  }
  /* The middle opens the picker, so it says so under the pointer — and stops
     saying it the moment pressing it would only get an answer about why not. */
  .navi_picker_stepper > [data-slide-container] {
    cursor: pointer;
  }
  .navi_picker_stepper[data-readonly] > [data-slide-container],
  .navi_picker_stepper[data-disabled] > [data-slide-container] {
    cursor: default;
  }
  /* Kept inside its own slide: the three days share one cell, so anything
     sticking out would be written across the two beside it. A day too long for
     the box simply wraps — the box grows, and the words are all there; say
     maxLines to cut it instead, which the text itself knows how to do. */
  .navi_picker_stepper [data-slide] > * {
    max-width: 100%;
    overflow: hidden;
  }
  /* As tall as one line of what it steps through — not half the box: what one
     presses is a chevron. Its height is its own, rather than the middle's, so a
     value that wraps does not turn the two into towers; the font is the one
     around it, so "one line" means the same on both sides. */
  .navi_picker_stepper > .navi_button {
    --button-font-size: inherit;
    --button-padding-y: var(--picker-stepper-padding-y);

    height: calc(1lh + 2 * var(--picker-stepper-padding-y));
  }
  /* Square beside the value, full width above and below it: a way out is as
     wide as what it steps through when it sits across it. */
  .navi_picker_stepper:not([data-vertical]) > .navi_button {
    aspect-ratio: 1;
  }
  .navi_picker_stepper[data-vertical] > .navi_button {
    width: 100%;
  }
  /* The corners of the box belong to what sits in them: a chevron in the corner
     of a rounded stepper is rounded there too, and nowhere else. Said with
     inherit rather than clipped away with overflow, which would cut the focus
     ring of the very button it rounds. */
  .navi_picker_stepper:not([data-vertical]) > .navi_button:first-of-type {
    border-start-start-radius: inherit;
    border-end-start-radius: inherit;
  }
  .navi_picker_stepper:not([data-vertical]) > .navi_button:last-of-type {
    border-start-end-radius: inherit;
    border-end-end-radius: inherit;
  }
  .navi_picker_stepper[data-vertical] > .navi_button:first-of-type {
    border-start-start-radius: inherit;
    border-start-end-radius: inherit;
  }
  .navi_picker_stepper[data-vertical] > .navi_button:last-of-type {
    border-end-end-radius: inherit;
    border-end-start-radius: inherit;
  }
`;

/**
 * @type {import("preact").FunctionComponent<{
 *   value?: string,
 *   defaultValue?: string,
 *   signal?: import("@preact/signals").Signal<string>,
 *   name?: string,
 *   min?: string,
 *   max?: string,
 *   step?: number,
 *   duration?: number,
 *   lang?: string,
 *   renderDay?: (day: string) => import("preact").ComponentChildren,
 *   previousLabel?: string,
 *   nextLabel?: string,
 *   [key: string]: any,
 * }>}
 * @param {string} [value] The day shown, as "YYYY-MM-DD". Held from above:
 *   `uiAction` says when it should move. Say `signal` for a two-way binding
 *   instead, or `defaultValue` to let the stepper hold the day itself.
 * @param {number} [step=1] How many days a press covers — 7 for a week at a
 *   time, and the label then names the day one lands on, as it always does.
 * @param {number} [duration=250] How long a travel takes, in milliseconds.
 * @param {string} [min] The first day one can reach, as "YYYY-MM-DD"; `max` is
 *   the last. Beyond them the travel simply does not happen and the chevron
 *   that way says so.
 * @param {"long"|"short"|"numeric"} [format="long"] How the date is written.
 *   Long by default, since this is a control one reads rather than a column
 *   one scans; `short` where the room is not there.
 * @param {string} [paddingY="xs"] Above and below, on the day AND on the two
 *   chevrons: it is what makes the three the same height.
 * @param {number} [maxLines] How many lines the day may take before it is cut
 *   with an ellipsis — `maxLines={1}` keeps it on one line. Without it a day
 *   too long for the box wraps, and the box grows.
 * @param {boolean} [vertical] The same control standing up: the ways out above
 *   and below rather than left and right, and the days travelling upwards.
 * Everything a box takes is taken here too — `width`, `borderWidth`,
 * `borderRadius`, `backgroundColor`: this IS a box, and its corners are passed
 * on to the chevrons sitting in them.
 * @param {(day: string) => import("preact").ComponentChildren} [renderDay] What
 *   to write for a day. Defaults to the date plus what it is to today when
 *   there is a word for it ("samedi 8 août (demain)"), since a day near now is
 *   read as a distance from now before it is read as a date.
 */
export const DayStepper = ({
  value,
  defaultValue,
  uiAction,
  signal: signalProp,
  name,
  min,
  max,
  step = 1,
  duration = 250,
  lang,
  format = "long",
  paddingY = "xs",
  vertical,
  readOnly,
  disabled,
  loading,
  maxLines,
  renderDay = renderDayDefault,
  previousLabel,
  nextLabel,
  ...rest
}) => {
  import.meta.css = css;
  const id = useId();
  const containerId = `${id}_days`;
  const pickerId = `${id}_picker`;
  // The picker holds the day, and it is asked rather than shadowed: `value`,
  // `defaultValue` and `signal` are handed to it untouched (see below), it
  // settles which of them wins — and what a form makes of each — and this reads
  // the answer back. Nothing of that story is told twice.
  const pickerRef = useRef();
  const dayFallback = firstDayAllowed({ min, max, step });
  const day =
    useControlUIState(pickerRef, value ?? defaultValue ?? signalProp?.peek()) ??
    dayFallback;

  // …and the other way round when a signal was handed over: a bound signal is
  // the day, wherever it is moved from — the url, a back/forward, a button
  // elsewhere on the page — and the control follows it. A picker seeded from a
  // signal only writes back into it (see resolveInputProps), which is enough
  // for a field one only ever types into and not for a day that is also moved
  // from outside. Undefined is not a day: the signal has nothing to say, so the
  // control goes back to what it started on.
  const signalDay = signalProp ? signalProp.value : undefined;
  // The day as of the render this effect belongs to, and not one the closure
  // captured a while ago: a step writes the signal, the signal brings us back
  // here, and comparing against a stale day would set it a second time — one
  // uiAction per step becoming two.
  const dayRef = useRef(day);
  dayRef.current = day;
  useLayoutEffect(() => {
    const pickerEl = pickerRef.current;
    if (!signalProp || !pickerEl) {
      return;
    }
    if (signalDay === undefined) {
      dispatchRequestResetUIState(pickerEl);
      return;
    }
    if (signalDay !== dayRef.current) {
      dispatchRequestSetUIState(pickerEl, signalDay, {});
    }
  }, [signalDay]);

  // A step is a change made to the picker, not beside it: it goes in the way a
  // paste or a pick from the calendar goes in, so the signal, the form and
  // `uiAction` all learn about it from the same place — and the event that
  // asked for it travels with it, which is how `uiAction` can tell a chevron
  // from the calendar.
  // What asked for the day being set, while it is being set: the picker
  // announces the change as its own input event, which says nothing of what
  // started it — so it is held here for the length of the dispatch and handed
  // to uiAction below. That is how a caller tells a chevron from the calendar.
  const stepEventRef = useRef(null);
  const setDay = (dayNext, event) => {
    stepEventRef.current = event;
    try {
      dispatchRequestSetUIState(pickerRef.current, dayNext, { event });
    } finally {
      stepEventRef.current = null;
    }
  };

  // Passed through rather than defaulted here: a prop nobody wrote must not
  // reach the picker at all (it reads the presence of `value`, not its
  // content), so each is added only if it was given.
  const dayProps = {};
  if (value !== undefined) {
    dayProps.value = value;
  } else if (signalProp) {
    dayProps.signal = signalProp;
  }
  if (defaultValue !== undefined) {
    dayProps.defaultValue = defaultValue;
  } else if (value === undefined && !signalProp) {
    // A day is always shown, so there is always one to start from — today, or
    // the nearest day a min/max/step leaves reachable. A default rather than a
    // value, so a form reads the day shown as an answer one can send rather
    // than as something it already holds. A signal brings its own default (see
    // resolveInputProps), so it is left alone.
    dayProps.defaultValue = dayFallback;
  }

  // Told from above as often as said here: a form running its action puts
  // every control inside it out of service (that is how the chevrons grey out
  // by themselves), and the day they sit around must fade with them — it is one
  // control, not a box with three moods.
  const readOnlyFromAbove = useContext(ReadOnlyContext);
  const loadingFromAbove = useContext(LoadingContext);
  const disabledFromAbove = useContext(DisabledContext);
  const loadingResolved = Boolean(loading || loadingFromAbove);
  const readOnlyResolved = Boolean(
    readOnly || readOnlyFromAbove || loadingResolved,
  );
  const disabledResolved = Boolean(disabled || disabledFromAbove);

  // Why a chevron refuses, in its own words — and only when the reason is
  // ours: the end of what one may reach is something this control knows and
  // navi cannot guess. For everything else the reason belongs to the state the
  // whole control is in, and it is said about the control ("read-only",
  // "busy") rather than about the button, which is not what the user was
  // pressing.
  const wayOutMessage = (allowed, endKey) => {
    if (!allowed) {
      return naviI18n(endKey);
    }
    if (loadingResolved) {
      return naviI18n("constraint.busy.default");
    }
    if (readOnlyResolved) {
      return naviI18n("constraint.readonly.default");
    }
    return undefined;
  };

  const dayTextProps = { lang, format, maxLines };

  const dayPrevious = addDays(day, -step);
  const dayNext = addDays(day, step);
  const previousAllowed = !min || dayPrevious >= min;
  const nextAllowed = !max || dayNext <= max;

  return (
    <Box
      {...rest}
      baseClassName="navi_picker_stepper"
      flex={vertical ? "y" : "x"}
      alignY="center"
      // The states this box draws itself: the ring above is the one that is
      // asked for by hand (pseudoState) as well as held for real.
      pseudoClasses={PICKER_STEPPER_PSEUDO_CLASSES}
      data-vertical={vertical ? "" : undefined}
      data-readonly={readOnlyResolved ? "" : undefined}
      data-disabled={disabledResolved ? "" : undefined}
      style={{
        "--picker-stepper-padding-y": resolveSpacingSize(paddingY),
        ...rest.style,
      }}
    >
      {/* Around the whole box, the way a button wears it: the day is on its
          way somewhere, and it is the day one is looking at. */}
      <LoadingOutline
        loading={loading}
        color="var(--navi-loader-color)"
        inset={-2}
      />
      {/* One picker for the three days, behind them: what a press on the day
          opens, and what holds the day for a form. */}
      <Picker
        ref={pickerRef}
        id={pickerId}
        type="date"
        variant="headless"
        name={name}
        // Whatever was said about the day, said to the picker: a `value` it
        // holds, a `signal` it follows, a `defaultValue` it merely starts on —
        // including what a form makes of the difference (it HOLDS a value and
        // has nothing to send back, where a default is a suggestion and
        // confirming it is an answer). A day is always shown, so there is
        // always a default: today, when nobody named one.
        {...dayProps}
        min={min}
        max={max}
        readOnly={readOnly}
        disabled={disabled}
        loading={loading}
        uiAction={(dayNext, event) => {
          uiAction?.(dayNext, stepEventRef.current ?? event);
        }}
      />
      <Button
        command={vertical ? "--navi-up" : "--navi-left"}
        commandFor={containerId}
        // Pressed, never focused: the keyboard lands on the days instead, which
        // is the one place the arrows mean something — so a chevron and an
        // arrow key are the same gesture rather than two, and Tab has one stop
        // here rather than three.
        tabIndex="-1"
        navi-focus-delegate={containerId}
        icon
        variant="discrete"
        // Read-only while the day is being sent, too: what one is looking at is
        // on its way somewhere and stepping it would be a second answer to a
        // question still being asked.
        readOnly={!previousAllowed || readOnlyResolved}
        disabled={disabledResolved}
        readOnlyMessage={wayOutMessage(
          previousAllowed,
          "stepper.nothing_before",
        )}
        aria-label={previousLabel ?? naviI18n("stepper.previous")}
        flex
        align="center"
      >
        <Icon>{vertical ? <ChevronUpSvg /> : <ChevronLeftSvg />}</Icon>
      </Button>
      <SlideContainer
        id={containerId}
        layout={vertical ? "column" : "row"}
        // What is left beside the two chevrons, whatever the days it holds are
        // long: a control that resizes as one steps through it is a control one
        // has to aim at twice.
        expandX
        defaultCurrent="current"
        duration={`${duration}ms`}
        // The three days are a window over an endless row: the container plays
        // the travel and comes back to the middle, and the day moves one step
        // here, in onLoop, as it lands.
        loop
        onLoop={({ dx, dy, event }) => {
          // One step, whichever axis it came from: the map is a line, so only
          // one of the two is ever anything but zero. The event goes with it —
          // it is what says a chevron (or an arrow key) asked for this day.
          setDay(addDays(day, (dx || dy) * step), event);
        }}
        // The whole middle opens the calendar — a command, like the chevrons
        // send one, and no button of its own: the day would then be one more
        // Tab stop, and the focus would follow it out of the box as it travels.
        commandFor={pickerId}
        // Sent whatever state the control is in: the picker is the one that
        // knows it cannot be opened right now, and refusing there is what says
        // so out loud (read-only, busy). Refusing here would be a press that
        // does nothing and explains nothing.
        onClick={(e) => {
          triggerNaviCommand(e.currentTarget, "--navi-open", e);
        }}
      >
        <Slide area="previous" flex align="center">
          {renderDay(dayPrevious, dayTextProps)}
        </Slide>
        <Slide
          area="current"
          flex
          align="center"
          // The days a min/max leaves out are simply not reachable: the way out
          // is closed on the slide being left, so a key, a chevron and a
          // command are all stopped by the same thing.
          preventNavPrevious={!previousAllowed}
          preventNavNext={!nextAllowed}
        >
          {renderDay(day, dayTextProps)}
        </Slide>
        <Slide area="next" flex align="center">
          {renderDay(dayNext, dayTextProps)}
        </Slide>
      </SlideContainer>
      <Button
        command={vertical ? "--navi-down" : "--navi-right"}
        commandFor={containerId}
        tabIndex="-1"
        navi-focus-delegate={containerId}
        icon
        variant="discrete"
        readOnly={!nextAllowed || readOnlyResolved}
        disabled={disabledResolved}
        readOnlyMessage={wayOutMessage(nextAllowed, "stepper.nothing_after")}
        aria-label={nextLabel ?? naviI18n("stepper.next")}
        flex
        align="center"
      >
        <Icon>{vertical ? <ChevronDownSvg /> : <ChevronRightSvg />}</Icon>
      </Button>
    </Box>
  );
};

const PICKER_STEPPER_PSEUDO_CLASSES = [":hover", ":focus-visible"];

// The date, and what it is to today when that is something one has a word for:
// "samedi 8 août (demain)" says both where one is and how far that is, and only
// the second is read at a glance.
const renderDayDefault = (day, { lang, format, maxLines } = {}) => (
  <Time
    type="date"
    format={format}
    dayLabel
    lang={lang}
    // A Time keeps its date on one line by default; here a day too long for
    // the box is meant to wrap, so that is undone — except for maxLines={1},
    // which IS one line and cuts it itself (see Text's own TextOverflow):
    // saying "you may wrap" there would undo the truncation instead.
    noWrap={maxLines === 1 ? undefined : false}
    maxLines={maxLines}
  >
    {day}
  </Time>
);

// The day one starts on when nobody said which: today, unless a min/max puts
// today out of reach — a control opening on a day it refuses to keep would be
// invalid before it has been touched. A step counts from `min`, so the day
// landed on is one the chevrons can actually reach.
const firstDayAllowed = ({ min, max, step }) => {
  const today = todayString();
  if (min && today < min) {
    return min;
  }
  if (max && today > max) {
    return alignOnStep(max, { min, step, down: true });
  }
  return alignOnStep(today, { min, step });
};

const alignOnStep = (day, { min, step, down }) => {
  if (!min || !step || step === 1) {
    return day;
  }
  const stepsAway = Math.round(
    (dayToDate(day) - dayToDate(min)) / (step * MS_PER_DAY),
  );
  const aligned = addDays(min, stepsAway * step);
  if (down && aligned > day) {
    return addDays(aligned, -step);
  }
  return aligned;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const dayToDate = (day) => new Date(`${day}T00:00:00`);

const dateToDay = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const todayString = () => dateToDay(new Date());

const addDays = (day, count) => {
  const date = dayToDate(day);
  date.setDate(date.getDate() + count);
  return dateToDay(date);
};
