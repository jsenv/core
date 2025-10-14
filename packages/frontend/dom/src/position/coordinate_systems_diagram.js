/**
 * Coordinate Systems in Web Development
 *
 * Example with dimensions showing different coordinate systems:
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
 * COORDINATE CONVERSIONS FOR THE ELEMENT (100×100px):
 *
 * Based on the diagram positions shown:
 *
 * • Viewport coords: getBoundingClientRect() → left:650, top:650, right:750, bottom:750
 * • Document coords: viewport + document scroll → left:750, top:750, right:850, bottom:850
 * • Container scroll coords: element position - container scroll → left:50, top:50, right:150, bottom:150
 *
 * WHEN DOCUMENT SCROLLS (from 100,100 to 200,200):
 * • Viewport coords: same (relative to window)
 * • Document coords: left:850, top:850, right:950, bottom:950
 * • Container coords: unchanged (independent scrolling)
 *
 * WHEN CONTAINER SCROLLS (from 250,250 to 300,300):
 * • Viewport coords: left:600, top:600, right:700, bottom:700
 * • Document coords: left:700, top:700, right:800, bottom:800
 * • Container scroll coords: left:0, top:0, right:100, bottom:100
 */
