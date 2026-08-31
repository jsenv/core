/**
 * ControlSwap: two controls taking turns on one line.
 *
 *     [👥] [ Le dimanche matin     ▾ ]                     [🔍]
 *     [👥]                           [ Rechercher…       ] [🔍]
 *
 * Four boxes on a row that is never wide enough for both controls — a phone
 * answering "what do I search IN" then "what am I looking for". The two end
 * caps are fixed: same place, same size, in both states, and each one gives
 * the floor to its own side. That is the whole reason the caps are OUTSIDE
 * the controls rather than drawn inside them (a picker's façade yields a zone
 * with `ownTarget`, a field has `Input.UI.LeftSlot`): an icon that lives
 * inside its control while open and becomes a pill once closed is a switch
 * that moves when you flip it, and the finger that opened the search has to
 * travel to close it again. Out here, the same pixel opens and closes.
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
 * The square end cap cannot be had from CSS: on a flex item whose height comes
 * from `align-self: stretch`, `aspect-ratio: 1` does not read that height (the
 * main size is resolved from content first, measured the same in chromium,
 * webkit and firefox). The row's height is whatever the controls in it happen
 * to be, so a cap is measured and given its own height as a width.
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
    align-items: stretch;

    > .navi_control_swap_cap {
      position: relative;
      /* Its own height, measured (see the top comment). Unset until the first
         measurement, where the cap is simply as wide as its icon. */
      width: var(--navi-control-swap-cap-size);
      flex: 0 0 auto;
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
      `<ControlSwap> takes exactly two <ControlSwap.Side>, got ${sides.length}`,
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

  useCapSizeEffect(capRefs);

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
 * @param autoFocus - Moves the focus into this control when it takes the
 *   floor. Never on mount, whatever the setting.
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
      <Icon fillLine>{icon}</Icon>
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

// The floor moved: whatever the newly collapsed slot held is inert now, and a
// focus inside it was dropped to the document body by the browser. It goes into
// the control taking over when that control asked for it, and to the cap
// speaking for it otherwise — never nowhere.
const focusWithTheFloor = (activeSlot, activeSide, activeCap) => {
  if (activeSide.autoFocus) {
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

// A cap is square on the row's height, and the row's height is whatever the
// controls in it happen to be — so it is watched rather than computed. Written
// on the cap itself: what it reads back is what it just measured, and a change
// too small to see is dropped so the observer cannot chase itself (the width it
// sets takes room away from the controls, which could in principle change the
// height it reads).
const CAP_SIZE_EPSILON = 0.5;
const useCapSizeEffect = (capRefs) => {
  useLayoutEffect(() => {
    const sizeWritten = new WeakMap();
    const syncCapSize = (capElement) => {
      const { height } = capElement.getBoundingClientRect();
      const previousHeight = sizeWritten.get(capElement);
      if (
        previousHeight !== undefined &&
        Math.abs(previousHeight - height) < CAP_SIZE_EPSILON
      ) {
        return;
      }
      sizeWritten.set(capElement, height);
      capElement.style.setProperty(
        "--navi-control-swap-cap-size",
        `${height}px`,
      );
    };
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        syncCapSize(entry.target);
      }
    });
    for (const capRef of capRefs) {
      const capElement = capRef.current;
      syncCapSize(capElement);
      resizeObserver.observe(capElement);
    }
    return () => {
      resizeObserver.disconnect();
    };
  }, []);
};
