import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { execute, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.js`

/**
 * ok reste que avec nodejs13 on ne peut pas réécrire a la volée /.jsenv/groupMap.json
 * donc il faudrait le passer en param ?
 * ou alors passer le chemin vers le fichier en param puisque c'est dynamique
 * (de plus il faut activer le experimental json loading support)
 * donc en théorie c'est faisable
 *
 * pour outDirectoryRelativeUrl et importDefaultExtension
 * qui sont dans /.jsenv/env.js par contre comment je fait ?
 * il faut que je me rapelle pourquoi ces valeurs sont dynamique
 * au lieu d'etre recu par nodePlatform lorsqu'on fait createNodePlatform
 *
 * en gros il reste des choses a définir
 */

;(async () => {
  const actual = await execute({
    ...EXECUTE_TEST_PARAMS,
    // logLevel: "debug",
    jsenvDirectoryRelativeUrl,
    launch: (options) => launchNode({ ...options, debugPort: 40001 }),
    fileRelativeUrl,
  })
  const expected = {
    status: "completed",
  }
  assert({ actual, expected })
})()
