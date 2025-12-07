export const SAME_AS_CONSTRAINT = {
  name: "same_as",
  messageAttribute: "data-same-as-message",
  check: (field) => {
    const sameAs = field.getAttribute("data-same-as");
    if (!sameAs) {
      return null;
    }
    const otherField = document.querySelector(sameAs);
    if (!otherField) {
      console.warn(
        `Same as constraint: could not find element for selector ${sameAs}`,
      );
      return null;
    }
    const fieldValue = field.value;
    if (!fieldValue && !field.required) {
      return null;
    }
    const otherFieldValue = otherField.value;
    if (!otherFieldValue && !otherField.required) {
      // don't validate if one of the two values is empty
      return null;
    }
    if (fieldValue === otherFieldValue) {
      return null;
    }
    const type = field.type;
    if (type === "password") {
      return `Ce mot de passe doit être identique au précédent.`;
    }
    if (type === "email") {
      return `Cette adresse e-mail doit être identique a la précédente.`;
    }
    return `Ce champ doit être identique au précédent.`;
  },
};
