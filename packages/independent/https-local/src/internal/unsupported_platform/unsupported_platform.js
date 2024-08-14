import { UNICODE } from "@jsenv/humanize";

const platformTrustInfo = {
  status: "unknown",
  reason: "unsupported platform",
};

export const executeTrustQuery = ({ logger }) => {
  logger.warn(
    `${UNICODE.WARNING} platform not supported, cannot execute trust query`,
  );
  return {
    platform: platformTrustInfo,
  };
};
