export const SAME_AS_CONSTRAINT = {
  name: "same_as",
  check: (element) => {
    const sameAs = element.getAttribute("data-same-as");
    if (!sameAs) {
      return null;
    }

    const otherElement = document.querySelector(sameAs);
    if (!otherElement) {
      console.warn(
        `Same as constraint: could not find element for selector ${sameAs}`,
      );
      return null;
    }

    const value = element.value;
    const otherValue = otherElement.value;
    if (value === "" || otherValue === "") {
      // don't validate if one of the two values is empty
      return null;
    }

    if (value === otherValue) {
      return null;
    }

    const messageAttribute = element.getAttribute("data-same-as-message");
    if (messageAttribute) {
      return messageAttribute;
    }

    const type = element.type;
    if (type === "password") {
      return `Ce mot de passe doit être identique au précédent.`;
    }
    if (type === "email") {
      return `Cette adresse e-mail doit être identique a la précédente.`;
    }
    return `Ce champ doit être identique au précédent.`;
  },
};
