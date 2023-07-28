import { fileSystemPathToUrl, urlToFileSystemPath } from "@jsenv/urls";

export const fileUrlConverter = {
  asFilePath: (fileUrl) => {
    const filePath = urlToFileSystemPath(fileUrl);
    const urlObject = new URL(fileUrl);
    const { searchParams } = urlObject;
    return `${filePath}${stringifyQuery(searchParams)}`;
  },
  asFileUrl: (filePath) => {
    return decodeURIComponent(fileSystemPathToUrl(filePath)).replace(
      /[=](?=&|$)/g,
      "",
    );
  },
};

const stringifyQuery = (searchParams) => {
  const search = searchParams.toString();
  return search ? `?${search}` : "";
};
