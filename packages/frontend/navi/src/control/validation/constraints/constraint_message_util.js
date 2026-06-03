export const fieldTypeSuffix = (field) => {
  if (!field) {
    return "default";
  }
  if (field.type === "password") {
    return "password";
  }
  if (field.type === "email") {
    return "email";
  }
  if (field.type === "checkbox") {
    return "checkbox";
  }
  if (field.type === "radio") {
    return "radio";
  }
  return "default";
};
