import { useState, useEffect, useRef } from 'react';
import type { Entity } from '../../lib/api';
import {
  type DnDCharacterSheet, type Skills, type AbilityScores, type SavingThrows,
  getDefaultSheet, getAbilityModifier, formatModifier, SKILL_ABILITY_MAP,
} from '../../types/dnd5e';
import { Swords, Shield, Heart, Zap, BookOpen, Plus, X, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { generateCharacter, type GenOptions } from '../../lib/dnd5e-generator';
import GenerateCharacterModal from './GenerateCharacterModal';

interface Props {
  entity: Entity;
  onChange: (updatedEntity: Entity) => void;
}

function parseSheet(sheetData?: string): DnDCharacterSheet {
  try {
    return sheetData ? { ...getDefaultSheet(), ...JSON.parse(sheetData) } : getDefaultSheet();
  } catch { return getDefaultSheet(); }
}

export default function CharacterSheet({ entity, onChange }: Props) {
  const [sheet, setSheet] = useState<DnDCharacterSheet>(() => parseSheet(entity.sheet_data));
  const isFirstRender = useRef(true);
  const entityRef = useRef(entity);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    abilities: true, combat: true, skills: true, attacks: true,
    personality: false, equipment: false, spells: false, features: false,
  });
  
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  const handleRunGenerator = (options: GenOptions) => {
    const newSheet = generateCharacter(options);
    setSheet(newSheet);
  };
  // Keep entityRef in sync with the latest entity prop
  entityRef.current = entity;

  // Sync sheet changes back to entity — skip the very first render
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const json = JSON.stringify(sheet);
    if (json !== entityRef.current.sheet_data) {
      onChange({ ...entityRef.current, sheet_data: json });
    }
  }, [sheet, onChange]);

  // If entity.id changes, re-parse
  useEffect(() => {
    isFirstRender.current = true;
    setSheet(parseSheet(entity.sheet_data));
  }, [entity.id]);

  const update = (partial: Partial<DnDCharacterSheet>) => setSheet(prev => ({ ...prev, ...partial }));
  const updateAbility = (key: keyof AbilityScores, value: number) =>
    update({ ability_scores: { ...sheet.ability_scores, [key]: value } });
  const toggleSave = (key: keyof SavingThrows) =>
    update({ saving_throws: { ...sheet.saving_throws, [key]: !sheet.saving_throws[key] } });
  const toggleSkill = (key: keyof Skills) =>
    update({ skills: { ...sheet.skills, [key]: !sheet.skills[key] } });

  const toggleSection = (key: string) =>
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const abilityNames: (keyof AbilityScores)[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  const abilityLabels: Record<keyof AbilityScores, string> = {
    strength: 'FOR', dexterity: 'DES', constitution: 'COS',
    intelligence: 'INT', wisdom: 'SAG', charisma: 'CAR',
  };

  // --- Render Helpers ---

  const SectionHeader = ({ id, icon: Icon, label }: { id: string; icon: any; label: string }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center gap-2 py-2 px-1 text-sm font-bold uppercase tracking-wider text-[#74b1be] hover:text-[#9ed0db] transition select-none"
    >
      {expandedSections[id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  // Ability score block
  const AbilityBlock = ({ ability }: { ability: keyof AbilityScores }) => {
    const score = sheet.ability_scores[ability];
    const mod = getAbilityModifier(score);
    return (
      <div className="flex flex-col items-center bg-[#0f1115] border border-[#2d3036] rounded-lg p-2 w-[72px] hover:border-[#74b1be] transition">
        <span className="text-[10px] uppercase font-bold text-[#8a8f98] tracking-wider mb-1">{abilityLabels[ability]}</span>
        <span className="text-lg font-bold text-[#74b1be]">{formatModifier(mod)}</span>
        <input
          type="number"
          value={score}
          onChange={e => updateAbility(ability, parseInt(e.target.value) || 0)}
          className="w-10 text-center bg-[#23252a] border border-[#2d3036] rounded text-xs text-[#e0e3eb] mt-1 outline-none focus:border-[#74b1be]"
        />
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-6 py-4">
      {/* === TOP ROW === */}
      <div className="flex justify-between items-end mb-4">
        <h3 className="text-lg font-bold text-[#e0e3eb]">Scheda D&D 5.5e</h3>
        <button
          onClick={() => setIsGeneratorOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#23252a] hover:bg-[#2d3036] text-[#74b1be] text-sm font-medium rounded-md border border-[#2d3036] hover:border-[#74b1be]/50 transition shadow-sm"
        >
          <Sparkles className="w-4 h-4" />
          Auto-Genera
        </button>
      </div>

      {/* === HEADER === */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <HeaderField label="Classe & Livello" value={sheet.class_level} onChange={v => update({ class_level: v })} />
        <HeaderField label="Razza" value={sheet.race} onChange={v => update({ race: v })} />
        <HeaderField label="Background" value={sheet.background} onChange={v => update({ background: v })} />
        <HeaderField label="Allineamento" value={sheet.alignment} onChange={v => update({ alignment: v })} />
        <HeaderField label="Punti Esperienza" value={String(sheet.experience_points)} onChange={v => update({ experience_points: parseInt(v) || 0 })} />
        <HeaderField label="Giocatore" value={sheet.player_name} onChange={v => update({ player_name: v })} />
      </div>

      <div className="border-t border-[#2d3036] my-3" />

      {/* === ABILITY SCORES === */}
      <SectionHeader id="abilities" icon={Zap} label="Caratteristiche" />
      {expandedSections.abilities && (
        <div className="mb-4">
          <div className="flex justify-between gap-2 mb-4">
            {abilityNames.map(a => <AbilityBlock key={a} ability={a} />)}
          </div>

          {/* Proficiency bonus & Inspiration */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8a8f98] font-semibold uppercase">Bonus Competenza</span>
              <input
                type="number"
                value={sheet.proficiency_bonus}
                onChange={e => update({ proficiency_bonus: parseInt(e.target.value) || 0 })}
                className="w-12 text-center bg-[#0f1115] border border-[#2d3036] rounded text-sm text-[#e0e3eb] p-1 outline-none focus:border-[#74b1be]"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={sheet.inspiration} onChange={() => update({ inspiration: !sheet.inspiration })}
                className="accent-[#74b1be]" />
              <span className="text-xs text-[#8a8f98] font-semibold uppercase">Ispirazione</span>
            </label>
          </div>

          {/* Saving Throws */}
          <div className="mb-3">
            <h4 className="text-xs font-bold text-[#8a8f98] uppercase tracking-wider mb-2">Tiri Salvezza</h4>
            <div className="grid grid-cols-3 gap-1">
              {abilityNames.map(a => {
                const mod = getAbilityModifier(sheet.ability_scores[a]) + (sheet.saving_throws[a] ? sheet.proficiency_bonus : 0);
                return (
                  <label key={a} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[#23252a] transition cursor-pointer">
                    <input type="checkbox" checked={sheet.saving_throws[a]} onChange={() => toggleSave(a)}
                      className="accent-[#74b1be]" />
                    <span className="text-xs text-[#e0e3eb] font-mono w-6 text-right">{formatModifier(mod)}</span>
                    <span className="text-xs text-[#8a8f98] capitalize">{abilityLabels[a]}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* === SKILLS === */}
      <SectionHeader id="skills" icon={BookOpen} label="Abilità" />
      {expandedSections.skills && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-0 mb-4">
          {(Object.keys(SKILL_ABILITY_MAP) as (keyof Skills)[]).map(skill => {
            const ability = SKILL_ABILITY_MAP[skill];
            const mod = getAbilityModifier(sheet.ability_scores[ability]) + (sheet.skills[skill] ? sheet.proficiency_bonus : 0);
            const label = skill.replace(/_/g, ' ');
            return (
              <label key={skill} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[#23252a] transition cursor-pointer">
                <input type="checkbox" checked={sheet.skills[skill]} onChange={() => toggleSkill(skill)}
                  className="accent-[#74b1be]" />
                <span className="text-xs text-[#e0e3eb] font-mono w-6 text-right">{formatModifier(mod)}</span>
                <span className="text-xs text-[#8a8f98] capitalize">{label}</span>
                <span className="text-[10px] text-[#4a4d5e] ml-auto uppercase">{abilityLabels[ability]}</span>
              </label>
            );
          })}
          <div className="col-span-2 flex items-center gap-2 mt-2 px-2">
            <span className="text-xs text-[#8a8f98] font-semibold uppercase">Percezione Passiva</span>
            <input
              type="number"
              value={sheet.passive_perception}
              onChange={e => update({ passive_perception: parseInt(e.target.value) || 0 })}
              className="w-12 text-center bg-[#0f1115] border border-[#2d3036] rounded text-sm text-[#e0e3eb] p-1 outline-none focus:border-[#74b1be]"
            />
          </div>
        </div>
      )}

      {/* === COMBAT === */}
      <SectionHeader id="combat" icon={Shield} label="Combattimento" />
      {expandedSections.combat && (
        <div className="mb-4">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <CombatStat label="CA" value={sheet.armor_class} onChange={v => update({ armor_class: v })} />
            <CombatStat label="Iniziativa" value={sheet.initiative} onChange={v => update({ initiative: v })} />
            <CombatStat label="Velocità" value={sheet.speed} onChange={v => update({ speed: v })} suffix=" ft" />
          </div>

          {/* Hit Points */}
          <div className="bg-[#0f1115] border border-[#2d3036] rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-red-400" />
              <span className="text-xs font-bold text-[#8a8f98] uppercase">Punti Ferita</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-[#4a4d5e] uppercase">Massimo</span>
                <input type="number" value={sheet.hit_point_maximum}
                  onChange={e => update({ hit_point_maximum: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[#23252a] border border-[#2d3036] rounded text-center text-sm text-[#e0e3eb] p-1 outline-none focus:border-[#74b1be]" />
              </div>
              <div>
                <span className="text-[10px] text-[#4a4d5e] uppercase">Attuali</span>
                <input type="number" value={sheet.current_hit_points}
                  onChange={e => update({ current_hit_points: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[#23252a] border border-[#2d3036] rounded text-center text-sm text-[#e0e3eb] p-1 outline-none focus:border-[#74b1be]" />
              </div>
              <div>
                <span className="text-[10px] text-[#4a4d5e] uppercase">Temporanei</span>
                <input type="number" value={sheet.temporary_hit_points}
                  onChange={e => update({ temporary_hit_points: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[#23252a] border border-[#2d3036] rounded text-center text-sm text-[#e0e3eb] p-1 outline-none focus:border-[#74b1be]" />
              </div>
            </div>
          </div>

          {/* Hit Dice & Death Saves */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-[#0f1115] border border-[#2d3036] rounded-lg p-3">
              <span className="text-xs font-bold text-[#8a8f98] uppercase block mb-2">Dadi Vita</span>
              <div className="flex gap-2">
                <div className="flex-1">
                  <span className="text-[10px] text-[#4a4d5e]">Totale</span>
                  <input value={sheet.hit_dice_total}
                    onChange={e => update({ hit_dice_total: e.target.value })}
                    className="w-full bg-[#23252a] border border-[#2d3036] rounded text-center text-xs text-[#e0e3eb] p-1 outline-none focus:border-[#74b1be]" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] text-[#4a4d5e]">Rimanenti</span>
                  <input value={sheet.hit_dice_remaining}
                    onChange={e => update({ hit_dice_remaining: e.target.value })}
                    className="w-full bg-[#23252a] border border-[#2d3036] rounded text-center text-xs text-[#e0e3eb] p-1 outline-none focus:border-[#74b1be]" />
                </div>
              </div>
            </div>
            <div className="bg-[#0f1115] border border-[#2d3036] rounded-lg p-3">
              <span className="text-xs font-bold text-[#8a8f98] uppercase block mb-2">Tiri Salvezza vs Morte</span>
              <div className="flex gap-4">
                <DeathSaveRow label="Successi" count={sheet.death_saves.successes} max={3}
                  onChange={n => update({ death_saves: { ...sheet.death_saves, successes: n } })} />
                <DeathSaveRow label="Fallimenti" count={sheet.death_saves.failures} max={3}
                  onChange={n => update({ death_saves: { ...sheet.death_saves, failures: n } })} color="red" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === ATTACKS === */}
      <SectionHeader id="attacks" icon={Swords} label="Attacchi" />
      {expandedSections.attacks && (
        <div className="mb-4">
          <div className="space-y-1">
            {sheet.attacks.length > 0 && (
              <div className="grid grid-cols-[1fr_80px_1fr_32px] gap-2 px-2 text-[10px] text-[#4a4d5e] uppercase font-bold">
                <span>Nome</span><span>Bonus</span><span>Danno</span><span />
              </div>
            )}
            {sheet.attacks.map((atk, i) => (
              <div key={atk.id} className="grid grid-cols-[1fr_80px_1fr_32px] gap-2 items-center">
                <input value={atk.name} onChange={e => { const a = [...sheet.attacks]; a[i] = { ...a[i], name: e.target.value }; update({ attacks: a }); }}
                  className="bg-[#0f1115] border border-[#2d3036] rounded text-xs text-[#e0e3eb] p-1.5 outline-none focus:border-[#74b1be]" />
                <input value={atk.bonus} onChange={e => { const a = [...sheet.attacks]; a[i] = { ...a[i], bonus: e.target.value }; update({ attacks: a }); }}
                  className="bg-[#0f1115] border border-[#2d3036] rounded text-xs text-[#e0e3eb] p-1.5 text-center outline-none focus:border-[#74b1be]" />
                <input value={atk.damage} onChange={e => { const a = [...sheet.attacks]; a[i] = { ...a[i], damage: e.target.value }; update({ attacks: a }); }}
                  className="bg-[#0f1115] border border-[#2d3036] rounded text-xs text-[#e0e3eb] p-1.5 outline-none focus:border-[#74b1be]" />
                <button onClick={() => update({ attacks: sheet.attacks.filter((_, j) => j !== i) })}
                  className="p-1 text-[#4a4d5e] hover:text-red-400 transition"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <button onClick={() => update({ attacks: [...sheet.attacks, { id: crypto.randomUUID(), name: '', bonus: '', damage: '' }] })}
            className="flex items-center gap-1 text-xs text-[#74b1be] hover:text-[#9ed0db] mt-2 transition">
            <Plus className="w-3.5 h-3.5" /> Aggiungi Attacco
          </button>
        </div>
      )}

      {/* === PERSONALITY === */}
      <SectionHeader id="personality" icon={BookOpen} label="Personalità" />
      {expandedSections.personality && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <TextBlock label="Tratti della Personalità" value={sheet.personality_traits}
            onChange={v => update({ personality_traits: v })} />
          <TextBlock label="Ideali" value={sheet.ideals} onChange={v => update({ ideals: v })} />
          <TextBlock label="Legami" value={sheet.bonds} onChange={v => update({ bonds: v })} />
          <TextBlock label="Difetti" value={sheet.flaws} onChange={v => update({ flaws: v })} />
        </div>
      )}

      {/* === FEATURES & TRAITS === */}
      <SectionHeader id="features" icon={Zap} label="Privilegi e Tratti" />
      {expandedSections.features && (
        <div className="mb-4">
          <textarea value={sheet.features_and_traits}
            onChange={e => update({ features_and_traits: e.target.value })}
            className="w-full bg-[#0f1115] border border-[#2d3036] rounded-lg p-3 text-sm text-[#e0e3eb] min-h-[120px] outline-none focus:border-[#74b1be] resize-y"
            placeholder="Privilegi di classe, tratti razziali, talenti..." />
          <textarea value={sheet.other_proficiencies_and_languages}
            onChange={e => update({ other_proficiencies_and_languages: e.target.value })}
            className="w-full bg-[#0f1115] border border-[#2d3036] rounded-lg p-3 text-sm text-[#e0e3eb] min-h-[80px] outline-none focus:border-[#74b1be] resize-y mt-2"
            placeholder="Altre competenze e lingue..." />
        </div>
      )}

      {/* === EQUIPMENT === */}
      <SectionHeader id="equipment" icon={Shield} label="Equipaggiamento" />
      {expandedSections.equipment && (
        <div className="mb-4">
          {/* Currency */}
          <div className="flex gap-2 mb-3">
            {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map(c => (
              <div key={c} className="flex flex-col items-center">
                <span className="text-[10px] text-[#4a4d5e] uppercase font-bold mb-1">{c}</span>
                <input type="number" value={sheet.currency[c]}
                  onChange={e => update({ currency: { ...sheet.currency, [c]: parseInt(e.target.value) || 0 } })}
                  className="w-14 text-center bg-[#0f1115] border border-[#2d3036] rounded text-xs text-[#e0e3eb] p-1 outline-none focus:border-[#74b1be]" />
              </div>
            ))}
          </div>

          {/* Item List */}
          <div className="space-y-1">
            {sheet.equipment.length > 0 && (
              <div className="grid grid-cols-[1fr_60px_60px_32px] gap-2 px-2 text-[10px] text-[#4a4d5e] uppercase font-bold">
                <span>Oggetto</span><span>Qtà</span><span>Peso</span><span />
              </div>
            )}
            {sheet.equipment.map((item, i) => (
              <div key={item.id} className="grid grid-cols-[1fr_60px_60px_32px] gap-2 items-center">
                <input value={item.name} onChange={e => { const eq = [...sheet.equipment]; eq[i] = { ...eq[i], name: e.target.value }; update({ equipment: eq }); }}
                  className="bg-[#0f1115] border border-[#2d3036] rounded text-xs text-[#e0e3eb] p-1.5 outline-none focus:border-[#74b1be]" />
                <input type="number" value={item.quantity} onChange={e => { const eq = [...sheet.equipment]; eq[i] = { ...eq[i], quantity: parseInt(e.target.value) || 0 }; update({ equipment: eq }); }}
                  className="bg-[#0f1115] border border-[#2d3036] rounded text-xs text-[#e0e3eb] p-1.5 text-center outline-none focus:border-[#74b1be]" />
                <input type="number" value={item.weight} onChange={e => { const eq = [...sheet.equipment]; eq[i] = { ...eq[i], weight: parseFloat(e.target.value) || 0 }; update({ equipment: eq }); }}
                  className="bg-[#0f1115] border border-[#2d3036] rounded text-xs text-[#e0e3eb] p-1.5 text-center outline-none focus:border-[#74b1be]" />
                <button onClick={() => update({ equipment: sheet.equipment.filter((_, j) => j !== i) })}
                  className="p-1 text-[#4a4d5e] hover:text-red-400 transition"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <button onClick={() => update({ equipment: [...sheet.equipment, { id: crypto.randomUUID(), name: '', quantity: 1, weight: 0 }] })}
            className="flex items-center gap-1 text-xs text-[#74b1be] hover:text-[#9ed0db] mt-2 transition">
            <Plus className="w-3.5 h-3.5" /> Aggiungi Oggetto
          </button>
        </div>
      )}

      {/* === SPELLS === */}
      <SectionHeader id="spells" icon={BookOpen} label="Incantesimi" />
      {expandedSections.spells && (
        <div className="mb-4">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <HeaderField label="Classe Incantatore" value={sheet.spellcasting_class} onChange={v => update({ spellcasting_class: v })} />
            <HeaderField label="Caratteristica" value={sheet.spellcasting_ability} onChange={v => update({ spellcasting_ability: v })} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-[#4a4d5e] uppercase block mb-1">CD Salvezza</span>
                <input type="number" value={sheet.spell_save_dc}
                  onChange={e => update({ spell_save_dc: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[#0f1115] border border-[#2d3036] rounded text-center text-xs text-[#e0e3eb] p-1.5 outline-none focus:border-[#74b1be]" />
              </div>
              <div>
                <span className="text-[10px] text-[#4a4d5e] uppercase block mb-1">Bonus Attacco</span>
                <input type="number" value={sheet.spell_attack_bonus}
                  onChange={e => update({ spell_attack_bonus: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[#0f1115] border border-[#2d3036] rounded text-center text-xs text-[#e0e3eb] p-1.5 outline-none focus:border-[#74b1be]" />
              </div>
            </div>
          </div>

          {/* Spell Slots */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => (
              <div key={lvl} className="flex flex-col items-center bg-[#0f1115] border border-[#2d3036] rounded p-1.5 min-w-[48px]">
                <span className="text-[10px] text-[#74b1be] font-bold">Lv{lvl}</span>
                <div className="flex gap-1 mt-1">
                  <input type="number" value={sheet.spell_slots[lvl]?.used ?? 0}
                    onChange={e => update({ spell_slots: { ...sheet.spell_slots, [lvl]: { ...sheet.spell_slots[lvl], used: parseInt(e.target.value) || 0 } } })}
                    className="w-6 text-center bg-[#23252a] border border-[#2d3036] rounded text-[10px] text-[#e0e3eb] outline-none" />
                  <span className="text-[10px] text-[#4a4d5e]">/</span>
                  <input type="number" value={sheet.spell_slots[lvl]?.total ?? 0}
                    onChange={e => update({ spell_slots: { ...sheet.spell_slots, [lvl]: { ...sheet.spell_slots[lvl], total: parseInt(e.target.value) || 0 } } })}
                    className="w-6 text-center bg-[#23252a] border border-[#2d3036] rounded text-[10px] text-[#e0e3eb] outline-none" />
                </div>
              </div>
            ))}
          </div>

          {/* Spell List */}
          <div className="space-y-1">
            {sheet.spells.length > 0 && (
              <div className="grid grid-cols-[32px_1fr_60px_32px] gap-2 px-2 text-[10px] text-[#4a4d5e] uppercase font-bold">
                <span>Prep</span><span>Nome</span><span>Livello</span><span />
              </div>
            )}
            {sheet.spells.map((spell, i) => (
              <div key={spell.id} className="grid grid-cols-[32px_1fr_60px_32px] gap-2 items-center">
                <input type="checkbox" checked={spell.prepared}
                  onChange={() => { const s = [...sheet.spells]; s[i] = { ...s[i], prepared: !s[i].prepared }; update({ spells: s }); }}
                  className="accent-[#74b1be] justify-self-center" />
                <input value={spell.name} onChange={e => { const s = [...sheet.spells]; s[i] = { ...s[i], name: e.target.value }; update({ spells: s }); }}
                  className="bg-[#0f1115] border border-[#2d3036] rounded text-xs text-[#e0e3eb] p-1.5 outline-none focus:border-[#74b1be]" />
                <select value={spell.level} onChange={e => { const s = [...sheet.spells]; s[i] = { ...s[i], level: parseInt(e.target.value) }; update({ spells: s }); }}
                  className="bg-[#0f1115] border border-[#2d3036] rounded text-xs text-[#e0e3eb] p-1 outline-none focus:border-[#74b1be]">
                  <option value={0}>Trucco</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => <option key={l} value={l}>Lv {l}</option>)}
                </select>
                <button onClick={() => update({ spells: sheet.spells.filter((_, j) => j !== i) })}
                  className="p-1 text-[#4a4d5e] hover:text-red-400 transition"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <button onClick={() => update({ spells: [...sheet.spells, { id: crypto.randomUUID(), name: '', level: 0, prepared: false }] })}
            className="flex items-center gap-1 text-xs text-[#74b1be] hover:text-[#9ed0db] mt-2 transition">
            <Plus className="w-3.5 h-3.5" /> Aggiungi Incantesimo
          </button>
        </div>
      )}

      {/* Modals */}
      <GenerateCharacterModal 
        isOpen={isGeneratorOpen} 
        onClose={() => setIsGeneratorOpen(false)} 
        onGenerate={handleRunGenerator} 
      />
    </div>
  );
}

// --- Sub-components ---

function HeaderField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="text-[10px] text-[#4a4d5e] uppercase font-bold block mb-1">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-[#0f1115] border border-[#2d3036] rounded text-sm text-[#e0e3eb] p-1.5 outline-none focus:border-[#74b1be]" />
    </div>
  );
}

function CombatStat({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="bg-[#0f1115] border border-[#2d3036] rounded-lg p-3 flex flex-col items-center hover:border-[#74b1be] transition">
      <span className="text-[10px] text-[#4a4d5e] uppercase font-bold mb-1">{label}</span>
      <div className="flex items-baseline gap-0.5">
        <input type="number" value={value} onChange={e => onChange(parseInt(e.target.value) || 0)}
          className="w-14 text-center bg-transparent text-xl font-bold text-[#e0e3eb] outline-none" />
        {suffix && <span className="text-[10px] text-[#4a4d5e]">{suffix}</span>}
      </div>
    </div>
  );
}

function TextBlock({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="text-[10px] text-[#4a4d5e] uppercase font-bold block mb-1">{label}</span>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-[#0f1115] border border-[#2d3036] rounded-lg p-2 text-xs text-[#e0e3eb] min-h-[60px] outline-none focus:border-[#74b1be] resize-y"
        placeholder={label + '...'} />
    </div>
  );
}

function DeathSaveRow({ label, count, max, onChange, color }: { label: string; count: number; max: number; onChange: (n: number) => void; color?: string }) {
  const c = color === 'red' ? 'accent-red-400' : 'accent-[#74b1be]';
  return (
    <div>
      <span className="text-[10px] text-[#4a4d5e] block mb-1">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <input key={i} type="checkbox" checked={i < count}
            onChange={() => onChange(i < count ? i : i + 1)}
            className={c} />
        ))}
      </div>
    </div>
  );
}
