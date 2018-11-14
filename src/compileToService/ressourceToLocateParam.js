import { ressourceToCompileInfo } from "./ressourceToCompileInfo.js"
import path from "path"

export const ressourceToLocateParam = (ressource, dependentRessource, compileInto) => {
  const { file, compileId } = ressourceToCompileInfo(ressource, compileInto)

  if (!dependentRessource) {
    return { file }
  }

  if (dependentRessource === ressource) {
    return { file }
  }

  const { file: dependentFile, compileId: dependentCompileId } = ressourceToCompileInfo(
    dependentRessource,
    compileInto,
  )

  if (dependentCompileId !== compileId) {
    return { file }
  }

  if (!dependentFile) {
    return { file }
  }

  const dependentFolder = path.dirname(dependentFile)
  if (file.startsWith(`${dependentFolder}/`) === false) {
    return { file }
  }

  return {
    dependentFile,
    dependentFolder,
    file: file.slice(`${dependentFolder}/`.length),
  }
}
