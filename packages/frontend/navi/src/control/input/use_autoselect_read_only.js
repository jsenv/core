// When readonly focus and mousedown should select input content
// (the only relevant interaction to perform on readonly is copying the value)
// Nice side effect is that input_group.jsx will see all input is selected
// and arrow left/right will always nav between inputs.
// (Otherwise we would prevent left/right + show calllout about readonly)
export const useAutoSelectReadOnly = (props) => {
  const onFocus = (e) => {
    props.onFocus(e);
    if (e.defaultPrevented) {
      return;
    }
    if (!e.target.readOnly) {
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
    e.preventDefault();
    e.target.select();
  };

  return { onFocus, onMouseDown };
};
