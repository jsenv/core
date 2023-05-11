import { readFileSync } from "node:fs";

import { urlToRelativeUrl } from "@jsenv/urls";
import { comparePathnames } from "@jsenv/filesystem";

import {
  parseHtmlString,
  stringifyHtmlAst,
  injectHtmlNodeAsEarlyAsPossible,
  injectHtmlNode,
  createHtmlNode,
} from "@jsenv/ast";
import { writeSnapshotsIntoDirectory } from "@jsenv/core/tests/snapshots_directory.js";

let files = {};
const transformFixtureFile = async (fixtureFilename) => {
  const url = new URL(`./fixtures/${fixtureFilename}`, import.meta.url);
  const originalContent = readFileSync(url, "utf8");
  const htmlAst = parseHtmlString(originalContent);

  injectHtmlNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      textContent: `console.log('Hello world');`,
    }),
    "jsenv:test",
  );
  injectHtmlNode(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      type: "module",
      textContent: `console.log('Hello again');`,
    }),
    "jsenv:test",
  );
  const content = stringifyHtmlAst(htmlAst, {
    cleanupPositionAttributes: true,
  });
  const relativeUrl = urlToRelativeUrl(
    url,
    new URL("./fixtures/", import.meta.url),
  );

  files[relativeUrl] = content;
  const filesSorted = {};
  Object.keys(files)
    .sort(comparePathnames)
    .forEach((relativeUrl) => {
      filesSorted[relativeUrl] = files[relativeUrl];
    });
  files = filesSorted;
};

await transformFixtureFile("a.html");

writeSnapshotsIntoDirectory(new URL("./snapshots/", import.meta.url), files);
