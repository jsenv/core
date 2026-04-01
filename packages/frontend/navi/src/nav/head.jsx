import { useLayoutEffect } from "preact/hooks";

export const Head = ({ children }) => {
  useLayoutEffect(() => {
    if (!children) {
      return undefined;
    }
    const childArray = Array.isArray(children) ? children : [children];
    const previousTitle = document.title;
    const appendedElements = [];

    for (const child of childArray) {
      if (!child) {
        continue;
      }
      if (child.type === "title") {
        const titleChildren = child.props.children;
        document.title = Array.isArray(titleChildren)
          ? titleChildren.join("")
          : (titleChildren ?? "");
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

    return () => {
      document.title = previousTitle;
      for (const el of appendedElements) {
        el.remove();
      }
    };
  }, [children]);

  return null;
};
