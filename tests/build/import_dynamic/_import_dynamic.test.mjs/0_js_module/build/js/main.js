export const loadFeature = async () => {
  const { answer, loadNestedFeature } = await import("/js/feature.js");
  loadNestedFeature();
  debugger;
  console.log(answer);
};
