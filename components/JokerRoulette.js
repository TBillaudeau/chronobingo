import React, { useState, useEffect } from 'react';
import { t } from '../services/translations';
import confetti from 'canvas-confetti';

const JOKERS = [
    // --- BENEFICIAL ---
    { id: 'wildcard', type: 'good', icon: '🃏', name: 'Passe-Partout', desc: 'Coche une case au choix (Auto)' },
    { id: 'remix', type: 'good', icon: '🔄', name: 'Remix', desc: 'Mélange ta grille' },

    // --- CURSED (ATTACKS) ---
    { id: 'cryo', type: 'bad', icon: '🧊', name: 'Cryo-Gun', desc: 'Gèle le 1er (3min)' },
    { id: 'hotpotato', type: 'bad', icon: '💣', name: 'Patate Chaude', desc: 'Échange une case hasard' },
    { id: 'vampire', type: 'bad', icon: '🧛', name: 'Vampire', desc: 'Vole 10pts au voisin' },
    { id: 'zombie', type: 'bad', icon: '🧟', name: 'Zombie', desc: 'Infecte une case adverse' },
    { id: 'eclipse', type: 'bad', icon: '🌓', name: 'Éclipse', desc: 'Cache titres adverses (30min)' },

    // --- SPECIALS ---
    { id: 'bunker', type: 'good', icon: '🛡️', name: 'Bunker', desc: 'Protection totale (15min)' },
    { id: 'casino', type: 'neutral', icon: '🎰', name: 'Casino', desc: '50% +50pts / 50% 0pts' },
    { id: 'kamikaze', type: 'neutral', icon: '🧨', name: 'Kamikaze', desc: '+3 cases mais Gelé 1h' },
    { id: 'incognito', type: 'good', icon: '🕵️‍♂️', name: 'Incognito', desc: 'Score caché (30min)' },
    { id: 'unicorn', type: 'good', icon: '🦄', name: 'Licorne', desc: 'Valide 1 LIGNE (Rare !)' },
];

const JokerRoulette = ({ lang, onClose, onApplyJoker }) => {
    const [spinning, setSpinning] = useState(true);
    const [result, setResult] = useState(null);
    const [currentIcon, setCurrentIcon] = useState('❓');

    useEffect(() => {
        let interval;
        let timeout;

        // Spin animation
        let speed = 50;
        const spin = () => {
            const randomJoker = JOKERS[Math.floor(Math.random() * JOKERS.length)];
            setCurrentIcon(randomJoker.icon);

            if (spinning) {
                // Decay speed curve
                speed *= 1.1;
                if (speed < 400) {
                    interval = setTimeout(spin, speed);
                } else {
                    // Final stop
                    const finalJoker = JOKERS[Math.floor(Math.random() * JOKERS.length)];
                    setResult(finalJoker);
                    setSpinning(false);

                    if (finalJoker.type === 'good') {
                        confetti({
                            particleCount: 50,
                            spread: 60,
                            origin: { y: 0.6 },
                            colors: ['#22c55e', '#ffffff']
                        });
                    }

                    // Apply effect after slight delay so user sees what they got
                    setTimeout(() => {
                        onApplyJoker(finalJoker);
                        // Auto close is handled by parent or manual close button for suspense
                    }, 2000);
                }
            }
        };

        spin();

        return () => clearTimeout(interval);
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className={`
                relative w-full max-w-sm rounded-3xl p-8 flex flex-col items-center justify-center gap-6 shadow-2xl border-4
                ${!result ? 'bg-slate-900 border-slate-700' :
                    result.type === 'good' ? 'bg-emerald-900/90 border-emerald-500 shadow-emerald-500/50' :
                        'bg-red-900/90 border-red-500 shadow-red-500/50'}
                transition-all duration-500 scale-100
            `}>
                <h2 className="text-2xl font-black text-white uppercase tracking-widest text-center">
                    {spinning ? 'Roue du Destin...' : result.name}
                </h2>

                <div className={`
                    w-40 h-40 rounded-full flex items-center justify-center text-8xl shadow-inner bg-black/30
                    ${spinning ? 'animate-pulse' : 'animate-bounce'}
                `}>
                    {result ? result.icon : currentIcon}
                </div>

                <div className="text-center min-h-[60px]">
                    {result ? (
                        <p className="text-lg font-bold text-white leading-tight animate-in slide-in-from-bottom">
                            {result.desc}
                        </p>
                    ) : (
                        <p className="text-sm text-slate-400 italic">Bonne chance...</p>
                    )}
                </div>

                {!spinning && (
                    <button
                        onClick={onClose}
                        className="mt-4 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-white border border-white/20"
                    >
                        {t(lang, 'game.close')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default JokerRoulette;
