import { signal } from "@preact/signals";
import { useLayoutEffect } from "preact/hooks";

import { Box } from "../box/box.jsx";

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

  return [Slot, SlotFill];
};
