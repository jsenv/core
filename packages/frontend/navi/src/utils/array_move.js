export const moveArrayItemByIndex = (array, indexA, indexB) => {
  const newArray = [];
  const movedItem = array[indexA];
  const movingRight = indexA < indexB;

  for (let i = 0; i < array.length; i++) {
    if (movingRight) {
      // Moving right: add target first, then moved item after
      if (i !== indexA) {
        newArray.push(array[i]);
      }
      if (i === indexB) {
        newArray.push(movedItem);
      }
    } else {
      // Moving left: add moved item first, then target after
      if (i === indexB) {
        newArray.push(movedItem);
      }
      if (i !== indexA) {
        newArray.push(array[i]);
      }
    }
  }
  return newArray;
};

export const swapArrayItemByIndex = (array, indexA, indexB) => {
  const newArray = [];
  const itemAtPositionA = array[indexA];
  const itemAtPositionB = array[indexB];
  for (let i = 0; i < array.length; i++) {
    if (i === indexB) {
      // At the new position, put the dragged column
      newArray.push(itemAtPositionA);
      continue;
    }
    if (i === indexA) {
      // At the old position, put what was at the new position
      newArray.push(itemAtPositionB);
      continue;
    }
    // Everything else stays the same
    newArray.push(array[i]);
  }
  return newArray;
};
