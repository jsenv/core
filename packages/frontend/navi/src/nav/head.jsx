import { useLayoutEffect } from "preact/hooks";

import { pushHeadThemeColors } from "./theme_color.js";

// The title belongs to the last Head to arrive, whatever order they leave in:
// the page being left by a route transition is taken down AFTER the page
// arriving is up (see keepLeavingPages in route.jsx), and putting back the
// title it found would put its own page's title over the new one. A
// theme-color meta follows the same rule, kept by theme_color.js, where the
// popups of the top layer paint over it.
const titleEntries = [];
let titleWithoutHead = null;

export const Head = ({ children }) => {
  useLayoutEffect(() => {
    if (!children) {
      return undefined;
    }
    const childArray = Array.isArray(children) ? children : [children];
    const appendedElements = [];
    const themeColors = [];
    let titleEntry = null;

    for (const child of childArray) {
      if (!child) {
        continue;
      }
      if (child.type === "title") {
        const titleChildren = child.props.children;
        titleEntry = {
          title: Array.isArray(titleChildren)
            ? titleChildren.join("")
            : (titleChildren ?? ""),
        };
        continue;
      }
      if (child.type === "meta" && child.props.name === "theme-color") {
        themeColors.push({
          content: child.props.content,
          media: child.props.media ?? null,
        });
        continue;
      }
      const el = document.createElement(child.type);
      const props = child.props || {};
      for (const [key, value] of Object.entries(props)) {
        el.setAttribute(key, value);
      }
      document.head.appendChild(el);
      appendedElements.push(el);
    }
    if (titleEntry) {
      if (titleEntries.length === 0) {
        titleWithoutHead = document.title;
      }
      titleEntries.push(titleEntry);
      document.title = titleEntry.title;
    }
    const removeThemeColors =
      themeColors.length > 0 ? pushHeadThemeColors(themeColors) : null;

    return () => {
      removeThemeColors?.();
      if (titleEntry) {
        titleEntries.splice(titleEntries.indexOf(titleEntry), 1);
        const lastEntry = titleEntries[titleEntries.length - 1];
        document.title = lastEntry ? lastEntry.title : titleWithoutHead;
      }
      for (const el of appendedElements) {
        el.remove();
      }
    };
  }, [children]);

  return null;
};
