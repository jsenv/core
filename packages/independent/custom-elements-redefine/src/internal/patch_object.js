export const patchObject = (recentImpl, targetImpl) => {
  const ownPropertyNamesProto = Object.getOwnPropertyNames(recentImpl);

  ownPropertyNamesProto.forEach((ownPropertyName) => {
    if (PROPERTY_NAMES_TO_SKIP.includes(ownPropertyName)) {
      return;
    }
    const propertyDescriptor = Object.getOwnPropertyDescriptor(
      recentImpl,
      ownPropertyName,
    );
    if (!propertyDescriptor) {
      return;
    }
    if (!propertyDescriptor.configurable) {
      console.warn(
        "[custom-elements-redefined]",
        `${ownPropertyName} is not configurable, skipping`,
      );
      return;
    }
    Object.defineProperty(targetImpl, ownPropertyName, propertyDescriptor);
  });
};

const PROPERTY_NAMES_TO_SKIP = ["name", "prototype", "length"];
