import { exec } from "node:child_process"
import {
  resolveUrl,
  readDirectory,
  urlToFileSystemPath,
} from "@jsenv/filesystem"

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
  await Promise.all(
    packageNames.map(async (packageName) => {
      const packageDirectoryUrl = resolveUrl(packageName, packagesDirectorUrl)
      await execCommand("npm install", {
        cwd: urlToFileSystemPath(packageDirectoryUrl),
      })
    }),
  )
}

const demoDirectoryUrl = resolveUrl("./docs/demo/", jsenvDirectoryUrl)
await execCommand("npm install", {
  cwd: urlToFileSystemPath(demoDirectoryUrl),
})
