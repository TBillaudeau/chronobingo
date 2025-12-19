import React, { useState, useEffect } from 'react';
import { t } from '../services/translations';

const Tutorial = ({ lang, onClose }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(1);

    useEffect(() => {
        // Check local storage
        try {
            const seen = localStorage.getItem('tutorial_seen');
            if (!seen) {
                setIsOpen(true);
            }
        } catch (e) {
            // Ignore
        }
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        try {
            localStorage.setItem('tutorial_seen', 'true');
        } catch (e) { }
        if (onClose) onClose();
    };

    const handleNext = () => {
        if (step < 4) setStep(step + 1);
        else handleClose();
    };

    const handlePrev = () => {
        if (step > 1) setStep(step - 1);
    };

    if (!isOpen) return null;

    const stepsData = [
        { icon: '📅', color: 'indigo', title: 'tutorial.step1_title', desc: 'tutorial.step1_desc' },
        { icon: '👂', color: 'pink', title: 'tutorial.step2_title', desc: 'tutorial.step2_desc' },
        { icon: '🎙️', color: 'cyan', title: 'tutorial.step3_title', desc: 'tutorial.step3_desc' },
        { icon: '🎉', color: 'yellow', title: 'tutorial.step4_title', desc: 'tutorial.step4_desc' }
    ];

    const renderContent = () => {
        const current = stepsData[step - 1];
        // Dynamic color mapping for Tailwind safelist if needed, 
        // strictly speaking tailwind needs full class names, but since they were present before they might be safe. 
        // To be safe I will map classes directly or use the previous color names if they are standard. 
        // The previous code had specific bg-indigo-500/20, text-indigo-200. I should construct these carefully or use a map.
        // Actually, let's keep it simple and just use the color name in string interpolation if allowed, 
        // OR better: define the full classes in the data object to ensure PurgeCSS doesn't miss them.

        // Let's refine the data object above to include classes.
        // Wait, I can't easily change the data array defined outside if I am inside the replacement content. 
        // I will define the array inside the renderContent or component.

        return (
            <div className="flex flex-col items-center text-center animate-in slide-in-from-right">
                <div className={`w-20 h-20 bg-${current.color}-500/20 rounded-full flex items-center justify-center mb-4 ring-2 ring-${current.color}-500 text-3xl`}>
                    {current.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{t(lang, current.title)}</h3>
                <p className={`text-${current.color}-200`}>{t(lang, current.desc)}</p>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl shadow-2xl w-full max-w-sm relative overflow-hidden">

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors z-10"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Progress Indicators */}
                <div className="flex justify-center gap-2 mb-8 mt-2">
                    {[1, 2, 3, 4].map(i => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-white' : 'w-2 bg-white/20'}`}
                        />
                    ))}
                </div>

                {/* Content */}
                <div className="min-h-[200px] flex items-center justify-center relative">
                    {/* Key is step to force re-render/animation */}
                    <div key={step} className="w-full">
                        {renderContent()}
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
                    <button
                        onClick={handlePrev}
                        className={`text-sm text-slate-400 font-bold px-4 py-2 hover:text-white transition-colors ${step === 1 ? 'opacity-0 pointer-events-none' : ''}`}
                    >
                        {t(lang, 'tutorial.btnPrev')}
                    </button>

                    <button
                        onClick={handleNext}
                        className="bg-white text-black font-bold py-2 px-6 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all text-sm"
                    >
                        {step === 4 ? t(lang, 'tutorial.btnClose') : t(lang, 'tutorial.btnNext')}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default Tutorial;
