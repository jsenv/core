import { resolveDirectoryUrl, urlToRelativePath } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startExploring } from "../../index.js"
import { START_EXPLORING_TEST_PARAMS } from "./TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const compileDirectoryRelativePath = `${testDirectoryRelativePath}.dist/`

startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  logLevel: "info",
  compileServerLogLevel: "info",
  compileDirectoryRelativePath,
  explorableConfig: {
    [`./${testDirectoryRelativePath}**/*.main.js`]: true,
    [`./${testDirectoryRelativePath}**/.dist/**`]: false,
  },
  protocol: "https",
  port: 3400,
  forcePort: true,
  livereloading: true,
  keepProcessAlive: true,
})
