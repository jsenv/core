export const loadFeature = async () => {
  const { answer, loadNestedFeature } = await import("./feature/feature.js");
  loadNestedFeature();
  debugger;
  console.log(answer);
};
