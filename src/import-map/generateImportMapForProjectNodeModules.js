import { basename } from "path"
import {
  normalizePathname,
  pathnameToDirname,
} from "/node_modules/@jsenv/module-resolution/index.js"
import { readPackageData } from "./node-module-resolution/readPackageData.js"
import { resolveNodeModule } from "./node-module-resolution/resolveNodeModule.js"
import { packageDataToMain } from "./node-module-resolution/packageDataToMain.js"
import { packageMayNeedRemapping } from "./node-module-resolution/packageMayNeedRemapping.js"

export const generateImportMapForProjectNodeModules = async ({
  projectFolder,
  scopeOriginRelativePerModule = true, // import '/folder/file.js' is scoped per node_module
  remapMain = true, // import 'lodash' remapped to '/node_modules/lodash/index.js'
  remapFolder = true, // import 'lodash/src/file.js' remapped to '/node_modules/lodash/src/file.js'
  remapDevDependencies = true,
  remapPredicate = () => true,
  logDuration = false,
  updateProcessExitCode = true,
}) => {
  projectFolder = normalizePathname(projectFolder)
  const topLevelPackageFilename = `${projectFolder}/package.json`
  const topLevelImporterName = basename(pathnameToDirname(topLevelPackageFilename))

  const dependenciesCache = {}
  const findDependency = ({ importerFilename, nodeModuleName }) => {
    if (importerFilename in dependenciesCache === false) {
      dependenciesCache[importerFilename] = {}
    }
    if (nodeModuleName in dependenciesCache[importerFilename]) {
      return dependenciesCache[importerFilename][nodeModuleName]
    }

    const dependencyPromise = resolveNodeModule({
      rootFolder: projectFolder,
      importerFilename,
      nodeModuleName,
    })
    dependenciesCache[importerFilename][nodeModuleName] = dependencyPromise
    return dependencyPromise
  }

  const imports = {}
  const scopes = {}

  const addImportMapping = ({ from, to }) => {
    imports[from] = to
  }

  const addScopedImportMapping = ({ scope, from, to }) => {
    scopes[scope] = {
      ...(scopes[scope] || {}),
      [from]: to,
    }
  }

  const addMapping = ({ importerName, from, to }) => {
    if (importerName === topLevelImporterName) {
      addImportMapping({ from, to })
    } else {
      addScopedImportMapping({ scope: `/${importerName}/`, from, to })
    }
  }

  const visit = async ({ packageFilename, packageData }) => {
    const isTopLevel = packageFilename === topLevelPackageFilename

    if (!isTopLevel && !packageMayNeedRemapping(packageData)) return

    const importerName = isTopLevel
      ? topLevelImporterName
      : pathnameToDirname(packageFilename.slice(`${projectFolder}/`.length))
    const { dependencies = {}, devDependencies = {} } = packageData

    const arrayOfDependencyToRemap = Object.keys({
      ...dependencies,
      ...(remapDevDependencies && isTopLevel ? devDependencies : {}),
    }).filter((dependencyName) => {
      return remapPredicate({
        importerName,
        isTopLevel,
        dependencyName,
        isDev: dependencyName in devDependencies,
      })
    })

    const dependencyMap = {}
    await Promise.all(
      arrayOfDependencyToRemap.map(async (dependencyName) => {
        const dependency = await findDependency({
          importerFilename: packageFilename,
          nodeModuleName: dependencyName,
        })
        if (!dependency) {
          throw new Error(
            createNodeModuleNotFoundMessage({
              projectFolder,
              importerFilename: packageFilename,
              nodeModuleName: dependencyName,
            }),
          )
        }

        const {
          packageData: dependencyPackageData,
          packageFilename: dependencyPackageFilename,
        } = dependency

        const dependencyActualFolder = pathnameToDirname(dependencyPackageFilename)
        const dependencyActualPathname = dependencyActualFolder.slice(projectFolder.length)
        const dependencyExpectedFolder = `${pathnameToDirname(
          packageFilename,
        )}/node_modules/${dependencyName}`
        const dependencyExpectedPathname = dependencyExpectedFolder.slice(projectFolder.length)

        dependencyMap[dependencyName] = {
          packageFilename: dependencyPackageFilename,
          packageData: dependencyPackageData,
          actualPathname: dependencyActualPathname,
          expectedPathname: dependencyExpectedPathname,
        }
      }),
    )

    await Promise.all(
      Object.keys(dependencyMap).map((dependencyName) => {
        const { packageData, packageFilename, actualPathname, expectedPathname } = dependencyMap[
          dependencyName
        ]
        const moved = actualPathname !== expectedPathname

        if (remapFolder) {
          const from = `${dependencyName}/`
          const to = `${actualPathname}/`

          addMapping({ importerName, from, to })
          if (moved) {
            addScopedImportMapping({ scope: `/${importerName}/`, from, to })
          }
        }

        if (remapMain) {
          const dependencyMain = packageDataToMain(packageData, packageFilename)
          const from = dependencyName
          const to = `${actualPathname}/${dependencyMain}`

          addMapping({ importerName, from, to })
          if (moved) {
            addScopedImportMapping({ scope: `/${importerName}/`, from, to })
          }
        }

        if (scopeOriginRelativePerModule) {
          addScopedImportMapping({
            scope: `${expectedPathname}/`,
            from: `${expectedPathname}/`,
            to: `${actualPathname}/`,
          })
          addScopedImportMapping({
            scope: `${expectedPathname}/`,
            from: `/`,
            to: `${actualPathname}/`,
          })

          if (moved) {
            addScopedImportMapping({
              scope: `/${importerName}/`,
              from: `${expectedPathname}/`,
              to: `${actualPathname}/`,
            })
            addScopedImportMapping({
              scope: `/${importerName}/`,
              from: `${actualPathname}/`,
              to: `${actualPathname}/`,
            })
          }
        }

        return visit({
          packageFilename,
          packageData,
        })
      }),
    )
  }

  const before = Date.now()
  const topLevelPackageData = await readPackageData({ filename: topLevelPackageFilename })
  try {
    await visit({
      packageFilename: topLevelPackageFilename,
      packageData: topLevelPackageData,
    })
  } catch (e) {
    if (updateProcessExitCode) {
      process.exitCode = 1
    }
    throw e
  }

  if (logDuration) {
    const importMapGenerationDuration = Date.now() - before
    console.log(`import generated in ${importMapGenerationDuration}ms`)
  }

  return sortImportMap({ imports, scopes })
}

const sortImportMap = (importMap) => {
  const orderedImportMap = {
    imports: sortImportMapImports(importMap.imports),
    scopes: sortImportMapScopes(importMap.scopes),
  }
  return orderedImportMap
}

const sortImportMapImports = (imports) => {
  const sortedImports = {}
  Object.keys(imports)
    .sort(compareLengthOrLocaleCompare)
    .forEach((name) => {
      sortedImports[name] = imports[name]
    })
  return sortedImports
}

const compareLengthOrLocaleCompare = (a, b) => {
  return b.length - a.length || a.localeCompare(b)
}

const sortImportMapScopes = (scopes) => {
  const sortedScopes = {}
  Object.keys(scopes)
    .sort(compareLengthOrLocaleCompare)
    .forEach((scopeName) => {
      sortedScopes[scopeName] = sortScopedImports(scopes[scopeName], scopeName)
    })
  return sortedScopes
}

const sortScopedImports = (scopedImports) => {
  const compareScopedImport = (a, b) => {
    // const aIsRoot = a === "/"
    // const bIsRoot = b === "/"
    // if (aIsRoot && !bIsRoot) return 1
    // if (!aIsRoot && bIsRoot) return -1
    // if (aIsRoot && bIsRoot) return 0

    // const aIsScope = a === scope
    // const bIsScope = b === scope
    // if (aIsScope && !bIsScope) return 1
    // if (!aIsScope && bIsScope) return -1
    // if (aIsScope && bIsScope) return 0

    return compareLengthOrLocaleCompare(a, b)
  }

  const sortedScopedImports = {}
  Object.keys(scopedImports)
    .sort(compareScopedImport)
    .forEach((name) => {
      sortedScopedImports[name] = scopedImports[name]
    })
  return sortedScopedImports
}

const createNodeModuleNotFoundMessage = ({
  projectFolder,
  importerFilename,
  nodeModuleName,
}) => `node module not found.
projectFolder : ${projectFolder}
importerFilename: ${importerFilename}
nodeModuleName: ${nodeModuleName}`
