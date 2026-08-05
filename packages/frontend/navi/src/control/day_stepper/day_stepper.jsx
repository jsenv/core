/**
 * A day, with the one before and the one after one press away.
 *
 * Three slides for an endless row of days, kept by a looping slide container:
 * a press travels by one, then the window comes back to the middle while the
 * day moves one step under it (see its `loop`/`onLoop`). So the three days are
 * only ever "the one before, this one, the one after" and the row never runs
 * out.
 *
 * One picker for the three days, headless and behind them: a picker is where a
 * day is chosen from a calendar, and there is one day being chosen. Pressing
 * the day opens it.
 *
 * Two things take the keyboard and no more: the container (arrows walk the
 * days, Enter/Space open the calendar) and the two chevrons. The day itself is
 * not a control — a click on the container opens the picker by command — which
 * is what keeps the focus where the travel happens instead of moving it into a
 * slide that is about to leave.
 */

import { useId, useState } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import {
  ChevronLeftSvg,
  ChevronRightSvg,
} from "@jsenv/navi/src/graphic/icons/chevron_stroke_svg.jsx";
import {
  Slide,
  SlideContainer,
} from "@jsenv/navi/src/layout/slide_container.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { Time } from "@jsenv/navi/src/text/time.jsx";
import { triggerNaviCommand } from "../commands.js";
import { Button } from "../input/button.jsx";
import { Picker } from "../picker/picker.jsx";

const css = /* css */ `
  .navi_day_stepper {
    /* What the picker's own box fills: headless, it draws nothing and covers
       whatever it is inside, which is what the calendar is anchored to. */
    position: relative;
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
 * @param {(day: string) => import("preact").ComponentChildren} [renderDay] What
 *   to write for a day. Defaults to the short date plus what it is to today
 *   when there is a word for it ("sam. 8 août (demain)"), since a day near now
 *   is read as a distance from now before it is read as a date.
 */
export const DayStepper = ({
  value,
  defaultValue,
  signal,
  onChange,
  name,
  min,
  max,
  step = 1,
  duration = 250,
  lang,
  renderDay = renderDayDefault,
  previousLabel = "Previous day",
  nextLabel = "Next day",
  ...rest
}) => {
  import.meta.css = css;
  const id = useId();
  const containerId = `${id}_days`;
  const pickerId = `${id}_picker`;
  const [dayState, setDayState] = useState(() => defaultValue ?? todayString());
  const day = value ?? signal?.value ?? dayState;

  const setDay = (dayNext) => {
    if (signal) {
      signal.value = dayNext;
    }
    setDayState(dayNext);
    onChange?.(dayNext);
  };

  const dayPrevious = addDays(day, -step);
  const dayNext = addDays(day, step);
  const previousAllowed = !min || dayPrevious >= min;
  const nextAllowed = !max || dayNext <= max;

  return (
    <Box {...rest} baseClassName="navi_day_stepper" flex alignY="stretch">
      {/* One picker for the three days, behind them: what a press on the day
          opens, and what holds the day for a form. */}
      <Picker
        id={pickerId}
        type="date"
        variant="headless"
        name={name}
        value={day}
        min={min}
        max={max}
        uiAction={(dayPicked) => {
          setDay(dayPicked);
        }}
      />
      <Button
        command="--navi-left"
        commandFor={containerId}
        icon
        variant="discrete"
        readOnly={!previousAllowed}
        aria-label={previousLabel}
        // A third of the box each, and its full height: what one presses to
        // change the day is as big as the day it changes.
        expandX
        expandY
        flex
        align="center"
      >
        <Icon>
          <ChevronLeftSvg />
        </Icon>
      </Button>
      <SlideContainer
        id={containerId}
        layout="row"
        defaultCurrent="current"
        duration={`${duration}ms`}
        // The three days are a window over an endless row: the container plays
        // the travel and comes back to the middle, and the day moves one step
        // here, in onLoop, as it lands.
        loop
        onLoop={({ dx }) => {
          setDay(addDays(day, dx * step));
        }}
        // The whole middle opens the calendar — a command, like the chevrons
        // send one, and no button of its own: the day would then be one more
        // Tab stop, and the focus would follow it out of the box as it travels.
        commandFor={pickerId}
        onClick={(e) => {
          triggerNaviCommand(e.currentTarget, "--navi-open", e);
        }}
      >
        <Slide area="previous">{renderDay(dayPrevious, { lang })}</Slide>
        <Slide
          area="current"
          // The days a min/max leaves out are simply not reachable: the way out
          // is closed on the slide being left, so a key, a chevron and a
          // command are all stopped by the same thing.
          preventNavPrevious={!previousAllowed}
          preventNavNext={!nextAllowed}
        >
          {renderDay(day, { lang })}
        </Slide>
        <Slide area="next">{renderDay(dayNext, { lang })}</Slide>
      </SlideContainer>
      <Button
        command="--navi-right"
        commandFor={containerId}
        icon
        variant="discrete"
        readOnly={!nextAllowed}
        aria-label={nextLabel}
        expandX
        expandY
        flex
        align="center"
      >
        <Icon>
          <ChevronRightSvg />
        </Icon>
      </Button>
    </Box>
  );
};

// The date, and what it is to today when that is something one has a word for:
// "sam. 8 août (demain)" says both where one is and how far that is, and only
// the second is read at a glance.
const renderDayDefault = (day, { lang } = {}) => (
  <Time type="date" format="short" dayLabel lang={lang}>
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
