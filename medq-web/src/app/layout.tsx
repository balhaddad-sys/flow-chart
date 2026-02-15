import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/error/error-boundary";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://medqs.vercel.app";

export const metadata: Metadata = {
  title: "MedQ - AI-Powered Medical Study Platform",
  description:
    "Upload materials, generate study plans, and ace your medical exams with AI-powered learning.",
  manifest: "/manifest.json",
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: "MedQ - AI-Powered Medical Study Platform",
    description:
      "Upload materials, generate study plans, and ace your medical exams with AI-powered learning.",
    url: APP_URL,
    siteName: "MedQ",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MedQ - AI Medical Study Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MedQ - AI-Powered Medical Study Platform",
    description:
      "Upload materials, generate study plans, and ace your medical exams with AI-powered learning.",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MedQ",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icons/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "MedQ",
              description:
                "AI-powered medical study platform for adaptive learning, quiz generation, and personalised study schedules.",
              applicationCategory: "EducationalApplication",
              operatingSystem: "Web",
              url: APP_URL,
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            }),
          }}
        />
      </head>
      <body
        className={`${plusJakarta.variable} ${spaceGrotesk.variable} font-sans antialiased`}
      >
        <ErrorBoundary>
          <Providers>{children}</Providers>
          <Toaster richColors position="top-center" />
        </ErrorBoundary>
      </body>
    </html>
  );
}
