import { readFile } from "@jsenv/filesystem";
import { createRequire } from "node:module";
import { exec } from "../exec.js";
import { HOSTS_FILE_PATH } from "./hosts_utils.js";

export const writeLineInHostsFile = async (
  lineToAppend,
  { hostsFilePath = HOSTS_FILE_PATH, onBeforeExecCommand = () => {} } = {},
) => {
  if (process.platform === "win32") {
    return appendToHostsFileOnWindows({
      lineToAppend,
      hostsFilePath,
      onBeforeExecCommand,
    });
  }
  return appendToHostsFileOnLinuxOrMac({
    lineToAppend,
    hostsFilePath,
    onBeforeExecCommand,
  });
};

// https://renenyffenegger.ch/notes/Windows/dirs/Windows/System32/cmd_exe/commands/echo/index
const appendToHostsFileOnWindows = async ({
  lineToAppend,
  hostsFilePath,
  onBeforeExecCommand,
}) => {
  const hostsFileContent = await readFile(hostsFilePath, { as: "string" });
  const echoCommand =
    hostsFileContent.length > 0 && !hostsFileContent.endsWith("\r\n")
      ? `(echo.& echo ${lineToAppend})`
      : `(echo ${lineToAppend})`;
  const needsSudo = hostsFilePath === HOSTS_FILE_PATH;
  const updateHostsFileCommand = `${echoCommand} >> ${hostsFilePath}`;

  if (needsSudo) {
    const require = createRequire(import.meta.url);
    const sudoPrompt = require("sudo-prompt");
    onBeforeExecCommand(updateHostsFileCommand);
    await new Promise((resolve, reject) => {
      sudoPrompt.exec(
        updateHostsFileCommand,
        { name: "append hosts" },
        (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else if (typeof stderr === "string" && stderr.trim().length > 0) {
            reject(stderr);
          } else {
            resolve(stdout);
          }
        },
      );
    });
    return;
  }

  onBeforeExecCommand(updateHostsFileCommand);
  await exec(updateHostsFileCommand);
};

const appendToHostsFileOnLinuxOrMac = async ({
  lineToAppend,
  hostsFilePath,
  onBeforeExecCommand,
}) => {
  const hostsFileContent = await readFile(hostsFilePath, { as: "string" });
  const echoCommand =
    hostsFileContent.length > 0 && !hostsFileContent.endsWith("\n")
      ? `echo "\n${lineToAppend}"`
      : `echo "${lineToAppend}"`;
  const needsSudo = hostsFilePath === HOSTS_FILE_PATH;
  // https://en.wikipedia.org/wiki/Tee_(command)
  const updateHostsFileCommand = needsSudo
    ? `${echoCommand} | sudo tee -a ${hostsFilePath}`
    : `${echoCommand} | tee -a ${hostsFilePath}`;
  onBeforeExecCommand(updateHostsFileCommand);
  await exec(updateHostsFileCommand);
};
