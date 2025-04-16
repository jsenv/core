export const createAnimationFramePromise = async () => {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
};
