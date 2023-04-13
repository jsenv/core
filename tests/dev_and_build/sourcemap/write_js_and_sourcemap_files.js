import { writeFileSync } from "node:fs"
import { createMagicSource, SOURCEMAP } from "@jsenv/sourcemap"

const magic = createMagicSource(`const answer = 42;
console.log(answer)`)
magic.replace({
  start: 0,
  end: 5,
  replacement: `var`,
})
const { content, sourcemap } = magic.toContentAndSourcemap()
const contentWithSourcemapComment = SOURCEMAP.writeComment({
  contentType: "text/javascript",
  content,
  specifier: "main.js.map",
})

writeFileSync(
  new URL("./client/main.js", import.meta.url),
  contentWithSourcemapComment,
)
writeFileSync(
  new URL("./client/main.js.map", import.meta.url),
  JSON.stringify(sourcemap, null, "  "),
)
