/**
 * https://www.w3schools.com/charsets/ref_utf_box.asp
 */

export const borderCharsetLight = {
  left: "│",
  right: "│",
  top: "─",
  bottom: "─",
  half_left: "╴",
  half_right: "╶",
  half_up: "╵",
  half_down: "╷",
  top_left: "┌",
  top_right: "┐",
  bottom_left: "└",
  bottom_right: "┘",
  mid_top: "┬",
  mid_bottom: "┴",
  mid_left: "├",
  mid_right: "┤",
  mid: "┼",
};
export const borderCharsetHeavy = {
  left: "┃",
  right: "┃",
  top: "━",
  bottom: "━",
  half_left: "╸",
  half_right: "╺",
  half_up: "╹",
  half_down: "╻",
  top_left: "┏",
  top_right: "┓",
  bottom_left: "┗",
  bottom_right: "┛",
  mid_top: "┳",
  mid_bottom: "┻",
  mid_left: "┣",
  mid_right: "┫",
  mid: "╋",
};
export const borderCharsetDouble = {
  left: "║",
  right: "║",
  top: "═",
  bottom: "═",
  half_left: "╴",
  half_right: "╶",
  half_up: "╵",
  half_down: "╷",
  top_left: "╔",
  top_right: "╗",
  bottom_left: "╚",
  bottom_right: "╝",
  mid_top: "╦",
  mid_bottom: "╩",
  mid_left: "╠",
  mid_right: "╣",
  mid: "╬",
};
export const borderCharsetMixLightAndHeavy = {
  bottom_right: {
    bottom_light_right_heavy: "┙",
    bottom_heavy_right_light: "┚",
  },
};
export const borderCharsetMixDoubleAndSingle = {
  top_right: {
    top_double_right_single: "╕",
    top_single_right_double: "╖",
  },
};

// et aussi on a un peu de rounded avec ╭──
// (mais pour que ce soit joli on peut le mettre que dans les coins sans jonctions)
// on mettra une prop rounded dans l'esprit de bold
