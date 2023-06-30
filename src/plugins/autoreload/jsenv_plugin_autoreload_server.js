import {
  urlIsInsideOf,
  urlToRelativeUrl,
  asUrlWithoutSearch,
} from "@jsenv/urls";

export const jsenvPluginAutoreloadServer = ({
  clientFileChangeCallbackList,
  clientFilesPruneCallbackList,
}) => {
  return {
    name: "jsenv:autoreload_server",
    appliesDuring: "dev",
    serverEvents: {
      reload: (context) => {
        const formatUrlForClient = (url) => {
          if (urlIsInsideOf(url, context.rootDirectoryUrl)) {
            return urlToRelativeUrl(url, context.rootDirectoryUrl);
          }
          if (url.startsWith("file:")) {
            return `/@fs/${url.slice("file:///".length)}`;
          }
          return url;
        };
        const notifyFullReload = ({ cause, reason, declinedBy }) => {
          context.sendServerEvent({
            cause,
            type: "full",
            typeReason: reason,
            declinedBy,
          });
        };
        const notifyPartialReload = ({ cause, reason, instructions }) => {
          context.sendServerEvent({
            cause,
            type: "hot",
            typeReason: reason,
            hotInstructions: instructions,
          });
        };
        const propagateUpdate = (firstUrlInfo) => {
          if (!context.graph.getUrlInfo(firstUrlInfo.url)) {
            return {
              declined: true,
              reason: `url not in the url graph`,
            };
          }
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
              };
            }
            const instructions = [];
            for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
              const urlInfoReferencingThisOne = referenceFromOther.ownerUrlInfo;
              if (urlInfoReferencingThisOne.data.hotDecline) {
                return {
                  declined: true,
                  reason: `a dependent file declines hot reload`,
                  declinedBy: urlInfoReferencingThisOne.url,
                };
              }
              const { hotAcceptDependencies = [] } =
                urlInfoReferencingThisOne.data;
              if (hotAcceptDependencies.includes(urlInfo.url)) {
                instructions.push({
                  type: urlInfoReferencingThisOne.type,
                  boundary: formatUrlForClient(urlInfoReferencingThisOne.url),
                  acceptedBy: formatUrlForClient(urlInfo.url),
                });
                continue;
              }
              if (seen.includes(urlInfoReferencingThisOne.url)) {
                return {
                  declined: true,
                  reason: "circular dependency",
                  declinedBy: formatUrlForClient(urlInfoReferencingThisOne.url),
                };
              }
              const dependentPropagationResult = iterate(
                urlInfoReferencingThisOne,
                [...seen, urlInfoReferencingThisOne.url],
              );
              if (dependentPropagationResult.accepted) {
                instructions.push(...dependentPropagationResult.instructions);
                continue;
              }
              if (
                // declined explicitely by an other file, it must decline the whole update
                dependentPropagationResult.declinedBy
              ) {
                return dependentPropagationResult;
              }
              // declined by absence of boundary, we can keep searching
            }
            if (instructions.length === 0) {
              return {
                declined: true,
                reason: `there is no file accepting hot reload while propagating update`,
              };
            }
            return {
              accepted: true,
              reason: `${instructions.length} dependent file(s) accepts hot reload`,
              instructions,
            };
          };
          const seen = [];
          return iterate(firstUrlInfo, seen);
        };
        clientFileChangeCallbackList.push(({ url, event }) => {
          const onUrlInfo = (urlInfo) => {
            if (!urlInfo.isUsed()) {
              return false;
            }
            const relativeUrl = formatUrlForClient(urlInfo.url);
            const hotUpdate = propagateUpdate(urlInfo);
            if (hotUpdate.declined) {
              notifyFullReload({
                cause: `${relativeUrl} ${event}`,
                reason: hotUpdate.reason,
                declinedBy: hotUpdate.declinedBy,
              });
              return true;
            }
            notifyPartialReload({
              cause: `${relativeUrl} ${event}`,
              reason: hotUpdate.reason,
              instructions: hotUpdate.instructions,
            });
            return true;
          };

          const exactUrlInfo = context.graph.getUrlInfo(url);
          if (exactUrlInfo) {
            if (onUrlInfo(exactUrlInfo)) {
              return;
            }
          }
          for (const [, urlInfo] of context.graph.urlInfoMap) {
            if (urlInfo === exactUrlInfo || urlInfo.isRoot) {
              continue;
            }
            const urlWithoutSearch = asUrlWithoutSearch(urlInfo.url);
            if (urlWithoutSearch !== url) {
              continue;
            }
            if (exactUrlInfo) {
              let referencedByUrl = false;
              for (const referenceFromOther of exactUrlInfo.referenceFromOthersSet) {
                if (referenceFromOther.url === urlInfo.url) {
                  referencedByUrl = true;
                }
              }
              if (referencedByUrl) {
                continue;
              }
            }
            if (onUrlInfo(urlInfo)) {
              return;
            }
          }
          // nothing to do: the url is not used
        });
        clientFilesPruneCallbackList.push((prunedUrlInfos, firstUrlInfo) => {
          const mainHotUpdate = propagateUpdate(firstUrlInfo);
          const cause = `following files are no longer referenced: ${prunedUrlInfos.map(
            (prunedUrlInfo) => formatUrlForClient(prunedUrlInfo.url),
          )}`;
          // now check if we can hot update the main resource
          // then if we can hot update all dependencies
          if (mainHotUpdate.declined) {
            notifyFullReload({
              cause,
              reason: mainHotUpdate.reason,
              declinedBy: mainHotUpdate.declinedBy,
            });
            return;
          }
          // main can hot update
          let i = 0;
          const instructions = [];
          while (i < prunedUrlInfos.length) {
            const prunedUrlInfo = prunedUrlInfos[i++];
            if (prunedUrlInfo.data.hotDecline) {
              notifyFullReload({
                cause,
                reason: `a pruned file declines hot reload`,
                declinedBy: formatUrlForClient(prunedUrlInfo.url),
              });
              return;
            }
            instructions.push({
              type: "prune",
              boundary: formatUrlForClient(prunedUrlInfo.url),
              acceptedBy: formatUrlForClient(firstUrlInfo.url),
            });
          }
          notifyPartialReload({
            cause,
            reason: mainHotUpdate.reason,
            instructions,
          });
        });
      },
    },
    serve: (request, context) => {
      if (request.pathname === "/__graph__") {
        const graphJson = JSON.stringify(
          context.graph.toJSON(context.rootDirectoryUrl),
        );
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(graphJson),
          },
          body: graphJson,
        };
      }
      return null;
    },
  };
};
