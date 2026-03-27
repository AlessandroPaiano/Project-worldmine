import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { CLASSES, SPECIES, BACKGROUNDS, type GenOptions } from '../../lib/dnd5e-generator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (options: GenOptions) => void;
}

export default function GenerateCharacterModal({ isOpen, onClose, onGenerate }: Props) {
  const [level, setLevel] = useState<number | ''>('');
  const [className, setClassName] = useState<string>('');
  const [species, setSpecies] = useState<string>('');
  const [background, setBackground] = useState<string>('');

  if (!isOpen) return null;

  const handleGenerate = () => {
    const options: GenOptions = {};
    if (level !== '') options.level = level;
    if (className) options.className = className as any;
    if (species) options.species = species as any;
    if (background) options.background = background as any;
    
    onGenerate(options);
    onClose();
  };

  const selectClass = "w-full bg-[#0f1115] border border-[#2d3036] rounded text-sm text-[#e0e3eb] p-2 outline-none focus:border-[#74b1be]";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#181a1f] border border-[#2d3036] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[#2d3036] bg-[#141519]">
          <div className="flex items-center gap-2 text-[#74b1be]">
            <Sparkles className="w-5 h-5" />
            <h2 className="font-bold text-lg">Auto-Generatore</h2>
          </div>
          <button onClick={onClose} className="text-[#8a8f98] hover:text-red-400 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-[#8a8f98] leading-relaxed">
            Lascia vuoti i campi che vuoi vengano generati casualmente. Il sistema usa le regole di D&D One (Standard Array, Background ASIs).
          </p>

          <div>
            <label className="block text-[10px] text-[#4a4d5e] uppercase font-bold mb-1">Livello</label>
            <input 
              type="number" 
              min="1" max="20"
              value={level}
              onChange={e => setLevel(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="Casuale (1-10)"
              className={selectClass}
            />
          </div>

          <div>
            <label className="block text-[10px] text-[#4a4d5e] uppercase font-bold mb-1">Classe</label>
            <select value={className} onChange={e => setClassName(e.target.value)} className={selectClass}>
              <option value="">Casuale</option>
              {Object.keys(CLASSES).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-[#4a4d5e] uppercase font-bold mb-1">Specie</label>
            <select value={species} onChange={e => setSpecies(e.target.value)} className={selectClass}>
              <option value="">Casuale</option>
              {Object.keys(SPECIES).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-[#4a4d5e] uppercase font-bold mb-1">Background</label>
            <select value={background} onChange={e => setBackground(e.target.value)} className={selectClass}>
              <option value="">Casuale</option>
              {Object.keys(BACKGROUNDS).map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2d3036] bg-[#141519] flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#8a8f98] hover:text-[#e0e3eb] font-medium transition"
          >
            Annulla
          </button>
          <button 
            onClick={handleGenerate}
            className="flex items-center gap-2 px-4 py-2 bg-[#74b1be] hover:bg-[#9ed0db] text-[#0f1115] text-sm font-bold rounded shadow-lg transition"
          >
            <Sparkles className="w-4 h-4" />
            Genera
          </button>
        </div>
      </div>
    </div>
  );
}
