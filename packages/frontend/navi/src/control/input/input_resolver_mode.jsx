import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";

export const InputModeResolver = (props) => {
  const Next = useNextResolver();

  if (props.inputMode === "numeric") {
    return <InputModeNumeric {...props} />;
  }
  return <Next {...props} />;
};

const InputModeNumeric = (props) => {
  const Next = useNextResolver();

  const { max } = props;
  let maxLength;
  if (max !== undefined) {
    const digitCount = String(Math.floor(max)).length;
    maxLength = digitCount;
  }

  return (
    <Next
      maxLength={maxLength}
      {...props}
      onKeyDown={(e) => {
        props.onKeyDown?.(e);
        if (e.defaultPrevented) {
          return;
        }
        // This could be something to move to constraint and that could display the callout
        // Allow: digits, backspace, delete, tab, escape, enter, arrows, home, end
        const isDigit = e.key >= "0" && e.key <= "9";
        const isControlKey =
          e.key === "Backspace" ||
          e.key === "Delete" ||
          e.key === "Tab" ||
          e.key === "Escape" ||
          e.key === "Enter" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "Home" ||
          e.key === "End";
        const isModified = e.ctrlKey || e.metaKey || e.altKey;
        if (!isDigit && !isControlKey && !isModified) {
          e.preventDefault();
        }
      }}
    />
  );
};
