import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { recordCommandToSvg } from "@jsenv/terminal-recorder";

const generateTerminalOutputSvg = async (scriptRelativeUrl, svgRelativeUrl) => {
  const command = `node ${scriptRelativeUrl}`;
  console.log(`executing ${command}`);
  const pathToReplace = fileURLToPath(new URL("../", import.meta.url)).slice(
    0,
    -1,
  );
  let svg = await recordCommandToSvg(command, {
    cwd: new URL("./", import.meta.url).href,
  });
  svg = svg.replaceAll(pathToReplace, "/mock/");
  writeFileSync(new URL(svgRelativeUrl, import.meta.url), svg);
  console.log(`-> ${svgRelativeUrl}`);
};

await generateTerminalOutputSvg(
  "./c_build/demo/build.mjs",
  "./c_build/build_terminal.svg",
);
await generateTerminalOutputSvg(
  "./d_test/demo/test.mjs",
  "./d_test/test_terminal.svg",
);
await generateTerminalOutputSvg(
  "./d_test/demo/test_many_browser.mjs",
  "./d_test/test_many_browser_terminal.svg",
);
