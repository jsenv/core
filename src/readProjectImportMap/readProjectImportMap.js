import { readFile } from "fs"
import { composeTwoImportMaps } from "@jsenv/import-map"
import { fileUrlToRelativePath, resolveFileUrl, fileUrlToPath } from "../urlHelpers.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl/jsenvCoreDirectoryUrl.js"

export const readProjectImportMap = async ({
  projectDirectoryUrl,
  jsenvProjectDirectoryUrl,
  importMapFileRelativePath,
  logger,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof jsenvProjectDirectoryUrl !== "string") {
    throw new TypeError(
      `jsenvProjectDirectoryUrl must be a string, got ${jsenvProjectDirectoryUrl}`,
    )
  }

  const importMapForProject = importMapFileRelativePath
    ? await getProjectImportMap({
        projectDirectoryUrl,
        importMapFileRelativePath,
      })
    : null

  const jsenvCoreImportKey = "@jsenv/core/"
  const jsenvCoreRelativePathForJsenvProject = fileUrlToRelativePath(
    jsenvCoreDirectoryUrl,
    jsenvProjectDirectoryUrl,
  )

  const importsForJsenvCore = {
    [jsenvCoreImportKey]: jsenvCoreRelativePathForJsenvProject,
  }

  if (!importMapForProject) {
    return {
      imports: importsForJsenvCore,
    }
  }

  if (importMapForProject.imports) {
    const jsenvCoreRelativePathForProject = importMapForProject.imports[jsenvCoreImportKey]
    if (
      jsenvCoreRelativePathForProject &&
      jsenvCoreRelativePathForProject !== jsenvCoreRelativePathForJsenvProject
    ) {
      logger.warn(
        createIncompatibleJsenvCoreDependencyMessage({
          projectDirectoryPath: fileUrlToPath(projectDirectoryUrl),
          jsenvProjectDirectoryPath: fileUrlToPath(jsenvProjectDirectoryUrl),
          jsenvCoreRelativePathForProject,
          jsenvCoreRelativePathForJsenvProject,
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
  jsenvCoreRelativePathForProject,
  jsenvCoreRelativePathForJsenvProject,
}) => `incompatible dependency to @jsenv/core in your project and an internal jsenv project.
To fix this either remove project dependency to @jsenv/core or ensure they use the same version.
(If you are inside a @jsenv project you can ignore this warning)
--- your project path to @jsenv/core ---
${jsenvCoreRelativePathForProject}
--- jsenv project wanted path to @jsenv/core ---
${jsenvCoreRelativePathForJsenvProject}
--- jsenv project path ---
${jsenvProjectDirectoryPath}
--- your project path ---
${projectDirectoryPath}`
