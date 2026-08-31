// The .navi_input box, in a module of its own: a page may render a Textarea or
// a Select without any Input, so none of them can rely on another having run.
const inputCss = /* css */ `
  @layer navi {
    .navi_input {
      --border-radius: var(--navi-control-border-radius);
      --border-width: var(--navi-control-border-width);
      /* Focus outline */
      --outline-width: var(--navi-focus-outline-width);
      --outline-offset: calc(-0.5 * var(--outline-width));
      --outline-color: var(--navi-focus-outline-color);
      /* Focus outline end */
      --font-size: var(--navi-control-font-size);
      --font-family: var(--navi-control-font-family);
      --loader-color: var(--navi-loader-color);
      --border-color: var(--navi-control-border-color);
      --background-color: var(--navi-surface-color);
      --color: currentColor;
      --color-dimmed: color-mix(in srgb, currentColor 60%, transparent);
      --placeholder-color: var(--navi-placeholder-color);
      --placeholder-font-style: var(--navi-placeholder-font-style);
      /* Hover */
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --background-color-hover: color-mix(
        in srgb,
        var(--background-color) 95%,
        black
      );
      --color-hover: var(--color);
      /* Active */
      --border-color-active: color-mix(in srgb, var(--border-color) 90%, black);
      /* Focus */
      --border-color-focus: var(--border-color);
      --background-color-focus: var(--background-color);
      /* Readonly */
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 45%,
        transparent
      );
      --background-color-readonly: var(--background-color-hover);
      --color-readonly: color-mix(in srgb, var(--color) 65%, transparent);
      /* Disabled */
      --border-color-disabled: var(--border-color-readonly);
      --background-color-disabled: color-mix(
        in srgb,
        var(--background-color) 95%,
        grey
      );
      --color-disabled: var(--color-dimmed);
    }
  }

  .navi_input {
    --x-border-color: var(--border-color);
    --x-background-color: var(--background-color);
    --x-color: var(--color);
    --x-placeholder-color: var(--placeholder-color);
    --x-placeholder-font-style: var(--placeholder-font-style);
    --x-padding-top: var(
      --padding-top,
      var(--padding-y, var(--padding, var(--navi-control-padding-y-default)))
    );
    --x-padding-right: var(
      --padding-right,
      var(--padding-x, var(--padding, var(--navi-control-padding-x-default)))
    );
    --x-padding-bottom: var(
      --padding-bottom,
      var(--padding-y, var(--padding, var(--navi-control-padding-y-default)))
    );
    --x-padding-left: var(
      --padding-left,
      var(--padding-x, var(--padding, var(--navi-control-padding-x-default)))
    );

    position: relative;
    display: inline-flex;
    box-sizing: border-box;
    width: fit-content;
    height: fit-content;
    padding-top: var(--x-padding-top);
    padding-bottom: var(--x-padding-bottom);
    flex-direction: row;
    color: var(--x-color);
    font-size: var(--font-size);
    font-family: var(--font-family);
    text-align: initial;
    /* On the root, not only on the field: what sits beside the field — a unit
       slot, a prefix, an icon — is text of the same box and has to land on
       the same row as what is typed. A slot left on the page's line would sit
       a fraction of a pixel away from the field's own, and read as misaligned
       ("+33" next to a number). The field repeats it below because a form
       control does not inherit it. */
    line-height: var(--navi-control-line-height);
    background-color: var(--x-background-color);
    border-width: var(--border-width);
    border-style: solid;
    border-color: var(--x-border-color);
    /* Squared from the outside, corner by corner: an input is not always the
       member a Group joins — it can arrive wrapped (in a Box carrying a state,
       in a tooltip) — so the ask travels down as inherited custom properties
       rather than as a radius landing on this element. Each corner falls back
       to the input's own radius when nothing asks for anything. */
    border-top-left-radius: var(
      --x-corner-top-left-radius,
      var(--border-radius)
    );
    border-top-right-radius: var(
      --x-corner-top-right-radius,
      var(--border-radius)
    );
    border-bottom-right-radius: var(
      --x-corner-bottom-right-radius,
      var(--border-radius)
    );
    border-bottom-left-radius: var(
      --x-corner-bottom-left-radius,
      var(--border-radius)
    );
    outline-width: var(--outline-width);
    outline-color: var(--outline-color);
    outline-offset: var(--outline-offset);
    cursor: inherit;
    pointer-events: auto;

    /* The text of variant="text" is measured with the real thing rather than
       beside it: same padding, same margins, same room — so the two are the
       same box and a field's style can move without one of them staying
       behind. */
    .navi_control_input,
    .navi_input_text {
      box-sizing: content-box;
      min-width: 1ch;
      margin-top: calc(-1 * var(--x-padding-top));
      margin-bottom: calc(-1 * var(--x-padding-bottom));
      padding-top: var(--x-padding-top);
      padding-right: var(--x-padding-right);
      padding-bottom: var(--x-padding-bottom);
      padding-left: var(--x-padding-left);
      flex-grow: 1;
      color: inherit;
      font-size: inherit;
      /* A form control does not inherit the font on its own — the browser has
         one of its own for it, monospace for a <textarea> — so the box's font
         (--navi-control-font-family) is handed down by hand. Its line comes
         from the page's token for the same reason: what is typed must sit on
         the same line as what displays it afterwards, emoji included. */
      font-family: inherit;
      text-align: inherit;
      line-height: var(--navi-control-line-height);
      background: none;
      border: none;
      border-radius: inherit;
      outline: none;

      &::placeholder {
        color: var(--x-placeholder-color);
        font-style: var(--x-placeholder-font-style);
      }
      /* Webkit is putting a slight blue bckground on autofilled input */
      /* For now we override with out custom background color */
      /* Ideally we'll later provide a custom data attribute with ability to see styles when autofilled */
      &:-webkit-autofill {
        -webkit-box-shadow: 0 0 0 1000px var(--x-background-color) inset;
      }
      /* Webkit is putting some nasty styles after automplete that look as follow */
      /* input:-internal-autofill-selected { color: FieldText !important; } */
      /* Fortunately we can override it as follow */
      &:-internal-autofill-selected {
        -webkit-text-fill-color: var(--x-color) !important;
      }

      &[type="search"] {
        -webkit-appearance: textfield;

        &::-webkit-search-cancel-button {
          display: none;
        }
      }
    }

    .navi_input_text {
      /* Nothing to read yet is still a line: the box may not collapse just
         because the value is empty. */
      min-height: 1lh;
    }
    /* The value is cut by a box of its own, and that is the whole reason it
       exists: a field ends its text at the content edge, while an overflow set
       on the padded box would let it run through the padding — the same value
       would then lose a character on one side and not on the other. This box
       IS the content edge, so both stop on the same letter.
       Cut rather than wrapped (a second line would be taller than the field),
       and cut rather than ellipsed (an ellipsis costs a character the field
       does not lose). */
    .navi_input_text_value {
      display: block;
      /* The whole content box, short value or not: a field's text is laid out
         in the full width whatever it holds, so text-align lands in the same
         place on both. */
      width: 100%;
      text-overflow: clip;
      white-space: nowrap;
      overflow: hidden;
    }

    .navi_input_slot {
      /* A corner claimed from the outside (see group.jsx) is the frame's, and
         what lives in here is not the frame — a button in a slot, the content
         of a popup — so the ask stops at this boundary. */
      --x-corner-top-left-radius: initial;
      --x-corner-top-right-radius: initial;
      --x-corner-bottom-right-radius: initial;
      --x-corner-bottom-left-radius: initial;

      margin-right: var(--slot-spacing, calc(2px + 0.1em));
      margin-left: var(--slot-spacing, calc(2px + 0.1em));
      color: #5e4e4e;

      &[data-left] {
        order: -1;
      }
      &[data-right] {
      }

      .navi_button {
        font-size: inherit;
        /* A <button> does not inherit the font on its own — same as the
           <input> above — and what stands in a slot is measured on the line
           box (Icon fillLine is 1lh): left on the browser's own font, the
           clear cross would resolve 1lh against a font the field is not
           written in, and the field would change height the moment the icon
           is replaced by the button. */
        font-family: inherit;

        /* A button in a slot (e.g. the clear cross) is drawn small but must
           not be small to hit: the spacing around it — the slot margins on the
           sides, the input padding above and below — belongs to its clickable
           zone. The visual stays untouched; only the hit area grows. */
        &::before {
          position: absolute;
          top: calc(-1 * var(--x-padding-top));
          right: calc(-1 * var(--slot-spacing, calc(2px + 0.1em)));
          bottom: calc(-1 * var(--x-padding-bottom));
          left: calc(-1 * var(--slot-spacing, calc(2px + 0.1em)));
          content: "";
        }
      }
    }

    /* Hover */
    &[data-hover] {
      --x-background-color: var(--background-color-hover);
      --x-border-color: var(--border-color-hover);
      --x-color: var(--color-hover);
    }
    /* Readonly */
    &[data-readonly] {
      --x-border-color: var(--border-color-readonly);
      --x-background-color: var(--background-color-readonly);
      --x-color: var(--color-readonly);
    }
    /* Focus */
    &[data-focus-visible] {
      --x-background-color: var(--background-color-focus);
      --x-border-color: transparent;
      outline-style: solid;
    }
    /* Disabled */
    &[data-disabled] {
      --x-border-color: var(--border-color-disabled);
      --x-background-color: var(--background-color-disabled);
      --x-color: var(--color-disabled);
    }
    /* Callout (info, warning, error) */
    &[data-callout] {
      --x-border-color: var(--callout-color);
      --x-outline-color: var(--callout-color);
    }

    /* A transparent background is a resting look, not an editing one: while
       the field has focus it turns solid so text is not typed over whatever
       sits behind it. */
    &[data-background-transparent] {
      --background-color-hover: var(--background-color);
      --background-color-focus: var(--navi-surface-color);

      &[data-focus] {
        --x-background-color: var(--background-color-focus);
      }
    }

    &[data-variant="discrete"],
    &[data-variant="discrete-border"] {
      /* An inline backgroundColor prop overrides this default */
      --background-color: transparent;
      --background-color-hover: var(--background-color);
      --background-color-focus: var(--navi-surface-color);

      &[data-focus] {
        --x-background-color: var(--background-color-focus);
      }
      &[data-readonly] {
        --x-background-color: var(--background-color);
      }
      &[data-disabled] {
        --x-background-color: var(--background-color);
      }
      /* With an explicit background color the movement flips: colored at
         rest and on hover, back to transparent while being edited. */
      &[data-background] {
        --background-color-focus: transparent;
      }
    }
    /* The border is part of what makes a field look like a field, so a
       discrete one does without it until it is interacted with — same idea
       as the background above, and the two come back together.
       discrete-border keeps the border: only the background recedes. */
    &[data-variant="discrete"] {
      --border-color: transparent;

      &[data-focus] {
        --x-border-color: color-mix(
          in srgb,
          var(--border-color) 55%,
          transparent
        );
      }
    }

    /* The box of a field, without a field in it: the border is kept and made
       invisible rather than dropped, and the background goes with it, so what
       is left is text sitting exactly where the value would be — swap one for
       the other and nothing on the page moves. */
    &[data-variant="text"] {
      --x-background-color: transparent;
      --x-border-color: transparent;
      cursor: inherit;
    }

    &[data-variant="underline"] {
      border: none;
      border-radius: 0;
      --x-background-color: transparent;
      padding-right: 0;
      padding-left: 0;

      .navi_input_real_input_wrapper {
        position: relative;
        display: inline-flex;
        flex-grow: 1;
      }

      .navi_input_underline {
        position: absolute;
        top: calc(100% - 1px);
        right: var(--x-padding-right);
        left: var(--x-padding-left);
        height: 1px;
        background-color: var(--x-border-color);
        pointer-events: none;
      }

      &[data-hover] {
        --x-background-color: transparent;
      }
      &[data-focus-visible] {
        --x-background-color: transparent;
        outline-style: none;

        .navi_input_underline {
          height: 2px;
          background-color: var(--outline-color);
        }
      }
      &[data-readonly] {
        --x-background-color: transparent;
      }
      &[data-disabled] {
        --x-background-color: transparent;
      }
    }
  }
`;
// Called from the render of every control drawn as a .navi_input box, never at
// module scope: a page without one must not carry this sheet, and a build that
// sees no caller drops the css with the function. Keyed on this module, so the
// three controls share one stylesheet instead of each carrying a copy.
export const installInputCss = () => {
  import.meta.css = inputCss;
};
