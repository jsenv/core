export const getWidth = (element) => {
  const rect = element.getBoundingClientRect();
  const { width } = rect;
  return width;
};
