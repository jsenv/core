import { transform } from "lightningcss"

const css = `@import "./b.css";`
const { dependencies, code } = transform({
  code: Buffer.from(css),
  analyzeDependencies: true,
})
console.log(String(code))
