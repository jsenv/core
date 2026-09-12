import { signal } from "@preact/signals";
import { useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";

/**
 * Creates a linked `[Slot, SlotFill]` pair so content rendered anywhere in
 * the tree (`SlotFill`) appears at a fixed location elsewhere (`Slot`) — a
 * lightweight, signal-based alternative to a DOM portal: `SlotFill` itself
 * renders nothing (no extra DOM node at its own call site), it just writes
 * its props into a shared signal that `Slot` reads reactively.
 *
 * Holds at most one filler at a time — there is no stacking/queueing. The
 * filler is the last `SlotFill` (from this same `createSlot()` call) to
 * render; a `SlotFill` unmounting empties the slot only while it is still
 * that one.
 *
 * **One `SlotFill`, rendered where the choice is made.** `isFilled` follows
 * the fills as they mount and unmount, in the order the tree walks them. A
 * slot fed from several places — a `SlotFill` in each card of a board, each
 * card deciding on its own whether it is the open one — reads as empty
 * between the leaver and the newcomer whenever they render separately, and
 * anything acting on `isFilled` acts on that empty frame (a `SidePanel` with
 * `open={isFilled}` closes for good: its `onClose` clears the state the
 * newcomer was waiting for). The slot cannot tell that gap from a real
 * emptying, and does not try to: render one `SlotFill` at the level that
 * holds the choice, with the chosen content as its children, and bind a
 * state that must not blink (a panel's `open`) to the app's own signal
 * rather than to `isFilled` — see docs/popup_open.md, "One panel, fed by a
 * slot".
 *
 * `Slot` keeps `SlotRenderer` mounted permanently — even while unfilled it
 * still renders it, with no props and `isFilled={false}` — instead of
 * unmounting it. This lets `SlotRenderer` be a persistent wrapper (a
 * `SidePanel` that opens and closes with an animation instead of being
 * mounted/unmounted alongside the filler — see 7_slot_demo.html's "two side
 * panels" section). A `SlotRenderer` that wants the
 * render-nothing-when-unfilled behavior can opt in with its own
 * `if (!isFilled) return null;` (the default `Box` renderer doesn't do
 * this — an unfilled default slot just renders an empty `<Box/>`).
 *
 * @param {import("preact").ComponentType} [SlotRenderer=Box] - Rendered by
 *   `Slot`, always, with whatever props `SlotFill` last set (spread
 *   directly) plus `isFilled`. Swap this out to reuse the same slot
 *   mechanism for something other than a plain `Box` (e.g. a specific
 *   component expecting its own particular props, or a persistent wrapper
 *   like `SidePanel`).
 * @returns {[import("preact").ComponentType, import("preact").ComponentType<object>]}
 *   `[Slot, SlotFill]` — `Slot` takes no props, render it once wherever the
 *   content should appear. `SlotFill` takes whatever props `SlotRenderer`
 *   expects, render it anywhere else in the tree to supply/update that
 *   content.
 */
export const createSlot = (SlotRenderer = Box) => {
  const slotPropsSignal = signal();
  let filler = null;

  const Slot = () => {
    const props = slotPropsSignal.value;
    return <SlotRenderer {...props} isFilled={Boolean(props)} />;
  };

  const SlotFill = (props) => {
    const fillerRef = useRef();
    filler = fillerRef;
    slotPropsSignal.value = props;
    useLayoutEffect(() => {
      return () => {
        // Within one diff preact mounts the newcomer before unmounting the
        // leaver, so the leaver may no longer be the filler by the time it
        // is cleaned up.
        if (filler !== fillerRef) {
          return;
        }
        filler = null;
        slotPropsSignal.value = null;
      };
    }, []);

    return null;
  };

  return [Slot, SlotFill];
};
