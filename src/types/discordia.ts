// Discordia RPG Character Creation Types

export type SpeciesId = 'human' | 'dwarf' | 'elf' | 'kagari';
export type AttributeId = 'STR' | 'FIN' | 'AGI' | 'VIT' | 'SEN' | 'PRE' | 'MIN' | 'REA';
export type RoleId = 'warrior' | 'spellweaver' | 'mystic' | 'scout' | 'agent' | 'rogue';
export type PathId = 'arcanist' | 'archer' | 'arms_master' | 'beastmaster' | 'berserker' | 'paladin' | 'priest' | 'ranger' | 'sentinel' | 'summoner' | 'swashbuckler' | 'thief';
export type EssenceId = 'light' | 'shadow' | 'fire' | 'water' | 'earth' | 'air' | 'nature' | 'dream';
export type SkillId = 'charming' | 'climbing' | 'deceiving' | 'disguising' | 'enduring' | 'engineering' | 'evading' | 'focusing' | 'inferring' | 'investigating' | 'noticing' | 'nursing' | 'riding' | 'running' | 'sneaking' | 'swimming';
export type ArmorCategory = 'none' | 'light' | 'medium' | 'heavy';
export type WeaponCategory = 'light' | 'medium' | 'heavy';

export interface Species {
  id: SpeciesId;
  name: string;
  maxAge: number;
  height: { female: string; male: string };
  weight: { female: string; male: string };
  attributeAdjustments: Partial<Record<AttributeId, number>>;
  skillBonuses: { skillId: SkillId; bonus: number }[];
  freeSkillBonuses?: number; // humans get free choices
  freeAttributeBonus?: number; // humans get +1 to any
  speed: number;
  essenceChoices: EssenceId[][] | null; // arrays of options OR null
  essenceAlternative?: string;
  healthBonus: number;
  languages: string[];
  specialTraits: { name: string; description: string }[];
  curse?: string;
}

export interface Attribute {
  id: AttributeId;
  name: string;
  description: string;
}

export interface Role {
  id: RoleId;
  name: string;
  combatBonus: number;
  defenseBonus: number;
  competencyFormula: string;
  startingEssences: number;
  availablePaths: PathId[];
}

export interface PathLevelGain {
  level: number;
  combatBonus: number;
  defenseBonus: number;
  attributeBonus: number;
  healthBonus: number;
  abilities: string[];
  specialAbilityChoice: boolean;
}

export interface Path {
  id: PathId;
  name: string;
  roleId: RoleId;
  armorTraining: string;
  weaponTraining: string;
  bonusCompetencies: string[];
  equipmentPacks: string[];
  skillPointsPerLevel: number;
  essencesPerLevel: number;
  essenceOptions: EssenceId[];
  spells?: string[];
  levelProgression: PathLevelGain[];
  specialAbilities: string[];
}

export interface Skill {
  id: SkillId;
  name: string;
  attribute: AttributeId;
  description: string;
  passive: boolean;
}

export interface Weapon {
  name: string;
  category: WeaponCategory;
  hands: 1 | 2;
  damage: string;
  damageType: string;
  properties: string[];
  attribute: string;
  ranged: boolean;
}

export interface Armor {
  name: string;
  category: ArmorCategory;
  tier: number;
  armorPoints: number;
  movementPenalty: number;
  skillPenalty: number;
}

export interface Shield {
  name: string;
  defenseBonus: number;
}

export interface EquipmentPack {
  name: string;
  items: string[];
  weaponOptions: string[];
  armorOptions: string[];
}

export interface Competency {
  name: string;
  tier: 'general' | 'intermediate' | 'specialized';
}

// Character being created
export interface DiscordiaCharacter {
  name: string;
  playerName: string;
  level: number;
  species: SpeciesId | null;
  attributes: Record<AttributeId, number>;
  role: RoleId | null;
  path: PathId | null;
  skillPoints: Partial<Record<SkillId, number>>;
  competencies: Competency[];
  essences: EssenceId[];
  selectedSpells: string[];
  equipment: string[];
  equipmentPack: string | null;
  selectedWeapon: string | null;
  selectedArmor: string | null;
  selectedShield: string | null;
  // Derived stats
  combatBonus: number;
  defenseBonus: number;
  defense: number;
  armorPoints: number;
  speed: number;
  healthPoints: number;
  languages: string[];
  specialTraits: string[];
  notes: string;
}

export function getDefaultDiscordiaCharacter(): DiscordiaCharacter {
  return {
    name: '',
    playerName: '',
    level: 1,
    species: null,
    attributes: { STR: 0, FIN: 0, AGI: 0, VIT: 0, SEN: 0, PRE: 0, MIN: 0, REA: 0 },
    role: null,
    path: null,
    skillPoints: {},
    competencies: [],
    essences: [],
    selectedSpells: [],
    equipment: [],
    equipmentPack: null,
    selectedWeapon: null,
    selectedArmor: null,
    selectedShield: null,
    combatBonus: 0,
    defenseBonus: 0,
    defense: 10,
    armorPoints: 0,
    speed: 5,
    healthPoints: 0,
    languages: [],
    specialTraits: [],
    notes: '',
  };
}
