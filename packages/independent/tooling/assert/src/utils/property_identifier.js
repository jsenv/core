export const isValidPropertyIdentifier = (propertyName) => {
  return (
    typeof propertyName === "number" ||
    !isNaN(propertyName) ||
    isDotNotationAllowed(propertyName)
  );
};

export const isDotNotationAllowed = (propertyName) => {
  return (
    /^[a-z_$]+[0-9a-z_&]$/i.test(propertyName) ||
    /^[a-z_$]$/i.test(propertyName)
  );
};
