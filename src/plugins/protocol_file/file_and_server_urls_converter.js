import { urlIsInsideOf, urlToRelativeUrl } from "@jsenv/urls";

export const FILE_AND_SERVER_URLS_CONVERTER = {
  asServerUrl: (fileUrl, serverRootDirectoryUrl) => {
    if (urlIsInsideOf(fileUrl, serverRootDirectoryUrl)) {
      const urlRelativeToServer = urlToRelativeUrl(
        fileUrl,
        serverRootDirectoryUrl,
      );
      return `/${urlRelativeToServer}`;
    }
    const urlRelativeToFilesystemRoot = fileUrl.slice("file:///".length);
    return `/@fs/${urlRelativeToFilesystemRoot}`;
  },
  asFileUrl: (urlRelativeToServer, serverRootDirectoryUrl) => {
    if (urlRelativeToServer.startsWith("/@fs/")) {
      const urlRelativeToFilesystemRoot = urlRelativeToServer.slice(
        "/@fs/".length,
      );
      return `file:///${urlRelativeToFilesystemRoot}`;
    }
    return new URL(urlRelativeToServer, serverRootDirectoryUrl).href;
  },
};
