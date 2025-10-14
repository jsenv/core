/**
 * Coordinate Systems in Web Development
 *
 * Example showing different coordinate systems:
 *
 *    0
 * 0 ─┼─────────────────────────────────────────────────────────────────┐
 *    │ DOCUMENT                                                        │
 *    │                                                                 │
 *    │       100                                                       │
 *    │  100 ─┼────────────────────────────────────────────────┐        │
 *    │       │ VIEWPORT                                       │        │
 *    │       │                                                │        │
 *    │       │      250                                       │        │
 *    │       │ 250 ─┼───────────────────────────────────┐     │        │
 *    │       │      │ SCROLL CONTAINER                  │     │        │
 *    │       │      │                                   │     │        │
 *    │       │      │      200                          │     │        │
 *    │       │      │ 200 ─┼──────────────┐             │     │        │
 *    │       │      │      │ ELEMENT      │             │     │        │
 *    │       │      │      │              │             │     │        │
 *    │       │      │      │              │             │     │        │
 *    │       │      │      │              │             │     │        │
 *    │       │      │      └──────────────┘             │     │        │
 *    │       │      │                                   │     │        │
 *    │       │      └───────────────────────────────────┘     │        │
 *    │       │                                                │        │
 *    │       └────────────────────────────────────────────────┘        │
 *    │                                                                 │
 *    └─────────────────────────────────────────────────────────────────┘
 *
 * COORDINATE CONVERSIONS FOR THE ELEMENT (focusing on left/x axis):
 *
 * Based on the diagram positions shown:
 *
 * • Element viewport left: 650
 *   - Why: Viewport left + scroll container left + element left
 *               100 +              250 +     200 = 650
 *
 * DOCUMENT COORDINATES:
 * • Element document left: 750
 *   - Why: Element is at viewport position 650, plus document scroll 100
 *   - Calculation: elementViewportLeft(650) + documentScrollLeft(100) = 750
 *
 * CONTAINER SCROLL COORDINATES:
 * • Element container scroll left: 50
 *   - Why: Element is at container position 200, minus container scroll 150
 *   - Calculation: elementContainerLeft(200) - containerScrollLeft(150) = 50
 *
 * WHEN DOCUMENT SCROLLS (scrollLeft: 100→200):
 * • Viewport left: 650 (unchanged - relative to window)
 * • Document left: 750→850 (650 + 200 = 850)
 * • Container scroll left: 50 (unchanged - independent scrolling)
 *
 * WHEN CONTAINER SCROLLS (scrollLeft: 250→300):
 * • Viewport left: 650→600 (element moves left in viewport)
 * • Document left: 750→700 (600 + 100 = 700)
 * • Container scroll left: 50→0 (200 - 300 = -100, but element moved)
 */
