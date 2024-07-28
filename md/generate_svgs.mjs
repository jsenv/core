import { replaceFluctuatingValues } from "@jsenv/snapshot";
import { recordCommandToSvg } from "@jsenv/terminal-recorder";
import { writeFileSync } from "node:fs";
import prettier from "prettier";

const generateTerminalOutputSvg = async (scriptRelativeUrl, svgRelativeUrl) => {
  const command = `node ${scriptRelativeUrl}`;
  console.log(`executing ${command}`);
  let svg = await recordCommandToSvg(command, {
    cwd: new URL("./", import.meta.url).href,
  });
  const svgFileUrl = new URL(svgRelativeUrl, import.meta.url);
  svg = replaceFluctuatingValues(svg, {
    fileUrl: svgFileUrl,
    rootDirectoryUrl: new URL("./", import.meta.url),
  });
  svg = await prettier.format(svg, {
    parser: "html",
  });
  writeFileSync(svgFileUrl, svg);
  console.log(`-> ${svgRelativeUrl}`);
};

await generateTerminalOutputSvg(
  "./users/c_build/demo/build.mjs",
  "./users/c_build/build_terminal.svg",
);
await generateTerminalOutputSvg(
  "./users/d_test/demo/test.mjs",
  "./users/d_test/test_terminal.svg",
);
await generateTerminalOutputSvg(
  "./users/d_test/demo/test_many_browser.mjs",
  "./users/d_test/test_many_browser_terminal.svg",
);
