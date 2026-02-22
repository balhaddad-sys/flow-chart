import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - MedQ",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to home
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: February 2026
      </p>

      <div className="prose-muted mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            1. Information We Collect
          </h2>
          <p>We collect the following information:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Account information:</strong> name, email address, and
              authentication data when you create an account
            </li>
            <li>
              <strong>Uploaded materials:</strong> documents you upload for study
              purposes (PDFs, slides, Word documents)
            </li>
            <li>
              <strong>Usage data:</strong> quiz answers, study progress, and
              learning analytics
            </li>
            <li>
              <strong>Device information:</strong> browser type and general
              location for service optimisation
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            2. How We Use Your Information
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>To provide and personalise the study experience</li>
            <li>To generate AI-powered questions, study plans, and analytics</li>
            <li>To improve the Service and fix issues</li>
            <li>To communicate important updates about the Service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. AI Processing
          </h2>
          <p>
            Your uploaded materials and study data are processed by third-party
            AI providers (Google Gemini, Anthropic Claude) to generate
            educational content. These providers process data according to their
            own privacy policies and data processing agreements. We send only
            the minimum data necessary for content generation.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            4. Data Storage & Security
          </h2>
          <p>
            Your data is stored securely using Google Firebase infrastructure.
            We use industry-standard encryption in transit and at rest.
            Authentication is handled via Firebase Authentication with secure
            token-based sessions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. Data Sharing
          </h2>
          <p>
            We do not sell your personal data. Your uploaded materials are
            private to your account. We only share data with:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>AI providers for content generation (as described above)</li>
            <li>
              Study group members (only data you explicitly share in groups)
            </li>
            <li>
              Law enforcement when legally required
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            6. Your Rights
          </h2>
          <p>You have the right to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Access your personal data</li>
            <li>Delete your account and all associated data</li>
            <li>Correct inaccurate information</li>
          </ul>
          <p className="mt-2">
            You can delete your account from the Settings page, which removes
            all your data from our systems.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            7. Cookies
          </h2>
          <p>
            We use essential cookies for authentication and session management.
            We do not use third-party tracking or advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            8. Changes to This Policy
          </h2>
          <p>
            We may update this policy periodically. We will notify you of
            significant changes via email or in-app notification.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">9. Contact</h2>
          <p>
            For privacy-related inquiries, contact us at{" "}
            <a
              href="mailto:privacy@medq.app"
              className="text-primary hover:underline"
            >
              privacy@medq.app
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
