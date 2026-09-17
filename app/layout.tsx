import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NyayaLens — Self-Verifying AI Legal Co-pilot',
  description: 'A self-verifying AI legal co-pilot for everyday Indian legal documents.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col font-sans bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
