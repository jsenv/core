import stripAnsi from "strip-ansi";
import { takeFileSnapshot } from "@jsenv/snapshot";
import { startTerminalRecording } from "@jsenv/terminal-recorder";

import { writeFileSync } from "@jsenv/filesystem";

export const startSnapshotTesting = async (name, scenarios) => {
  let fileContent = "";
  let markdown = "";
  const snapshotFileUrl = new URL(
    `../snapshots/${name}/${name}.txt`,
    import.meta.url,
  );
  const markdownFileUrl = new URL(`../snapshots/${name}.md`, import.meta.url);
  const fileSnapshot = takeFileSnapshot(snapshotFileUrl);
  for (const key of Object.keys(scenarios)) {
    const scenarioCallback = scenarios[key];
    try {
      await scenarioCallback();
    } catch (e) {
      fileContent += `# ${key}\n`;
      fileContent += `${e.name}: ${stripAnsi(e.message)}\n\n`;

      markdown += `# ${key}\n`;
      markdown += "\n";
      markdown += "```js\n";
      markdown += getFunctionBody(scenarioCallback);
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
        `../snapshots/${name}/${key}.svg`,
        import.meta.url,
      );
      writeFileSync(svgFileUrl, svg);

      markdown += `\n\n`;
      markdown += `![img](./${name}/${key}.svg)`;
      markdown += `\n\n`;
    }
  }
  writeFileSync(snapshotFileUrl, fileContent);
  writeFileSync(markdownFileUrl, markdown);
  fileSnapshot.compare();
};

const getFunctionBody = (fn) => {
  const string = fn.toString();
  const bodyRaw = string.replace(
    /^\W*(function[^{]+\{([\s\S]*)\}|[^=]+=>[^{]*\{([\s\S]*)\}|[^=]+=>(.+))/i,
    "$2$3$4",
  );
  const bodyWithoutIndent = removeRootIndentation(bodyRaw);
  return bodyWithoutIndent;
};

const removeRootIndentation = (text) => {
  const lines = text.split(/\r?\n/);
  let result = ``;
  let i = 0;

  let charsToRemove = 0;
  while (i < lines.length) {
    const line = lines[i];
    const isFirstLine = i === 0;
    const isLastLine = i === lines.length - 1;
    const isRootLine = (isFirstLine && line.length) || i === 1;
    i++;
    if (isFirstLine && line === "") {
      // remove first line when empty
      continue;
    }
    let lineShortened = "";
    let j = 0;
    let searchIndentChar = true;
    while (j < line.length) {
      const char = line[j];
      j++;
      if (searchIndentChar && (char === " " || char === "\t")) {
        if (isRootLine) {
          charsToRemove++;
          continue;
        }
        if (j <= charsToRemove) {
          continue;
        }
      }
      searchIndentChar = false;
      lineShortened += char;
    }
    if (isLastLine && lineShortened === "") {
      // remove last line when empty
      continue;
    }
    result += isRootLine ? `${lineShortened}` : `\n${lineShortened}`;
  }
  return result;
};
