export interface EndScreenOptions {
  readonly winnerName: string;
  readonly won: boolean;
  readonly roomCode: string;
}

// Shown when the match ends. Holds for `END_SCREEN_MS` before the server
// disposes the room and the WebSocket closes; the "Play again" button is
// just `location.reload()` since we don't persist any client state between
// matches yet.
export class EndScreen {
  constructor(private readonly root: HTMLElement) {}

  show(opts: EndScreenOptions): void {
    const headline = opts.won ? 'You won 🏆' : `${escapeHtml(opts.winnerName)} won`;
    this.root.innerHTML = `
      <div class="panel" style="max-width: 28rem; text-align: center;">
        <h1 style="margin: 0 0 .5rem 0; font-size: 1.8rem;">${headline}</h1>
        <p style="opacity:.65; margin: .25rem 0 1.5rem 0;">
          Room <code>${escapeHtml(opts.roomCode)}</code> will close in a few seconds.
        </p>
        <button id="endscreen-replay" style="padding: .75rem 1.5rem; width: 100%;">
          Play again
        </button>
      </div>
    `;
    this.root.style.display = 'flex';
    this.root.querySelector<HTMLButtonElement>('#endscreen-replay')?.addEventListener('click', () => {
      window.location.reload();
    });
  }

  hide(): void {
    this.root.style.display = 'none';
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
