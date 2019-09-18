import { readFile } from "fs"
import { pathnameToRelativePath } from "@jsenv/href"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { composeTwoImportMaps } from "@jsenv/import-map"
import { jsenvCorePathname } from "../jsenvCorePath/jsenvCorePath.js"

export const readProjectImportMap = async ({
  projectPathname,
  jsenvProjectPathname,
  importMapRelativePath,
  logger,
}) => {
  if (typeof projectPathname !== "string") {
    throw new TypeError(`projectPathname must be a string, got ${projectPathname}`)
  }
  if (typeof jsenvProjectPathname !== "string") {
    throw new TypeError(`jsenvProjectPathname must be a string, got ${jsenvProjectPathname}`)
  }

  const importMapForProject = await getProjectImportMap({ projectPathname, importMapRelativePath })

  const jsenvCoreImportKey = "@jsenv/core/"
  const jsenvCoreImportValue = `${pathnameToRelativePath(jsenvCorePathname, projectPathname)}/`
  const jsenvCoreImports = {
    [jsenvCoreImportKey]: [jsenvCoreImportValue],
  }

  if (!importMapForProject) {
    return {
      imports: jsenvCoreImports,
    }
  }

  if (importMapForProject.imports) {
    const jsenvCoreProjectImportValue = importMapForProject.imports[jsenvCoreImportKey]
    if (jsenvCoreProjectImportValue && jsenvCoreProjectImportValue !== jsenvCoreImportValue) {
      logger.warn(
        createIncompatibleJsenvCoreDependencyMessage({
          projectPathname,
          jsenvProjectPathname,
          jsenvCoreProjectRelativePath: jsenvCoreProjectImportValue.slice(0, -1),
          jsenvCoreRelativePath: jsenvCoreImportValue.slice(0, -1),
        }),
      )
    }
  }

  const importMapForJsenvCore = {
    imports: jsenvCoreImports,
    scopes: generateJsenvCoreScopes({ importMapForProject, jsenvCoreImports }),
  }

  return composeTwoImportMaps(importMapForJsenvCore, importMapForProject)
}

const generateJsenvCoreScopes = ({ projectImportMap, jsenvCoreImports }) => {
  const { scopes } = projectImportMap

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
  const jsenvCoreScopes = {}
  Object.keys(scopes).forEach((scopeKey) => {
    jsenvCoreScopes[scopeKey] = jsenvCoreImports
  })
  return jsenvCoreScopes
}

const getProjectImportMap = async ({ projectPathname, importMapRelativePath }) => {
  if (!importMapRelativePath) {
    return null
  }

  const importMapPath = pathnameToOperatingSystemPath(`${projectPathname}/${importMapRelativePath}`)

  return new Promise((resolve, reject) => {
    readFile(importMapPath, (error, buffer) => {
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
  projectPathname,
  jsenvProjectPathname,
  jsenvCoreProjectRelativePath,
  jsenvCoreRelativePath,
}) => `incompatible dependency to @jsenv/core in your project and an internal jsenv project.
To fix this either remove project dependency to @jsenv/core or ensure they use the same version.
--- jsenv project wanted relative path to @jsenv/core ---
${jsenvCoreRelativePath}
--- your project relative path to @jsenv/core ---
${jsenvCoreProjectRelativePath}
--- jsenv project path ---
${jsenvProjectPathname}
--- your project path ---
${projectPathname}`
