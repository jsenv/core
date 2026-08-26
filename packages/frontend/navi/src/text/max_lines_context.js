import { createContext } from "preact";

// How many lines the thing around a component gives it, when that thing caps
// its own height and cannot cap what it holds.
//
// A <Picker> is the case it exists for: its value is clamped with maxLines,
// which is CSS line-clamp — it counts line boxes of inline text and has no idea
// what a wrapped flex row is. So a <BadgeList> rendered as a picker's ui reads
// the number from here and caps its own rows to it, and the picker turns its
// own clamp off (see .navi_picker_value:has(.navi_badge_list) in picker.jsx).
export const MaxLinesContext = createContext(undefined);
