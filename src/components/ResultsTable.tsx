import { formatMoney } from '../lib/money';
import type { PrizePool, VehicleScore } from '../types';

type ResultsTableProps = {
  scores: VehicleScore[];
  prize?: PrizePool;
};

const bg = (url?: string) =>
  url ? { backgroundImage: `url(${url})` } : undefined;

const rawNote = (score: VehicleScore) =>
  score.voteCount > 0 ? `Brut ${score.average.toFixed(1)}` : 'Pas encore noté';

// Étiquette de gain pour une place du podium (1-based), si une cagnotte existe.
function prizeFor(rank: number, prize?: PrizePool): string | null {
  if (!prize || prize.net <= 0) return null;
  const amount = rank === 1 ? prize.podium.first : rank === 2 ? prize.podium.second : rank === 3 ? prize.podium.third : 0;
  return amount > 0 ? formatMoney(amount) : null;
}

export default function ResultsTable({ scores, prize }: ResultsTableProps) {
  if (scores.length === 0) {
    return <p className="notice">Aucun résultat pour le moment. Les votes apparaissent ici en direct.</p>;
  }

  // Séparation podium (éligibles seulement) / hors quorum (placés à part).
  const eligible = scores.filter((s) => s.eligibleForRank);
  const pending = scores.filter((s) => !s.eligibleForRank);

  if (eligible.length === 0) {
    return (
      <>
        <p className="notice">
          Aucun véhicule n'a encore atteint le quorum minimum pour être classé. Continuez à voter !
        </p>
        <PendingList scores={pending} />
      </>
    );
  }

  const [first, second, third, ...rest] = eligible;

  return (
    <div className="podium">
      {/* #1 — hero */}
      <article className="podium-winner" aria-label={`${first.vehicle.name} en première place`}>
        <div className="pw-img" style={bg(first.vehicle.imageUrl)} />
        <div className="pw-overlay" />
        <span className="pw-medal">★ #1 · OR{prizeFor(1, prize) ? ` · ${prizeFor(1, prize)}` : ''}</span>
        <div className="pw-score">{first.weightedAverage.toFixed(1)}</div>
        <div className="pw-info">
          <h2 className="pw-name">{first.vehicle.name}</h2>
          <p className="pw-owner">
            par <strong>{first.vehicle.ownerName}</strong>
            {first.vehicle.category && <> · {first.vehicle.category}</>}
            {' · '}
            {first.voteCount} vote{first.voteCount > 1 ? 's' : ''}
            {' · '}
            {rawNote(first)}
          </p>
        </div>
      </article>

      {(second || third) && (
        <div className="podium-pair">
          {second && (
            <article className="podium-step silver" aria-label={`${second.vehicle.name} en deuxième place`}>
              <div className="ps-img" style={bg(second.vehicle.imageUrl)} />
              <div className="ps-overlay" />
              <span className="ps-medal">#2 · ARGENT{prizeFor(2, prize) ? ` · ${prizeFor(2, prize)}` : ''}</span>
              <div className="ps-score">{second.weightedAverage.toFixed(1)}</div>
              <div className="ps-info">
                <h3 className="ps-name">{second.vehicle.name}</h3>
                <div className="ps-owner">{second.vehicle.ownerName} · {second.voteCount} votes · {rawNote(second)}</div>
              </div>
            </article>
          )}
          {third && (
            <article className="podium-step bronze" aria-label={`${third.vehicle.name} en troisième place`}>
              <div className="ps-img" style={bg(third.vehicle.imageUrl)} />
              <div className="ps-overlay" />
              <span className="ps-medal">#3 · BRONZE{prizeFor(3, prize) ? ` · ${prizeFor(3, prize)}` : ''}</span>
              <div className="ps-score">{third.weightedAverage.toFixed(1)}</div>
              <div className="ps-info">
                <h3 className="ps-name">{third.vehicle.name}</h3>
                <div className="ps-owner">{third.vehicle.ownerName} · {third.voteCount} votes · {rawNote(third)}</div>
              </div>
            </article>
          )}
        </div>
      )}

      {rest.length > 0 && (
        <>
          <p className="eyebrow" style={{ marginTop: 6 }}>Suite du classement</p>
          <div className="results-list">
            {rest.map((score, i) => (
              <div className="results-row" key={score.vehicle.id}>
                <div className="rr-rank">{i + 4}</div>
                <div className="rr-thumb" style={bg(score.vehicle.imageUrl)} />
                <div>
                  <h4 className="rr-name">{score.vehicle.name}</h4>
                  <div className="rr-meta">
                    {score.vehicle.ownerName}
                    {score.vehicle.category && <> · {score.vehicle.category}</>}
                  </div>
                </div>
                <div className="rr-votes">{score.voteCount} votes · {rawNote(score)}</div>
                <div className="rr-score">
                  {score.weightedAverage.toFixed(1)}<small>/10</small>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <PendingList scores={pending} />
    </div>
  );
}

function PendingList({ scores }: { scores: VehicleScore[] }) {
  if (scores.length === 0) return null;
  const quorum = scores[0].quorum;
  return (
    <>
      <p className="eyebrow" style={{ marginTop: 18 }}>Hors classement · votes insuffisants (minimum {quorum})</p>
      <div className="results-list">
        {scores.map((score) => (
          <div className="results-row" key={score.vehicle.id} style={{ opacity: 0.7 }}>
            <div className="rr-rank">—</div>
            <div className="rr-thumb" style={bg(score.vehicle.imageUrl)} />
            <div>
              <h4 className="rr-name">{score.vehicle.name}</h4>
              <div className="rr-meta">
                {score.vehicle.ownerName}
                {score.vehicle.category && <> · {score.vehicle.category}</>}
              </div>
            </div>
            <div className="rr-votes">
              {score.voteCount}/{score.quorum} votes requis
            </div>
            <div className="rr-score" style={{ color: 'var(--text-3)' }}>
              {score.voteCount > 0 ? score.average.toFixed(1) : '—'}<small>{score.voteCount > 0 ? '/10' : ''}</small>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
