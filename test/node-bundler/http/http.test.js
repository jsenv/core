import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
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

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = `${ROOT_FOLDER}`
const bundleInto = `${testFolderRelative}/dist/node`

await bundleNode({
  projectFolder,
  into: bundleInto,
  entryPointMap: {
    main: `${testFolderRelative}/http.js`,
  },
  logBundleFilePaths: false,
})

const { namespace: actual } = await importNodeBundle({
  bundleFolder: `${projectFolder}/${bundleInto}`,
  file: "main.js",
})
const expected = 42
assert({ actual, expected })

server.stop()
