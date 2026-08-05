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
 * One picker for the three days, headless and behind them: a picker is where
 * the day is chosen from a calendar, and there is one day being chosen. Each
 * slide is a button that opens it — which is also what keeps Slide out of the
 * commands business, a slide being a place, not a control.
 *
 * Everything that moves is said as a command: the chevrons travel the container
 * next to them (--navi-left/--navi-right + commandFor), the slides open the
 * picker (--navi-open + commandFor). Nothing here calls a handler that moves
 * something else behind the scenes.
 */

import { batch } from "@preact/signals";
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

    position: relative;
  }
  /* The three days are in one grid cell, so the box would otherwise measure
     itself on the longest label and change width as one steps through days.
     A width of its own keeps the two chevrons still. */
  .navi_day_stepper > [data-slide-container] {
    width: var(--day-stepper-width);
    flex: 0 0 auto;
  }
  /* Behind the days, and the size of the whole box: headless, so it draws
     nothing at all — it is here to be opened by them and to be what the
     calendar is anchored to, which needs a box of its own. */
  .navi_day_stepper_picker {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
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
  const id = useId();
  const containerId = `${id}_days`;
  const pickerId = `${id}_picker`;
  // The area the track is travelling TO, or "current" when it is at rest in the
  // middle. It is also what says a travel is running, and the day only changes
  // once that travel is over — the two must land in the same render or the
  // wrong day shows for a frame.
  const [area, setArea] = useState("current");
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

  // The container is what travels — a chevron, an arrow key, a command from
  // anywhere — and this is where that travel is answered: the day arriving
  // takes the middle, and the track is put back there without a travel of its
  // own (see the duration below).
  const onCurrentChange = (areaNext) => {
    if (areaNext === "current" || area !== "current") {
      return;
    }
    setArea(areaNext);
    setTimeout(() => {
      batch(() => {
        setArea("current");
        setDay(areaNext === "next" ? dayNext : dayPrevious);
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
      {/* One picker for the three days, behind them: what a slide opens (see
          the buttons below), and what holds the day for a form. */}
      <Picker
        id={pickerId}
        className="navi_day_stepper_picker"
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
      >
        <Icon>
          <ChevronLeftSvg />
        </Icon>
      </Button>
      <SlideContainer
        id={containerId}
        layout="row"
        current={area}
        onCurrentChange={onCurrentChange}
        // The way back to the middle is not a travel: the day has just changed
        // under it, so the three slides already hold what they must and the
        // track has only to be where the middle one is.
        duration={area === "current" ? "0ms" : `${duration}ms`}
      >
        <Slide area="previous">
          <DayButton
            day={dayPrevious}
            pickerId={pickerId}
            lang={lang}
            renderDay={renderDay}
          />
        </Slide>
        <Slide area="current">
          <DayButton
            day={day}
            pickerId={pickerId}
            lang={lang}
            renderDay={renderDay}
          />
        </Slide>
        <Slide area="next">
          <DayButton
            day={dayNext}
            pickerId={pickerId}
            lang={lang}
            renderDay={renderDay}
          />
        </Slide>
      </SlideContainer>
      <Button
        command="--navi-right"
        commandFor={containerId}
        icon
        variant="discrete"
        readOnly={!nextAllowed}
        aria-label={nextLabel}
      >
        <Icon>
          <ChevronRightSvg />
        </Icon>
      </Button>
    </Box>
  );
};

// A day is a button: pressing it opens the one picker behind the three of them.
// A Button rather than a command on the Slide itself — a slide is a place, not
// a control, and it has no business carrying one.
const DayButton = ({ day, pickerId, lang, renderDay }) => (
  <Button
    command="--navi-open"
    commandFor={pickerId}
    variant="discrete"
    expandX
    paddingY="xs"
  >
    {renderDay(day, { lang })}
  </Button>
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
