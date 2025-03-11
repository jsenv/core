export const createTeardown = () => {
  const teardownCallbackSet = new Set();
  return {
    addCallback: (callback) => {
      teardownCallbackSet.add(callback);
    },
    trigger: async () => {
      await Promise.all(
        Array.from(teardownCallbackSet.values()).map(async (callback) => {
          await callback();
        }),
      );
    },
  };
};
