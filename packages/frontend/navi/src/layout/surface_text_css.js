/**
 * Typography reset shared by the surfaces a control opens: callout, popover,
 * dialog.
 *
 * A surface is painted on top of the page but lives in the DOM subtree of the
 * element it opens from, so every inherited text property of that element
 * reaches it. The ink an element chose for its own background — centered,
 * shadowed, uppercase, letter-spaced, kept on one line — arrives on paper that
 * has none of that background, and the caller discovers it as a symptom
 * (a blurred tooltip, a centered message) with nothing on screen pointing back
 * to the rule three elements up. A surface writes its own text, on its own
 * paper, in the document's terms.
 *
 * Every one of them is set to its initial value rather than `revert`: only
 * `color` and `background-color` are declared by the UA on a `[popover]`/
 * `<dialog>`, so `revert` on any of these would roll back to the inherited
 * value — the very thing to stop. `text-align: initial` is `start`, which
 * still reads the surface's own `direction`, so an RTL document keeps its
 * side.
 *
 * `font-family` is deliberately absent: a surface keeps the face of what
 * opened it, so a section written in a display font gets its tooltips in that
 * font. `color`, `font-size` and `font-weight` are absent too — each surface
 * answers those its own way (a popup writes in --navi-popup-color and follows
 * the size of what opened it; a callout reverts to the document's ink and
 * size).
 *
 * In `@layer navi` so an app that wants one of these back says so on the
 * surface and wins, without having to out-specify anything.
 */
export const surfaceTextCss = /* css */ `
  @layer navi {
    .navi_callout,
    .navi_popover,
    .navi_dialog {
      font-style: initial;
      text-align: initial;
      text-indent: initial;
      text-transform: initial;
      text-shadow: none;
      white-space: initial;
      word-spacing: initial;
      letter-spacing: initial;
    }
  }
`;
