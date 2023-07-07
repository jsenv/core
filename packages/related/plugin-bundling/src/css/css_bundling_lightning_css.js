import { fileURLToPath, pathToFileURL } from "node:url";
import { fileUrlConverter } from "../file_url_converter.js";

// Do not use until https://github.com/parcel-bundler/parcel-css/issues/181
export const bundleCss = async (cssUrlInfos) => {
  const bundledCssUrlInfos = {};
  const { bundleAsync } = await import("lightningcss");
  const targets = runtimeCompatToTargets(cssUrlInfos[0].context.runtimeCompat);
  for (const cssUrlInfo of cssUrlInfos) {
    const filename = fileUrlConverter.asFilePath(cssUrlInfo.originalUrl);
    const { code, map } = await bundleAsync({
      filename,
      targets,
      minify: false,
      resolver: {
        read: (specifier) => {
          const fileUrlObject = fileUrlConverter.asFileUrl(specifier);
          const fileUrl = String(fileUrlObject);
          const urlInfo = cssUrlInfo.graph.getUrlInfo(fileUrl);
          return urlInfo.content;
        },
        resolve(specifier, from) {
          const fileUrlObject = new URL(specifier, pathToFileURL(from));
          const filePath = fileURLToPath(fileUrlObject);
          return filePath;
        },
      },
    });
    bundledCssUrlInfos[cssUrlInfo.url] = {
      data: {
        bundlerName: "lightningcss",
      },
      contentType: "text/css",
      content: String(code),
      sourcemap: map,
    };
  }
  return bundledCssUrlInfos;
};

const runtimeCompatToTargets = (runtimeCompat) => {
  const targets = {};
  ["chrome", "firefox", "ie", "opera", "safari"].forEach((runtimeName) => {
    const version = runtimeCompat[runtimeName];
    if (version) {
      targets[runtimeName] = versionToBits(version);
    }
  });
  return targets;
};

const versionToBits = (version) => {
  const [major, minor = 0, patch = 0] = version
    .split("-")[0]
    .split(".")
    .map((v) => parseInt(v, 10));
  return (major << 16) | (minor << 8) | patch;
};
