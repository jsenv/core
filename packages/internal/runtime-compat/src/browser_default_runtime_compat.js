// The floor a browser project targets when it says nothing: high enough that
// the css jsenv and its components write is shipped as written — nesting,
// light-dark(), and the module features that keep <script type="module">,
// importmap and top-level await intact. light-dark() is the last gate to
// close, and Safari 17.5 is where it does, so it sets the line; the other
// runtimes are their releases of that same moment.
//
// Raising it further is a matter of moving that line, not of adding runtimes:
// a project needing a lower one declares "browserslist" in its package.json or
// passes runtimeCompat, and both dev and build read it.
export const browserDefaultRuntimeCompat = {
  chrome: "125",
  edge: "125",
  firefox: "126",
  ios_safari: "17.5",
  opera: "110",
  safari: "17.5",
  samsung: "25",
};
