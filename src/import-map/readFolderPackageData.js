import { fileRead } from "@dmail/helper"

export const readFolderPackageData = async (foldername) => {
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
