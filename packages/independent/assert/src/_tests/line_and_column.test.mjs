import { createLineAndColumnConverter } from "@jsenv/assert/src/internal/line_and_column.js";

const assertLineAndColumn = ({ actual, expected }) => {
  if (actual.line !== expected.line) {
    throw new Error(`line should be ${expected.line}, got ${actual.line}`);
  }
  if (actual.column !== expected.column) {
    throw new Error(
      `column should be ${expected.column}, got ${actual.column}`,
    );
  }
};

{
  const lineAndColumn = createLineAndColumnConverter("abcd");
  const actual = lineAndColumn.positionFromIndex(0);
  const expected = { line: 0, column: 0 };
  assertLineAndColumn({ actual, expected });
}

{
  const lineAndColumn = createLineAndColumnConverter("abcd");
  const actual = lineAndColumn.positionFromIndex(1);
  const expected = { line: 0, column: 1 };
  assertLineAndColumn({ actual, expected });
}

{
  const lineAndColumn = createLineAndColumnConverter(`a\nb\nc`);
  const actual = lineAndColumn.positionFromIndex(1);
  const expected = { line: 1, column: 0 };
  assertLineAndColumn({ actual, expected });
}

{
  const lineAndColumn = createLineAndColumnConverter(`a\nb\ncd`);
  const actual = lineAndColumn.positionFromIndex(3);
  const expected = { line: 2, column: 1 };
  assertLineAndColumn({ actual, expected });
}
