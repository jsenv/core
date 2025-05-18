import { effect, signal } from "@preact/signals";
import "./aside.css" with { type: "css" };

const valueInLocalStorage = (key, { type } = {}) => {
  const get = () => {
    const valueInLocalStorage = window.localStorage.getItem(key);

    if (valueInLocalStorage === null) {
      return undefined;
    }
    if (type === "number") {
      if (valueInLocalStorage === "undefined") {
        console.warn(
          `Invalid value for ${key} in local storage, found ${valueInLocalStorage}`,
        );
        return undefined;
      }
      const valueParsed = JSON.parse(valueInLocalStorage);
      if (!isFinite(valueParsed)) {
        console.warn(
          `Invalid value for ${key} in local storage, found ${valueInLocalStorage}`,
        );
        return undefined;
      }
      return valueParsed;
    }
    return JSON.parse(valueInLocalStorage);
  };
  const set = (value) => {
    window.localStorage.setItem("aside_width", JSON.stringify(value));
  };

  return [get, set];
};
const [restoreAsideWidth, saveAsideWidth] = valueInLocalStorage("aside_width", {
  type: "number",
});

const asideWidthSignal = signal(restoreAsideWidth());
export const useAsideWidth = () => {
  return asideWidthSignal.value;
};
export const setAsideWidth = (width) => {
  asideWidthSignal.value = width;
};
effect(() => {
  const asideWidth = asideWidthSignal.value;
  saveAsideWidth(asideWidth);
});

export const Aside = ({ children }) => {
  const width = useAsideWidth();

  return (
    <aside
      style={{
        width,
      }}
    >
      {children}
    </aside>
  );
};
