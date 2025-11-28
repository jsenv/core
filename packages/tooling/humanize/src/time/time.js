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
const TIME_DICTIONARY_FR = {
  year: { long: "an", plural: "ans", short: "a" },
  month: { long: "mois", plural: "mois", short: "m" },
  week: { long: "semaine", plural: "semaines", short: "s" },
  day: { long: "jour", plural: "jours", short: "j" },
  hour: { long: "heure", plural: "heures", short: "h" },
  minute: { long: "minute", plural: "minutes", short: "m" },
  second: { long: "seconde", plural: "secondes", short: "s" },
  joinDuration: (primary, remaining) => `${primary} et ${remaining}`,
};

export const humanizeEllapsedTime = (
  ms,
  {
    short,
    lang = "en",
    timeDictionnary = lang === "fr" ? TIME_DICTIONARY_FR : TIME_DICTIONARY_EN,
  } = {},
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

export const humanizeDuration = (
  ms,
  {
    short,
    rounded = true,
    decimals,
    lang = "en",
    timeDictionnary = lang === "fr" ? TIME_DICTIONARY_FR : TIME_DICTIONARY_EN,
  } = {},
) => {
  // ignore ms below meaningfulMs so that:
  // humanizeDuration(0.5) -> "0 second"
  // humanizeDuration(1.1) -> "0.001 second" (and not "0.0011 second")
  // This tool is meant to be read by humans and it would be barely readable to see
  // "0.0001 second" (stands for 0.1 millisecond)
  // yes we could return "0.1 millisecond" but we choosed consistency over precision
  // so that the prefered unit is "second" (and does not become millisecond when ms is super small)
  if (ms < 1) {
    return short
      ? `0${timeDictionnary.second.short}`
      : `0 ${timeDictionnary.second.long}`;
  }
  const { primary, remaining } = parseMs(ms);
  if (!remaining) {
    return humanizeDurationUnit(primary, {
      decimals:
        decimals === undefined ? (primary.name === "second" ? 1 : 0) : decimals,
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
  return timeDictionnary.joinDuration(primaryText, remainingText);
};
const humanizeDurationUnit = (
  unit,
  { decimals, short, rounded, timeDictionnary },
) => {
  const count = rounded
    ? setRoundedPrecision(unit.count, { decimals })
    : setPrecision(unit.count, { decimals });
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
  // - 1 year and 1 month is great
  return {
    primary: {
      name: firstUnitName,
      count: firstUnitCount,
    },
    remaining: {
      name: remainingUnitName,
      count: remainingUnitCount,
    },
  };
};
