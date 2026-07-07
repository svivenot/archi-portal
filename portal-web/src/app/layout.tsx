import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Archi Portal - Référentiel de Documentation & Fiches ADR",
  description: "Portail collaboratif d'architecture logicielle basé sur arc42, le standard iSAQB et les Architecture Decision Records (ADR) avec synchronisation en temps réel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem('theme');
                  if (savedTheme === 'light') {
                    document.documentElement.classList.add('light-theme');
                  }
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
