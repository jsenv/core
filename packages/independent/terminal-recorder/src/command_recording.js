import { spawn } from "node:child_process";

import { startTerminalRecording } from "./terminal_recording.js";

export const recordCommandToSvg = async (command, options) => {
  const terminalRecorder = await startTerminalRecording({
    svg: true,
  });
  await executeCommand(command, {
    ...options,
    onStdout: (data) => {
      terminalRecorder.write(data);
    },
  });
  const terminalRecords = await terminalRecorder.stop();
  const terminalSvg = await terminalRecords.svg();
  return terminalSvg;
};

const executeCommand = (
  command,
  {
    signal = new AbortController().signal,
    onStdout = () => {},
    onStderr = () => {},
    cwd,
    env,
    timeout,
  } = {},
) => {
  return new Promise((resolve, reject) => {
    let args = [];
    let commandWithoutArgs = "";
    const firstSpaceIndex = command.indexOf(" ");
    if (firstSpaceIndex === -1) {
      commandWithoutArgs = command;
    } else {
      commandWithoutArgs = command.slice(0, firstSpaceIndex);
      const argsRaw = command.slice(firstSpaceIndex + 1).trim();
      args = argsRaw.split(" ");
    }
    const commandProcess = spawn(commandWithoutArgs, args, {
      signal,
      cwd:
        cwd && typeof cwd === "string" && cwd.startsWith("file:")
          ? new URL(cwd)
          : cwd,
      env,
      timeout,
      // silent: true,
    });
    commandProcess.on("error", (error) => {
      if (error && error.code === "ETIMEDOUT") {
        console.error(`timeout after ${timeout} ms`);
        reject(error);
      } else {
        reject(error);
      }
    });
    const stdoutDatas = [];
    commandProcess.stdout.on("data", (data) => {
      stdoutDatas.push(data);
      onStdout(data);
    });
    let stderrDatas = [];
    commandProcess.stderr.on("data", (data) => {
      stderrDatas.push(data);
      onStderr(data);
    });
    if (commandProcess.stdin) {
      commandProcess.stdin.on("error", (error) => {
        reject(error);
      });
    }
    commandProcess.on("exit", (exitCode, signal) => {
      if (signal) {
        reject(new Error(`killed with ${signal}`));
      }
      if (exitCode) {
        reject(
          new Error(
            `failed with exit code ${exitCode}
            --- command stderr ---
            ${stderrDatas.join("")}`,
          ),
        );
        return;
      }
      resolve({ exitCode, signal });
    });
  });
};
