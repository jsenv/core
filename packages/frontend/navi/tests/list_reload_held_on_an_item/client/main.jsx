/*
 * A list of 597 authors read a page at a time, in a box of its own under a
 * sticky header — the shape of the report this comes from. Most rows are one
 * line, every seventh is two.
 *
 * The url says what the run knows when it mounts:
 * - `count=1`: how many items there are (`<List.Items count>`);
 * - `keep=1`: the page is kept for the next document (`keepPageOnScreen`);
 * - `open=<index>`: the list opens on that item (`defaultScrolled`).
 *
 * Every range asked for is written down, as the run asks it: ranks, `end`
 * included, and the item it names.
 */

import {
  Box,
  keepPageOnScreen,
  List,
  resource,
  Route,
  route,
  setupRoutes,
  stateSignal,
  Text,
} from "@jsenv/navi";
import { render } from "preact";
import { useRef } from "preact/hooks";

const params = new URLSearchParams(window.location.search);
const giveCount = params.get("count") === "1";
const keepPage = params.get("keep") === "1";
const openAt = params.get("open") ? Number(params.get("open")) : undefined;

const AUTHORS = [];
let i = 0;
while (i < 597) {
  AUTHORS.push({ id: `author_${i}`, name: `Author ${i}`, aka: i % 7 === 3 });
  i++;
}

// Before the routes start: the first runs are the ones that look.
if (keepPage) {
  keepPageOnScreen({
    signal: stateSignal(undefined, {
      id: "list_reload_held_on_an_item_page",
      persists: true,
      type: "object",
    }),
  });
}
const AUTHORS_PAGE = route("");
setupRoutes([AUTHORS_PAGE]);

window.asks = [];
const AUTHOR = resource("author", {
  GET_RANGE: async ({ start, end, around }) => {
    window.asks.push(
      around ? `${start}-${end} around ${around}` : `${start}-${end}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 80));
    return {
      items: AUTHORS.slice(start, end + 1),
      start,
      count: AUTHORS.length,
    };
  },
});

const renderAuthor = (author) => (
  <List.Item paddingX="s" paddingY="xxs">
    <Text>{author.name}</Text>
    <Text>
      {author.aka ? (
        <span>
          also known as
          <br />
          someone else
        </span>
      ) : (
        "-"
      )}
    </Text>
  </List.Item>
);
const renderAuthorSkeleton = () => (
  <List.Item skeleton paddingX="s" paddingY="xxs">
    <Text>…</Text>
  </List.Item>
);

const AuthorsPage = () => {
  const scrollerRef = useRef();
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Box ref={scrollerRef} id="scroller" expandY overflow="auto">
        <List
          id="author_list"
          scroller={scrollerRef}
          itemColumns="14em 14em"
          virtualItemSize={29}
          defaultScrolled={openAt}
          separator
        >
          <List.Item id="authors_header" header paddingX="s" paddingY="xxs">
            <Text bold>Author</Text>
            <Text bold>Also known as</Text>
          </List.Item>
          <List.Items
            count={giveCount ? AUTHORS.length : undefined}
            itemsAction={AUTHOR.GET_RANGE.bindParams({ sort: "name" })}
            renderItem={renderAuthor}
            renderSkeleton={renderAuthorSkeleton}
          />
        </List>
      </Box>
    </div>
  );
};

render(
  <Route route={AUTHORS_PAGE} element={AuthorsPage} />,
  document.getElementById("app"),
);
