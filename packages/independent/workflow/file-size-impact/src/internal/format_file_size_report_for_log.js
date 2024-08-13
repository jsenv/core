import { formatSize } from "./format_size.js";
import { manifestKeyFromRelativeUrl, manifestToMappings } from "./manifest.js";

export const formatFileSizeReportForLog = (fileSizeReport) => {
  const { groups } = fileSizeReport;

  const groupMessages = Object.keys(groups).map((groupName) => {
    const { fileMap, manifestMap } = groups[groupName];

    const mappings = manifestToMappings(manifestMap);
    const fileMessages = Object.keys(fileMap).map((fileRelativeUrl) => {
      const fileDisplayed =
        manifestKeyFromRelativeUrl(fileRelativeUrl, mappings) ||
        fileRelativeUrl;
      const file = fileMap[fileRelativeUrl];
      const { sizeMap } = file;
      const sizeNames = Object.keys(sizeMap);
      if (sizeNames.length === 1) {
        return `${fileDisplayed}: ${formatSize(sizeMap[sizeNames[0]])}`;
      }

      const sizesFormatted = sizeNames.map((sizeName) => {
        return `${sizeName}: ${formatSize(sizeMap[sizeName])}`;
      });
      return `${fileDisplayed}: { ${sizesFormatted.join(`, `)} }`;
    });

    return `${groupName}
---------------------
${fileMessages.join(`
`)}`;
  });

  const message = `
${groupMessages.join(`

`)}
`;

  return message;
};
