import { readFile } from "fs"
import { composeTwoImportMaps } from "@jsenv/import-map"
import { urlToRelativeUrl, urlToFileSystemPath, resolveUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"

export const readProjectImportMap = async ({ projectDirectoryUrl, importMapFileRelativeUrl }) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }

  const importMapForProject = importMapFileRelativeUrl
    ? await getProjectImportMap({ projectDirectoryUrl, importMapFileRelativeUrl })
    : null

  const jsenvCoreImportKey = "@jsenv/core/"
  const jsenvCoreRelativeUrlForJsenvProject =
    projectDirectoryUrl === jsenvCoreDirectoryUrl
      ? "./"
      : urlToRelativeUrl(jsenvCoreDirectoryUrl, projectDirectoryUrl)

  const importsForJsenvCore = {
    [jsenvCoreImportKey]: jsenvCoreRelativeUrlForJsenvProject,
  }

  if (!importMapForProject) {
    return {
      imports: importsForJsenvCore,
    }
  }

  const importMapForJsenvCore = {
    imports: importsForJsenvCore,
    scopes: generateJsenvCoreScopes({ importMapForProject, importsForJsenvCore }),
  }

  return composeTwoImportMaps(importMapForJsenvCore, importMapForProject)
}

const generateJsenvCoreScopes = ({ importMapForProject, importsForJsenvCore }) => {
  const { scopes } = importMapForProject

  if (!scopes) {
    return undefined
  }

  // I must ensure jsenvCoreImports wins by default in every scope
  // because scope may contains stuff like
  // "/": "/"
  // "/": "/folder/"
  // to achieve this, we set jsenvCoreImports into every scope
  // they can still be overriden by importMapForProject
  // even if I see no use case for that
  const scopesForJsenvCore = {}
  Object.keys(scopes).forEach((scopeKey) => {
    scopesForJsenvCore[scopeKey] = importsForJsenvCore
  })
  return scopesForJsenvCore
}

const getProjectImportMap = async ({ projectDirectoryUrl, importMapFileRelativeUrl }) => {
  const importMapFileUrl = resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl)
  const importMapFilePath = urlToFileSystemPath(importMapFileUrl)

  return new Promise((resolve, reject) => {
    readFile(importMapFilePath, (error, buffer) => {
      if (error) {
        if (error.code === "ENOENT") {
          resolve(null)
        } else {
          reject(error)
        }
      } else {
        const importMapString = String(buffer)
        resolve(JSON.parse(importMapString))
      }
    })
  })
}
