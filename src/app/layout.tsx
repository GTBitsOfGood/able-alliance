import "../styles/globals.css";
import "./globals.css";
import Providers from "./providers";
import AppNavbar from "@/components/AppNavbar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppNavbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
