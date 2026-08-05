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

import { useSignal } from "@preact/signals";
import { useId } from "preact/hooks";

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
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { Time } from "@jsenv/navi/src/text/time.jsx";
import { triggerNaviCommand } from "../commands.js";
import { Button } from "../input/button.jsx";
import { Picker } from "./picker.jsx";

const css = /* css */ `
  .navi_picker_stepper {
    /* What the picker's own box fills: headless, it draws nothing and covers
       whatever it is inside, which is what the calendar is anchored to. */
    position: relative;
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
 *   onChange?: (day: string) => void,
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
 * @param {string} [value] The day shown, as "YYYY-MM-DD". Controlled: pair it
 *   with `onChange`. Say `signal` for a two-way binding instead, or
 *   `defaultValue` to let the stepper hold the day itself.
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
  onChange,
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
  renderDay = renderDayDefault,
  previousLabel = "Previous day",
  nextLabel = "Next day",
  ...rest
}) => {
  import.meta.css = css;
  const id = useId();
  const containerId = `${id}_days`;
  const pickerId = `${id}_picker`;
  // The day lives in a signal even when nobody handed one over, because that is
  // what the picker below is given (see it): a picker holding a `value` is a
  // picker the form HOLDS, and a form that already holds what it would send has
  // nothing to send — a stepper opening on a day would then refuse to submit it
  // until one stepped away and back. A signal seeds it the way a defaultValue
  // does: a suggestion, and confirming it is an answer.
  const ownDaySignal = useSignal(defaultValue ?? todayString());
  const daySignal = signalProp ? signalProp : ownDaySignal;
  const day = value ?? daySignal.value;

  const setDay = (dayNext) => {
    // Controlled: the day comes from above and only what it is told about
    // changes it.
    if (value === undefined) {
      daySignal.value = dayNext;
    }
    onChange?.(dayNext);
  };

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
      data-vertical={vertical ? "" : undefined}
      style={{
        "--picker-stepper-padding-y": resolveSpacingSize(paddingY),
        ...rest.style,
      }}
    >
      {/* One picker for the three days, behind them: what a press on the day
          opens, and what holds the day for a form. */}
      <Picker
        id={pickerId}
        type="date"
        variant="headless"
        name={name}
        // Held from above, or only suggested from here: a form HOLDS what a
        // `value` says and has nothing to send back, while a signal paired with
        // a defaultValue is a suggestion — the day shown is where one starts,
        // and confirming it is an answer. Without that a stepper opening on a
        // day would refuse to submit it until one stepped away and back.
        {...(value === undefined
          ? { signal: daySignal, defaultValue: day }
          : { value })}
        min={min}
        max={max}
        uiAction={(dayPicked) => {
          setDay(dayPicked);
        }}
      />
      <Button
        command={vertical ? "--navi-up" : "--navi-left"}
        commandFor={containerId}
        icon
        variant="discrete"
        readOnly={!previousAllowed}
        // What a press would do, rather than the button's own state: "not
        // available right now" says nothing, and it is not the button that is
        // unavailable — it is the value it would have gone to.
        readOnlyMessage={naviI18n("stepper.nothing_before")}
        aria-label={previousLabel}
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
        onLoop={({ dx, dy }) => {
          // One step, whichever axis it came from: the map is a line, so only
          // one of the two is ever anything but zero.
          setDay(addDays(day, (dx || dy) * step));
        }}
        // The whole middle opens the calendar — a command, like the chevrons
        // send one, and no button of its own: the day would then be one more
        // Tab stop, and the focus would follow it out of the box as it travels.
        commandFor={pickerId}
        onClick={(e) => {
          triggerNaviCommand(e.currentTarget, "--navi-open", e);
        }}
      >
        <Slide area="previous" flex alignX="center">
          {renderDay(dayPrevious, { lang, format })}
        </Slide>
        <Slide
          area="current"
          flex
          alignX="center"
          // The days a min/max leaves out are simply not reachable: the way out
          // is closed on the slide being left, so a key, a chevron and a
          // command are all stopped by the same thing.
          preventNavPrevious={!previousAllowed}
          preventNavNext={!nextAllowed}
        >
          {renderDay(day, { lang, format })}
        </Slide>
        <Slide area="next" flex alignX="center">
          {renderDay(dayNext, { lang, format })}
        </Slide>
      </SlideContainer>
      <Button
        command={vertical ? "--navi-down" : "--navi-right"}
        commandFor={containerId}
        icon
        variant="discrete"
        readOnly={!nextAllowed}
        readOnlyMessage={naviI18n("stepper.nothing_after")}
        aria-label={nextLabel}
        flex
        align="center"
      >
        <Icon>{vertical ? <ChevronDownSvg /> : <ChevronRightSvg />}</Icon>
      </Button>
    </Box>
  );
};

// The date, and what it is to today when that is something one has a word for:
// "samedi 8 août (demain)" says both where one is and how far that is, and only
// the second is read at a glance.
const renderDayDefault = (day, { lang, format } = {}) => (
  <Time type="date" format={format} dayLabel lang={lang}>
    {day}
  </Time>
);

const dayToDate = (day) => new Date(`${day}T00:00:00`);

const dateToDay = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const todayString = () => dateToDay(new Date());

const addDays = (day, count) => {
  const date = dayToDate(day);
  date.setDate(date.getDate() + count);
  return dateToDay(date);
};
