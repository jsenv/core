export const generateFieldInvalidMessage = (template, { field }) => {
  return replaceStringVars(template, {
    "{field}": () => generateThisFieldText(field),
  });
};

const generateThisFieldText = (field) => {
  if (field.type === "password") {
    return "Ce mot de passe";
  }
  if (field.type === "email") {
    return "Cette adresse e-mail";
  }
  if (field.type === "checkbox") {
    return "Cette case";
  }
  if (field.type === "radio") {
    return "Cette option";
  }
  return "Ce champ";
};

export const replaceStringVars = (string, replacers) => {
  return string.replace(/(\{\w+\})/g, (match, name) => {
    const replacer = replacers[name];
    if (replacer === undefined) {
      return match;
    }
    if (typeof replacer === "function") {
      return replacer();
    }
    return replacer;
  });
};
