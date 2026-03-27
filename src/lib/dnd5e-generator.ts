import {
  type DnDCharacterSheet, type AbilityScores, type SavingThrows,
  getDefaultSheet, getAbilityModifier
} from '../types/dnd5e';

export type ClassName = 'Barbaro' | 'Bardo' | 'Chierico' | 'Druido' | 'Guerriero' | 'Monaco' | 'Paladino' | 'Ranger' | 'Ladro' | 'Stregone' | 'Warlock' | 'Mago';
export type SpeciesName = 'Umano' | 'Elfo' | 'Nano' | 'Halfling' | 'Dragonide' | 'Tiefling' | 'Orco' | 'Golia' | 'Gnomo' | 'Aasimar';
export type BackgroundName = 'Accolito' | 'Artigiano' | 'Ciarlatano' | 'Criminale' | 'Intrattenitore' | 'Contadino' | 'Guardia' | 'Guida' | 'Eremita' | 'Mercante' | 'Nobile' | 'Saggio' | 'Marinaio' | 'Scriba' | 'Soldato' | 'Viandante';

export interface GenOptions {
  level?: number;
  className?: ClassName;
  species?: SpeciesName;
  background?: BackgroundName;
  playerName?: string;
  characterName?: string;
}

export const CLASSES: Record<ClassName, { hd: number, primary: (keyof AbilityScores)[], saves: (keyof AbilityScores)[] }> = {
  'Barbaro': { hd: 12, primary: ['strength', 'constitution'], saves: ['strength', 'constitution'] },
  'Bardo': { hd: 8, primary: ['charisma', 'dexterity'], saves: ['dexterity', 'charisma'] },
  'Chierico': { hd: 8, primary: ['wisdom', 'constitution'], saves: ['wisdom', 'charisma'] },
  'Druido': { hd: 8, primary: ['wisdom', 'constitution'], saves: ['intelligence', 'wisdom'] },
  'Guerriero': { hd: 10, primary: ['strength', 'constitution'], saves: ['strength', 'constitution'] },
  'Monaco': { hd: 8, primary: ['dexterity', 'wisdom'], saves: ['strength', 'dexterity'] },
  'Paladino': { hd: 10, primary: ['strength', 'charisma'], saves: ['wisdom', 'charisma'] },
  'Ranger': { hd: 10, primary: ['dexterity', 'wisdom'], saves: ['strength', 'dexterity'] },
  'Ladro': { hd: 8, primary: ['dexterity', 'intelligence'], saves: ['dexterity', 'intelligence'] },
  'Stregone': { hd: 6, primary: ['charisma', 'constitution'], saves: ['constitution', 'charisma'] },
  'Warlock': { hd: 8, primary: ['charisma', 'dexterity'], saves: ['wisdom', 'charisma'] },
  'Mago': { hd: 6, primary: ['intelligence', 'dexterity'], saves: ['intelligence', 'wisdom'] },
};

export const SPECIES: Record<SpeciesName, { speed: number, traits: string }> = {
  'Umano': { speed: 30, traits: 'Talento bonus, Versatilità' },
  'Elfo': { speed: 30, traits: 'Scurovisione, Discendenza Fatata, Trance' },
  'Nano': { speed: 30, traits: 'Scurovisione, Resilienza Nanica, Percezione Tellurica (pietra)' },
  'Halfling': { speed: 30, traits: 'Fortunato, Coraggioso, Agilità Halfling' },
  'Dragonide': { speed: 30, traits: 'Arma a Soffio, Resistenza ai Danni, Scurovisione' },
  'Tiefling': { speed: 30, traits: 'Scurovisione, Resistenza Infernale, Eredità Oscura' },
  'Orco': { speed: 30, traits: 'Scurovisione, Scatto Adrenalinico, Resistenza Implacabile' },
  'Golia': { speed: 35, traits: 'Discendenza del Gigante, Corporatura Possente' },
  'Gnomo': { speed: 30, traits: 'Scurovisione, Astuzia Gnomesca' },
  'Aasimar': { speed: 30, traits: 'Scurovisione, Resistenza Celestiale, Rivelazione Celestiale' },
};

export const BACKGROUNDS: Record<BackgroundName, { boosts: (keyof AbilityScores)[], feat: string }> = {
  'Accolito': { boosts: ['intelligence', 'wisdom', 'charisma'], feat: 'Iniziato Magico (Chierico)' },
  'Artigiano': { boosts: ['strength', 'dexterity', 'intelligence'], feat: 'Fabbricante' },
  'Ciarlatano': { boosts: ['dexterity', 'constitution', 'charisma'], feat: 'Attore' },
  'Criminale': { boosts: ['dexterity', 'constitution', 'intelligence'], feat: 'Allerta' },
  'Intrattenitore': { boosts: ['strength', 'dexterity', 'charisma'], feat: 'Musico' },
  'Contadino': { boosts: ['strength', 'constitution', 'wisdom'], feat: 'Robusto' },
  'Guardia': { boosts: ['strength', 'intelligence', 'wisdom'], feat: 'Allerta' },
  'Guida': { boosts: ['dexterity', 'constitution', 'wisdom'], feat: 'Iniziato Magico (Druido)' },
  'Eremita': { boosts: ['constitution', 'wisdom', 'charisma'], feat: 'Guaritore' },
  'Mercante': { boosts: ['intelligence', 'wisdom', 'charisma'], feat: 'Fortunato' },
  'Nobile': { boosts: ['strength', 'intelligence', 'charisma'], feat: 'Skilled' },
  'Saggio': { boosts: ['constitution', 'intelligence', 'wisdom'], feat: 'Iniziato Magico (Mago)' },
  'Marinaio': { boosts: ['strength', 'dexterity', 'wisdom'], feat: 'Rissaiolo da Taverna' },
  'Scriba': { boosts: ['dexterity', 'intelligence', 'wisdom'], feat: 'Competente' },
  'Soldato': { boosts: ['strength', 'dexterity', 'constitution'], feat: 'Selvaggio Attaccante' },
  'Viandante': { boosts: ['dexterity', 'wisdom', 'charisma'], feat: 'Fortunato' },
};

const randomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export function generateCharacter(options?: GenOptions): DnDCharacterSheet {
  const sheet = getDefaultSheet();

  // 1. Resolve Constraints
  const level = options?.level || randomInt(1, 10);
  const className = options?.className || randomChoice(Object.keys(CLASSES) as ClassName[]);
  const speciesName = options?.species || randomChoice(Object.keys(SPECIES) as SpeciesName[]);
  const backgroundName = options?.background || randomChoice(Object.keys(BACKGROUNDS) as BackgroundName[]);

  const classData = CLASSES[className];
  const speciesData = SPECIES[speciesName];
  const bgData = BACKGROUNDS[backgroundName];

  sheet.character_name = options?.characterName || `Eroe ${speciesName}`;
  sheet.player_name = options?.playerName || '';
  sheet.class_level = `${className} ${level}`;
  sheet.race = speciesName;
  sheet.background = backgroundName;
  sheet.alignment = randomChoice(['Legale Buono', 'Neutrale Buono', 'Caotico Buono', 'Vero Neutrale', 'Caotico Neutrale']);
  sheet.speed = speciesData.speed;
  sheet.features_and_traits = `Privilegi di Specie (${speciesName}):\n${speciesData.traits}\n\nTalento di Origine (${backgroundName}):\n${bgData.feat}\n\n[Aggiungi manualmente i privilegi di classe per il livello ${level}]`;

  // 2. Ability Scores (Standard Array 15, 14, 13, 12, 10, 8)
  const array = [15, 14, 13, 12, 10, 8];
  const abilities: AbilityScores = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };
  const allAbilities: (keyof AbilityScores)[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  
  // Assign best scores to primary class abilities
  for (const pri of classData.primary) {
    if (array.length === 0) break;
    abilities[pri] = array.shift()!;
  }
  
  // Randomize the rest
  const remainingKeys = allAbilities.filter(k => classData.primary.indexOf(k) === -1);
  remainingKeys.sort(() => Math.random() - 0.5); // Shuffle
  for (const k of remainingKeys) {
    if (array.length === 0) break;
    abilities[k] = array.shift()!;
  }

  // 3. Background ASIs (2024 rules: +2 to one, +1 to another OR +1/+1/+1 from the background boost options)
  // We'll prioritize boosting the class primary stats if they align with the background, otherwise random from the 3.
  const boosts = [...bgData.boosts];
  boosts.sort((a, b) => {
    // Sort so primary abilities get the +2
    const aPri = classData.primary.includes(a) ? 1 : 0;
    const bPri = classData.primary.includes(b) ? 1 : 0;
    return bPri - aPri; 
  });
  // Apply +2 and +1
  abilities[boosts[0]] += 2;
  abilities[boosts[1]] += 1;
  
  sheet.ability_scores = abilities;

  // 4. Combat Stats
  sheet.proficiency_bonus = Math.ceil(level / 4) + 1;
  
  // HP: Max at lvl 1, Average rounded up for rest
  const conMod = getAbilityModifier(abilities.constitution);
  const avgHd = (classData.hd / 2) + 1;
  sheet.hit_point_maximum = classData.hd + conMod + (Math.max(0, level - 1) * Math.floor(avgHd + conMod));
  sheet.current_hit_points = sheet.hit_point_maximum;
  
  sheet.hit_dice_total = `${level}d${classData.hd}`;
  sheet.hit_dice_remaining = sheet.hit_dice_total;
  
  const dexMod = getAbilityModifier(abilities.dexterity);
  sheet.initiative = dexMod;
  
  // Base AC estimation
  if (classData.primary.includes('strength')) sheet.armor_class = 16; // Heavy/Medium armor roughly
  else if (classData.primary.includes('dexterity')) sheet.armor_class = 11 + dexMod; // Light armor
  else sheet.armor_class = 10 + dexMod; // Cloth

  // 5. Saving Throws
  const saves: SavingThrows = { strength: false, dexterity: false, constitution: false, intelligence: false, wisdom: false, charisma: false };
  for (const s of classData.saves) saves[s] = true;
  sheet.saving_throws = saves;

  // 6. Spellcasting (Basics mapped from class if applicable)
  if (['Bardo', 'Chierico', 'Druido', 'Paladino', 'Ranger', 'Stregone', 'Warlock', 'Mago'].includes(className)) {
    sheet.spellcasting_class = className;
    if (['Bardo', 'Paladino', 'Stregone', 'Warlock'].includes(className)) sheet.spellcasting_ability = 'Carisma';
    if (['Chierico', 'Druido', 'Ranger'].includes(className)) sheet.spellcasting_ability = 'Saggezza';
    if (className === 'Mago') sheet.spellcasting_ability = 'Intelligenza';
    
    // Convert to english key for dict match
    const abilKeyMap: Record<string, keyof AbilityScores> = {
      'Carisma': 'charisma', 'Saggezza': 'wisdom', 'Intelligenza': 'intelligence'
    };
    const key = abilKeyMap[sheet.spellcasting_ability];
    if (key) {
      const spellMod = getAbilityModifier(abilities[key]);
      sheet.spell_save_dc = 8 + sheet.proficiency_bonus + spellMod;
      sheet.spell_attack_bonus = sheet.proficiency_bonus + spellMod;
    }
  }

  // Generate some starting attacks
  if (classData.primary.includes('strength')) {
    const strMod = getAbilityModifier(abilities.strength);
    sheet.attacks.push({
      id: crypto.randomUUID(), name: 'Spada Lunga',
      bonus: `+${strMod + sheet.proficiency_bonus}`, damage: `1d8+${strMod} tagl`
    });
  } else if (classData.primary.includes('dexterity')) {
    const dexAttMod = getAbilityModifier(abilities.dexterity);
    sheet.attacks.push({
      id: crypto.randomUUID(), name: 'Arco Lungo / Stocco',
      bonus: `+${dexAttMod + sheet.proficiency_bonus}`, damage: `1d8+${dexAttMod} perf`
    });
  } else {
    // Caster
    sheet.attacks.push({
      id: crypto.randomUUID(), name: 'Dardo di Fuoco (Es.)',
      bonus: `+${sheet.spell_attack_bonus}`, damage: `1d10 fuoco`
    });
  }

  return sheet;
}
