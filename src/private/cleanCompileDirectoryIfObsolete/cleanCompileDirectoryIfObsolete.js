import { readFileSync } from "fs"
import { fileRead, fileWrite } from "@dmail/helper"
import { resolveFileUrl, fileUrlToPath } from "../urlUtils.js"
import { removeDirectory } from "../removeDirectory.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"

export const cleanCompileDirectoryIfObsolete = async ({
  compileDirectoryUrl,
  compileDirectoryMeta,
  forceObsolete = false,
  cleanCallback = () => {},
}) => {
  const jsenvCorePackageFileUrl = resolveFileUrl("./package.json", jsenvCoreDirectoryUrl)
  const jsenvCorePackageFilePath = fileUrlToPath(jsenvCorePackageFileUrl)
  const jsenvCorePackageVersion = readPackage(jsenvCorePackageFilePath).version

  compileDirectoryMeta = {
    ...compileDirectoryMeta,
    jsenvCorePackageVersion,
  }

  const metaFileUrl = resolveFileUrl("./meta.json", compileDirectoryUrl)
  const metaFilePath = fileUrlToPath(metaFileUrl)
  const compileDirectoryPath = fileUrlToPath(compileDirectoryUrl)

  if (forceObsolete) {
    cleanCallback(compileDirectoryPath)
    await removeDirectory(compileDirectoryPath)
  } else {
    let previousCompileDirectoryMeta
    try {
      const source = await fileRead(metaFilePath)
      previousCompileDirectoryMeta = JSON.parse(source)
    } catch (e) {
      if (e && e.code === "ENOENT") {
        previousCompileDirectoryMeta = null
      } else {
        throw e
      }
    }

    if (JSON.stringify(previousCompileDirectoryMeta) !== JSON.stringify(compileDirectoryMeta)) {
      cleanCallback(compileDirectoryPath)
      await removeDirectory(compileDirectoryPath)
    }
  }

  await fileWrite(metaFilePath, JSON.stringify(compileDirectoryMeta, null, "  "))
}

const readPackage = (packageFilePath) => {
  const buffer = readFileSync(packageFilePath)
  const string = String(buffer)
  const packageObject = JSON.parse(string)
  return packageObject
}
