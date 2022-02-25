/*
 * This file uses "@jsenv/core" to convert source files into commonjs format
 * and write them into "./dist/" directory.
 *
 * Read more at https://github.com/jsenv/jsenv-core/blob/master/docs/building/readme.md#node-package-build
 */

import { fileURLToPath, pathToFileURL } from "node:url"
import { writeFile } from "@jsenv/filesystem"

const esToCjs = async ({ url, map, content }) => {
  const { rollup } = await import("rollup")
  const rollupBuild = await rollup({
    input: fileURLToPath(url),
    plugins: [
      {
        resolveId: async (id, importer = fileURLToPath(url)) => {
          if (
            id.startsWith("node:") ||
            id === "path" ||
            id === "url" ||
            id === "util" ||
            id === "fs"
          ) {
            return { id, external: true }
          }
          const url = await import.meta.resolve(id, pathToFileURL(importer))
          const path = fileURLToPath(new URL(url))
          return path
        },
        outputOptions: (outputOptions) => {
          outputOptions.paths = (id) => {
            if (id.startsWith("node:")) {
              return id.slice("node:".length)
            }
            return null
          }
        },
      },
    ],
  })
  const { output } = await rollupBuild.generate({
    format: "cjs",
    sourcemap: true,
  })
  const firstChunk = output[0]
  map = firstChunk.map
  content = firstChunk.code
  return {
    map,
    content,
  }
}
const { content } = await esToCjs({
  url: new URL("../../packages/eslint-import-resolver/main.js", import.meta.url)
    .href,
})
await writeFile(
  new URL("../../dist/jsenv_eslint_import_resolver.cjs", import.meta.url),
  content,
)
