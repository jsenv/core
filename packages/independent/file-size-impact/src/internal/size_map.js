export const getSizeMapsOneFile = ({ sizeNames, beforeMerge, afterMerge }) => {
  const sizeMapBeforeMerge = {};
  const sizeMapAfterMerge = {};
  const sizeImpactMap = {};

  sizeNames.forEach((sizeName) => {
    if (beforeMerge === null) {
      sizeMapBeforeMerge[sizeName] = undefined;
      sizeMapAfterMerge[sizeName] = afterMerge.sizeMap[sizeName];
      sizeImpactMap[sizeName] = afterMerge.sizeMap[sizeName];
    } else if (afterMerge === null) {
      sizeMapBeforeMerge[sizeName] = beforeMerge.sizeMap[sizeName];
      sizeMapAfterMerge[sizeName] = undefined;
      sizeImpactMap[sizeName] = -beforeMerge.sizeMap[sizeName];
    } else {
      sizeMapBeforeMerge[sizeName] = beforeMerge.sizeMap[sizeName];
      sizeMapAfterMerge[sizeName] = afterMerge.sizeMap[sizeName];
      sizeImpactMap[sizeName] =
        afterMerge.sizeMap[sizeName] - beforeMerge.sizeMap[sizeName];
    }
  });

  return {
    sizeMapBeforeMerge,
    sizeMapAfterMerge,
    sizeImpactMap,
  };
};

export const getSizeMapsForManyFiles = ({
  sizeNames,
  fileByFileImpact,
  files,
}) => {
  const sizeMapBeforeMerge = {};
  const sizeMapAfterMerge = {};

  sizeNames.forEach((sizeName) => {
    let sizeBeforeMerge = 0;
    let sizeAfterMerge = 0;
    files.forEach((fileRelativeUrl) => {
      const { sizeMapBeforeMerge, sizeMapAfterMerge } =
        fileByFileImpact[fileRelativeUrl];
      sizeBeforeMerge += sizeMapBeforeMerge[sizeName] || 0;
      sizeAfterMerge += sizeMapAfterMerge[sizeName] || 0;
    });
    sizeMapBeforeMerge[sizeName] = sizeBeforeMerge;
    sizeMapAfterMerge[sizeName] = sizeAfterMerge;
  });

  return {
    sizeMapBeforeMerge,
    sizeMapAfterMerge,
  };
};
