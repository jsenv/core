import { readFileSync } from "fs"
import { resolveFileUrl, fileUrlToPath, resolveDirectoryUrl } from "internal/urlUtils.js"
import { readFileContent, writeFileContent, removeDirectory } from "internal/filesystemUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { COMPILE_DIRECTORY } from "internal/CONSTANTS.js"

export const cleanCompileDirectoryIfObsolete = async ({
  jsenvDirectoryUrl,
  compileDirectoryMeta,
  cleanCallback = () => {},
}) => {
  const jsenvCorePackageFileUrl = resolveFileUrl("./package.json", jsenvCoreDirectoryUrl)
  const jsenvCorePackageFilePath = fileUrlToPath(jsenvCorePackageFileUrl)
  const jsenvCorePackageVersion = readPackage(jsenvCorePackageFilePath).version

  compileDirectoryMeta = {
    ...compileDirectoryMeta,
    jsenvCorePackageVersion,
  }

  const compileDirectoryUrl = resolveDirectoryUrl(COMPILE_DIRECTORY, jsenvDirectoryUrl)
  const metaFileUrl = resolveFileUrl("./meta.json", compileDirectoryUrl)
  const metaFilePath = fileUrlToPath(metaFileUrl)
  const compileDirectoryPath = fileUrlToPath(compileDirectoryUrl)

  let previousCompileDirectoryMeta
  try {
    const source = await readFileContent(metaFilePath)
    previousCompileDirectoryMeta = JSON.parse(source)
  } catch (e) {
    if (e && e.code === "ENOENT") {
      previousCompileDirectoryMeta = null
    } else {
      throw e
    }
  }

  if (
    previousCompileDirectoryMeta !== null &&
    JSON.stringify(previousCompileDirectoryMeta) !== JSON.stringify(compileDirectoryMeta)
  ) {
    cleanCallback(compileDirectoryPath)
    await removeDirectory(compileDirectoryPath)
  }

  await writeFileContent(metaFilePath, JSON.stringify(compileDirectoryMeta, null, "  "))
}

const readPackage = (packageFilePath) => {
  const buffer = readFileSync(packageFilePath)
  const string = String(buffer)
  const packageObject = JSON.parse(string)
  return packageObject
}
