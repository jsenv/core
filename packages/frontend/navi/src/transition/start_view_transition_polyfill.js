export const ensureDocumentStartViewTransition = () => {
  if (document.startViewTransition) {
    return;
  }
  document.startViewTransition = (updateCallback) => {
    updateCallback();
    return {
      ready: Promise.resolve(),
      finished: Promise.resolve(),
    };
  };
};
