import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

import { ExitPoint } from './ExitPoint.js';
import { FlagState } from './FlagState.js';
import { PlayerState } from './PlayerState.js';

// Root schema for a MazeRoom. The seed alone is enough for the client to
// regenerate the same maze the server has — no need to ship the tile array
// over the wire. width/height are sent for clients that want to validate.
//
// New fields land at the END so existing field IDs don't shift (which would
// break clients running an older schema).
export class GameState extends Schema {
  @type('uint32') seed = 0;
  @type('uint16') width = 0;
  @type('uint16') height = 0;
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type(FlagState) flag = new FlagState();
  // 'lobby' | 'countdown' | 'playing' | 'ended' (see shared.PHASE_*).
  @type('string') phase = 'lobby';

  // Step 8 additions:
  // 'capture' | 'escape' (see shared.MODE_*).
  @type('string') mode = 'capture';
  // Absolute wall-clock ms (Date.now()) when the countdown should end. 0 if
  // not in countdown.
  @type('number') countdownEndsAt = 0;
  // Absolute wall-clock ms when the game ended. 0 if not ended.
  @type('number') endedAt = 0;
  // sessionId of the winner; '' until someone wins.
  @type('string') winnerId = '';
  // Exit cells chosen at room creation time (seeded by the maze seed).
  @type({ array: ExitPoint }) exits = new ArraySchema<ExitPoint>();
}
