export const createCallOrderer = () => {
  const queue = [];
  const callWhenPreviousExecutionAreDone = (executionIndex, callback) => {
    if (queue[executionIndex]) {
      throw new Error(`${executionIndex} already used`);
    }

    let allBeforeAreDone = true;
    if (executionIndex > 0) {
      let beforeIndex = executionIndex - 1;
      do {
        const value = queue[beforeIndex];
        if (!value) {
          allBeforeAreDone = false;
          break;
        }
      } while (beforeIndex--);
    }
    if (!allBeforeAreDone) {
      queue[executionIndex] = callback;
      return;
    }
    queue[executionIndex] = true;
    callback();
    let afterIndex = executionIndex + 1;
    while (afterIndex < queue.length) {
      const value = queue[afterIndex];
      if (value === undefined) {
        break;
      }
      if (typeof value === "function") {
        queue[afterIndex] = true;
        value();
      }
      afterIndex++;
    }
  };
  return callWhenPreviousExecutionAreDone;
};
