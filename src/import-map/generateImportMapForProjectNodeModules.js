import { basename } from "path"
import {
  normalizePathname,
  pathnameToDirname,
} from "/node_modules/@jsenv/module-resolution/index.js"
import { readPackageData } from "./node-module-resolution/readPackageData.js"
import { resolveNodeModule } from "./node-module-resolution/resolveNodeModule.js"
import { packageDataToMain } from "./node-module-resolution/packageDataToMain.js"

export const generateImportMapForProjectNodeModules = async ({
  projectFolder,
  scopeOriginRelativePerModule = true, // import '/folder/file.js' is scoped per node_module
  remapMain = true, // import 'lodash' remapped to '/node_modules/lodash/index.js'
  remapFolder = true, // import 'lodash/src/file.js' remapped to '/node_modules/lodash/src/file.js'
  remapDevDependencies = true,
  remapPredicate = () => true,
  logDuration = false,
}) => {
  projectFolder = normalizePathname(projectFolder)
  const topLevelPackageFilename = `${projectFolder}/package.json`
  const imports = {}
  const scopes = {}

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

  const visit = async ({ packageFilename, packageData }) => {
    const isTopLevel = packageFilename === topLevelPackageFilename
    const importerName = isTopLevel
      ? basename(pathnameToDirname(packageFilename))
      : pathnameToDirname(packageFilename.slice(`${projectFolder}/`.length))
    const { dependencies = {}, devDependencies = {} } = packageData

    const arrayOfDependencyToRemap = Object.keys({
      ...dependencies,
      ...(remapDevDependencies ? devDependencies : {}),
    }).filter((dependencyName) => {
      return remapPredicate({
        importerName,
        isTopLevel,
        dependencyName,
        isDev: dependencyName in devDependencies,
      })
    })

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

        const dependencyPackageFolder = pathnameToDirname(dependencyPackageFilename)
        const dependencyFolderRelative = dependencyPackageFolder.slice(`${projectFolder}/`.length)
        const isScoped = dependencyFolderRelative !== `node_modules/${dependencyName}`
        const dependencyScope = `/node_modules/${dependencyName}/`

        if (isScoped) {
          const subDependencyScopedImports = {}
          const subDependencyScope = `/${dependencyFolderRelative}/`

          subDependencyScopedImports[dependencyScope] = subDependencyScope

          if (remapFolder) {
            subDependencyScopedImports[`${dependencyName}/`] = subDependencyScope
          }

          if (remapMain) {
            const dependencyMain = packageDataToMain(
              dependencyPackageData,
              dependencyPackageFilename,
            )
            subDependencyScopedImports[dependencyName] = `${subDependencyScope}${dependencyMain}`
          }

          const importerScope = `/${importerName}/`
          scopes[importerScope] = {
            ...(scopes[importerScope] || {}),
            ...subDependencyScopedImports,
          }

          if (scopeOriginRelativePerModule) {
            scopes[subDependencyScope] = {
              ...(scopes[subDependencyScope] || {}),
              [subDependencyScope]: subDependencyScope,
              "/": subDependencyScope,
            }
          }
        } else {
          if (scopeOriginRelativePerModule) {
            scopes[dependencyScope] = {
              ...(scopes[dependencyScope] || {}),
              [dependencyScope]: dependencyScope,
              "/": dependencyScope,
            }
          }

          if (remapFolder) {
            imports[`${dependencyName}/`] = dependencyScope
          }

          if (remapMain) {
            const dependencyMain = packageDataToMain(
              dependencyPackageData,
              dependencyPackageFilename,
            )
            imports[`${dependencyName}`] = `${dependencyScope}${dependencyMain}`
          }
        }

        await visit({
          packageFilename: dependencyPackageFilename,
          packageData: dependencyPackageData,
        })
      }),
    )
  }

  const before = Date.now()
  const topLevelPackageData = await readPackageData({ filename: topLevelPackageFilename })
  await visit({ packageFilename: topLevelPackageFilename, packageData: topLevelPackageData })

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

const compareLengthOrLocaleComparison = (a, b) => {
  return b.length - a.length || a.localeCompare(b)
}

const sortImportMapImports = (imports) => {
  const sortedImports = {}
  Object.keys(imports)
    .sort(compareLengthOrLocaleComparison)
    .forEach((name) => {
      sortedImports[name] = imports[name]
    })
  return sortedImports
}

const sortImportMapScopes = (scopes) => {
  const sortedScopes = {}
  Object.keys(scopes)
    .sort(compareLengthOrLocaleComparison)
    .forEach((scopeName) => {
      sortedScopes[scopeName] = sortImportMapImports(scopes[scopeName])
    })
  return sortedScopes
}

const createNodeModuleNotFoundMessage = ({
  projectFolder,
  importerFilename,
  nodeModuleName,
}) => `node module not found.
projectFolder : ${projectFolder}
importerFilename: ${importerFilename}
nodeModuleName: ${nodeModuleName}`
