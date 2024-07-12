import { readFileSync } from "node:fs";
import { writeFileSync } from "@jsenv/filesystem";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

import {
  parseHtml,
  stringifyHtmlAst,
  injectHtmlNodeAsEarlyAsPossible,
  injectHtmlNode,
  createHtmlNode,
  findHtmlNode,
  insertHtmlNodeInside,
} from "@jsenv/ast";

const outputDirectoryUrl = new URL("./output/", import.meta.url);
const test = (fixtureFilename, mutation) => {
  const fileInputUrl = new URL(
    `./fixtures/${fixtureFilename}`,
    import.meta.url,
  );
  const fileOutputUrl = new URL(`./output/${fixtureFilename}`, import.meta.url);
  const originalContent = readFileSync(fileInputUrl, "utf8");
  const htmlAst = parseHtml({
    html: originalContent,
    url: String(fileInputUrl),
  });
  mutation(htmlAst);
  const content = stringifyHtmlAst(htmlAst, {
    cleanupPositionAttributes: true,
  });
  writeFileSync(fileOutputUrl, content);
};

const outputDirectorySnapshot = takeDirectorySnapshot(outputDirectoryUrl);
test("a.html", (htmlAst) => {
  injectHtmlNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      children: `console.log('Hello world');`,
    }),
    "jsenv:test",
  );
  injectHtmlNode(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      type: "module",
      children: `console.log('Hello again');`,
    }),
    "jsenv:test",
  );
});
test("b.html", (htmlAst) => {
  const div = findHtmlNode(htmlAst, (node) => node.tagName === "div");
  insertHtmlNodeInside(createHtmlNode({ tagName: "span" }), div);
});
outputDirectorySnapshot.compare();
