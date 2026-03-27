// D&D 5.5e Character Sheet Types

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface SavingThrows {
  strength: boolean;
  dexterity: boolean;
  constitution: boolean;
  intelligence: boolean;
  wisdom: boolean;
  charisma: boolean;
}

export interface Skills {
  acrobatics: boolean;
  animal_handling: boolean;
  arcana: boolean;
  athletics: boolean;
  deception: boolean;
  history: boolean;
  insight: boolean;
  intimidation: boolean;
  investigation: boolean;
  medicine: boolean;
  nature: boolean;
  perception: boolean;
  performance: boolean;
  persuasion: boolean;
  religion: boolean;
  sleight_of_hand: boolean;
  stealth: boolean;
  survival: boolean;
}

export interface DeathSaves {
  successes: number; // 0-3
  failures: number;  // 0-3
}

export interface Attack {
  id: string;
  name: string;
  bonus: string;
  damage: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  weight: number;
}

export interface SpellSlot {
  total: number;
  used: number;
}

export interface Spell {
  id: string;
  name: string;
  level: number; // 0 = cantrip
  prepared: boolean;
}

export interface Currency {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

export interface DnDCharacterSheet {
  // Header
  character_name: string;
  class_level: string;
  background: string;
  player_name: string;
  race: string;
  alignment: string;
  experience_points: number;

  // Core Stats
  ability_scores: AbilityScores;
  inspiration: boolean;
  proficiency_bonus: number;
  saving_throws: SavingThrows;
  skills: Skills;

  // Combat
  armor_class: number;
  initiative: number;
  speed: number;
  hit_point_maximum: number;
  current_hit_points: number;
  temporary_hit_points: number;
  hit_dice_total: string;
  hit_dice_remaining: string;
  death_saves: DeathSaves;

  // Attacks
  attacks: Attack[];

  // Features & Traits
  personality_traits: string;
  ideals: string;
  bonds: string;
  flaws: string;
  features_and_traits: string;

  // Equipment
  equipment: InventoryItem[];
  currency: Currency;

  // Spellcasting
  spellcasting_class: string;
  spellcasting_ability: string;
  spell_save_dc: number;
  spell_attack_bonus: number;
  spell_slots: Record<number, SpellSlot>; // level 1-9
  spells: Spell[];

  // Other
  other_proficiencies_and_languages: string;
  passive_perception: number;
}

export function getDefaultSheet(): DnDCharacterSheet {
  return {
    character_name: '',
    class_level: '',
    background: '',
    player_name: '',
    race: '',
    alignment: '',
    experience_points: 0,
    ability_scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    inspiration: false,
    proficiency_bonus: 2,
    saving_throws: { strength: false, dexterity: false, constitution: false, intelligence: false, wisdom: false, charisma: false },
    skills: {
      acrobatics: false, animal_handling: false, arcana: false, athletics: false,
      deception: false, history: false, insight: false, intimidation: false,
      investigation: false, medicine: false, nature: false, perception: false,
      performance: false, persuasion: false, religion: false, sleight_of_hand: false,
      stealth: false, survival: false,
    },
    armor_class: 10,
    initiative: 0,
    speed: 30,
    hit_point_maximum: 10,
    current_hit_points: 10,
    temporary_hit_points: 0,
    hit_dice_total: '1d8',
    hit_dice_remaining: '1d8',
    death_saves: { successes: 0, failures: 0 },
    attacks: [],
    personality_traits: '',
    ideals: '',
    bonds: '',
    flaws: '',
    features_and_traits: '',
    equipment: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    spellcasting_class: '',
    spellcasting_ability: '',
    spell_save_dc: 0,
    spell_attack_bonus: 0,
    spell_slots: {
      1: { total: 0, used: 0 }, 2: { total: 0, used: 0 }, 3: { total: 0, used: 0 },
      4: { total: 0, used: 0 }, 5: { total: 0, used: 0 }, 6: { total: 0, used: 0 },
      7: { total: 0, used: 0 }, 8: { total: 0, used: 0 }, 9: { total: 0, used: 0 },
    },
    spells: [],
    other_proficiencies_and_languages: '',
    passive_perception: 10,
  };
}

export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// Maps skills to their governing ability
export const SKILL_ABILITY_MAP: Record<keyof Skills, keyof AbilityScores> = {
  acrobatics: 'dexterity',
  animal_handling: 'wisdom',
  arcana: 'intelligence',
  athletics: 'strength',
  deception: 'charisma',
  history: 'intelligence',
  insight: 'wisdom',
  intimidation: 'charisma',
  investigation: 'intelligence',
  medicine: 'wisdom',
  nature: 'intelligence',
  perception: 'wisdom',
  performance: 'charisma',
  persuasion: 'charisma',
  religion: 'intelligence',
  sleight_of_hand: 'dexterity',
  stealth: 'dexterity',
  survival: 'wisdom',
};
