// LEGAL-02 — canonical consent text from idea-brief.md §5.2.
// VERBATIM. Do not paraphrase, reformat, or "improve". Counsel verifies the
// hash committed alongside this text in consent-text-hash.ts.
//
// Process for updating: bump CONSENT_VERSION, regenerate CONSENT_TEXT_SHA256
// via `pnpm --filter @humyn/api run legal:hash`, commit both files together
// in the same PR. Boot guard refuses to start otherwise.
//
// Source: idea-brief.md §5.2 — the Terms-of-Use popup body shown verbatim
// behind the pre-checked consent checkbox on the Sign-Up screen.
// Bug 3 / D3 (2026-06-04): bumped 1.0.0 → 1.1.0 for the coarse→precise location
// consent change (forces all existing users to re-accept on next launch).
export const CONSENT_VERSION = '1.1.0' as const;

export const CONSENT_TEXT = `By signing in, I consent and agree to upload videos of myself and/or others who consent to be recorded; performing certain daily activities/tasks. This content will be used to develop / train AI models and for research purposes. I confirm that I am 18 years or older and have the necessary permissions to share this content. I confirm that no one being recorded is a minor. I consent to my precise location (GPS coordinates) and IP address being captured alongside each recording. I understand that my data will be stored securely and used in accordance with Humyn's Privacy Policy. We comply with India's Digital Personal Data Protection Act (DPDP) and Brazil's Lei Geral de Proteção de Dados (LGPD).`;
