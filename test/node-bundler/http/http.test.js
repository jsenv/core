import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startServer } from "../../../src/server/index.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"
import {
  NODE_BUNDLER_TEST_PARAM,
  NODE_BUNDLER_TEST_IMPORT_PARAM,
} from "../node-bundler-test-param.js"

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

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/node`

await bundleNode({
  ...NODE_BUNDLER_TEST_PARAM,
  bundleIntoRelativePath,
  entryPointMap: {
    main: `${folderJsenvRelativePath}/http.js`,
  },
})

const { namespace: actual } = await importNodeBundle({
  ...NODE_BUNDLER_TEST_IMPORT_PARAM,
  bundleIntoRelativePath,
})
const expected = 42
assert({ actual, expected })

server.stop()
