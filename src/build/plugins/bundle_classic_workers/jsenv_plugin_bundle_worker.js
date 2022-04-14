/*
 * NOT READY TO USE
 */

import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"

export const jsenvPluginBundleClassicWorkers = () => {
  return {
    name: "jsenv:budle_classic_workers",
    bundle: {
      js_classic: async (workerUrlInfos, { urlGraph }) => {
        const bundleResult = {}
        workerUrlInfos.forEach((workerUrlInfo) => {
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
