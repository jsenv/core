import { langSignal } from "./lang_signal.js";

export const formatNumber = (value, { lang = langSignal.value } = {}) => {
  return new Intl.NumberFormat(lang).format(value);
};
