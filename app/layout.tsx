import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Vocal Key & Guitar Coach',
  description: 'A professional Progressive Web App to track vocal pitch in real time, estimate musical keys, display matching guitar chords, and get custom music theory coaching driven by Gemini.',
  manifest: '/manifest.json',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
