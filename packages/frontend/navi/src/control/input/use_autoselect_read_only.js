import { useRef } from "preact/hooks";

// When readonly focus and mousedown should select input content
// (the only relevant interaction to perform on readonly is copying the value)
// Nice side effect is that input_group.jsx will see all input is selected
// and arrow left/right will always nav between inputs.
// (Otherwise we would prevent left/right + show calllout about readonly)
//
// Not on touch: .select() there triggers the native mobile text-selection UI
// (handles + magnifier), which makes no sense for a picker (opens a
// popover/dialog on tap, not meant for text selection) and isn't wanted on a
// plain readonly text input either. onPointerDown tracks the pointer type
// that initiated the interaction (same convention as button_ui.jsx's own
// `e.pointerType !== "touch"` check) so the focus handler — which fires
// right after, but as a plain FocusEvent with no pointerType of its own —
// can also skip select() for that same interaction.
export const useAutoSelectReadOnly = (props) => {
  const lastPointerTypeRef = useRef(null);
  const onPointerDown = (e) => {
    props.onPointerDown?.(e);
    lastPointerTypeRef.current = e.pointerType;
  };
  const onFocus = (e) => {
    props.onFocus(e);
    if (e.defaultPrevented) {
      return;
    }
    if (!e.target.readOnly) {
      return;
    }
    if (lastPointerTypeRef.current === "touch") {
      return;
    }
    e.preventDefault();
    e.target.select();
  };
  const onMouseDown = (e) => {
    props.onMouseDown(e);
    if (e.defaultPrevented) {
      return;
    }
    if (!e.target.readOnly) {
      return;
    }
    if (lastPointerTypeRef.current === "touch") {
      return;
    }
    e.preventDefault();
    e.target.select();
  };

  return { onFocus, onMouseDown, onPointerDown };
};
