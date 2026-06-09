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

  return <Next maxLength={maxLength} {...props} />;
};
