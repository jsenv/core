#!/usr/bin/env node

// see https://docs.npmjs.com/cli/v8/commands/npm-init#description

import {
  existsSync,
  readdirSync,
  mkdirSync,
  statSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { relative } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL, fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import prompts from "prompts";
import { createTaskLog } from "@jsenv/humanize";
import { urlToRelativeUrl } from "@jsenv/urls";

// not using readdir to control order
const availableTemplateNameArray = [
  "web",
  "web-components",
  "web-react",
  "web-preact",
  "node-package",
];
const options = {
  help: {
    type: "boolean",
  },
  web: {
    type: "boolean",
  },
  ["web-components"]: {
    type: "boolean",
  },
  ["web-react"]: {
    type: "boolean",
  },
  ["web-preact"]: {
    type: "boolean",
  },
  ["node-package"]: {
    type: "boolean",
  },
};
const { values, positionals } = parseArgs({
  options,
  allowPositionals: true,
});
if (values.help) {
  console.log(`@jsenv/cli: Init jsenv in a directory.

Usage: npx @jsenv/cli <dir> [options]

https://github.com/jsenv/core/tree/main/packages/related/cli

<dir> Where to install jsenv files; Otherwise you'll be prompted to select.

Options:
  --help             Display this message.
  --web              Consider directory as "web" project; Otherwise you'll be prompted to select.
  --web-components   Consider directory as "web-components" project; Otherwise you'll be prompted to select.
  --web-react        Consider directory as "web-react" project; Otherwise you'll be prompted to select.
  --web-preact       Consider directory as "web-preact" project; Otherwise you'll be prompted to select.
  --node-package     Consider directory as "node-package" project; Otherwise you'll be prompted to select.
`);
  process.exit(0);
}

console.log("Welcome in jsenv CLI");
const commands = [];
const cwdUrl = `${pathToFileURL(process.cwd())}/`;
let directoryUrl;
dir: {
  const directoryPathFromArg = positionals[0];
  if (directoryPathFromArg) {
    directoryUrl = new URL(directoryPathFromArg, cwdUrl);
    break dir;
  }
  const result = await prompts(
    {
      type: "text",
      name: "directory",
      message: "Enter a directory:",
    },
    {
      onCancel: () => {
        console.log("Aborted, can be resumed any time");
        process.exit(0);
      },
    },
  );
  directoryUrl = new URL(result.directory, cwdUrl);
}
if (directoryUrl.href !== cwdUrl.href) {
  commands.push(
    `cd ${relative(fileURLToPath(cwdUrl), fileURLToPath(directoryUrl))}`,
  );
}
let templateName;
template: {
  const templateNameFromArg = availableTemplateNameArray.find(
    (availableTemplateName) => values[availableTemplateName],
  );
  if (templateNameFromArg) {
    templateName = templateNameFromArg;
    break template;
  }
  const result = await prompts(
    [
      {
        type: "select",
        name: "templateName",
        message: "Select a template:",
        initial: 0,
        choices: availableTemplateNameArray.map((availableTemplateName) => {
          return {
            title: availableTemplateName,
            value: availableTemplateName,
          };
        }),
      },
    ],
    {
      onCancel: () => {
        console.log("Aborted, can be resumed any time");
        process.exit(0);
      },
    },
  );
  templateName = result.templateName;
}

write_files: {
  const writeFilesTask = createTaskLog(
    `init files into "${directoryUrl.href}"`,
  );
  // when there is no handler the file is kept as is
  const overrideHandlers = {
    "package.json": (existingContent, templateContent) => {
      const existingPackage = JSON.parse(existingContent);
      const templatePackage = JSON.parse(templateContent);
      const override = (left, right) => {
        if (right === null) {
          return left === undefined ? null : left;
        }
        if (Array.isArray(right)) {
          if (Array.isArray(left)) {
            for (const valueFromRight of right) {
              if (!left.includes(valueFromRight)) {
                left.push(valueFromRight);
              }
            }
            return left;
          }
          return left === undefined ? right : left;
        }
        if (typeof right === "object") {
          if (left && typeof left === "object") {
            for (const keyInRight of Object.keys(right)) {
              const leftValue = left[keyInRight];
              const rightValue = right[keyInRight];
              left[keyInRight] = override(leftValue, rightValue);
            }
            return left;
          }
          return left === undefined ? right : left;
        }
        return left === undefined ? right : left;
      };
      override(existingPackage, templatePackage);
      if (existingContent.startsWith("{\n")) {
        return JSON.stringify(existingPackage, null, "  ");
      }
      return JSON.stringify(existingPackage);
    },
    ".gitignore": (existingContent, templateContent) => {
      const existingLines = existingContent.split("\n").map((l) => l.trim());
      const newLines = templateContent.split("\n").map((l) => l.trim());
      let finalContent = existingContent;
      for (const newLine of newLines) {
        if (!existingLines.includes(newLine)) {
          finalContent += "\n";
          finalContent += newLine;
        }
      }
      return finalContent;
    },
    ".eslintignore": (existingContent, templateContent) => {
      const existingLines = existingContent.split("\n").map((l) => l.trim());
      const newLines = templateContent.split("\n").map((l) => l.trim());
      let finalContent = existingContent;
      for (const newLine of newLines) {
        if (!existingLines.includes(newLine)) {
          finalContent += "\n";
          finalContent += newLine;
        }
      }
      return finalContent;
    },
  };
  const templateSourceDirectoryUrl = new URL(
    `./template-${templateName}/`,
    import.meta.url,
  );
  const copyDirectoryContent = (fromDirectoryUrl, toDirectoryUrl) => {
    if (!existsSync(toDirectoryUrl)) {
      mkdirSync(toDirectoryUrl, { recursive: true });
    }
    const files = readdirSync(fromDirectoryUrl);
    for (const file of files) {
      const fromUrl = new URL(file, fromDirectoryUrl);
      const toUrl = new URL(
        file === "_gitignore" ? ".gitignore" : file,
        directoryUrl,
      );
      const fromStat = statSync(fromUrl);
      if (fromStat.isDirectory()) {
        copyDirectoryContent(fromUrl, toUrl);
        continue;
      }
      if (!existsSync(toUrl)) {
        writeFileSync(toUrl, readFileSync(fromUrl));
        continue;
      }
      const relativeUrl = urlToRelativeUrl(fromUrl, templateSourceDirectoryUrl);
      const overrideHandler = overrideHandlers[relativeUrl];
      if (!overrideHandler) {
        continue;
      }
      const existingContent = readFileSync(toUrl);
      const templateContent = readFileSync(fromUrl);
      const finalContent = overrideHandler(existingContent, templateContent);
      writeFileSync(toUrl, finalContent);
    }
  };
  copyDirectoryContent(templateSourceDirectoryUrl, directoryUrl);
  writeFilesTask.done();
}

commands.push("npm install");
run_commands: {
  if (commands.length === 0) {
    break run_commands;
  }
  console.log(`----- ${commands.length} commands to run -----
${commands.join("\n")}
---------------------------`);
  const { value } = await prompts({
    type: "confirm",
    name: "value",
    message: "Do you want to run them?",
    initial: true,
  });
  if (!value) {
    console.log("Ok, thank you");
    process.exit(0);
  }
  for (const command of commands) {
    execSync(command, {
      stdio: [0, 1, 2],
    });
  }
  console.log("Done, thank you");
}
