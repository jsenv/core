import { readFileSync } from "fs"
import { resolveUrl, urlToFileSystemPath, fileSystemPathToUrl } from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"
import { require } from "@jsenv/core/src/internal/require.js"

export const bundleWorker = ({ workerScriptUrl, workerScriptSourceMap }) => {
  const { code, map } = transformWorkerScript(workerScriptUrl, { workerScriptSourceMap })
  return { code, map }
}

const transformWorkerScript = (scriptUrl, { workerScriptSourceMap, importerUrl }) => {
  const scriptPath = urlToFileSystemPath(scriptUrl)
  let scriptContent
  try {
    scriptContent = String(readFileSync(scriptPath))
  } catch (e) {
    if (e.code === "ENOENT") {
      if (importerUrl) {
        throw new Error(
          createDetailedMessage(`no file found for an import in a worker.`, {
            ["worker url"]: importerUrl,
            ["imported url"]: scriptUrl,
          }),
        )
      }
      throw new Error(`no worker file at ${scriptUrl}`)
    }
    throw e
  }

  const { transformSync } = require("@babel/core")
  const { code, map } = transformSync(scriptContent, {
    filename: scriptPath,
    configFile: false,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: false,
    inputSourceMap: workerScriptSourceMap,
    sourceMaps: true,
    // sourceFileName: scriptPath,
    plugins: [[babelPluginInlineImportScripts, {}]],
  })
  return { code, map }
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

          let previousArgType = ""
          const importedUrls = path.get("arguments").map((arg, index) => {
            if (!types.isStringLiteral(arg)) {
              if (previousArgType && previousArgType !== "dynamic") {
                throw new Error(
                  `importScript mixed arguments: arg number ${index} is dynamic while previous arg was ${previousArgType}`,
                )
              }
              previousArgType = "dynamic"
              return arg
            }
            const importedUrl = resolveUrl(arg.node.value, fileUrl)
            if (!importedUrl.startsWith("file://")) {
              if (previousArgType && previousArgType !== "remote") {
                throw new Error(
                  `importScript mixed arguments: arg number ${index} targets a remote url while previous arg was ${previousArgType}`,
                )
              }
              previousArgType = "remote"
              return arg
            }
            previousArgType = "local"
            return importedUrl
          })

          if (previousArgType === "local") {
            const nodes = importedUrls.reduce((previous, importedUrl) => {
              const importedScriptResult = transformWorkerScript(importedUrl, {
                importerUrl: fileUrl,
              })
              const importedSourceAst = parse(importedScriptResult.code)
              return [...previous, ...importedSourceAst.program.body]
            }, [])

            calleePath.parentPath.replaceWithMultiple(nodes)
          }
        }

        if (types.isIdentifier(calleePath.node, { name: "importScripts" })) {
          replaceImportScriptsWithFileContents()
          return
        }

        if (types.isMemberExpression(calleePath.node)) {
          const calleeObject = calleePath.get("object")
          const isSelf = types.isIdentifier(calleeObject.node, { name: "self" })
          if (isSelf) {
            const propertyPath = calleePath.get("property")
            if (types.isIdentifier(propertyPath.node, { name: "importScripts" })) {
              replaceImportScriptsWithFileContents()
              return
            }
          }
        }
      },
    },
  }
}
