export const sortByDependencies = (nodes) => {
  const visited = [];
  const sorted = [];
  const circular = [];
  const visit = (url) => {
    const isSorted = sorted.includes(url);
    if (isSorted) {
      return;
    }
    const isVisited = visited.includes(url);
    if (isVisited) {
      if (!circular.includes(url)) {
        circular.push(url);
      }
    } else {
      visited.push(url);
      nodes[url].referenceToOthersSet.forEach((referenceToOther) => {
        visit(referenceToOther.url, url);
      });
      sorted.push(url);
    }
  };
  Object.keys(nodes).forEach((url) => {
    visit(url);
  });
  sorted.circular = circular;
  return sorted;
};
