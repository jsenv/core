// Works with both uiStateControllers (field.props.type) and legacy DOM elements (field.type).
export const fieldTypeSuffix = (field) => {
  const type = field.props?.type ?? field.type;
  if (type === "password") {
    return "password";
  }
  if (type === "email") {
    return "email";
  }
  if (type === "checkbox") {
    return "checkbox";
  }
  if (type === "radio") {
    return "radio";
  }
  return "default";
};

// Returns the string value for constraint checking.
// Controllers expose the current value as uiState; DOM elements expose it as .value.
export const getConstraintValue = (field) => {
  if (field.props !== undefined) {
    return String(field.uiState ?? "");
  }
  return field.value ?? "";
};
