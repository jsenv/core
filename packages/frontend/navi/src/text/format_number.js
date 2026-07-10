import { languagesSignal } from "./lang_signal.js";

export const formatNumber = (value, { lang = languagesSignal.value } = {}) => {
  return new Intl.NumberFormat(lang).format(value);
};
