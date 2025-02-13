import { createDetailedMessage, createLogger, UNICODE } from "@jsenv/humanize";
import {
  HOSTS_FILE_PATH,
  parseHosts,
  readHostsFile,
  writeLineInHostsFile,
} from "./internal/hosts.js";

export const verifyHostsFile = async ({
  ipMappings,
  logLevel,
  logger = createLogger({ logLevel }),
  tryToUpdateHostsFile = false,
  // for unit test
  hostsFilePath = HOSTS_FILE_PATH,
}) => {
  logger.info(`Check hosts file content...`);
  const hostsFileContent = await readHostsFile(hostsFilePath);
  const hostnames = parseHosts(hostsFileContent);

  const missingMappings = [];
  Object.keys(ipMappings).forEach((ip) => {
    const ipHostnames = ipMappings[ip];
    if (!Array.isArray(ipHostnames)) {
      throw new TypeError(
        `ipMappings values must be an array, found ${ipHostnames} for ${ip}`,
      );
    }
    const existingMappings = hostnames.getIpHostnames(ip);
    const missingHostnames = normalizeHostnames(ipHostnames).filter(
      (hostname) => !existingMappings.includes(hostname),
    );
    if (missingHostnames.length) {
      missingMappings.push({ ip, missingHostnames });
    }
  });
  const missingMappingCount = missingMappings.length;
  if (missingMappingCount === 0) {
    logger.info(`${UNICODE.OK} all ip mappings found in hosts file`);
    return;
  }

  const EOL = process.platform === "win32" ? "\r\n" : "\n";

  if (!tryToUpdateHostsFile) {
    const linesToAdd = missingMappings
      .map(({ ip, missingHostnames }) => `${ip} ${missingHostnames.join(" ")}`)
      .join(EOL);
    logger.warn(
      createDetailedMessage(
        `${UNICODE.WARNING} ${formatXMappingMissingMessage(
          missingMappingCount,
        )}`,
        {
          "hosts file path": hostsFilePath,
          "line(s) to add": linesToAdd,
        },
      ),
    );
    return;
  }

  logger.info(
    `${UNICODE.INFO} ${formatXMappingMissingMessage(missingMappingCount)}`,
  );
  await missingMappings.reduce(async (previous, { ip, missingHostnames }) => {
    await previous;
    const mapping = `${ip} ${missingHostnames.join(" ")}`;
    logger.info(`Append "${mapping}" in host file...`);

    await writeLineInHostsFile(mapping, {
      hostsFilePath,
      onBeforeExecCommand: (command) => {
        logger.info(`${UNICODE.COMMAND} ${command}`);
      },
    });
    logger.info(`${UNICODE.OK} mapping added`);
  }, Promise.resolve());
};

const normalizeHostnames = (hostnames) => {
  return hostnames.map((hostname) => hostname.trim().replace(/[\s;]/g, ""));
};

const formatXMappingMissingMessage = (missingMappingCount) => {
  if (missingMappingCount) {
    return `1 mapping is missing in hosts file`;
  }

  return `${missingMappingCount} mappings are missing in hosts file`;
};
