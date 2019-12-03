import { readFile } from "fs"
import { composeTwoImportMaps } from "@jsenv/import-map"
import { urlToRelativeUrl, fileUrlToPath, resolveUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"

export const readProjectImportMap = async ({
  logger,
  jsenvProjectDirectoryUrl,
  projectDirectoryUrl,
  importMapFileRelativeUrl,
}) => {
  if (typeof jsenvProjectDirectoryUrl !== "string") {
    throw new TypeError(
      `jsenvProjectDirectoryUrl must be a string, got ${jsenvProjectDirectoryUrl}`,
    )
  }
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }

  const importMapForProject = importMapFileRelativeUrl
    ? await getProjectImportMap({ projectDirectoryUrl, importMapFileRelativeUrl })
    : null

  const jsenvCoreImportKey = "@jsenv/core/"
  const jsenvCoreRelativeUrlForJsenvProject =
    jsenvProjectDirectoryUrl === jsenvCoreDirectoryUrl
      ? "./"
      : urlToRelativeUrl(jsenvCoreDirectoryUrl, jsenvProjectDirectoryUrl)

  const importsForJsenvCore = {
    [jsenvCoreImportKey]: jsenvCoreRelativeUrlForJsenvProject,
  }

  if (!importMapForProject) {
    return {
      imports: importsForJsenvCore,
    }
  }

  if (importMapForProject.imports && jsenvProjectDirectoryUrl !== jsenvCoreDirectoryUrl) {
    const jsenvCoreRelativeUrlForProject = importMapForProject.imports[jsenvCoreImportKey]
    if (
      jsenvCoreRelativeUrlForProject &&
      jsenvCoreRelativeUrlForProject !== jsenvCoreRelativeUrlForJsenvProject
    ) {
      logger.warn(
        createIncompatibleJsenvCoreDependencyMessage({
          projectDirectoryPath: fileUrlToPath(projectDirectoryUrl),
          jsenvProjectDirectoryPath: fileUrlToPath(jsenvProjectDirectoryUrl),
          jsenvCoreRelativeUrlForProject,
          jsenvCoreRelativeUrlForJsenvProject,
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

const getProjectImportMap = async ({ projectDirectoryUrl, importMapFileRelativeUrl }) => {
  const importMapFileUrl = resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl)
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
  jsenvCoreRelativeUrlForProject,
  jsenvCoreRelativeUrlForJsenvProject,
}) => `incompatible dependency to @jsenv/core in your project and an internal jsenv project.
To fix this either remove project dependency to @jsenv/core or ensure they use the same version.
(If you are inside a @jsenv project you can ignore this warning)
--- your project path to @jsenv/core ---
${jsenvCoreRelativeUrlForProject}
--- jsenv project wanted path to @jsenv/core ---
${jsenvCoreRelativeUrlForJsenvProject}
--- jsenv project path ---
${jsenvProjectDirectoryPath}
--- your project path ---
${projectDirectoryPath}`
