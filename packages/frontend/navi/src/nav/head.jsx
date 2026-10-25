import { useLayoutEffect, useRef } from "preact/hooks";

import { pushHeadThemeColors } from "./theme_color.js";

// The title belongs to the last Head to arrive, whatever order they leave in:
// the page being left by a route transition is taken down AFTER the page
// arriving is up (see keepLeavingPages in route.jsx), and putting back the
// title it found would put its own page's title over the new one. A
// theme-color meta follows the same rule, kept by theme_color.js, where the
// popups of the top layer paint over it.
// Arriving is mounting: a Head that renders again — a layout's head whose
// count moved, children built anew at every render — is updated where it
// stands, under the Heads that arrived after it. Taken off and pushed back, a
// layout's head would take the title from every page below it.
const headEntries = [];
let titleWithoutHead = null;

export const Head = ({ children }) => {
  const entryRef = useRef(null);
  useLayoutEffect(() => {
    const entry = { title: null, themeColors: pushHeadThemeColors() };
    headEntries.push(entry);
    entryRef.current = entry;
    return () => {
      entry.themeColors.remove();
      headEntries.splice(headEntries.indexOf(entry), 1);
      writeDocumentTitle();
    };
  }, []);

  const { title, themeColors, elements } = readHeadChildren(children);
  // What the children say, rather than the children: the elements are built
  // anew at every render, and saying the same thing again changes nothing.
  const contentKey = JSON.stringify([title, themeColors, elements]);
  useLayoutEffect(() => {
    const entry = entryRef.current;
    if (title !== null && !headEntries.some((other) => other.title !== null)) {
      titleWithoutHead = document.title;
    }
    entry.title = title;
    writeDocumentTitle();
    entry.themeColors.set(themeColors);
    const appendedElements = [];
    for (const { type, props } of elements) {
      const el = document.createElement(type);
      for (const [key, value] of Object.entries(props)) {
        el.setAttribute(key, value);
      }
      document.head.appendChild(el);
      appendedElements.push(el);
    }
    return () => {
      for (const el of appendedElements) {
        el.remove();
      }
    };
  }, [contentKey]);

  return null;
};

const writeDocumentTitle = () => {
  for (let i = headEntries.length - 1; i >= 0; i--) {
    const { title } = headEntries[i];
    if (title !== null) {
      document.title = title;
      return;
    }
  }
  if (titleWithoutHead !== null) {
    document.title = titleWithoutHead;
    titleWithoutHead = null;
  }
};

const readHeadChildren = (children) => {
  let title = null;
  const themeColors = [];
  const elements = [];
  if (!children) {
    return { title, themeColors, elements };
  }
  const childArray = Array.isArray(children) ? children : [children];
  for (const child of childArray) {
    if (!child) {
      continue;
    }
    if (child.type === "title") {
      const titleChildren = child.props.children;
      title = Array.isArray(titleChildren)
        ? titleChildren.join("")
        : (titleChildren ?? "");
      continue;
    }
    if (child.type === "meta" && child.props.name === "theme-color") {
      themeColors.push({
        content: child.props.content,
        media: child.props.media ?? null,
      });
      continue;
    }
    elements.push({ type: child.type, props: child.props || {} });
  }
  return { title, themeColors, elements };
};
