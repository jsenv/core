import { frameString } from "./frame_string.js";

const assertStrings = ({ actual, expect }) => {
  if (actual !== expect) {
    throw new Error(`unexpected string after framing
--- actual ---
${actual}
--- expect ---
${expect}`);
  }
};

{
  const actual = frameString(
    `const a = false;
const b = true;
const c = true;
const d = true;
const e = false;`,
    {
      line: 2,
      column: 6,
      annotation: "^ hello",
    },
  );
  const expect = `
const a = false;
const b = true;
const c = true;
      ^ hello
const d = true;
const e = false;`.slice(1);
  assertStrings({ actual, expect });
}
