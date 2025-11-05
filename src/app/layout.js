import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata = {
  title: "Binchro",
  description: "Le bingo des chansons de soirée",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className={`${GeistSans.className} bg-gray-900 text-white`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
