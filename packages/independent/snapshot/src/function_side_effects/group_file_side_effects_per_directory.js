import { pathToFileURL } from "node:url";
import { findCommonAncestorPath } from "./common_ancestor_path.js";

export const groupFileSideEffectsPerDirectory = (
  sideEffects,
  { getFilesystemActionInfo },
) => {
  const groupArray = groupFileTogether(sideEffects);
  for (const writeFileSideEffectArray of groupArray) {
    if (writeFileSideEffectArray.length < 2) {
      continue;
    }
    const commonAncestorPath = findCommonAncestorPath(
      writeFileSideEffectArray,
      (writeFileSideEffect) => {
        return new URL(writeFileSideEffect.value.url).pathname;
      },
    );
    const firstWriteFileIndex = sideEffects.indexOf(
      writeFileSideEffectArray[0],
    );
    for (const writeFileSideEffect of writeFileSideEffectArray) {
      sideEffects.splice(sideEffects.indexOf(writeFileSideEffect), 1);
    }
    const commonAncestorUrl = pathToFileURL(commonAncestorPath);
    const numberOfFiles = writeFileSideEffectArray.length;
    const { label } = getFilesystemActionInfo(
      `write ${numberOfFiles} files into`,
      commonAncestorUrl,
    );
    sideEffects.splice(firstWriteFileIndex, 0, {
      type: "fs:write_file",
      label,
    });
  }
};

const groupFileTogether = (sideEffects) => {
  let i = 0;
  const groupArray = [];
  let currentGroup;
  while (i < sideEffects.length) {
    const sideEffect = sideEffects[i];
    i++;
    if (sideEffect.type === "fs:write_file") {
      if (currentGroup === undefined) {
        currentGroup = [];
      }
      currentGroup.push(sideEffect);
      continue;
    }
    if (sideEffect.type === "fs:write_directory") {
      continue;
    }
    if (currentGroup !== undefined) {
      groupArray.push(currentGroup);
      currentGroup = undefined;
    }
  }
  if (currentGroup !== undefined) {
    groupArray.push(currentGroup);
    currentGroup = undefined;
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
