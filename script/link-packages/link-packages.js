import { exec } from "child_process"
import { resolveUrl, readDirectory, urlToFileSystemPath } from "@jsenv/filesystem"

const jsenvDirectoryUrl = resolveUrl("../../", import.meta.url)
const packagesDirectorUrl = resolveUrl("packages/", jsenvDirectoryUrl)

const execCommand = (command, { cwd }) => {
  console.log(`> cd ${cwd}
> ${command}`)
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        cwd,
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
}

const packageNames = await readDirectory(packagesDirectorUrl)
if (packageNames.length) {
  await execCommand("npm link", { cwd: urlToFileSystemPath(jsenvDirectoryUrl) })

  await Promise.all(
    packageNames.map(async (packageName) => {
      const packageDirectoryUrl = resolveUrl(packageName, packagesDirectorUrl)
      await execCommand("npm link @jsenv/core", {
        cwd: urlToFileSystemPath(packageDirectoryUrl),
      })
    }),
  )
}
