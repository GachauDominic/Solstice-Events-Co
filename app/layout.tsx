import "./globals.css";

export const metadata = {
  title: "Solstice Events - Check-In Kiosk",
  description: "Fast, friendly event check-in and badge printing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
