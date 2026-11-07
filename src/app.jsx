import { useMemo, useState } from 'react';

import { CrashGame } from './crash/crash-game';
import { parseSlipOutcome } from './crash/crash-outcomes';
import { MATCHES } from './data/matches';
import { MatchCard } from './feed/match-card';

export function App() {
  const [selection, setSelection] = useState(null);
  const pick = useMemo(() => {
    const outcome = parseSlipOutcome(selection);

    return outcome ? { selection, outcome } : null;
  }, [selection]);

  return (
    <div className="cs-App">
      <header className="cs-Header">
        <span className="cs-Header-logo">⚡ Crash Slip</span>
        <span className="cs-Header-hint">Pick an outcome — play it as a crash</span>
      </header>

      <main className="cs-Layout">
        <section className="cs-Feed">
          {MATCHES.map(match => (
            <MatchCard key={match.id} match={match} selectedId={selection?.id} onSelect={setSelection} />
          ))}
        </section>

        <aside className="cs-Slip" data-test-id="bet-slip">
          <div className="cs-Slip-header">
            <span className="cs-Slip-title">Bet slip</span>
            <span className="cs-Slip-mode">⚡ Crash</span>
          </div>

          {selection && (
            <div className="cs-Slip-selection">
              <div className="cs-Slip-selectionText">
                <span className="cs-Slip-selectionOutcome">{selection.outcomeName}</span>
                <span className="cs-Slip-selectionMeta">
                  {selection.marketName} · {selection.nameA} – {selection.nameB}
                </span>
              </div>
              <button
                className="cs-Slip-remove"
                data-test-id="slip-remove"
                type="button"
                onClick={() => setSelection(null)}>
                ✕
              </button>
            </div>
          )}

          <CrashGame pick={pick} />
        </aside>
      </main>
    </div>
  );
}
