export const allIterable = (iterables) => {
  return {
    [Symbol.iterator]: () => {
      const iterators = iterables.map((iterable) =>
        iterable[Symbol.iterator](),
      );

      return {
        next: () => {
          const entries = [];
          let allDone = true;
          for (const iterator of iterators) {
            const entry = iterator.next();
            if (!entry.done) {
              allDone = false;
            }
            entries.push(entry.value);
          }
          if (allDone) {
            return { done: true };
          }
          return { done: false, value: entries };
        },
      };
    },
  };
};
