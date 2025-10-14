/**
 * Coordinate Systems in Web Development
 *
 * Example with dimensions showing different coordinate systems:
 *
 * 0                                                                1400
 * ┌───────────────────────────────────────────────────────────────────┐0
 * │ DOCUMENT (1400×1600)                                              │
 * │                                                                   │
 * │       100                                             900         │
 * │       ┌─────────────────────────────────────────────────┐200      │
 * │       │ VIEWPORT (800×650)                              │         │
 * │       │                                                 │         │
 * │       │     250                               650       │         │
 * │       │     ┌───────────────────────────────────┐350    │         │
 * │       │     │ SCROLL CONTAINER                  │       │         │
 * │       │     │ (400×280)                         │       │         │
 * │       │     │                                   │       │         │
 * │       │     │   320                     720     │       │         │
 * │       │     │   ┌─────────────────────────┐450  │       │         │
 * │       │     │   │ CONTENT                 │     │       │         │
 * │       │     │   │ (400×240)               │     │       │         │
 * │       │     │   │                         │     │       │         │
 * │       │     │   │     420         520     │     │       │         │
 * │       │     │   │     ┌─────────────┐550  │     │       │         │
 * │       │     │   │     │ ELEM        │     │     │       │         │
 * │       │     │   │     │ (100×100)   │     │     │       │         │
 * │       │     │   │     │             │     │     │       │         │
 * │       │     │   │     │             │     │     │       │         │
 * │       │     │   │     └─────────────┘650  │     │       │         │
 * │       │     │   │     520         620     │     │       │         │
 * │       │     │   │                         │     │       │         │
 * │       │     │   │                         │     │       │         │
 * │       │     │   └─────────────────────────┘690  │       │         │
 * │       │     │   320                     720     │       │         │
 * │       │     └───────────────────────────────────┘630    │         │
 * │       │     250                               650       │         │
 * │       │                                                 │         │
 * │       │                                                 │         │
 * │       └─────────────────────────────────────────────────┘850      │
 * │       100                                             900         │
 * │                                                                   │
 * └───────────────────────────────────────────────────────────────────┘ 1600
 *
 * COORDINATE CONVERSIONS FOR THE ELEMENT (100×100px):
 *
 * • Viewport coords: getBoundingClientRect() → left:320, top:350, right:420, bottom:450
 * • Document coords: viewport + document scroll → left:420, top:550, right:520, bottom:650
 * • Container content coords: relative to content → left:100, top:100, right:200, bottom:200
 * • Container scroll coords: content - container scroll → left:50, top:70, right:150, bottom:170
 *
 * WHEN DOCUMENT SCROLLS (scrollX=100→150, scrollY=200→300):
 * • Viewport coords: same (relative to window)
 * • Document coords: left:470, top:650, right:570, bottom:750
 * • Container coords: unchanged (independent scrolling)
 *
 * WHEN CONTAINER SCROLLS (scrollLeft=50→80, scrollTop=30→50):
 * • Viewport coords: left:290, top:330, right:390, bottom:430
 * • Document coords: left:390, top:530, right:490, bottom:630
 * • Container content coords: same (relative to content)
 * • Container scroll coords: left:20, top:50, right:120, bottom:150
 */
