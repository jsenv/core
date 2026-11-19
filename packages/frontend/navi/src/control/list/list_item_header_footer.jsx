import {
  renderResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { useDisplayedLayoutEffect } from "@jsenv/navi/src/utils/use_displayed_layout_effect.js";
import { useLayoutEffect } from "preact/hooks";

export const ListItemHeaderOrFooterResolver = (props) => {
  const Next = useNextResolver();
  if (props.header) {
    return renderResolver(ListItemHeader, props);
  }
  if (props.footer) {
    return renderResolver(ListItemFooter, props);
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
  useSizeForgottenAtUnmount(ref, "--list-header-height", "--list-header-width");

  return (
    <Next
      {...props}
      header={undefined}
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
  useSizeForgottenAtUnmount(ref, "--list-footer-height", "--list-footer-width");

  return (
    <Next
      {...props}
      footer={undefined}
      role="presentation"
      baseClassName="navi_list_item_footer"
    />
  );
};

// The room the part took, which the items keep free for it (their
// scroll-margin): given back when the part goes. The list it was measured in is
// taken at mount, since a ref is null by the time the cleanup runs.
const useSizeForgottenAtUnmount = (ref, heightProperty, widthProperty) => {
  useLayoutEffect(() => {
    const listContainerEl = ref.current?.closest(".navi_list_container");
    return () => {
      if (!listContainerEl) {
        return;
      }
      listContainerEl.style.removeProperty(heightProperty);
      listContainerEl.style.removeProperty(widthProperty);
    };
  }, []);
};
