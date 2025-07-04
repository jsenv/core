export const formDataToObject = (formData) => {
  const params = {};
  for (const [name, value] of formData) {
    if (name in params) {
      if (Array.isArray(params[name])) {
        params[name].push(value);
      } else {
        params[name] = [params[name], value];
      }
    } else {
      params[name] = value;
    }
  }
  return params;
};

export const createFieldsetFormData = (fieldset) => {
  const formData = new FormData();

  const formElements = fieldset.querySelectorAll(
    "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button[name]:not([disabled])",
  );

  for (const element of formElements) {
    const name = element.name;
    if (!name) continue;

    const value = getElementValue(element);
    if (value === undefined) continue; // Skip unchecked checkboxes/radios

    // Handle multiple values and files
    if (element.type === "file" && element.files) {
      // Add all files for file inputs
      for (const file of element.files) {
        formData.append(name, file);
      }
    } else if (Array.isArray(value)) {
      // Handle select multiple
      value.forEach((v) => formData.append(name, v));
    } else {
      // Regular values
      formData.append(name, value);
    }
  }

  return formData;
};

const getElementValue = (element) => {
  const { type, tagName } = element;

  if (tagName === "SELECT") {
    if (element.multiple) {
      return Array.from(element.selectedOptions, (option) => option.value);
    }
    return element.value;
  }

  if (type === "checkbox" || type === "radio") {
    return element.checked ? element.value : undefined;
  }

  if (type === "file") {
    return element.files; // Return FileList for special handling
  }

  return element.value;
};
