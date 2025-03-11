import { assert } from "@jsenv/assert";

import { composeEslintConfig } from "@jsenv/eslint-config";

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
  );
  const expect = {
    overrides: [
      {
        files: ["**/*.cjs"],
      },
      {
        files: ["**/*.mjs"],
      },
    ],
  };
  assert({ actual, expect });
}

// settings extension
// parserOptions
