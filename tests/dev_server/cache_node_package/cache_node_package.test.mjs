/*
 * - Ensure cache for node modules do not hit the server
 * - Ensure cache is invalidated when package version changes
 */

import { assert } from "@jsenv/assert";
import {
  readFileStructureSync,
  writeFileStructureSync,
} from "@jsenv/filesystem";
import { replaceFluctuatingValues } from "@jsenv/snapshot";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";

const debug = false; // true to have browser UI + keep it open after test
const fooPackageFileUrl = new URL(
  import.meta.resolve("./client/node_modules/foo/package.json"),
);
const fooPackageFileContent = {
  beforeTest: readFileSync(fooPackageFileUrl),
  update: (content) => writeFileSync(fooPackageFileUrl, content),
  restore: () =>
    writeFileSync(fooPackageFileUrl, fooPackageFileContent.beforeTest),
};
const answerFileUrl = new URL(
  import.meta.resolve("./client/node_modules/foo/answer.js"),
);
const answerFileContent = {
  beforeTest: readFileSync(answerFileUrl),
  update: (content) => writeFileSync(answerFileUrl, content),
  restore: () => writeFileSync(answerFileUrl, answerFileContent.beforeTest),
};
const serverRequests = [];
const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  keepProcessAlive: false,
  services: [
    {
      name: "spy_request",
      routes: [
        {
          endpoint: "GET *",
          fetch: (request) => {
            serverRequests.push(request);
          },
        },
      ],
    },
  ],
  ribbon: false,
  clientAutoreload: false,
  supervisor: false,
  outDirectoryUrl: import.meta.resolve("./.jsenv/"),
  port: 0,
});
const browser = await chromium.launch({ headless: !debug });
try {
  const page = await launchBrowserPage(browser);
  await page.goto(`${devServer.origin}/main.html`);
  const getResult = async () => {
    const result = await page.evaluate(
      /* eslint-disable no-undef */
      () => window.resultPromise,
      /* eslint-enable no-undef */
    );
    return result;
  };
  const getServerRequestedForFoo = () => {
    return serverRequests.some((request) => {
      return request.pathname.startsWith("/node_modules/foo/");
    });
  };
  const takeDevFilesSnapshot = (name) => {
    const runtimeId = Array.from(devServer.kitchenCache.keys())[0];
    const jsenvDirectoryUrl = new URL(
      `./.jsenv/${runtimeId}/`,
      import.meta.url,
    );
    const snapshotDirectoryUrl = new URL(
      `./snapshots/${name}/`,
      import.meta.url,
    );
    const fileStructure = readFileStructureSync(jsenvDirectoryUrl);
    for (const key of Object.keys(fileStructure)) {
      fileStructure[key] = replaceFluctuatingValues(fileStructure[key], {
        fileUrl: new URL(key, jsenvDirectoryUrl),
      });
    }
    writeFileStructureSync(snapshotDirectoryUrl, fileStructure);
  };

  {
    const actual = {
      result: await getResult(),
      serverRequestedForFoo: getServerRequestedForFoo(),
    };
    takeDevFilesSnapshot("1_first_run");
    const expect = {
      result: 42,
      serverRequestedForFoo: true,
    };
    assert({ actual, expect });
  }

  // reload page and expect node_modules/foo/index.js to be cached
  // without server request
  {
    serverRequests.length = 0;
    await page.reload();
    const actual = {
      result: await getResult(),
      serverRequestedForFoo: getServerRequestedForFoo(),
    };
    const expect = {
      result: 42,
      serverRequestedForFoo: false,
    };
    assert({ actual, expect });
  }

  // now update the package content + version and see if reloading the page updates the result
  {
    serverRequests.length = 0;
    answerFileContent.update(`export const answer = 43`);
    fooPackageFileContent.update(
      JSON.stringify(
        {
          name: "foo",
          private: true,
          version: "1.0.1",
        },
        null,
        "  ",
      ),
    );
    // await new Promise((resolve) => setTimeout(resolve, 500))
    await page.reload();

    const actual = {
      result: await getResult(),
      serverRequestedForFoo: getServerRequestedForFoo(),
    };
    takeDevFilesSnapshot("2_after_package_update");
    const expect = {
      result: 43,
      serverRequestedForFoo: true,
    };
    assert({ actual, expect });
  }
} finally {
  fooPackageFileContent.restore();
  answerFileContent.restore();
  if (!debug) {
    browser.close();
  }
}
