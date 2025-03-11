import { listFilesMatching } from "@jsenv/filesystem";
import { urlToRelativeUrl } from "@jsenv/urls";
import { readFileSync, writeFileSync } from "node:fs";

export const collectWorkspacePackages = async ({ directoryUrl }) => {
  const workspacePackages = {};
  const rootPackageUrl = new URL("package.json", directoryUrl);
  const rootPackageFileInfo = readPackageFile(rootPackageUrl);
  const rootPackage = {
    isRoot: true,
    packageUrl: rootPackageUrl,
    packageObject: rootPackageFileInfo.object,
    updateFile: rootPackageFileInfo.updateFile,
  };
  workspacePackages[rootPackageFileInfo.object.name] = rootPackage;

  const patterns = {};
  const { workspaces = [] } = rootPackage.packageObject;
  workspaces.forEach((workspace) => {
    const workspaceUrl = new URL(workspace, rootPackageUrl).href;
    const workspaceRelativeUrl = urlToRelativeUrl(workspaceUrl, rootPackageUrl);
    const pattern = `${workspaceRelativeUrl}/package.json`;
    patterns[pattern] = true;
  });

  const packageDirectoryUrls = await listFilesMatching({
    directoryUrl,
    patterns,
  });
  packageDirectoryUrls.forEach((packageDirectoryUrl) => {
    const packageUrl = new URL("package.json", packageDirectoryUrl);
    const packageFileInfo = readPackageFile(packageUrl);
    workspacePackages[packageFileInfo.object.name] = {
      packageUrl,
      packageObject: packageFileInfo.object,
      updateFile: packageFileInfo.updateFile,
    };
  });
  return workspacePackages;
};

const readPackageFile = (url) => {
  const packageFileContent = String(readFileSync(new URL(url)));
  const hasFinalNewLine =
    packageFileContent[packageFileContent.length - 1] === "\n";
  return {
    object: JSON.parse(packageFileContent),
    updateFile: (data) => {
      let dataAsJson = JSON.stringify(data, null, "  ");
      if (hasFinalNewLine) {
        dataAsJson += "\n";
      }
      writeFileSync(new URL(url), dataAsJson);
    },
  };
};
