import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useRouteStatus } from "../route/route_hooks.js";

// TODO: we must not use the route status directly here
// because we might load the same route in several places
// it's actually more like an action that can be executed X times
export const SPADetails = forwardRef(({ route, children, ...props }, ref) => {
  const { pending, aborted, error } = useRouteStatus(route);

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [summary, content] = children;

  return (
    <details {...props} ref={innerRef}>
      {summary}
      {pending
        ? "loading..."
        : aborted
          ? "load was aborted"
          : error
            ? `error: ${error.message}`
            : content}
    </details>
  );
});
