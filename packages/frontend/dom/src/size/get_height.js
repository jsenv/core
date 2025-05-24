export const getHeight = (element) => {
  const { height } = element.getBoundingClientRect();
  return height;
};
