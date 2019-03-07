import { basename, extname } from "path"
import { fileRead, folderRead } from "@dmail/helper"
import { fileStat } from "@dmail/helper/dist/src/fileStat"

export const generateImportMapForProjectNodeModules = async ({
  projectFolder,
  remapMain = true, // import 'lodash' remapped to '/node_modules/lodash/index.js'
  remapFolder = true, // import 'lodash/src/file.js' remapped to '/node_modules/lodash/src/file.js'
}) => {
  const imports = {}
  const scopes = {}

  const visitDependencies = async (folder) => {
    const dependentName =
      folder === projectFolder ? basename(folder) : folder.slice(`${projectFolder}/`.length)
    const nodeModules = await readFolderAsNodeModules(`${folder}/node_modules`)
    const isTopLevel = folder === projectFolder

    await Promise.all(
      nodeModules.map(async (dependencyName) => {
        const dependencyFolder = `${folder}/node_modules/${dependencyName}`

        if (isTopLevel) {
          if (remapMain) {
            const dependencyPackageData = await readFolderPackage(dependencyFolder)
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
            const dependencyPackageData = await readFolderPackage(dependencyFolder)
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

  await visitDependencies(projectFolder)

  return { imports, scopes }
}

const readFolderAsNodeModules = async (folder) => {
  try {
    const nodeModules = []
    const nodeModulesFolderContent = await folderReadSubfolders(`${folder}`)

    await Promise.all(
      nodeModulesFolderContent.map(async (foldernameRelative) => {
        // .bin is not a node_module
        if (foldernameRelative === ".bin") return

        if (foldernameRelative[0] === "@") {
          const scopedNodeModulesWithoutScopePrefix = await readFolderAsNodeModules(
            `${folder}/${foldernameRelative}`,
          )
          const scopedNodeModules = scopedNodeModulesWithoutScopePrefix.map(
            (scopedFoldernameRelative) => `${foldernameRelative}/${scopedFoldernameRelative}`,
          )
          nodeModules.push(...scopedNodeModules)
        } else {
          nodeModules.push(foldernameRelative)
        }
      }),
    )
    return nodeModules
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return []
    }
    throw e
  }
}

const folderReadSubfolders = async (folder) => {
  const subfolders = []
  const folderBasenameArray = await folderReadOptionnal(folder)

  await Promise.all(
    folderBasenameArray.map(async (basename) => {
      const pathname = `${folder}/${basename}`
      const stat = await fileStat(pathname)
      if (!stat.isDirectory()) return
      subfolders.push(basename)
    }),
  )

  return subfolders
}

const folderReadOptionnal = async (folder) => {
  try {
    return await folderRead(folder)
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return []
    }
    throw e
  }
}

const packageDataToMain = (packageData) => {
  if ("module" in packageData) return normalizePackageMain(packageData.module)
  if ("jsnext:main" in packageData) return normalizePackageMain(packageData["jsnext:main"])
  if ("main" in packageData) return normalizePackageMain(packageData.main)
  return "index.js"
}

const normalizePackageMain = (main) => {
  // normalize in case people write ./dist/file for instance
  if (main.slice(0, 2) === "./") main = main.slice(2)
  const extension = extname(main)
  if (extension) return main
  return `${main}.js`
}

const readFolderPackage = async (foldername) => {
  try {
    const packageString = await fileRead(`${foldername}/package.json`)
    const packageData = JSON.parse(packageString)
    return packageData
  } catch (e) {
    if (e && e.code === "ENOENT") {
      // let's make package.json optionnal so that
      // if npm creates a folder which is not a node_module we don't throw
      // it would be the case for .bin folder for instance
      return {}
    }
    if (e && e.name === "SyntaxError") {
      throw createMalformedPackageFileError({ foldername })
    }
    throw e
  }
}

// const createMissingPackageFileError = ({ foldername }) =>
//   new Error(`missing package.json for folder.
// foldername: ${foldername}`)

const createMalformedPackageFileError = ({ folfdername, syntaxError }) =>
  new Error(`error while parsing package.json for folder.
foldername: ${folfdername}
syntaxError: ${syntaxError}`)

// const createDependencyOutsideProjectError = ({
//   projectFolder,
//   dependentName,
//   dependencyName,
//   dependencyFolder,
// }) =>
//   new Error(`a node module is outside project.
// projectFolder: ${projectFolder}
// dependentName: ${dependentName}
// dependencyName: ${dependencyName}
// dependencyFolder: ${dependencyFolder}`)
