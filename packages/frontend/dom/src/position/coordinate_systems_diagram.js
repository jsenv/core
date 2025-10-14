/**
 * Coordinate Systems in Web Development
 *
 * Example with dimensions showing different coordinate systems:
 *
 *    0
 * 0 ─┼─────────────────────────────────────────────────────────────────┐
 *    │ DOCUMENT (2000×1500)                                            │
 *    │                                                                 │
 *    │       100                                                       │
 *    │  100 ─┼────────────────────────────────────────────────┐        │
 *    │       │ VIEWPORT (1500×1000)                           │        │
 *    │       │                                                │        │
 *    │       │      200                                       │        │
 *    │       │ 200 ─┼───────────────────────────────────┐     │        │
 *    │       │      │ SCROLL CONTAINER (1000×500)       │     │        │
 *    │       │      │                                   │     │        │
 *    │       │      │      100                          │     │        │
 *    │       │      │ 100 ─┼─────────────────────────┐  │     │        │
 *    │       │      │      │ CONTENT (800×400)       │  │     │        │
 *    │       │      │      │                         │  │     │        │
 *    │       │      │      │      150                │  │     │        │
 *    │       │      │      │ 150 ─┼──────────────┐   │  │     │        │
 *    │       │      │      │      │ EL (100×100) │   │  │     │        │
 *    │       │      │      │      │              │   │  │     │        │
 *    │       │      │      │      │              │   │  │     │        │
 *    │       │      │      │      │              │   │  │     │        │
 *    │       │      │      │      └──────────────┘   │  │     │        │
 *    │       │      │      └─────────────────────────┘  │     │        │
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
 * • Viewport coords: getBoundingClientRect() → left:450, top:450, right:550, bottom:550
 * • Document coords: viewport + document scroll → left:550, top:550, right:650, bottom:650
 * • Container content coords: relative to content → left:150, top:150, right:250, bottom:250
 * • Container scroll coords: content - container scroll → left:50, top:50, right:150, bottom:150
 *
 * WHEN DOCUMENT SCROLLS (from 100,100 to 200,200):
 * • Viewport coords: same (relative to window)
 * • Document coords: left:650, top:650, right:750, bottom:750
 * • Container coords: unchanged (independent scrolling)
 *
 * WHEN CONTAINER SCROLLS (from 100,100 to 150,150):
 * • Viewport coords: left:400, top:400, right:500, bottom:500
 * • Document coords: left:500, top:500, right:600, bottom:600
 * • Container content coords: same (relative to content)
 * • Container scroll coords: left:0, top:0, right:100, bottom:100
 */
