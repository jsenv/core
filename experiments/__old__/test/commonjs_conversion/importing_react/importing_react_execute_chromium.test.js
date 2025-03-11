import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { execute, chromiumRuntime, commonJsToJsModule } from "@jsenv/core"
import { require } from "@jsenv/core/src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_EXECUTE.js"

const transformReactJSX = require("@babel/plugin-transform-react-jsx")

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const { status, namespace } = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl: `${testDirectoryRelativeUrl}.jsenv/`,
  customCompilers: {
    "./node_modules/react/index.js": commonJsToJsModule,
    "./node_modules/react-dom/index.js": async (options) => {
      return commonJsToJsModule({
        ...options,
        external: ["react"],
      })
    },
  },
  babelPluginMap: {
    "transform-react-jsx": [
      transformReactJSX,
      { pragma: "React.createElement", pragmaFrag: "React.Fragment" },
    ],
  },
  runtime: chromiumRuntime,
  stopAfterExecute: true,
  mirrorConsole: false, // avoid "donwload react dev tools" log
  fileRelativeUrl: `${testDirectoryRelativeUrl}importing_react.html`,
})

const actual = {
  status,
  namespace,
}
const expected = {
  status: "completed",
  namespace: {
    "./importing_react.jsx": {
      status: "completed",
      namespace: {
        reactExportNames: [
          "Children",
          "Component",
          "Fragment",
          "Profiler",
          "PureComponent",
          "StrictMode",
          "Suspense",
          "__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED",
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
        ready: 42,
      },
    },
  },
}
assert({ actual, expected })
