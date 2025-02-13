import { setRoundedPrecision } from "@jsenv/humanize/src/utils/decimals.js";

export const formatPercentage = (number) => {
  return `${number < 0 ? `-` : "+"}${setRoundedPrecision(Math.abs(number), {
    decimals: 0,
    decimalsWhenSmall: 1,
  })}%`;
};
