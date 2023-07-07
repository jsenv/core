export const answer = 42;

export const loadNestedFeature = () => {
  return import("/js/nested_feature.js");
};
