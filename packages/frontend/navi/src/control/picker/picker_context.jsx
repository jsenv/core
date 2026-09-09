import { createContext } from "preact";
import { useContext } from "preact/hooks";

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

/**
 * What the picker holds, read from inside its `ui` — for a drawing given as
 * an element (`ui={<MyCard game={game} />}`), which the picker cannot hand
 * props to. `value` is the state the picker holds right now: the answer the
 * popup just closed on, before the server has said anything, and put back if
 * the action fails. `loading` is the run in flight; `interactive` is false
 * while the picker is disabled, read-only or busy.
 *
 * @returns {{ value: any, loading: boolean, interactive: boolean } | null}
 *   null outside a picker.
 */
export const usePickerState = () => {
  const context = useContext(PickerContext);
  if (!context) {
    return null;
  }
  const { value, loading, interactive } = context;
  return { value, loading, interactive };
};
