import { uneval } from "@dmail/uneval"
import { serveBundle } from "../bundle-service/index.js"
import { filenameRelativeInception } from "../filenameRelativeInception.js"

const BROWSING_DATA_SPECIFIER = "BROWSING_DATA.js"
const BROWSING_SCRIPT_FILENAME_RELATIVE =
  "node_modules/@jsenv/core/src/browsing-server/browsing-script-template.js"

export const serveBrowsingScript = ({
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
    filenameRelative: `${filenameRelative}__browsing.js`,
    sourceFilenameRelative: filenameRelativeInception({
      projectFolder,
      filenameRelative: BROWSING_SCRIPT_FILENAME_RELATIVE,
    }),
    inlineSpecifierMap: {
      [BROWSING_DATA_SPECIFIER]: () => generateBrowsingDataSource({ filenameRelative }),
    },
    headers,
  })
}

const generateBrowsingDataSource = ({ filenameRelative }) =>
  `export const filenameRelative = ${uneval(filenameRelative)}`
