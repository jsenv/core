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
GRAPH_VISITOR.findDependent = (graph, urlInfo, visitor) => {
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
    // When cookin html inline content, html references are not yet updated
    // consequently htmlUrlInfo.dependencies is empty
    // and inlineContentUrlInfo.dependentUrlSet is empty as well
    // in that case we resort to isInline + inlineUrlSite to establish the dependency
    if (currentUrlInfo.isInline) {
      const parentUrl = currentUrlInfo.inlineUrlSite.url;
      const parentUrlInfo = graph.getUrlInfo(parentUrl);
      visit(parentUrlInfo);
      if (found) {
        return;
      }
    }
    for (const dependentUrl of currentUrlInfo.dependentUrlSet) {
      const dependentUrlInfo = graph.getUrlInfo(dependentUrl);
      if (visit(dependentUrlInfo)) {
        if (found) {
          break;
        }
        iterate(dependentUrlInfo);
      }
    }
  };
  iterate(urlInfo);
  return found;
};
GRAPH_VISITOR.findDependency = (graph, urlInfo, visitor) => {
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
    for (const dependencyUrl of currentUrlInfo.dependencyUrlSet) {
      const dependencyUrlInfo = graph.getUrlInfo(dependencyUrl);
      if (visit(dependencyUrlInfo)) {
        if (found) {
          break;
        }
        iterate(dependencyUrlInfo);
      }
    }
  };
  iterate(urlInfo);
  return found;
};
