export const memoize = (compute) => {
  let memoized = false;
  let memoizedValue;

  const fnWithMemoization = (...args) => {
    if (memoized) {
      return memoizedValue;
    }
    // if compute is recursive wait for it to be fully done before storing the lockValue
    // so set locked later
    memoizedValue = compute(...args);
    memoized = true;
    return memoizedValue;
  };

  fnWithMemoization.forget = () => {
    const value = memoizedValue;
    memoized = false;
    memoizedValue = undefined;
    return value;
  };

  return fnWithMemoization;
};

export const memoizeUrlAndParentUrl = (fn) => {
  const cache = {};
  return createMemoizedFunction(fn, {
    getMemoryEntryFromArguments: ([specifier, importer]) => {
      return {
        get: () => {
          const specifierCacheForImporter = cache[importer];
          return specifierCacheForImporter
            ? specifierCacheForImporter[specifier]
            : null;
        },
        set: (value) => {
          const specifierCacheForImporter = cache[importer];
          if (specifierCacheForImporter) {
            specifierCacheForImporter[specifier] = value;
          } else {
            cache[importer] = {
              [specifier]: value,
            };
          }
        },
        delete: () => {
          const specifierCacheForImporter = cache[importer];
          if (specifierCacheForImporter) {
            delete specifierCacheForImporter[specifier];
          }
        },
      };
    },
  });
};

const createMemoizedFunction = (fn, { getMemoryEntryFromArguments }) => {
  const memoized = (...args) => {
    const memoryEntry = getMemoryEntryFromArguments(args);
    const valueFromMemory = memoryEntry.get();
    if (valueFromMemory) {
      return valueFromMemory;
    }
    const value = fn(...args);
    memoryEntry.set(value);
    return value;
  };
  memoized.isInMemory = (...args) => {
    return Boolean(getMemoryEntryFromArguments(args).get());
  };
  return memoized;
};
