export const createEventMarker = (symbolName) => {
  const symbol = Symbol.for(symbolName);

  const isMarked = (event) => {
    return Boolean(event[symbol]);
  };

  return {
    mark: (event) => {
      event[symbol] = true;
    },
    isMarked,
  };
};
