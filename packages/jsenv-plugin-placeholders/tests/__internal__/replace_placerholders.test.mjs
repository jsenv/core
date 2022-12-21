import { assert } from "@jsenv/assert"

import { replacePlaceholders } from "@jsenv/plugin-placeholders/src/replace_placeholders.js"

const result = replacePlaceholders(
  {
    type: "js_module",
    content: `const foo = __FOO__
const t = __FOO__
const bar = __BAR__`,
  },
  {
    __FOO__: "hello",
    __BAR__: "world",
  },
)
const actual = result.content
const expected = `const foo = "hello"
const t = "hello"
const bar = "world"`
assert({ actual, expected })
