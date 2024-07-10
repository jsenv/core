import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { recordCommandToSvg } from "@jsenv/terminal-recorder";

const generateTerminalOutputSvg = async (scriptFilename) => {
  const pathToReplace = fileURLToPath(new URL("../", import.meta.url)).slice(
    0,
    -1,
  );
  let svg = await recordCommandToSvg(`node ./${scriptFilename}.mjs`, {
    cwd: new URL("./", import.meta.url).href,
    env: {
      ...process.env,
      FORCE_COLOR: "1",
    },
  });
  svg = svg.replaceAll(pathToReplace, "/mock/");
  writeFileSync(new URL(`./${scriptFilename}.svg`, import.meta.url), svg);
};

await generateTerminalOutputSvg("test");
await generateTerminalOutputSvg("test_more");
