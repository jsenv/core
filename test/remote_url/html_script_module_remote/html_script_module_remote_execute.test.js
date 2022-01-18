import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, chromiumRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_BROWSER.js"

const { server } = await import("./server/serve.js")
try {
  const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
  const testDirectoryRelativeUrl = urlToRelativeUrl(
    testDirectoryUrl,
    jsenvCoreDirectoryUrl,
  )
  const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
  const fileRelativeUrl = `${testDirectoryRelativeUrl}main.html`
  const getImportMetaUrl = async (params) => {
    const { compileServerOrigin, namespace } = await execute({
      ...EXECUTE_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      runtime: chromiumRuntime,
      runtimeParams: {
        ...LAUNCH_TEST_PARAMS,
      },
      fileRelativeUrl,
      ...params,
    })
    const importMetaUrl = namespace[Object.keys(namespace)[0]].namespace.url
    return { importMetaUrl, compileServerOrigin }
  }

  // source -> remote url preserved
  {
    const { importMetaUrl } = await getImportMetaUrl()
    const actual = {
      importMetaUrl,
    }
    const expected = {
      importMetaUrl: `http://127.0.0.1:9999/file.js`,
    }
    assert({ actual, expected })
  }

  // source + disabled using preservedUrls -> remote url preserved
  {
    const { importMetaUrl } = await getImportMetaUrl({
      preservedUrls: {
        "http://127.0.0.1:9999/": false,
      },
    })
    const actual = {
      importMetaUrl,
    }
    const expected = {
      importMetaUrl: `http://127.0.0.1:9999/file.js`,
    }
    assert({ actual, expected })
  }

  // compiled -> remote url preserved
  {
    const { importMetaUrl } = await getImportMetaUrl({
      runtimeParams: {
        ...LAUNCH_TEST_PARAMS,
        forceCompilation: true,
      },
    })
    const actual = {
      importMetaUrl,
    }
    const expected = {
      importMetaUrl: `http://127.0.0.1:9999/file.js`,
    }
    assert({ actual, expected })
  }

  // compiled + disabled using preservedUrls -> remote url becomes local
  {
    const { importMetaUrl, compileServerOrigin } = await getImportMetaUrl({
      runtimeParams: {
        ...LAUNCH_TEST_PARAMS,
        forceCompilation: true,
      },
      preservedUrls: {
        "http://127.0.0.1:9999/": false,
      },
      collectCompileServerInfo: true,
    })
    const actual = {
      importMetaUrl,
    }
    const expected = {
      importMetaUrl: `${compileServerOrigin}/${jsenvDirectoryRelativeUrl}dev/best/${jsenvDirectoryRelativeUrl}.remote/http$3a$2f$2f127.0.0.1$3a9999/file.js`,
    }
    assert({ actual, expected })
  }
} finally {
  server.stop()
}
