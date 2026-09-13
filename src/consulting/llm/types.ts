/** A short reading of the city, small enough to send on every request. */
export interface CityBrief {
  /** The language the answer should be written in, as a locale code ('ko', 'en'). */
  locale: string;
  era: string;
  cityLevel: number;
  population: number;
  populationCapacity: number;
  jobs: number;
  happiness: number;
  gold: number;
  goldPerSecond: number;
  powerSupply: number;
  powerDemand: number;
  pollutedHomes: number;
  freeTiles: number;
  /** How many of each kind of building stand in the city. */
  buildings: Record<string, number>;
  /** What the local advisor noticed, by id. */
  notices: string[];
  /** The plans on offer. The model may only speak about these. */
  options: BriefOption[];
}

export interface BriefOption {
  id: string;
  kind: string;
  where?: string;
  cost: number;
  /** What the plan would put down, as building type names. */
  builds: string[];
}

/** What the model is asked to send back. */
export interface ConsultingReply {
  /** Two or three sentences about the city, in the player's language. */
  note: string;
  /** Plans worth a word, best first. Ids must come from the brief. */
  picks: { id: string; why: string }[];
}
