import './globals.css';

export const metadata = {
  title: "L'OPJ - Droit Pénal Camerounais",
  description: "Agent IA pour la maîtrise du Code Pénal et Code de Procédure Pénale du Cameroun",
  viewport: 'width=device-width, initial-scale=1',
  charset: 'utf-8'
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>{children}</body>
    </html>
  );
}
