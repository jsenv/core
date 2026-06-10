import { setPrecision, setRoundedPrecision } from "../utils/decimals.js";

const UNIT_MS = {
  year: 31_557_600_000,
  month: 2_629_000_000,
  week: 604_800_000,
  day: 86_400_000,
  hour: 3_600_000,
  minute: 60_000,
  second: 1000,
};
const UNIT_KEYS = Object.keys(UNIT_MS);
const SMALLEST_UNIT_NAME = UNIT_KEYS[UNIT_KEYS.length - 1];
const TIME_DICTIONARY_EN = {
  year: { long: "year", plural: "years", short: "y" },
  month: { long: "month", plural: "months", short: "m" },
  week: { long: "week", plural: "weeks", short: "w" },
  day: { long: "day", plural: "days", short: "d" },
  hour: { long: "hour", plural: "hours", short: "h" },
  minute: { long: "minute", plural: "minutes", short: "m" },
  second: { long: "second", plural: "seconds", short: "s" },
  joinDuration: (primary, remaining) => `${primary} and ${remaining}`,
};

export const humanizeEllapsedTime = (
  ms,
  { short, timeDictionnary = TIME_DICTIONARY_EN } = {},
) => {
  if (ms < 1000) {
    return short
      ? `0${timeDictionnary.second.short}`
      : `0 ${timeDictionnary.second.long}`;
  }
  const { primary, remaining } = parseMs(ms);
  if (!remaining) {
    return inspectEllapsedUnit(primary, { short, timeDictionnary });
  }
  const primaryText = inspectEllapsedUnit(primary, {
    short,
    timeDictionnary,
  });
  const remainingText = inspectEllapsedUnit(remaining, {
    short,
    timeDictionnary,
  });
  return timeDictionnary.joinDuration(primaryText, remainingText);
};
const inspectEllapsedUnit = (unit, { short, timeDictionnary }) => {
  const count =
    unit.name === "second" ? Math.floor(unit.count) : Math.round(unit.count);
  const name = unit.name;
  if (short) {
    const unitText = timeDictionnary[name].short;
    return `${count}${unitText}`;
  }
  if (count <= 1) {
    const unitText = timeDictionnary[name].long;
    return `${count} ${unitText}`;
  }
  const unitText = timeDictionnary[name].plural;
  return `${count} ${unitText}`;
};

/**
 * Converts a duration in milliseconds into a human-readable string intended for display in
 * CLI output — where readability matters more than precision.
 *
 * - Values below 1ms are displayed as "0 second". Sub-millisecond durations are not
 *   meaningful at human scale, and showing "0.0001 second" (or switching to a "millisecond"
 *   unit) would hurt readability. The chosen trade-off is to always use "second" as the
 *   smallest unit and accept the loss of precision for very small values.
 * - Values below 1s are displayed in fractional seconds (e.g. "0.05 second").
 * - Values are expressed using the two most significant units (e.g. "1 hour and 23 minutes").
 * - Rounding never causes a value to display as the next unit boundary
 *   (e.g. 59_999ms → "59.9 seconds", never "60 seconds").
 *
 * @param {number} ms - Duration in milliseconds.
 * @param {object} [options]
 * @param {boolean} [options.short=false] - Use compact unit symbols (e.g. "1h and 23m").
 * @param {boolean} [options.rounded=true] - Round the last displayed digit. When false, truncates instead.
 * @param {number} [options.decimals] - Override the number of decimal places shown.
 * @returns {string}
 */
export const humanizeDuration = (
  ms,
  {
    short,
    rounded = true,
    decimals,
    timeDictionnary = TIME_DICTIONARY_EN,
  } = {},
) => {
  if (ms < 1) {
    return short
      ? `0${timeDictionnary.second.short}`
      : `0 ${timeDictionnary.second.long}`;
  }
  const { primary, remaining } = parseMs(ms);
  if (!remaining) {
    const primaryUnitIndex = UNIT_KEYS.indexOf(primary.name);
    const nextUnitName = UNIT_KEYS[primaryUnitIndex - 1];
    const maxCount = nextUnitName
      ? UNIT_MS[nextUnitName] / UNIT_MS[primary.name]
      : null;
    return humanizeDurationUnit(primary, {
      decimals:
        decimals === undefined ? (primary.name === "second" ? 1 : 0) : decimals,
      maxCount,
      short,
      rounded,
      timeDictionnary,
    });
  }
  const primaryText = humanizeDurationUnit(primary, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
    timeDictionnary,
  });
  const remainingText = humanizeDurationUnit(remaining, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
    timeDictionnary,
  });
  if (short) {
    return `${primaryText}${remainingText}`;
  }
  return timeDictionnary.joinDuration(primaryText, remainingText);
};
const humanizeDurationUnit = (
  unit,
  { decimals, maxCount, short, rounded, timeDictionnary },
) => {
  let count = rounded
    ? setRoundedPrecision(unit.count, { decimals })
    : setPrecision(unit.count, { decimals });
  if (maxCount !== null && maxCount !== undefined && count >= maxCount) {
    // Prevent rounding up to the next unit boundary (e.g. 59.999s → 60s → cap to 59.9s)
    const factor = Math.pow(10, decimals ?? 0);
    count = Math.floor(unit.count * factor) / factor;
  }
  const name = unit.name;
  if (short) {
    const unitText = timeDictionnary[name].short;
    return `${count}${unitText}`;
  }
  if (count <= 1) {
    const unitText = timeDictionnary[name].long;
    return `${count} ${unitText}`;
  }
  const unitText = timeDictionnary[name].plural;
  return `${count} ${unitText}`;
};

const parseMs = (ms) => {
  let firstUnitName = SMALLEST_UNIT_NAME;
  let firstUnitCount = ms / UNIT_MS[SMALLEST_UNIT_NAME];
  const firstUnitIndex = UNIT_KEYS.findIndex((unitName) => {
    if (unitName === SMALLEST_UNIT_NAME) {
      return false;
    }
    const msPerUnit = UNIT_MS[unitName];
    const unitCount = Math.floor(ms / msPerUnit);
    if (unitCount) {
      firstUnitName = unitName;
      firstUnitCount = unitCount;
      return true;
    }
    return false;
  });
  if (firstUnitName === SMALLEST_UNIT_NAME) {
    return {
      primary: {
        name: firstUnitName,
        count: firstUnitCount,
      },
    };
  }
  const remainingMs = ms - firstUnitCount * UNIT_MS[firstUnitName];
  const remainingUnitName = UNIT_KEYS[firstUnitIndex + 1];
  const remainingUnitCount = remainingMs / UNIT_MS[remainingUnitName];
  // - 1 year and 1 second is too much information
  //   so we don't check the remaining units
  // - 1 year and 0.0001 week is awful
  //   hence the if below
  if (Math.round(remainingUnitCount) < 1) {
    return {
      primary: {
        name: firstUnitName,
        count: firstUnitCount,
      },
    };
  }
  // When remaining rounds up to a full next-unit (e.g. 59.999s rounds to 60s = 1min),
  // drop the remaining to avoid displaying "59 minutes and 60 seconds".
  const remainingUnitMs = UNIT_MS[remainingUnitName];
  const nextUnitMs = UNIT_MS[firstUnitName];
  const maxRemainingCount = nextUnitMs / remainingUnitMs; // e.g. 60 for seconds-in-a-minute
  // Cap remaining so it never rounds up to the next unit boundary
  // (e.g. 59.5s stays as 59s instead of rounding to 60s = 1min)
  const cappedRemainingCount =
    remainingUnitCount >= maxRemainingCount - 1
      ? maxRemainingCount - 1
      : remainingUnitCount;
  // - 1 year and 1 month is great
  return {
    primary: {
      name: firstUnitName,
      count: firstUnitCount,
    },
    remaining: {
      name: remainingUnitName,
      count: cappedRemainingCount,
    },
  };
};
