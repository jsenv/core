export const formatNumber = (value, { lang } = {}) => {
  return new Intl.NumberFormat(lang).format(value);
};
