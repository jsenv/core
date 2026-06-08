import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { useDisplayedLayoutEffect } from "@jsenv/navi/src/utils/use_displayed_layout_effect.js";

export const ListItemHeaderOrFooterResolver = (props) => {
  const Next = useNextResolver();
  if (props.header) {
    return <ListItemHeader {...props} />;
  }
  if (props.footer) {
    return <ListItemFooter {...props} />;
  }
  return <Next {...props} />;
};

const ListItemHeader = (props) => {
  const Next = useNextResolver();
  const { ref } = props;
  useDisplayedLayoutEffect(
    ref,
    (headerEl) => {
      const listContainerEl = headerEl.closest(".navi_list_container");
      const rect = headerEl.getBoundingClientRect();
      listContainerEl.style.setProperty(
        "--list-header-height",
        `${rect.height}px`,
      );
      listContainerEl.style.setProperty(
        "--list-header-width",
        `${rect.width}px`,
      );
    },
    [],
  );

  return (
    <Next
      {...props}
      role="presentation"
      baseClassName="navi_list_item_header"
    />
  );
};
const ListItemFooter = (props) => {
  const Next = useNextResolver();
  const { ref } = props;
  useDisplayedLayoutEffect(
    ref,
    (footerEl) => {
      const listContainerEl = footerEl.closest(".navi_list_container");
      const rect = footerEl.getBoundingClientRect();
      listContainerEl.style.setProperty(
        "--list-footer-height",
        `${rect.height}px`,
      );
      listContainerEl.style.setProperty(
        "--list-footer-width",
        `${rect.width}px`,
      );
    },
    [],
  );

  return (
    <Next
      {...props}
      role="presentation"
      baseClassName="navi_list_item_footer"
    />
  );
};
