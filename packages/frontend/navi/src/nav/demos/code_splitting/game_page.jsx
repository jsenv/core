import { Box, Link, Text, useAsyncData } from "@jsenv/navi";

import { GAME_PAGE_ACTION, GAME_ROUTE } from "./demo_backend.js";

export const GamePage = () => {
  const [game] = useAsyncData(GAME_PAGE_ACTION);
  return (
    <Box flex="y" spacing="s">
      <Text bold>{game.name}</Text>
      <Text>{game.players} joueurs</Text>
      <Box flex spacing="s">
        <Link route={GAME_ROUTE} routeParams={{ gameId: "1" }}>
          partie 1
        </Link>
        <Link route={GAME_ROUTE} routeParams={{ gameId: "2" }}>
          partie 2
        </Link>
      </Box>
    </Box>
  );
};
