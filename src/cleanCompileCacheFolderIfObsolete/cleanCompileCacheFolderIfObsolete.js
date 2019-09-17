import { readFileSync } from "fs"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { jsenvCorePathname } from "../jsenvCorePath/jsenvCorePath.js"
import { readCompileCacheFolderMeta } from "./readCompileCacheFolderMeta.js"
import { writeCompileCacheFolderMeta } from "./writeCompileCacheFolderMeta.js"
import { removeFolder } from "./removeFolder.js"

export const cleanCompileCacheFolderIfObsolete = async ({
  projectPathname,
  compileCacheFolderRelativePath,
  forceObsolete = false,
  cacheMeta,
  cleanCallback = () => {},
}) => {
  const jsenvCorePackagePath = pathnameToOperatingSystemPath(`${jsenvCorePathname}/package.json`)
  const jsenvCorePackageVersion = readPackage(jsenvCorePackagePath).version

  const compileCacheFolderMeta = {
    ...cacheMeta,
    jsenvCorePackageVersion,
  }

  const cacheFolderPath = pathnameToOperatingSystemPath(
    `${projectPathname}${compileCacheFolderRelativePath}`,
  )

  if (forceObsolete) {
    cleanCallback(cacheFolderPath)
    await removeFolder(cacheFolderPath)
  } else {
    const previousCompileCacheFolderMeta = await readCompileCacheFolderMeta({
      projectPathname,
      compileCacheFolderRelativePath,
    })
    if (JSON.stringify(previousCompileCacheFolderMeta) !== JSON.stringify(compileCacheFolderMeta)) {
      cleanCallback(cacheFolderPath)
      await removeFolder(cacheFolderPath)
    }
  }

  await writeCompileCacheFolderMeta({
    projectPathname,
    compileCacheFolderRelativePath,
    compileCacheFolderMeta,
  })
}

const readPackage = (packagePath) => {
  const buffer = readFileSync(packagePath)
  const string = String(buffer)
  const packageObject = JSON.parse(string)
  return packageObject
}
