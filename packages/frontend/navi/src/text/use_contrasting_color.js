import { pickLightOrDark } from "@jsenv/dom";
import { useLayoutEffect } from "preact/hooks";

const CSS_VAR_NAME = "--x-color-contrasting";

export const useContrastingColor = (ref, backgroundElementSelector) => {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    let elementToCheck = el;
    if (backgroundElementSelector) {
      elementToCheck = el.querySelector(backgroundElementSelector);
      if (!elementToCheck) {
        return;
      }
    }
    const lightColor = "var(--navi-color-light)";
    const darkColor = "var(--navi-color-dark)";
    const backgroundColor = getComputedStyle(elementToCheck).backgroundColor;
    if (!backgroundColor) {
      el.style.removeProperty(CSS_VAR_NAME);
      return;
    }
    const colorPicked = pickLightOrDark(
      backgroundColor,
      lightColor,
      darkColor,
      el,
    );
    el.style.setProperty(CSS_VAR_NAME, colorPicked);
  }, []);
};
