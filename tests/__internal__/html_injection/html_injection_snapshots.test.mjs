import { readFileSync } from "node:fs";
import { writeFileSync } from "@jsenv/filesystem";
import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";

import {
  parseHtml,
  stringifyHtmlAst,
  injectHtmlNodeAsEarlyAsPossible,
  injectHtmlNode,
  createHtmlNode,
} from "@jsenv/ast";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);
const test = (fixtureFilename) => {
  const fileUrl = new URL(`./fixtures/${fixtureFilename}`, import.meta.url);
  const fileSnapshotUrl = new URL(
    `./snapshots/${fixtureFilename}`,
    import.meta.url,
  );
  const originalContent = readFileSync(fileUrl, "utf8");
  const htmlAst = parseHtml({
    html: originalContent,
    url: String(fileUrl),
  });

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
  writeFileSync(fileSnapshotUrl, content);
};

const actualDirectorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
test("a.html");
const expectedDirectorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
compareSnapshots(actualDirectorySnapshot, expectedDirectorySnapshot);
