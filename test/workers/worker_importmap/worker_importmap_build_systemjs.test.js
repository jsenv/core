/*
 * When worker rely on importmap the code MUST be transformed to systemjs format
 * because it's impossible to change how browser resolve import without systemjs
 * Nothing in "buildProject" is throwing/warning about that so when worker
 * rely on importmap users have to format: 'systemjs' to generate valid code
 */

/*
 * Things to do:
 * - inject systemjs in the worker
 *   ça faudra la faire aussi pendant le dev
 *   donc en gros il s'agit d'un truc a faire lorsque le fichier est un worker
 *   (mais on pourrait presque dire lorsque le fichier est un point d'entré)
 *   et on pourrait alors supprimer le fait qu'on inline systemjs dans la page
 *   sauf que le point d'entrée c'est du HTML donc non
 * when systemjs is injected in a worker (or all the time with feature detection)
 * - install specific code requesting importmap from parent page
 * - on parent page, install code sending importmap (all the time)
 */

import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}main.html`]: "main.html",
  },
  workers: {
    [`${testDirectoryRelativeUrl}worker.js`]: "worker_toto_[hash].js",
  },
})

const { namespace } = await browserImportEsModuleBuild({
  ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
  testDirectoryRelativeUrl,
  codeToRunInBrowser: "window.namespacePromise",
  // debug: true,
})

const actual = namespace
const expected = {
  worker: {
    value: 42,
    pingResponse: "pong",
  },
}
assert({ actual, expected })
