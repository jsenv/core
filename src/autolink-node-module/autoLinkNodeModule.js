// to externalize in its own module
// for now a private @dmail/autolink-node-module
// that may be move to jsenv later
// to check with way more complex structure with dependencies
// test if npm can still install once it's symlinked
// test as postinstall script
// also test if symlink can be commited to github (and npm)
// and are correclty restored on git clone or npm install
// check this for instance: https://github.com/npm/npm/issues/13050
// https://github.com/npm/npm/issues/691

// if symlink does not work (does not get published to npm)
// I could scan the file structure before publishing to npm
// and store the list of symlink I have to create
// put this inside a file
// and inside a postinstall script restore these symlink
// inside the dist folder of my module
// because dist will not contains or duplicate package.json
// so the autoLinkNodeModule cannot be runned inside it

import { fileRead, fileLStat, fileMakeDirname } from "@dmail/helper"
import { findNodeModuleFolder } from "./findNodeModuleFolder.js"
import { folderSymlink } from "./folderSymlink.js"

export const autoLinkNodeModule = async ({ folder, verbose = false }) => {
  const log = (...args) => {
    if (!verbose) return
    console.log(...args)
  }

  const packageFile = `${folder}/package.json`
  const packageSource = await fileRead(packageFile)
  const packageObject = JSON.parse(packageSource)

  const allDependencies = {
    ...(packageObject.dependencies || {}),
    ...(packageObject.devDependencies || {}),
  }

  await Promise.all(
    Object.keys(allDependencies).map(async (dependencyName) => {
      const nodeModuleFolder = `${folder}/node_modules`
      const expectedDependencyFolder = `${nodeModuleFolder}/${dependencyName}`

      log(`search for ${expectedDependencyFolder}`)

      try {
        // https://nodejs.org/docs/latest/api/fs.html#fs_fs_lstat_path_options_callback
        const lstat = await fileLStat(expectedDependencyFolder)

        // maybe we should check it is valid
        // maybe we should follow it to autolink what it points to
        if (lstat.isSymbolicLink()) {
          log(`-> found symlink`)
          return
        }

        // well maybe not throw but this is unexpected
        if (!lstat.isDirectory())
          throw new Error(`${dependencyName} folder not found at ${expectedDependencyFolder}`)

        // this is a directory, we must autosymlink it too
        log(`-> found folder, autolink it too`)
        // await autoLinkNodeModule({ folder: dependencyFolder })
      } catch (e) {
        if (e && e.code === "ENOENT") {
          log(`-> found nothing, search it`)

          const actualDependencyFolder = await findNodeModuleFolder({
            moduleName: dependencyName,
            basedir: folder,
          })
          log(`-> found at ${actualDependencyFolder}, will create symlink`)

          await fileMakeDirname(expectedDependencyFolder)
          await folderSymlink({
            sourceFolder: actualDependencyFolder,
            link: expectedDependencyFolder,
          })
          log(`symlink created for ${actualDependencyFolder} at ${expectedDependencyFolder}`)
          return
        }
        throw e
      }
    }),
  )
}
