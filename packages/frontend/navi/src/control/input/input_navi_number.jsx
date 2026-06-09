import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";

export const InputNaviNumberResolver = (props) => {
  const Next = useNextResolver();

  let maxLength;
  if (props.max !== undefined) {
    const digitCount = String(Math.floor(props.max)).length;
    maxLength = digitCount;
  }

  return <Next maxLength={maxLength} {...props} />;
};
