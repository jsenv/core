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

import { useId, useState } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { resolveSpacingSize } from "@jsenv/navi/src/box/box_style_util.js";
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
import { Picker } from "./picker.jsx";

const css = /* css */ `
  .navi_picker_stepper {
    /* What the picker's own box fills: headless, it draws nothing and covers
       whatever it is inside, which is what the calendar is anchored to. */
    position: relative;
  }
  /* The same above and below on all three, from one place: it is what makes the
     value and the two ways out one line rather than three boxes. */
  .navi_picker_stepper > .navi_button,
  .navi_picker_stepper [data-slide] {
    padding-block: var(--picker-stepper-padding-y);
  }
  /* Square, and as tall as one line of what it steps through — not half the
     box: what one presses is a chevron. Its height is its own, rather than the
     middle's, so a value that wraps does not turn the two into towers; the
     font is the one around it so "one line" means the same on both sides. */
  .navi_picker_stepper > .navi_button {
    --button-font-size: inherit;
    aspect-ratio: 1;

    height: calc(1lh + 2 * var(--picker-stepper-padding-y));
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
 * @param {(day: string) => import("preact").ComponentChildren} [renderDay] What
 *   to write for a day. Defaults to the date plus what it is to today when
 *   there is a word for it ("samedi 8 août (demain)"), since a day near now is
 *   read as a distance from now before it is read as a date.
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
  format = "long",
  paddingY = "xs",
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
    <Box
      {...rest}
      baseClassName="navi_picker_stepper"
      flex
      alignY="center"
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
        command="--navi-right"
        commandFor={containerId}
        icon
        variant="discrete"
        readOnly={!nextAllowed}
        aria-label={nextLabel}
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
