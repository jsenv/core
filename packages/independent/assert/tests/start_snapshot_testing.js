import stripAnsi from "strip-ansi";
import { takeFileSnapshot } from "@jsenv/snapshot";
import { startTerminalRecording } from "@jsenv/terminal-recorder";
import { clearDirectorySync, writeFileSync } from "@jsenv/filesystem";

import { parseFunction } from "@jsenv/assert/src/function_parser.js";

const generateMarkdown =
  process.execArgv.includes("--conditions=development") && !process.env.CI;

export const startSnapshotTesting = async (name, scenarios) => {
  let fileContent = "";
  let markdown = "";
  const snapshotFileUrl = new URL(
    `./snapshots/${name}/${name}.txt`,
    import.meta.url,
  );
  const markdownFileUrl = new URL(`./snapshots/${name}.md`, import.meta.url);
  const fileSnapshot = takeFileSnapshot(snapshotFileUrl);
  if (generateMarkdown) {
    clearDirectorySync(new URL(`./snapshots/${name}/`, import.meta.url));
  }
  for (const key of Object.keys(scenarios)) {
    const scenarioCallback = scenarios[key];
    try {
      await scenarioCallback();
    } catch (e) {
      fileContent += `# ${key}\n`;
      if (e.name === "AssertionError") {
        fileContent += `${e.name}: ${stripAnsi(e.message)}\n\n`;
      } else {
        fileContent += `${e.stack}\n\n`;
      }

      if (generateMarkdown) {
        markdown += `# ${key}\n`;
        markdown += "\n";
        markdown += "```js\n";
        markdown += parseFunction(scenarioCallback).body;
        markdown += "\n```";
        const terminalRecorder = await startTerminalRecording({
          svg: {
            title: "Terminal",
          },
        });
        await terminalRecorder.write(`${e.name}: ${e.message}\n\n`);
        const result = await terminalRecorder.stop();
        const svg = await result.svg();
        const svgFileUrl = new URL(
          `./snapshots/${name}/${key}.svg`,
          import.meta.url,
        );
        writeFileSync(svgFileUrl, svg);

        markdown += `\n\n`;
        markdown += `![img](<./${name}/${key}.svg>)`;
        markdown += `\n\n`;
      }
    }
  }
  writeFileSync(snapshotFileUrl, fileContent);
  if (generateMarkdown) {
    writeFileSync(markdownFileUrl, markdown);
  }
  if (!generateMarkdown) {
    fileSnapshot.compare();
  }
};
