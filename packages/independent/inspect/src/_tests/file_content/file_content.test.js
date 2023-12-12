import { writeFileSync } from "node:fs";
import { takeFileSnapshot } from "@jsenv/snapshot";

import { inspectFileContent } from "@jsenv/inspect";

let number = 1;
const test = (name, params) => {
  const snapshotFileUrl = new URL(
    `./snapshots/${number}_${name}`,
    import.meta.url,
  );
  number++;
  const fileSnapshot = takeFileSnapshot(snapshotFileUrl);
  writeFileSync(snapshotFileUrl, inspectFileContent(params));
  fileSnapshot.compare();
};

test("basic.txt", {
  content: `const a = false;
const b = true;
const c = true;
const d = true;
const e = false;
  `,
  line: 3,
  column: 1,
  linesAbove: 1,
  linesBelow: 1,
});

test("basic_2.txt", {
  content: `const a = false;
const b = true;
const c = true;
const d = true;
const e = false;`,
  line: 3,
  column: 7,
  linesAbove: 4,
  linesBelow: 2,
});

test("empty_last_line.txt", {
  content: `const a = false;
const b = true;
const c = true;
const d = true;
const e = false;
  `,
  line: 3,
  column: 1,
  linesAbove: 4,
  linesBelow: 3,
});

test("no_column.txt", {
  content: `const a = false;
const b = true;
const c = true;
const d = true;
const e = false;
  `,
  line: 3,
  linesAbove: 1,
  linesBelow: 1,
});

test("line_1_and_2_digits.txt", {
  content: `const a = false;
const b = false;
const c = false;
const d = false;
const e = false;
const f = false;
const g = false;
const h = false;
const i = true;
const j = true;
const k = true;
const l = true;`,
  line: 10,
  linesAbove: 1,
  linesBelow: 1,
});

test("line_too_long_column_undefined.txt", {
  content: `const a = false;
const b = true;
const thisVariableNameisQuiteLong = true;
const d = true;
const e = false;
  `,
  line: 3,
  linesAbove: 1,
  linesBelow: 1,
  lineMaxWidth: 15,
});

test("line_too_long_column_near_start.txt", {
  content: `const a = false;
const b = true;
const thisVariableNameisQuiteLong = true;
const d = true;
const e = false;
  `,
  line: 3,
  column: 4,
  linesAbove: 1,
  linesBelow: 1,
  lineMaxWidth: 15,
});

test("line_too_long_column_near_middle.txt", {
  content: `const a = false;
const b = true
const thisVariableNameisQuiteLong = true;
const d = tru
const e = false;
`,
  line: 3,
  column: 20,
  linesAbove: 1,
  linesBelow: 1,
  lineMaxWidth: 14,
});

test("line_too_long_column_near_end.txt", {
  content: `const a = false;

const thisVariableNameisQuiteLong = true;
const d = tru
const e = false;
  `,
  line: 3,
  column: 35,
  linesAbove: 1,
  linesBelow: 1,
  lineMaxWidth: 15,
});

test("line_and_column_are_zero.txt", {
  content: `const a = false;`,
  line: 0,
  column: 0,
});
