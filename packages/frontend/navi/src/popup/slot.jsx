import { signal } from "@preact/signals";
import { useLayoutEffect } from "preact/hooks";

import { Box } from "../box/box.jsx";

/**
 * Creates a linked `[Slot, SlotFill]` pair so content rendered anywhere in
 * the tree (`SlotFill`) appears at a fixed location elsewhere (`Slot`) — a
 * lightweight, signal-based alternative to a DOM portal: `SlotFill` itself
 * renders nothing (no extra DOM node at its own call site), it just writes
 * its props into a shared signal that `Slot` reads reactively.
 *
 * Holds at most one filler at a time — there is no stacking/queueing.
 * Mounting a second `SlotFill` (from this same `createSlot()` call)
 * overwrites whatever the previous one set; `Slot` renders `null` once the
 * mounted `SlotFill` unmounts (its own cleanup clears the shared signal).
 *
 * @param {import("preact").ComponentType} [SlotRenderer=Box] - Rendered by
 *   `Slot` with whatever props `SlotFill` last set. Swap this out to reuse
 *   the same slot mechanism for something other than a plain `Box` (e.g. a
 *   specific component expecting its own particular props).
 * @returns {[import("preact").ComponentType, import("preact").ComponentType<object>, () => boolean]}
 *   `[Slot, SlotFill, useSlotFilled]` — `Slot` takes no props, render it
 *   once wherever the content should appear. `SlotFill` takes whatever
 *   props `SlotRenderer` expects, render it anywhere else in the tree to
 *   supply/update that content. `useSlotFilled()` reactively reports
 *   whether a `SlotFill` is currently mounted — for a persistent wrapper
 *   around `<Slot/>` that needs to stay mounted itself (e.g. a `SidePanel`
 *   that should actually animate open/closed instead of being
 *   mounted/unmounted alongside the filler — see slot_demo.html's own
 *   "two side panels" section), since `Slot` unmounting `SlotRenderer`
 *   whenever it's unfilled means the wrapper can't rely on `<Slot/>`'s own
 *   presence for that.
 */
export const createSlot = (SlotRenderer = Box) => {
  const slotPropsSignal = signal();

  const Slot = () => {
    const props = slotPropsSignal.value;
    if (!props) {
      return null;
    }
    return <SlotRenderer {...props} />;
  };

  const SlotFill = (props) => {
    slotPropsSignal.value = props;
    useLayoutEffect(() => {
      return () => {
        slotPropsSignal.value = null;
      };
    }, []);

    return null;
  };

  const useSlotFilled = () => Boolean(slotPropsSignal.value);

  return [Slot, SlotFill, useSlotFilled];
};
