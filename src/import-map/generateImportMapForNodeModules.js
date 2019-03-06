import { folderRead } from "@dmail/helper"

// TODO: create an option false by default
// allowing to also produce remapping to allow
// bare specifier like import 'lodash' to be remapped to the actual location
// it's for later and will require to read package.json to find the entry point
// and the module or es:next entry point must be favored
// (check how esling plugin node resolver does)
export const generateImportMapForNodeModules = async ({ foldername }) => {
  const scopes = {}

  const visitNodeModules = async (nodeModuleFoldername) => {
    const nodeModuleDependencyNameArray = await readNodeModuleDependencyNameArray(
      nodeModuleFoldername,
    )

    await Promise.all(
      nodeModuleDependencyNameArray.map(async (dependencyName) => {
        if (nodeModuleFoldername !== foldername) {
          const nodeModuleFoldernameRelative = nodeModuleFoldername.slice(`${foldername}/`.length)
          scopes[`/${nodeModuleFoldernameRelative}/`] = {
            [`/node_modules/${dependencyName}/`]: `/${nodeModuleFoldernameRelative}/node_modules/${dependencyName}/`,
          }
        }
        await visitNodeModules(`${nodeModuleFoldername}/node_modules/${dependencyName}`)
      }),
    )
  }

  await visitNodeModules(foldername)

  return { scopes }
}

const readNodeModuleDependencyNameArray = async (nodeModuleFoldername) => {
  try {
    const nodeModuleDependencyNameArray = await folderRead(`${nodeModuleFoldername}/node_modules`)
    return nodeModuleDependencyNameArray
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return []
    }
    throw e
  }
}
