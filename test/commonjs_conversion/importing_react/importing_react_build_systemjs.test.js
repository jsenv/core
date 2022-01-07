import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject, commonJsToJavaScriptModule } from "@jsenv/core"
import { require } from "@jsenv/core/src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"

const transformReactJSX = require("@babel/plugin-transform-react-jsx")

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `importing_react.html`
const customCompilers = {
  "./node_modules/react/index.js": (options) => {
    return commonJsToJavaScriptModule({
      ...options,
      processEnvNodeEnv: "production",
    })
  },
  "./node_modules/react-dom/index.js": async (options) => {
    return commonJsToJavaScriptModule({
      ...options,
      // BEWARE: IF YOU FORGET THIS (putting node env to production for react-dom as well)
      // the code generated never resolves
      processEnvNodeEnv: "production",
      external: ["react"],
    })
  },
}
const { projectBuildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  // filesystemCache: true,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.html",
  },
  customCompilers,
  babelPluginMap: {
    "transform-react-jsx": [
      transformReactJSX,
      { pragma: "React.createElement", pragmaFrag: "React.Fragment" },
    ],
  },
})
const mainJsBuildRelativeUrl =
  projectBuildMappings[`${testDirectoryRelativeUrl}importing_react.jsx`]
const { namespace } = await browserImportSystemJsBuild({
  ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
  testDirectoryRelativeUrl,
  mainRelativeUrl: `./${mainJsBuildRelativeUrl}`,
  // debug: true,
})

const actual = namespace
const expected = {
  ready: 42,
  reactExportNames: [
    "Children",
    "Component",
    "Fragment",
    "Profiler",
    "PureComponent",
    "StrictMode",
    "Suspense",
    "__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED",
    "__moduleExports",
    "cloneElement",
    "createContext",
    "createElement",
    "createFactory",
    "createRef",
    "default",
    "forwardRef",
    "isValidElement",
    "lazy",
    "memo",
    "useCallback",
    "useContext",
    "useDebugValue",
    "useEffect",
    "useImperativeHandle",
    "useLayoutEffect",
    "useMemo",
    "useReducer",
    "useRef",
    "useState",
    "version",
  ],
}
assert({ actual, expected })
