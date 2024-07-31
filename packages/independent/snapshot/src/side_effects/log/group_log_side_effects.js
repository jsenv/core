import { groupSideEffectsPer } from "../utils/group_side_effects.js";

export const groupLogSideEffects = (
  allSideEffects,
  { createLogGroupSideEffect },
) => {
  return groupSideEffectsPer(
    allSideEffects,
    (sideEffect) => {
      if (
        sideEffect.code === "console.trace" ||
        sideEffect.code === "console.log" ||
        sideEffect.code === "console.info" ||
        sideEffect.code === "console.warn" ||
        sideEffect.code === "console.error" ||
        sideEffect.code === "process.stdout" ||
        sideEffect.code === "process.stderr"
      ) {
        return true;
      }
      return false;
    },
    {
      createGroupSideEffect: (sideEffects) => {
        return createLogGroupSideEffect(sideEffects);
      },
    },
  );
};
