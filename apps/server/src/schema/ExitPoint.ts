import { Schema, type } from '@colyseus/schema';

// One exit cell in maze-grid coordinates. The client converts to world
// coords using shared/coords — keeping the wire payload as integers means
// 2–4 exits cost ~8 bytes total.
// `gx, gy` = the inner "zone" cell the player has to reach to win.
// `doorX, doorY` = the perimeter wall cell where the door visual goes
// (adjacent to the zone, replacing the wall cube there). The two pairs
// are decoupled because the win check is distance-based off the zone but
// the visual lives on the wall.
export class ExitPoint extends Schema {
  @type('uint16') gx = 0;
  @type('uint16') gy = 0;
  @type('uint16') doorX = 0;
  @type('uint16') doorY = 0;
}
