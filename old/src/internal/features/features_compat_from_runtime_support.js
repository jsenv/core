import { featuresCompatFromRuntime } from "./features_compat_from_runtime.js"

export const featuresCompatFromRuntimeSupport = ({
  runtimeSupport,
  featureNames,
}) => {
  const availableFeatureNames = []
  const minRuntimeVersions = {}
  const runtimeNames = Object.keys(runtimeSupport)
  runtimeNames.forEach((runtimeName) => {
    const runtimeVersion = runtimeSupport[runtimeName]
    const runtimeFeaturesCompat = featuresCompatFromRuntime({
      runtimeName,
      runtimeVersion,
      featureNames,
    })

    minRuntimeVersions[runtimeName] = runtimeFeaturesCompat.minRuntimeVersion
    runtimeFeaturesCompat.availableFeatureNames.forEach(
      (availableFeatureName) => {
        if (!availableFeatureNames.includes(availableFeatureName)) {
          availableFeatureNames.push(availableFeatureName)
        }
      },
    )
  })
  return {
    availableFeatureNames,
    minRuntimeVersions,
  }
}
