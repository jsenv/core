const parseSrcSet = srcset => {
  const srcCandidates = [];
  srcset.split(",").forEach(set => {
    const [specifier, descriptor] = set.trim().split(" ");
    srcCandidates.push({
      specifier,
      descriptor
    });
  });
  return srcCandidates;
};
const stringifySrcSet = srcCandidates => {
  const srcset = srcCandidates.map(({
    specifier,
    descriptor
  }) => `${specifier} ${descriptor}`).join(", ");
  return srcset;
};

export { parseSrcSet as p, stringifySrcSet as s };
