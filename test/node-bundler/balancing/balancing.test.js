import { assert } from "@dmail/assert"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const projectPath = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/node`
const fileRelativePath = `${folderJsenvRelativePath}/balancing.js`

await bundleNode({
  projectPath,
  bundleIntoRelativePath,
  entryPointMap: {
    main: fileRelativePath,
  },
  compileGroupCount: 2,
  throwUnhandled: false,
  logLevel: "off",
})

const { namespace: actual } = await importNodeBundle({
  bundleFolder: `${projectPath}${bundleIntoRelativePath}`,
  file: `main.js`,
})
const expected = Object.assign(
  Object.defineProperty({}, "__esModule", {
    value: true,
  }),
  { answer: 42 },
)
assert({ actual, expected })
