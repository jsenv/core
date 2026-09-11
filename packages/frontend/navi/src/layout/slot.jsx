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
 * render, and only that one empties the slot by unmounting: two fillers
 * crossing — the next card's fill mounted by the render that unmounts the
 * previous card's — run the newcomer's render before the leaver's cleanup,
 * and the leaver finds the slot belongs to someone else.
 *
 * `Slot` keeps `SlotRenderer` mounted permanently — even while unfilled it
 * still renders it, with no props and `isFilled={false}` — instead of
 * unmounting it. This lets `SlotRenderer` be a persistent wrapper that
 * reacts to `isFilled` itself (e.g. a `SidePanel` deriving its `open`
 * prop from it, so open/close actually animate instead of the panel being
 * mounted/unmounted alongside the filler — see 7_slot_demo.html's "two side
 * panels" section). A `SlotRenderer` that wants the old
 * render-nothing-when-unfilled behavior can opt back in with its own
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
