import { signal } from "@preact/signals";

const DEFAULT_LANG = "en";

const getBrowserLang = () => {
  if (typeof window === "undefined") {
    return DEFAULT_LANG;
  }
  const { navigator } = window;
  if (typeof navigator === "undefined") {
    return DEFAULT_LANG;
  }
  const { language } = navigator;
  if (typeof language === "string") {
    return language;
  }
  const { languages } = navigator;
  if (Array.isArray(languages) && languages.length > 0) {
    return languages[0];
  }
  return DEFAULT_LANG;
};

export const langSignal = signal(getBrowserLang());

if (typeof window !== "undefined") {
  window.addEventListener("languagechange", () => {
    langSignal.value = getBrowserLang();
  });
}
