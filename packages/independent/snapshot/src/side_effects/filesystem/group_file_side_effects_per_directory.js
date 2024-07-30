import { groupSideEffectsPer, IGNORE } from "../utils/group_side_effects.js";
import { findCommonAncestorPath } from "./common_ancestor_path.js";

export const groupFileSideEffectsPerDirectory = (
  allSideEffects,
  { createWriteFileGroupSideEffect },
) => {
  return groupSideEffectsPer(
    allSideEffects,
    (sideEffect) => {
      if (sideEffect.code === "write_directory") {
        return IGNORE;
      }
      return sideEffect.code === "write_file";
    },
    {
      createGroupSideEffect: (sideEffects) => {
        const commonAncestorPath = findCommonAncestorPath(
          sideEffects,
          convertToPathname,
        );
        return createWriteFileGroupSideEffect(sideEffects, commonAncestorPath);
      },
    },
  );
};

const convertToPathname = (writeFileSideEffect) => {
  return new URL(writeFileSideEffect.value.url).pathname;
};
