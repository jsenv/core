import { assert } from "@dmail/assert"
import { selfHrefToFolderRelativePath } from "../self-href-to-folder-relative-path.js"
import { launchNode } from "../../index.js"
import {
  NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  NODE_LAUNCHER_TEST_PARAM,
} from "../node-launcher-test-param.js"

const { startCompileServer } = import.meta.require("@jsenv/compile-server")
const { launchAndExecute } = import.meta.require("@jsenv/execution")

const folderRelativePath = selfHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const fileRelativePath = `${folderRelativePath}/leading-slash.js`
const { origin: compileServerOrigin } = await startCompileServer({
  ...NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  compileIntoRelativePath,
  importMapRelativePath: `${compileIntoRelativePath}/importMap.json`,
})

const actual = await launchAndExecute({
  ...NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  launch: (options) =>
    launchNode({
      ...NODE_LAUNCHER_TEST_PARAM,
      ...options,
      compileServerOrigin,
      compileIntoRelativePath,
    }),
  fileRelativePath,
})

// leading slash will not work
// for now because it would try to fetch the source file
// instead of asking server for the compiled file
// resulting in an instantiation error due to unexpected
// export token.
// It could certainly be fixed using importMap
// so that any import ocurring inside /.dist/best/ stays inside
// even if it starts with '/'.
// for now let's just avoid leading slash
const expected = {
  status: "errored",
  error: actual.error,
}
assert({ actual, expected })

{
  const actual = actual.error.code
  const expected = "MODULE_INSTANTIATION_ERROR"
  assert({ actual, expected })
}
