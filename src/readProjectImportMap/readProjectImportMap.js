import { readFile } from "fs"
import { composeTwoImportMaps } from "@jsenv/import-map"
import {
  pathToDirectoryUrl,
  fileUrlToRelativePath,
  resolveFileUrl,
  fileUrlToPath,
} from "../urlHelpers.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl/jsenvCoreDirectoryUrl.js"

export const readProjectImportMap = async ({
  projectDirectoryPath,
  jsenvProjectDirectoryPath,
  importMapFileRelativePath,
  logger,
}) => {
  if (typeof projectDirectoryPath !== "string") {
    throw new TypeError(`projectDirectoryPath must be a string, got ${projectDirectoryPath}`)
  }
  if (typeof jsenvProjectDirectoryPath !== "string") {
    throw new TypeError(
      `jsenvProjectDirectoryPath must be a string, got ${jsenvProjectDirectoryPath}`,
    )
  }

  const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath)

  const importMapForProject = importMapFileRelativePath
    ? await getProjectImportMap({
        projectDirectoryUrl,
        importMapFileRelativePath,
      })
    : null

  const jsenvCoreImportKey = "@jsenv/core/"
  const jsenvCoreImportValue = fileUrlToRelativePath(
    projectDirectoryUrl,
    jsenvCoreDirectoryUrl,
  ).slice(1)

  const importsForJsenvCore = {
    [jsenvCoreImportKey]: jsenvCoreImportValue,
  }

  if (!importMapForProject) {
    return {
      imports: importsForJsenvCore,
    }
  }

  if (importMapForProject.imports) {
    const jsenvCoreProjectImportValue = importMapForProject.imports[jsenvCoreImportKey]
    if (jsenvCoreProjectImportValue && jsenvCoreProjectImportValue !== jsenvCoreImportValue) {
      logger.warn(
        createIncompatibleJsenvCoreDependencyMessage({
          projectDirectoryPath,
          jsenvProjectDirectoryPath,
          jsenvCoreProjectRelativePath: jsenvCoreProjectImportValue.slice(0, -1),
          jsenvCoreRelativePath: jsenvCoreImportValue.slice(0, -1),
        }),
      )
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

const getProjectImportMap = async ({ projectDirectoryUrl, importMapFileRelativePath }) => {
  const importMapFileUrl = resolveFileUrl(importMapFileRelativePath, projectDirectoryUrl)
  const importMapFilePath = fileUrlToPath(importMapFileUrl)

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

const createIncompatibleJsenvCoreDependencyMessage = ({
  projectDirectoryPath,
  jsenvProjectDirectoryPath,
  jsenvCoreProjectRelativePath,
  jsenvCoreRelativePath,
}) => `incompatible dependency to @jsenv/core in your project and an internal jsenv project.
To fix this either remove project dependency to @jsenv/core or ensure they use the same version.
(If you are inside a @jsenv project you can ignore this warning)
--- jsenv project wanted relative path to @jsenv/core ---
${jsenvCoreRelativePath}
--- your project relative path to @jsenv/core ---
${jsenvCoreProjectRelativePath}
--- jsenv project path ---
${jsenvProjectDirectoryPath}
--- your project path ---
${projectDirectoryPath}`
