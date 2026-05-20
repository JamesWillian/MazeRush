import { Schema, type } from '@colyseus/schema';

// Placeholder for Step 8 (Capture mode). Defined now so GameState's shape is
// fixed early — adding the flag field later would shift schema field IDs and
// invalidate any persisted snapshots. `carriedBy` empty string = on the
// ground; otherwise it holds a sessionId.
export class FlagState extends Schema {
  @type('number') x = 0;
  @type('number') z = 0;
  @type('string') carriedBy = '';
}
