import { useState } from 'react';
import type { Vote } from '../types';
import RatingInput from './RatingInput';

type VoteFormProps = {
  initialVote?: Vote;
  disabled?: boolean;
  onSubmit: (scores: {
    aesthetics: number;
    coherence: number;
    originality: number;
    details: number;
    rpPresentation: number;
  }) => Promise<void>;
};

const CRITERIA = [
  { key: 'aesthetics',     label: 'Esthétique générale', hint: 'Allure d’ensemble, proportions, couleurs.' },
  { key: 'coherence',      label: 'Cohérence du style',  hint: 'Le build raconte-t-il une histoire ?' },
  { key: 'originality',    label: 'Originalité',         hint: 'Déjà vu mille fois, ou jamais ?' },
  { key: 'details',        label: 'Finition / détails',  hint: 'Propreté, soin du moindre élément.' },
  { key: 'rpPresentation', label: 'Présentation RP',     hint: 'Le proprio joue le jeu, mise en scène.' },
] as const;

export default function VoteForm({ initialVote, disabled = false, onSubmit }: VoteFormProps) {
  const [scores, setScores] = useState({
    aesthetics: initialVote?.aesthetics ?? 5,
    coherence: initialVote?.coherence ?? 5,
    originality: initialVote?.originality ?? 5,
    details: initialVote?.details ?? 5,
    rpPresentation: initialVote?.rpPresentation ?? 5,
  });
  const [isSaving, setIsSaving] = useState(false);

  const update = (key: keyof typeof scores, value: number) =>
    setScores((current) => ({ ...current, [key]: value }));

  const average = (
    (scores.aesthetics + scores.coherence + scores.originality + scores.details + scores.rpPresentation) / 5
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      await onSubmit(scores);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      {/* Aperçu note globale */}
      <div className="between" style={{
        padding: '14px 16px',
        background: 'rgba(255, 43, 214, 0.04)',
        border: '1px solid var(--line-soft)',
        borderRadius: 14,
      }}>
        <div>
          <p className="eyebrow">Ta note globale</p>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>Moyenne des 5 critères</p>
        </div>
        <div className="score" style={{ fontSize: '2.8rem', color: 'var(--magenta)' }}>
          {average.toFixed(1)}
          <small style={{ fontSize: '0.4em', color: 'var(--text-3)', marginLeft: 4 }}>/10</small>
        </div>
      </div>

      {CRITERIA.map((c) => (
        <RatingInput
          key={c.key}
          label={c.label}
          hint={c.hint}
          value={scores[c.key as keyof typeof scores]}
          onChange={(v) => update(c.key as keyof typeof scores, v)}
        />
      ))}

      <button className="button primary" type="submit" disabled={disabled || isSaving}>
        {isSaving ? 'Enregistrement…' : initialVote ? 'Modifier mon vote' : `Envoyer mon vote · ${average.toFixed(1)}/10`}
      </button>
    </form>
  );
}
