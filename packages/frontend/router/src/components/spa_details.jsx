import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useRouteStatus } from "../route/route_hooks.js";

export const SPADetails = forwardRef(({ route, children, ...props }, ref) => {
  const { pending, aborted, error } = useRouteStatus(route);

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [summary, content] = children;

  // ideally the error should be handled by being displayed in the

  return (
    <details {...props} ref={innerRef}>
      {summary}
      {pending ? (
        <div>loading...</div>
      ) : aborted ? (
        "load was aborted"
      ) : error ? (
        `error: ${error.message}`
      ) : (
        content
      )}
    </details>
  );
});
