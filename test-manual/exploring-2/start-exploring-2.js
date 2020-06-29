/**

TODO:

- voir comment on va gérer ça dans exploring mais a priori exploring se simplifie
puisqu'il s'agit juste d'ouvrir une page html compilé par compile serveur

- mettre livereload dans compile server au lieu d'avoir une interface pour que exploring l'implémente
(mais ça suppose que livereload se fait quoi qu'il arrive alors que ça peut etre couteux)
a voir... (ça permettrais possiblement d'avoir du livereload sur des bundles chose qu'on a pas du tout pour le moment)

- restaurer error stack dans jsenv-browser-system.js (comme browser-js-file)

*/

import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { startCompileServer } from "../../src/internal/compiling/startCompileServer.js"
import { jsenvCoreDirectoryUrl } from "../../src/internal/jsenvCoreDirectoryUrl.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

startCompileServer({
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  compileServerProtocol: "http",
  compileServerPort: 3456,
  keepProcessAlive: true,
  jsenvDirectoryClean: true,
})

// /test-manual/exploring-2/.jsenv/out/otherwise/test-manual/exploring-2/basic/basic.html
