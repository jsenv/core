import { getRuntimeLang } from "../i18n/runtime_lang.js";

export const formatNumber = (value, { lang = getRuntimeLang() } = {}) => {
  return new Intl.NumberFormat(lang).format(value);
};
