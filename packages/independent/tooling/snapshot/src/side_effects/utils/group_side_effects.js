export const groupSideEffectsPer = (
  allSideEffects,
  isInsideGroup,
  { createGroupSideEffect },
) => {
  const groupArray = groupBy(allSideEffects, (sideEffect) => {
    if (sideEffect.skippable) {
      return IGNORE;
    }
    const isInsideResult = isInsideGroup(sideEffect);
    if (isInsideResult === IGNORE) {
      return IGNORE;
    }
    return isInsideResult ? "YES" : "NO";
  });
  for (const group of groupArray) {
    if (group.id !== "YES") {
      continue;
    }
    const sideEffectArray = group.values;
    if (sideEffectArray.length < 2) {
      continue;
    }
    const groupSideEffect = createGroupSideEffect(sideEffectArray);
    const firstEffect = sideEffectArray[0];
    allSideEffects.replaceSideEffect(firstEffect, groupSideEffect);
    for (const sideEffect of sideEffectArray.slice(1)) {
      allSideEffects.removeSideEffect(sideEffect);
    }
  }
};

export const IGNORE = {};

const groupBy = (array, groupCallback) => {
  let i = 0;
  const groupArray = [];
  let currentGroup = null;
  while (i < array.length) {
    const value = array[i];
    i++;
    const groupId = groupCallback(value);
    if (groupId === IGNORE) {
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
