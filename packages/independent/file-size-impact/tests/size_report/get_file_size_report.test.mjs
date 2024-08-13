import { assert } from "@jsenv/assert";
import { generateFileSizeReport, raw } from "@jsenv/file-size-impact";
import {
  ensureEmptyDirectory,
  writeDirectory,
  writeFile,
} from "@jsenv/filesystem";

const transformations = { raw };
const tempDirectoryUrl = new URL("./temp/", import.meta.url);
const test = (params) => {
  return generateFileSizeReport({
    ...params,
  });
};

// .js + .js.map without manifest
{
  await ensureEmptyDirectory(tempDirectoryUrl);
  const fileUrl = new URL("dist/file.js", tempDirectoryUrl);
  const fileMapUrl = new URL("dist/file.js.map", tempDirectoryUrl);
  await writeFile(fileUrl, `console.log("hello")`);
  await writeFile(fileMapUrl, `{ "file": "foo" }`);

  const actual = await test({
    logLevel: "warn",
    rootDirectoryUrl: tempDirectoryUrl,
    trackingConfig: {
      dist: {
        "./dist/**/*.js": true,
      },
    },
    transformations,
  });
  const expect = {
    transformationKeys: ["raw"],
    groups: {
      dist: {
        tracking: {
          "./dist/**/*.js": true,
        },
        manifestMap: {},
        fileMap: {
          "dist/file.js": {
            sizeMap: { raw: 20 },
            hash: '"14-qK8urhYN/nZoik6niqmvkolkCK0"',
            meta: true,
          },
        },
      },
    },
  };
  assert({ actual, expect });
}

// file hashed + manifest
{
  await ensureEmptyDirectory(tempDirectoryUrl);
  const fileUrl = new URL("dist/file.hash.js", tempDirectoryUrl);
  const manifestUrl = new URL("dist/manifest.json", tempDirectoryUrl);
  await writeFile(fileUrl, `console.log("hello")`);
  await writeFile(manifestUrl, `{ "file.js": "file.hash.js" }`);

  const meta = {
    showSizeImpact: () => true,
  };
  const actual = await test({
    logLevel: "warn",
    rootDirectoryUrl: tempDirectoryUrl,
    trackingConfig: {
      dist: {
        "./dist/**/*": meta,
      },
    },
    transformations,
    manifestConfig: {
      "./**/manifest.json": true,
    },
  });
  const expect = {
    transformationKeys: ["raw"],
    groups: {
      dist: {
        tracking: {
          "./dist/**/*": meta,
        },
        manifestMap: {
          "dist/manifest.json": {
            "file.js": "file.hash.js",
          },
        },
        fileMap: {
          "dist/file.hash.js": {
            sizeMap: { raw: 20 },
            hash: '"14-qK8urhYN/nZoik6niqmvkolkCK0"',
            meta,
          },
        },
      },
    },
  };
  assert({ actual, expect });
}

// an empty directory
{
  await ensureEmptyDirectory(tempDirectoryUrl);
  const directoryUrl = new URL("dist", tempDirectoryUrl);
  await writeDirectory(directoryUrl);

  const actual = await test({
    logLevel: "warn",
    rootDirectoryUrl: tempDirectoryUrl,
    trackingConfig: {
      dist: {
        "./dist/**/*.js": true,
      },
    },
    transformations,
  });
  const expect = {
    transformationKeys: ["raw"],
    groups: {
      dist: {
        tracking: {
          "./dist/**/*.js": true,
        },
        manifestMap: {},
        fileMap: {},
      },
    },
  };
  assert({ actual, expect });
}
