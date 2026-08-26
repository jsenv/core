import { createContext } from "preact";

// Put around its children by BadgeList so a Badge below knows it is inside one.
// A badge then no longer decides on its own that it renders: it takes a slot
// from the list as it renders — badges render in tree order, so the slots come
// out in source order — and the list caps how many it hands out, turning the
// rest into a single "+N" badge. This is what lets the list count and cap its
// badges without walking the children vnodes.
export const BadgeListContext = createContext(null);

export const createBadgeSlotRegistry = () => {
  let pass = 0;
  let count = 0;
  let limit = Infinity;

  return {
    // Called by BadgeList at the top of every render, before the badges below
    // take their slots again.
    startPass: (passLimit) => {
      pass++;
      count = 0;
      limit = passLimit;
    },
    // slotState is the badge's own memory. A badge that re-renders on its own
    // (a signal it reads changed) must not be counted twice, so within a pass
    // it keeps the slot it already took.
    claimSlot: (slotState) => {
      if (slotState.pass !== pass) {
        slotState.pass = pass;
        slotState.index = count;
        count++;
      }
      return slotState.index < limit;
    },
    getCount: () => count,
  };
};
