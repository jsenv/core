import { exec } from "child_process"
import { resolveUrl, readDirectory, urlToFileSystemPath } from "@jsenv/util"

const jsenvDirectoryUrl = resolveUrl("../../", import.meta.url)
const packagesDirectorUrl = resolveUrl("packages/", jsenvDirectoryUrl)

const packageNames = await readDirectory(packagesDirectorUrl)
await Promise.all(
  packageNames.map(async (packageName) => {
    const packageDirectoryUrl = resolveUrl(packageName, packagesDirectorUrl)
    await new Promise((resolve, reject) => {
      exec(
        "npm link @jsenv/core",
        {
          cwd: urlToFileSystemPath(packageDirectoryUrl),
        },
        (error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        },
      )
    })
  }),
)
