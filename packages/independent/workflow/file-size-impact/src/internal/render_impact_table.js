import { getSizeMapsForManyFiles } from "./size_map.js";

export const renderImpactTable = ({
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
}) => {
  const table = `<table>
    <thead>
      ${renderSizeImpactTableHeader(transformationKeys)}
    </thead>
    <tbody>
      ${renderSizeImpactTableBody({
        fileByFileImpact,
        transformationKeys,
        maxFilesPerGroup,
        fileRelativeUrlMaxLength,
        formatFileRelativeUrl,
        formatFileCell,
        formatFileSizeImpactCell,
        formatEmojiCell,
      })}
    </tbody>
    <tfoot>
      ${renderSizeImpactTableFooter({
        fileByFileImpact,
        transformationKeys,
        formatFileSizeImpactCell,
        formatEmojiCell,
        groupSizeMapBeforeMerge,
        groupSizeMapAfterMerge,
      })}
    </tfoot>
  </table>`;

  return table;
};

const renderSizeImpactTableHeader = (transformationKeys) => {
  const lines = [];
  const headerLine = [
    `<th nowrap>Files</th>`,
    ...transformationKeys.map(
      (sizeName) =>
        `<th nowrap>${
          sizeName === "raw" ? `new size` : `new ${sizeName} size`
        }</th>`,
    ),
    `<th></th>`,
  ];
  lines.push(headerLine);

  return renderTableLines(lines);
};

const renderSizeImpactTableBody = ({
  fileByFileImpact,
  transformationKeys,
  maxFilesPerGroup,
  fileRelativeUrlMaxLength,
  formatFileRelativeUrl,
  formatFileCell,
  formatFileSizeImpactCell,
  formatEmojiCell,
}) => {
  const lines = [];
  const sizeNames = transformationKeys;
  const firstSizeName = sizeNames[0];

  let remainingFilesToDisplay = maxFilesPerGroup;
  const truncateds = [];
  const unmodifieds = [];
  Object.keys(fileByFileImpact).forEach((fileRelativeUrl) => {
    const fileImpact = fileByFileImpact[fileRelativeUrl];

    if (fileImpact.event === "none") {
      unmodifieds.push(fileRelativeUrl);
      return;
    }

    if (remainingFilesToDisplay === 0) {
      truncateds.push(fileRelativeUrl);
      return;
    }

    remainingFilesToDisplay--;
    const fileAbstractRelativeUrl =
      fileAbstractRelativeUrlFromFileImpact(fileImpact);
    const fileRelativeUrlFormatted = (
      fileImpact.formatFileRelativeUrl || formatFileRelativeUrl
    )(fileAbstractRelativeUrl);
    const fileRelativeUrlDisplayed = truncateFileRelativeUrl(
      fileRelativeUrlFormatted,
      fileRelativeUrlMaxLength,
    );
    const { sizeMapBeforeMerge, sizeMapAfterMerge } =
      fileByFileImpact[fileRelativeUrl];
    const fileCellFormatted = formatFileCell({
      fileRelativeUrl,
      fileRelativeUrlDisplayed,
      sizeBeforeMerge: sizeMapBeforeMerge[firstSizeName],
      sizeAfterMerge: sizeMapAfterMerge[firstSizeName],
    });

    const line = [
      `<td nowrap>${fileCellFormatted}</td>`,
      ...sizeNames.map((sizeName) => {
        return `<td nowrap>${formatFileSizeImpactCell({
          sizeBeforeMerge: sizeMapBeforeMerge[sizeName],
          sizeAfterMerge: sizeMapAfterMerge[sizeName],
          sizeName,
        })}</td>`;
      }),
      ...(formatEmojiCell
        ? [
            `<td>${formatEmojiCell({
              sizeBeforeMerge: sizeMapBeforeMerge[firstSizeName],
              sizeAfterMerge: sizeMapAfterMerge[firstSizeName],
            })}</td>`,
          ]
        : []),
    ];
    lines.push(line);
  });

  const truncatedCount = truncateds.length;
  if (truncatedCount > 0) {
    const { sizeMapBeforeMerge, sizeMapAfterMerge } = getSizeMapsForManyFiles({
      sizeNames,
      fileByFileImpact,
      files: truncateds,
    });
    const lineForTruncatedFiles = [
      `<td nowrap><i>Truncated (${truncatedCount})</i></td>`,
      ...sizeNames.map((sizeName) => {
        return `<td nowrap>${formatFileSizeImpactCell({
          sizeBeforeMerge: sizeMapBeforeMerge[sizeName],
          sizeAfterMerge: sizeMapAfterMerge[sizeName],
          sizeName,
        })}</td>`;
      }),
      ...(formatEmojiCell
        ? [
            `<td>${formatEmojiCell({
              sizeBeforeMerge: sizeMapBeforeMerge[firstSizeName],
              sizeAfterMerge: sizeMapAfterMerge[firstSizeName],
            })}</td>`,
          ]
        : []),
    ];
    lines.push(lineForTruncatedFiles);
  }

  const unmodifiedCount = unmodifieds.length;
  if (unmodifiedCount > 0) {
    const { sizeMapBeforeMerge, sizeMapAfterMerge } = getSizeMapsForManyFiles({
      sizeNames,
      fileByFileImpact,
      files: unmodifieds,
    });
    const lineForUnmodifiedFiles = [
      `<td nowrap><i>Unmodified (${unmodifiedCount})</i></td>`,
      ...sizeNames.map((sizeName) => {
        return `<td nowrap>${formatFileSizeImpactCell({
          sizeBeforeMerge: sizeMapBeforeMerge[sizeName],
          sizeAfterMerge: sizeMapAfterMerge[sizeName],
          sizeName,
        })}</td>`;
      }),
      ...(formatEmojiCell
        ? [
            `<td>${formatEmojiCell({
              sizeBeforeMerge: sizeMapBeforeMerge[firstSizeName],
              sizeAfterMerge: sizeMapAfterMerge[firstSizeName],
            })}</td>`,
          ]
        : []),
    ];
    lines.push(lineForUnmodifiedFiles);
  }

  return renderTableLines(lines);
};

const fileAbstractRelativeUrlFromFileImpact = ({
  manifestKeyBeforeMerge,
  relativeUrlBeforeMerge,
  manifestKeyAfterMerge,
  relativeUrlAfterMerge,
}) => {
  return (
    manifestKeyAfterMerge ||
    relativeUrlAfterMerge ||
    manifestKeyBeforeMerge ||
    relativeUrlBeforeMerge
  );
};

const renderSizeImpactTableFooter = ({
  fileByFileImpact,
  transformationKeys,
  formatFileSizeImpactCell,
  formatEmojiCell,
  groupSizeMapBeforeMerge,
  groupSizeMapAfterMerge,
}) => {
  const footerLines = [];

  const fileCount = Object.keys(fileByFileImpact).length;
  const sizeNames = transformationKeys;
  const firstSizeName = sizeNames[0];

  const groupSizeImpactLine = [
    `<td nowrap><strong>Total (${fileCount})</strong></td>`,
    ...sizeNames.map(
      (sizeName) =>
        `<td nowrap>${formatFileSizeImpactCell({
          sizeBeforeMerge: groupSizeMapBeforeMerge[sizeName],
          sizeAfterMerge: groupSizeMapAfterMerge[sizeName],
          sizeName,
        })}</td>`,
    ),
    ...(formatEmojiCell
      ? [
          `<td>${formatEmojiCell({
            sizeBeforeMerge: groupSizeMapBeforeMerge[firstSizeName],
            sizeAfterMerge: groupSizeMapAfterMerge[firstSizeName],
          })}</td>`,
        ]
      : []),
  ];
  footerLines.push(groupSizeImpactLine);

  return renderTableLines(footerLines);
};

const truncateFileRelativeUrl = (fileRelativeUrl, fileRelativeUrlMaxLength) => {
  const length = fileRelativeUrl.length;
  const extraLength = length - fileRelativeUrlMaxLength;
  if (extraLength > 0) {
    return `…${fileRelativeUrl.slice(extraLength)}`;
  }
  return fileRelativeUrl;
};

const renderTableLines = (lines, { indentCount = 3, indentSize = 2 } = {}) => {
  if (lines.length === 0) {
    return "";
  }

  const cellLeftSpacing = indent(indentCount + 1, indentSize);
  const lineLeftSpacing = indent(indentCount, indentSize);

  return `<tr>${lines.map(
    (cells) => `
${cellLeftSpacing}${cells.join(`
${cellLeftSpacing}`)}`,
  ).join(`
${lineLeftSpacing}</tr>
${lineLeftSpacing}<tr>`)}
${lineLeftSpacing}</tr>`;
};

const indent = (count, size) => ` `.repeat(size * count);
