import { featuresCompatMap } from "./features_compatibility.js"
import { createOneRuntimeCompat } from "./one_runtime_compat.js"

export const createRuntimeCompat = ({ runtimeSupport, featureNames }) => {
  const minRuntimeVersions = {}
  const missingFeatureNames = []
  const runtimeNames = Object.keys(runtimeSupport)
  if (runtimeNames.length === 0) {
    // when runtimes are unknown, everything is required
    missingFeatureNames.push(...featureNames)
  } else {
    runtimeNames.forEach((runtimeName) => {
      const runtimeVersion = runtimeSupport[runtimeName]
      const oneRuntimeCompat = createOneRuntimeCompat({
        runtimeName,
        runtimeVersion,
        featureNames,
        featuresCompatMap,
      })

      minRuntimeVersions[runtimeName] = oneRuntimeCompat.minRuntimeVersion
      oneRuntimeCompat.missingFeatureNames.forEach((missingFeatureName) => {
        if (!missingFeatureNames.includes(missingFeatureName)) {
          missingFeatureNames.push(missingFeatureName)
        }
      })
    })
  }

  return {
    missingFeatureNames,
    minRuntimeVersions,
  }
}
