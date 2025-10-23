export const collectFormElementValues = (element) => {
  let formElements;
  if (element.tagName === "FORM") {
    formElements = element.elements;
  } else {
    // fieldset or anything else
    formElements = element.querySelectorAll(
      "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button[name]:not([disabled])",
    );
  }

  const values = {};
  const checkboxArrayNameSet = new Set();
  for (const formElement of formElements) {
    if (formElement.type === "checkbox" && formElement.name) {
      const name = formElement.name;
      const endsWithBrackets = name.endsWith("[]");
      if (endsWithBrackets) {
        checkboxArrayNameSet.add(name);
        values[name] = [];
        continue;
      }
      const closestDataCheckboxList = formElement.closest(
        "[data-checkbox-list]",
      );
      if (closestDataCheckboxList) {
        checkboxArrayNameSet.add(name);
        values[name] = [];
      }
    }
  }

  for (const formElement of formElements) {
    const name = formElement.name;
    if (!name) {
      continue;
    }
    const value = getFormElementValue(formElement);
    if (value === undefined) {
      continue; // Skip unchecked checkboxes/radios
    }
    if (formElement.type === "checkbox" && checkboxArrayNameSet.has(name)) {
      values[name].push(value);
    } else {
      values[name] = value;
    }
  }
  return values;
};

const getFormElementValue = (formElement) => {
  const { type, tagName } = formElement;

  if (tagName === "SELECT") {
    if (formElement.multiple) {
      return Array.from(formElement.selectedOptions, (option) =>
        getValue(option),
      );
    }
    return formElement.value;
  }

  if (type === "checkbox" || type === "radio") {
    return formElement.checked ? getValue(formElement) : undefined;
  }

  if (type === "file") {
    return formElement.files; // Return FileList for special handling
  }

  return getValue(formElement);
};

const getValue = (formElement) => {
  const hasDataValueAttribute = formElement.hasAttribute("data-value");
  if (hasDataValueAttribute) {
    // happens for "datetime-local" inputs to keep the timezone
    // consistent when sending to the server
    return formElement.getAttribute("data-value");
  }
  return formElement.value;
};
