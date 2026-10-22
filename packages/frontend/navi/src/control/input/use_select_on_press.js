import { getKeyboardEventDefaultAction } from "@jsenv/dom";
import { useRef } from "preact/hooks";

// selectOnPress: a field whose value is usually replaced rather than edited (an
// address, a place to search) behaves like the address bar of a browser. The
// first gesture that engages it after it took the focus selects its whole text,
// so typing replaces it; a second press places the caret, to fix one part.
//
// Engaged by a gesture, never by the focus itself: a dialog opening hands the
// focus to its first field (docs/autofocus.md), and a field selected on focus
// would greet whoever opened the dialog already half-way into an edit. So a
// focus that came without a press waits for the first key that types.
//
// The press selects once it is over, on `click`: the browser places the caret
// on mousedown and may collapse a selection on mouseup, so anything selected
// before the release is undone by it. `mousedown` decides whether a press
// engages because a finger only produces one after a tap — a finger that
// scrolled the page never reaches the field. Touch is included on purpose (see
// use_autoselect_read_only.js for why a read-only field leaves it out): on a
// field meant to be replaced, the native selection handles are expected.
export const useSelectOnPress = (props, selectOnPress) => {
  const engagedRef = useRef(false);
  const pressEngagesRef = useRef(false);

  if (!selectOnPress) {
    return null;
  }
  const onMouseDown = (e) => {
    props.onMouseDown(e);
    if (e.defaultPrevented) {
      return;
    }
    if (e.button !== 0) {
      return;
    }
    pressEngagesRef.current = !engagedRef.current;
    engagedRef.current = true;
  };
  const onClick = (e) => {
    props.onClick(e);
    if (!pressEngagesRef.current) {
      return;
    }
    pressEngagesRef.current = false;
    if (e.defaultPrevented) {
      return;
    }
    const input = e.currentTarget;
    if (input.selectionStart !== input.selectionEnd) {
      // The press dragged across a part of the text: that part is what was meant.
      return;
    }
    input.select();
    // Keep the beginning of the text visible instead of scrolling to the end
    input.scrollLeft = 0;
  };
  const onKeyDown = (e) => {
    if (!engagedRef.current) {
      const defaultAction = getKeyboardEventDefaultAction(e);
      if (defaultAction === "type") {
        engagedRef.current = true;
        // Before the control's own keydown: maxLengthGuard measures the room
        // left against the selection the key is about to replace.
        e.currentTarget.select();
      } else if (defaultAction === "cursor_move") {
        engagedRef.current = true;
      }
    }
    props.onKeyDown(e);
  };
  const onBlur = (e) => {
    props.onBlur(e);
    if (document.activeElement === e.currentTarget) {
      // The window went to the background and the field still holds the focus:
      // coming back is not a new arrival.
      return;
    }
    engagedRef.current = false;
  };

  return { onMouseDown, onClick, onKeyDown, onBlur };
};
