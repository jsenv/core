/*
 * This script ensure versions in "@jsenv/core/package.json" corresponding to
 * workspaces packages are versions found in "./packages/$/package.json"
 * The goal is to keep versions in "@jsenv/core" in sync.
 * I don't want to put "*" in dependencies/devDependencies to workspace packages
 * so that project using @jsenv/core have predictable dependency versions
 */

import { UNICODE } from "@jsenv/log"
import { readFile, listFilesMatching, writeFile } from "@jsenv/filesystem"

import { projectDirectoryUrl } from "@jsenv/core/jsenv.config.mjs"

const packageDirectoryUrls = await listFilesMatching({
  directoryUrl: projectDirectoryUrl,
  patterns: {
    "./packages/*/package.json": true,
  },
})
const workspacePackages = {}
await Promise.all(
  packageDirectoryUrls.map(async (packageDirectoryUrl) => {
    const packageUrl = new URL("package.json", packageDirectoryUrl)
    const packageObject = await readFile(packageUrl, { as: "json" })
    workspacePackages[packageObject.name] = packageObject
  }),
)
const jsenvCorePackageUrl = new URL("package.json", projectDirectoryUrl)
const jsenvCorePackageObject = await readFile(jsenvCorePackageUrl, {
  as: "json",
})
const updates = []
const { dependencies = {} } = jsenvCorePackageObject
Object.keys(dependencies).forEach((dependencyName) => {
  const workspacePackage = workspacePackages[dependencyName]
  if (!workspacePackage) return
  const versionInJsenvCore = dependencies[dependencyName]
  const version = workspacePackage.version
  if (version === versionInJsenvCore) return
  dependencies[dependencyName] = version
  updates.push(dependencyName)
})
const { devDependencies = {} } = jsenvCorePackageObject
Object.keys(devDependencies).forEach((devDependencyName) => {
  const workspacePackage = workspacePackages[devDependencyName]
  if (!workspacePackage) return
  const versionInJsenvCore = dependencies[devDependencyName]
  const version = workspacePackage.version
  if (version === versionInJsenvCore) return
  devDependencies[devDependencyName] = version
  updates.push(devDependencyName)
})
const updateCount = updates.length
if (updateCount === 0) {
  console.log(`${UNICODE.OK} workspace package version are in sync`)
} else {
  await writeFile(
    jsenvCorePackageUrl,
    JSON.stringify(jsenvCorePackageObject, null, "  "),
  )
  console.log(
    `${UNICODE.INFO} ${updateCount} workspace package version(s) updated`,
  )
}
