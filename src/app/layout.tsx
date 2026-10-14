import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prato Pronto — Receitas a partir das suas compras",
  description: "Transforme sua nota do mercado em receitas fitness personalizadas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
