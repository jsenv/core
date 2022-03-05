/*
 * TODO: the ressource builder must not call emitAsset, it's too magic
 * at least for now. Emit asset will be called from there to get the rollupReferenceId
 * we'll see later if ressource build needs to emit asset. For now we'll focus on html + js
 * and we'll see what happens if we don't parse html but instead reuse
 * the server parsing logic where urls are updated
 */

import { pathToFileUrl, fileURLToPath } from "node:url"

import { isFileSystemPath, urlIsInsideOf } from "@jsenv/filesystem"

import { createKitchen } from "@jsenv/core/src/omega/kitchen/kitchen.js"

import { filesystemRootUrl, moveUrl } from "@jsenv/core/src/utils/url_utils.js"

export const rollupPluginJsenv = async ({
  projectDirectoryUrl,
  plugins,
  runtimeSupport,
  scenario,
}) => {
  const ressourceBuilder = {}
  // TODO force server to transform import meta assertions
  // so that rollup gets js for imports
  // TODO: use kitchen instead
  const server = await startOmegaServer({
    keepProcessAlive: false,

    projectDirectoryUrl,
    plugins,
    runtimeSupport,
    scenario,
  })
  serverImportMetaUrlReferenceCallbackList.add(({ url }) => {
    // const reference = ressourceBuilder.createReferenceFoundInJsModule({
    //   referenceLabel: "URL + import.meta.url",
    //   jsUrl: serverUrl,
    //   jsLine: line,
    //   jsColumn: column,
    //   ressourceSpecifier: ressourceServerUrl,
    // })
    const rollupReferenceId = emitAsset()
    return `import.meta.ROLLUP_FILE_URL_${rollupReferenceId}`
  })

  const ressourcesReferencedByJs = []

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

    resolveFileUrl: ({
      // referenceId,
      fileName,
    }) => {
      ressourcesReferencedByJs.push(fileName)
      return `window.__resolveRessourceUrl__("./${fileName}", import.meta.url)`
    },

    async generateBundle() {},
  }
}
