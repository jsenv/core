/*
 * In theory we can just append js classic together
 * In practice systemjs do not bundle well
 * and for Worker there is importScripts calls
 * so what we want to do is the following:
 *
 * - all subtype can be bundled together using an output format of systemjs
 * (ideally we would avoid dependency to systemjs when the resulting
 * chunk do not have dependency (no dynamic import))
 * - if the file is written with importScript calls skip bundling for now
 * because rollup do not support that (or use an other strategy like the one with babel I had)
 */

import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"

export const jsenvPluginBundleJsClassic = () => {
  return {
    name: "jsenv:bundle_js_classic",
    appliesDuring: "*",
    bundle: {
      js_classic: async (urlInfos, { urlGraph }) => {
        const bundleResult = {}
        urlInfos.forEach((workerUrlInfo) => {
          const magicSource = createMagicSource(workerUrlInfo.content)
          const visitDependencies = (urlInfo) => {
            urlInfo.dependencies.forEach((dependencyUrl) => {
              const dependencyUrlInfo = urlGraph.getUrlInfo(dependencyUrl)
              // what if there was some sourcemap for this urlInfo?
              // we should compose it too
              magicSource.append(dependencyUrlInfo.content)
              visitDependencies(dependencyUrlInfo)
            })
          }
          visitDependencies(workerUrlInfo)
          const { content, sourcemap } = magicSource.toContentAndSourcemap()
          bundleResult[workerUrlInfo.url] = {
            type: "worker_classic",
            content,
            sourcemap,
          }
        })
        return bundleResult
      },
    },
  }
}
