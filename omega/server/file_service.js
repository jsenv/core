import { urlToContentType } from "@jsenv/server"

import { callPluginsHook } from "#internal/plugin_utils.js"
import { loadSourcemap } from "#internal/sourcemap/sourcemap_loader.js"
import { composeTwoSourcemaps } from "#internal/sourcemap/sourcemap_composition.js"
import { generateSourcemapUrl } from "#internal/sourcemap/sourcemap_utils.js"
import { injectSourcemap } from "#internal/sourcemap/sourcemap_injection.js"

import { parseUserAgentHeader } from "./user_agent.js"

export const createFileService = ({
  signal,
  logger,
  projectDirectoryUrl,
  sourcemapInjectionMethod = "inline",
  plugins,
}) => {
  let context = {
    signal,
    logger,
  }
  const callHook = (hookName, params) =>
    callPluginsHook(plugins, hookName, {
      context,
      ...params,
    })
  context.callHook = callHook

  return async (request) => {
    const { runtimeName, runtimeVersion } = parseUserAgentHeader(
      request.headers["user-agent"],
    )
    try {
      context = {
        ...context,
        runtimeName,
        runtimeVersion,
      }

      const url = await callHook("resolve", {
        baseUrl: projectDirectoryUrl,
        urlSpecifier: request.ressource.slice(1),
      })
      if (!url) {
        return {
          status: 404,
        }
      }
      const loadResult = await callHook("load", {
        baseUrl: projectDirectoryUrl,
        url,
      })
      if (loadResult === null) {
        return {
          status: 404,
        }
      }
      let {
        contentType = urlToContentType(url),
        // can be a buffer (used for binary files) or a string
        content,
      } = loadResult

      const references = await callHook("parse", {
        url,
        contentType,
        content,
      })
      context.references = referencesimport {
        urlToRelativeUrl,
        resolveUrl,
        urlToParentUrl,
        ensureWindowsDriveLetter,
      } from "@jsenv/filesystem"
      
      import { memoizeAsyncFunctionByUrl } from "../memoizeAsyncFunction.js"
      import { findAsync } from "../find_async.js"
      import {
        readPackageFile,
        PACKAGE_NOT_FOUND,
        PACKAGE_WITH_SYNTAX_ERROR,
      } from "./readPackageFile.js"
      import { applyPackageManualOverride } from "./applyPackageManualOverride.js"
      
      export const createFindNodeModulePackage = () => {
        const readPackageFileMemoized = memoizeAsyncFunctionByUrl(
          (packageFileUrl) => {
            return readPackageFile(packageFileUrl)
          },
        )
        return ({
          projectDirectoryUrl,
          nodeModulesOutsideProjectAllowed,
          packagesManualOverrides = {},
          packageFileUrl,
          dependencyName,
        }) => {
          const nodeModuleCandidates = [
            ...getNodeModuleCandidatesInsideProject({
              projectDirectoryUrl,
              packageFileUrl,
            }),
            ...(nodeModulesOutsideProjectAllowed
              ? getNodeModuleCandidatesOutsideProject({
                  projectDirectoryUrl,
                })
              : []),
          ]
          return findAsync({
            array: nodeModuleCandidates,
            start: async (nodeModuleCandidate) => {
              const packageFileUrlCandidate = `${nodeModuleCandidate}${dependencyName}/package.json`
              const packageObjectCandidate = await readPackageFileMemoized(
                packageFileUrlCandidate,
              )
              return {
                packageFileUrl: packageFileUrlCandidate,
                packageJsonObject: applyPackageManualOverride(
                  packageObjectCandidate,
                  packagesManualOverrides,
                ),
                syntaxError: packageObjectCandidate === PACKAGE_WITH_SYNTAX_ERROR,
              }
            },
            predicate: ({ packageJsonObject }) => {
              return packageJsonObject !== PACKAGE_NOT_FOUND
            },
          })
        }
      }
      
      const getNodeModuleCandidatesInsideProject = ({
        projectDirectoryUrl,
        packageFileUrl,
      }) => {
        const packageDirectoryUrl = resolveUrl("./", packageFileUrl)
        if (packageDirectoryUrl === projectDirectoryUrl) {
          return [`${projectDirectoryUrl}node_modules/`]
        }
        const packageDirectoryRelativeUrl = urlToRelativeUrl(
          packageDirectoryUrl,
          projectDirectoryUrl,
        )
        const candidates = []
        const relativeNodeModuleDirectoryArray =
          packageDirectoryRelativeUrl.split("node_modules/")
        // remove the first empty string
        relativeNodeModuleDirectoryArray.shift()
        let i = relativeNodeModuleDirectoryArray.length
        while (i--) {
          candidates.push(
            `${projectDirectoryUrl}node_modules/${relativeNodeModuleDirectoryArray
              .slice(0, i + 1)
              .join("node_modules/")}node_modules/`,
          )
        }
        return [...candidates, `${projectDirectoryUrl}node_modules/`]
      }
      
      const getNodeModuleCandidatesOutsideProject = ({ projectDirectoryUrl }) => {
        const candidates = []
        const parentDirectoryUrl = urlToParentUrl(projectDirectoryUrl)
        const { pathname } = new URL(parentDirectoryUrl)
        const directories = pathname.slice(1, -1).split("/")
        let i = directories.length
        while (i--) {
          const nodeModulesDirectoryUrl = ensureWindowsDriveLetter(
            `file:///${directories.slice(0, i + 1).join("/")}/node_modules/`,
            projectDirectoryUrl,
          )
          candidates.push(nodeModulesDirectoryUrl)
        }
        return [
          ...candidates,
          ensureWindowsDriveLetter(`file:///node_modules`, projectDirectoryUrl),
        ]
      }
      
      const transformResult = await callHook("transform", {
        url,
        contentType,
        content,
      })
      if (transformResult) {
        content = transformResult.content
        let sourcemap = await loadSourcemap({
          context,
          url,
          contentType,
          content,
        })
        const sourcemapFromPlugin = transformResult.sourcemap
        if (sourcemap && sourcemapFromPlugin) {
          sourcemap = composeTwoSourcemaps(sourcemap, transformResult.sourcemap)
        } else if (sourcemapFromPlugin) {
          sourcemap = sourcemapFromPlugin
        }
        if (sourcemap) {
          content = injectSourcemap({
            url,
            contentType,
            content,
            sourcemap,
            sourcemapUrl: generateSourcemapUrl(url),
            sourcemapInjectionMethod,
          })
        }
      }
      return {
        status: 200,
        headers: {
          "content-type": contentType,
          "content-length": Buffer.byteLength(content),
        },
        body: content,
      }
    } catch (e) {
      if (e.code === "ENOENT") {
        return {
          status: 404,
        }
      }
      if (e.asResponse) {
        return e.asResponse()
      }
      throw e
    }
  }
}
