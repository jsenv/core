import {
  resolveUrl,
  fileSystemPathToUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"

export const babelPluginInlineWorkerImports = (
  babel,
  { readImportedScript },
) => {
  const { types } = babel

  return {
    name: "transform-inline-worker-imports",

    visitor: {
      CallExpression: (path, opts) => {
        const calleePath = path.get("callee")

        const replaceImportScriptsWithFileContents = () => {
          const filename = opts.filename
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
              const importedScriptCode = readImportedScript(importedUrl)
              const { ast } = babel.transformSync(importedScriptCode, {
                filename: urlToFileSystemPath(importedUrl),
                configFile: false,
                babelrc: false, // trust only these options, do not read any babelrc config file
                ast: true,
                sourceMaps: true,
                // sourceFileName: scriptPath,
                plugins: [
                  [
                    babelPluginInlineWorkerImports,
                    {
                      readImportedScript,
                    },
                  ],
                ],
              })
              return [...previous, ...ast.program.body]
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
            if (
              types.isIdentifier(propertyPath.node, { name: "importScripts" })
            ) {
              replaceImportScriptsWithFileContents()
              return
            }
          }
        }
      },
    },
  }
}
