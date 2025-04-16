import { UNICODE } from "@jsenv/humanize";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { memoize } from "../memoize.js";

const require = createRequire(import.meta.url);

const which = require("which");

const REASON_CHROME_NOT_DETECTED = `Chrome not detected`;

export const executeTrustQueryOnChrome = ({ logger, windowsTrustInfo }) => {
  const chromeDetected = detectChrome({ logger });
  if (!chromeDetected) {
    return {
      status: "other",
      reason: REASON_CHROME_NOT_DETECTED,
    };
  }

  return {
    status: windowsTrustInfo.status,
    reason: windowsTrustInfo.reason,
  };
};

// https://github.com/litixsoft/karma-detect-browsers/blob/332b4bdb2ab3db7c6a1a6d3ec5a1c6ccf2332c4d/browsers/Chrome.js#L1
const detectChrome = memoize(({ logger }) => {
  logger.debug(`Detecting Chrome...`);

  if (process.env.CHROME_BIN && which.sync(process.env.CHROME_BIN)) {
    logger.debug(`${UNICODE.OK} Chrome detected`);
    return true;
  }

  const executableCandidates = [
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.ProgramW6432}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  const someExecutableFound = executableCandidates.some(
    (chromeExecutablePathCandidate) => {
      if (existsSync(chromeExecutablePathCandidate)) {
        return true;
      }
      try {
        which.sync(chromeExecutablePathCandidate);
        return true;
      } catch {}
      return false;
    },
  );
  if (someExecutableFound) {
    logger.debug(`${UNICODE.OK} Chrome detected`);
    return true;
  }

  logger.debug(`${UNICODE.OK} Chrome detected`);
  return false;
});
