import { isIP } from "node:net";

export const subjectAltNamesFromAltNames = (altNames) => {
  const altNamesArray = altNames.map((altName) => {
    if (isIP(altName)) {
      return {
        type: 7,
        ip: altName,
      };
    }
    if (isUrl(altName)) {
      return {
        type: 6,
        value: altName,
      };
    }
    // 2 is DNS (Domain Name Server)
    return {
      type: 2,
      value: altName,
    };
  });

  return altNamesArray;
};

const isUrl = (value) => {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export const extensionArrayFromExtensionDescription = (
  extensionDescription,
) => {
  const extensionArray = [];
  Object.keys(extensionDescription).forEach((key) => {
    const value = extensionDescription[key];
    if (value) {
      extensionArray.push({
        name: key,
        ...value,
      });
    }
  });
  return extensionArray;
};

export const extensionDescriptionFromExtensionArray = (extensionArray) => {
  const extensionDescription = {};
  extensionArray.forEach((extension) => {
    const { name, ...rest } = extension;
    extensionDescription[name] = rest;
  });
  return extensionDescription;
};

export const attributeDescriptionFromAttributeArray = (attributeArray) => {
  const attributeObject = {};
  attributeArray.forEach((attribute) => {
    attributeObject[attribute.name] = attribute.value;
  });
  return attributeObject;
};

export const attributeArrayFromAttributeDescription = (
  attributeDescription,
) => {
  const attributeArray = [];
  Object.keys(attributeDescription).forEach((key) => {
    const value = attributeDescription[key];
    if (typeof value === "undefined") {
      return;
    }
    attributeArray.push({
      name: key,
      value,
    });
  });
  return attributeArray;
};

export const normalizeForgeAltNames = (forgeAltNames) => {
  return forgeAltNames.map((forgeAltName) => {
    return forgeAltName.ip || forgeAltName.value;
  });
};
