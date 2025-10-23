import { compareTwoFileSizeReports } from "./compare_two_file_size_reports.js";
import { isAdded, isDeleted, isModified } from "./helper.js";
import { orderBySizeImpact } from "./order_by_size_impact.js";
import { renderImpactTable } from "./render_impact_table.js";
import { getSizeMapsForManyFiles, getSizeMapsOneFile } from "./size_map.js";

export const formatComment = ({
  pullRequestBase,
  pullRequestHead,
  beforeMergeFileSizeReport,
  afterMergeFileSizeReport,

  filesOrdering,
  maxFilesPerGroup,
  fileRelativeUrlMaxLength,
  formatGroupSummary,
  formatFileRelativeUrl,
  formatFileCell,
  formatFileSizeImpactCell,
  formatEmojiCell,
  shouldOpenGroupByDefault,
}) => {
  const warnings = [];
  const reportComparison = compareTwoFileSizeReports({
    afterMergeFileSizeReport,
    beforeMergeFileSizeReport,
  });
  const groupCount = Object.keys(reportComparison.groups).length;

  if (groupCount === 0) {
    warnings.push(
      `**Warning:** Nothing is tracked. It happens when tracking config is an empty object.`,
    );
  }

  let body = renderCommentBody({
    pullRequestBase,
    pullRequestHead,
    reportComparison,

    filesOrdering,
    maxFilesPerGroup,
    fileRelativeUrlMaxLength,
    formatGroupSummary,
    formatFileRelativeUrl,
    formatFileCell,
    formatFileSizeImpactCell,
    formatEmojiCell,
    shouldOpenGroupByDefault,
  });

  body = `<h4 id="file-size-impact">File size impact</h4>

${body}`;

  return { warnings, body };
};

const renderCommentBody = ({
  pullRequestBase,
  pullRequestHead,
  reportComparison,

  filesOrdering,
  maxFilesPerGroup,
  fileRelativeUrlMaxLength,
  formatGroupSummary,
  formatFileRelativeUrl,
  formatFileCell,
  formatFileSizeImpactCell,
  formatEmojiCell,
  shouldOpenGroupByDefault,
}) => {
  const { groups, transformationKeys } = reportComparison;

  const groupMessages = Object.keys(groups).map((groupName) => {
    const groupComparison = groups[groupName];
    const groupFileImpactMap = groupComparison.fileImpactMap;
    let fileByFileImpact = {};
    const files = Object.keys(groupFileImpactMap);

    files.forEach((fileRelativeUrl) => {
      const { beforeMerge, afterMerge } = groupFileImpactMap[fileRelativeUrl];
      const event = isAdded({ beforeMerge })
        ? "added"
        : isDeleted({ beforeMerge, afterMerge })
          ? "deleted"
          : isModified({ beforeMerge, afterMerge })
            ? "modified"
            : "none";
      const meta = event === "deleted" ? beforeMerge.meta : afterMerge.meta;

      const { sizeMapBeforeMerge, sizeMapAfterMerge, sizeImpactMap } =
        getSizeMapsOneFile({
          sizeNames: transformationKeys,
          beforeMerge,
          afterMerge,
        });
      const { showSizeImpact, formatFileRelativeUrl } = metaToData(meta, {
        fileRelativeUrl,
        sizeBeforeMerge: sizeMapBeforeMerge[0],
        sizeAfterMerge: sizeMapAfterMerge[0],
        sizeImpactMap,
      });
      fileByFileImpact[fileRelativeUrl] = {
        event,
        manifestKeyBeforeMerge: beforeMerge
          ? beforeMerge.manifestKey
          : undefined,
        manifestKeyAfterMerge: afterMerge ? afterMerge.manifestKey : undefined,
        relativeUrlBeforeMerge: beforeMerge
          ? beforeMerge.relativeUrl
          : undefined,
        relativeUrlAfterMerge: afterMerge ? afterMerge.relativeUrl : undefined,
        sizeMapBeforeMerge,
        sizeMapAfterMerge,
        sizeImpactMap,
        showSizeImpact,
        formatFileRelativeUrl,
      };
    });
    if (filesOrdering === "size_impact") {
      fileByFileImpact = orderBySizeImpact(
        fileByFileImpact,
        transformationKeys,
      );
    }

    const groupSizeMaps = getSizeMapsForManyFiles({
      sizeNames: transformationKeys,
      fileByFileImpact,
      files,
    });
    const groupSizeMapBeforeMerge = groupSizeMaps.sizeMapBeforeMerge;
    const groupSizeMapAfterMerge = groupSizeMaps.sizeMapAfterMerge;
    const groupIsEmpty = Object.keys(fileByFileImpact).length === 0;

    const groupSummary = formatGroupSummary({
      groupName,
      groupSizeMapBeforeMerge,
      groupSizeMapAfterMerge,
      sizeNames: transformationKeys,
      fileByFileImpact,
    });
    const groupShouldBeOpenByDefault = shouldOpenGroupByDefault({
      groupName,
      groupSizeMapBeforeMerge,
      groupSizeMapAfterMerge,
      sizeNames: transformationKeys,
      fileByFileImpact,
    });

    return renderDetails({
      open: groupShouldBeOpenByDefault,
      summary: groupSummary,
      content: groupIsEmpty
        ? renderEmptyGroupContent({
            groupName,
            groupConfig: groupComparison.tracking,
          })
        : renderImpactTable({
            fileByFileImpact,
            transformationKeys,
            fileRelativeUrlMaxLength,
            maxFilesPerGroup,
            formatFileRelativeUrl,
            formatFileCell,
            formatFileSizeImpactCell,
            formatEmojiCell,
            groupSizeMapBeforeMerge,
            groupSizeMapAfterMerge,
          }),
    });
  });

  const mergeImpact = formulateMergeImpact({
    pullRequestHead,
    pullRequestBase,
  });
  if (groupMessages.length === 0) {
    return mergeImpact;
  }

  return `${mergeImpact}
${groupMessages.join(`

`)}`;
};

const renderEmptyGroupContent = ({ groupName, groupConfig }) => {
  return `<p>No file in ${groupName} group (see config below).</p>

\`\`\`json
${JSON.stringify(groupConfig, null, "  ")}
\`\`\`
`;
};

const formulateMergeImpact = ({ pullRequestBase, pullRequestHead }) => {
  return `<p>Impact on file sizes when merging <em>${pullRequestHead}</em> into <em>${pullRequestBase}</em>.</p>`;
};

const metaToData = (
  meta,
  { fileRelativeUrl, sizeBeforeMerge, sizeAfterMerge, sizeImpactMap },
) => {
  if (typeof meta === "boolean") {
    return {
      showSizeImpact: true,
    };
  }

  if (typeof meta === "object") {
    const showSizeImpact = showSizeImpactGetter(meta, {
      fileRelativeUrl,
      sizeBeforeMerge,
      sizeAfterMerge,
      sizeImpactMap,
    });
    const { formatFileRelativeUrl } = meta;
    return {
      showSizeImpact,
      formatFileRelativeUrl,
    };
  }

  console.warn(
    `meta must be a boolean or an object, received ${meta} for ${fileRelativeUrl}`,
  );
  return {
    showSizeImpact: Boolean(meta),
  };
};

const showSizeImpactGetter = (
  meta,
  { fileRelativeUrl, sizeBeforeMerge, sizeAfterMerge, sizeImpactMap },
) => {
  const { showSizeImpact } = meta;

  if (typeof showSizeImpact === "undefined") {
    return true;
  }

  if (typeof showSizeImpact === "boolean") {
    return showSizeImpact;
  }

  if (typeof showSizeImpact === "function") {
    return showSizeImpact({
      fileRelativeUrl,
      sizeBeforeMerge,
      sizeAfterMerge,
      sizeImpactMap,
    });
  }

  console.warn(
    `showSizeImpact must be a boolean or a function, received ${showSizeImpact} for ${fileRelativeUrl}`,
  );
  return true;
};

const renderDetails = ({ summary, content, open = false, indent = 0 }) => {
  return `${" ".repeat(indent)}<details${open ? " open" : ""}>
${" ".repeat(indent + 2)}<summary>${summary}</summary>
${" ".repeat(indent + 2)}${content}
${" ".repeat(indent)}</details>`;
};
