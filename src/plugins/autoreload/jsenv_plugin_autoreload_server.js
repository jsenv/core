import { urlIsInsideOf, urlToRelativeUrl } from "@jsenv/urls";

export const jsenvPluginAutoreloadServer = ({
  clientFileChangeEventEmitter,
  clientFileDereferencedEventEmitter,
}) => {
  return {
    name: "jsenv:autoreload_server",
    appliesDuring: "dev",
    serverEvents: {
      reload: (serverEventInfo) => {
        const formatUrlForClient = (url) => {
          if (urlIsInsideOf(url, serverEventInfo.rootDirectoryUrl)) {
            return urlToRelativeUrl(url, serverEventInfo.rootDirectoryUrl);
          }
          if (url.startsWith("file:")) {
            return `/@fs/${url.slice("file:///".length)}`;
          }
          return url;
        };
        const update = (firstUrlInfo) => {
          const boundaries = new Set();
          const instructions = [];
          const propagateUpdate = (firstUrlInfo) => {
            const iterate = (urlInfo, chain) => {
              if (urlInfo.data.hotAcceptSelf) {
                boundaries.add(urlInfo);
                instructions.push({
                  type: urlInfo.type,
                  boundary: formatUrlForClient(urlInfo.url),
                  acceptedBy: formatUrlForClient(urlInfo.url),
                });
                return {
                  accepted: true,
                  reason:
                    urlInfo === firstUrlInfo
                      ? `file accepts hot reload`
                      : `a dependent file accepts hot reload`,
                };
              }
              if (urlInfo.data.hotDecline) {
                return {
                  declined: true,
                  reason: `file declines hot reload`,
                  declinedBy: formatUrlForClient(urlInfo.url),
                };
              }
              let instructionCountBefore = instructions.length;
              for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
                if (
                  referenceFromOther.isImplicit &&
                  referenceFromOther.isWeak
                ) {
                  if (!referenceFromOther.original) {
                    continue;
                  }
                  if (referenceFromOther.original.isWeak) {
                    continue;
                  }
                }
                const urlInfoReferencingThisOne =
                  referenceFromOther.ownerUrlInfo;
                if (urlInfoReferencingThisOne.data.hotDecline) {
                  return {
                    declined: true,
                    reason: `a dependent file declines hot reload`,
                    declinedBy: formatUrlForClient(
                      urlInfoReferencingThisOne.url,
                    ),
                  };
                }
                const { hotAcceptDependencies = [] } =
                  urlInfoReferencingThisOne.data;
                if (hotAcceptDependencies.includes(urlInfo.url)) {
                  boundaries.add(urlInfoReferencingThisOne);
                  instructions.push({
                    type: urlInfoReferencingThisOne.type,
                    boundary: formatUrlForClient(urlInfoReferencingThisOne.url),
                    acceptedBy: formatUrlForClient(urlInfo.url),
                  });
                  continue;
                }
                if (chain.includes(urlInfoReferencingThisOne.url)) {
                  return {
                    declined: true,
                    reason: "dead end",
                    declinedBy: formatUrlForClient(
                      urlInfoReferencingThisOne.url,
                    ),
                  };
                }
                const dependentPropagationResult = iterateMemoized(
                  urlInfoReferencingThisOne,
                  [...chain, urlInfoReferencingThisOne.url],
                );
                if (dependentPropagationResult.accepted) {
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
              if (instructionCountBefore === instructions.length) {
                return {
                  declined: true,
                  reason: `there is no file accepting hot reload while propagating update`,
                };
              }
              return {
                accepted: true,
                reason: `${instructions.length} dependent file(s) accepts hot reload`,
              };
            };

            const map = new Map();
            const iterateMemoized = (urlInfo, chain) => {
              const resultFromCache = map.get(urlInfo.url);
              if (resultFromCache) {
                return resultFromCache;
              }
              const result = iterate(urlInfo, chain);
              map.set(urlInfo.url, result);
              return result;
            };
            map.clear();
            return iterateMemoized(firstUrlInfo, []);
          };

          const propagationResult = propagateUpdate(firstUrlInfo);
          const seen = new Set();
          const invalidateImporters = (urlInfo) => {
            // to indicate this urlInfo should be modified
            for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
              const urlInfoReferencingThisOne = referenceFromOther.ownerUrlInfo;
              const { hotAcceptDependencies = [] } =
                urlInfoReferencingThisOne.data;
              if (hotAcceptDependencies.includes(urlInfo.url)) {
                continue;
              }
              if (seen.has(urlInfoReferencingThisOne)) {
                continue;
              }
              seen.add(urlInfoReferencingThisOne);
              // see https://github.com/vitejs/vite/blob/ab5bb40942c7023046fa6f6d0b49cabc105b6073/packages/vite/src/node/server/moduleGraph.ts#L205C5-L207C6
              if (boundaries.has(urlInfoReferencingThisOne)) {
                return;
              }
              urlInfoReferencingThisOne.descendantModifiedTimestamp =
                Date.now();
              invalidateImporters(urlInfoReferencingThisOne);
            }
          };
          invalidateImporters(firstUrlInfo);
          boundaries.clear();
          seen.clear();
          return {
            ...propagationResult,
            instructions,
          };
        };

        // We are delaying the moment we tell client how to reload because:
        //
        // 1. clientFileDereferencedEventEmitter can emit multiple times in a row
        // It happens when previous references are removed by stopCollecting (in "references.js")
        // In that case we could regroup the calls but we prefer to rely on debouncing to also cover
        // code that would remove many url in a row by other means (like reference.remove())
        //
        // 2. clientFileChangeEventEmitter can emit a lot of times in a short period (git checkout for instance)
        // In that case it's better to cooldown thanks to debouncing
        //
        // And we want to gather all the actions to take in response to these events because
        // we want to favor full-reload when needed and resort to partial reload afterwards
        // it's also important to ensure the client will fetch the server in the same order
        const delayedActionSet = new Set();
        let timeout;
        const delayAction = (action) => {
          delayedActionSet.add(action);
          clearTimeout(timeout);
          timeout = setTimeout(handleDelayedActions);
        };

        const handleDelayedActions = () => {
          const actionSet = new Set(delayedActionSet);
          delayedActionSet.clear();
          let reloadMessage = null;
          for (const action of actionSet) {
            if (action.type === "change") {
              const { changedUrlInfo, event } = action;
              if (!changedUrlInfo.isUsed()) {
                continue;
              }
              const hotUpdate = update(changedUrlInfo);
              const relativeUrl = formatUrlForClient(changedUrlInfo.url);
              if (hotUpdate.declined) {
                reloadMessage = {
                  cause: `${relativeUrl} ${event}`,
                  type: "full",
                  typeReason: hotUpdate.reason,
                  declinedBy: hotUpdate.declinedBy,
                };
                break;
              }
              const instructions = hotUpdate.instructions;
              if (reloadMessage) {
                reloadMessage.hotInstructions.push(...instructions);
              } else {
                reloadMessage = {
                  cause: `${relativeUrl} ${event}`,
                  type: "hot",
                  typeReason: hotUpdate.reason,
                  hotInstructions: instructions,
                };
              }
              continue;
            }

            if (action.type === "prune") {
              const { prunedUrlInfo, lastReferenceFromOther } = action;
              if (lastReferenceFromOther.type === "sourcemap_comment") {
                // Can happen when starting dev server with sourcemaps: "file"
                // In that case, as sourcemaps are injected, the reference
                // are lost and sourcemap is considered as pruned
                continue;
              }
              const { ownerUrlInfo } = lastReferenceFromOther;
              if (!ownerUrlInfo.isUsed()) {
                continue;
              }
              const ownerHotUpdate = update(ownerUrlInfo);
              const cause = `${formatUrlForClient(
                prunedUrlInfo.url,
              )} is no longer referenced`;
              // now check if we can hot update the parent resource
              // then if we can hot update all dependencies
              if (ownerHotUpdate.declined) {
                reloadMessage = {
                  cause,
                  type: "full",
                  typeReason: ownerHotUpdate.reason,
                  declinedBy: ownerHotUpdate.declinedBy,
                };
                break;
              }
              // parent can hot update
              // but pruned url info declines
              if (prunedUrlInfo.data.hotDecline) {
                reloadMessage = {
                  cause,
                  type: "full",
                  typeReason: `a pruned file declines hot reload`,
                  declinedBy: formatUrlForClient(prunedUrlInfo.url),
                };
                break;
              }
              const pruneInstruction = {
                type: "prune",
                boundary: formatUrlForClient(prunedUrlInfo.url),
                acceptedBy: formatUrlForClient(
                  lastReferenceFromOther.ownerUrlInfo.url,
                ),
              };
              if (reloadMessage) {
                reloadMessage.hotInstructions.push(pruneInstruction);
              } else {
                reloadMessage = {
                  cause,
                  type: "hot",
                  typeReason: ownerHotUpdate.reason,
                  hotInstructions: [pruneInstruction],
                };
              }
            }
          }
          if (reloadMessage) {
            serverEventInfo.sendServerEvent(reloadMessage);
          }
        };

        clientFileChangeEventEmitter.on(({ url, event }) => {
          const changedUrlInfo = serverEventInfo.kitchen.graph.getUrlInfo(url);
          if (!changedUrlInfo) {
            return;
          }
          delayAction({
            type: "change",
            changedUrlInfo,
            event,
          });
          // for (const searchParamVariant of changedUrlInfo.searchParamVariantSet) {
          //   delayAction({
          //     type: "change",
          //     changedUrlInfo: searchParamVariant,
          //     event,
          //   });
          // }
        });
        clientFileDereferencedEventEmitter.on(
          (prunedUrlInfo, lastReferenceFromOther) => {
            delayAction({
              type: "prune",
              prunedUrlInfo,
              lastReferenceFromOther,
            });
          },
        );
      },
    },
    serve: (serveInfo) => {
      if (serveInfo.request.pathname === "/__graph__") {
        const graphJson = JSON.stringify(
          serveInfo.kitchen.graph.toJSON(serveInfo.rootDirectoryUrl),
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
