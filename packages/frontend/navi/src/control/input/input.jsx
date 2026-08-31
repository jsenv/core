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
 *   [key: string]: any,
 * }>}
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
