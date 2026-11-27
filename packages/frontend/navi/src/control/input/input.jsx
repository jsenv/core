import { InputCheckbox } from "./input_checkbox.jsx";
import {
  InputIconSlot,
  InputLeftSlot,
  InputRightSlot,
  InputUnitSlot,
} from "./input_components.jsx";
import { InputRadio } from "./input_radio.jsx";
import { InputRange } from "./input_range.jsx";
import { InputTextual } from "./input_textual.jsx";
import { resolveInputProps } from "./resolve_input_props.js";

/**
 * @type {import("preact").FunctionComponent<{
 *   type?: string,
 *   icon?: import("preact").ComponentChildren | null,
 *   clearable?: boolean,
 *   value?: any,
 *   signal?: import("@preact/signals").Signal,
 *   defaultValue?: any,
 *   action?: Function | object,
 *   actionEvent?: "change" | "mousedown" | "custom",
 *   actionDebounce?: number,
 *   uiAction?: (value: any, event: Event) => void,
 *   optimistic?: boolean,
 *   resetOnError?: boolean,
 *   resetOnAbort?: boolean,
 *   resetOnCancel?: boolean,
 *   onCancel?: (event: Event, reason: "escape_key" | "blur_invalid") => void,
 *   cancelOnEscape?: boolean,
 *   cancelOnBlurInvalid?: boolean,
 *   standalone?: boolean,
 *   boolean?: boolean,
 *   selectOnPress?: boolean,
 *   enterSendsNothing?: boolean,
 *   pressHeight?: number | string,
 *   variant?: "checkbox" | "switch" | "icon" | "button",
 *   buttonVariant?: "discrete",
 *   actionVerb?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
 *   [key: string]: any,
 * }>}
 * @param {any} [value] On a checkbox, what it is worth checked (`"on"` when
 *   left out); unchecked it is `undefined`. See control_value.md, "What a
 *   checkbox is worth".
 * @param {boolean} [boolean] Makes a checkbox a yes/no: `true` checked, `false`
 *   unchecked, everywhere it hands its value. Takes no `value`.
 * @param {import("@preact/signals").Signal} [signal] Binds the value both ways:
 *   the field writes it, and writing it moves the field. A `stateSignal` also
 *   brings its type, bounds and default (docs/control_value.md).
 * @param {any} [defaultValue] Where the field starts, and where `--navi-reset`
 *   takes it back; a new one is followed while the field holds no edit.
 * @param {Function|object} [action] Runs with the value as it changes — in a
 *   textual field, at every keystroke unless `actionEvent="change"` or
 *   `actionDebounce` says otherwise. While it runs the field is busy, so
 *   read-only unless `optimistic`; a failure is drawn on it (docs/actions.md,
 *   "`action` or `uiAction`"). A request that follows typing, like
 *   suggestions, is a binding rather than the field's action.
 * @param {"change"|"mousedown"|"custom"} [actionEvent] When `action` runs:
 *   `"change"` at Enter or once the field is left holding a new value,
 *   `"mousedown"` at the press rather than its release, `"custom"` never by
 *   itself. Left out, at every change of the value.
 * @param {number} [actionDebounce] For a textual field: how long, in
 *   milliseconds, the value must stay still before `action` runs.
 * @param {Function} [uiAction] Told every value the field takes, whoever moved
 *   it; for what moves along with the value and cannot fail.
 * @param {boolean} [optimistic] The field stays interactive while its action
 *   runs, and wears `data-optimistic`: a newer value calls the running one off
 *   and goes out once it settled, so the latest wins.
 * @param {boolean} [resetOnError] A refused run puts back the last value
 *   accepted. On by default for a checkbox and a radio; a textual field keeps
 *   what was typed.
 * @param {boolean} [resetOnAbort] The same for a run called off, unless a newer
 *   value replaced it. On by default for a checkbox and a radio.
 * @param {boolean} [resetOnCancel] Escape puts back the last value accepted. On
 *   by default for a checkbox and a radio.
 * @param {Function} [onCancel] Told `(event, reason)` when the person gives up
 *   on what they typed: `"escape_key"` under `cancelOnEscape` or
 *   `resetOnCancel`, `"blur_invalid"` (leaving the field holding a refused
 *   value) under `cancelOnBlurInvalid`. What giving up does is the caller's:
 *   `Editable` ends its edition there.
 * @param {boolean} [standalone] The field answers for itself: not part of the
 *   value of the form or group around it, nor of its reset or validation.
 * @param {"checkbox"|"switch"|"icon"|"button"} [variant] How a checkbox is
 *   drawn. `"button"` is a button that stays pressed — a mode ("Edit" /
 *   "Done"), show/hide, a setting: its children are its words and its
 *   accessible name, filled with the accent while checked; without children it
 *   is a square around its checkmark (or its `icon`, which takes an
 *   `[off, on]` pair). Bound with `signal`, it follows whatever else writes
 *   that signal.
 * @param {"discrete"} [buttonVariant] A checkbox drawn as a button, drawn as
 *   that variant of `Button`: `"discrete"` has no box at rest and a wash on
 *   hover (checked, its words still fill with the accent). Implies
 *   `variant="button"`.
 * @param {"GET"|"POST"|"PUT"|"PATCH"|"DELETE"} [actionVerb] What a plain
 *   function `action` does to the server. A write verb puts the field under
 *   the network policy: held read-only up front, with the policy's message,
 *   instead of failing after the change (docs/network_policy.md). An action
 *   bound to a resource verb says it already.
 * @param {import("preact").ComponentChildren|null} [icon] What the textual
 *   types that draw an icon (`search`, `email`, `tel`) put in their slot: left
 *   out, the type's own glyph; `null`, nothing — for a field an application
 *   draws its own magnifier beside, where a second one two centimetres away
 *   would be one too many; anything else is drawn instead. A `search` field
 *   swaps that slot for the clear cross as soon as it holds a value, whatever
 *   this says.
 * @param {boolean} [clearable] Gives any other type the same slot: the icon
 *   while empty (none, unless `icon` says otherwise), the clear cross once
 *   filled.
 * @param {boolean} [selectOnPress] For a textual field whose value is usually
 *   replaced rather than edited, like a browser's address bar: the first press
 *   after the field took the focus selects its whole text once released, with a
 *   mouse or a finger, and a second press places the caret. A focus that came
 *   without a press (a dialog opening, Tab, code) selects nothing; the first key
 *   that types selects first, so it replaces the text.
 * @param {boolean} [enterSendsNothing] Enter in this textual field sends
 *   nothing. By default Enter sends the group around the field — the form, the
 *   picker whose popup holds it —, `standalone` or not, the way Enter submits
 *   an HTML form; this is for a field that only helps find the answer (a
 *   street before its suggestion filled the city) and whose Enter would send
 *   an answer still missing its other half. The browser's own Enter is kept (a
 *   datalist choice), except in a `<Form>`, where it is the submission.
 * @param {number|string} [pressHeight] How tall a press counts on a range, the
 *   thumb's height by default, so a thin line stays easy to hit. The press area
 *   only: nothing moves and nothing is drawn. It overflows the range, centered
 *   on its line, over whatever is next to it and takes the presses aimed there,
 *   so leave it the room it needs (`marginY`). Different for a mouse and a
 *   finger: `--press-height` in a `@media (pointer: coarse)` rule. On Safari for
 *   iOS a drag only starts close to the thumb, within three times its width; a
 *   tap further along the line moves the value.
 */
export const Input = (props) => {
  resolveInputProps(props);

  const { type } = props;
  if (type === "radio") {
    return <InputRadio {...props} />;
  }
  if (type === "checkbox") {
    return <InputCheckbox {...props} />;
  }
  if (type === "range") {
    return <InputRange {...props} />;
  }
  return <InputTextual {...props} />;
};

/**
 * What an application puts inside the field's own box, beside the text: a
 * button, a unit, an icon of its own. Passed as `ui` — the slots place
 * themselves, the field keeps the room they take.
 *
 * They label the input, so a press lands on the field rather than blurring it —
 * except when the field is not focused yet, where the slot may take the focus
 * itself (a clear cross, a reveal-password eye). `IconSlot` sizes what it holds
 * on the line rather than on a character; `UnitSlot` keeps its text on one
 * line.
 */
Input.UI = {
  LeftSlot: InputLeftSlot,
  RightSlot: InputRightSlot,
  IconSlot: InputIconSlot,
  UnitSlot: InputUnitSlot,
};
