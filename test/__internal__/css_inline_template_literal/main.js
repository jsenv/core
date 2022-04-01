import { css as toto } from "@jsenv/core/inline_template_literals.js"

const cssText = toto`
body {
  background-color: red;
  background-image: url("./jsenv.png");
}
`
console.log(cssText)
