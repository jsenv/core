/**
 * Edition in place: a value is read where it is written, and the field editing
 * it is drawn exactly on that spot.
 *
 * The read text stays in the DOM the whole time and the field is laid over it,
 * in absolute. That is what keeps the layout still: the text is what gives the
 * box its size (a table cell especially, whose width belongs to the whole
 * column), so taking it away would resize the box the moment one starts
 * editing. The field is there at all times too — inert and transparent until
 * edition starts — so appearing costs no mount.
 *
 * Being absolute, the field lands on the closest positioned ancestor. What it
 * takes for it to land ON the text and not merely near it is the contract
 * described on `Editable` below.
 */

import { getBorderSizes } from "@jsenv/dom";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { Input } from "../input/input.jsx";
import { Textarea } from "../input/textarea.jsx";

const css = /* css */ `
  .navi_editable_wrapper {
    --inset-top: 0px;
    --inset-right: 0px;
    --inset-bottom: 0px;
    --inset-left: 0px;

    position: absolute;
    top: var(--inset-top);
    right: var(--inset-right);
    bottom: var(--inset-bottom);
    left: var(--inset-left);
    opacity: 0;
    pointer-events: none;

    /* The field takes the place of the text, so the text is what decides how
       it is drawn — a control's own font (its size and family come from
       --navi-control-*) would make the value change size the moment one edits
       it. Unlayered, so it wins over the control's own sheet. */
    .navi_input {
      font-size: inherit;
      font-family: inherit;
    }
    input,
    textarea {
      font-weight: inherit;
      font-size: inherit;
      font-family: inherit;
      text-align: inherit;
      line-height: inherit;
    }

    &[data-editing] {
      opacity: 1;
      pointer-events: auto;
    }
  }
`;

/**
 * The state of "this thing is being edited", to hand to `Editable`.
 *
 * `startEditing` takes the event that asked for edition; `Editable` reads
 * `event.detail.initialValue` from it and types it into the field as a first
 * keystroke, which is how a table starts editing on a letter key instead of
 * losing that letter.
 */
export const useEditionController = () => {
  const [editing, editingSetter] = useState(null);
  const startEditing = useCallback((event) => {
    editingSetter((current) => {
      return current || { event };
    });
  }, []);
  const stopEditing = useCallback(() => {
    editingSetter(null);
  }, []);

  const prevEditingRef = useRef(editing);
  const editionJustEnded = prevEditingRef.current && !editing;
  prevEditingRef.current = editing;

  return { editing, startEditing, stopEditing, editionJustEnded };
};

/**
 * The value written in place, with the field that edits it drawn exactly over
 * it: same first character, same font, same box.
 *
 * `Editable` renders the text (`children`, or `value` in a `<span>`) and, next
 * to it, an absolutely positioned field. Landing that field on the text is a
 * contract with the element around it:
 *
 * 1. **That element must be positioned** (`position: relative`) and must be the
 *    one drawing the text. The field is absolute: it goes to the closest
 *    positioned ancestor, so `Editable` belongs where the text is, never lifted
 *    out of it.
 * 2. **The text must start at the same place in both.** The field is pulled out
 *    over the parent's border (its insets are the parent's border sizes,
 *    negated) so it covers the parent's border box; from there, the field's own
 *    border + padding must add up to the parent's border + padding, or the
 *    first character moves by the difference. The way to say it is to repeat
 *    both on `Editable` — `paddingLeft`, `paddingTop`, `borderWidth`, plus
 *    `borderRadius` so the corners fall on the parent's. A parent that paints
 *    no border of its own (a table cell drawing its grid with a pseudo-element)
 *    needs `borderWidth="0"` here, otherwise the control's default border eats
 *    into the text.
 * 3. **The field must fill that box**: `width="100%"` (or `expandX`), and
 *    `height="100%"` when the text sits in a box taller than a line. Horizontal
 *    placement comes from the inherited `text-align`, and an inherited
 *    alignment only means something in a box spanning the whole width.
 *
 * The font is not part of the contract: family, size, weight, line height and
 * alignment are inherited from the text, so the value keeps its own appearance
 * while being edited. Declaring one here is how a value changes size the moment
 * one edits it.
 *
 * For reference, both ways of holding up that end: `Table`'s editable cells do
 * it in CSS (the `[data-editing] input` rules in `control/table/table_css.js`),
 * the demo `control/demos/action/8_editable_demo.html` does it with props.
 *
 * @type {import("preact").FunctionComponent<{
 *   children?: import("preact").ComponentChildren,
 *   action: Function | object,
 *   editing?: { event?: Event } | null,
 *   onEditEnd?: (detail: { success?: boolean, cancelled?: boolean, event: Event }) => void,
 *   name?: string,
 *   value?: any,
 *   valueSignal?: import("@preact/signals").Signal,
 *   constraints?: any,
 *   type?: string,
 *   multiline?: boolean,
 *   minRows?: number,
 *   maxRows?: number,
 *   required?: boolean,
 *   readOnly?: boolean,
 *   min?: number | string,
 *   max?: number | string,
 *   step?: number | string,
 *   minLength?: number,
 *   maxLength?: number,
 *   pattern?: string,
 *   wrapperProps?: object,
 *   autoFocusSelect?: boolean,
 *   width?: string | number,
 *   height?: string | number,
 *   [key: string]: any,
 * }>}
 *
 * @param {Function|object} action
 *   What saves the value; it receives what was typed. Edition ends on its
 *   success, and a failure keeps the field open with what the user wrote.
 *
 * @param {{ event?: Event }|null} [editing]
 *   Whether the field is open, and what asked for it — the object
 *   `useEditionController` holds. Anything falsy leaves the text alone.
 *
 * @param {Function} [onEditEnd]
 *   Called once edition is over, whichever way it went: `success` after the
 *   action, `cancelled` on Escape, on a blur that changed nothing, or on a blur
 *   leaving an invalid value.
 *
 * @param {import("@preact/signals").Signal} [valueSignal]
 *   The value as a signal, when what is typed must be readable live by the rest
 *   of the page. It is written as the user types and restored to what it was on
 *   cancel; `value` alone is enough for the ordinary case.
 *
 * @param {boolean} [multiline]
 *   Swaps the field for a `Textarea` — the same edition in place, for a value
 *   written on several lines (a message, a description). Enter then makes a
 *   line instead of validating: what is typed is saved when the field is left,
 *   and Escape gives up on it. `minRows` / `maxRows` bound its height; the props
 *   only an `<input>` understands (`type`, `min`, `max`, `step`, `pattern`) are
 *   dropped.
 *
 * @param {boolean} [autoFocusSelect=true]
 *   Selects the whole value when the field opens, so typing replaces it. Turn
 *   it off to have the caret land in a value one comes to amend.
 *
 * @param {object} [wrapperProps]
 *   Props for the absolutely positioned wrapper around the field, for the rare
 *   case where its own box needs a say (a stacking context, an inset to nudge).
 *   Every other unknown prop goes to the field itself, styling props included.
 */
export const Editable = (props) => {
  import.meta.css = css;
  let {
    children,
    action,
    editing,
    name,
    value,
    valueSignal,
    onEditEnd,
    constraints,
    type,
    multiline,
    minRows,
    maxRows,
    required,
    readOnly,
    min,
    max,
    step,
    minLength,
    maxLength,
    pattern,
    wrapperProps,
    autoFocusSelect = true,
    width,
    height,
    ...rest
  } = props;
  if (import.meta.dev && !action) {
    console.warn(`Editable requires an action prop`);
  }
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;

  if (valueSignal) {
    value = valueSignal.value;
  }

  const editingPreviousRef = useRef(editing);
  const valueWhenEditStartRef = useRef(editing ? value : undefined);
  if (editingPreviousRef.current !== editing) {
    if (editing) {
      valueWhenEditStartRef.current = value; // Always store the external value
    }
    editingPreviousRef.current = editing;
  }

  // Simulate typing the initial value when editing starts with a custom value
  useLayoutEffect(() => {
    if (!editing) {
      return;
    }
    const editingEvent = editing.event;
    if (editingEvent) {
      const editingEventInitialValue = editingEvent.detail?.initialValue;
      if (editingEventInitialValue !== undefined) {
        const input = ref.current;
        input.value = editingEventInitialValue;
        input.dispatchEvent(
          new CustomEvent("input", {
            bubbles: false,
          }),
        );
      }
    }
  }, [editing]);

  const controlProps = {
    ref,
    ...rest,
    name,
    value,
    valueSignal,
    autoFocus: editing,
    autoFocusVisible: true,
    autoFocusSelect,
    cancelOnEscape: true,
    cancelOnBlurInvalid: true,
    constraints,
    required,
    readOnly,
    minLength,
    maxLength,
    width,
    height,
    onCancel: (e) => {
      if (valueSignal) {
        valueSignal.value = valueWhenEditStartRef.current;
      }
      onEditEnd({
        cancelled: true,
        event: e,
      });
    },
    onBlur: (e) => {
      let inputValue;
      const valueWhenEditStart = valueWhenEditStartRef.current;
      let inputValueWhenEditStart;
      if (type === "number") {
        inputValue = e.target.valueAsNumber;
        inputValueWhenEditStart = valueWhenEditStart;
      } else {
        inputValue = e.target.value;
        inputValueWhenEditStart = Number.isNaN(valueWhenEditStart)
          ? valueWhenEditStart
          : String(valueWhenEditStart);
      }
      if (inputValue === inputValueWhenEditStart) {
        onEditEnd({
          cancelled: true,
          event: e,
        });
        return;
      }
    },
    action: action || (() => {}),
    actionAfterChange: true,
    onActionEnd: (e) => {
      onEditEnd({
        success: true,
        event: e,
      });
    },
  };
  // What is typed on several lines goes into a textarea; the props that only
  // mean something to an <input> (its type and the bounds that come with it)
  // stay on that side.
  const control = multiline ? (
    <Textarea {...controlProps} minRows={minRows} maxRows={maxRows} />
  ) : (
    <Input
      {...controlProps}
      type={type}
      min={min}
      max={max}
      step={step}
      pattern={pattern}
    />
  );

  const wrapperRef = useRef();
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }
    const parent = wrapper.parentElement;
    const borderSizes = getBorderSizes(parent);

    wrapper.style.setProperty("--inset-left", `-${borderSizes.left}px`);
    wrapper.style.setProperty("--inset-top", `-${borderSizes.top}px`);
    wrapper.style.setProperty("--inset-right", `-${borderSizes.right}px`);
    wrapper.style.setProperty("--inset-bottom", `-${borderSizes.bottom}px`);
  });

  return (
    <>
      {children || <span>{value}</span>}
      <Box
        className="navi_editable_wrapper"
        ref={wrapperRef}
        {...wrapperProps}
        // inert ensure input while not editing that:
        // - input not focusable (via keyboard or anything)
        // - cannot be interacted with pointer (click, hover, etc)
        // - is ignored by screen readers
        inert={editing ? undefined : ""}
        data-editing={editing ? "" : undefined}
      >
        {control}
      </Box>
    </>
  );
};
