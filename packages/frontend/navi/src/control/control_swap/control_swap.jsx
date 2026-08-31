/**
 * ControlSwap: two controls taking turns on one line.
 *
 *     [👥] [ Le dimanche matin     ▾ ]                     [🔍]
 *     [👥]                           [ Rechercher…       ] [🔍]
 *
 * Four boxes on a row that is never wide enough for both controls — a phone
 * answering "what do I search IN" then "what am I looking for". The two end
 * caps are fixed: same place, same size, in both states, and either of them
 * hands the floor to the other side. That is the whole reason the caps sit
 * OUTSIDE the controls rather than being drawn inside them (a picker's façade
 * yields a zone with `ownTarget`, a field has `Input.UI.LeftSlot`): an icon
 * that lives inside its control while open and becomes a pill once closed is
 * a switch that moves when you flip it: the finger that opened the search has
 * to travel to close it again. Out here, the same pixel does both.
 *
 * Nothing is unmounted, and nothing is resized. Two elements that never
 * coexist have nothing to interpolate between, so both controls stay mounted
 * and laid out at all times, side by side on a track twice the width of the
 * middle; the track slides, and one control pushes the other out under the cap
 * it belongs to. A share of the middle traded between two shrinking boxes
 * gives a wipe instead — each control squeezed live, text rewrapping under the
 * movement, and nothing that reads as one thing arriving over another.
 *
 * The control without the floor is off the middle rather than gone: `inert`,
 * so no finger and no Tab reaches it, and holding what was typed in it for the
 * round trip back.
 *
 * The row has ONE height, and everything in it is that tall: the caps are
 * squares of it, the controls are given it. Nothing is measured — a height
 * read off the controls could only come back through a resize observer, and a
 * cap made square with `aspect-ratio` never reads it anyway (on a flex item
 * stretched to its line, the main size is resolved from content first). It is
 * a length, `--navi-control-swap-size`, and it is the only thing to say to
 * make the row thinner or thicker.
 */

import { toChildArray } from "preact";
import { useId, useLayoutEffect, useRef, useState } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { Icon } from "../../text/text.jsx";
import {
  findFocusTarget,
  moveFocusTo,
} from "../../utils/focus/focus_transfer.js";
import { warnSignalCollision } from "../control_value.js";
import { Button } from "../input/button.jsx";

const css = /* css */ `
  .navi_control_swap {
    /* The row is measured in the size of what it HOLDS rather than in the
       page's: it holds controls, a control carries a font of its own, and the
       length below is written in em. Without this a row of 16px text gives an
       18px field a box built for a smaller line, and the same field is roomier
       everywhere else in the app. */
    font-size: var(--navi-control-font-size);

    /* A line of that text between two s paddings and two borders — a control
       sized for a finger rather than for a form. Everything in the row is this tall,
       so a caller wanting a thinner or thicker one says it here, once, instead
       of on each box that has to match. */
    --x-control-swap-size: var(
      --navi-control-swap-size,
      calc(
        var(--navi-control-line-height) + 2 * var(--navi-s) + 2 *
          var(--navi-control-border-width)
      )
    );

    /* One spacing for the row: between a cap and the control beside it, and
       between the two controls on the track — the second one is only ever seen
       crossing the window mid-slide, and it reads as the first. */
    --x-control-swap-gap: var(--navi-control-swap-gap, var(--navi-xs));

    height: var(--x-control-swap-size);
    align-items: stretch;
    gap: var(--x-control-swap-gap);

    > .navi_control_swap_cap {
      /* The paper of the field beside it, not a button's: a cap is one of the
         boxes of a control row, and a row whose whole job is to be quiet must
         not read as two grey ends around a white middle. The rest of its look
         is the caller's — a Side spreads what it is given onto it. */
      --button-background-color: var(--navi-surface-color);

      position: relative;
      aspect-ratio: 1;
      /* Square on the row's height, which the row makes definite above — so
         the ratio has a height to read and hands back the width. Taking the
         width from the length instead would make it a rectangle: the length is
         written in em, and a button carries a font-size of its own, so the
         same expression resolves shorter here than it did on the row.
         min-width against the automatic minimum size of a flex item, which
         would otherwise let the icon inside push the cap wider than its own
         height. */
      min-width: 0;
      height: 100%;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;

      .navi_control_swap_badge {
        position: absolute;
        top: 0;
        right: 0;
        z-index: 1;
        width: 0.45em;
        height: 0.45em;
        background-color: var(
          --navi-control-swap-badge-color,
          var(--navi-accent-color)
        );
        border-radius: 100em;
        transform: translate(30%, -30%);
      }
    }

    /* The window on the track: exactly the room the two controls share, and
       what hides the one that is out of it. A query container, so the sizes
       below can be a hundred percent OF IT — a percentage would resolve
       against a flex item still being sized and collapse to nothing. */
    > .navi_control_swap_stage {
      display: flex;
      container-type: inline-size;
      min-width: 0;
      flex: 1 1 0;
      /* clip, not hidden: hidden makes a scroll container, and the browser
         scrolls it to reveal the control taking the focus while the track is
         still on its way there — the row then lands a whole window off. There
         is nothing to scroll in something merely clipped.
         The margin is for the focus ring: a control draws it straddling its
         own edge, and the control in the window fills the window exactly, so
         a seam right on the edge would shave the outer half of the ring off.
         The control out of the window is a whole window away and stays out. */
      overflow: clip;
      overflow-clip-margin: var(--navi-focus-outline-width);
    }

    /* Both controls, side by side, each the whole width of the window: the
       track is twice it, and one window of travel puts the other one in view. */
    > .navi_control_swap_stage > .navi_control_swap_track {
      display: flex;
      height: 100%;
      flex: 0 0 auto;
      flex-direction: row;
      /* Also what keeps the control that is out of the window out of the clip
         margin above, instead of letting a sliver of it show at the seam. */
      gap: var(--x-control-swap-gap);

      > .navi_control_swap_slot {
        display: flex;
        flex: 0 0 100cqw;

        /* A control is exactly as big as its content on its own (a navi one is
           literally width/height: fit-content), and here it has a box to fill:
           the whole middle, and the row's one height — the caps beside it are
           that tall too, and three boxes of three heights is not a row. Said
           rather than stretched, which an explicit size wins against anyway. */
        > * {
          width: 100%;
          height: 100%;
        }
      }
    }
    &[data-active-index="1"]
      > .navi_control_swap_stage
      > .navi_control_swap_track {
      transform: translateX(calc(-100cqw - var(--x-control-swap-gap)));
    }

    &[data-animation] > .navi_control_swap_stage > .navi_control_swap_track {
      transition: transform var(--navi-control-swap-animation-duration, 0.22s)
        ease;
    }
    @media (prefers-reduced-motion: reduce) {
      &[data-animation] > .navi_control_swap_stage > .navi_control_swap_track {
        transition: none;
      }
    }
  }
`;

/**
 * @type {import("preact").FunctionComponent<{
 *   value?: string,
 *   defaultValue?: string,
 *   signal?: import("@preact/signals").Signal<string>,
 *   onChange?: (name: string, event: Event) => void,
 *   animation?: boolean,
 *   children?: import("preact").ComponentChildren,
 * }>}
 * @param value - The name of the side holding the floor, driven from outside:
 *   the row swaps to match every change of it, and a press on a cap can still
 *   swap it in between (same semantics as Dialog/Popover's own `open`).
 * @param defaultValue - Uncontrolled, mount-only: which side starts with the
 *   floor. The first `<ControlSwap.Side>` by default.
 * @param signal - Two-way binding: the row follows the signal and writes the
 *   side's name back into it whenever a press swaps it. Excludes `value`.
 * @param onChange - Called with the name of the side taking the floor, and the
 *   press that gave it.
 * @param animation - On by default: the track slides from one control to the
 *   other over `--navi-control-swap-animation-duration` (0.22s). `false` puts
 *   it there in one frame; `prefers-reduced-motion` does too.
 *
 * The row is one length tall — `--navi-control-swap-size`, a line of text
 * between two `s` paddings — and everything in it is that tall: the caps are
 * squares of it, the control holding the floor fills it. `--navi-control-swap-gap`
 * is the space between the boxes.
 */
export const ControlSwap = (props) => {
  import.meta.css = css;
  const {
    value,
    defaultValue,
    signal,
    onChange,
    animation = true,
    children,
    ...rest
  } = props;

  const sides = readSides(children);
  if (sides.length !== 2) {
    throw new Error(
      `<ControlSwap> takes exactly two <ControlSwap.Side> as direct children, got ${sides.length}`,
    );
  }

  if (signal) {
    warnSignalCollision(props, "control_swap", "value");
  }
  // Reading .value during render is what subscribes the row to it.
  const valueRequested = signal ? signal.value : value;
  const [activeName, setActiveName] = useState(() => {
    const nameRequested =
      valueRequested === undefined ? defaultValue : valueRequested;
    return nameRequested === undefined ? sides[0].name : nameRequested;
  });
  const activeIndexFound = sides.findIndex((side) => side.name === activeName);
  const activeIndex = activeIndexFound === -1 ? 0 : activeIndexFound;
  const activeSide = sides[activeIndex];

  const capRefs = [useRef(), useRef()];
  const slotRefs = [useRef(), useRef()];
  const slotIdPrefix = useId();

  const activeNameRef = useRef(activeName);
  activeNameRef.current = activeSide.name;

  const swapTo = (name, event) => {
    if (name === activeNameRef.current) {
      return;
    }
    activeNameRef.current = name;
    setActiveName(name);
    if (signal) {
      signal.value = name;
    }
    if (onChange) {
      onChange(name, event);
    }
  };

  // Follow `value`/`signal` changes after mount (the initial one is already in
  // the state above). A press that wrote the signal lands here too and no-ops,
  // since the state already matches.
  const isFirstValueRunRef = useRef(true);
  useLayoutEffect(() => {
    if (isFirstValueRunRef.current) {
      isFirstValueRunRef.current = false;
      return;
    }
    if (valueRequested === undefined) {
      return;
    }
    swapTo(valueRequested);
  }, [valueRequested]);

  // Move the focus with the floor — but never on mount: a row that simply
  // renders with its search side open must not steal the page's focus, and on
  // a phone that is the keyboard rising in front of the list one came to read.
  const isFirstActiveRunRef = useRef(true);
  useLayoutEffect(() => {
    if (isFirstActiveRunRef.current) {
      isFirstActiveRunRef.current = false;
      return;
    }
    focusWithTheFloor(
      slotRefs[activeIndex].current,
      activeSide,
      capRefs[activeIndex].current,
    );
  }, [activeSide.name]);

  // Both caps do the same thing, and it is the reason they sit outside the
  // controls: whichever one the finger lands on, the floor goes to the other
  // side. The same pixel opens the search and closes it.
  const swapOnPress = (event) => {
    swapTo(sides[activeIndex === 0 ? 1 : 0].name, event);
  };

  return (
    <Box
      flex="x"
      baseClassName="navi_control_swap"
      role="group"
      data-animation={animation ? "" : undefined}
      data-active-index={activeIndex}
      {...rest}
    >
      <ControlSwapCap
        ref={capRefs[0]}
        side={sides[0]}
        slotId={`${slotIdPrefix}_0`}
        active={activeIndex === 0}
        onPress={swapOnPress}
      />
      <div className="navi_control_swap_stage">
        <div className="navi_control_swap_track">
          {sides.map((side, index) => (
            <div
              key={side.name}
              ref={slotRefs[index]}
              id={`${slotIdPrefix}_${index}`}
              className="navi_control_swap_slot"
              inert={index === activeIndex ? undefined : true}
            >
              {side.control}
            </div>
          ))}
        </div>
      </div>
      <ControlSwapCap
        ref={capRefs[1]}
        side={sides[1]}
        slotId={`${slotIdPrefix}_1`}
        active={activeIndex === 1}
        onPress={swapOnPress}
      />
    </Box>
  );
};

/**
 * One of the two controls, and the cap that speaks for it. Declarative: the row
 * reads these and draws the caps at its ends, the controls between them. The
 * props below say what the side IS; every other prop describes its cap.
 *
 * @type {import("preact").FunctionComponent<{
 *   name?: string,
 *   icon: import("preact").ComponentChildren,
 *   label: string,
 *   badge?: boolean | import("preact").ComponentChildren,
 *   autoFocus?: boolean,
 *   children?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 * @param name - How `value`/`signal`/`onChange` name this side. Its position
 *   ("0" or "1") by default.
 * @param icon - What the cap draws.
 * @param label - What the cap is called — it holds no text, so this is its
 *   accessible name. Say what pressing it reveals ("Rechercher"), not what it
 *   currently shows: the cap wears `aria-expanded` for the state.
 * @param badge - A mark on the cap saying this collapsed control is still
 *   doing something (a filter set, a search typed). `true` draws a dot;
 *   anything else is drawn as given (a `<BadgeCount>`, say).
 * @param autoFocus - On by default: the focus goes into this control when it
 *   takes the floor, where navi's ladder puts it — an `autoFocus` inside the
 *   control first, its first focusable otherwise. `false` leaves it on the cap
 *   that was pressed, for a control one reads before writing in (and, on a
 *   phone, for a keyboard that must not rise). Never on mount, whatever the
 *   setting.
 *
 * Anything else — `data-testid`, `variant`, `backgroundColor`, `color`, an
 * `aria-describedby` — goes to the cap, which is a `<Button>`. It is the one
 * element of the row an application does not render, so nothing else can name
 * it or dress it; the control it stands for is a vnode of the caller's own and
 * takes its props directly.
 */
const ControlSwapSide = () => null;

const ControlSwapCap = ({ ref, side, slotId, active, onPress }) => {
  const { icon, label, badge, ...capProps } = side.capProps;
  return (
    <Button
      icon
      pressEffect="none"
      aria-label={label}
      {...capProps}
      ref={ref}
      // After the caller's props, all of them: the class is what the row's own
      // CSS reaches for, and the rest is the wiring that makes the cap a cap.
      className={
        capProps.className
          ? `navi_control_swap_cap ${capProps.className}`
          : "navi_control_swap_cap"
      }
      aria-expanded={active}
      aria-controls={slotId}
      onClick={onPress}
    >
      <Icon width="50%" square>
        {icon}
      </Icon>
      {badge ? (
        <span className="navi_control_swap_badge" aria-hidden="true">
          {badge === true ? null : badge}
        </span>
      ) : null}
    </Button>
  );
};

ControlSwap.Side = ControlSwapSide;

const readSides = (children) => {
  const sides = [];
  for (const child of toChildArray(children)) {
    if (!child || child.type !== ControlSwapSide) {
      continue;
    }
    // What is left over once the side's own vocabulary is taken out describes
    // the cap: the control is a vnode the caller wrote and dresses itself, so
    // the cap is the only thing in the row left to describe.
    const { name, autoFocus, children: control, ...capProps } = child.props;
    sides.push({
      name: name === undefined ? String(sides.length) : name,
      autoFocus,
      control,
      capProps,
    });
  }
  return sides;
};

// The floor moved: the press that gave it landed on a cap, and what one wants
// next is the control that just arrived — typing into the search field one just
// opened, not pressing its icon again.
//
// WHERE inside is navi's own ladder (findFocusTarget): an `autoFocus` in the
// control's own content first, the first focusable otherwise, a last resort
// after that. Two of the ladder's reflexes are turned off here, and it is the
// same reason both times — they are about a surface APPEARING, and this is a
// press aimed at the control being handed the focus:
// - the first focusable is kept even where the pointer is coarse (an arriving
//   popup drops it so a virtual keyboard does not rise over what it just
//   showed, see docs/autofocus.md); pressing a cap to reach a field is asking
//   for that keyboard;
// - `autoFocus="restore"` may claim it, though it means "never on a fresh
//   open". A field marked that way so its sheet opens quietly would otherwise
//   leave the focus on the magnifier that was pressed to reach it.
// A side one reads before writing in says `autoFocus={false}`.
const focusWithTheFloor = (arrivingSlot, arrivingSide, arrivingCap) => {
  if (arrivingSide.autoFocus !== false) {
    const found = findFocusTarget(arrivingSlot, { restoreMayClaim: true });
    if (found) {
      moveFocusTo(found.target);
      return;
    }
  }
  // Whatever the leaving slot held is inert and off the window now, so the
  // browser dropped its focus to the document body: it has to land somewhere,
  // and the cap of the side taking over is where the gesture was.
  const { activeElement } = document;
  if (!activeElement || activeElement === document.body) {
    moveFocusTo(arrivingCap);
  }
};
