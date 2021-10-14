import { transformAsync } from "@babel/core"
import { urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { setUrlSearchParamsDescriptor } from "@jsenv/core/src/internal/url_utils.js"
import { babelPluginTransformImportSpecifier } from "@jsenv/core/src/internal/compiling/babel_plugin_transform_import_specifier.js"

// import assertions
{
  const input = `import sheet from "./style.css" assert { type: "css" }`
  const { code } = await transformAsync(input, {
    plugins: [
      [
        babelPluginTransformImportSpecifier,
        {
          transformImportSpecifier: ({ specifier }) => {
            const fakeOrigin = "http://jsenv.com"
            const url = new URL(specifier, fakeOrigin)
            const urlWithImportType = setUrlSearchParamsDescriptor(url, {
              import_type: "css",
            })
            if (urlWithImportType.startsWith(fakeOrigin)) {
              // url wa relative
              const specifierWithImportType = urlToRelativeUrl(
                urlWithImportType,
                fakeOrigin,
              )
              return `./${specifierWithImportType}`
            }
            return urlWithImportType
          },
        },
      ],
    ],
  })
  const actual = code
  const expected = `import sheet from "./style.css?import_type=css" assert { type: "css" };`
  assert({ actual, expected })
}

// dynamic import
{
  const input = `import("foo")`
  const { code } = await transformAsync(input, {
    plugins: [
      [
        babelPluginTransformImportSpecifier,
        {
          transformImportSpecifier: ({ specifier }) =>
            `${specifier}-transformed`,
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
          transformImportSpecifier: ({ specifier }) =>
            `${specifier}-transformed`,
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
          transformImportSpecifier: ({ specifier }) =>
            `${specifier}-transformed`,
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
          transformImportSpecifier: ({ specifier }) =>
            `${specifier}-transformed`,
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
          transformImportSpecifier: ({ specifier }) =>
            `${specifier}-transformed`,
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
          transformImportSpecifier: ({ specifier }) =>
            `${specifier}-transformed`,
        },
      ],
    ],
  })
  const actual = code
  const expected = `import { a } from "foo-transformed";`
  assert({ actual, expected })
}
