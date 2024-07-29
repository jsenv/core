#!/usr/bin/env node

// see https://docs.npmjs.com/cli/v8/commands/npm-init#description

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { ANSI, createTaskLog, UNICODE } from "@jsenv/humanize";
import { ensurePathnameTrailingSlash, urlToRelativeUrl } from "@jsenv/urls";
import prompts from "prompts";

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

console.log("Welcome in jsenv CLI; this will install jsenv in a directory.");
const commands = [];
const cwdUrl = ensurePathnameTrailingSlash(pathToFileURL(process.cwd()));
let directoryUrl;
dir: {
  const directoryPathFromArg = positionals[0];
  if (directoryPathFromArg) {
    directoryUrl = ensurePathnameTrailingSlash(
      new URL(directoryPathFromArg, cwdUrl),
    );
    console.log(`${UNICODE.OK} Enter a directory: ${directoryPathFromArg}`);
    break dir;
  }
  const result = await prompts(
    {
      type: "text",
      name: "directory",
      message: `Directory: ${ANSI.color(`(Return to use current directory)`, ANSI.GREY)}`,
      initial: ".",
    },
    {
      onCancel: () => {
        console.log("Aborted, can be resumed any time");
        process.exit(0);
      },
    },
  );
  let { directory } = result;
  directoryUrl = ensurePathnameTrailingSlash(new URL(directory, cwdUrl));
}
const runWithChildProcess = (command) => {
  console.log(command);
  execSync(command, {
    cwd: directoryUrl,
    stdio: [0, 1, 2],
  });
};
if (directoryUrl.href !== cwdUrl.href) {
  const dir = relative(fileURLToPath(cwdUrl), fileURLToPath(directoryUrl));
  commands.push({
    label: `cd ${dir}`,
    run: () => {},
  });
}
let templateName;
template: {
  const templateNameFromArg = availableTemplateNameArray.find(
    (availableTemplateName) => values[availableTemplateName],
  );
  if (templateNameFromArg) {
    templateName = templateNameFromArg;
    console.log(`${UNICODE.OK} Select a template: ${templateNameFromArg}`);
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
  const writeFilesTask = createTaskLog(`init jsenv in "${directoryUrl}"`);
  const mergeTwoIgnoreFileContents = (left, right) => {
    const leftLines = String(left)
      .split("\n")
      .map((l) => l.trim());
    const rightLines = String(right)
      .split("\n")
      .map((l) => l.trim());
    let finalContent = left;
    for (const rightLine of rightLines) {
      if (!leftLines.includes(rightLine)) {
        finalContent += "\n";
        finalContent += rightLine;
      }
    }
    return finalContent;
  };
  const overrideHandlers = {
    "package.json": (existingContent, templateContent) => {
      const existingPackage = JSON.parse(existingContent);
      const templatePackage = JSON.parse(templateContent);
      const override = (left, right, { parentKey, allowedKeys }) => {
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
            const keysToVisit = allowedKeys || Object.keys(right);
            for (const keyToVisit of keysToVisit) {
              const rightValue = right[keyToVisit];
              if (rightValue === undefined) {
                continue;
              }
              const leftValue = left[keyToVisit];
              const finalValue = override(leftValue, rightValue, {
                parentKey: keyToVisit,
              });
              left[keyToVisit] = finalValue;
              if (parentKey === "scripts" && keyToVisit === "start") {
                commands.push({
                  label: "npm start",
                  run: () => runWithChildProcess("npm start"),
                });
              }
            }
            return left;
          }
          return left === undefined ? right : left;
        }
        return left === undefined ? right : left;
      };
      const existingDependencies = existingPackage.dependencies
        ? { ...existingPackage.dependencies }
        : {};
      const existingDevDependencies = existingPackage.devDependencies
        ? { ...existingPackage.devDependencies }
        : {};
      override(existingPackage, templatePackage, {
        allowedKeys: ["scripts", "dependencies", "devDependencies"],
      });
      const finalDependencies = existingPackage.dependencies || {};
      const finalDevDependencies = existingPackage.devDependencies || {};
      if (
        JSON.stringify(existingDependencies) !==
          JSON.stringify(finalDependencies) ||
        JSON.stringify(existingDevDependencies) !==
          JSON.stringify(finalDevDependencies)
      ) {
        commands.push({
          label: "npm install",
          run: () => runWithChildProcess("npm install"),
        });
      }
      if (existingContent.startsWith("{\n")) {
        return JSON.stringify(existingPackage, null, "  ");
      }
      return JSON.stringify(existingPackage);
    },
    ".gitignore": mergeTwoIgnoreFileContents,
    ".eslintignore": mergeTwoIgnoreFileContents,
  };
  const templateSourceDirectoryUrl = new URL(
    `./template-${templateName}/`,
    import.meta.url,
  );
  const copyDirectoryContent = (fromDirectoryUrl, toDirectoryUrl) => {
    if (!existsSync(toDirectoryUrl)) {
      mkdirSync(toDirectoryUrl, { recursive: true });
    }
    const directoryEntryNameArray = readdirSync(fromDirectoryUrl);
    for (const directoryEntryName of directoryEntryNameArray) {
      if (
        directoryEntryName === ".jsenv" ||
        directoryEntryName === "dist" ||
        directoryEntryName === "node_modules" ||
        directoryEntryName === "readme.md"
      ) {
        continue;
      }
      const fromUrl = new URL(directoryEntryName, fromDirectoryUrl);
      const toUrl = new URL(
        directoryEntryName === "_gitignore" ? ".gitignore" : directoryEntryName,
        toDirectoryUrl,
      );
      const fromStat = statSync(fromUrl);
      if (fromStat.isDirectory()) {
        if (directoryEntryName === "src" || directoryEntryName === "tests") {
          // copy src and tests if they don't exists
          if (existsSync(toUrl)) {
            continue;
          }
          // for web the presence of index.html or main.html at the root
          // prevent src/ content from being copied
          if (templateName.startsWith("web")) {
            if (existsSync(new URL("./index.html", directoryUrl))) {
              continue;
            }
            if (existsSync(new URL("./main.html", directoryUrl))) {
              continue;
            }
          }
        }
        copyDirectoryContent(
          ensurePathnameTrailingSlash(fromUrl),
          ensurePathnameTrailingSlash(toUrl),
        );
        continue;
      }
      if (!existsSync(toUrl)) {
        if (directoryEntryName === "package.json") {
          commands.push({
            label: "npm install",
            run: () => runWithChildProcess("npm install"),
          });
          commands.push({
            label: "npm start",
            run: () => runWithChildProcess("npm start"),
          });
        }
        writeFileSync(toUrl, readFileSync(fromUrl));
        continue;
      }
      const relativeUrl = urlToRelativeUrl(fromUrl, templateSourceDirectoryUrl);
      const overrideHandler = overrideHandlers[relativeUrl];
      if (!overrideHandler) {
        // when there is no handler the file is kept as is
        continue;
      }
      const existingContent = readFileSync(toUrl);
      const templateContent = readFileSync(fromUrl);
      const finalContent = overrideHandler(
        String(existingContent),
        String(templateContent),
      );
      writeFileSync(toUrl, finalContent);
    }
  };
  copyDirectoryContent(
    new URL(templateSourceDirectoryUrl),
    new URL(directoryUrl),
  );
  writeFilesTask.done();
}

run_commands: {
  if (commands.length === 0) {
    break run_commands;
  }
  let message;
  if (commands.length === 1) {
    console.log(`----- 1 command to run -----
${commands[0].label}
---------------------------`);
    // we can't run cd for the parent terminal
    // so we'll just print the command in that case
    // and user will have to run it if he want to go into the
    // directory
    if (commands[0].label.startsWith("cd")) {
      console.log("Done, thank you");
      process.exit(0);
    }
    message = "Can we run the command";
  } else {
    console.log(`----- ${commands.length} commands to run -----
${commands.map((c) => c.label).join("\n")}
-----------------------------`);
    message = "Can we run the commands";
  }
  const { value } = await prompts({
    type: "confirm",
    name: "value",
    message,
    initial: true,
  });
  if (!value) {
    console.log("Done, thank you");
    process.exit(0);
  }
  for (const command of commands) {
    await command.run();
  }
  console.log("Done, thank you");
}
