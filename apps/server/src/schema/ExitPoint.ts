import { Schema, type } from '@colyseus/schema';

// `gx, gy` = the door cell (a perimeter wall cell, replaced visually
// with a green emissive block). The player wins by reaching this cell —
// since it IS a wall, "reaching" means pressing up against it from the
// adjacent inner cell. EXIT_REACH_RADIUS is tuned so the win fires the
// moment the player's AABB touches the wall face.
export class ExitPoint extends Schema {
  @type('uint16') gx = 0;
  @type('uint16') gy = 0;
}
