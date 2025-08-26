import React from 'react';

const palettes = [
  { id: 'indigo-pink', name: 'Indigo / Pink', primary: '#4f46e5', accent: '#ec4899' },
  { id: 'teal-yellow', name: 'Teal / Yellow', primary: '#0ea5a4', accent: '#f59e0b' },
  { id: 'emerald-orange', name: 'Emerald / Orange', primary: '#10b981', accent: '#f97316' },
];

export const PaletteSelector: React.FC = () => {
  const apply = (p: { primary: string; accent: string }) => {
    document.documentElement.style.setProperty('--theme-color', p.primary);
    document.documentElement.style.setProperty('--accent-color', p.accent);
  };

  return (
    <div className="flex items-center gap-2">
      {palettes.map(p => (
        <button
          key={p.id}
          title={p.name}
          onClick={() => apply(p)}
          className="w-7 h-7 rounded-full border-2 border-white shadow-sm"
          style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}
        />
      ))}
    </div>
  );
};

export default PaletteSelector;
