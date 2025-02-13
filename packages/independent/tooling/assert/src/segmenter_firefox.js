// see https://github.com/sindresorhus/string-width/issues/50
let restore = () => {};
if (typeof window.Intl.Segmenter !== "function") {
  window.Intl.Segmenter = function () {
    const segment = (string) => {
      return string.split("").map((char) => {
        return { segment: char };
      });
    };
    return { segment };
  };
  restore = () => {
    window.Intl.Segmenter = undefined;
  };
}

export const cleanup = () => {
  restore();
};
