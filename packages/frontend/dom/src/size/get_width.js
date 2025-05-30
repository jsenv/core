export const getWidth = (element) => {
  const { width } = element.getBoundingClientRect();
  return width;
};
