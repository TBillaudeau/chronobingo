import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { getBrowserLanguage } from '../services/translations';

const translations = {
    fr: {
        title: "Pourquoi Google Auth ?",
        back: "← Retour",
        intro: <>Pour se connecter à <strong>Chronobingo</strong>, nous utilisons exclusivement l'authentification Google. Voici pourquoi nous avons fait ce choix, en toute transparence.</>,
        secTitle: "Sécurité Maximale",
        secDesc: <>Gérer des mots de passe est complexe et risqué. En déléguant la connexion à Google, nous n'avons <strong>jamais</strong> accès à votre mot de passe. Votre compte est protégé par les systèmes de sécurité de Google.</>,
        simTitle: "Simplicité",
        simDesc: "Pas de nouveau compte à créer, pas de mail de confirmation à attendre, pas de mot de passe à retenir. Un seul clic et vous êtes prêt à jouer.",
        dataTitle: "Et mes données ?",
        gotTitle: "Ce que nous récupérons :",
        gotDesc: "Uniquement votre ID Google (identifiant unique), votre Prénom (pour l'affichage) et votre Avatar. Nous ne stockons PAS votre email.",
        notGotTitle: "Ce que nous NE faisons PAS :",
        notGotDesc: "Nous ne lisons pas vos mails, nous ne vendons pas vos données, et nous n'avons accès à rien d'autre sur votre compte Google.",
        sumTitle: "En résumé",
        sumDesc: "C'est plus sûr pour vous, et plus simple pour nous. Chronobingo est un projet fait pour le fun, sans arrière-pensée commerciale.",
        footerNote: "Texte original",
        toggleBtn: "Switch to English"
    },
    en: {
        title: "Why Google Auth?",
        back: "← Back",
        intro: <>To log in to <strong>Chronobingo</strong>, we exclusively use Google authentication. Here is why we made this choice, in full transparency.</>,
        secTitle: "Maximum Security",
        secDesc: <>Managing passwords is complex and risky. By delegating login to Google, we <strong>never</strong> have access to your password. Your account is protected by Google's security systems.</>,
        simTitle: "Simplicity",
        simDesc: "No new account to create, no confirmation email to wait for, no password to remember. One click and you're ready to play.",
        dataTitle: "What about my data?",
        gotTitle: "What we collect:",
        gotDesc: "Only your Google ID (unique identifier), your First Name (for display), and your Avatar. We do NOT store your email.",
        notGotTitle: "What we do NOT do:",
        notGotDesc: "We do not read your emails, we do not sell your data, and we have access to nothing else on your Google account.",
        sumTitle: "In summary",
        sumDesc: "It's safer for you, and simpler for us. Chronobingo is a fun project, with no commercial intent.",
        footerNote: "Translated from French",
        toggleBtn: "Voir l'original (Français)"
    }
};

export default function WhyGoogle() {
    const router = useRouter();
    const [lang, setLang] = useState('fr');

    useEffect(() => {
        setLang(getBrowserLanguage());
    }, []);

    const t = translations[lang];

    const handleBack = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
        } else {
            router.push('/');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-300 p-8 font-sans">
            <Head>
                <title>{t.title} - Chronobingo</title>
            </Head>

            <div className="max-w-3xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl md:text-4xl font-black text-white">{t.title}</h1>
                    <button
                        onClick={handleBack}
                        className="text-fuchsia-400 hover:text-fuchsia-300 font-bold whitespace-nowrap ml-4 transition-colors"
                    >
                        {t.back}
                    </button>
                </div>

                <div className="space-y-6">
                    <p className="text-lg leading-relaxed">
                        {t.intro}
                    </p>

                    <div className="grid md:grid-cols-2 gap-6">
                        <section className="bg-slate-800/50 p-6 rounded-2xl border border-white/5">
                            <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-4 text-2xl">
                                🔒
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">{t.secTitle}</h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                {t.secDesc}
                            </p>
                        </section>

                        <section className="bg-slate-800/50 p-6 rounded-2xl border border-white/5">
                            <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mb-4 text-2xl">
                                ⚡
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">{t.simTitle}</h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                {t.simDesc}
                            </p>
                        </section>
                    </div>

                    <section className="bg-slate-800/30 p-6 rounded-2xl border border-fuchsia-500/20">
                        <h2 className="text-2xl font-bold text-white mb-4">{t.dataTitle}</h2>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3">
                                <span className="text-green-400 mt-1">✓</span>
                                <div>
                                    <strong className="text-white">{t.gotTitle}</strong>
                                    <p className="text-sm text-slate-400">{t.gotDesc}</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-red-400 mt-1">✕</span>
                                <div>
                                    <strong className="text-white">{t.notGotTitle}</strong>
                                    <p className="text-sm text-slate-400">{t.notGotDesc}</p>
                                </div>
                            </li>
                        </ul>
                    </section>

                    <section className="space-y-4 pt-4 border-t border-white/10">
                        <h3 className="text-xl font-bold text-white">{t.sumTitle}</h3>
                        <p>
                            {t.sumDesc}
                        </p>
                    </section>

                    {/* Translation Toggle Footer */}
                    <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col items-center gap-2 text-sm text-slate-500">
                        <p>{t.footerNote}</p>
                        <button
                            onClick={() => setLang(prev => prev === 'fr' ? 'en' : 'fr')}
                            className="text-fuchsia-400 hover:text-white underline transition-colors"
                        >
                            {t.toggleBtn}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
