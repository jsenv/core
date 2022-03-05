import { pathToFileUrl, fileURLToPath } from "node:url"

import { isFileSystemPath, urlIsInsideOf } from "@jsenv/filesystem"

import { filesystemRootUrl, moveUrl } from "@jsenv/core/src/utils/url_utils.js"
import { fetchUrl } from "@jsenv/core/src/utils/fetching.js"
import { createMagicSource } from "@jsenv/core/src/utils/js_ast/magic_source.js"

export const rollupPluginJsenv = ({ projectDirectoryUrl, server }) => {
  const ressourceBuilder = {}

  const asServerUrl = (path) => {
    const fileUrl = pathToFileUrl(path).href
    if (urlIsInsideOf(fileUrl, projectDirectoryUrl)) {
      const serverUrl = moveUrl(
        fileUrl,
        projectDirectoryUrl,
        `${server.origin}/`,
      )
      return serverUrl
    }
    return `/@fs/${fileUrl.slice(filesystemRootUrl.length)}`
  }

  return {
    name: "jsenv",

    resolveId: ({ specifier, importer }) => {
      if (isFileSystemPath(importer)) {
        importer = pathToFileUrl(importer).href
      }
      const url = new URL(specifier, importer).href
      if (!url.startsWith("file:")) {
        return { url, external: true }
      }
      return fileURLToPath(url)
    },

    async load(rollupId) {
      const serverUrl = asServerUrl(rollupId)
      const response = await fetchUrl(serverUrl)
      // when something is not found or syntax error etc
      // we want to get this information in response status
      // and re-throw it here
      const text = await response.text()
      return {
        code: text,
      }
    },

    async transform(code, rollupId) {
      const serverUrl = asServerUrl(rollupId)
      const ast = this.parse(code, {
        locations: true, // used to know node line and column
      })
      const mutations = []
      // a-t-on vraiment besoin de cela?
      // le serveur connait déja cette info
      // on pourrait s'abonner a un signal du serveur
      // par contre le serveur ne va pas modifier l'url comme on le souhaite
      // pour cela il faudrait pouvoir dire au serveur:
      // referenceToCodeForRollup(reference)
      await visitImportReferences({
        ast,
        onReferenceWithImportMetaUrlPattern: async ({ importNode }) => {
          const specifier = importNode.arguments[0].value
          const { line, column } = importNode.loc.start
          // not needed because the server returns the url already resolved
          const { id } = normalizeRollupResolveReturnValue(
            await this.resolve(specifier, rollupId),
          )
          const ressourceServerUrl = asServerUrl(id)
          const reference = ressourceBuilder.createReferenceFoundInJsModule({
            referenceLabel: "URL + import.meta.url",
            jsUrl: serverUrl,
            jsLine: line,
            jsColumn: column,
            ressourceSpecifier: ressourceServerUrl,
          })
          if (!reference) {
            return
          }
          if (!reference.ressource.isJsModule) {
            // so that ressource.buildRelativeUrl is known during "resolveFileUrl" hook`
            await reference.ressource.getReadyPromise()
          }
          mutations.push((magicSource) => {
            magicSource.replace({
              start: importNode.start,
              end: importNode.end,
              replacement: referenceToCodeForRollup(reference),
            })
          })
        },
        onReferenceWithImportAssertion: async ({
          importNode,
          typePropertyNode,
          assertions,
        }) => {
          // soit c'est supporté par le runtime et le serveur retourne
          // import "file.css" assert { type: "css" }
          // soit ça ne l'est pas et on reçoit
          // import "file.css?css_module"
          // dans le second cas on pourrait le détecter
          // et utiliser un custom loader

          const { source } = importNode
          const importSpecifier = source.value
          const { line, column } = importNode.loc.start
          // "type" is dynamic on dynamic import such as
          // import("./data.json", {
          //   assert: {
          //     type: true ? "json" : "css"
          //    }
          // })
          if (typePropertyNode) {
            const typePropertyValue = typePropertyNode.value
            assertions = {
              type: typePropertyValue.value,
            }
          }
          const { type } = assertions
          // "specifier" is dynamic on dynamic import such as
          // import(true ? "./a.json" : "b.json", {
          //   assert: {
          //     type: "json"
          //    }
          // })
          const importAssertionSupportedByRuntime =
            importAssertionsSupport[type]

          const { id, external } = normalizeRollupResolveReturnValue(
            await this.resolve(importSpecifier, rollupId, {
              custom: {
                importAssertionInfo: {
                  line,
                  column,
                  type,
                  supportedByRuntime: importAssertionSupportedByRuntime,
                },
              },
            }),
          )
          // remove import
          let ressourceUrl = asServerUrl(id)
          // lod the asset without ?import_type in it
          ressourceUrl = ressourceUrl.replace(`?import_type=${type}`, "")
          const fileReference = ressourceBuilder.createReferenceFoundInJsModule(
            {
              referenceLabel: `${type} import assertion`,
              // If all references to a ressource are only import assertions
              // the file referenced do not need to be written on filesystem
              // as it was converted to a js file
              // We pass "isImportAssertion: true" for this purpose
              isImportAssertion: true,
              jsUrl: serverUrl,
              jsLine: line,
              jsColumn: column,
              ressourceSpecifier: ressourceUrl,
              contentTypeExpected:
                type === "css" ? "text/css" : "application/json",
            },
          )
          // reference can be null for cross origin urls
          if (!fileReference) {
            return
          }
          if (external && !importAssertionSupportedByRuntime) {
            throw new Error(
              createDetailedMessage(
                `import assertion ressource cannot be external when runtime do not support import assertions`,
                {
                  "import assertion trace": stringifyUrlTrace(
                    urlLoader.createUrlTrace({ url, line, column }),
                  ),
                },
              ),
            )
          }

          // await fileReference.ressource.getReadyPromise()
          // once the file is ready, we know its buildRelativeUrl
          // we can update either to the fileName or buildRelativeUrl
          // should be use the rollup reference id?
          const ressourceUrlAsJsModule = resolveUrl(
            `${urlToBasename(
              ressourceUrl,
            )}${outputExtension}?import_type=${type}`,
            ressourceUrl,
          )
          const jsUrl = url
          urlCustomLoaders[ressourceUrlAsJsModule] = async () => {
            let map
            let content
            if (type === "json") {
              await fileReference.ressource.getReadyPromise()
              content = String(fileReference.ressource.bufferAfterBuild)
              const jsModuleConversionResult =
                await convertJsonTextToJavascriptModule({
                  map,
                  content,
                })
              map = jsModuleConversionResult.map
              content = jsModuleConversionResult.content
            } else if (type === "css") {
              await fileReference.ressource.getReadyPromise()
              const cssBuildUrl = resolveUrl(
                fileReference.ressource.buildRelativeUrl,
                buildDirectoryUrl,
              )
              const jsBuildUrl = resolveUrl(
                urlToFilename(jsUrl),
                buildDirectoryUrl,
              )
              content = String(fileReference.ressource.bufferAfterBuild)
              const sourcemapReference =
                fileReference.ressource.dependencies.find((dependency) => {
                  return dependency.ressource.isSourcemap
                })
              if (sourcemapReference) {
                // because css is ready, it's sourcemap is also ready
                // we can read directly sourcemapReference.ressource.bufferAfterBuild
                map = JSON.parse(sourcemapReference.ressource.bufferAfterBuild)
              }
              const jsModuleConversionResult =
                await convertCssTextToJavascriptModule({
                  cssUrl: cssBuildUrl,
                  jsUrl: jsBuildUrl,
                  map,
                  content,
                })
              content = jsModuleConversionResult.content
              map = jsModuleConversionResult.map
            }
            return { map, content }
          }
          mutations.push((magicSource) => {
            magicSource.replace({
              start: importNode.source.start,
              end: importNode.source.end,
              replacement: `"${ressourceUrlAsJsModule}"`,
            })
            if (typePropertyNode) {
              magicSource.remove({
                start: typePropertyNode.start,
                end: typePropertyNode.end,
              })
            }
          })
        },
      })
      if (mutations.length === 0) {
        return null
      }
      const magicSource = createMagicSource({ url: serverUrl, content: code })
      mutations.forEach((mutation) => {
        mutation(magicSource)
      })
      const { content, sourcemap } = magicSource.toContentAndSourcemap()
      return {
        code: content,
        map: sourcemap,
      }
    },

    async generateBundle() {},
  }
}

const normalizeRollupResolveReturnValue = (resolveReturnValue) => {
  if (resolveReturnValue === null) {
    return { id: null, external: true }
  }
  if (typeof resolveReturnValue === "string") {
    return { id: resolveReturnValue, external: false }
  }
  return resolveReturnValue
}
