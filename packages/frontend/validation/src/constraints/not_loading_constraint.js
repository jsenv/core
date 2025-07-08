export const NOT_LOADING_CONSTRAINT = {
  name: "not_loading",
  check: (element) => {
    if (element.getAttribute("aria-busy") === "true") {
      return {
        message: `Ce champ est occupé. Veuillez patienter.`,
        level: "info",
      };
    }
    return null;
  },
};
