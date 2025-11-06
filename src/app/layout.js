"use client";
import React, { useState } from "react";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import LanguageSelector from "@/components/LanguageSelector";
import ClientProviders from "@/components/ClientProviders";

export default function RootLayout({ children }) {
  const getDefaultLang = () => {
    if (typeof navigator !== 'undefined') {
      const navLang = navigator.language || navigator.userLanguage || 'fr';
      return navLang.startsWith('en') ? 'en' : 'fr';
    }
    return 'fr';
  };
  const [lang, setLang] = useState(getDefaultLang());
  return (
    <html lang={lang}>
      <body className={`${GeistSans.className} bg-gray-900 text-white`}>
        <div className="sparkle-background"></div>
        <div className="fixed top-2 right-2 z-50">
          <LanguageSelector lang={lang} setLang={setLang} style={{ opacity: 0.5, fontSize: '0.9em', padding: '2px 6px', background: 'transparent', boxShadow: 'none' }} />
        </div>
        <ClientProviders lang={lang}>{children}</ClientProviders>
      </body>
    </html>
  );
}
