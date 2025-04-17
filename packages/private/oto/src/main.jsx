import { useFontFace } from "hooks/use_font_face.js";
import { render } from "preact";
import { useEffect, useErrorBoundary } from "preact/hooks";
import { goblinFontUrl } from "./components/text/font_urls.js";
import { Game } from "./game/game.jsx";
import "./routes.js";

const GameWithErrorBoundary = () => {
  const [error] = useErrorBoundary();
  const goblinFont = useFontFace("goblin", {
    url: goblinFontUrl,
  });
  useEffect(() => {
    if (!import.meta.hot) {
      return null;
    }
    if (!error) {
      return null;
    }
    return import.meta.hot.events.beforePartialReload.addCallback(() => {
      import.meta.hot.invalidate();
    });
  }, [error]);
  if (error) {
    return `An error occurred: ${error.message}`;
  }
  if (!goblinFont) {
    return "loading font";
  }
  return <Game />;
};

render(<GameWithErrorBoundary />, document.querySelector("#root"));
