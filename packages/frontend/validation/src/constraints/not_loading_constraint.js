export const NOT_LOADING_CONSTRAINT = {
  name: "not_loading",
  check: (element) => {
    if (element.getAttribute("aria-busy") === "true") {
      const loadingMessage = element.getAttribute("data-loading-message");
      return {
        message:
          loadingMessage || `Cette action est en cours. Veuillez patienter.`,
        level: "info",
      };
    }
    return null;
  },
};
