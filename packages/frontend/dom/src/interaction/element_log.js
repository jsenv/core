export const getElementSelector = (element) => {
  const tagName = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const className = element.className
    ? `.${element.className.split(" ").join(".")}`
    : "";
  return `${tagName}${id}${className}`;
};
