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

export default function VoteForm({ initialVote, disabled = false, onSubmit }: VoteFormProps) {
  const [scores, setScores] = useState({
    aesthetics: initialVote?.aesthetics ?? 5,
    coherence: initialVote?.coherence ?? 5,
    originality: initialVote?.originality ?? 5,
    details: initialVote?.details ?? 5,
    rpPresentation: initialVote?.rpPresentation ?? 5,
  });
  const [isSaving, setIsSaving] = useState(false);

  const update = (key: keyof typeof scores, value: number) => setScores((current) => ({ ...current, [key]: value }));

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
      <RatingInput label="Esthétique générale" value={scores.aesthetics} onChange={(value) => update('aesthetics', value)} />
      <RatingInput label="Cohérence du style" value={scores.coherence} onChange={(value) => update('coherence', value)} />
      <RatingInput label="Originalité" value={scores.originality} onChange={(value) => update('originality', value)} />
      <RatingInput label="Finition / détails" value={scores.details} onChange={(value) => update('details', value)} />
      <RatingInput label="Présentation RP" value={scores.rpPresentation} onChange={(value) => update('rpPresentation', value)} />
      <button className="button primary" type="submit" disabled={disabled || isSaving}>
        {isSaving ? 'Enregistrement...' : initialVote ? 'Modifier mon vote' : 'Envoyer mon vote'}
      </button>
    </form>
  );
}
