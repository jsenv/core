export const READONLY_CONSTRAINT = {
  name: "readonly",
  check: (field, { skipReadonly }) => {
    if (skipReadonly) {
      return null;
    }
    if (!field.readonly && !field.hasAttribute("data-readonly")) {
      return null;
    }
    if (field.type === "hidden") {
      return null;
    }
    const isButton = field.tagName === "BUTTON";
    const isBusy = field.getAttribute("aria-busy") === "true";
    const readonlySilent = field.hasAttribute("data-readonly-silent");
    const messageAttribute = field.getAttribute("data-readonly-message");
    if (readonlySilent) {
      return { silent: true };
    }
    if (isBusy) {
      return {
        target: field,
        message:
          messageAttribute || `Cette action est en cours. Veuillez patienter.`,
        status: "info",
      };
    }
    return {
      target: field,
      message:
        messageAttribute ||
        (isButton
          ? `Cet action n'est pas disponible pour l'instant.`
          : `Cet élément est en lecture seule et ne peut pas être modifié.`),
      status: "info",
    };
  },
};
