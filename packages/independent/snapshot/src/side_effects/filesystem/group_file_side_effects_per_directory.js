import { findCommonAncestorPath } from "./common_ancestor_path.js";

export const groupFileSideEffectsPerDirectory = (
  sideEffects,
  { createWriteFileGroupSideEffect },
) => {
  const groupArray = groupFileTogether(sideEffects);

  for (const group of groupArray) {
    if (group.id !== "file") {
      continue;
    }
    const fileEffectArray = group.values;
    if (fileEffectArray.length < 2) {
      continue;
    }
    const commonAncestorPath = findCommonAncestorPath(
      fileEffectArray,
      convertToPathname,
    );
    const firstEffect = fileEffectArray[0];
    const firstEffectIndex = sideEffects.indexOf(firstEffect);
    for (const fileEffect of fileEffectArray) {
      sideEffects.splice(sideEffects.indexOf(fileEffect), 1);
    }
    sideEffects.splice(
      firstEffectIndex,
      0,
      createWriteFileGroupSideEffect(fileEffectArray, commonAncestorPath),
    );
  }
};

const convertToPathname = (writeFileSideEffect) => {
  return new URL(writeFileSideEffect.value.url).pathname;
};

const groupBy = (array, groupCallback) => {
  let i = 0;
  const groupArray = [];
  let currentGroup = null;
  while (i < array.length) {
    const value = array[i];
    i++;
    let ignoreCalled = false;
    let ignore = () => {
      ignoreCalled = true;
    };
    const groupId = groupCallback(value, { ignore });
    if (ignoreCalled) {
      continue;
    }
    if (currentGroup === null) {
      currentGroup = {
        id: groupId,
        values: [value],
      };
      groupArray.push(currentGroup);
      continue;
    }
    if (groupId === currentGroup.id) {
      currentGroup.values.push(value);
      continue;
    }
    currentGroup = {
      id: groupId,
      values: [value],
    };
    groupArray.push(currentGroup);
  }
  return groupArray;
};

const groupFileTogether = (sideEffects) =>
  groupBy(sideEffects, (sideEffect, { ignore }) => {
    if (sideEffect.code === "write_directory") {
      ignore();
      return null;
    }
    if (sideEffect.code === "write_file") {
      return "file";
    }
    return "other";
  });

// const groups = groupFileTogether([
//   {
//     name: "a",
//     type: "fs:write_file",
//   },
//   {
//     name: "b",
//     type: "fs:write_directory",
//   },
//   {
//     name: "c",
//     type: "fs:write_file",
//   },
//   {
//     name: "d",
//     type: "other",
//   },
//   {
//     name: "e",
//     type: "fs:write_file",
//   },
// ]);
// debugger;
