import Graphemer from "graphemer";

export const tokenizeLine = (string) => {
  // eslint-disable-next-line new-cap
  const splitter = new Graphemer.default();
  return splitter.splitGraphemes(string);
};
