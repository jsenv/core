import { forwardRef } from "preact/compat";
import { LoaderBackground } from "./loader_background.jsx";

export const Details = forwardRef(({ pending, children, ...props }, ref) => {
  const [summary, content] = children;

  return (
    <details ref={ref} {...props}>
      {summary}
      <LoaderBackground pending={pending}>{content}</LoaderBackground>
    </details>
  );
});
