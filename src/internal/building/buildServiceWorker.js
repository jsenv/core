import { readFileSync } from "fs"
import {
  resolveUrl,
  urlToFileSystemPath,
  fileSystemPathToUrl,
  urlToFilename,
  writeFile,
  urlToParentUrl,
} from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"
import { minifyJs } from "@jsenv/core/src/internal/building/js/minifyJs.js"
import { setJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"

const { transformSync } = require("@babel/core")

export const buildServiceWorker = async ({
  projectDirectoryUrl,
  buildDirectoryUrl,
  serviceWorkerProjectRelativeUrl,
  serviceWorkerBuildRelativeUrl = serviceWorkerProjectRelativeUrl,
  codeToInjectBeforeServiceWorker = "",
  minify = false,
}) => {
  const serviceWorkerProjectUrl = resolveUrl(serviceWorkerProjectRelativeUrl, projectDirectoryUrl)
  const serviceWorkerBuildUrl = resolveUrl(serviceWorkerBuildRelativeUrl, buildDirectoryUrl)

  let serviceWorkerCode = `
${codeToInjectBeforeServiceWorker}
${transformSwScript(serviceWorkerProjectUrl)}`

  if (!minify) {
    await writeFile(serviceWorkerBuildUrl, serviceWorkerCode)
    return
  }

  const minifyResult = await minifyJs(serviceWorkerCode, serviceWorkerProjectRelativeUrl, {
    sourceMap: {
      asObject: true,
    },
  })
  serviceWorkerCode = minifyResult.code

  const filename = urlToFilename(serviceWorkerBuildUrl)
  const sourcemapFilename = `${filename}.map`
  const sourcemapBuildUrl = `${urlToParentUrl(serviceWorkerBuildUrl)}${sourcemapFilename}`
  serviceWorkerCode = setJavaScriptSourceMappingUrl(serviceWorkerCode, sourcemapFilename)
  await Promise.all([
    writeFile(serviceWorkerBuildUrl, serviceWorkerCode),
    writeFile(sourcemapBuildUrl, JSON.stringify(minifyResult.map, null, "  ")),
  ])
}

const transformSwScript = (scriptUrl) => {
  const scriptPath = urlToFileSystemPath(scriptUrl)
  const scriptContent = readFileSync(scriptPath)
  const { code } = transformSync(scriptContent, {
    filename: scriptPath,
    configFile: false,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: false,
    sourceMaps: false,
    // sourceFileName: scriptPath,
    plugins: [[babelPluginInlineImportScripts, {}]],
  })
  return code
}

const babelPluginInlineImportScripts = (api) => {
  const { types, parse } = api
  return {
    name: "transform-inline-import-scripts",

    visitor: {
      CallExpression: (
        path,
        {
          file: {
            opts: { filename },
          },
        },
      ) => {
        const calleePath = path.get("callee")

        const replaceImportScriptsWithFileContents = () => {
          const fileUrl = fileSystemPathToUrl(filename)

          const nodes = path.get("arguments").reduce((previous, arg) => {
            if (!types.isStringLiteral(arg)) {
              throw new Error(`cannot inline dynamic importScripts`)
            }
            const importedUrl = resolveUrl(arg.node.value, fileUrl)
            const importedSource = transformSwScript(importedUrl)
            const importedSourceAst = parse(importedSource)
            return [...previous, ...importedSourceAst.program.body]
          }, [])

          calleePath.parentPath.replaceWithMultiple(nodes)
        }

        if (types.isIdentifier(calleePath.node, { name: "importScripts" })) {
          replaceImportScriptsWithFileContents()
          return
        }

        if (types.isMemberExpression(calleePath.node)) {
          const calleeObject = calleePath.get("object")
          const isSelf = types.isIdentifier(calleeObject.node, { name: "self" })
          if (isSelf) {
            replaceImportScriptsWithFileContents()
            return
          }
        }
      },
    },
  }
}
