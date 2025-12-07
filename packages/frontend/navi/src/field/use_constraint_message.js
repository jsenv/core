import { render } from "preact";
import { useEffect, useId, useRef } from "preact/hooks";

export const useConstraintMessage = (jsx) => {
  const messageId = `constraint_message_${useId()}`;
  // we want to put into the DOM the element, how do we do this?
  // I think we need some place to insert it, like in the document

  const containerRef = useRef();
  if (jsx) {
    let container = containerRef.current;
    if (!container) {
      const container = document.createElement("div");
      container.setAttribute("id", messageId);
      document.body.appendChild(container);
    }
    // render(jsx, container);
  }

  useEffect(() => {
    return () => {
      const container = containerRef.current;
      if (container) {
        container.remove();
      }
    };
  }, []);

  return jsx ? `#${messageId}>*` : undefined;
};
