import { createContext } from "preact";

// Put around its children by BadgeList so a Badge below knows it is inside one.
// A badge then renders nothing at all: it hands its props to the list and the
// list renders it. Badges register in tree order, so by the time the list gets
// to its own content it holds them all, in source order, and knows how many
// there are before deciding what to show — without ever walking children
// vnodes, and without rendering a badge it then has to take back.
export const BadgeListContext = createContext(null);

export const createBadgeRegistry = () => {
  let pass = 0;
  let passCount = 0;
  let entries = [];
  let childrenAreNew = true;

  return {
    // Called by BadgeList at the top of every render. childrenAreNew says
    // whether it was handed fresh children vnodes: when it re-renders on its
    // own (its own state changed) Preact hands the untouched children straight
    // back and skips them, so none of the badges registers again. That empty
    // pass means "unchanged", not "no badge left" — see getEntries.
    startPass: (areNew) => {
      pass++;
      passCount = 0;
      childrenAreNew = areNew;
    },
    // entryState is the badge's own memory. A badge that re-renders on its own
    // must update its entry, not append a second one.
    register: (entryState, props) => {
      if (entryState.pass !== pass) {
        entryState.pass = pass;
        entryState.index = passCount;
        passCount++;
      }
      entries[entryState.index] = props;
    },
    getEntries: () => {
      if (passCount === 0 && !childrenAreNew) {
        return entries;
      }
      entries.length = passCount;
      return entries;
    },
  };
};
