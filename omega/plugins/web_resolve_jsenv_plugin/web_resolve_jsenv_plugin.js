// https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/resolve.ts
import { resolveUrl, urlToExtension } from "@jsenv/filesystem"
import { resolveImport } from "@jsenv/importmap"

import { resolveFile } from "./filesystem_resolution.js"
import { createFindNodeModulePackage } from "./node_package_resolution.js"
import { resolvePackageEntry } from "./package_entry_resolution.js"

export const webResolveJsenvPlugin = ({
  magicExtensions = ["inherit"],
  packageConditions = ["import", "browser"],
  importMap,
} = {}) => {
  const findNodeModulePackage = createFindNodeModulePackage()

  const handleFileUrl = async ({
    projectDirectoryUrl,
    baseUrl,
    urlSpecifier,
    fileUrl,
  }) => {
    const filesystemResolution = await resolveFile(fileUrl, {
      magicDirectoryIndexEnabled: true,
      magicExtensionEnabled: true,
      extensionsToTry: getExtensionsToTry(magicExtensions, baseUrl),
    })
    if (filesystemResolution.found) {
      return filesystemResolution.url
    }
    if (isBareSpecifier(urlSpecifier)) {
      const packageInfo = await findNodeModulePackage({
        projectDirectoryUrl,
        nodeModulesOutsideProjectAllowed: true,
        packageFileUrl: fileUrl,
        dependencyName: urlSpecifier,
      })
      if (packageInfo) {
        const packageEntryInfo = await resolvePackageEntry({
          packageInfo,
          packageConditions,
        })
        if (packageEntryInfo.found) {
          return packageEntryInfo.url
        }
      }
    }
    return null
  }

  return {
    name: "jsenv:web_resolve",

    shouldSkip: ({ runtimeName }) => {
      return runtimeName === "node"
    },

    resolve: async ({
      projectDirectoryUrl,
      urlSpecifier,
      baseUrl,
      type = "url",
    }) => {
      const { url } = resolveUrlSpecifier({
        urlSpecifier,
        baseUrl,
        type,
        importMap,
      })
      // http, https, data, about, etc
      if (!url.startsWith("file://")) {
        return url
      }
      const urlObject = new URL(url)
      const { search, hash } = urlObject
      urlObject.search = ""
      urlObject.hash = ""
      const fileUrl = await handleFileUrl({
        projectDirectoryUrl,
        baseUrl,
        urlSpecifier,
        fileUrl: urlObject.href,
      })
      if (fileUrl) {
        return `${fileUrl}${search}${hash}`
      }
      return null
    },
  }
}

const isBareSpecifier = (specifier) => {
  if (specifier[0] === ".") {
    return false
  }
  if (specifier[0] === "/") {
    return false
  }
  if (/^[a-zA-Z]{2,}:/.test(specifier)) {
    return false
  }
  return true
}

const resolveUrlSpecifier = ({ urlSpecifier, baseUrl, type, importMap }) => {
  if (type === "url") {
    return {
      url: resolveUrl(urlSpecifier, baseUrl),
    }
  }
  try {
    const url = resolveImport({
      specifier: urlSpecifier,
      importer: baseUrl,
      importMap,
      defaultExtension: false,
      createBareSpecifierError: () => BARE_SPECIFIER_ERROR,
    })
    return {
      gotBareSpecifierError: false,
      url,
    }
  } catch (e) {
    return {
      gotBareSpecifierError: true,
      url: resolveUrl(urlSpecifier, baseUrl),
    }
  }
}

const getExtensionsToTry = (magicExtensions, importer) => {
  const extensionsSet = new Set()
  magicExtensions.forEach((magicExtension) => {
    if (magicExtension === "inherit") {
      const importerExtension = urlToExtension(importer)
      extensionsSet.add(importerExtension)
    } else {
      extensionsSet.add(magicExtension)
    }
  })
  return Array.from(extensionsSet.values())
}

const BARE_SPECIFIER_ERROR = {}
