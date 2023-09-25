export const createLineAndColumnConverter = (content) => {
  const lines = content.split(/\r?\n/);

  const indexFromLine = (line) => {
    if (line === 0) return 0;
    let index = 0;
    let i = 0;
    let j = line;
    while (i < j) {
      index += Buffer.byteLength(lines[i]);
      i++;
    }
    return index;
  };

  const indexFromLineAndColumn = (line, column) => {
    return indexFromLine(line) + column;
  };

  const positionFromIndex = (index) => {
    let lineIndex = 0;
    let remainingIndex = index;
    while (remainingIndex > -1) {
      const line = lines[lineIndex];
      if (lineIndex > lines.length) {
        throw new Error(`index too big`);
      }
      const lineLength = Buffer.byteLength(line);
      if (lineLength > remainingIndex) {
        return {
          line: lineIndex,
          column: remainingIndex,
        };
      }
      remainingIndex -= lineLength;
      lineIndex++;
    }
    throw new Error("index is too big");
  };

  return { indexFromLine, positionFromIndex, indexFromLineAndColumn };
};
