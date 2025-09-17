import.meta.css = /* css */ `
  .navi_table_column_resize_handle_right {
    cursor: ew-resize;
    position: absolute;
    z-index: 1;
    right: 0px;
    width: 10px;
    top: 5px;
    bottom: 5px;
    background: red;
    opacity: 0;
  }
  .navi_table_column_resize_handle_right[data-hover] {
    opacity: 1;
  }

  .navi_table_column_resize_handle_left {
    cursor: ew-resize;
    position: absolute;
    z-index: 1;
    left: 0px;
    width: 10px;
    top: 5px;
    bottom: 5px;
    background: red;
    opacity: 0;
  }
  .navi_table_column_resize_handle_left[data-hover] {
    opacity: 1;
  }
`;
