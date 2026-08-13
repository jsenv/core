/*
 * A directory in the source files must not shadow the SPA route having the
 * same name: "/join" is a route, "/join/" is the directory.
 */

import { startDevServer } from "@jsenv/core";
import { snapshotDevTests } from "@jsenv/core/tests/snapshot_dev_tests.js";

const describeResponse = async (response) => {
  const contentType = response.headers.get("content-type");
  const text = await response.text();
  const title = /<title>(.*?)<\/title>/s.exec(text);
  if (title) {
    return {
      status: response.status,
      contentType,
      body: `<title>${title[1]}</title>`,
    };
  }
  // the sourcemap comment holds an absolute file url, it would make the
  // snapshot depend on where the repository is cloned
  const body = text.replace(/^\/\/# sourceMappingURL=.*$/m, "").trim();
  return { status: response.status, contentType, body };
};

const run = async ({ directoryListing } = {}) => {
  const devServer = await startDevServer({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    keepProcessAlive: false,
    directoryListing,
    port: 0,
  });
  const results = {};
  for (const [label, resource, accept] of [
    ["directory as route", "/join", "text/html"],
    ["directory as directory", "/join/", "text/html"],
    ["file in directory", "/join/join_page.js", "*/*"],
    ["unknown route", "/whatever", "text/html"],
    ["unknown directory", "/whatever/", "text/html"],
    ["directory as route, json", "/join", "application/json"],
    ["directory as directory, json", "/join/", "application/json"],
  ]) {
    const response = await fetch(`${devServer.origin}${resource}`, {
      headers: { accept },
    });
    results[`${label} (${resource})`] = await describeResponse(response);
  }
  await devServer.stop();
  return results;
};

await snapshotDevTests(import.meta.url, ({ test }) => {
  test("default", () => run());
  test("directory_listing_disabled", () => run({ directoryListing: false }));
});
