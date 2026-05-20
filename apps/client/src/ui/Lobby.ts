import type { Room } from 'colyseus.js';

import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '@mazerush/shared';

import type { ColyseusClient } from '../net/ColyseusClient.js';

export interface LobbyResult {
  readonly room: Room;
  readonly name: string;
  readonly code: string;
}

// Initial overlay: pick a nickname, then either create a new room (server
// generates the room, we hold the code locally and show it for sharing)
// or join one with a 6-char code typed by a friend.
//
// Owns the overlay's DOM contents. main.ts only sees `run()` (resolves
// when the player has successfully connected) and `destroy()`.
export class Lobby {
  private resolveResult: ((res: LobbyResult) => void) | null = null;
  private rejectResult: ((err: unknown) => void) | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly client: ColyseusClient,
  ) {}

  async run(): Promise<LobbyResult> {
    return new Promise<LobbyResult>((resolve, reject) => {
      this.resolveResult = resolve;
      this.rejectResult = reject;
      this.render();
    });
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  private render(): void {
    const defaultName = `guest-${Math.floor(Math.random() * 10_000)
      .toString()
      .padStart(4, '0')}`;
    const defaultCode = generateRoomCode();

    this.root.innerHTML = `
      <div class="panel" style="max-width: 32rem;">
        <h1 style="margin: 0 0 1rem 0;">MazeRush</h1>

        <label style="display:block; text-align:left; font-size:.85rem; opacity:.7; margin-bottom:.25rem;">
          Nickname
        </label>
        <input id="lobby-name" type="text" value="${escapeHtml(defaultName)}"
               maxlength="16"
               style="width:100%; padding:.5rem .75rem; font:inherit; background:#1e2030;
                      border:1px solid #2a2a32; border-radius:6px; color:#eee; margin-bottom:1rem;" />

        <div style="display:flex; gap:.5rem; margin-bottom:.5rem;">
          <button id="tab-create" class="lobby-tab" data-active="true">Create room</button>
          <button id="tab-join" class="lobby-tab">Join with code</button>
        </div>

        <div id="pane-create">
          <p style="opacity:.7; margin:.5rem 0; font-size:.9rem;">
            Share this code with friends so they can join.
          </p>
          <div style="display:flex; gap:.5rem; align-items:center; margin-bottom: 1rem;">
            <code id="lobby-code-display"
                  style="flex:1; padding:.6rem .75rem; background:#1e2030; border-radius:6px;
                         font-family:ui-monospace,monospace; font-size:1.15rem; letter-spacing:.1em;">
              ${escapeHtml(defaultCode)}
            </code>
            <button id="lobby-code-regen" title="Generate a new code"
                    style="padding:.5rem .75rem;">↻</button>
          </div>
          <button id="lobby-create" style="width:100%;">Create &amp; Enter</button>
        </div>

        <div id="pane-join" style="display:none;">
          <label style="display:block; text-align:left; font-size:.85rem; opacity:.7; margin:.5rem 0 .25rem 0;">
            Room code
          </label>
          <input id="lobby-code-input" type="text" placeholder="ABCDEF" maxlength="6"
                 autocomplete="off" autocapitalize="characters" spellcheck="false"
                 style="width:100%; padding:.5rem .75rem; font:inherit; background:#1e2030;
                        border:1px solid #2a2a32; border-radius:6px; color:#eee;
                        text-transform:uppercase; letter-spacing:.1em; margin-bottom:1rem;" />
          <button id="lobby-join" style="width:100%;">Join</button>
        </div>

        <p id="lobby-error" style="color:#f87171; min-height:1.25rem; margin:.75rem 0 0 0; font-size:.9rem;"></p>
      </div>
      <style>
        .lobby-tab {
          flex: 1;
          padding: .5rem;
          font: inherit;
          background: #1e2030;
          color: #aaa;
          border: 1px solid #2a2a32;
          border-radius: 6px;
          cursor: pointer;
        }
        .lobby-tab[data-active="true"] {
          background: #4f7cff;
          color: white;
          border-color: #4f7cff;
        }
      </style>
    `;
    this.root.style.display = 'flex';

    this.wireTabs();
    this.wireCreate(defaultCode);
    this.wireJoin();
  }

  private wireTabs(): void {
    const tabCreate = this.q<HTMLButtonElement>('#tab-create');
    const tabJoin = this.q<HTMLButtonElement>('#tab-join');
    const paneCreate = this.q<HTMLElement>('#pane-create');
    const paneJoin = this.q<HTMLElement>('#pane-join');
    tabCreate.addEventListener('click', () => {
      tabCreate.dataset.active = 'true';
      tabJoin.dataset.active = 'false';
      paneCreate.style.display = '';
      paneJoin.style.display = 'none';
      this.clearError();
    });
    tabJoin.addEventListener('click', () => {
      tabJoin.dataset.active = 'true';
      tabCreate.dataset.active = 'false';
      paneJoin.style.display = '';
      paneCreate.style.display = 'none';
      this.clearError();
    });
  }

  private wireCreate(initialCode: string): void {
    let code = initialCode;
    const display = this.q<HTMLElement>('#lobby-code-display');
    const regen = this.q<HTMLButtonElement>('#lobby-code-regen');
    const btn = this.q<HTMLButtonElement>('#lobby-create');

    regen.addEventListener('click', () => {
      code = generateRoomCode();
      display.textContent = code;
    });

    btn.addEventListener('click', () => {
      const name = this.getName();
      void this.attempt(() => this.client.createMaze(name, code), name, code);
    });
  }

  private wireJoin(): void {
    const input = this.q<HTMLInputElement>('#lobby-code-input');
    const btn = this.q<HTMLButtonElement>('#lobby-join');

    // Live normalize as the user types so they always see the canonical form.
    input.addEventListener('input', () => {
      const cursorAtEnd = input.selectionStart === input.value.length;
      input.value = normalizeRoomCode(input.value);
      if (cursorAtEnd) input.setSelectionRange(input.value.length, input.value.length);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btn.click();
    });

    btn.addEventListener('click', () => {
      const raw = input.value;
      const code = normalizeRoomCode(raw);
      if (!isValidRoomCode(code)) {
        this.setError('Code must be 6 chars (A–Z, 2–9, no 0/1/O/I).');
        return;
      }
      const name = this.getName();
      void this.attempt(() => this.client.joinMazeByCode(name, code), name, code);
    });
  }

  private async attempt(
    action: () => Promise<Room>,
    name: string,
    code: string,
  ): Promise<void> {
    this.clearError();
    this.setBusy(true);
    try {
      const room = await action();
      this.setBusy(false);
      const resolve = this.resolveResult;
      this.resolveResult = null;
      this.rejectResult = null;
      resolve?.({ room, name, code });
    } catch (err) {
      this.setBusy(false);
      const msg = err instanceof Error ? err.message : String(err);
      // Colyseus throws short matchmaking errors here, e.g. "no rooms found".
      this.setError(prettifyError(msg));
    }
  }

  private getName(): string {
    const input = this.q<HTMLInputElement>('#lobby-name');
    const raw = input.value.trim();
    return raw.length > 0 ? raw : 'guest';
  }

  private setBusy(busy: boolean): void {
    for (const btn of this.root.querySelectorAll<HTMLButtonElement>('button')) {
      btn.disabled = busy;
    }
  }

  private setError(msg: string): void {
    const el = this.q<HTMLElement>('#lobby-error');
    el.textContent = msg;
  }

  private clearError(): void {
    this.setError('');
  }

  private q<T extends HTMLElement>(selector: string): T {
    const el = this.root.querySelector<T>(selector);
    if (!el) throw new Error(`lobby: missing ${selector}`);
    return el;
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] ?? c,
  );
}

function prettifyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('not found') || lower.includes('no rooms')) {
    return 'No room with that code is open.';
  }
  if (lower.includes('locked') || lower.includes('full')) {
    return 'That room is full.';
  }
  return raw;
}
