import clsx from 'clsx';
import { memo } from 'react';

import { TeamBadge } from '../crash/team-badge';
import { toSlipSelection } from '../data/matches';

function MatchCardUI({ match, selectedId, onSelect }) {
  return (
    <article className="cs-Match" data-test-id={`match-${match.id}`}>
      <header className="cs-Match-header">
        <span className="cs-Match-league">⚽ {match.league}</span>
        <span className="cs-Match-time">{match.kickOff}</span>
      </header>

      <div className="cs-Match-teams">
        <span className="cs-Match-team">
          <TeamBadge colors={match.colorsA} name={match.nameA} size={26} />
          {match.nameA}
        </span>
        <span className="cs-Match-vs">vs</span>
        <span className="cs-Match-team">
          <TeamBadge colors={match.colorsB} name={match.nameB} size={26} />
          {match.nameB}
        </span>
      </div>

      <div className="cs-Match-markets">
        {match.markets.map(market => (
          <div key={market.externalId} className="cs-Market">
            <span className="cs-Market-name">{market.name}</span>
            <div className="cs-Market-outcomes">
              {market.outcomes.map(outcome => {
                const selection = toSlipSelection(match, market, outcome);
                const isSelected = selection.id === selectedId;

                return (
                  <button
                    key={outcome.externalId}
                    className={clsx('cs-Odd', isSelected && 'isSelected')}
                    data-test-id={`odd-${selection.id}`}
                    title={outcome.name}
                    type="button"
                    onClick={() => onSelect(isSelected ? null : selection)}>
                    <span className="cs-Odd-label">{outcome.short}</span>
                    <span className="cs-Odd-value">{outcome.odds.toFixed(2)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export const MatchCard = memo(MatchCardUI);
