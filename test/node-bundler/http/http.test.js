import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { startServer } from "../../../src/server/index.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const server = await startServer({
  protocol: "http",
  ip: "127.0.0.1",
  port: 9999,
  requestToResponse: () => {
    const body = `export default 42`

    return {
      status: 200,
      headers: {
        "content-type": "application/javascript",
        "content-length": Buffer.byteLength(body),
      },
      body,
    }
  },
  logLevel: "off",
})

const projectFolder = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/node`

await bundleNode({
  projectFolder,
  bundleIntoRelativePath,
  entryPointMap: {
    main: `${folderJsenvRelativePath}/http.js`,
  },
  logLevel: "off",
})

const { namespace: actual } = await importNodeBundle({
  bundleFolder: `${projectFolder}${bundleIntoRelativePath}`,
  file: "main.js",
})
const expected = 42
assert({ actual, expected })

server.stop()
