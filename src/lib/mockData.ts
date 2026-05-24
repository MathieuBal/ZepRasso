import type { RassoEvent, Vehicle, Vote } from '../types';

export const demoEvent: RassoEvent = {
  id: 'demo-event',
  name: 'ZepRasso - Car Meet RP',
  status: 'open',
  createdAt: new Date().toISOString(),
};

export const demoVehicles: Vehicle[] = [
  {
    id: 'sultan-rs',
    eventId: demoEvent.id,
    name: 'Sultan RS Classic',
    ownerName: 'Nico',
    category: 'Sportive',
    plate: 'NICO-07',
    imageUrl: 'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?q=80&w=1200&auto=format&fit=crop',
    description: 'Build racing sobre, jantes propres, peinture noire et rouge.',
    isContestant: true,
    isDisqualified: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'elegy-retro',
    eventId: demoEvent.id,
    name: 'Elegy Retro Custom',
    ownerName: 'Maya',
    category: 'JDM',
    plate: 'MAYA-31',
    imageUrl: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=1200&auto=format&fit=crop',
    description: 'Projet tuning inspiré street show, couleur vive et setup drift.',
    isContestant: true,
    isDisqualified: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'comet-retro',
    eventId: demoEvent.id,
    name: 'Comet Retro Custom',
    ownerName: 'Kaïs',
    category: 'Classique sportive',
    plate: 'KAIS-88',
    imageUrl: 'https://images.unsplash.com/photo-1542362567-b07e54358753?q=80&w=1200&auto=format&fit=crop',
    description: 'Style clean, intérieur cuir, stance discret.',
    isContestant: true,
    isDisqualified: false,
    createdAt: new Date().toISOString(),
  },
];

export const demoVotes: Vote[] = [];
