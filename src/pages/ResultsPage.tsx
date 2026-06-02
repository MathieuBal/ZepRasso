import { useCallback, useEffect, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import ResultsTable from '../components/ResultsTable';
import { getCategories, getEvent, getVehicles, getVotes } from '../lib/repository';
import { calculateVehicleScores, groupScoresByCategory } from '../lib/scoring';
import { formatMoney } from '../lib/money';
import { usePolling } from '../lib/usePolling';
import type { CategoryPool, VehicleScore } from '../types';

const POLL_MS = 8000;

const catLabel = (category: string) => category.trim() || 'Général';

export default function ResultsPage() {
  const [scores, setScores] = useState<VehicleScore[]>([]);
  const [votesClosed, setVotesClosed] = useState(false);
  const [pools, setPools] = useState<CategoryPool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(() => {
    Promise.all([getEvent(), getVehicles(), getVotes(), getCategories()])
      .then(([event, vehicles, votes, cats]) => {
        if (!mountedRef.current) return;
        setVotesClosed(event.status === 'closed');
        setScores(calculateVehicleScores(vehicles, votes));
        setPools(cats.categories);
        setError(null);
      })
      .catch((err: Error) => {
        if (!mountedRef.current) return;
        setError(err.message);
      })
      .finally(() => {
        if (!mountedRef.current) return;
        setLoading(false);
      });
  }, []);

  usePolling(load, POLL_MS);

  const hasAnyVote = scores.some((score) => score.voteCount > 0);
  const groups = groupScoresByCategory(scores);
  const multipleCategories = groups.length > 1;

  // Map catégorie -> pool (clé normalisée trim()).
  const poolByCat = new Map<string, CategoryPool>();
  for (const p of pools) poolByCat.set((p.category || '').trim(), p);

  return (
    <section className="grid">
      <PageHeader
        title={votesClosed ? 'Classement final' : 'Classement en direct'}
        badge={votesClosed ? 'Votes fermés' : 'Votes ouverts'}
        badgeTone={votesClosed ? 'closed' : 'ok'}
      >
        <p className="lead">
          {votesClosed
            ? 'Classement définitif, calculé sur les cinq critères.'
            : 'Mis à jour à chaque nouveau vote. Il se fige quand l’organisateur clôt l’événement.'}
          {multipleCategories && ' Chaque catégorie a son propre podium et sa propre cagnotte.'}
        </p>
        <p className="muted" style={{ marginTop: 6, fontSize: '0.85rem' }}>
          Pour éviter qu'un véhicule peu noté ne gagne par chance, deux règles s'appliquent : (1) <strong>quorum</strong> — un véhicule doit avoir été noté par au moins la moitié des votants pour entrer dans le classement ; (2) la note finale est <strong>pondérée</strong> (rapprochée de la moyenne globale) pour les véhicules à faible nombre de votes. La moyenne brute reste affichée à titre indicatif.
        </p>
      </PageHeader>

      {loading && <p className="notice">Calcul des résultats…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && !hasAnyVote && (
        <p className="notice">Aucun vote pour l'instant. Les premiers votes feront apparaître le classement ici.</p>
      )}

      {!loading && !error && hasAnyVote && groups.map((group) => {
        const pool = poolByCat.get(group.category.trim());
        return (
          <div className="grid" key={group.category || '__general__'} style={{ gap: 12 }}>
            {multipleCategories && (
              <div className="between" style={{ marginTop: 8 }}>
                <h2 className="gradient-text" style={{ margin: 0 }}>{catLabel(group.category)}</h2>
                {pool && pool.pool > 0 && <span className="money money-big">{formatMoney(pool.pool)}</span>}
              </div>
            )}
            {pool && pool.pool > 0 && (
              <div className="panel" style={{ display: 'grid', gap: 6 }}>
                <p className="section-eyebrow">Cagnotte {multipleCategories ? catLabel(group.category) : 'en jeu'}</p>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {formatMoney(pool.pool)} en jeu · 🥇 {formatMoney(pool.podium.first)} · 🥈 {formatMoney(pool.podium.second)} · 🥉 {formatMoney(pool.podium.third)}
                </p>
                <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                  {pool.paidCount} inscription{pool.paidCount > 1 ? 's' : ''} payée{pool.paidCount > 1 ? 's' : ''} (part organisation : {formatMoney(pool.orgaCut)}).
                </p>
              </div>
            )}
            <ResultsTable scores={group.scores} prize={pool} />
          </div>
        );
      })}
    </section>
  );
}
