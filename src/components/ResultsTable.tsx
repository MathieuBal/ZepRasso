import type { VehicleScore } from '../types';

type ResultsTableProps = {
  scores: VehicleScore[];
};

const medals = ['🥇', '🥈', '🥉'];

export default function ResultsTable({ scores }: ResultsTableProps) {
  if (scores.length === 0) {
    return <p className="notice">Aucun résultat disponible pour le moment.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rang</th>
            <th>Véhicule</th>
            <th>Propriétaire</th>
            <th>Votes</th>
            <th>Moyenne</th>
            <th>Esthétique</th>
            <th>Cohérence</th>
            <th>Originalité</th>
            <th>Détails</th>
            <th>RP</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((score, index) => (
            <tr key={score.vehicle.id}>
              <td>{medals[index] || `#${index + 1}`}</td>
              <td><strong>{score.vehicle.name}</strong></td>
              <td>{score.vehicle.ownerName}</td>
              <td>{score.voteCount}</td>
              <td><strong>{score.average}/10</strong></td>
              <td>{score.averagesByCriterion.aesthetics}</td>
              <td>{score.averagesByCriterion.coherence}</td>
              <td>{score.averagesByCriterion.originality}</td>
              <td>{score.averagesByCriterion.details}</td>
              <td>{score.averagesByCriterion.rpPresentation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
