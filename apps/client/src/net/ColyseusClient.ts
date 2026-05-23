import { Client, type Room } from 'colyseus.js';

import { SERVER_URL } from '../config.js';

// Thin wrapper over colyseus.js Client. The room name 'maze' is hard-coded
// here so callers don't have to know about it — the filterBy(['code']) on
// the server makes the code the only matchmaking key that matters.
export class ColyseusClient {
  private readonly client: Client;

  constructor(endpoint: string = SERVER_URL) {
    this.client = new Client(endpoint);
  }

  // Always creates a new room. Server validates `code` shape and rejects
  // malformed values. The creator already holds the code (they generated
  // it locally with `generateRoomCode`) so there's nothing to read back.
  // `color` is the avatar color the player picked — server sanitizes.
  async createMaze(name: string, code: string, color: string): Promise<Room> {
    return await this.client.create('maze', { name, code, color });
  }

  // Joins an existing room with matching `code`. Throws if no room with
  // that code exists, OR if the room is full / closed.
  async joinMazeByCode(name: string, code: string, color: string): Promise<Room> {
    return await this.client.join('maze', { name, code, color });
  }
}
