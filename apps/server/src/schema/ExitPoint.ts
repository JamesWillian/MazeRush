import { Schema, type } from '@colyseus/schema';

// One exit cell in maze-grid coordinates. The client converts to world
// coords using shared/coords — keeping the wire payload as integers means
// 2–4 exits cost ~8 bytes total.
export class ExitPoint extends Schema {
  @type('uint16') gx = 0;
  @type('uint16') gy = 0;
}
