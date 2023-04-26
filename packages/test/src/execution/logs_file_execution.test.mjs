import { assert } from "@jsenv/assert"

import { formatConsoleOutput } from "./logs_file_execution.js"

{
  const actual = formatConsoleOutput([
    { type: "log", text: "a\n" },
    { type: "log", text: "b\n" },
  ])
  const expected = `  a
  b`
  assert({ actual, expected })
}

{
  const actual = formatConsoleOutput([
    { type: "log", text: "a" },
    { type: "log", text: "b" },
  ])
  const expected = `  ab`
  assert({ actual, expected })
}

{
  const actual = formatConsoleOutput([
    {
      type: "log",
      text: `1
2`,
    },
    {
      type: "log",
      text: `alpha
beta`,
    },
  ])
  const expected = `  1
  2alpha
  beta`
  assert({ actual, expected })
}
