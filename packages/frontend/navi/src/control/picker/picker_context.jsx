import { createContext } from "preact";
import { useContext, useLayoutEffect } from "preact/hooks";

export const PickerContext = createContext();

/*
 * The picker's context, for whatever draws its value. A picker told no value
 * holds what the control in its popup holds, and builds that popup only when
 * something reads it (see the mount decision in picker_custom.jsx): what the
 * picker draws itself it knows about, a drawing given as an element is the
 * caller's, and says so here by reading. In a layout effect, so the frame that
 * first shows the drawing already shows the value.
 */
export const usePickerContext = () => {
  const context = useContext(PickerContext);
  const requestValue = context?.requestValue;
  useLayoutEffect(() => {
    requestValue?.();
  }, [requestValue]);
  return context;
};

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

/*
 * What the picker really is, said on the element that holds the name and takes
 * the focus (the host input in picker.jsx): a picker that picks nothing is a
 * door — its popup is a question (type="confirm") or something to read
 * (mode="callout", which says it for itself) — and a door is pressed. So it
 * answers to "button" rather than to the "textbox" its <input> would otherwise
 * be, which is both what a screen reader announces and what
 * getByRole("button", { name }) finds. A picker holding a value stays a
 * textbox: it does hold text.
 */
export const getPickerHostRole = ({ role, picksNothing }) => {
  return role ?? (picksNothing ? "button" : undefined);
};

/*
 * And what that button is called, when the caller wrote it as a drawing rather
 * than as a word: a door draws no value, so what sits in its value slot IS its
 * label — the `ui` a caller gave it, or its placeholder. Undefined the moment
 * the caller names it themselves (aria-label/aria-labelledby), which is the
 * only way to name a door drawn as an icon. Read by the popup too: what the
 * user pressed is a fair name for what it opened.
 */
export const getPickerHostLabelId = (id, props) => {
  if (getPickerHostRole(props) !== "button") {
    return undefined;
  }
  if (
    props["aria-label"] !== undefined ||
    props["aria-labelledby"] !== undefined
  ) {
    return undefined;
  }
  if (props.variant === "headless" || props.ui === "default") {
    return undefined;
  }
  return `${id}_picker_label`;
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
  const context = usePickerContext();
  if (!context) {
    return null;
  }
  const { value, loading, interactive } = context;
  return { value, loading, interactive };
};
