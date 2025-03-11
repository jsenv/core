import { comparePathnames } from "@jsenv/filesystem";
import { manifestKeyFromRelativeUrl, manifestToMappings } from "./manifest.js";

export const compareTwoFileSizeReports = ({
  afterMergeFileSizeReport,
  beforeMergeFileSizeReport,
}) => {
  const groupComparison = {};
  const afterMergeGroups = afterMergeFileSizeReport.groups;
  const beforeMergeGroups = beforeMergeFileSizeReport.groups;
  Object.keys(afterMergeGroups).forEach((group) => {
    // || {} exists in case group was not tracked in base branch
    // and is now tracked in head branch.
    // compareTwoGroups will handle the empty object and consider everything as added
    const beforeMergeGroup = beforeMergeGroups[group] || {};
    const afterMergeGroup = afterMergeGroups[group];
    groupComparison[group] = compareTwoGroups(
      beforeMergeGroup,
      afterMergeGroup,
    );
  });

  const comparison = {
    transformationKeys: afterMergeFileSizeReport.transformationKeys,
    groups: groupComparison,
  };

  return comparison;
};

const compareTwoGroups = (beforeMergeGroup, afterMergeGroup) => {
  const groupComparison = {};
  const beforeMergeManifestMap = beforeMergeGroup.manifestMap || {};
  const beforeMergeFileMap = beforeMergeGroup.fileMap || {};
  const beforeMergeMappings = manifestToMappings(beforeMergeManifestMap);
  const afterMergeManifestMap = afterMergeGroup.manifestMap || {};
  const afterMergeFileMap = afterMergeGroup.fileMap || {};
  const afterMergeMappings = manifestToMappings(afterMergeManifestMap);

  const getAddInfo = ({ afterMergeRelativeUrl }) => {
    return {
      beforeMerge: null,
      afterMerge: {
        relativeUrl: afterMergeRelativeUrl,
        manifestKey:
          manifestKeyFromRelativeUrl(
            afterMergeRelativeUrl,
            afterMergeMappings,
          ) || null,
        ...afterMergeFileMap[afterMergeRelativeUrl],
      },
    };
  };
  const getUpdateInfo = ({ beforeMergeRelativeUrl, afterMergeRelativeUrl }) => {
    return {
      beforeMerge: {
        relativeUrl: beforeMergeRelativeUrl,
        manifestKey:
          manifestKeyFromRelativeUrl(
            beforeMergeRelativeUrl,
            beforeMergeMappings,
          ) || null,
        ...beforeMergeFileMap[beforeMergeRelativeUrl],
      },
      afterMerge: {
        relativeUrl: afterMergeRelativeUrl,
        manifestKey:
          manifestKeyFromRelativeUrl(
            afterMergeRelativeUrl,
            afterMergeMappings,
          ) || null,
        ...afterMergeFileMap[afterMergeRelativeUrl],
      },
    };
  };
  const getRemoveInfo = ({ beforeMergeRelativeUrl }) => {
    return {
      beforeMerge: {
        relativeUrl: beforeMergeRelativeUrl,
        manifestKey: manifestKeyFromRelativeUrl(
          beforeMergeRelativeUrl,
          beforeMergeMappings,
        ),
        ...beforeMergeFileMap[beforeMergeRelativeUrl],
      },
      afterMerge: null,
    };
  };

  Object.keys(afterMergeFileMap).forEach((afterMergeRelativeUrl) => {
    const afterMergeManifestKey = manifestKeyFromRelativeUrl(
      afterMergeRelativeUrl,
      afterMergeMappings,
    );

    if (afterMergeManifestKey) {
      const existsInBeforeMergeManifest = Object.keys(
        beforeMergeMappings,
      ).includes(afterMergeManifestKey);
      if (existsInBeforeMergeManifest) {
        // the manifest key also appears in the manifest before merge.
        // It means that even if both file have different relative urls,
        // they are considered the same.
        // This is to support file generated with a dynamic name
        const beforeMergeRelativeUrl =
          beforeMergeMappings[afterMergeManifestKey];
        const beforeMerge = beforeMergeFileMap[beforeMergeRelativeUrl];
        if (beforeMerge) {
          groupComparison[afterMergeRelativeUrl] = getUpdateInfo({
            beforeMergeRelativeUrl,
            afterMergeRelativeUrl,
          });
          return;
        }
      }
    }

    const beforeMerge = beforeMergeFileMap[afterMergeRelativeUrl];
    groupComparison[afterMergeRelativeUrl] = beforeMerge
      ? getUpdateInfo({
          beforeMergeRelativeUrl: afterMergeRelativeUrl,
          afterMergeRelativeUrl,
        })
      : getAddInfo({ afterMergeRelativeUrl });
  });
  Object.keys(beforeMergeFileMap).forEach((beforeMergeRelativeUrl) => {
    // if the file is not in the after merge, it got deleted
    // except if it is remapped, in this case it can be ignored
    const beforeMergeManifestKey = manifestKeyFromRelativeUrl(
      beforeMergeRelativeUrl,
      beforeMergeMappings,
    );
    if (beforeMergeManifestKey) {
      const existsInAfterMergeManifest = Object.keys(
        afterMergeMappings,
      ).includes(beforeMergeManifestKey);
      if (existsInAfterMergeManifest) {
        // file also referenced in after merge manifest
        // let's first see if the file still exists
        const afterMergeRelativeUrl =
          afterMergeMappings[beforeMergeManifestKey];
        const afterMerge = afterMergeFileMap[afterMergeRelativeUrl];
        if (afterMerge) {
          // there is a file for this mapping, file was already
          // detected and considered as an update during afterMergeFileMap loop above
          return;
        }
      }
    }

    const afterMerge = afterMergeFileMap[beforeMergeRelativeUrl];
    if (afterMerge) {
      // there is a file
      return;
    }

    // at this point there is no file for an eventual file mapping from manifest
    // AND no file for the real relative url after merge
    // -> the file is gone
    groupComparison[beforeMergeRelativeUrl] = getRemoveInfo({
      beforeMergeRelativeUrl,
    });
  });

  const fileImpactMap = sortFileStructure(groupComparison);

  return {
    tracking: afterMergeGroup.tracking,
    fileImpactMap,
  };
};

const sortFileStructure = (fileStructure) => {
  const relativeUrlSortedArray =
    Object.keys(fileStructure).sort(comparePathnames);
  const fileStructureSorted = {};
  relativeUrlSortedArray.forEach((relativeUrl) => {
    fileStructureSorted[relativeUrl] = fileStructure[relativeUrl];
  });
  return fileStructureSorted;
};
