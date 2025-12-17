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

    const renderContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="flex flex-col items-center text-center animate-in slide-in-from-right">
                        <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4 ring-2 ring-indigo-500 text-3xl">
                            📅
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{t(lang, 'tutorial.step1_title')}</h3>
                        <p className="text-indigo-200">{t(lang, 'tutorial.step1_desc')}</p>
                    </div>
                );
            case 2:
                return (
                    <div className="flex flex-col items-center text-center animate-in slide-in-from-right">
                        <div className="w-20 h-20 bg-pink-500/20 rounded-full flex items-center justify-center mb-4 ring-2 ring-pink-500 text-3xl">
                            👂
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{t(lang, 'tutorial.step2_title')}</h3>
                        <p className="text-pink-200">{t(lang, 'tutorial.step2_desc')}</p>
                    </div>
                );
            case 3:
                return (
                    <div className="flex flex-col items-center text-center animate-in slide-in-from-right">
                        <div className="w-20 h-20 bg-cyan-500/20 rounded-full flex items-center justify-center mb-4 ring-2 ring-cyan-500 text-3xl">
                            🎙️
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{t(lang, 'tutorial.step3_title')}</h3>
                        <p className="text-cyan-200">{t(lang, 'tutorial.step3_desc')}</p>
                    </div>
                );
            case 4:
                return (
                    <div className="flex flex-col items-center text-center animate-in slide-in-from-right">
                        <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4 ring-2 ring-yellow-500 text-3xl">
                            🎉
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{t(lang, 'tutorial.step4_title')}</h3>
                        <p className="text-yellow-200">{t(lang, 'tutorial.step4_desc')}</p>
                    </div>
                );
            default:
                return null;
        }
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
