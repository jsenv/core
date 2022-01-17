import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, chromiumRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_BROWSER.js"

const { server } = await import("./script/serve.js")
try {
  const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
  const testDirectoryRelativeUrl = urlToRelativeUrl(
    testDirectoryUrl,
    jsenvCoreDirectoryUrl,
  )
  const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
  const fileRelativeUrl = `${testDirectoryRelativeUrl}main.html`

  // http url preserved by default
  {
    const { namespace } = await execute({
      ...EXECUTE_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      runtime: chromiumRuntime,
      runtimeParams: {
        ...LAUNCH_TEST_PARAMS,
      },
      fileRelativeUrl,
    })
    const actual = {
      namespace,
    }
    const expected = {
      namespace: {
        "./main.js": {
          status: "completed",
          namespace: {
            url: "http://localhost:9999/constants.js?foo=bar",
          },
        },
      },
    }
    assert({ actual, expected })
  }

  // http url preserved by default, even when code needs to be compiled
  {
    const { namespace } = await execute({
      ...EXECUTE_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      runtime: chromiumRuntime,
      runtimeParams: {
        ...LAUNCH_TEST_PARAMS,
        forceCompilation: true,
      },
      fileRelativeUrl,
    })
    const actual = {
      namespace,
    }
    const expected = {
      namespace: {
        "./main.js": {
          status: "completed",
          namespace: {
            url: "http://localhost:9999/constants.js?foo=bar",
          },
        },
      },
    }
    assert({ actual, expected })
  }

  // http url not preserved
  {
    const { namespace, compileServerOrigin } = await execute({
      ...EXECUTE_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      runtime: chromiumRuntime,
      runtimeParams: {
        ...LAUNCH_TEST_PARAMS,
        forceCompilation: true,
      },
      fileRelativeUrl,
      preservedUrls: {
        "http://localhost:9999/": false,
      },
      collectCompileServerInfo: true,
    })
    const actual = {
      namespace,
    }
    const expected = {
      namespace: {
        "./main.js": {
          status: "completed",
          namespace: {
            url: `${compileServerOrigin}/${jsenvDirectoryRelativeUrl}dev/best/${jsenvDirectoryRelativeUrl}.remote/http$3a$2f$2flocalhost$3a9999/constants.js?foo=bar`,
          },
        },
      },
    }
    assert({ actual, expected })
  }
} finally {
  server.stop()
}
