/**
 * A day, with the one before and the one after one press away.
 *
 * Three slides for an endless row of days: the previous one, the one shown, the
 * next one. A press travels by one slide, then the day arriving takes the
 * middle and the track returns there with the travel switched off — so the
 * window is always centred on the current day and the row never runs out. That
 * is what makes this neither a wheel (nothing here answers to scrolling) nor a
 * plain slide container (its slides are written once, and days are not).
 *
 * The day in the middle IS a date picker, headless: the label on screen is the
 * whole trigger, so tapping it opens the calendar and jumping anywhere is one
 * press away from stepping day by day.
 */

import { batch } from "@preact/signals";
import { useState } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import {
  ChevronLeftSvg,
  ChevronRightSvg,
} from "@jsenv/navi/src/graphic/icons/chevron_stroke_svg.jsx";
import {
  Slide,
  SlideContainer,
} from "@jsenv/navi/src/layout/slide_container.jsx";
import { formatDayRelative } from "@jsenv/navi/src/text/format_time.js";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { languagesSignal } from "@jsenv/navi/src/text/lang_signal.js";
import { Text } from "@jsenv/navi/src/text/text.jsx";
import { Time } from "@jsenv/navi/src/text/time.jsx";
import { Button } from "../input/button.jsx";
import { Picker } from "../picker/picker.jsx";

const css = /* css */ `
  .navi_day_stepper {
    --day-stepper-width: 20ch;
  }
  /* The three days are in one grid cell, so the box would otherwise measure
     itself on the longest label and change width as one steps through days.
     A width of its own keeps the two chevrons still. */
  .navi_day_stepper > [data-slide-container] {
    width: var(--day-stepper-width);
    flex: 0 0 auto;
  }
`;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
 * @param {(day: string) => import("preact").ComponentChildren} [renderDay] What
 *   to write for a day. Defaults to "yesterday"/"today"/"tomorrow" around
 *   today and the short date beyond, since a day near now is read as a
 *   distance from now before it is read as a date.
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
  // The area the track is travelling TO, or null when it is at rest in the
  // middle: it is also what says a travel is running, and a press during one
  // has nowhere to go.
  const [travelArea, setTravelArea] = useState(null);
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

  const travelBy = (count) => {
    if (travelArea) {
      return;
    }
    setTravelArea(count > 0 ? "next" : "previous");
    setTimeout(() => {
      // The day arriving and the track coming back to the middle are the same
      // moment: a render holding one without the other shows the wrong day for
      // a frame.
      batch(() => {
        setTravelArea(null);
        setDay(count > 0 ? dayNext : dayPrevious);
      });
    }, duration);
  };

  return (
    <Box
      {...rest}
      baseClassName="navi_day_stepper"
      flex
      alignY="center"
      alignX="center"
    >
      <Button
        icon
        variant="discrete"
        readOnly={!previousAllowed}
        aria-label={previousLabel}
        onClick={() => {
          travelBy(-1);
        }}
      >
        <Icon>
          <ChevronLeftSvg />
        </Icon>
      </Button>
      <SlideContainer
        layout="row"
        current={travelArea ?? "current"}
        // The way back to the middle is not a travel: the day has just changed
        // under it, so the three slides already hold what they must and the
        // track has only to be where the middle one is.
        duration={travelArea ? `${duration}ms` : "0ms"}
        // The two chevrons around this box are the way through, and what sits
        // in the middle is a picker: nothing here is walked with the keyboard,
        // and this box is not a stop of its own.
        keyboardTravel={false}
        tabIndex={-1}
      >
        <Slide area="previous">
          <DayCell
            day={dayPrevious}
            lang={lang}
            renderDay={renderDay}
            setDay={setDay}
          />
        </Slide>
        <Slide area="current">
          <DayCell
            day={day}
            name={name}
            min={min}
            max={max}
            lang={lang}
            renderDay={renderDay}
            setDay={setDay}
          />
        </Slide>
        <Slide area="next">
          <DayCell
            day={dayNext}
            lang={lang}
            renderDay={renderDay}
            setDay={setDay}
          />
        </Slide>
      </SlideContainer>
      <Button
        icon
        variant="discrete"
        readOnly={!nextAllowed}
        aria-label={nextLabel}
        onClick={() => {
          travelBy(1);
        }}
      >
        <Icon>
          <ChevronRightSvg />
        </Icon>
      </Button>
    </Box>
  );
};

const DayCell = ({ day, name, min, max, lang, renderDay, setDay }) => (
  <Picker
    type="date"
    variant="headless"
    name={name}
    value={day}
    min={min}
    max={max}
    textAlign="center"
    style={{ width: "100%" }}
    uiAction={(dayPicked) => {
      setDay(dayPicked);
    }}
    ui={renderDay(day, { lang })}
  />
);

const renderDayDefault = (day, { lang = languagesSignal.value } = {}) => {
  const offset = Math.round(
    (dayToDate(day) - dayToDate(todayString())) / MS_PER_DAY,
  );
  if (offset >= -1 && offset <= 1) {
    const relative = formatDayRelative(offset, lang);
    // Uppercased here rather than with Text's `capitalize`: that one is
    // text-transform, which capitalizes every word — and browsers count what
    // follows an apostrophe as one ("Aujourd'Hui").
    return (
      <Text>{`${relative.slice(0, 1).toUpperCase()}${relative.slice(1)}`}</Text>
    );
  }
  return (
    <Time type="date" format="short" lang={lang}>
      {day}
    </Time>
  );
};

const dayToDate = (day) => new Date(`${day}T00:00:00`);

const dateToDay = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const todayString = () => dateToDay(new Date());

const addDays = (day, count) => {
  const date = dayToDate(day);
  date.setDate(date.getDate() + count);
  return dateToDay(date);
};
