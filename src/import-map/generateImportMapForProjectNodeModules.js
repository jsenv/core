import { basename } from "path"
import { readNodeModulesInsideFolder } from "./readNodeModulesInsideFolder.js"
import { readFolderPackageData } from "./readFolderPackageData.js"
import { packageDataToMain } from "./packageDataToMain.js"

export const generateImportMapForProjectNodeModules = async ({
  projectFolder,
  remapMain = true, // import 'lodash' remapped to '/node_modules/lodash/index.js'
  remapFolder = true, // import 'lodash/src/file.js' remapped to '/node_modules/lodash/src/file.js'
  logDuration = false,
}) => {
  const imports = {}
  const scopes = {}

  const visitDependencies = async (folder) => {
    const dependentName =
      folder === projectFolder ? basename(folder) : folder.slice(`${projectFolder}/`.length)
    const nodeModules = await readNodeModulesInsideFolder(`${folder}/node_modules`)
    const isTopLevel = folder === projectFolder

    await Promise.all(
      nodeModules.map(async (dependencyName) => {
        const dependencyFolder = `${folder}/node_modules/${dependencyName}`

        if (isTopLevel) {
          if (remapMain) {
            const dependencyPackageData = await readFolderPackageData(dependencyFolder)
            const dependencyMain = packageDataToMain(dependencyPackageData, dependencyFolder)
            imports[`${dependencyName}`] = `/node_modules/${dependencyName}/${dependencyMain}`
          }
          if (remapFolder) {
            imports[`${dependencyName}/`] = `/node_modules/${dependencyName}/`
          }
        } else {
          const dependencyFolderRelative = dependencyFolder.slice(`${projectFolder}/`.length)
          const scopedImports = {
            [`/node_modules/${dependencyName}/`]: `/${dependencyFolderRelative}/`,
          }

          if (remapMain) {
            const dependencyPackageData = await readFolderPackageData(dependencyFolder)
            const dependencyMain = packageDataToMain(dependencyPackageData, dependencyFolder)
            scopedImports[`${dependencyName}`] = `/${dependencyFolderRelative}/${dependencyMain}`
          }
          if (remapFolder) {
            scopedImports[`${dependencyName}/`] = `/${dependencyFolderRelative}/`
          }

          scopes[`/${dependentName}/`] = scopedImports
        }

        await visitDependencies(dependencyFolder)
      }),
    )
  }

  const before = Date.now()
  await visitDependencies(projectFolder)
  if (logDuration) {
    const importMapGenerationDuration = Date.now() - before
    console.log(`import generated in ${importMapGenerationDuration}ms`)
  }

  return { imports, scopes }
}
