import React, { useState, useEffect } from 'react';
import { t } from '../services/translations';

const InstallPrompt = ({ lang }) => {
    const [showPrompt, setShowPrompt] = useState(false);
    const [platform, setPlatform] = useState(null); // 'ios' or 'android'

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const ua = window.navigator.userAgent.toLowerCase();
        const isIOS = /iphone|ipad|ipod/.test(ua);
        const isAndroid = /android/.test(ua);
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        // Check if user has already dismissed it in this session (optional, but good UX)
        let isDismissed = false;
        try {
            isDismissed = sessionStorage.getItem('install_prompt_dismissed');
        } catch (e) {
            // Ignore storage errors
        }

        if (!isStandalone && !isDismissed) {
            if (isIOS) setPlatform('ios');
            else if (isAndroid) setPlatform('android');

            if (isIOS || isAndroid) {
                const timer = setTimeout(() => setShowPrompt(true), 1000);
                return () => clearTimeout(timer);
            }
        }
    }, []);

    const handleDismiss = () => {
        setShowPrompt(false);
        try {
            sessionStorage.setItem('install_prompt_dismissed', 'true');
        } catch (e) {
            // Ignore
        }
    };

    if (!showPrompt || !platform) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-50 p-4 animate-slide-down">
            <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 relative overflow-hidden">

                <button
                    onClick={handleDismiss}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white bg-white/5 rounded-full"
                >
                    ✕
                </button>

                <div className="flex items-start gap-3 pr-6">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                        <img src="/icon.svg" alt="App" className="w-full h-full object-cover rounded-xl" onError={(e) => { e.target.style.display = 'none' }} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">{t(lang, 'install.title')}</h3>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            {t(lang, 'install.desc')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 bg-cyan-900/20 p-2 rounded-lg border border-cyan-500/20">
                    <span>1. {t(lang, 'install.step1')}</span>

                    {platform === 'ios' ? (
                        <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                            <polyline points="16 6 12 2 8 6"></polyline>
                            <line x1="12" y1="2" x2="12" y2="15"></line>
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                        </svg>
                    )}

                    <span>{t(lang, 'install.step2')}</span>
                    {platform === 'ios' && <span className="text-lg leading-none">+</span>}
                </div>
            </div>
        </div>
    );
};

export default InstallPrompt;
