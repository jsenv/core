// An option a function does not read does nothing, and what is built on it
// still looks plausible: `persists` written `persist` keeps nothing across a
// reload, and nothing says so. Said out loud in dev, with the option it most
// likely meant, because the caller cannot tell "ignored" from "broken".

/**
 * Warns, once per `where` and key, about each key of `options` that is not
 * in `knownKeys`. `hints` maps a key to a sentence saying where that wish
 * belongs instead.
 */
export const warnUnknownOptions = (where, options, knownKeys, hints = {}) => {
  for (const key of Object.keys(options)) {
    if (knownKeys.has(key)) {
      continue;
    }
    const warnedKey = `${where} ${key}`;
    if (warnedKeySet.has(warnedKey)) {
      continue;
    }
    warnedKeySet.add(warnedKey);
    let message = `${where}: "${key}" is not an option it reads, it does nothing.`;
    const closest = findClosestKey(key, knownKeys);
    if (closest) {
      message += ` Did you mean "${closest}"?`;
    }
    if (hints[key]) {
      message += ` ${hints[key]}`;
    }
    console.warn(message);
  }
};

const warnedKeySet = new Set();

// A slip of a letter or two (`persist`, `debounceURL`), or the same word
// with a different case.
const findClosestKey = (key, knownKeys) => {
  const keyLowerCase = key.toLowerCase();
  let closest;
  let closestDistance = 3;
  for (const knownKey of knownKeys) {
    const distance = editDistance(keyLowerCase, knownKey.toLowerCase());
    if (distance < closestDistance) {
      closest = knownKey;
      closestDistance = distance;
    }
  }
  return closest;
};

const editDistance = (a, b) => {
  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = previousRow[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      const insertion = row[j - 1] + 1;
      const deletion = previousRow[j] + 1;
      let smallest = substitution;
      if (insertion < smallest) {
        smallest = insertion;
      }
      if (deletion < smallest) {
        smallest = deletion;
      }
      row.push(smallest);
    }
    previousRow = row;
  }
  return previousRow[b.length];
};
