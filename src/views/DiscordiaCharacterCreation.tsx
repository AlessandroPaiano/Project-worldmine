import { useState, useMemo } from 'react';
import { BookOpen, Wand2, ChevronLeft, ChevronRight, Check, RotateCcw } from 'lucide-react';
import type { DiscordiaCharacter, SpeciesId, RoleId, PathId, AttributeId, SkillId, EssenceId, Competency } from '../types/discordia';
import { getDefaultDiscordiaCharacter } from '../types/discordia';
import {
  SPECIES, ATTRIBUTES, ROLES, PATHS, SKILLS, WEAPONS, ARMORS, SHIELDS,
  EQUIPMENT_PACKS, ANIMAL_COMPANIONS, ESSENCE_NAMES, ATTRIBUTE_POINT_BUDGET,
} from '../lib/discordia-data';

type CreationMode = 'select' | 'guided' | 'freeform';

const STEP_LABELS = [
  'Specie',
  'Attributi',
  'Ruolo',
  'Cammino',
  'Abilita',
  'Competenze',
  'Equipaggiamento',
  'Riepilogo',
];

// ─── Shared Sub-Components ───

function SpeciesPanel({ char, onChange }: { char: DiscordiaCharacter; onChange: (c: DiscordiaCharacter) => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#74b1be]">Step 1: Scegli la Specie</h3>
      <div className="grid grid-cols-2 gap-3">
        {SPECIES.map(sp => {
          const selected = char.species === sp.id;
          return (
            <button
              key={sp.id}
              onClick={() => {
                const next = { ...char, species: sp.id as SpeciesId, speed: sp.speed, languages: [...sp.languages] };
                // apply attribute adjustments
                const attrs = { ...getDefaultDiscordiaCharacter().attributes };
                Object.entries(sp.attributeAdjustments).forEach(([k, v]) => { attrs[k as AttributeId] += v!; });
                next.attributes = attrs;
                next.specialTraits = sp.specialTraits.map(t => t.name);
                onChange(next);
              }}
              className={`p-4 rounded-lg border text-left transition-all ${
                selected
                  ? 'border-[#74b1be] bg-[#74b1be]/10 shadow-md'
                  : 'border-[#2d3036] bg-[#23252a] hover:border-[#74b1be]/40'
              }`}
            >
              <div className="font-bold text-[#e0e3eb]">{sp.name}</div>
              <div className="text-xs text-[#8a8f98] mt-1">Eta max: {sp.maxAge} | Vel: {sp.speed}</div>
              <div className="text-xs text-[#8a8f98]">
                {Object.entries(sp.attributeAdjustments).map(([k, v]) => `${k} ${v! > 0 ? '+' : ''}${v}`).join(', ') || 'Nessun bonus fisso'}
              </div>
              {sp.curse && <div className="text-xs text-red-400 mt-1 italic">{sp.curse}</div>}
            </button>
          );
        })}
      </div>
      {char.species && (() => {
        const sp = SPECIES.find(s => s.id === char.species)!;
        return (
          <div className="mt-4 p-4 rounded-lg bg-[#181a1f] border border-[#2d3036]">
            <h4 className="font-semibold text-[#e0e3eb] mb-2">Dettagli: {sp.name}</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-[#8a8f98]">
              <div>Altezza: {sp.height.male} (m) / {sp.height.female} (f)</div>
              <div>Peso: {sp.weight.male} (m) / {sp.weight.female} (f)</div>
              <div>Lingue: {sp.languages.join(', ')}</div>
              <div>Bonus PV: {sp.healthBonus}</div>
            </div>
            <div className="mt-2">
              <span className="text-xs font-semibold text-[#74b1be]">Tratti Speciali:</span>
              {sp.specialTraits.map(t => (
                <div key={t.name} className="text-xs text-[#8a8f98] ml-2">
                  <span className="text-[#e0e3eb] font-medium">{t.name}:</span> {t.description}
                </div>
              ))}
            </div>
            {sp.skillBonuses.length > 0 && (
              <div className="mt-2 text-xs text-[#8a8f98]">
                <span className="font-semibold text-[#74b1be]">Bonus Abilita: </span>
                {sp.skillBonuses.map(b => `${SKILLS.find(s => s.id === b.skillId)?.name} +${b.bonus}`).join(', ')}
              </div>
            )}
            {sp.essenceChoices && (
              <div className="mt-2 text-xs text-[#8a8f98]">
                <span className="font-semibold text-[#74b1be]">Essenze: </span>
                {sp.essenceChoices.map(opts => opts.map(e => ESSENCE_NAMES[e]).join('/')).join(' oppure ')}
                {sp.essenceAlternative && ` oppure ${sp.essenceAlternative}`}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function AttributesPanel({ char, onChange }: { char: DiscordiaCharacter; onChange: (c: DiscordiaCharacter) => void }) {
  const species = SPECIES.find(s => s.id === char.species);
  const baseAdj = species?.attributeAdjustments || {};
  const spent = ATTRIBUTES.reduce((sum, a) => sum + Math.max(0, char.attributes[a.id] - (baseAdj[a.id] || 0)), 0);
  const remaining = ATTRIBUTE_POINT_BUDGET - spent;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#74b1be]">Step 2: Assegna Attributi</h3>
      <div className="text-sm text-[#8a8f98]">
        Punti rimanenti: <span className={`font-bold ${remaining < 0 ? 'text-red-400' : 'text-[#74b1be]'}`}>{remaining}</span> / {ATTRIBUTE_POINT_BUDGET}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ATTRIBUTES.map(attr => {
          const base = baseAdj[attr.id] || 0;
          const allocated = char.attributes[attr.id] - base;
          return (
            <div key={attr.id} className="p-3 rounded-lg bg-[#23252a] border border-[#2d3036]">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="font-bold text-[#e0e3eb] text-sm">{attr.name}</span>
                  <span className="text-xs text-[#8a8f98] ml-1">({attr.id})</span>
                </div>
                <span className="text-lg font-bold text-[#74b1be]">{char.attributes[attr.id]}</span>
              </div>
              <div className="text-xs text-[#8a8f98] mb-2">{attr.description}</div>
              {base !== 0 && <div className="text-xs text-yellow-500 mb-1">Bonus specie: {base > 0 ? '+' : ''}{base}</div>}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (allocated <= 0) return;
                    const next = { ...char, attributes: { ...char.attributes, [attr.id]: char.attributes[attr.id] - 1 } };
                    onChange(next);
                  }}
                  disabled={allocated <= 0}
                  className="w-7 h-7 rounded bg-[#181a1f] border border-[#2d3036] text-[#e0e3eb] disabled:opacity-30 hover:border-[#74b1be] transition-colors flex items-center justify-center"
                >-</button>
                <div className="text-xs text-[#8a8f98]">+{allocated}</div>
                <button
                  onClick={() => {
                    if (remaining <= 0) return;
                    const next = { ...char, attributes: { ...char.attributes, [attr.id]: char.attributes[attr.id] + 1 } };
                    onChange(next);
                  }}
                  disabled={remaining <= 0}
                  className="w-7 h-7 rounded bg-[#181a1f] border border-[#2d3036] text-[#e0e3eb] disabled:opacity-30 hover:border-[#74b1be] transition-colors flex items-center justify-center"
                >+</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RolePanel({ char, onChange }: { char: DiscordiaCharacter; onChange: (c: DiscordiaCharacter) => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#74b1be]">Step 3: Scegli il Ruolo</h3>
      <div className="grid grid-cols-2 gap-3">
        {ROLES.map(role => {
          const selected = char.role === role.id;
          return (
            <button
              key={role.id}
              onClick={() => {
                const next = {
                  ...char,
                  role: role.id as RoleId,
                  path: null,
                  combatBonus: role.combatBonus,
                  defenseBonus: role.defenseBonus,
                };
                onChange(next);
              }}
              className={`p-4 rounded-lg border text-left transition-all ${
                selected
                  ? 'border-[#74b1be] bg-[#74b1be]/10 shadow-md'
                  : 'border-[#2d3036] bg-[#23252a] hover:border-[#74b1be]/40'
              }`}
            >
              <div className="font-bold text-[#e0e3eb]">{role.name}</div>
              <div className="text-xs text-[#8a8f98] mt-1 space-y-0.5">
                <div>Combattimento: +{role.combatBonus} | Difesa: +{role.defenseBonus}</div>
                <div>Competenze: {role.competencyFormula}</div>
                <div>Essenze iniziali: {role.startingEssences}</div>
                <div>Cammini: {role.availablePaths.map(p => PATHS.find(pp => pp.id === p)?.name).join(', ')}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PathPanel({ char, onChange }: { char: DiscordiaCharacter; onChange: (c: DiscordiaCharacter) => void }) {
  const role = ROLES.find(r => r.id === char.role);
  const availablePaths = role ? PATHS.filter(p => role.availablePaths.includes(p.id)) : PATHS;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#74b1be]">Step 4: Scegli il Cammino</h3>
      {!char.role && <div className="text-sm text-yellow-500">Seleziona prima un Ruolo per filtrare i cammini disponibili.</div>}
      <div className="space-y-3">
        {availablePaths.map(path => {
          const selected = char.path === path.id;
          return (
            <button
              key={path.id}
              onClick={() => {
                onChange({ ...char, path: path.id as PathId, equipmentPack: null, selectedWeapon: null, selectedArmor: null });
              }}
              className={`w-full p-4 rounded-lg border text-left transition-all ${
                selected
                  ? 'border-[#74b1be] bg-[#74b1be]/10 shadow-md'
                  : 'border-[#2d3036] bg-[#23252a] hover:border-[#74b1be]/40'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="font-bold text-[#e0e3eb]">{path.name}</div>
                <div className="text-xs text-[#8a8f98]">{ROLES.find(r => r.id === path.roleId)?.name}</div>
              </div>
              <div className="text-xs text-[#8a8f98] mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                <div>Armatura: {path.armorTraining}</div>
                <div>Armi: {path.weaponTraining}</div>
                <div>Abilita/livello: {path.skillPointsPerLevel}</div>
                <div>Essenze/livello: {path.essencesPerLevel}</div>
                {path.bonusCompetencies.length > 0 && <div className="col-span-2">Competenze bonus: {path.bonusCompetencies.join(', ')}</div>}
              </div>
              {selected && (
                <div className="mt-3 pt-3 border-t border-[#2d3036]">
                  <div className="text-xs font-semibold text-[#74b1be] mb-1">Progressione per Livello:</div>
                  {path.levelProgression.map(lp => (
                    <div key={lp.level} className="text-xs text-[#8a8f98] flex gap-2">
                      <span className="text-[#e0e3eb] font-medium w-8">Lv{lp.level}</span>
                      <span>
                        {[
                          lp.combatBonus > 0 && `+${lp.combatBonus} Comb`,
                          lp.defenseBonus > 0 && `+${lp.defenseBonus} Dif`,
                          lp.attributeBonus > 0 && `+${lp.attributeBonus} Attr`,
                          lp.healthBonus > 0 && `+${lp.healthBonus} PV`,
                          ...lp.abilities,
                          lp.specialAbilityChoice && 'Scegli Abilita Speciale',
                        ].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  ))}
                  <div className="mt-2 text-xs font-semibold text-[#74b1be]">Abilita Speciali:</div>
                  <div className="text-xs text-[#8a8f98] flex flex-wrap gap-1 mt-1">
                    {path.specialAbilities.map(a => (
                      <span key={a} className="px-2 py-0.5 rounded bg-[#181a1f] border border-[#2d3036]">{a}</span>
                    ))}
                  </div>
                  {path.spells && (
                    <>
                      <div className="mt-2 text-xs font-semibold text-[#74b1be]">Incantesimi Disponibili:</div>
                      <div className="text-xs text-[#8a8f98] flex flex-wrap gap-1 mt-1">
                        {path.spells.map(s => (
                          <span key={s} className="px-2 py-0.5 rounded bg-[#181a1f] border border-[#2d3036]">{s}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SkillsPanel({ char, onChange }: { char: DiscordiaCharacter; onChange: (c: DiscordiaCharacter) => void }) {
  const path = PATHS.find(p => p.id === char.path);
  const totalPoints = path ? path.skillPointsPerLevel : 5;
  const species = SPECIES.find(s => s.id === char.species);
  const humanBonus = species?.id === 'human' ? 2 : 0;
  const budget = totalPoints + humanBonus;
  const spent = Object.values(char.skillPoints).reduce((s, v) => s + (v || 0), 0);
  const remaining = budget - spent;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#74b1be]">Step 5: Assegna Punti Abilita</h3>
      <div className="text-sm text-[#8a8f98]">
        Punti rimanenti: <span className={`font-bold ${remaining < 0 ? 'text-red-400' : 'text-[#74b1be]'}`}>{remaining}</span> / {budget}
        <span className="ml-2 text-xs">(Max per abilita = livello del personaggio: {char.level})</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SKILLS.map(skill => {
          const speciesBonus = species?.skillBonuses.find(b => b.skillId === skill.id)?.bonus || 0;
          const allocated = char.skillPoints[skill.id] || 0;
          const total = char.attributes[skill.attribute] + allocated + speciesBonus;
          return (
            <div key={skill.id} className="p-2 rounded bg-[#23252a] border border-[#2d3036] flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-[#e0e3eb] truncate">{skill.name}</span>
                  <span className="text-xs text-[#8a8f98]">({skill.attribute})</span>
                  {skill.passive && <span className="text-xs text-yellow-500 ml-1">P</span>}
                </div>
                <div className="text-xs text-[#8a8f98]">
                  Tot: {total}
                  {speciesBonus > 0 && <span className="text-yellow-500 ml-1">(+{speciesBonus} specie)</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => {
                    if (allocated <= 0) return;
                    onChange({ ...char, skillPoints: { ...char.skillPoints, [skill.id]: allocated - 1 } });
                  }}
                  disabled={allocated <= 0}
                  className="w-6 h-6 rounded bg-[#181a1f] border border-[#2d3036] text-[#e0e3eb] disabled:opacity-30 hover:border-[#74b1be] transition-colors text-xs flex items-center justify-center"
                >-</button>
                <span className="w-5 text-center text-sm text-[#74b1be] font-bold">{allocated}</span>
                <button
                  onClick={() => {
                    if (remaining <= 0 || allocated >= char.level) return;
                    onChange({ ...char, skillPoints: { ...char.skillPoints, [skill.id]: allocated + 1 } });
                  }}
                  disabled={remaining <= 0 || allocated >= char.level}
                  className="w-6 h-6 rounded bg-[#181a1f] border border-[#2d3036] text-[#e0e3eb] disabled:opacity-30 hover:border-[#74b1be] transition-colors text-xs flex items-center justify-center"
                >+</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompetenciesPanel({ char, onChange }: { char: DiscordiaCharacter; onChange: (c: DiscordiaCharacter) => void }) {
  const role = ROLES.find(r => r.id === char.role);
  const path = PATHS.find(p => p.id === char.path);
  const reaValue = char.attributes.REA;
  const baseCount = role?.id === 'rogue' ? 7 + reaValue : 5 + reaValue;
  const bonusComps = path?.bonusCompetencies || [];
  const [newComp, setNewComp] = useState('');
  const [newTier, setNewTier] = useState<'general' | 'intermediate' | 'specialized'>('general');

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#74b1be]">Step 6: Competenze</h3>
      <div className="text-sm text-[#8a8f98]">
        Competenze disponibili: <span className="font-bold text-[#74b1be]">{baseCount}</span> (formula: {role?.competencyFormula || '5 + REA'})
        {bonusComps.length > 0 && <span className="ml-2">+ Bonus cammino: {bonusComps.join(', ')}</span>}
      </div>
      <div className="text-xs text-[#8a8f98] p-3 rounded bg-[#181a1f] border border-[#2d3036]">
        <div className="font-semibold text-[#e0e3eb] mb-1">Livelli di Competenza:</div>
        <div><span className="text-[#74b1be]">Generale</span> (+1 vantaggio) - Conoscenza ampia</div>
        <div><span className="text-[#74b1be]">Intermedia</span> (+2 vantaggio) - Conoscenza approfondita</div>
        <div><span className="text-[#74b1be]">Specializzata</span> (+3 vantaggio) - Conoscenza focalizzata</div>
      </div>

      {bonusComps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-[#8a8f98]">Bonus dal Cammino:</span>
          {bonusComps.map(c => (
            <span key={c} className="px-2 py-0.5 rounded bg-[#74b1be]/10 border border-[#74b1be]/30 text-xs text-[#74b1be]">{c}</span>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs text-[#8a8f98]">Nome competenza</label>
          <input
            value={newComp}
            onChange={e => setNewComp(e.target.value)}
            placeholder="Es: Cucina, Storia dei Regni..."
            className="w-full mt-1 px-3 py-2 rounded bg-[#181a1f] border border-[#2d3036] text-[#e0e3eb] text-sm focus:border-[#74b1be] outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-[#8a8f98]">Livello</label>
          <select
            value={newTier}
            onChange={e => setNewTier(e.target.value as Competency['tier'])}
            className="mt-1 px-3 py-2 rounded bg-[#181a1f] border border-[#2d3036] text-[#e0e3eb] text-sm focus:border-[#74b1be] outline-none"
          >
            <option value="general">Generale</option>
            <option value="intermediate">Intermedia</option>
            <option value="specialized">Specializzata</option>
          </select>
        </div>
        <button
          onClick={() => {
            if (!newComp.trim()) return;
            onChange({ ...char, competencies: [...char.competencies, { name: newComp.trim(), tier: newTier }] });
            setNewComp('');
          }}
          className="px-4 py-2 rounded bg-[#74b1be] text-[#0f1115] font-semibold text-sm hover:bg-[#5a9baa] transition-colors"
        >Aggiungi</button>
      </div>

      <div className="space-y-1">
        {char.competencies.map((c, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded bg-[#23252a] border border-[#2d3036]">
            <div className="text-sm text-[#e0e3eb]">
              {c.name} <span className="text-xs text-[#74b1be]">({c.tier === 'general' ? 'Generale +1' : c.tier === 'intermediate' ? 'Intermedia +2' : 'Specializzata +3'})</span>
            </div>
            <button
              onClick={() => onChange({ ...char, competencies: char.competencies.filter((_, j) => j !== i) })}
              className="text-red-400 hover:text-red-300 text-xs px-2"
            >Rimuovi</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EquipmentPanel({ char, onChange }: { char: DiscordiaCharacter; onChange: (c: DiscordiaCharacter) => void }) {
  const path = PATHS.find(p => p.id === char.path);
  const availablePacks = path ? EQUIPMENT_PACKS.filter(ep => path.equipmentPacks.includes(ep.name)) : EQUIPMENT_PACKS;
  const selectedPack = EQUIPMENT_PACKS.find(p => p.name === char.equipmentPack);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#74b1be]">Step 7: Equipaggiamento</h3>

      <div>
        <div className="text-sm font-semibold text-[#e0e3eb] mb-2">Pacco di Equipaggiamento</div>
        <div className="grid grid-cols-2 gap-2">
          {availablePacks.map(pack => (
            <button
              key={pack.name}
              onClick={() => onChange({ ...char, equipmentPack: pack.name, equipment: [...pack.items], selectedWeapon: null, selectedArmor: null })}
              className={`p-3 rounded-lg border text-left text-sm transition-all ${
                char.equipmentPack === pack.name
                  ? 'border-[#74b1be] bg-[#74b1be]/10'
                  : 'border-[#2d3036] bg-[#23252a] hover:border-[#74b1be]/40'
              }`}
            >
              <div className="font-medium text-[#e0e3eb]">{pack.name}</div>
              <div className="text-xs text-[#8a8f98] mt-1">{pack.items.slice(0, 4).join(', ')}...</div>
            </button>
          ))}
        </div>
      </div>

      {selectedPack && (
        <>
          <div className="p-3 rounded bg-[#181a1f] border border-[#2d3036]">
            <div className="text-xs font-semibold text-[#74b1be] mb-1">Contenuto del pacco:</div>
            <div className="text-xs text-[#8a8f98]">{selectedPack.items.join(', ')}</div>
          </div>

          <div>
            <div className="text-sm font-semibold text-[#e0e3eb] mb-2">Scegli Arma</div>
            <div className="flex flex-wrap gap-2">
              {selectedPack.weaponOptions.map(w => (
                <button
                  key={w}
                  onClick={() => onChange({ ...char, selectedWeapon: w })}
                  className={`px-3 py-1.5 rounded text-sm transition-all ${
                    char.selectedWeapon === w
                      ? 'bg-[#74b1be] text-[#0f1115] font-semibold'
                      : 'bg-[#23252a] border border-[#2d3036] text-[#e0e3eb] hover:border-[#74b1be]/40'
                  }`}
                >{w}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-[#e0e3eb] mb-2">Scegli Armatura</div>
            <div className="flex flex-wrap gap-2">
              {selectedPack.armorOptions.map(a => (
                <button
                  key={a}
                  onClick={() => onChange({ ...char, selectedArmor: a })}
                  className={`px-3 py-1.5 rounded text-sm transition-all ${
                    char.selectedArmor === a
                      ? 'bg-[#74b1be] text-[#0f1115] font-semibold'
                      : 'bg-[#23252a] border border-[#2d3036] text-[#e0e3eb] hover:border-[#74b1be]/40'
                  }`}
                >{a}</button>
              ))}
            </div>
          </div>
        </>
      )}

      <div>
        <div className="text-sm font-semibold text-[#e0e3eb] mb-2">Scudo (opzionale)</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onChange({ ...char, selectedShield: null })}
            className={`px-3 py-1.5 rounded text-sm transition-all ${
              !char.selectedShield
                ? 'bg-[#74b1be] text-[#0f1115] font-semibold'
                : 'bg-[#23252a] border border-[#2d3036] text-[#e0e3eb] hover:border-[#74b1be]/40'
            }`}
          >Nessuno</button>
          {SHIELDS.map(s => (
            <button
              key={s.name}
              onClick={() => onChange({ ...char, selectedShield: s.name })}
              className={`px-3 py-1.5 rounded text-sm transition-all ${
                char.selectedShield === s.name
                  ? 'bg-[#74b1be] text-[#0f1115] font-semibold'
                  : 'bg-[#23252a] border border-[#2d3036] text-[#e0e3eb] hover:border-[#74b1be]/40'
              }`}
            >{s.name} (+{s.defenseBonus} Dif)</button>
          ))}
        </div>
      </div>

      {/* Weapon reference table */}
      <details className="rounded-lg bg-[#181a1f] border border-[#2d3036]">
        <summary className="p-3 text-sm font-semibold text-[#74b1be] cursor-pointer">Tabella Armi di Riferimento</summary>
        <div className="p-3 overflow-x-auto">
          <table className="w-full text-xs text-[#8a8f98]">
            <thead>
              <tr className="border-b border-[#2d3036] text-[#e0e3eb]">
                <th className="text-left py-1 pr-2">Arma</th>
                <th className="text-left py-1 pr-2">Cat.</th>
                <th className="text-center py-1 pr-2">Mani</th>
                <th className="text-left py-1 pr-2">Danno</th>
                <th className="text-left py-1 pr-2">Tipo</th>
                <th className="text-left py-1">Attr</th>
              </tr>
            </thead>
            <tbody>
              {WEAPONS.map(w => (
                <tr key={w.name} className="border-b border-[#2d3036]/50">
                  <td className="py-1 pr-2 text-[#e0e3eb]">{w.name}</td>
                  <td className="py-1 pr-2 capitalize">{w.category}</td>
                  <td className="py-1 pr-2 text-center">{w.hands}</td>
                  <td className="py-1 pr-2">{w.damage}</td>
                  <td className="py-1 pr-2">{w.damageType}</td>
                  <td className="py-1">{w.attribute}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="rounded-lg bg-[#181a1f] border border-[#2d3036]">
        <summary className="p-3 text-sm font-semibold text-[#74b1be] cursor-pointer">Tabella Armature di Riferimento</summary>
        <div className="p-3 overflow-x-auto">
          <table className="w-full text-xs text-[#8a8f98]">
            <thead>
              <tr className="border-b border-[#2d3036] text-[#e0e3eb]">
                <th className="text-left py-1 pr-2">Armatura</th>
                <th className="text-center py-1 pr-2">PA</th>
                <th className="text-center py-1 pr-2">Pen. Mov.</th>
                <th className="text-center py-1">Pen. Abil.</th>
              </tr>
            </thead>
            <tbody>
              {ARMORS.map(a => (
                <tr key={a.name} className="border-b border-[#2d3036]/50">
                  <td className="py-1 pr-2 text-[#e0e3eb]">{a.name}</td>
                  <td className="py-1 pr-2 text-center">{a.armorPoints}</td>
                  <td className="py-1 pr-2 text-center">{a.movementPenalty}</td>
                  <td className="py-1 text-center">{a.skillPenalty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function SummaryPanel({ char }: { char: DiscordiaCharacter }) {
  const species = SPECIES.find(s => s.id === char.species);
  const role = ROLES.find(r => r.id === char.role);
  const path = PATHS.find(p => p.id === char.path);
  const shield = SHIELDS.find(s => s.name === char.selectedShield);

  const totalCombat = (role?.combatBonus || 0) + (path?.levelProgression[0]?.combatBonus || 0);
  const totalDefense = 10 + char.attributes.AGI + (role?.defenseBonus || 0) + (path?.levelProgression[0]?.defenseBonus || 0) + (shield?.defenseBonus || 0);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#74b1be]">Riepilogo Personaggio</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-[#23252a] border border-[#2d3036]">
          <div className="text-xs text-[#8a8f98] mb-1">Nome</div>
          <div className="text-[#e0e3eb] font-bold">{char.name || '—'}</div>
        </div>
        <div className="p-4 rounded-lg bg-[#23252a] border border-[#2d3036]">
          <div className="text-xs text-[#8a8f98] mb-1">Giocatore</div>
          <div className="text-[#e0e3eb] font-bold">{char.playerName || '—'}</div>
        </div>
        <div className="p-4 rounded-lg bg-[#23252a] border border-[#2d3036]">
          <div className="text-xs text-[#8a8f98] mb-1">Specie</div>
          <div className="text-[#e0e3eb] font-bold">{species?.name || '—'}</div>
        </div>
        <div className="p-4 rounded-lg bg-[#23252a] border border-[#2d3036]">
          <div className="text-xs text-[#8a8f98] mb-1">Ruolo / Cammino</div>
          <div className="text-[#e0e3eb] font-bold">{role?.name || '—'} / {path?.name || '—'}</div>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-[#23252a] border border-[#2d3036]">
        <div className="text-sm font-semibold text-[#74b1be] mb-2">Attributi</div>
        <div className="grid grid-cols-4 gap-2">
          {ATTRIBUTES.map(a => (
            <div key={a.id} className="text-center">
              <div className="text-xs text-[#8a8f98]">{a.id}</div>
              <div className="text-lg font-bold text-[#e0e3eb]">{char.attributes[a.id]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-[#23252a] border border-[#2d3036] text-center">
          <div className="text-xs text-[#8a8f98]">Combattimento</div>
          <div className="text-xl font-bold text-[#74b1be]">+{totalCombat}</div>
        </div>
        <div className="p-3 rounded-lg bg-[#23252a] border border-[#2d3036] text-center">
          <div className="text-xs text-[#8a8f98]">Difesa</div>
          <div className="text-xl font-bold text-[#74b1be]">{totalDefense}</div>
        </div>
        <div className="p-3 rounded-lg bg-[#23252a] border border-[#2d3036] text-center">
          <div className="text-xs text-[#8a8f98]">Velocita</div>
          <div className="text-xl font-bold text-[#74b1be]">{char.speed}</div>
        </div>
        <div className="p-3 rounded-lg bg-[#23252a] border border-[#2d3036] text-center">
          <div className="text-xs text-[#8a8f98]">Livello</div>
          <div className="text-xl font-bold text-[#74b1be]">{char.level}</div>
        </div>
      </div>

      {Object.keys(char.skillPoints).length > 0 && (
        <div className="p-4 rounded-lg bg-[#23252a] border border-[#2d3036]">
          <div className="text-sm font-semibold text-[#74b1be] mb-2">Abilita Assegnate</div>
          <div className="grid grid-cols-3 gap-1">
            {Object.entries(char.skillPoints).filter(([, v]) => v && v > 0).map(([id, pts]) => {
              const skill = SKILLS.find(s => s.id === id)!;
              const speciesBonus = species?.skillBonuses.find(b => b.skillId === id as SkillId)?.bonus || 0;
              const total = char.attributes[skill.attribute] + (pts || 0) + speciesBonus;
              return (
                <div key={id} className="text-xs text-[#8a8f98]">
                  {skill.name}: <span className="text-[#e0e3eb]">{total}</span> (+{pts})
                </div>
              );
            })}
          </div>
        </div>
      )}

      {char.competencies.length > 0 && (
        <div className="p-4 rounded-lg bg-[#23252a] border border-[#2d3036]">
          <div className="text-sm font-semibold text-[#74b1be] mb-2">Competenze</div>
          <div className="flex flex-wrap gap-1">
            {char.competencies.map((c, i) => (
              <span key={i} className="px-2 py-0.5 text-xs rounded bg-[#181a1f] border border-[#2d3036] text-[#e0e3eb]">
                {c.name} ({c.tier === 'general' ? 'G' : c.tier === 'intermediate' ? 'I' : 'S'})
              </span>
            ))}
          </div>
        </div>
      )}

      {(char.equipmentPack || char.selectedWeapon || char.selectedArmor) && (
        <div className="p-4 rounded-lg bg-[#23252a] border border-[#2d3036]">
          <div className="text-sm font-semibold text-[#74b1be] mb-2">Equipaggiamento</div>
          {char.equipmentPack && <div className="text-xs text-[#8a8f98]">Pacco: <span className="text-[#e0e3eb]">{char.equipmentPack}</span></div>}
          {char.selectedWeapon && <div className="text-xs text-[#8a8f98]">Arma: <span className="text-[#e0e3eb]">{char.selectedWeapon}</span></div>}
          {char.selectedArmor && <div className="text-xs text-[#8a8f98]">Armatura: <span className="text-[#e0e3eb]">{char.selectedArmor}</span></div>}
          {char.selectedShield && <div className="text-xs text-[#8a8f98]">Scudo: <span className="text-[#e0e3eb]">{char.selectedShield}</span></div>}
        </div>
      )}

      {char.specialTraits.length > 0 && (
        <div className="p-4 rounded-lg bg-[#23252a] border border-[#2d3036]">
          <div className="text-sm font-semibold text-[#74b1be] mb-2">Tratti Speciali</div>
          <div className="flex flex-wrap gap-1">
            {char.specialTraits.map(t => (
              <span key={t} className="px-2 py-0.5 text-xs rounded bg-[#74b1be]/10 border border-[#74b1be]/30 text-[#74b1be]">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main View ───

export default function DiscordiaCharacterCreation() {
  const [mode, setMode] = useState<CreationMode>('select');
  const [step, setStep] = useState(0);
  const [char, setChar] = useState<DiscordiaCharacter>(getDefaultDiscordiaCharacter());

  const resetCharacter = () => {
    setChar(getDefaultDiscordiaCharacter());
    setStep(0);
  };

  // ─── Mode Selection ───
  if (mode === 'select') {
    return (
      <div className="h-full overflow-auto bg-[#0f1115] p-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-[#e0e3eb] mb-2">Creazione Personaggi Discordia</h1>
          <p className="text-[#8a8f98] mb-8">Scegli la modalita di creazione del tuo personaggio.</p>
          <div className="grid grid-cols-2 gap-6">
            <button
              onClick={() => setMode('guided')}
              className="p-8 rounded-xl border-2 border-[#2d3036] bg-[#181a1f] hover:border-[#74b1be] transition-all group text-left"
            >
              <BookOpen className="w-10 h-10 text-[#74b1be] mb-4 group-hover:scale-110 transition-transform" />
              <h2 className="text-xl font-bold text-[#e0e3eb] mb-2">Creazione Guidata</h2>
              <p className="text-sm text-[#8a8f98]">
                Segui gli 8 step uno alla volta. Ideale per chi e nuovo al sistema Discordia.
                Ogni passo ti guida nelle scelte con spiegazioni dettagliate.
              </p>
            </button>
            <button
              onClick={() => setMode('freeform')}
              className="p-8 rounded-xl border-2 border-[#2d3036] bg-[#181a1f] hover:border-[#74b1be] transition-all group text-left"
            >
              <Wand2 className="w-10 h-10 text-[#74b1be] mb-4 group-hover:scale-110 transition-transform" />
              <h2 className="text-xl font-bold text-[#e0e3eb] mb-2">Creazione Libera</h2>
              <p className="text-sm text-[#8a8f98]">
                Compila le sezioni nell'ordine che preferisci. Per giocatori esperti che
                sanno gia come funziona il sistema.
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Guided Mode ───
  if (mode === 'guided') {
    const stepContent = [
      <SpeciesPanel key="sp" char={char} onChange={setChar} />,
      <AttributesPanel key="at" char={char} onChange={setChar} />,
      <RolePanel key="ro" char={char} onChange={setChar} />,
      <PathPanel key="pa" char={char} onChange={setChar} />,
      <SkillsPanel key="sk" char={char} onChange={setChar} />,
      <CompetenciesPanel key="co" char={char} onChange={setChar} />,
      <EquipmentPanel key="eq" char={char} onChange={setChar} />,
      <SummaryPanel key="su" char={char} />,
    ];

    return (
      <div className="h-full flex flex-col bg-[#0f1115]">
        {/* Header */}
        <div className="shrink-0 p-4 border-b border-[#2d3036] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setMode('select'); resetCharacter(); }}
              className="text-[#8a8f98] hover:text-[#e0e3eb] transition-colors text-sm"
            >Indietro</button>
            <h1 className="text-lg font-bold text-[#e0e3eb]">Creazione Guidata</h1>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={char.name}
              onChange={e => setChar({ ...char, name: e.target.value })}
              placeholder="Nome personaggio"
              className="px-3 py-1.5 rounded bg-[#181a1f] border border-[#2d3036] text-[#e0e3eb] text-sm focus:border-[#74b1be] outline-none w-48"
            />
            <input
              value={char.playerName}
              onChange={e => setChar({ ...char, playerName: e.target.value })}
              placeholder="Nome giocatore"
              className="px-3 py-1.5 rounded bg-[#181a1f] border border-[#2d3036] text-[#e0e3eb] text-sm focus:border-[#74b1be] outline-none w-40"
            />
            <button onClick={resetCharacter} className="p-1.5 rounded hover:bg-[#23252a] text-[#8a8f98] hover:text-[#e0e3eb] transition-colors" title="Resetta">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="shrink-0 px-4 py-3 border-b border-[#2d3036] flex items-center gap-1 overflow-x-auto">
          {STEP_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all whitespace-nowrap ${
                i === step
                  ? 'bg-[#74b1be] text-[#0f1115]'
                  : i < step
                    ? 'bg-[#74b1be]/20 text-[#74b1be]'
                    : 'bg-[#23252a] text-[#8a8f98] hover:bg-[#2d3036]'
              }`}
            >
              {i < step ? <Check className="w-3 h-3" /> : <span className="w-4 text-center">{i + 1}</span>}
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl mx-auto">
            {stepContent[step]}
          </div>
        </div>

        {/* Footer navigation */}
        <div className="shrink-0 p-4 border-t border-[#2d3036] flex justify-between items-center">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2 rounded text-sm font-medium text-[#e0e3eb] bg-[#23252a] border border-[#2d3036] hover:border-[#74b1be] disabled:opacity-30 transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Precedente
          </button>
          <span className="text-sm text-[#8a8f98]">Step {step + 1} di {STEP_LABELS.length}</span>
          <button
            onClick={() => setStep(Math.min(STEP_LABELS.length - 1, step + 1))}
            disabled={step === STEP_LABELS.length - 1}
            className="flex items-center gap-1 px-4 py-2 rounded text-sm font-medium text-[#0f1115] bg-[#74b1be] hover:bg-[#5a9baa] disabled:opacity-30 transition-all"
          >
            Successivo <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Free-form Mode ───
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    species: true, attributes: true, role: true, path: true, skills: true, competencies: true, equipment: true, summary: false,
  });

  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const sections = [
    { key: 'species', label: 'Specie', content: <SpeciesPanel char={char} onChange={setChar} /> },
    { key: 'attributes', label: 'Attributi', content: <AttributesPanel char={char} onChange={setChar} /> },
    { key: 'role', label: 'Ruolo', content: <RolePanel char={char} onChange={setChar} /> },
    { key: 'path', label: 'Cammino', content: <PathPanel char={char} onChange={setChar} /> },
    { key: 'skills', label: 'Abilita', content: <SkillsPanel char={char} onChange={setChar} /> },
    { key: 'competencies', label: 'Competenze', content: <CompetenciesPanel char={char} onChange={setChar} /> },
    { key: 'equipment', label: 'Equipaggiamento', content: <EquipmentPanel char={char} onChange={setChar} /> },
    { key: 'summary', label: 'Riepilogo', content: <SummaryPanel char={char} /> },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0f1115]">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-[#2d3036] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setMode('select'); resetCharacter(); }}
            className="text-[#8a8f98] hover:text-[#e0e3eb] transition-colors text-sm"
          >Indietro</button>
          <h1 className="text-lg font-bold text-[#e0e3eb]">Creazione Libera</h1>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={char.name}
            onChange={e => setChar({ ...char, name: e.target.value })}
            placeholder="Nome personaggio"
            className="px-3 py-1.5 rounded bg-[#181a1f] border border-[#2d3036] text-[#e0e3eb] text-sm focus:border-[#74b1be] outline-none w-48"
          />
          <input
            value={char.playerName}
            onChange={e => setChar({ ...char, playerName: e.target.value })}
            placeholder="Nome giocatore"
            className="px-3 py-1.5 rounded bg-[#181a1f] border border-[#2d3036] text-[#e0e3eb] text-sm focus:border-[#74b1be] outline-none w-40"
          />
          <button onClick={resetCharacter} className="p-1.5 rounded hover:bg-[#23252a] text-[#8a8f98] hover:text-[#e0e3eb] transition-colors" title="Resetta">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content - all sections as collapsible */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {sections.map(sec => (
            <div key={sec.key} className="rounded-lg border border-[#2d3036] bg-[#181a1f] overflow-hidden">
              <button
                onClick={() => toggleSection(sec.key)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#23252a] transition-colors"
              >
                <span className="text-sm font-semibold text-[#e0e3eb]">{sec.label}</span>
                <ChevronRight className={`w-4 h-4 text-[#8a8f98] transition-transform ${expandedSections[sec.key] ? 'rotate-90' : ''}`} />
              </button>
              {expandedSections[sec.key] && (
                <div className="px-4 pb-4">
                  {sec.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
