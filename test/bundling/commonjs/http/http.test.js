import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startServer } from "../../../../src/server/index.js"
import { generateCommonJsBundle } from "../../../../index.js"
import { requireCommonJsBundle } from "../require-commonjs-bundle.js"
import {
  COMMONJS_BUNDLING_TEST_GENERATE_PARAM,
  COMMONJS_BUNDLING_TEST_REQUIRE_PARAM,
} from "../commonjs-bundling-test-param.js"

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
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/commonjs`

await generateCommonJsBundle({
  ...COMMONJS_BUNDLING_TEST_GENERATE_PARAM,
  bundleIntoRelativePath,
  entryPointMap: {
    main: `${folderJsenvRelativePath}/http.js`,
  },
})

const { namespace: actual } = await requireCommonJsBundle({
  ...COMMONJS_BUNDLING_TEST_REQUIRE_PARAM,
  bundleIntoRelativePath,
})
const expected = 42
assert({ actual, expected })

server.stop()
