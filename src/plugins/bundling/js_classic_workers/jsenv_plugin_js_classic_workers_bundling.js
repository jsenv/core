/*
 * TODO:
 * for each js_classic where subtype is a worker
 * take the url info and find importScripts calls
 * and replace them with the corresponding url info file content
 * we'll ikely need to save the importScripts node location to be able to do that
 */

// import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"

export const jsenvPluginJsClassicWorkersBundling = () => {
  return {
    name: "jsenv:js_classic_workers_bundling",
    appliesDuring: "*",
    bundle: {
      // js_classic: async (urlInfos, { urlGraph }) => {
      //   const bundleResult = {}
      //   urlInfos.forEach((workerUrlInfo) => {
      //     const magicSource = createMagicSource(workerUrlInfo.content)
      //     const visitDependencies = (urlInfo) => {
      //       urlInfo.dependencies.forEach((dependencyUrl) => {
      //         const dependencyUrlInfo = urlGraph.getUrlInfo(dependencyUrl)
      //         // what if there was some sourcemap for this urlInfo?
      //         // we should compose it too
      //         magicSource.append(dependencyUrlInfo.content)
      //         visitDependencies(dependencyUrlInfo)
      //       })
      //     }
      //     visitDependencies(workerUrlInfo)
      //     const { content, sourcemap } = magicSource.toContentAndSourcemap()
      //     bundleResult[workerUrlInfo.url] = {
      //       type: "worker_classic",
      //       content,
      //       sourcemap,
      //     }
      //   })
      //   return bundleResult
      // },
    },
  }
}
