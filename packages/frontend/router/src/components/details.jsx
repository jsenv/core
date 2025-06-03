import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { LoaderBackground } from "./loader_background.jsx";

export const Details = forwardRef(({ pending, children, ...props }, ref) => {
  const [summary, content] = children;
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  return (
    <details ref={innerRef} {...props}>
      {summary}
      <LoaderBackground pending={pending} containerRef={innerRef}>
        {content}
      </LoaderBackground>
    </details>
  );
});
