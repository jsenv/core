import { createRequire } from "node:module";
import { exec } from "../exec.js";
import { HOSTS_FILE_PATH } from "./hosts_utils.js";

export const writeHostsFile = async (
  hostsFileContent,
  { hostsFilePath = HOSTS_FILE_PATH, onBeforeExecCommand = () => {} } = {},
) => {
  if (process.platform === "win32") {
    return writeHostsFileOnWindows({
      hostsFileContent,
      hostsFilePath,
      onBeforeExecCommand,
    });
  }
  return writeHostsFileOnLinuxOrMac({
    hostsFileContent,
    hostsFilePath,
    onBeforeExecCommand,
  });
};

const writeHostsFileOnLinuxOrMac = async ({
  hostsFilePath,
  hostsFileContent,
  onBeforeExecCommand,
}) => {
  const needsSudo = hostsFilePath === HOSTS_FILE_PATH;
  // https://en.wikipedia.org/wiki/Tee_(command)
  const updateHostsFileCommand = needsSudo
    ? `echo "${hostsFileContent}" | sudo tee ${hostsFilePath}`
    : `echo "${hostsFileContent}" | tee ${hostsFilePath}`;
  onBeforeExecCommand(updateHostsFileCommand);
  await exec(updateHostsFileCommand);
};

const writeHostsFileOnWindows = async ({
  hostsFilePath,
  hostsFileContent,
  onBeforeExecCommand,
}) => {
  const needsSudo = hostsFilePath === HOSTS_FILE_PATH;
  const echoCommand = echoWithLinesToSingleCommand(hostsFileContent);
  const updateHostsFileCommand = `${echoCommand} > ${hostsFilePath}`;

  if (needsSudo) {
    const require = createRequire(import.meta.url);
    const sudoPrompt = require("sudo-prompt");
    onBeforeExecCommand(updateHostsFileCommand);
    await new Promise((resolve, reject) => {
      sudoPrompt.exec(
        updateHostsFileCommand,
        { name: "write hosts" },
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

const echoWithLinesToSingleCommand = (value) => {
  const command = value
    .split(/\r\n/g)
    .map((value) => `echo ${value}`)
    .join(`& `);
  return `(${command})`;
};

// https://github.com/xxorax/node-shell-escape
// https://github.com/nodejs/node/issues/34840#issuecomment-677402567
// const escapeCommandArgument = (value) => {
//   return `'${value.replace(/'/g, `'"'`)}'`
//   // return String(value).replace(/([A-z]:)?([#!"$&'()*,:;<=>?@\[\\\]^`{|}])/g, "$1\\$2")
// }
