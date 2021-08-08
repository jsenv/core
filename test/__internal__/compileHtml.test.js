import { assert } from "@jsenv/assert"

import {
  parseHtmlString,
  manipulateHtmlAst,
  stringifyHtmlAst,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"

const compileHtml = (
  htmlBeforeCompilation,
  {
    scriptInjections = [],
    // resolveScriptSrc = (src) => src,
  } = {},
) => {
  // https://github.com/inikulin/parse5/blob/master/packages/parse5/docs/tree-adapter/interface.md
  const document = parseHtmlString(htmlBeforeCompilation)

  manipulateHtmlAst(document, { scriptInjections })
  // resolveScripts(document, resolveScriptSrc)

  const htmlAfterCompilation = stringifyHtmlAst(document)
  return {
    htmlAfterCompilation,
  }
}

// inject script tag inside head + there is already a script tag
{
  const htmlBeforeCompilation = `
  <html>
    <head>
      <meta charset="utf8" />
      <script src="foo.js"></script>
    </head>
    <body></body>
  </html>`
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation, {
    scriptInjections: [{ src: "bar.js", async: true }],
  })
  const actual = htmlAfterCompilation
  const expected = `<html><head>
      <meta charset="utf8">
      <script src="bar.js" async="true"></script>
      <script src="foo.js"></script>
    </head>
    <body>
  </body></html>`
  assert({ actual, expected })
}

// don't inject script already there
{
  const htmlBeforeCompilation = `
  <html>
    <head>
      <meta charset="utf8" />
      <script src="foo.js"></script>
    </head>
    <body></body>
  </html>`
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation, {
    scriptInjections: [{ src: "foo.js" }],
  })
  const actual = htmlAfterCompilation
  const expected = `<html><head>
      <meta charset="utf8">
      <script src="foo.js"></script>
    </head>
    <body>
  </body></html>`
  assert({ actual, expected })
}

// ''
{
  const htmlBeforeCompilation = ""
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation)
  const actual = htmlAfterCompilation
  const expected = `<html><head></head><body></body></html>`
  assert({ actual, expected })
}

// foo
{
  const htmlBeforeCompilation = `foo`
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation)
  const actual = htmlAfterCompilation
  const expected = `<html><head></head><body>foo</body></html>`
  assert({ actual, expected })
}

// <head>
{
  const htmlBeforeCompilation = `<head>`
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation)
  const actual = htmlAfterCompilation
  const expected = `<html><head></head><body></body></html>`
  assert({ actual, expected })
}

// <foo />
{
  const htmlBeforeCompilation = `<foo />`
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation)
  const actual = htmlAfterCompilation
  const expected = `<html><head></head><body><foo></foo></body></html>`
  assert({ actual, expected })
}
