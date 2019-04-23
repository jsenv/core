import { uneval } from "@dmail/uneval"
import { serveBundle } from "../bundle-service/index.js"
import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { WELL_KNOWN_BROWSER_PLATFORM_PATHNAME } from "../browser-platform-service/index.js"

export const WELL_KNOWN_BROWSING_BUNDLE_DYNAMIC_DATA_PATHNAME =
  "/.jsenv-well-kown/browsing-script-data.js"
const BROWSING_BUNDLE_FILENAME_RELATIVE =
  "node_modules/@jsenv/core/src/browsing-server/browsing-bundle-template.js"
const BROWSING_BUNDLE_STATIC_DATA_SPECIFIER = "BROWSING_BUNDLE_STATIC_DATA.js"

export const serveBrowsingBundle = ({
  projectFolder,
  importMapFilenameRelative,
  compileInto,
  babelConfigMap,
  ressource,
  headers,
}) => {
  const filenameRelative = ressource.slice(1)

  return serveBundle({
    projectFolder,
    importMapFilenameRelative,
    compileInto,
    babelConfigMap,
    filenameRelative: `${filenameRelative}__browsing-bundle__.js`,
    sourceFilenameRelative: filenameRelativeInception({
      projectFolder,
      filenameRelative: BROWSING_BUNDLE_FILENAME_RELATIVE,
    }),
    inlineSpecifierMap: {
      [BROWSING_BUNDLE_STATIC_DATA_SPECIFIER]: () =>
        generateBrowsingBundleStaticDataSource({ filenameRelative }),
    },
    headers,
  })
}

const generateBrowsingBundleStaticDataSource = ({ filenameRelative }) =>
  `export const WELL_KNOWN_BROWSER_PLATFORM_PATHNAME = ${uneval(
    WELL_KNOWN_BROWSER_PLATFORM_PATHNAME,
  )}
  export const WELL_KNOWN_BROWSING_BUNDLE_DYNAMIC_DATA_PATHNAME = ${uneval(
    WELL_KNOWN_BROWSING_BUNDLE_DYNAMIC_DATA_PATHNAME,
  )}
  export const filenameRelative = ${uneval(filenameRelative)}`
