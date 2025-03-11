export const GRAPH_VISITOR = {};

GRAPH_VISITOR.map = (graph, callback) => {
  const array = [];
  graph.urlInfoMap.forEach((urlInfo) => {
    array.push(callback(urlInfo));
  });
  return array;
};
GRAPH_VISITOR.forEach = (graph, callback) => {
  graph.urlInfoMap.forEach(callback);
};
GRAPH_VISITOR.filter = (graph, callback) => {
  const urlInfos = [];
  graph.urlInfoMap.forEach((urlInfo) => {
    if (callback(urlInfo)) {
      urlInfos.push(urlInfo);
    }
  });
  return urlInfos;
};
GRAPH_VISITOR.find = (graph, callback) => {
  let found = null;
  for (const urlInfo of graph.urlInfoMap.values()) {
    if (callback(urlInfo)) {
      found = urlInfo;
      break;
    }
  }
  return found;
};
GRAPH_VISITOR.findDependent = (urlInfo, visitor) => {
  const graph = urlInfo.graph;
  const seen = new Set();
  seen.add(urlInfo.url);
  let found = null;
  const visit = (dependentUrlInfo) => {
    if (seen.has(dependentUrlInfo.url)) {
      return false;
    }
    seen.add(dependentUrlInfo.url);
    if (visitor(dependentUrlInfo)) {
      found = dependentUrlInfo;
    }
    return true;
  };
  const iterate = (currentUrlInfo) => {
    // When cookin html inline content, html dependencies are not yet updated
    // consequently htmlUrlInfo.dependencies is empty
    // and inlineContentUrlInfo.referenceFromOthersSet is empty as well
    // in that case we resort to isInline + inlineUrlSite to establish the dependency
    if (currentUrlInfo.isInline) {
      const parentUrl = currentUrlInfo.inlineUrlSite.url;
      const parentUrlInfo = graph.getUrlInfo(parentUrl);
      visit(parentUrlInfo);
      if (found) {
        return;
      }
    }
    for (const referenceFromOther of currentUrlInfo.referenceFromOthersSet) {
      const urlInfoReferencingThisOne = referenceFromOther.ownerUrlInfo;
      if (visit(urlInfoReferencingThisOne)) {
        if (found) {
          break;
        }
        iterate(urlInfoReferencingThisOne);
      }
    }
  };
  iterate(urlInfo);
  return found;
};
GRAPH_VISITOR.findDependency = (urlInfo, visitor) => {
  const graph = urlInfo.graph;
  const seen = new Set();
  seen.add(urlInfo.url);
  let found = null;
  const visit = (dependencyUrlInfo) => {
    if (seen.has(dependencyUrlInfo.url)) {
      return false;
    }
    seen.add(dependencyUrlInfo.url);
    if (visitor(dependencyUrlInfo)) {
      found = dependencyUrlInfo;
    }
    return true;
  };
  const iterate = (currentUrlInfo) => {
    for (const referenceToOther of currentUrlInfo.referenceToOthersSet) {
      const referencedUrlInfo = graph.getUrlInfo(referenceToOther);
      if (visit(referencedUrlInfo)) {
        if (found) {
          break;
        }
        iterate(referencedUrlInfo);
      }
    }
  };
  iterate(urlInfo);
  return found;
};

// This function will be used in "build.js"
// by passing rootUrlInfo as first arg
// -> this ensure we visit only urls with strong references
// because we start from root and ignore weak ref
// The alternative would be to iterate on urlInfoMap
// and call urlInfo.isUsed() but that would be more expensive
GRAPH_VISITOR.forEachUrlInfoStronglyReferenced = (
  initialUrlInfo,
  callback,
  { directoryUrlInfoSet } = {},
) => {
  const seen = new Set();
  seen.add(initialUrlInfo);
  const iterateOnReferences = (urlInfo) => {
    for (const referenceToOther of urlInfo.referenceToOthersSet) {
      if (referenceToOther.gotInlined()) {
        continue;
      }
      if (referenceToOther.url.startsWith("ignore:")) {
        continue;
      }
      const referencedUrlInfo = referenceToOther.urlInfo;
      if (
        directoryUrlInfoSet &&
        referenceToOther.expectedType === "directory"
      ) {
        directoryUrlInfoSet.add(referencedUrlInfo);
      }
      if (referenceToOther.isWeak) {
        continue;
      }
      if (seen.has(referencedUrlInfo)) {
        continue;
      }
      seen.add(referencedUrlInfo);
      callback(referencedUrlInfo);
      iterateOnReferences(referencedUrlInfo);
    }
  };
  iterateOnReferences(initialUrlInfo);
  seen.clear();
};
