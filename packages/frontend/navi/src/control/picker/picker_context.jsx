import { createContext } from "preact";

export const PickerContext = createContext();

/*
 * A typed picker (`type="date"`, `type="array"`, …) draws its value with a ui
 * of navi's own, installed as the very "ui" prop a caller overrides to draw
 * that value themselves. Marking navi's own tells the two apart afterwards:
 * an empty value is greyed as a placeholder only when the drawing is navi's —
 * a caller's ui may well be their way of writing "no filter", which is an
 * answer, not a blank (see navi-placeholder in picker.jsx).
 */
export const asPickerOwnUI = (PickerUI) => {
  PickerUI.isPickerOwnUI = true;
  return PickerUI;
};
export const pickerUIIsNaviOwn = (ui) => {
  return (
    Boolean(ui) && typeof ui === "object" && Boolean(ui.type?.isPickerOwnUI)
  );
};
