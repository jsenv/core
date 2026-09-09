/**
 * A page is `{ route, params }`, never the route alone: a section of a page is
 * as often a PARAM as it is a route of its own, and three branches of the same
 * route told apart by their params are three pages one walks between.
 * `params` is undefined for a page that is a route on its own.
 *
 * Whether such a page is the one on screen is asked from three places — the
 * row a <RouteTravel> walks, the relations a movement is written between, and
 * the fallback naming the pages it is the absence of — and they must all get
 * the same answer, which is why the reading lives here rather than next to any
 * one of them.
 */

// `matchesParams` reads paramsSignal, so a caller reading this during a render
// is subscribed to the param changes that walk from one tab to the next —
// matchingSignal alone never moves there, and a row whose tabs are params of
// one route would never re-render.
//
// The params are read only for a route that matches, and that is not a signal
// left unread: a reader wakes on anything it read last time, so what matters is
// that everything able to make this answer change is among them.
// matchingSignal is read whatever happens, and it is a NECESSARY condition —
// while it is false no param of that route can put this page on screen, and the
// day one could, matchingSignal itself has to turn true to say so, which is the
// read that brings the params back in. (Asking anyway would be worse than
// useless: the params of a route that does not match are not params.)
export const pageIsCurrent = ({ route, params }) => {
  if (!route.matchingSignal.value) {
    return false;
  }
  return params ? route.matchesParams(params) : true;
};
