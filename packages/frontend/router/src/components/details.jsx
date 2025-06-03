import { forwardRef } from "preact/compat";

export const Details = forwardRef(({ pending, children, ...props }, ref) => {
  const [summary, content] = children;

  return (
    <details ref={ref} {...props}>
      {summary}
      {pending ? "loading..." : content}
    </details>
  );
});
