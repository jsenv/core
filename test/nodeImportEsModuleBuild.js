import { fork } from "child_process"
import { resolveDirectoryUrl, resolveUrl, urlToFileSystemPath } from "@jsenv/util"
import { createChildExecArgv } from "@jsenv/core/src/internal/node-launcher/createChildExecArgv.js"

const CONTROLLABLE_FILE_URL = resolveUrl("./controllable-file.js", import.meta.url)

export const nodeImportEsModuleBuild = async ({
  projectDirectoryUrl,
  testDirectoryRelativeUrl,
  mainRelativeUrl,
  awaitNamespace = true,
  topLevelAwait,
}) => {
  const testDirectoryUrl = resolveDirectoryUrl(testDirectoryRelativeUrl, projectDirectoryUrl)
  const mainFileUrl = resolveUrl(mainRelativeUrl, testDirectoryUrl)
  const execArgv = await createChildExecArgv({
    topLevelAwait,
  })
  const child = fork(urlToFileSystemPath(CONTROLLABLE_FILE_URL), {
    execArgv,
  })

  return new Promise((resolve, reject) => {
    child.once("message", () => {
      child.once("message", ({ error, namespace }) => {
        child.kill()
        if (error) {
          reject(error)
        } else {
          resolve({ namespace })
        }
      })
      child.send({
        url: mainFileUrl,
        awaitNamespace,
      })
    })
  })
}

/*
The code below is unused, and is a basic reimplementation of import function.
It will certainly never be useful but it might be interesting so keeping it here for now.

import { SourceTextModule } from "vm"
import { resolveUrl, readFile } from "@jsenv/util"

// we could also spawn a child process too
export const importFake = async (url) => {
  const urlSource = await readFile(url)
  const esModule = new SourceTextModule(urlSource, {
    identifier: url,
    importModuleDynamically: linker,
  })
  await esModule.link(linker)
  await esModule.evaluate()
  return esModule.namespace
}

const linker = async (specifier, importer) => {
  const dependencyUrl = resolveUrl(specifier, importer.identifier)
  const dependencyModule = new SourceTextModule(await readFile(dependencyUrl), {
    identifier: dependencyUrl,
    context: importer.context,
    importModuleDynamically: linker,
  })
  await dependencyModule.link(linker)
  await dependencyModule.evaluate()
  return dependencyModule
}
*/
