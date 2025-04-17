import { useRef, useState } from "preact/hooks";

export const useFontFace = (
  family,
  { url, style = "normal", weight = "normal", stretch = "condensed" },
) => {
  const fontRef = useRef(false);
  const [fontReady, fontReadySetter] = useState(false);
  if (!fontRef.current) {
    const font = new FontFace(family, `url(${url})`, {
      style,
      weight,
      stretch,
    });
    fontRef.current = font;
    font.load().then(() => {
      document.fonts.add(font);
      fontReadySetter(true);
    });
  }
  return fontReady;

  // return `@font-face{
  //       font-family: "${family}";
  //       src:url("${url}") format("woff");
  //       font-weight: ${weight};
  //       font-style: ${weight};
  //   }`;
};
