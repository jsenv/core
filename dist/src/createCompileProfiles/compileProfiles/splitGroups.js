"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.splitGroups = void 0;

var _composeGroups = require("./composeGroups.js");

const getChunkSizes = (array, size) => {
  let i = 0;
  const chunkSize = Math.ceil(array.length / size);
  const chunkSizes = [];

  while (i < array.length) {
    if (i + chunkSize > array.length) {
      const chunkSize = array.length - i;
      i += chunkSize;
      chunkSizes.push(chunkSize);
    } else {
      i += chunkSize;
      chunkSizes.push(chunkSize);
    }
  }

  return chunkSizes;
};

const splitGroups = (groups, getScoreForGroup, count = 4) => {
  let i = 0;
  const chunkSizes = getChunkSizes(groups, count).reverse();
  const finalGroups = [];
  const sortedGroups = groups.sort((a, b) => getScoreForGroup(b) - getScoreForGroup(a));
  let remainingGroups = sortedGroups;

  while (i < chunkSizes.length) {
    const groupsToMerge = remainingGroups.slice(0, chunkSizes[i]);
    remainingGroups = remainingGroups.slice(chunkSizes[i]);
    const mergedGroup = (0, _composeGroups.composeGroups)(...groupsToMerge);

    if (Object.keys(mergedGroup.compatMap).length) {
      finalGroups.push(mergedGroup);
    }

    i++;
  }

  return finalGroups;
};

exports.splitGroups = splitGroups;
//# sourceMappingURL=splitGroups.js.map