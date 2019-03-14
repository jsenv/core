import { basename } from "path"
import { normalizePathname } from "@jsenv/module-resolution"
import { readNodeModulesInsideFolder } from "./readNodeModulesInsideFolder.js"
import { readFolderPackageData } from "./readFolderPackageData.js"
import { packageDataToMain } from "./packageDataToMain.js"

export const generateImportMapForProjectNodeModules = async ({
  projectFolder,
  remapMain = true, // import 'lodash' remapped to '/node_modules/lodash/index.js'
  remapFolder = true, // import 'lodash/src/file.js' remapped to '/node_modules/lodash/src/file.js'
  logDuration = false,
  includeDevDependencies = false,
}) => {
  projectFolder = normalizePathname(projectFolder)
  const imports = {}
  const scopes = {}

  const visitDependencies = async (folder) => {
    const dependentName =
      folder === projectFolder ? basename(folder) : folder.slice(`${projectFolder}/`.length)
    const isTopLevel = folder === projectFolder

    let nodeModules = await readNodeModulesInsideFolder(`${folder}/node_modules`)
    if (!includeDevDependencies) {
      const packageData = await readFolderPackageData(folder)
      const { dependencies = {}, peerDependencies = {}, devDependencies = {} } = packageData
      nodeModules = nodeModules.filter((dependencyName) => {
        if (dependencyName in dependencies) return true
        if (dependencyName in devDependencies) return false
        if (dependencyName in peerDependencies) return true
        return false
      })
    }

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
