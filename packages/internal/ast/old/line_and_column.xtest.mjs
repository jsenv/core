import { createLineAndColumnConverter } from "./line_and_column.js";

const assertLineAndColumn = ({ actual, expect }) => {
  if (actual.line !== expect.line) {
    throw new Error(`line should be ${expect.line}, got ${actual.line}`);
  }
  if (actual.column !== expect.column) {
    throw new Error(`column should be ${expect.column}, got ${actual.column}`);
  }
};

{
  const lineAndColumn = createLineAndColumnConverter("abcd");
  const actual = lineAndColumn.positionFromIndex(0);
  const expect = { line: 0, column: 0 };
  assertLineAndColumn({ actual, expect });
}

{
  const lineAndColumn = createLineAndColumnConverter("abcd");
  const actual = lineAndColumn.positionFromIndex(1);
  const expect = { line: 0, column: 1 };
  assertLineAndColumn({ actual, expect });
}

{
  const lineAndColumn = createLineAndColumnConverter(`a\nb\nc`);
  const actual = lineAndColumn.positionFromIndex(1);
  const expect = { line: 1, column: 0 };
  assertLineAndColumn({ actual, expect });
}

{
  const lineAndColumn = createLineAndColumnConverter(`a\nb\ncd`);
  const actual = lineAndColumn.positionFromIndex(3);
  const expect = { line: 2, column: 1 };
  assertLineAndColumn({ actual, expect });
}
