export const computeGroupFeatureConfigMap = (group, globalFeatureConfigMap) => {
  const { incompatibleNameArray } = group

  const groupFeatureConfigMap = {}

  incompatibleNameArray.forEach((featureName) => {
    if (featureName in incompatibleNameArray === false) {
      throw new Error(
        createMissingFeatureErrorMessage({
          featureName,
          availableFeatureNames: Object.keys(globalFeatureConfigMap),
        }),
      )
    }
    groupFeatureConfigMap[featureName] = globalFeatureConfigMap[featureName]
  })

  return groupFeatureConfigMap
}

const createMissingFeatureErrorMessage = ({
  featureName,
  availableFeatureNames,
}) => `missing feature in featureDescription.
featureName: ${featureName}
availableFeatureNames: ${availableFeatureNames}`
