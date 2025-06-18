export const getOptionsForActionConnectedToLocalStorageBoolean = (
  key,
  { defaultValue = false } = {},
) => {
  return {
    match: () => {
      const value = localStorage.getItem(key);
      if (value === null) {
        return defaultValue;
      }
      return value === "true";
    },
    activationEffect: () => {
      localStorage.setItem(key, "true");
    },
    deactivationEffect: () => {
      if (defaultValue === true) {
        localStorage.setItem(key, "false");
      } else {
        localStorage.removeItem(key);
      }
    },
  };
};
export const getOptionsForActionConnectedToLocalStorageString = (
  key,
  actionParamName = key,
  { defaultValue = "" } = {},
) => {
  // hummmmmm
  // j'ai le sentiment qu'ici c'est différent en fait
  // on a une action qui correspond a un param dans le local storage
  // donc en gros c'est quand on instantie le template
  // si le user dans le local storage match avec les params de l'instance
  // alors on start l'action (on fetch le user)
  return {
    match: () => {
      const value = localStorage.getItem(key);
      if (value === null) {
        return defaultValue ? { [actionParamName]: defaultValue } : null;
      }
      return { [actionParamName]: value };
    },
    activationEffect: (params) => {
      const valueToStore = params[actionParamName];
      localStorage.setItem(key, valueToStore);
    },
    deactivationEffect: () => {
      localStorage.removeItem(key);
    },
  };
};
