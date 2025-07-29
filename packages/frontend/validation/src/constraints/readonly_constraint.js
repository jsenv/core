export const READONLY_CONSTRAINT = {
  name: "readonly",
  check: (element, { skipReadonly }) => {
    if (skipReadonly) {
      return null;
    }
    if (!element.readonly && !element.hasAttribute("data-readonly")) {
      return null;
    }
    const readonlySilent = element.hasAttribute("data-readonly-silent");
    if (readonlySilent) {
      return { silent: true };
    }
    const readonlyMessage = element.getAttribute("data-readonly-message");
    if (readonlyMessage) {
      return {
        message: readonlyMessage,
        level: "info",
      };
    }
    const isBusy = element.getAttribute("aria-busy") === "true";
    if (isBusy) {
      return {
        message: `Cette action est en cours. Veuillez patienter.`,
        level: "info",
      };
    }
    return {
      message:
        element.tagName === "BUTTON"
          ? `Cet action n'est pas disponible pour l'instant.`
          : `Cet élément est en lecture seule et ne peut pas être modifié.`,
      level: "info",
    };
  },
};
