export const formDataToObject = (formData) => {
  const params = {};
  for (const [name, value] of formData) {
    if (name in params) {
      if (Array.isArray(params[name])) {
        params[name].push(value);
      } else {
        params[name] = [params[name], value];
      }
    } else {
      params[name] = value;
    }
  }
  return params;
};
