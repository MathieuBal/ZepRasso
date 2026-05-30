import type { VehicleScore } from '../types';

type ResultsTableProps = {
  scores: VehicleScore[];
};

/**
 * Présentation podium : hero #1 + duo argent/bronze + liste classée.
 * Conserve la même interface qu'avant (props.scores), donc compatible drop-in.
 */
export default function ResultsTable({ scores }: ResultsTableProps) {
  if (scores.length === 0) {
    return <p className="notice">Aucun résultat pour le moment. Les votes apparaissent ici en direct.</p>;
  }

  const [first, second, third, ...rest] = scores;

  const bg = (url?: string) =>
    url ? { backgroundImage: `url(${url})` } : undefined;

  return (
    <div className="podium">
      {/* #1 — hero */}
      <article className="podium-winner" aria-label={`${first.vehicle.name} en première place`}>
        <div className="pw-img" style={bg(first.vehicle.imageUrl)} />
        <div className="pw-overlay" />
        <span className="pw-medal">★ #1 · OR</span>
        <div className="pw-score">{first.average.toFixed(1)}</div>
        <div className="pw-info">
          <h2 className="pw-name">{first.vehicle.name}</h2>
          <p className="pw-owner">
            par <strong>{first.vehicle.ownerName}</strong>
            {first.vehicle.category && <> · {first.vehicle.category}</>}
            {' · '}
            {first.voteCount} vote{first.voteCount > 1 ? 's' : ''}
          </p>
        </div>
      </article>

      {/* #2 + #3 */}
      {(second || third) && (
        <div className="podium-pair">
          {second && (
            <article className="podium-step silver" aria-label={`${second.vehicle.name} en deuxième place`}>
              <div className="ps-img" style={bg(second.vehicle.imageUrl)} />
              <div className="ps-overlay" />
              <span className="ps-medal">#2 · ARGENT</span>
              <div className="ps-score">{second.average.toFixed(1)}</div>
              <div className="ps-info">
                <h3 className="ps-name">{second.vehicle.name}</h3>
                <div className="ps-owner">{second.vehicle.ownerName} · {second.voteCount} votes</div>
              </div>
            </article>
          )}
          {third && (
            <article className="podium-step bronze" aria-label={`${third.vehicle.name} en troisième place`}>
              <div className="ps-img" style={bg(third.vehicle.imageUrl)} />
              <div className="ps-overlay" />
              <span className="ps-medal">#3 · BRONZE</span>
              <div className="ps-score">{third.average.toFixed(1)}</div>
              <div className="ps-info">
                <h3 className="ps-name">{third.vehicle.name}</h3>
                <div className="ps-owner">{third.vehicle.ownerName} · {third.voteCount} votes</div>
              </div>
            </article>
          )}
        </div>
      )}

      {/* Suite du classement */}
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
                <div className="rr-votes">{score.voteCount} votes</div>
                <div className="rr-score">
                  {score.average.toFixed(1)}<small>/10</small>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
