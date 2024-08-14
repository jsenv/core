import { UNICODE } from "@jsenv/humanize";
import { existsSync } from "node:fs";
import { memoize } from "../memoize.js";

const REASON_CHROME_NOT_DETECTED = `Chrome not detected`;

export const executeTrustQueryOnChrome = ({ logger, macTrustInfo }) => {
  const chromeDetected = detectChrome({ logger });
  if (!chromeDetected) {
    return {
      status: "other",
      reason: REASON_CHROME_NOT_DETECTED,
    };
  }

  return {
    status: macTrustInfo.status,
    reason: macTrustInfo.reason,
  };
};

const detectChrome = memoize(({ logger }) => {
  logger.debug(`Detecting Chrome...`);
  const chromeDetected = existsSync("/Applications/Google Chrome.app");

  if (chromeDetected) {
    logger.debug(`${UNICODE.OK} Chrome detected`);
    return true;
  }

  logger.debug(`${UNICODE.INFO} Chrome not detected`);
  return false;
});
