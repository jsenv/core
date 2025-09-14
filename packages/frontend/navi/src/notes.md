- Investigate why left: -30px does not work

- Drag to move row and column

  (ideally we keep an empty "clone" in the table and we create a visually identic clone to drag)

  sitcky prevents drag to re-order
  I think we are starting to reach the limits of a table element

  donc on va refaire mais avec des div comme ca on controle bien tout
  de toute facon les dimensions des lignes et colonnes seront fixes
  et je gagne pas grand chose a passer par la balise table

- Ideally the drag gesture should autoscroll once dragged element boundaries reach the scrollable parent (not the mouse)

- Can use shortcuts on table selection
  - cmd + delete would delete rows/columns
    on cells it does nothing but we'll be able to copy via keyboard to start

- Fixed first column and first row (overflow on the rest + it's fixed when there is a lof of content)

- Can delete a table row

- Can update a table row cell

- Can see table columns attributes

- Can update table column attributes

- Can remove table column

- Can move table column

- Pagination

- import.meta.css during build should use stylesheet to inject so that it puts an url instead of constructed stylesheet?
