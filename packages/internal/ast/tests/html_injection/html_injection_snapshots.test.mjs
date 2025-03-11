import { writeFileSync } from "@jsenv/filesystem";
import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { readFileSync } from "node:fs";

import {
  createHtmlNode,
  findHtmlNode,
  injectHtmlNode,
  injectHtmlNodeAsEarlyAsPossible,
  insertHtmlNodeInside,
  parseHtml,
  stringifyHtmlAst,
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
test("c.html", (htmlAst, writeOutputFile) => {
  const body = findHtmlNode(htmlAst, (node) => node.tagName === "body");
  const div = createHtmlNode({ tagName: "div" });
  insertHtmlNodeInside(div, body);
  writeOutputFile("c_0_inject_div_in_body.html");
  insertHtmlNodeInside(createHtmlNode({ tagName: "span" }), div);
  writeOutputFile("c_1_inject_span_in_div.html");
  insertHtmlNodeInside(createHtmlNode({ tagName: "span" }), div);
  writeOutputFile("c_2_inject_second_span_in_div.html");
});
test("d.html", (htmlAst, writeOutputFile) => {
  injectHtmlNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      tagName: "script",
    }),
  );
  writeOutputFile("d_0_inject_importmap.html");
});
outputDirectorySnapshot.compare();
