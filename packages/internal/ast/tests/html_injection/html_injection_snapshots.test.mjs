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
  const originalContent = readFileSync(fileInputUrl, "utf8");
  const htmlAst = parseHtml({
    html: originalContent,
    url: String(fileInputUrl),
  });
  const writeOutputFile = (scenario) => {
    const fileOutputUrl = new URL(`./output/${scenario}`, import.meta.url);
    const content = stringifyHtmlAst(htmlAst, {
      cleanupPositionAttributes: true,
    });
    writeFileSync(fileOutputUrl, content);
  };
  mutation(htmlAst, writeOutputFile);
};

const outputDirectorySnapshot = takeDirectorySnapshot(outputDirectoryUrl);
test("a.html", (htmlAst, writeOutputFile) => {
  injectHtmlNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      children: `console.log('Hello world');`,
    }),
    "jsenv:test",
  );
  writeOutputFile("a_0_first_script.html");
  injectHtmlNode(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      type: "module",
      children: `console.log('Hello again');`,
    }),
    "jsenv:test",
  );
  writeOutputFile("a_1_second_script.html");
});
test("b.html", (htmlAst, writeOutputFile) => {
  const div = findHtmlNode(htmlAst, (node) => node.tagName === "div");
  insertHtmlNodeInside(createHtmlNode({ tagName: "span" }), div);
  writeOutputFile("b_0_inject_first.html");
  insertHtmlNodeInside(createHtmlNode({ tagName: "span" }), div);
  writeOutputFile("b_1_inject_second.html");
});
outputDirectorySnapshot.compare();
