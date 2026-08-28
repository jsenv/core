import "./src/navi_css_vars.js";
import "./src/navi_z_indexes.js";
// The element the URL designates — the one whose id is the hash — shows itself
// when it renders, which in an app is long after the browser stopped caring.
// Imported for its effect: neither the element nor the page has to opt in.
import "./src/nav/url_target/url_target.js";

// actions
export { ActionRenderer } from "./src/action/action_renderer.jsx";
export { actionRunEffect } from "./src/action/action_run_effect.js";
export {
  createAction,
  rerunActions,
  updateActions,
} from "./src/action/actions.js";
// How a callback reads what caused it. Every event navi dispatches carries the
// one it came from, and findEvent walks that chain back: which interaction asked
// for an action (`findEvent(event, "swipe_left")`, see
// src/control/interaction/interactions.js), or whether the state change a
// uiAction reports is a gesture at all (`findEvent(event,
// "navi_clear_ui_state")` — the clear cross was pressed).
export { findEvent } from "@jsenv/dom";
// …and how code registers an interaction navi does not know: the door navi's own
// swipes, holds and shortcuts come through.
export { defineInteractionDetector } from "./src/control/interaction/interactions.js";
export { useActionStatus } from "./src/action/use_action_status.js";
export { useRunOnMount } from "./src/action/use_run_on_mount.js";

// for debug/testing purposes
export { enableDebugActions } from "./src/action/actions.js";
export { NaviDebug } from "./src/navi_debug.jsx";

// state management
export {
  compareTwoDurations,
  durationContainsNaN,
  durationToHours,
  durationToISOString,
  durationToMinutes,
  durationToNumber,
  durationToSeconds,
  durationToString,
  parseDuration,
} from "@jsenv/validity";
export {
  arraySignalMembership,
  useArraySignalMembership,
} from "./src/state/array_signal_membership.js";
export { localStorageSignal } from "./src/state/local_storage_signal.js";
export {
  resource,
  syncOwnedResourceToSignals,
  syncResourceToSignals,
} from "./src/state/rest/resource_graph.js";
export { stateSignal } from "./src/state/state_signal.js";
export { useSignalSync } from "./src/state/use_signal_sync.js";
export { useStateArray } from "./src/state/use_state_array.js";
export { valueInLocalStorage } from "./src/state/value_in_local_storage.js";
export { compareTwoJsValues } from "./src/utils/compare_two_js_values.js";
// state fetching
export {
  ErrorBoundary,
  Loading,
  useAsyncData,
} from "./src/state/async/use_async_data.jsx";
// What an error boundary of your own must do to an error it displays — see
// docs/error_handling.md, "writing your own boundary".
export {
  errorIsDisplayed,
  markErrorAsDisplayedBy,
} from "./src/action/action_error_report.js";
export { createRequestCanceller } from "./src/state/request_canceller.js";
export { useCancelPrevious } from "./src/state/use_cancel_previous.js";
export {
  moveArrayItemByIndex,
  swapArrayItemByIndex,
} from "./src/utils/array_move.js";

// Box
export { Box } from "./src/box/box.jsx";

// Transition
export { ensureDocumentStartViewTransition } from "./src/transition/start_view_transition_polyfill.js";
export { UITransition } from "./src/transition/ui_transition.jsx";

// Navigation/routing
export {
  navBack,
  navForward,
  navIntegratedVia,
  navTo,
  reload,
  stopLoad,
  useNavState,
} from "./src/nav/browser_integration/browser_integration.js";
export {
  canNavBackSignal,
  canNavForwardSignal,
  useCanNavBack,
  useCanNavForward,
} from "./src/nav/browser_integration/document_back_and_forward.js";
export { useDocumentState } from "./src/nav/browser_integration/document_state_signal.js";
export {
  useDocumentResource,
  useDocumentUrl,
} from "./src/nav/browser_integration/document_url_signal.js";
export { useUrlSearchParam } from "./src/nav/browser_integration/use_url_search_param.js";
export { Head } from "./src/nav/head.jsx";
export { route, setupRoutes, useRouteStatus } from "./src/nav/route.js";
export { Route } from "./src/nav/route.jsx";
export {
  RouteTransitionArea,
  defineRouteDefaultTransition,
  defineRouteTransition,
} from "./src/nav/route_transition.jsx";
export { RouteTravel } from "./src/nav/route_travel.jsx";
export { anyMatchingRouteSignal, routeAction } from "./src/nav/route_action.js";
export { rawUrlPart, setBaseUrl } from "./src/nav/route_pattern.js";
export {
  setUrlTargetOptions,
  useUrlTargetId,
} from "./src/nav/url_target/url_target.js";
// Navigation/components
export { Link } from "./src/nav/link/link.jsx";
export { Nav } from "./src/nav/link/nav.jsx";
export { Binder } from "./src/nav/binder/binder.jsx";
export { FixedBar } from "./src/layout/fixed_bar/fixed_bar.jsx";
// debug/tests
export { enableDebugOnDocumentLoading } from "./src/nav/browser_integration/document_loading_signal.js";
export { detectHorizontalOverflow } from "./src/layout/detect_horizontal_overflow.js";

// Commands
// The JS counterpart of the `command`/`commandfor` attributes, for when what
// triggers a command is not a click on an element that could carry them: a
// gesture, a keyboard shortcut, a server answer, an observer. It resolves the
// target and dispatches exactly like the attribute path, so a popup driven this
// way stays uncontrolled and keeps its own say over closing.
export { triggerNaviCommand } from "./src/control/commands.js";

// Details (in between navigation/interaction and fields)
export { Details } from "./src/control/details/details.jsx";
export { SummaryMarker } from "./src/control/details/summary_marker.jsx";
export { Expandable } from "./src/control/expandable/expandable.jsx";

// Form
// Validation
export { openCallout } from "./src/control/rules/callout/callout.js";
export { CalloutStatusIcon } from "./src/control/rules/callout/callout_status_icon.jsx";
export {
  useCalloutElement,
  useCalloutRequestClose,
} from "./src/control/rules/callout/callout.jsx";
export { registerGlobalConstraint } from "./src/control/rules/control_validation.js";
export { constraintFromValidityRule } from "./src/control/rules/validity_bridge.js";
export { useConstraintValidityState } from "./src/control/rules/hooks/use_constraint_validity_state.js";
export { createAvailableConstraint } from "./src/control/rules/validation/create_available_constraint.js";
// Selection
export {
  SelectionContext,
  createSelectionKeyboardShortcuts,
  useSelectableElement,
  useSelectionController,
} from "./src/control/selection/selection.jsx";
// Form/Components
export { ControlGroup } from "./src/control/control_group.jsx";
export {
  Editable,
  useEditionController,
} from "./src/control/edition/editable.jsx";
export { Field, Label } from "./src/control/field.jsx";
export { Form } from "./src/control/form.jsx";
export { Group } from "./src/control/group.jsx";
export {
  DaySpin,
  NumberSpin,
  Spin,
  SpinGroup,
} from "./src/control/picker/picker_spin.jsx";
export {
  TimeRangeSpin,
  TimeSpin,
} from "./src/control/picker/preset/spin_time.jsx";
export { Button } from "./src/control/input/button.jsx";
export { CheckboxGroup } from "./src/control/input/checkbox_group.jsx";
export { Input } from "./src/control/input/input.jsx";
export { Textarea, TextareaCharCount } from "./src/control/input/textarea.jsx";
export { InputDuration } from "./src/control/input/input_duration.jsx";
export { useInputGroup } from "./src/control/input/use_input_group.js";
export { RadioGroup } from "./src/control/input/radio_group.jsx";
export { Select } from "./src/control/input/select.jsx";
export { SplitButton } from "./src/control/input/split_button.jsx";
export { Picker } from "./src/control/picker/picker.jsx";
export {
  getNowHours,
  getNowHoursRoundedToStep,
  isToday,
} from "./src/control/picker/time_helpers.js";
// --- List start ---
export { applySearch } from "./src/control/list/apply_search.js";
export { createSearch } from "./src/control/list/create_search.js";
export {
  List,
  ListItem,
  ListItemGroup,
  ListItems,
} from "./src/control/list/list.jsx";
export { SelectableInput } from "./src/control/list/list_selectable.jsx";
export { useSearchText } from "./src/control/list/use_search_text.js";
// --- List end ---
export { Wheel, WheelGroup, WheelItem } from "./src/control/wheel/wheel.jsx";
export { TimeRangeWheel, TimeWheel } from "./src/control/wheel/wheel_time.jsx";
// --- Table start---
export {
  filterTableSelection,
  isCellSelected,
  isColumnSelected,
  isRowSelected,
  stringifyTableSelectionValue,
} from "./src/control/table/selection/table_selection.js";
export {
  Col,
  Colgroup,
  RowNumberCol,
  RowNumberTableCell,
  Table,
  TableCell,
  Tbody,
  Thead,
  Tr,
} from "./src/control/table/table.jsx";
export { useCellGridFromRows } from "./src/control/table/use_cell_grid_from_rows.js";
export { useOrderedColumns } from "./src/control/table/use_ordered_columns.js";
// --- Table end ---

// Components
export { ErrorBoundaryContext } from "./src/error_boundary_context.js";
export { ActiveKeyboardShortcuts } from "./src/keyboard/active_keyboard_shortcuts.jsx";

// Text
export { contrastColor } from "@jsenv/dom";
export { ButtonCopyToClipboard } from "./src/control/input/button_copy_to_clipboard.jsx";
export { Address } from "./src/text/address.jsx";
export { Badge } from "./src/text/badge.jsx";
export { BadgeCount } from "./src/text/badge_count.jsx";
export { BadgeList } from "./src/text/badge_list.jsx";
export { Caption } from "./src/text/caption.jsx";
export { Code } from "./src/text/code.jsx";
export { Color } from "./src/text/color.jsx";
export { createI18n } from "./src/text/i18n.js";
export { formatNumber } from "./src/text/format_number.js";
export {
  formatDatetime,
  formatDay,
  formatDayRelative,
  formatMonth,
  formatTime,
  formatTimeRelative,
} from "./src/text/format_time.js";
export { Icon } from "./src/text/text.jsx";
export { Interpolate } from "./src/text/interpolate.jsx";
export { interpolateText } from "./src/text/interpolate_text.js";
export {
  languagesSignal,
  setPreferredLanguage,
  setSupportedLanguages,
} from "./src/text/lang_signal.js";
export { MessageBox } from "./src/text/message_box.jsx";
export { Meter } from "./src/text/meter.jsx";
export { naviI18n } from "./src/text/navi_i18n.js";
export { Paragraph } from "./src/text/paragraph.jsx";
export { Quantity } from "./src/text/quantity.jsx";
export { Text } from "./src/text/text.jsx";
export { TextBox } from "./src/text/text_box.jsx";
export { Time } from "./src/text/time.jsx";
export { Title, useTitleLevel } from "./src/text/title.jsx";
export { Unit } from "./src/text/unit.jsx";

// Graphics
export { Image } from "./src/graphic/image.jsx";
export { LoadingDotsSvg } from "./src/graphic/loading/loading_dots_svg.jsx";
export { LoadingIndicator } from "./src/graphic/loading/loading_indicator.jsx";
export { LoadingIndicatorFluid } from "./src/graphic/loading/loading_indicator_fluid.jsx";
export { LoadingOutline } from "./src/graphic/loading/loading_outline.jsx";
export { Svg } from "./src/graphic/svg.jsx";
export { SVGMaskOverlay } from "./src/graphic/svg_mask_overlay.jsx";

// Layout
export { CardLayout } from "./src/layout/card_layout.jsx";
export { Separator } from "./src/layout/separator.jsx";
export {
  Slide,
  SlideContainer,
  useSlideValue,
} from "./src/layout/slide_container.jsx";
export { Step, StepList } from "./src/layout/step_list.jsx";
export { ViewportLayout } from "./src/layout/viewport_layout.jsx";
export { useDisplayedLayoutEffect } from "./src/utils/use_displayed_layout_effect.js";

// Popup (popover, dialog, tooltip, side panel ...)
export { Dialog } from "./src/layout/dialog.jsx";

export { Popover } from "./src/layout/popover.jsx";
export { Popup } from "./src/layout/popup.jsx";
export { usePopupMode } from "./src/layout/popup_mode.jsx";
export { SidePanel } from "./src/layout/side_panel.jsx";
export { createSlot } from "./src/layout/slot.jsx";

// Scroll
export {
  isScrolling,
  scrollActivitySignal,
} from "./src/utils/scroll_activity.js";

// Responsivness
export {
  windowWidthSignal,
  coarsePointerSignal,
  smallTouchScreenSignal,
} from "./src/layout/responsive.js";
// The way back out of the on-screen keyboard overlaying the app, which navi
// turns on by default wherever the browser has the VirtualKeyboard API at all
// (navi_css_vars.js) — for an app whose own layout was built around the
// viewport shrinking instead. See virtual_keyboard.js in @jsenv/dom for the
// whole deal, and safe_area.js's own --navi-keyboard-inset-bottom for what
// navi does with the geometry. A no-op on Firefox/Safari, which never
// overlaid anything in the first place.
export { disableVirtualKeyboardOverlay } from "./src/layout/virtual_keyboard.js";

// Focus helpers
export { useFocusGroup } from "./src/utils/focus/use_focus_group.js";

// Interactions
export { startDragTo } from "@jsenv/dom";
// The escape hatch for a window-capture click listener that may run before the
// gesture click suppressor and must stand aside on its own. A last resort —
// see its JSDoc in @jsenv/dom (click_suppression.js) for the one situation
// that justifies it. Re-exported so that situation does not cost an app a
// direct dependency on @jsenv/dom.
export { clickIsSuppressed } from "@jsenv/dom";

// Other
export { useDependenciesDiff } from "./src/utils/use_dependencies_diff.js";

// Keyboard
export { useKeyboardShortcuts } from "./src/keyboard/keyboard_shortcuts.js";

// More graphic stuff
export { CheckSvg } from "./src/graphic/icons/check_svg.jsx";
export { CloseSvg } from "./src/graphic/icons/close_svg.jsx";
export { ConstructionSvg } from "./src/graphic/icons/construction_svg.jsx";
export { ExclamationSvg } from "./src/graphic/icons/exclamation_svg.jsx";
export { InfoSvg } from "./src/graphic/icons/info_svg.jsx";
export { EyeClosedSvg } from "./src/graphic/icons/eye_closed_svg.jsx";
export { EyeSvg } from "./src/graphic/icons/eye_svg.jsx";
export { HeartSvg } from "./src/graphic/icons/heart_svg.jsx";
export { HomeSvg } from "./src/graphic/icons/home_svg.jsx";
export {
  LinkAnchorSvg,
  LinkBlankTargetSvg,
  LinkCurrentSvg,
} from "./src/graphic/icons/link_svgs.jsx";
export { SearchSvg } from "./src/graphic/icons/search_svg.jsx";
export { SettingsSvg } from "./src/graphic/icons/settings_svg.jsx";
export { StarSvg } from "./src/graphic/icons/star_svg.jsx";
export { UserSvg } from "./src/graphic/icons/user_svg.jsx";
