import {
  urlIsInsideOf,
  urlToRelativeUrl,
  asUrlWithoutSearch,
} from "@jsenv/urls"

export const jsenvPluginAutoreloadServer = ({
  clientFileChangeCallbackList,
  clientFilesPruneCallbackList,
}) => {
  return {
    name: "jsenv:autoreload_server",
    appliesDuring: "dev",
    serverEvents: {
      reload: ({ sendServerEvent, rootDirectoryUrl, urlGraph }) => {
        const formatUrlForClient = (url) => {
          if (urlIsInsideOf(url, rootDirectoryUrl)) {
            return urlToRelativeUrl(url, rootDirectoryUrl)
          }
          if (url.startsWith("file:")) {
            return `/@fs/${url.slice("file:///".length)}`
          }
          return url
        }

        const notifyDeclined = ({ cause, reason, declinedBy }) => {
          sendServerEvent({
            cause,
            type: "full",
            typeReason: reason,
            declinedBy,
          })
        }
        const notifyAccepted = ({ cause, reason, instructions }) => {
          sendServerEvent({
            cause,
            type: "hot",
            typeReason: reason,
            hotInstructions: instructions,
          })
        }
        const propagateUpdate = (firstUrlInfo) => {
          const iterate = (urlInfo, seen) => {
            if (urlInfo.data.hotAcceptSelf) {
              return {
                accepted: true,
                reason:
                  urlInfo === firstUrlInfo
                    ? `file accepts hot reload`
                    : `a dependent file accepts hot reload`,
                instructions: [
                  {
                    type: urlInfo.type,
                    boundary: formatUrlForClient(urlInfo.url),
                    acceptedBy: formatUrlForClient(urlInfo.url),
                  },
                ],
              }
            }
            const { dependents } = urlInfo
            const instructions = []
            for (const dependentUrl of dependents) {
              const dependentUrlInfo = urlGraph.getUrlInfo(dependentUrl)
              if (dependentUrlInfo.data.hotDecline) {
                return {
                  declined: true,
                  reason: `a dependent file declines hot reload`,
                  declinedBy: dependentUrl,
                }
              }
              const { hotAcceptDependencies = [] } = dependentUrlInfo.data
              if (hotAcceptDependencies.includes(urlInfo.url)) {
                instructions.push({
                  type: dependentUrlInfo.type,
                  boundary: formatUrlForClient(dependentUrl),
                  acceptedBy: formatUrlForClient(urlInfo.url),
                })
                continue
              }
              if (seen.includes(dependentUrl)) {
                return {
                  declined: true,
                  reason: "circular dependency",
                  declinedBy: formatUrlForClient(dependentUrl),
                }
              }
              const dependentPropagationResult = iterate(dependentUrlInfo, [
                ...seen,
                dependentUrl,
              ])
              if (dependentPropagationResult.accepted) {
                instructions.push(...dependentPropagationResult.instructions)
                continue
              }
              if (
                // declined explicitely by an other file, it must decline the whole update
                dependentPropagationResult.declinedBy
              ) {
                return dependentPropagationResult
              }
              // declined by absence of boundary, we can keep searching
              continue
            }
            if (instructions.length === 0) {
              return {
                declined: true,
                reason: `there is no file accepting hot reload while propagating update`,
              }
            }
            return {
              accepted: true,
              reason: `${instructions.length} dependent file(s) accepts hot reload`,
              instructions,
            }
          }
          const seen = []
          return iterate(firstUrlInfo, seen)
        }
        clientFileChangeCallbackList.push(({ url, event }) => {
          const onUrlInfo = (urlInfo) => {
            const relativeUrl = formatUrlForClient(url)
            const hotUpdate = propagateUpdate(urlInfo)
            if (hotUpdate.declined) {
              notifyDeclined({
                cause: `${relativeUrl} ${event}`,
                reason: hotUpdate.reason,
                declinedBy: hotUpdate.declinedBy,
              })
            } else {
              notifyAccepted({
                cause: `${relativeUrl} ${event}`,
                reason: hotUpdate.reason,
                instructions: hotUpdate.instructions,
              })
            }
          }
          urlGraph.urlInfoMap.forEach((urlInfo) => {
            if (urlInfo.url === url) {
              onUrlInfo(urlInfo)
            } else {
              const urlWithoutSearch = asUrlWithoutSearch(urlInfo.url)
              if (urlWithoutSearch === url) {
                onUrlInfo(urlInfo)
              }
            }
          })
        })
        clientFilesPruneCallbackList.push((prunedUrlInfos, firstUrlInfo) => {
          const mainHotUpdate = propagateUpdate(firstUrlInfo)
          const cause = `following files are no longer referenced: ${prunedUrlInfos.map(
            (prunedUrlInfo) => formatUrlForClient(prunedUrlInfo.url),
          )}`
          // now check if we can hot update the main resource
          // then if we can hot update all dependencies
          if (mainHotUpdate.declined) {
            notifyDeclined({
              cause,
              reason: mainHotUpdate.reason,
              declinedBy: mainHotUpdate.declinedBy,
            })
            return
          }
          // main can hot update
          let i = 0
          const instructions = []
          while (i < prunedUrlInfos.length) {
            const prunedUrlInfo = prunedUrlInfos[i++]
            if (prunedUrlInfo.data.hotDecline) {
              notifyDeclined({
                cause,
                reason: `a pruned file declines hot reload`,
                declinedBy: formatUrlForClient(prunedUrlInfo.url),
              })
              return
            }
            instructions.push({
              type: "prune",
              boundary: formatUrlForClient(prunedUrlInfo.url),
              acceptedBy: formatUrlForClient(firstUrlInfo.url),
            })
          }
          notifyAccepted({
            cause,
            reason: mainHotUpdate.reason,
            instructions,
          })
        })
      },
    },
    serve: (request, { rootDirectoryUrl, urlGraph }) => {
      if (request.pathname === "/__graph__") {
        const graphJson = JSON.stringify(urlGraph.toJSON(rootDirectoryUrl))
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(graphJson),
          },
          body: graphJson,
        }
      }
      return null
    },
  }
}
