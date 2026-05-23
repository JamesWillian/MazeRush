import { Schema, type } from '@colyseus/schema';

// Per-player state synced to every client via @colyseus/schema delta
// compression. Field order matters: schema serializes by declaration order,
// so adding a field at the END is a non-breaking change but inserting in the
// middle would shift wire IDs. We keep volatile gameplay fields (position,
// yaw) before identity fields so they get tight encoding via numeric IDs.
export class PlayerState extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('number') x = 0;
  @type('number') z = 0;
  @type('number') yaw = 0;
  @type('boolean') connected = true;
  // Last input sequence number the server has processed for this player.
  // The client uses this for prediction reconciliation in Step 6.
  @type('uint32') lastSeq = 0;
  // Avatar color the player chose, as #RRGGBB. Default supplied; server
  // sanitizes any client-provided value before storing.
  @type('string') color = '#4f7cff';
}
