export const getHeight = () => {
  const element = document.documentElement;
  const { height } = element.getBoundingClientRect();
  return height;
};
