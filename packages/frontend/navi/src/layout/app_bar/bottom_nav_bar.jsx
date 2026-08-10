/**
 * The bar at the bottom of a mobile app: a handful of destinations, one of
 * them possibly the app's main gesture, always reachable.
 *
 * Three things it does that are easy to get wrong on your own:
 *
 * 1. `position: fixed`, never sticky. A sticky element sticks to its nearest
 *    scrolling ancestor, and an app shell almost always has one (an `overflow`
 *    somewhere for horizontal content) — the bar would then stick inside that
 *    box and never to the viewport. Fixed, centered and bounded by
 *    `--navi-app-max-width`, it stays lined up with the content on a wide
 *    screen too.
 * 2. It gives its space back. Being fixed it covers the content, so it
 *    publishes what it takes — see app_bar_space.js.
 * 3. It goes under the home indicator. `env(safe-area-inset-bottom)` lifts the
 *    content while the background keeps running to the edge of the screen.
 *    Note that env() is 0 unless the page asks for it:
 *    `<meta name="viewport" content="..., viewport-fit=cover">`.
 */

import { useLayoutEffect } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { Link } from "../../nav/link/link.jsx";
import { Icon } from "../../text/icon.jsx";
import { Text } from "../../text/text.jsx";
import { APP_BAR_SPACE_CSS, setAppBarSpace } from "./app_bar_space.js";

const css = /* css */ `
  @layer navi {
    :root {
      --navi-bottom-nav-bar-height: 64px;
      --navi-app-max-width: none;
      --navi-app-bar-background: var(--navi-surface-color);
      --navi-app-bar-border-color: var(--navi-separator-color-default);
      --navi-bottom-nav-bar-color: var(--navi-color-secondary);
      --navi-bottom-nav-bar-color-current: var(--navi-accent-color);
    }
  }

  ${APP_BAR_SPACE_CSS}

  .navi_bottom_nav_bar {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 1;
    display: flex;
    /* content-box against an app that is border-box everywhere else: the
       height stays the bare variable and the safe-area padding adds OUTSIDE
       it, so the total is exactly what app_bar_space.js reserves — no
       calc(var + env) written twice. */
    box-sizing: content-box;
    width: 100%;
    max-width: var(--navi-app-max-width);
    height: var(--navi-bottom-nav-bar-height);
    margin: 0 auto;
    padding-bottom: env(safe-area-inset-bottom);
    align-items: stretch;
    background: var(--navi-app-bar-background);
    /* A box-shadow, not a border-top: in content-box a border would add to the
       total and put the reserve off by its width. */
    box-shadow: 0 -1px 0 var(--navi-app-bar-border-color);
  }

  .navi_bottom_nav_bar_item {
    display: flex;
    min-width: 0;
    flex: 1 1 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--navi-xxs);
    color: var(--navi-bottom-nav-bar-color);
    text-decoration: none;

    &[data-href-current] {
      color: var(--navi-bottom-nav-bar-color-current);
    }
  }

  /* The app's main gesture, raised out of the row in a filled pill. */
  .navi_bottom_nav_bar_cta {
    display: flex;
    width: 32px;
    height: 32px;
    margin-top: -4px;
    align-items: center;
    justify-content: center;
    color: var(--navi-app-bar-background);
    background: var(--navi-bottom-nav-bar-color-current);
    border-radius: 50%;
  }
`;

/**
 * @type {import("preact").FunctionComponent<{
 *   height?: string,
 *   maxWidth?: string,
 * }>}
 * @param {import("preact").ComponentChildren} props.children -
 *   `BottomNavBar.Item`s and at most one `BottomNavBar.CTAItem`.
 */
export const BottomNavBar = ({ children, ...props }) => {
  import.meta.css = css;

  useLayoutEffect(() => {
    return setAppBarSpace(
      "bottom-nav-bar",
      "calc(var(--navi-bottom-nav-bar-height) + env(safe-area-inset-bottom))",
    );
  }, []);

  return (
    <Box as="nav" baseClassName="navi_bottom_nav_bar" {...props}>
      {children}
    </Box>
  );
};

/**
 * @param {import("../../nav/route.js").Route} [props.route] - Where it goes,
 *   and — unless `active` says otherwise — what makes it the current one.
 * @param {boolean} [props.active] - Forces the current state, for an entry
 *   whose section spans several routes (a parent route matching its children).
 * @param {import("preact").ComponentChildren} [props.icon]
 * @param {import("preact").ComponentChildren} [props.label]
 *
 * Every other prop goes to the `Link` it renders.
 */
const BottomNavBarItem = ({ icon, label, active, ...props }) => {
  return (
    <Link
      baseClassName="navi_bottom_nav_bar_item"
      current={active}
      underline={false}
      hrefFallback={false}
      {...props}
    >
      {icon && <Icon size="l">{icon}</Icon>}
      {label && <Text size="xs">{label}</Text>}
    </Link>
  );
};
BottomNavBar.Item = BottomNavBarItem;

/**
 * The same entry, drawn as the filled pill a mobile bar puts in the middle for
 * the one thing the app is for.
 */
const BottomNavBarCTAItem = ({ icon, label, active, ...props }) => {
  return (
    <Link
      baseClassName="navi_bottom_nav_bar_item"
      current={active}
      underline={false}
      hrefFallback={false}
      {...props}
    >
      <span className="navi_bottom_nav_bar_cta">
        <Icon size="l">{icon}</Icon>
      </span>
      {label && <Text size="xs">{label}</Text>}
    </Link>
  );
};
BottomNavBar.CTAItem = BottomNavBarCTAItem;
