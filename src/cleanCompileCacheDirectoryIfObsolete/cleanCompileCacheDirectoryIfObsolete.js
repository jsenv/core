import { readFileSync } from "fs"
import { fileRead, fileWrite } from "@dmail/helper"
import { resolveFileUrl, fileUrlToPath } from "../urlHelpers.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl/jsenvCoreDirectoryUrl.js"
import { removeDirectory } from "./removeDirectory.js"

export const cleanCompileCacheDirectoryIfObsolete = async ({
  cacheDirectoryUrl,
  forceObsolete = false,
  cacheMeta,
  cleanCallback = () => {},
}) => {
  const jsenvCorePackageFileUrl = resolveFileUrl("./package.json", jsenvCoreDirectoryUrl)
  const jsenvCorePackageFilePath = fileUrlToPath(jsenvCorePackageFileUrl)
  const jsenvCorePackageVersion = readPackage(jsenvCorePackageFilePath).version

  const compileCacheDirectoryMeta = {
    ...cacheMeta,
    jsenvCorePackageVersion,
  }

  const cacheMetaFileUrl = resolveFileUrl("./meta.json", cacheDirectoryUrl)
  const cacheMetaFilePath = fileUrlToPath(cacheMetaFileUrl)
  const cacheDirectoryPath = fileUrlToPath(cacheDirectoryUrl)

  if (forceObsolete) {
    cleanCallback(cacheDirectoryPath)
    await removeDirectory(cacheDirectoryPath)
  } else {
    let previousCompileCacheDirectoryMeta
    try {
      const source = await fileRead(cacheMetaFilePath)
      previousCompileCacheDirectoryMeta = JSON.parse(source)
    } catch (e) {
      if (e && e.code === "ENOENT") {
        previousCompileCacheDirectoryMeta = null
      } else {
        throw e
      }
    }

    if (
      JSON.stringify(previousCompileCacheDirectoryMeta) !==
      JSON.stringify(compileCacheDirectoryMeta)
    ) {
      cleanCallback(cacheDirectoryPath)
      await removeDirectory(cacheDirectoryPath)
    }
  }

  await fileWrite(cacheMetaFilePath, JSON.stringify(compileCacheDirectoryMeta, null, "  "))
}

const readPackage = (packageFilePath) => {
  const buffer = readFileSync(packageFilePath)
  const string = String(buffer)
  const packageObject = JSON.parse(string)
  return packageObject
}
