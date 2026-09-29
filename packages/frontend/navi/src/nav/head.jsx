import { useLayoutEffect } from "preact/hooks";

// The title belongs to the last Head to arrive, whatever order they leave in:
// the page being left by a route transition is taken down AFTER the page
// arriving is up (see keepLeavingPages in route.jsx), and putting back the
// title it found would put its own page's title over the new one.
const titleEntries = [];
let titleWithoutHead = null;

export const Head = ({ children }) => {
  useLayoutEffect(() => {
    if (!children) {
      return undefined;
    }
    const childArray = Array.isArray(children) ? children : [children];
    const appendedElements = [];
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

    return () => {
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
