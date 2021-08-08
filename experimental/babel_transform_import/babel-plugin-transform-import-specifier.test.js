import { transformAsync } from "@babel/core"
import { assert } from "@jsenv/assert"

import { babelPluginTransformImportSpecifier } from "./babel-plugin-transform-import-specifier.js"

// dynamic import
{
  const input = `import("foo")`
  const { code } = await transformAsync(input, {
    plugins: [
      [
        babelPluginTransformImportSpecifier,
        {
          transformImportSpecifier: (specifier) => `${specifier}-transformed`,
        },
      ],
    ],
  })
  const actual = code
  const expected = `import("foo-transformed");`
  assert({ actual, expected })
}

// dynamic dynamic import
{
  const input = `import(foo)`
  const { code } = await transformAsync(input, {
    plugins: [
      [
        babelPluginTransformImportSpecifier,
        {
          transformImportSpecifier: (specifier) => `${specifier}-transformed`,
        },
      ],
    ],
  })
  const actual = code
  const expected = `import(foo);`
  assert({ actual, expected })
}

// import
{
  const input = `import "foo"`
  const { code } = await transformAsync(input, {
    plugins: [
      [
        babelPluginTransformImportSpecifier,
        {
          transformImportSpecifier: (specifier) => `${specifier}-transformed`,
        },
      ],
    ],
  })
  const actual = code
  const expected = `import "foo-transformed";`
  assert({ actual, expected })
}

// export named
{
  const input = `export { a } from "foo"`
  const { code } = await transformAsync(input, {
    plugins: [
      [
        babelPluginTransformImportSpecifier,
        {
          transformImportSpecifier: (specifier) => `${specifier}-transformed`,
        },
      ],
    ],
  })
  const actual = code
  const expected = `export { a } from "foo-transformed";`
  assert({ actual, expected })
}

// export all
{
  const input = `export * from "foo"`
  const { code } = await transformAsync(input, {
    plugins: [
      [
        babelPluginTransformImportSpecifier,
        {
          transformImportSpecifier: (specifier) => `${specifier}-transformed`,
        },
      ],
    ],
  })
  const actual = code
  const expected = `export * from "foo-transformed";`
  assert({ actual, expected })
}

// named import
{
  const input = `import { a } from "foo"`
  const { code } = await transformAsync(input, {
    plugins: [
      [
        babelPluginTransformImportSpecifier,
        {
          transformImportSpecifier: (specifier) => `${specifier}-transformed`,
        },
      ],
    ],
  })
  const actual = code
  const expected = `import { a } from "foo-transformed";`
  assert({ actual, expected })
}
