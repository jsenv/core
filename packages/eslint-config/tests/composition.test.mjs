import { assert } from "@jsenv/assert"

import { composeEslintConfig } from "@jsenv/eslint-config"

// overrides array composition
{
  const actual = composeEslintConfig(
    {
      overrides: [
        {
          files: ["**/*.cjs"],
        },
      ],
    },
    {
      overrides: [
        {
          files: ["**/*.mjs"],
        },
      ],
    },
  )
  const expected = {
    overrides: [
      {
        files: ["**/*.cjs"],
      },
      {
        files: ["**/*.mjs"],
      },
    ],
  }
  assert({ actual, expected })
}

// settings extension
// parserOptions
