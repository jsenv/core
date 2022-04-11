import { transformAsync } from "@babel/core"
import { urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { injectQuery } from "@jsenv/core/src/internal/url_utils.js"
import { collectProgramUrlMentions } from "@jsenv/core/src/internal/transform_js/program_url_mentions.js"

const babelPluginTransformJsUrls = (babel, { transformUrlSpecifier }) => {
  return {
    name: "transform-js-urls",
    visitor: {
      Program: (path) => {
        const urlMentions = collectProgramUrlMentions(path)
        urlMentions.forEach(({ specifierPath }) => {
          const specifier = specifierPath.node.value
          const specifierTransformed = transformUrlSpecifier({
            specifier,
          })
          if (specifierTransformed !== specifier) {
            specifierPath.replaceWith(
              babel.types.stringLiteral(specifierTransformed),
            )
          }
        })
      },
    },
  }
}

// new URL + import.meta.url
{
  const input = `const url = new URL('./file.txt', import.meta.url)`
  const { code } = await transformAsync(input, {
    plugins: [
      [
        babelPluginTransformJsUrls,
        {
          transformUrlSpecifier: () => {
            return "./foo.txt"
          },
        },
      ],
    ],
  })
  const actual = code
  const expected = `var url = new URL("./foo.txt", import.meta.url);`
  assert({ actual, expected })
}

// import assertions
{
  const input = `import sheet from "./style.css" assert { type: "css" }`
  const { code } = await transformAsync(input, {
    plugins: [
      [
        babelPluginTransformJsUrls,
        {
          transformUrlSpecifier: ({ specifier }) => {
            const fakeOrigin = "http://jsenv.com"
            const url = new URL(specifier, fakeOrigin)
            const urlWithImportType = injectQuery(url, {
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
        babelPluginTransformJsUrls,
        {
          transformUrlSpecifier: ({ specifier }) => `${specifier}-transformed`,
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
        babelPluginTransformJsUrls,
        {
          transformUrlSpecifier: ({ specifier }) => `${specifier}-transformed`,
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
        babelPluginTransformJsUrls,
        {
          transformUrlSpecifier: ({ specifier }) => `${specifier}-transformed`,
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
        babelPluginTransformJsUrls,
        {
          transformUrlSpecifier: ({ specifier }) => `${specifier}-transformed`,
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
        babelPluginTransformJsUrls,
        {
          transformUrlSpecifier: ({ specifier }) => `${specifier}-transformed`,
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
        babelPluginTransformJsUrls,
        {
          transformUrlSpecifier: ({ specifier }) => `${specifier}-transformed`,
        },
      ],
    ],
  })
  const actual = code
  const expected = `import { a } from "foo-transformed";`
  assert({ actual, expected })
}
