/**
 * A value one steps through, one press at a time: what is chosen sits between
 * the way back and the way on, and the two of them are the whole control.
 *
 * Days for now — DaySpin below — but nothing here is about days except how
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
import { openCallout } from "../rules/callout/callout.js";
import {
  dispatchRequestResetUIState,
  dispatchRequestSetUIState,
} from "../ui_state_dom.js";
import { Picker } from "./picker.jsx";

const css = /* css */ `
  @layer navi {
    .navi_picker_spin {
      /* A picker one steps through is still a picker: what themes every picker
         padding themes this one too. */
      --picker-spin-padding-x-default: var(--navi-picker-padding-x-default);
      --picker-spin-padding-y-default: var(--navi-picker-padding-y-default);
    }
  }

  .navi_picker_spin {
    /* The padding is written on what is inside the box rather than on the box
       — the day takes all four sides, the two chevrons only the vertical ones
       — so the four sides are resolved once here, in the side-then-axis-then
       -shorthand order a Box resolves them in. What writes them: the padding
       props, through PICKER_SPIN_STYLE_CSS_VARS below. */
    --x-picker-spin-padding-top: var(
      --picker-spin-padding-top,
      var(
        --picker-spin-padding-y,
        var(--picker-spin-padding, var(--picker-spin-padding-y-default))
      )
    );
    --x-picker-spin-padding-right: var(
      --picker-spin-padding-right,
      var(
        --picker-spin-padding-x,
        var(--picker-spin-padding, var(--picker-spin-padding-x-default))
      )
    );
    --x-picker-spin-padding-bottom: var(
      --picker-spin-padding-bottom,
      var(
        --picker-spin-padding-y,
        var(--picker-spin-padding, var(--picker-spin-padding-y-default))
      )
    );
    --x-picker-spin-padding-left: var(
      --picker-spin-padding-left,
      var(
        --picker-spin-padding-x,
        var(--picker-spin-padding, var(--picker-spin-padding-x-default))
      )
    );
    /* What the loading outline is drawn around. */
    position: relative;
    /* Written in the control font, like the picker it wraps: the day and its
       two chevrons are a control, not running text. */
    font-size: var(--navi-control-font-size);
    font-family: var(--navi-control-font-family);
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
    outline-offset: 0px;
  }
  /* The days hold the keyboard, and this box wears their ring: the container
     fills it, so its own ring would be drawn a pixel inside this border and
     two rings that close together read as a mistake. Same offer a dialog and a
     popover answer (data-focus-outline-delegate, see slide_container.jsx), and
     the same reply — the delegate stands down.
     Said on this box too (the first selector): nothing focuses it for real —
     it is the container that takes the keyboard — but it is where the ring is
     drawn, so a demo can hold it there and show what it looks like. */
  .navi_picker_spin[data-focus-visible],
  .navi_picker_spin:has([data-focus-outline-delegate][data-focus-visible]) {
    outline-style: solid;
  }
  .navi_picker_spin [data-focus-outline-delegate] {
    --navi-focus-outline-style: none;
  }
  /* Same fading every navi control does when it is not to be touched (the
     border first, the words too once it is out of service): what is inside is
     three pieces of ours, so the box says it for all of them. */
  .navi_picker_spin[data-readonly] {
    border-color: color-mix(
      in srgb,
      var(--navi-control-border-color) 45%,
      transparent
    );

    [data-slide] {
      color: color-mix(in srgb, currentColor 60%, transparent);
    }
  }
  .navi_picker_spin[data-disabled] {
    color: color-mix(in srgb, currentColor 40%, transparent);
    border-color: color-mix(
      in srgb,
      var(--navi-control-border-color) 30%,
      transparent
    );
  }
  /* The middle, as a box of its own: the headless picker draws nothing and
     covers whatever is positioned around it, and THAT box is where the browser
     opens its calendar. Around the whole control it would open under a chevron;
     around the value it opens under the value one pressed. */
  .navi_picker_spin_middle {
    position: relative;
    display: flex;
    min-width: 0;
    flex: 1 1 0;
  }
  /* The hidden picker, centred and no wider than it needs to be: the browser
     opens its calendar from the box the input occupies, and it chooses which
     corner. Over the whole middle that choice is a coin toss between one end
     and the other; over a narrow box in the middle, whichever corner it picks
     is under the value one pressed. */
  .navi_picker_spin_middle > .navi_picker {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: min(100%, var(--picker-spin-picker-width, 12ch));
    translate: -50% 0;
  }
  /* Where the padding lands: all four sides on the value, the two vertical
     ones on the chevrons below — the same number above and below is what makes
     the three one line rather than three boxes, while sideways it is the room
     between the value and the chevron it would otherwise touch. Not on the box
     itself: that would push the chevrons off the corners they are rounded by.

     Centred, always: the middle holds three values of three different lengths,
     and a value that starts where the last one ended reads as a jump. */
  .navi_picker_spin [data-slide] {
    padding-top: var(--x-picker-spin-padding-top);
    padding-right: var(--x-picker-spin-padding-right);
    padding-bottom: var(--x-picker-spin-padding-bottom);
    padding-left: var(--x-picker-spin-padding-left);
    text-align: center;
    overflow: hidden;
  }
  /* The middle opens the picker, so it says so under the pointer — and stops
     saying it the moment pressing it would only get an answer about why not. */
  .navi_picker_spin [data-slide-container] {
    cursor: pointer;
  }
  .navi_picker_spin[data-readonly] [data-slide-container],
  .navi_picker_spin[data-disabled] [data-slide-container] {
    cursor: default;
  }
  /* Kept inside its own slide: the three days share one cell, so anything
     sticking out would be written across the two beside it. A day too long for
     the box simply wraps — the box grows, and the words are all there; say
     maxLines to cut it instead, which the text itself knows how to do. */
  .navi_picker_spin [data-slide] > * {
    max-width: 100%;
    overflow: hidden;
  }
  /* As tall as one line of what it steps through — not half the box: what one
     presses is a chevron. Its height is its own, rather than the middle's, so a
     value that wraps does not turn the two into towers; the font is the one
     around it, so "one line" means the same on both sides. */
  .navi_picker_spin > .navi_picker_spin_way_out {
    box-sizing: border-box;
    height: calc(
      1lh + var(--x-picker-spin-padding-top) +
        var(--x-picker-spin-padding-bottom)
    );
    padding-top: var(--x-picker-spin-padding-top);
    padding-bottom: var(--x-picker-spin-padding-bottom);
    color: inherit;
    background: none;
    border: none;
    /* Square by default, and rounded back only where the box is rounded (see
       below): the corners that give onto the value have nothing to follow, and
       a radius there would show as a notch in the pressed background. */
    border-radius: 0;
    cursor: pointer;
  }
  .navi_picker_spin > .navi_picker_spin_way_out:hover {
    background: color-mix(in srgb, currentColor 8%, transparent);
  }
  /* Nothing that way: still there, still pressable — pressing it is how one
     learns why (see WayOut's own callout). */
  .navi_picker_spin > .navi_picker_spin_way_out[data-unavailable] {
    color: color-mix(in srgb, currentColor 35%, transparent);
  }
  .navi_picker_spin[data-readonly] > .navi_picker_spin_way_out,
  .navi_picker_spin[data-disabled] > .navi_picker_spin_way_out {
    cursor: default;
  }
  /* Square beside the value, full width above and below it: a way out is as
     wide as what it steps through when it sits across it. */
  .navi_picker_spin:not([data-vertical]) > .navi_picker_spin_way_out {
    aspect-ratio: 1;
    justify-content: center;
  }
  .navi_picker_spin[data-vertical] > .navi_picker_spin_way_out {
    width: 100%;
    justify-content: center;
  }
  /* The corners of the box belong to what sits in them: a chevron in the corner
     of a rounded spin is rounded there too, and nowhere else — the two corners
     it does not own stay at the 0 above. Said with inherit rather than clipped
     away with overflow, which would cut the focus ring of the very button it
     rounds. */
  .navi_picker_spin:not([data-vertical])
    > .navi_picker_spin_way_out:first-of-type {
    border-start-start-radius: inherit;
    border-end-start-radius: inherit;
  }
  .navi_picker_spin:not([data-vertical])
    > .navi_picker_spin_way_out:last-of-type {
    border-start-end-radius: inherit;
    border-end-end-radius: inherit;
  }
  .navi_picker_spin[data-vertical] > .navi_picker_spin_way_out:first-of-type {
    border-start-start-radius: inherit;
    border-start-end-radius: inherit;
  }
  .navi_picker_spin[data-vertical] > .navi_picker_spin_way_out:last-of-type {
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
 *   instead, or `defaultValue` to let the spin hold the day itself.
 * @param {number} [step=1] How many days a press covers — 7 for a week at a
 *   time, and the label then names the day one lands on, as it always does.
 * @param {number} [duration=250] How long a travel takes, in milliseconds.
 * @param {string} [min] The first day one can reach, as "YYYY-MM-DD"; `max` is
 *   the last. Beyond them the travel simply does not happen and the chevron
 *   that way says so.
 * @param {"long"|"short"|"numeric"} [format="long"] How the date is written.
 *   Long by default, since this is a control one reads rather than a column
 *   one scans; `short` where the room is not there.
 * @param {string} [padding] The room around the value, `paddingX`/`paddingY`
 *   and the four sides included. It goes on what is inside the box rather than
 *   on the box: above and below it is taken by the day AND by the two chevrons,
 *   which is what makes the three the same height; sideways it is the room
 *   between the day and the chevron beside it. Left unsaid it is the padding
 *   every picker takes (`--navi-picker-padding-x-default` and its `-y` twin),
 *   so a theme that spaces its fields spaces this one with them.
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
export const DaySpin = ({
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
  } else {
    if (signalProp) {
      dayProps.signal = signalProp;
    }
    // A day is always shown, so the picker always HOLDS one: what was named, or
    // what the signal starts on, or today (the nearest day a min/max/step
    // leaves reachable). Said as a default rather than as a value, so a form
    // reads the day shown as an answer one can send rather than as something it
    // already holds — and said even when a signal is bound, because a signal
    // with nothing in it would otherwise leave the picker empty while the
    // spin shows a day, and a form has nothing to send about an empty field.
    dayProps.defaultValue =
      defaultValue ??
      signalProp?.options?.getDefaultValue?.(false) ??
      dayFallback;
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
      baseClassName="navi_picker_spin"
      flex={vertical ? "y" : "x"}
      alignY="center"
      // The states this box draws itself: the ring above is the one that is
      // asked for by hand (pseudoState) as well as held for real.
      pseudoClasses={PICKER_SPIN_PSEUDO_CLASSES}
      styleCSSVars={PICKER_SPIN_STYLE_CSS_VARS}
      data-vertical={vertical ? "" : undefined}
      data-readonly={readOnlyResolved ? "" : undefined}
      data-disabled={disabledResolved ? "" : undefined}
    >
      {/* Around the whole box, the way a button wears it: the day is on its
          way somewhere, and it is the day one is looking at. */}
      <LoadingOutline
        loading={loading}
        color="var(--navi-loader-color)"
        inset={-2}
      />
      <WayOut
        command={vertical ? "--navi-up" : "--navi-left"}
        containerId={containerId}
        unavailableMessage={wayOutMessage(
          previousAllowed,
          "spin.nothing_before",
        )}
        label={previousLabel ?? naviI18n("spin.previous")}
      >
        {vertical ? <ChevronUpSvg /> : <ChevronLeftSvg />}
      </WayOut>
      {/* One box for the value and the picker behind it: the picker is
          headless, so what the browser anchors its calendar to is whatever box
          is positioned around it — and that has to be the value one pressed. */}
      <div className="navi_picker_spin_middle">
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
          // preventDefault, because a <Label> around the whole control forwards
          // a click to what it labels — the picker — and that would open the
          // calendar a second time, right after this command did.
          onClick={(e) => {
            e.preventDefault();
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
      </div>
      <WayOut
        command={vertical ? "--navi-down" : "--navi-right"}
        containerId={containerId}
        unavailableMessage={wayOutMessage(nextAllowed, "spin.nothing_after")}
        label={nextLabel ?? naviI18n("spin.next")}
      >
        {vertical ? <ChevronDownSvg /> : <ChevronRightSvg />}
      </WayOut>
    </Box>
  );
};

// A way out is a place one presses, not a control: no <button>, on purpose.
// A <button> is labelable, so a <Label> wrapping the whole spin would bind
// to the first chevron instead of to the picker — the thing that actually holds
// the value — and a form would carry two more controls that answer for nothing.
// It is not focusable either: the keyboard walks the days on the container (see
// its own tabIndex), where the arrows already mean this.
const WayOut = ({
  command,
  containerId,
  unavailableMessage,
  label,
  children,
}) => (
  <Box
    as="span"
    baseClassName="navi_picker_spin_way_out"
    // Announced as a button because that is what it is to whoever cannot see
    // the chevron — and marked unavailable rather than removed when there is
    // nothing that way, so it keeps its place.
    role="button"
    aria-label={label}
    aria-disabled={unavailableMessage ? "true" : undefined}
    data-unavailable={unavailableMessage ? "" : undefined}
    // At the chevron, not beside it: a callout aims its arrow at where the
    // anchor's text starts, and there is no text here — only a glyph in the
    // middle of the box, which is what one pressed and what the answer is
    // about.
    data-callout-arrow-x="center"
    // Read by triggerNaviCommand below the same way it reads a button's own.
    commandfor={containerId}
    flex
    align="center"
    // A press, answered where it starts: mousedown rather than click, which is
    // what makes holding one feel immediate — and the click after it is stopped
    // below, so a <Label> wrapping the whole control does not forward it to the
    // picker and open the calendar on the way past.
    onClick={(e) => {
      e.preventDefault();
    }}
    onMouseDown={(e) => {
      // No focus, no text selection: the keyboard is put on the days below.
      e.preventDefault();
      const wayOutElement = e.currentTarget;
      if (unavailableMessage) {
        // Why it does nothing, said where one pressed: a control would have
        // done this through its own interaction gate, and this one has none.
        openCallout(unavailableMessage, {
          anchorElement: wayOutElement,
          status: "info",
          openingEvent: e,
        });
        return;
      }
      // The keyboard follows the press: the days are where the arrows work, so
      // pressing a chevron leaves one able to keep going with the keys.
      document.getElementById(containerId)?.focus({ preventScroll: true });
      triggerNaviCommand(wayOutElement, command, e);
    }}
  >
    <Icon>{children}</Icon>
  </Box>
);

const PICKER_SPIN_PSEUDO_CLASSES = [":hover", ":focus-visible"];

// A padding written on this box would sit between its border and the chevrons,
// which are meant to reach the corners they are rounded by — so each padding
// prop becomes a variable instead, and the CSS above hands it to the day and to
// the chevrons themselves. Same trick, and same var chain, as Picker's.
const PICKER_SPIN_STYLE_CSS_VARS = {
  padding: "--picker-spin-padding",
  paddingX: "--picker-spin-padding-x",
  paddingY: "--picker-spin-padding-y",
  paddingTop: "--picker-spin-padding-top",
  paddingRight: "--picker-spin-padding-right",
  paddingBottom: "--picker-spin-padding-bottom",
  paddingLeft: "--picker-spin-padding-left",
};

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
    noWrap={maxLines === 1 || maxLines === "1" ? undefined : false}
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
