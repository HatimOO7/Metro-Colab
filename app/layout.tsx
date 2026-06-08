import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from 'sonner';
import { syncCurrentUserToDatabase } from '@/lib/sync-user';
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Metro Colab",
  description: "Created for the teachers and students of Metropolitan University",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await syncCurrentUserToDatabase();

  return (
    <ClerkProvider>
      <html lang="en">
        <body style={{ margin: 0, padding: 0 }}>
          {children}
          <Toaster richColors position="top-right" />
        </body>
      </html>
    </ClerkProvider>
  );
}
