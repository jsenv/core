import { basename } from "path"
import { normalizePathname, pathnameToDirname } from "@jsenv/module-resolution"
import { readPackageData } from "./node-module-resolution/readPackageData.js"
import { resolveNodeModule } from "./node-module-resolution/resolveNodeModule.js"
import { packageDataToMain } from "./node-module-resolution/packageDataToMain.js"

export const generateImportMapForProjectNodeModules = async ({
  projectFolder,
  remapMain = false, // import 'lodash' remapped to '/node_modules/lodash/index.js'
  remapFolder = false, // import 'lodash/src/file.js' remapped to '/node_modules/lodash/src/file.js'
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
    const { dependencies = {} } = packageData
    const arrayOfDependencyToRemap = Object.keys(dependencies)

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

        if (isScoped) {
          const scopedImports = {
            [`/node_modules/${dependencyName}/`]: `/${dependencyFolderRelative}/`,
          }

          if (remapMain) {
            const dependencyMain = packageDataToMain(
              dependencyPackageData,
              dependencyPackageFilename,
            )
            scopedImports[`${dependencyName}`] = `/${dependencyFolderRelative}/${dependencyMain}`
          }
          if (remapFolder) {
            scopedImports[`${dependencyName}/`] = `/${dependencyFolderRelative}/`
          }

          scopes[`/${importerName}/`] = scopedImports
        } else {
          if (remapMain) {
            const dependencyMain = packageDataToMain(
              dependencyPackageData,
              dependencyPackageFilename,
            )
            imports[`${dependencyName}`] = `/node_modules/${dependencyName}/${dependencyMain}`
          }
          if (remapFolder) {
            imports[`${dependencyName}/`] = `/node_modules/${dependencyName}/`
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

  return { imports, scopes }
}

const createNodeModuleNotFoundMessage = ({
  projectFolder,
  importerFilename,
  nodeModuleName,
}) => `node module not found.
projectFolder : ${projectFolder}
importerFilename: ${importerFilename}
nodeModuleName: ${nodeModuleName}`
