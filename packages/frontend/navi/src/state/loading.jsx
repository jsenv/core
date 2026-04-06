import { Suspense } from "preact/compat";

import { useErrorSilenced } from "./error_boundary.jsx";

export const Loading = ({ children, fallback }) => {
  const silenced = useErrorSilenced();
  return <Suspense fallback={silenced ? null : fallback}>{children}</Suspense>;
};
