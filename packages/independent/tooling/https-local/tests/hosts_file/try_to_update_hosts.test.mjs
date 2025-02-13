import { assert } from "@jsenv/assert";
import { readFile, removeEntry, writeFile } from "@jsenv/filesystem";
import { verifyHostsFile } from "@jsenv/https-local";
import { createLoggerForTest } from "@jsenv/https-local/tests/test_helpers.mjs";
import { UNICODE } from "@jsenv/humanize";
import { fileURLToPath } from "node:url";

const hostFileUrl = new URL("./hosts", import.meta.url);
const hostsFilePath = fileURLToPath(hostFileUrl);

// 1 ip mapping missing
{
  await writeFile(hostFileUrl, `127.0.0.1 localhost`);
  const loggerForTest = createLoggerForTest({
    // forwardToConsole: true,
  });
  await verifyHostsFile({
    logger: loggerForTest,
    ipMappings: {
      "127.0.0.1": ["localhost", "jsenv"],
    },
    tryToUpdateHostsFile: true,
    hostsFilePath,
  });

  const { infos, warns, errors } = loggerForTest.getLogs({
    info: true,
    warn: true,
    error: true,
  });
  const hostsFileContent = await readFile(hostsFilePath, { as: "string" });
  const actual = {
    hostsFileContent,
    infos,
    warns,
    errors,
  };
  const expect = {
    hostsFileContent:
      process.platform === "win32"
        ? `127.0.0.1 localhost\r\n127.0.0.1 jsenv\r\n`
        : `127.0.0.1 localhost\n127.0.0.1 jsenv\n`,
    infos: [
      `Check hosts file content...`,
      `${UNICODE.INFO} 1 mapping is missing in hosts file`,
      `Append "127.0.0.1 jsenv" in host file...`,
      process.platform === "win32"
        ? `${UNICODE.COMMAND} (echo.& echo 127.0.0.1 jsenv) >> ${hostsFilePath}`
        : `${UNICODE.COMMAND} echo "\n127.0.0.1 jsenv" | tee -a ${hostsFilePath}`,
      `${UNICODE.OK} mapping added`,
    ],
    warns: [],
    errors: [],
  };
  assert({ actual, expect });
}

// 2 ip mapping missing
{
  await writeFile(hostFileUrl, ``);
  await verifyHostsFile({
    logLevel: "warn",
    ipMappings: {
      "127.0.0.1": ["localhost", "jsenv"],
      "192.168.1.1": ["toto"],
    },
    tryToUpdateHostsFile: true,
    hostsFilePath,
  });
  const hostsFileContent = await readFile(hostsFilePath, { as: "string" });
  const actual = hostsFileContent;
  const expect =
    process.platform === "win32"
      ? `127.0.0.1 localhost jsenv\r\n192.168.1.1 toto\r\n`
      : `127.0.0.1 localhost jsenv\n192.168.1.1 toto\n`;
  assert({ actual, expect });
}

// all hostname there
{
  const loggerForTest = createLoggerForTest({
    // forwardToConsole: true,
  });
  await writeFile(hostFileUrl, `127.0.0.1 jsenv`);
  await verifyHostsFile({
    logger: loggerForTest,
    ipMappings: {
      "127.0.0.1": ["jsenv"],
    },
    tryToUpdateHostsFile: true,
    hostsFilePath,
  });

  const { infos, warns, errors } = loggerForTest.getLogs({
    info: true,
    warn: true,
    error: true,
  });
  const actual = {
    infos,
    warns,
    errors,
  };
  const expect = {
    infos: [
      `Check hosts file content...`,
      `${UNICODE.OK} all ip mappings found in hosts file`,
    ],
    warns: [],
    errors: [],
  };
  assert({ actual, expect });
}

await removeEntry(hostFileUrl);
