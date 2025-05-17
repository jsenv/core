import { useDebounceTrue } from "../hooks/use_debounce_true.js";
import { RectangleLoading } from "./rectangle_loading.jsx";

export const LoaderBackground = ({ pending, children }) => {
  const shouldShowSpinner = useDebounceTrue(pending, 300);

  // useLayoutEffect(() => {
  //   if (pending) {
  //     // show the loading stuff, ensure we match checkbox size and color somehow
  //   }
  // }, [pending, aborted]);

  return (
    <div style="display:inline-flex;position: relative;">
      {shouldShowSpinner && (
        <div style="position: absolute; inset: 0">
          <RectangleLoading />
        </div>
      )}
      {children}
    </div>
  );
};
