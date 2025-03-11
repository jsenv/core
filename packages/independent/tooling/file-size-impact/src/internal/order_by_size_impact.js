export const orderBySizeImpact = (fileByFileImpact, sizeNames) => {
  const impactOrderedBySizeImpact = {};
  const files = Object.keys(fileByFileImpact);
  const firstSizeName = sizeNames[0];
  files.sort((leftFile, rightFile) => {
    const leftFileSizeImpact =
      fileByFileImpact[leftFile].sizeImpactMap[firstSizeName];
    const rightFileSizeImpact =
      fileByFileImpact[rightFile].sizeImpactMap[firstSizeName];
    if (leftFileSizeImpact === 0) {
      return 1;
    }
    if (rightFileSizeImpact === 0) {
      return -1;
    }
    if (leftFileSizeImpact < rightFileSizeImpact) {
      return 1;
    }
    if (leftFileSizeImpact > rightFileSizeImpact) {
      return -1;
    }
    return 0;
  });
  files.forEach((file) => {
    impactOrderedBySizeImpact[file] = fileByFileImpact[file];
  });
  return impactOrderedBySizeImpact;
};
