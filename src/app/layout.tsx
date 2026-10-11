import "../styles/globals.css";
import "./globals.css";
import Providers from "./providers";
import AppLayout from "./AppLayout";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GT Paratransit',
  description: 'Transportation management system built for Able Alliance by Bits of Good',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
