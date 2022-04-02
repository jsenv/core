import { InlineContent } from "@jsenv/core/inline_template_literals.js"

const css = new InlineContent(
  `
  body {
    background-color: red;
    background-image: url("./jsenv.png");
  }
`,
  { type: "text/css" },
)
console.log(css.raw)

const css2 = new InlineContent(
  "body { background-image: url('./jsenv.png'); }",
  { type: "text/css" },
)
console.log(css2.raw)

const json = new InlineContent("{}", { type: "application/json" })
console.log(json.raw)
