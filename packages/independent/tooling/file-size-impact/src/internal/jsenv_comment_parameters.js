import { formatPercentage } from "./format_percentage.js";
import { formatSize } from "./format_size.js";

const jsenvFormatGroupSummary = ({
  groupName,
  groupSizeMapBeforeMerge,
  groupSizeMapAfterMerge,
  sizeNames,
}) => {
  const firstSizeName = sizeNames[0];
  const groupSizeBeforeMerge = groupSizeMapBeforeMerge[firstSizeName];
  const groupSizeAfterMerge = groupSizeMapAfterMerge[firstSizeName];

  if (groupSizeBeforeMerge === groupSizeAfterMerge) {
    return `${groupName} (no impact)`;
  }

  return `${groupName} (${formatSizeImpactAsPercentage({
    sizeBeforeMerge: groupSizeBeforeMerge,
    sizeAfterMerge: groupSizeAfterMerge,
  })})`;
};

const jsenvFormatFileRelativeUrl = (fileRelativeUrl) => {
  return fileRelativeUrl;
};

const jsenvFormatFileCell = ({ fileRelativeUrlDisplayed, sizeAfterMerge }) => {
  if (sizeAfterMerge === undefined) {
    return `<del>${fileRelativeUrlDisplayed}</del>`;
  }
  return fileRelativeUrlDisplayed;
};

/**
 * - added
 *   100b
 * - modified
 *   623.43KB (+370B / +0.06%)
 * - deleted
 *   0 (-100b)
 */
const jsenvFormatFileSizeImpactCell = ({ sizeBeforeMerge, sizeAfterMerge }) => {
  // The file is new
  // it makes sense to display
  // "100B"
  // but it would make no sense to compare with something that does not exists like
  // "100 B (+100B / +100%)
  if (sizeBeforeMerge === undefined) {
    const sizeAfterMergeFormatted = formatSize(sizeAfterMerge);
    return sizeAfterMergeFormatted;
  }

  // The file is deleted, it makes sense to display
  // "deleted (-100 B)"
  // to indicate the new file size is 0 and was 100 bytes
  // but it would be redundant to add the percentage
  // "deleted (-100 B / -100%)"
  if (sizeAfterMerge === undefined) {
    const sizeDiff = -sizeBeforeMerge;
    const sizeDiffFormatted = formatSize(sizeDiff, { diff: true });
    return `deleted (${sizeDiffFormatted})`;
  }

  const sizeAfterMergeFormatted = formatSize(sizeAfterMerge);
  const sizeDiff = sizeAfterMerge - sizeBeforeMerge;
  const sizeDiffFormatted = formatSize(sizeDiff, { diff: true });
  const sizeDiffAsPercentageFormatted = formatSizeImpactAsPercentage({
    sizeBeforeMerge,
    sizeAfterMerge,
  });
  return `${sizeAfterMergeFormatted} (${sizeDiffFormatted} / ${sizeDiffAsPercentageFormatted})`;
};

export const jsenvFormatEmojiCell = ({ sizeBeforeMerge, sizeAfterMerge }) => {
  if (sizeBeforeMerge === undefined) {
    return ":baby:";
  }

  if (sizeAfterMerge === undefined) {
    return "";
  }

  const delta = sizeAfterMerge - sizeBeforeMerge;
  if (delta === 0) {
    return ":ghost:";
  }

  if (delta > 0) {
    return ":arrow_upper_right:";
  }

  return ":arrow_lower_right:";
};

export const jsenvCommentParameters = {
  filesOrdering: "size_impact",
  maxFilesPerGroup: 600,
  fileRelativeUrlMaxLength: 50,
  formatGroupSummary: jsenvFormatGroupSummary,
  formatFileRelativeUrl: jsenvFormatFileRelativeUrl,

  formatFileCell: jsenvFormatFileCell,
  formatFileSizeImpactCell: jsenvFormatFileSizeImpactCell,
  formatEmojiCell: jsenvFormatEmojiCell,
  shouldOpenGroupByDefault: () => false,
};

const formatSizeImpactAsPercentage = ({ sizeBeforeMerge, sizeAfterMerge }) => {
  const sizeDiff = sizeAfterMerge - sizeBeforeMerge;
  const sizeDiffRatio =
    sizeDiff === 0
      ? 0
      : sizeBeforeMerge === 0
        ? 1
        : sizeAfterMerge === 0
          ? -1
          : sizeDiff / sizeBeforeMerge;
  const sizeDiffAsPercentage = sizeDiffRatio * 100;
  const sizeDiffAsPercentageFormatted = formatPercentage(sizeDiffAsPercentage);
  return sizeDiffAsPercentageFormatted;
};
