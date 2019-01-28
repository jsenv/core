// https://github.com/rollup/rollup-starter-code-splitting
import { usedByMain } from "./used-by-main.js"
import { usedByBoth } from "./used-by-both.js"

const { dynamic } = await import("./dynamic.js")

console.log({
  usedByMain,
  usedByBoth,
  dynamic,
})
