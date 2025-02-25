/**

 A multiple header is a header with multiple values like

 "text/plain, application/json;q=0.1"

 Each, means it's a new value (it's optionally followed by a space)

 Each; mean it's a property followed by =
 if "" is a string
 if not it's likely a number
 */

export const parseMultipleHeader = (
  multipleHeaderString,
  { validateName = () => true, validateProperty = () => true } = {},
) => {
  const values = multipleHeaderString.split(",");
  const multipleHeader = {};
  values.forEach((value) => {
    const valueTrimmed = value.trim();
    const valueParts = valueTrimmed.split(";");
    const name = valueParts[0];
    const nameValidation = validateName(name);
    if (!nameValidation) {
      return;
    }
    const afterName = valueParts.slice(1);
    const properties = parseHeaderProperties(afterName, { validateProperty });
    multipleHeader[name] = properties;
  });
  return multipleHeader;
};

export const parseSingleHeaderWithAttributes = (
  string,
  { validateAttribute = () => true } = {},
) => {
  const props = {};
  const attributes = string.split(";");
  for (const attr of attributes) {
    let [name, value] = attr.split("=");
    name = name.trim();
    value = value.trim();
    if (validateAttribute({ name, value })) {
      props[name] = value;
    }
  }
  return props;
};

const parseHeaderProperties = (headerProperties, { validateProperty }) => {
  const properties = {};
  for (const propertySource of headerProperties) {
    const [propertyName, propertyValueString] = propertySource
      .trim()
      .split("=");
    const propertyValue = parseHeaderPropertyValue(propertyValueString);
    const property = { name: propertyName, value: propertyValue };
    const propertyValidation = validateProperty(property);
    if (!propertyValidation) {
      continue;
    }
    properties[propertyName] = propertyValue;
  }
  return properties;
};

const parseHeaderPropertyValue = (headerPropertyValueString) => {
  const firstChar = headerPropertyValueString[0];
  const lastChar =
    headerPropertyValueString[headerPropertyValueString.length - 1];
  if (firstChar === '"' && lastChar === '"') {
    return headerPropertyValueString.slice(1, -1);
  }
  if (isNaN(headerPropertyValueString)) {
    return headerPropertyValueString;
  }
  return parseFloat(headerPropertyValueString);
};

export const stringifyMultipleHeader = (
  multipleHeader,
  { validateName = () => true, validateProperty = () => true } = {},
) => {
  return Object.keys(multipleHeader)
    .filter((name) => {
      const headerProperties = multipleHeader[name];
      if (!headerProperties) {
        return false;
      }
      if (typeof headerProperties !== "object") {
        return false;
      }
      const nameValidation = validateName(name);
      if (!nameValidation) {
        return false;
      }
      return true;
    })
    .map((name) => {
      const headerProperties = multipleHeader[name];
      const headerPropertiesString = stringifyHeaderProperties(
        headerProperties,
        {
          validateProperty,
        },
      );
      if (headerPropertiesString.length) {
        return `${name};${headerPropertiesString}`;
      }
      return name;
    })
    .join(", ");
};

const stringifyHeaderProperties = (headerProperties, { validateProperty }) => {
  const headerPropertiesString = Object.keys(headerProperties)
    .map((name) => {
      const property = {
        name,
        value: headerProperties[name],
      };
      return property;
    })
    .filter((property) => {
      const propertyValidation = validateProperty(property);
      if (!propertyValidation) {
        return false;
      }
      return true;
    })
    .map(stringifyHeaderProperty)
    .join(";");
  return headerPropertiesString;
};

const stringifyHeaderProperty = ({ name, value }) => {
  if (typeof value === "string") {
    return `${name}="${value}"`;
  }
  return `${name}=${value}`;
};
