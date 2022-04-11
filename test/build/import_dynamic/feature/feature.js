export const answer = 42

export const loadNestedFeature = () => {
  return import("./nested/nested_feature.js")
}
