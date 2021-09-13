import { fileURLToPath } from "node:url"
import { rollup } from "rollup"

const rollupBuild = await rollup({
  input: fileURLToPath(new URL("./boot.js", import.meta.url)),
})
await rollupBuild.write({
  dir: fileURLToPath(new URL("./dist/", import.meta.url)),
})
