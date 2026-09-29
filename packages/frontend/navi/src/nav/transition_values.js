/**
 * The values a movement hands to its pictures, written where only the pictures
 * read them: on ::view-transition, the root of the pseudo-element tree, rather
 * than on the document's root.
 *
 * A custom property written on :root is inherited by every element of the
 * document, and writing one restyles all of them. A movement writes its
 * numbers as its pages are held, again whenever a scroll moves the window, and
 * takes them off as it ends — each time a whole-document restyle of a page that
 * can be thousands of elements long. On ::view-transition they reach every
 * picture by plain inheritance, and no element at all.
 *
 * An inline style cannot target a pseudo-element, so they are declarations of
 * one rule, in a sheet of their own. Written only: what a pseudo-element that
 * is not on screen computes is not reliably readable, so nothing reads them
 * back from there.
 */

let valuesStyle = null;
const getValuesStyle = () => {
  if (valuesStyle) {
    return valuesStyle;
  }
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(":root::view-transition {}");
  const [rule] = sheet.cssRules;
  if (rule) {
    document.adoptedStyleSheets.push(sheet);
    valuesStyle = rule.style;
  } else {
    // A browser without view transitions drops the rule: the movement runs its
    // steps all the same (see start_view_transition_polyfill.js), with no
    // pictures to hand anything to.
    valuesStyle = document.createElement("div").style;
  }
  return valuesStyle;
};

export const setTransitionValue = (name, value) => {
  getValuesStyle().setProperty(name, value);
};

export const removeTransitionValue = (name) => {
  getValuesStyle().removeProperty(name);
};
