import { useMemo } from "preact/hooks";

export const useStructuredMemo = (props) => {
  return useMemo(
    () => props,
    Object.keys(props).map((key) => props[key]),
  );
};
