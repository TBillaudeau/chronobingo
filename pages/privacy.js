import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getBrowserLanguage } from '../services/translations';

const translations = {
    fr: {
        title: "Politique de Confidentialité & Connexion",
        back: "← Retour au jeu",
        updated: "Dernière mise à jour : 18 Décembre 2025",
        intro: <>Bienvenue sur <strong>Chronobingo</strong>. Cette application est un projet personnel développé pour le divertissement entre amis. Nous prenons votre vie privée au sérieux !</>,

        // New Section 1: Why OAuth
        secAuthTitle: "1. Connexion OAuth (Google, Spotify)",
        secAuthIntro: <>Il n'y a pas d'inscription par email/mot de passe sur <strong>Chronobingo</strong>, et c'est un choix de <strong>sécurité</strong>. Nous utilisons le standard <strong>OAuth</strong> via des tiers de confiance (Google, Spotify). Grâce à ce système, nous ne <strong>stockons</strong> et ne <strong>gérons</strong> aucun mot de passe sur nos serveurs.</>,

        sec1Title: "2. Les données que nous collectons",
        sec1Desc: "Nous collectons uniquement le strict nécessaire pour que le jeu fonctionne :",
        sec1Li1: <><strong>Votre profil (Google/Spotify) :</strong> Nous récupérons uniquement votre ID unique, votre prénom, votre email et votre avatar.</>,
        sec1Li2: <><strong>Données de jeu :</strong> Vos scores, vos victoires, votre historique de parties et vos chansons favorites.</>,

        sec2Title: "3. Comment nous utilisons vos données",
        sec2Desc: "Vos données servent uniquement à :",
        sec2Li1: "Vous identifier quand vous revenez sur le jeu.",
        sec2Li2: "Afficher votre avatar et votre pseudo aux autres joueurs dans le lobby.",
        sec2Li3: "Garder une trace de vos statistiques (victoires, ratio, etc.).",
        sec2Bold: "Nous ne vendons, ne partageons et n'analysons vos données à aucune fin commerciale ou publicitaire.",

        sec3Title: "4. Services Tiers",
        sec3Desc: "Nous utilisons des services externes pour faire fonctionner l'application :",
        sec3Li1: <><strong>Supabase :</strong> Pour héberger la base de données et gérer l'authentification.</>,
        sec3Li2: <><strong>Deezer :</strong> Pour rechercher les musiques.</>,
        sec3Li3: <><strong>DiceBear :</strong> Pour générer les avatars des invités.</>,

        sec4Title: "5. Vos Droits (Suppression)",
        sec4Desc: "Vous pouvez à tout moment supprimer votre compte et toutes les données associées directement depuis l'application :",
        sec4Li1: "Connectez-vous.",
        sec4Li2: <>Allez dans votre <strong>Profil</strong> (cliquez sur votre avatar).</>,
        sec4Li3: <>Allez dans l'onglet <strong>Paramètres</strong>.</>,
        sec4Li4: <>Cliquez sur le bouton <strong>"Supprimer mon compte"</strong>.</>,
        sec4Note: "Cette action efface instantanément votre profil de notre base de données.",

        sec5Title: "6. Contact",
        sec5Desc: "Pour toute question concernant ce projet ou vos données, vous pouvez contacter le développeur directement.",

        sec6Title: "7. Mentions Légales",
        sec6EdTitle: "Éditeur du site",
        sec6EdText: <>Le site Chronobingo est édité à titre personnel.<br />Projet open-source disponible sur <a href="https://github.com/TBillaudeau/chronobingo" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">GitHub</a>.</>,
        sec6EdResp: "Responsable de la publication : L'administrateur du projet.",
        sec6HostTitle: "Hébergement",
        sec6HostText: "Ce site est hébergé par :",

        footerNote: "Texte original",
        toggleBtn: "Switch to English"
    },
    en: {
        title: "Privacy Policy & Login",
        back: "← Back to game",
        updated: "Last updated: December 18, 2025",
        intro: <>Welcome to <strong>Chronobingo</strong>. This application is a personal project developed for fun with friends. We take your privacy seriously!</>,

        // New Section 1: Why OAuth
        secAuthTitle: "1. OAuth Login (Google, Spotify)",
        secAuthIntro: <>There is no email/password sign-up on <strong>Chronobingo</strong>, and that is a <strong>security</strong> choice. We use the <strong>OAuth</strong> standard via trusted third parties (Google, Spotify). Thanks to this system, we do not <strong>store</strong> or <strong>manage</strong> any passwords on our servers.</>,

        sec1Title: "2. Data we collect",
        sec1Desc: "We only collect the strict minimum for the game to work:",
        sec1Li1: <><strong>Your Profile (Google/Spotify):</strong> We only retrieve your unique ID, your first name, your email, and your avatar.</>,
        sec1Li2: <><strong>Game Data:</strong> Your scores, victories, game history, and favorite songs.</>,

        sec2Title: "3. How we use your data",
        sec2Desc: "Your data is used solely to:",
        sec2Li1: "Identify you when you return to the game.",
        sec2Li2: "Display your avatar and nickname to other players in the lobby.",
        sec2Li3: "Keep track of your statistics (wins, ratio, etc.).",
        sec2Bold: "We do not sell, share, or analyze your data for any commercial or advertising purpose.",

        sec3Title: "4. Third Party Services",
        sec3Desc: "We use external services to run the application:",
        sec3Li1: <><strong>Supabase:</strong> To host the database and manage authentication.</>,
        sec3Li2: <><strong>Deezer:</strong> To search for music.</>,
        sec3Li3: <><strong>DiceBear:</strong> To generate avatars for guests.</>,

        sec4Title: "5. Your Rights (Deletion)",
        sec4Desc: "You can delete your account and all associated data directly from the application at any time:",
        sec4Li1: "Log in.",
        sec4Li2: <>Go to your <strong>Profile</strong> (click on your avatar).</>,
        sec4Li3: <>Go to the <strong>Settings</strong> tab.</>,
        sec4Li4: <>Click on the <strong>"Delete my account"</strong> button.</>,
        sec4Note: "This action instantly erases your profile from our database.",

        sec5Title: "6. Contact",
        sec5Desc: "For any questions regarding this project or your data, you can contact the developer directly.",

        sec6Title: "7. Legal Notice",
        sec6EdTitle: "Site Publisher",
        sec6EdText: <>The Chronobingo website is published personally.<br />Open-source project available on <a href="https://github.com/TBillaudeau/chronobingo" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">GitHub</a>.</>,
        sec6EdResp: "Publication Director: The project administrator.",
        sec6HostTitle: "Hosting",
        sec6HostText: "This site is hosted by:",

        footerNote: "Translated from French",
        toggleBtn: "Voir l'original (Français)"
    }
};

export default function PrivacyPolicy() {
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
                    <h1 className="text-4xl font-black text-white">{t.title}</h1>
                    <button
                        onClick={handleBack}
                        className="text-fuchsia-400 hover:text-fuchsia-300 font-bold whitespace-nowrap ml-4 transition-colors"
                    >
                        {t.back}
                    </button>
                </div>

                <div className="space-y-4">
                    <p className="text-sm text-slate-500">{t.updated}</p>

                    <p>
                        {t.intro}
                    </p>
                </div>

                <section className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">{t.secAuthTitle}</h2>
                    <p>{t.secAuthIntro}</p>
                </section>

                <section className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">{t.sec1Title}</h2>
                    <p>{t.sec1Desc}</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>{t.sec1Li1}</li>
                        <li>{t.sec1Li2}</li>
                    </ul>
                </section>

                <section className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">{t.sec2Title}</h2>
                    <p>{t.sec2Desc}</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>{t.sec2Li1}</li>
                        <li>{t.sec2Li2}</li>
                        <li>{t.sec2Li3}</li>
                    </ul>
                    <p className="font-bold text-white mt-2">{t.sec2Bold}</p>
                </section>

                <section className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">{t.sec3Title}</h2>
                    <p>{t.sec3Desc}</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>{t.sec3Li1}</li>
                        <li>{t.sec3Li2}</li>
                        <li>{t.sec3Li3}</li>
                    </ul>
                </section>

                <section className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">{t.sec4Title}</h2>
                    <p>
                        {t.sec4Desc}
                    </p>
                    <ol className="list-decimal pl-5 space-y-1">
                        <li>{t.sec4Li1}</li>
                        <li>{t.sec4Li2}</li>
                        <li>{t.sec4Li3}</li>
                        <li>{t.sec4Li4}</li>
                    </ol>
                    <p>{t.sec4Note}</p>
                </section>

                <section className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">{t.sec5Title}</h2>
                    <p>
                        {t.sec5Desc}
                    </p>
                </section>

                <section className="space-y-2 border-t border-slate-800 pt-8 mt-8">
                    <h2 className="text-2xl font-bold text-white">{t.sec6Title}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 p-4 rounded-xl">
                            <h3 className="font-bold text-fuchsia-400 mb-2">{t.sec6EdTitle}</h3>
                            <p>{t.sec6EdText}</p>
                            <p className="text-sm text-slate-400 mt-1">{t.sec6EdResp}</p>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-xl">
                            <h3 className="font-bold text-cyan-400 mb-2">{t.sec6HostTitle}</h3>
                            <p>{t.sec6HostText}</p>
                            <p className="font-bold mt-1">Northflank</p>
                            <p className="text-xs text-slate-400">London, UK<br />(Cloud Infrastructure)</p>
                        </div>
                    </div>
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
    );
}
