import { normalizePathname } from "@jsenv/module-resolution"
import { createCancellationToken } from "@dmail/cancellation"
import {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
  pathnameToMeta,
} from "@dmail/project-structure"
import { uneval } from "@dmail/uneval"
import { startServer, serviceCompose } from "../server/index.js"
import { startCompileServer } from "../server-compile/index.js"
import { guard } from "../functionHelper.js"
import { serveFile } from "../serve-file/index.js"
import {
  DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  DEFAULT_BROWSER_GROUP_RESOLVER_FILENAME_RELATIVE,
  DEFAULT_COMPILE_INTO,
  DEFAULT_BROWSABLE_DESCRIPTION,
  DEFAULT_BABEL_CONFIG_MAP,
} from "./browsing-server-constant.js"

export const startBrowsingServer = async ({
  projectFolder,
  cancellationToken = createCancellationToken(),
  babelConfigMap = DEFAULT_BABEL_CONFIG_MAP,
  importMapFilenameRelative = DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  browserGroupResolveFilenameRelative = DEFAULT_BROWSER_GROUP_RESOLVER_FILENAME_RELATIVE,
  compileInto = DEFAULT_COMPILE_INTO,
  compileGroupCount = 2,
  browsableDescription = DEFAULT_BROWSABLE_DESCRIPTION,
  cors = true,
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  forcePort = false,
  signature,

  generateHTML = ({ filenameRelative, systemScriptSrc, selfExecuteScriptSrc }) => `<!doctype html>

<head>
  <title>browsing ${filenameRelative}</title>
  <meta charset="utf-8" />
</head>

<body>
  <main></main>
  <script src="${systemScriptSrc}"></script>
  <script src="${selfExecuteScriptSrc}"></script>
</body>

</html>`,
}) => {
  projectFolder = normalizePathname(projectFolder)
  const metaDescription = namedValueDescriptionToMetaDescription({
    browsable: browsableDescription,
  })

  const { origin: compileServerOrigin } = await startCompileServer({
    cancellationToken,
    projectFolder,
    importMapFilenameRelative,
    browserGroupResolveFilenameRelative,
    compileInto,
    compileGroupCount,
    babelConfigMap,
    cors,
    protocol,
    ip,
    port: 0, // random available port
    forcePort: false, // no need because random port
    signature,
  })

  const indexPageService = guard(
    ({ ressource, method }) => {
      if (ressource !== "/") return false
      if (method !== "GET") return false
      return true
    },
    async () => {
      const browsableFilenameRelativeArray = await selectAllFileInsideFolder({
        pathname: projectFolder,
        metaDescription,
        predicate: ({ browsable }) => browsable,
        transformFile: ({ filenameRelative }) => filenameRelative,
      })

      const html = await getIndexPageHTML({
        projectFolder,
        browsableFilenameRelativeArray,
      })

      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "text/html",
          "content-length": Buffer.byteLength(html),
        },
        body: html,
      }
    },
  )

  const selfExecuteScriptService = guard(
    ({ method, ressource }) => {
      if (method !== "GET") return false
      if (ressource.endsWith("__execute__.js")) return true
      return false
    },
    async ({ ressource }) => {
      const filenameRelative = ressource.slice(1, -`__execute__.js`.length)
      const source = generateSelfImportSource({
        compileInto,
        compileServerOrigin,
        filenameRelative,
      })

      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/javascript",
          "content-length": Buffer.byteLength(source),
        },
        body: source,
      }
    },
  )

  const executeScriptService = guard(
    ({ method, ressource }) => {
      return method === "GET" && pathnameToMeta({ pathname: ressource, metaDescription }).browsable
    },
    async ({ ressource }) => {
      const html = await generateHTML({
        compileInto,
        compileServerOrigin,
        filenameRelative: ressource.slice(1),
        systemScriptSrc: `${compileServerOrigin}/${compileInto}/SYSTEM.js`,
        selfExecuteScriptSrc: `${ressource}__execute__.js`,
      })

      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "text/html",
          "content-length": Buffer.byteLength(html),
        },
        body: html,
      }
    },
  )

  const fileService = ({ ressource, method, headers }) => {
    return serveFile(`${projectFolder}${ressource}`, { method, headers })
  }

  const browserServer = await startServer({
    cancellationToken,
    protocol,
    ip,
    port,
    forcePort,
    requestToResponse: serviceCompose(
      indexPageService,
      selfExecuteScriptService,
      executeScriptService,
      fileService,
    ),
    startedMessage: ({ origin }) => `browser server started for ${projectFolder} at ${origin}`,
    stoppedMessage: (reason) => `browser server stopped because ${reason}`,
  })
  return browserServer
}

// we could turn generateSelfImportSource into a dynamic rollup bundles
// but it takes times without adding much benefit
// so for now let's keep it like that
const generateSelfImportSource = ({ compileInto, compileServerOrigin, filenameRelative }) => `
window.System.import(${uneval(
  `${compileServerOrigin}/${compileInto}/JSENV_BROWSER_CLIENT.js`,
)}).then(({ executeCompiledFile }) => {
  executeCompiledFile({
    compileInto: ${uneval(compileInto)},
    compileServerOrigin: ${uneval(compileServerOrigin)},
    filenameRelative: ${uneval(filenameRelative)},
  })
})
`

const getIndexPageHTML = async ({ projectFolder, browsableFilenameRelativeArray }) => {
  return `<!doctype html>

  <head>
    <title>Browsing ${projectFolder}</title>
    <meta charset="utf-8" />
  </head>

  <body>
    <main>
      <h1>${projectFolder}</h1>
      <p>List of path to browse: </p>
      <ul>
        ${browsableFilenameRelativeArray
          .sort()
          .map(
            (filenameRelative) => `<li><a href="/${filenameRelative}">${filenameRelative}</a></li>`,
          )
          .join("")}
      </ul>
    </main>
  </body>
  </html>`
}
