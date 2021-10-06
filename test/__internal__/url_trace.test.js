/**

I use trim to avoid writing expected like that:

const expected = `> 1 | const a = true;
       ^
  2 | const b = true;`

But instead

const expected = `
> 1 | const a = true;
       ^
  2 | const b = true;`.slice(1)

Which is way more readable

*/

import { assert } from "@jsenv/assert"

import { showSourceLocation } from "@jsenv/core/src/internal/building/url_trace.js"

{
  const actual = showSourceLocation({
    source: `const a = false;
const b = true;
const c = true;
const d = true;
const e = false;
`,
    column: 1,
    line: 3,
  })
  const expected = `
  2 | const b = true;
> 3 | const c = true;
      ^
  4 | const d = true;`.slice(1)
  assert({ actual, expected })
}

{
  const actual = showSourceLocation({
    source: `const a = false;
const b = true;
const c = true;
const d = true;
const e = false;`,
    column: 7,
    line: 3,
    numberOfSurroundingLinesToShow: 10,
  })
  const expected = `
  1 | const a = false;
  2 | const b = true;
> 3 | const c = true;
            ^
  4 | const d = true;
  5 | const e = false;`.slice(1)
  assert({ actual, expected })
}

// empty last line is shown
{
  const actual = showSourceLocation({
    source: `const a = false;
const b = true;
const c = true;
const d = true;
const e = false;
`,
    column: 1,
    line: 3,
    numberOfSurroundingLinesToShow: 10,
  })
  const expected = `
  1 | const a = false;
  2 | const b = true;
> 3 | const c = true;
      ^
  4 | const d = true;
  5 | const e = false;
  6 | `.slice(1)
  assert({ actual, expected })
}

// no column given
{
  const actual = showSourceLocation({
    source: `const a = false;
const b = true;
const c = true;
const d = true;
const e = false;
`,
    line: 3,
  })
  const expected = `
  2 | const b = true;
> 3 | const c = true;
  4 | const d = true;`.slice(1)
  assert({ actual, expected })
}

// line number goes from 1 digit to 2 digits
{
  const actual = showSourceLocation({
    source: `const a = false;
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
  })
  const expected = `
  9  | const i = true;
> 10 | const j = true;
  11 | const k = true;`.slice(1)
  assert({ actual, expected })
}

// line is too long and column is undefined
{
  const actual = showSourceLocation({
    source: `const a = false;
const b = true;
const thisVariableNameisQuiteLong = true;
const d = true;
const e = false;
`,
    line: 3,
    lineMaxLength: 15,
  })
  const expected = `
  2 | const b = true;
> 3 | const thisVari…
  4 | const d = true;`.slice(1)
  assert({ actual, expected })
}

// line is too long and column is near beginning
{
  const actual = showSourceLocation({
    source: `const a = false;
const b = true;
const thisVariableNameisQuiteLong = true;
const d = true;
const e = false;
`,
    line: 3,
    column: 4,
    lineMaxLength: 15,
  })
  const expected = `
  2 | const b = true;
> 3 | const thisVari…
         ^
  4 | const d = true;`.slice(1)
  assert({ actual, expected })
}

// line is too long and column is near middle
{
  const actual = showSourceLocation({
    source: `const a = false;
const b = true
const thisVariableNameisQuiteLong = true;
const d = tru
const e = false;
`,
    line: 3,
    column: 20,
    lineMaxLength: 15,
  })
  const expected = `
  2 |${" "}
> 3 | …ableNameisQui…
            ^
  4 |${" "}`.slice(1)
  assert({ actual, expected })
}

// line is too long and column is near end
{
  const actual = showSourceLocation({
    source: `const a = false;

const thisVariableNameisQuiteLong = true;
const d = tru
const e = false;
`,
    line: 3,
    column: 35,
    lineMaxLength: 15,
  })
  const expected = `
  2 |${" "}
> 3 | …Long = true;
            ^
  4 |${" "}`.slice(1)
  assert({ actual, expected })
}
