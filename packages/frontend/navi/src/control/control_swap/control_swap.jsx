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
 * Nothing is unmounted. Two elements that never coexist have nothing to
 * interpolate between, so both sides stay mounted at all times and only their
 * share of the middle moves: the collapsed slot falls to zero width and turns
 * inert — unreachable by finger and by keyboard — while what was typed in it
 * survives the round trip.
 *
 * Neither control ever reflows during the movement. Each one is laid out at
 * the full width of the middle (`100cqw` of the stage, which is a query
 * container) whatever its slot currently measures, so the slot uncovers a
 * finished control instead of squeezing a live one — text never rewraps
 * mid-swap, and a collapsed control is not a zero-width column of stacked
 * words silently setting the row's height.
 *
 * The row has ONE height, and everything in it is that tall: the caps because
 * they are squares of it, the two controls because they are stretched to it.
 * Nothing is measured — a height read off the controls could only come back
 * through a resize observer, and a cap made square with `aspect-ratio` never
 * reads it anyway (on a flex item stretched to its line, the main size is
 * resolved from content first). It is a length, `--navi-control-swap-size`,
 * defaulting to the height of a navi control at its default padding; a row of
 * roomier controls says so once, there.
 */

import { elementIsFocusable, findAfter } from "@jsenv/dom";
import { toChildArray } from "preact";
import { useId, useLayoutEffect, useRef, useState } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { whenTransitionSettles } from "../../layout/popup_shared.js";
import { Icon } from "../../text/text.jsx";
import { warnSignalCollision } from "../control_value.js";
import { Button } from "../input/button.jsx";

const css = /* css */ `
  .navi_control_swap {
    /* One navi control tall, and a caller with roomier controls than that
       overrides the length rather than every box that has to match it. */
    --x-control-swap-size: var(
      --navi-control-swap-size,
      calc(
        var(--navi-control-line-height) + 2 *
          var(--navi-control-padding-y-default) + 2 *
          var(--navi-control-border-width)
      )
    );

    height: var(--x-control-swap-size);
    align-items: stretch;

    > .navi_control_swap_cap {
      position: relative;
      /* Square on the row: the same length gives the width, the height comes
         from the stretch. */
      flex: 0 0 var(--x-control-swap-size);
      align-items: center;
      align-self: stretch;
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

    > .navi_control_swap_stage {
      display: flex;
      /* What the 100cqw below is a hundred percent of: the room the two
         controls share, which each of them takes in full at all times. */
      container-type: inline-size;
      min-width: 0;
      flex: 1 1 0;
      flex-direction: row;

      > .navi_control_swap_slot {
        display: flex;
        min-width: 0;
        flex: 1 1 0;
        overflow: hidden;

        > .navi_control_swap_control {
          display: flex;
          width: 100cqw;
          flex: 0 0 auto;
          flex-direction: column;
          justify-content: center;

          /* A control is as wide as its content on its own (a navi one is
             literally width: fit-content), and here the one holding the floor
             has the whole middle to fill — so it is told to, rather than left
             to stretch, which an explicit width would win against anyway. */
          > * {
            width: 100%;
          }
        }

        &[data-collapsed] {
          flex-grow: 0;
        }
        /* The far side of each slot is the one that gets covered, so a control
           is uncovered from the cap that speaks for it: the first side grows
           away from the left cap, the second one from the right cap. */
        &[data-pinned="end"] {
          justify-content: flex-end;
        }
      }
    }

    /* Settled with the floor: stop clipping, so a focus ring, a shadow or a
       callout arrow drawn outside the control's box is not cut at the seam.
       Anything else — a slot without the floor, and both of them while the
       movement is playing — clips, which is what covers and uncovers them. */
    &[data-settled]
      > .navi_control_swap_stage
      > .navi_control_swap_slot:not([data-collapsed]) {
      overflow: visible;
    }

    &[data-animation] > .navi_control_swap_stage > .navi_control_swap_slot {
      transition: flex-grow var(--navi-control-swap-animation-duration, 0.22s)
        ease;
    }
    @media (prefers-reduced-motion: reduce) {
      &[data-animation] > .navi_control_swap_stage > .navi_control_swap_slot {
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
 * @param animation - On by default: the two slots trade their share of the
 *   middle over `--navi-control-swap-animation-duration` (0.22s). `false`
 *   swaps them in one frame; `prefers-reduced-motion` does too.
 *
 * The row is one length tall — `--navi-control-swap-size`, the height of a navi
 * control at its default padding — and the caps are squares of it. Controls
 * with a padding of their own need that length said once, here.
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

  // The movement is over and the slots are where they belong (see the CSS).
  const [settled, setSettled] = useState(true);

  const swapTo = (name, event) => {
    if (name === activeNameRef.current) {
      return;
    }
    activeNameRef.current = name;
    setActiveName(name);
    setSettled(!animation);
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
      return undefined;
    }
    const activeSlot = slotRefs[activeIndex].current;
    focusWithTheFloor(activeSlot, activeSide, capRefs[activeIndex].current);
    if (!animation) {
      return undefined;
    }
    return whenTransitionSettles(activeSlot, () => {
      setSettled(true);
    });
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
      data-settled={settled ? "" : undefined}
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
        {sides.map((side, index) => (
          <div
            key={side.name}
            ref={slotRefs[index]}
            id={`${slotIdPrefix}_${index}`}
            className="navi_control_swap_slot"
            data-pinned={index === 0 ? "start" : "end"}
            data-collapsed={side === activeSide ? undefined : ""}
            inert={side === activeSide ? undefined : true}
          >
            <div className="navi_control_swap_control">{side.children}</div>
          </div>
        ))}
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
 * reads these and draws the caps at its ends, the controls between them.
 *
 * @type {import("preact").FunctionComponent<{
 *   name?: string,
 *   icon: import("preact").ComponentChildren,
 *   label: string,
 *   badge?: boolean | import("preact").ComponentChildren,
 *   autoFocus?: boolean,
 *   children?: import("preact").ComponentChildren,
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
 *   takes the floor (its `[autofocus]` element, or the first focusable one).
 *   `false` leaves it on the cap that was pressed — for a control one reads
 *   before writing in, or a phone where the keyboard must not rise yet. Never
 *   on mount, whatever the setting.
 */
const ControlSwapSide = () => null;

const ControlSwapCap = ({ ref, side, slotId, active, onPress }) => {
  const { icon, label, badge } = side;
  return (
    <Button
      ref={ref}
      className="navi_control_swap_cap"
      variant="discrete"
      icon
      aria-label={label}
      aria-expanded={active}
      aria-controls={slotId}
      onClick={onPress}
    >
      <Icon width="60%" square>
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
    const { name, ...rest } = child.props;
    sides.push({
      name: name === undefined ? String(sides.length) : name,
      ...rest,
    });
  }
  return sides;
};

// The floor moved: the press that gave it landed on a cap, and what one wants
// next is the control that just arrived — typing into the search field one just
// opened, not pressing its icon again. So the focus follows the floor into the
// control, unless the side refused it, and lands on the cap otherwise: whatever
// the newly collapsed slot held is inert now and was dropped to the document
// body by the browser, so it must go somewhere.
const focusWithTheFloor = (activeSlot, activeSide, activeCap) => {
  if (activeSide.autoFocus !== false) {
    const elementToFocus = findElementToFocus(activeSlot);
    if (elementToFocus) {
      elementToFocus.focus();
      return;
    }
  }
  const { activeElement } = document;
  if (!activeElement || activeElement === document.body) {
    activeCap.focus();
  }
};

const findElementToFocus = (slot) => {
  const autofocusElement = slot.querySelector("[autofocus]");
  if (autofocusElement) {
    return autofocusElement;
  }
  return findAfter(slot, elementIsFocusable, { root: slot });
};
