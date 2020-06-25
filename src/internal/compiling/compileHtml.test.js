import { assert } from "@jsenv/assert"
import { compileHtml } from "./compileHtml.js"

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
    headScripts: [{ src: "bar.js", async: true }],
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

// transform external module script inside body
{
  const htmlBeforeCompilation = `
<html>
  <head></head>
  <body>
    <script src="foo.js"></script>
    <script type="module" src="bar.js" async></script>
  </body>
</html>`
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation)
  const actual = htmlAfterCompilation
  const expected = `<html><head></head>
  <body>
    <script src="foo.js"></script>
    <script async="">
      window.__jsenv__.importFile("bar.js")
    </script>
${`  ` /* this is for prettier */}
</body></html>`
  assert({ actual, expected })
}

// transform inline module script in head
{
  const htmlBeforeCompilation = `
<html>
  <head>
    <script type="module">
      console.log(42)
    </script>
  </head>
  <body></body>
</html>`
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation)
  const actual = htmlAfterCompilation
  const expected = `<html><head>
    <script>
      window.__jsenv__.importFile("8d473bbc.js")
    </script>
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
