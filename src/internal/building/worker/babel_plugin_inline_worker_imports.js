import { resolveUrl, fileSystemPathToUrl } from "@jsenv/filesystem"

export const babelPluginInlineWorkerImports = (api, { inline }) => {
  const { types, parse } = api
  return {
    name: "transform-inline-worker-imports",

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
              const importedScriptResult = inline(importedUrl, fileUrl)
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
