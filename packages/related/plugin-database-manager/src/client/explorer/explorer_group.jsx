import {
  BadgeCount,
  Button,
  Details,
  Text,
  valueInLocalStorage,
} from "@jsenv/navi";
import { effect, signal } from "@preact/signals";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";

import { ExplorerItemList } from "./explorer_item_list.jsx";

export const createExplorerGroupController = (
  id,
  { detailsOpenAtStart, detailsOnToggle },
) => {
  const [restoreHeight, storeHeight] = valueInLocalStorage(
    `explorer_group_${id}_height`,
    {
      type: "positive_number",
    },
  );
  const heightSettingSignal = signal(restoreHeight());
  effect(() => {
    const height = heightSettingSignal.value;
    storeHeight(height);
  });

  const useHeightSetting = () => {
    return heightSettingSignal.value;
  };
  const setHeightSetting = (width) => {
    heightSettingSignal.value = width;
  };

  return {
    id,
    useHeightSetting,
    setHeightSetting,
    detailsOpenAtStart,
    detailsOnToggle,
  };
};

export const ExplorerGroup = (props) => {
  const {
    controller,
    detailsAction,
    idKey,
    nameKey,
    label,
    count,
    renderNewButtonChildren,
    renderItem,
    useItemArrayInStore,
    useRenameItemAction,
    useCreateItemAction,
    useDeleteItemAction,
    useDeleteManyItemAction,
    onOpen,
    onClose,
    resizable,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;

  useLayoutEffect(() => {
    setTimeout(() => {
      ref.current.setAttribute("data-details-toggle-animation", "");
    });
  }, []);

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const startCreatingNew = useCallback(() => {
    setIsCreatingNew(true);
  }, [setIsCreatingNew]);
  const stopCreatingNew = useCallback(
    ({ shouldRestoreFocus }) => {
      if (shouldRestoreFocus) {
        createButtonRef.current.focus();
      }
      setIsCreatingNew(false);
    },
    [setIsCreatingNew],
  );

  const heightSetting = controller.useHeightSetting();
  const createButtonRef = useRef(null);

  return (
    <>
      {resizable && (
        <div
          data-resize-handle={controller.id}
          id={`${controller.id}_resize_handle`}
        ></div>
      )}
      <Details
        {...rest}
        ref={ref}
        id={controller.id}
        open={controller.detailsOpenAtStart}
        focusGroup
        focusGroupDirection="vertical"
        className="explorer_group"
        onUIStateChange={(open) => {
          controller.detailsOnToggle(open);
          if (open) {
            onOpen?.();
          } else {
            onClose?.();
          }
        }}
        data-resize={resizable ? "vertical" : "none"}
        data-min-height="150"
        data-requested-height={heightSetting}
        action={detailsAction}
        label={
          <>
            <Text>
              {label}
              <BadgeCount size="xxs" circle background="gray" color="white">
                {count}
              </BadgeCount>
            </Text>
            {renderNewButtonChildren ? (
              <>
                <span style="display: flex; flex: 1"></span>
                <Button
                  ref={createButtonRef}
                  selfAlignX="end"
                  className="summary_action_icon"
                  width="22"
                  height="22"
                  padding="2"
                  discrete
                  onMouseDown={(e) => {
                    // ensure when input is focused it stays focused
                    // without this preventDefault() the input would be blurred (which might cause creation of an item) and re-opened empty
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    startCreatingNew();
                  }}
                >
                  {renderNewButtonChildren()}
                </Button>
              </>
            ) : null}
          </>
        }
      >
        {(itemArray) => {
          return (
            <div className="explorer_group_content">
              <ExplorerItemList
                idKey={idKey}
                nameKey={nameKey}
                itemArray={itemArray}
                renderItem={renderItem}
                useItemArrayInStore={useItemArrayInStore}
                useRenameItemAction={useRenameItemAction}
                useCreateItemAction={useCreateItemAction}
                useDeleteItemAction={useDeleteItemAction}
                useDeleteManyItemAction={useDeleteManyItemAction}
                isCreatingNew={isCreatingNew}
                stopCreatingNew={stopCreatingNew}
              />
            </div>
          );
        }}
      </Details>
    </>
  );
};
