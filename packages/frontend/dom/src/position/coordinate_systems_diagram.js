/**
 * Coordinate Systems in Web Development
 *
 * Example with dimensions showing different coordinate systems:
 *
 * 0                                                                     1600
 * ┌─────────────────────────────────────────────────────────────────────────┐ 0
 * │ DOCUMENT (1600×2400)                                                    │
 * │                                                                         │
 * │                                                                         │
 * │                                                                         │
 * │                                                                         │
 * │         200                                           800               │
 * │         ┌───────────────────────────────────────────────┐500            │
 * │         │ VIEWPORT (600×480)                            │               │
 * │         │                                               │               │
 * │         │                                               │               │
 * │         │    300                          500           │               │
 * │         │    ┌──────────────────────────────┐600        │               │
 * │         │    │ SCROLL CONTAINER (200×120)   │           │               │
 * │         │    │                              │           │               │
 * │         │    │    350              550      │           │               │
 * │         │    │    ┌──────────────────┐650   │           │               │
 * │         │    │    │ CONTENT (200×150)│      │           │               │
 * │         │    │    │    380  440      │      │           │               │
 * │         │    │    │    ┌──────┐680   │      │           │               │
 * │         │    │    │    │ ELEM │      │      │           │               │
 * │         │    │    │    └──────┘720   │      │           │               │
 * │         │    │    │    720  760      │      │           │               │
 * │         │    │    └──────────────────┘      │           │               │
 * │         │    │                              │           │               │
 * │         │    └──────────────────────────────┘800        │               │
 * │         │                                               │               │
 * │         │                                               │               │
 * │         └───────────────────────────────────────────────┘ 980           │
 * │                                                                         │
 * │                                                                         │
 * │                                                                         │
 * │                                                                         │
 * └─────────────────────────────────────────────────────────────────────────┘ 2400
 *
 * COORDINATE CONVERSIONS FOR THE ELEMENT (60×40px):
 *
 * • Viewport coords: getBoundingClientRect() → left:380, top:180, right:440, bottom:220
 * • Document coords: viewport + document scroll → left:580, top:680, right:640, bottom:720
 * • Container content coords: relative to content → left:30, top:150, right:90, bottom:190
 * • Container scroll coords: content - container scroll → left:-20, top:120, right:40, bottom:160
 *
 * WHEN DOCUMENT SCROLLS (scrollX=200→250, scrollY=500→600):
 * • Viewport coords: same (relative to window)
 * • Document coords: left:630, top:780, right:690, bottom:820
 * • Container coords: unchanged (independent scrolling)
 *
 * WHEN CONTAINER SCROLLS (scrollLeft=50→80, scrollTop=30→50):
 * • Viewport coords: left:350, top:160, right:410, bottom:200
 * • Document coords: left:550, top:660, right:610, bottom:700
 * • Container content coords: same (relative to content)
 * • Container scroll coords: left:-50, top:100, right:10, bottom:140
 */
