export const NOT_LOADING_CONSTRAINT = {
  name: "not_loading",
  check: (element) => {
    if (element.getAttribute("aria-busy") === "true") {
      return `Ce champ est en cours de chargement. Veuillez patienter.`;
    }
    return null;
  },
};
