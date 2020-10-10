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
import { showSourceLocation } from "./showSourceLocation.js"

{
  const actual = showSourceLocation(
    `const a = false;
const b = true;
const c = true;
const d = true;
const e = false;
`,
    { column: 1, line: 3 },
  )
  const expected = `
  2 | const b = true;
> 3 | const c = true;
      ^
  4 | const d = true;`.slice(1)
  assert({ actual, expected })
}
