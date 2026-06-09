import { triggerStringAction } from "@jsenv/navi/src/control/string_actions.js";
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

  const { min, max, step = 1 } = props;
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
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
          return;
        }
        e.preventDefault();
        const currentValue = Number(e.currentTarget.value);
        if (Number.isNaN(currentValue)) {
          return;
        }
        const delta = e.key === "ArrowUp" ? step : -step;
        let nextValue = currentValue + delta;
        if (min !== undefined && nextValue < min) {
          nextValue = min;
        }
        if (max !== undefined && nextValue > max) {
          nextValue = max;
        }
        triggerStringAction("update", nextValue, {
          event: e,
          actionTarget: e.currentTarget,
        });
      }}
    />
  );
};
