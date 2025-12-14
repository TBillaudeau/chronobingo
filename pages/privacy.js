import Head from 'next/head';
import Link from 'next/link';

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-300 p-8 font-sans">
            <Head>
                <title>Politique de Confidentialité - Chronobingo</title>
            </Head>

            <div className="max-w-3xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-4xl font-black text-white">Politique de Confidentialité</h1>
                    <Link href="/" className="text-fuchsia-400 hover:text-fuchsia-300 font-bold">
                        ← Retour au jeu
                    </Link>
                </div>

                <div className="space-y-4">
                    <p className="text-sm text-slate-500">Dernière mise à jour : 14 Décembre 2025</p>

                    <p>
                        Bienvenue sur <strong>Chronobingo</strong>. Cette application est un projet personnel développé pour le divertissement entre amis.
                        Nous prenons votre vie privée au sérieux, même pour un petit projet !
                    </p>
                </div>

                <section className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">1. Les données que nous collectons</h2>
                    <p>Nous collectons uniquement le strict nécessaire pour que le jeu fonctionne :</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Votre profil Google (si vous vous connectez) :</strong> Nous récupérons uniquement votre adresse email, votre nom et votre photo de profil.</li>
                        <li><strong>Données de jeu :</strong> Vos scores, vos victoires, votre historique de parties et vos chansons favorites.</li>
                    </ul>
                </section>

                <section className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">2. Comment nous utilisons vos données</h2>
                    <p>Vos données servent uniquement à :</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Vous identifier quand vous revenez sur le jeu.</li>
                        <li>Afficher votre avatar et votre pseudo aux autres joueurs dans le lobby.</li>
                        <li>Garder une trace de vos statistiques (victoires, ratio, etc.).</li>
                    </ul>
                    <p className="font-bold text-white mt-2">Nous ne vendons, ne partageons et n'analysons vos données à aucune fin commerciale ou publicitaire.</p>
                </section>

                <section className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">3. Services Tiers</h2>
                    <p>Nous utilisons des services externes pour faire fonctionner l'application :</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Supabase :</strong> Pour héberger la base de données et gérer l'authentification.</li>
                        <li><strong>Deezer :</strong> Pour rechercher les musiques et afficher les pochettes d'album.</li>
                        <li><strong>DiceBear :</strong> Pour générer les avatars des invités.</li>
                    </ul>
                </section>

                <section className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">4. Vos Droits (Suppression)</h2>
                    <p>
                        Vous pouvez à tout moment supprimer votre compte et toutes les données associées directement depuis l'application :
                    </p>
                    <ol className="list-decimal pl-5 space-y-1">
                        <li>Connectez-vous.</li>
                        <li>Allez dans votre <strong>Profil</strong> (cliquez sur votre avatar).</li>
                        <li>Allez dans l'onglet <strong>Paramètres</strong>.</li>
                        <li>Cliquez sur le bouton <strong>"Supprimer mon compte"</strong>.</li>
                    </ol>
                    <p>Cette action efface instantanément votre profil de notre base de données.</p>
                </section>

                <section className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">5. Contact</h2>
                    <p>
                        Pour toute question concernant ce projet ou vos données, vous pouvez contacter le développeur directement (c'est moi, votre pote !).
                    </p>
                </section>

                <section className="space-y-2 border-t border-slate-800 pt-8 mt-8">
                    <h2 className="text-2xl font-bold text-white">6. Mentions Légales</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 p-4 rounded-xl">
                            <h3 className="font-bold text-fuchsia-400 mb-2">Éditeur du site</h3>
                            <p>Le site Chronobingo est édité à titre personnel.</p>
                            <p className="text-sm text-slate-400 mt-1">Responsable de la publication : L'administrateur du projet.</p>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-xl">
                            <h3 className="font-bold text-cyan-400 mb-2">Hébergement</h3>
                            <p>Ce site est hébergé par :</p>
                            <p className="font-bold mt-1">Northflank</p>
                            <p className="text-xs text-slate-400">London, UK<br />(Cloud Infrastructure)</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
