/**
 * X-Axis Coordinate Systems in Web Development
 *
 * Diagram showing horizontal positioning and scrollbars:
 *
 *    0
 * ┼──┼─────────────────────────────────────────────────────────────────────────┐
 * │  │ DOCUMENT                                              │
 * │  │                                                                         │
 * │  │                                                                     │
 * │  │     ┼───────────────────────────────────────────────┐                   │
 * │  │     │ VIEWPORT                    │                   │
 * │  │     │                                               │                   │
 * │  │     │       350                                     │                   │
 * │  │     │       ┼─────────────────────────────┐         │                   │
 * │  │     │       │ SCROLL CONTAINER            │         │                   │
 * │  │     │       │                             │         │                   │
 * │  │     │       │     200                     │         │                   │
 * │  │     │       │     ┼─────┐                 │         │                   │
 * │  │     │       │     │ EL  │                 │         │                   │
 * │  │     │       │     └─────┘                 │         │                   │
 * │  │     │       │                             │         │                   │
 * │  │     │       │     ┌─────────────────────┐ │         │                   │
 * │  │     │       │     │░░░░███░░░░░░░░░░░░░░│ │         │
 * │  │     │       │     └─────┬───────────────┘ │         │                   │
 * │  │     │       └───────────│─────────────────┘         │                   │
 * │  │     │                   │                           │                   │
 * │  │     │       ┌───────────┴───────────────────────┐   │                   │
 * │  │     │       │░░░░░░░███░░░░░░░░░░░░░░░░░░░░░░░░░│   │
 * │  │     │       └───────────┬───────────────────────┘   │                   │
 * │  │     └───────────────────│───────────────────────────┘                   │
 * │  │                         │                                               │
 * └──┼─────────────────────────┼───────────────────────────────────────────────┘
 *    │                         │
 *    │                         └─ container.scrollLeft: 150px
 *    └─ document.scrollLeft: 100px
 *
 * SCROLLBARS VISUAL REPRESENTATION:
 * • Container scrollbar: ░░░░███░░░░░░░░░░░░░░ (thumb at ~25% position = 150px scroll)
 * • Document scrollbar:  ░░░░░░░███░░░░░░░░░░░░░░░░░░░░░░░░░ (thumb at ~20% position = 100px scroll)
 *
 * X-COORDINATE CALCULATIONS:
 *
 * VIEWPORT COORDINATES (getBoundingClientRect().left):
 * • Result: 650
 * • Calculation: container_left + element_left
 *                     250       +     200     = 450
 *   Wait, that's wrong. Let me recalculate...
 *   Actually: viewport_start + container_left + element_left
 *                    100      +      250      +     200      = 550
 *   But viewport coordinates are relative to viewport, so:
 *   container_left + element_left = 250 + 200 = 450
 *
 * DOCUMENT COORDINATES (absolute position in full document):
 * • Result: 750
 * • Calculation: viewport_left + document_scroll_left
 *                     450       +        100        = 550
 *   Wait, viewport coordinates don't include document scroll.
 *   Correct: document_start + viewport_start + container_left + element_left
 *                   0        +      100       +      250      +     200     = 550
 *
 * CONTAINER SCROLL COORDINATES (position within scrollable content):
 * • Result: 50
 * • Calculation: element_left - container_scroll_left
 *                     200      -        150         = 50
 *
 * SCROLL BEHAVIOR EXAMPLES:
 *
 * WHEN DOCUMENT SCROLLS (scrollLeft: 100 → 200):
 * • Viewport left: 450 → 450 (unchanged)
 *   - Reason: getBoundingClientRect() is relative to viewport, not document
 * • Document left: 550 → 650
 *   - Calculation: viewport_left + new_document_scroll
 *                       450       +        200        = 650
 * • Container scroll left: 50 → 50 (unchanged)
 *   - Reason: Container scrolling is independent of document scrolling
 *
 * WHEN CONTAINER SCROLLS (scrollLeft: 150 → 300):
 * • Viewport left: 450 → 300
 *   - Calculation: container_left + (element_left - additional_scroll)
 *                       250       + (     200      -       150     ) = 300
 * • Document left: 550 → 400
 *   - Calculation: new_viewport_left + document_scroll_left
 *                        300         +        100         = 400
 * • Container scroll left: 50 → -100
 *   - Calculation: element_left - new_container_scroll
 *                       200      -        300           = -100
 */
