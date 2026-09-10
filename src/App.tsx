import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import * as tus from "tus-js-client";

import { supabase } from "./lib/supabase";
import "./App.css";
import spikeydeeVipLogo from "./assets/spikeydeevip-logo.png";
import bimboyLogo from "./assets/bimboy-logo.png";
/* =========================================================
   TYPES
   ========================================================= */

type AccessLevel =
  | "none"
  | "two_day_pass"
  | "thirty_day"
  | "twelve_month"
  | "lifetime";

type VideoAccessTier =
  | "day_and_monthly"
  | "monthly_only";

type MembershipState = {
  level: AccessLevel;
  expiresAt: string | null;
  accessSessionId: string | null;
  customerEmail: string | null;
};

type CheckoutStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired";

type CheckoutStatusResponse = {
  ok: boolean;
  status: CheckoutStatus;
  plan?: PaidPlan;
  email?: string;
  expiresAt?: string | null;
  accessSessionId?: string | null;
  message?: string;
};

type CheckoutActivationResponse = {
  ok: boolean;
  email: string;
  plan: PaidPlan;
  expiresAt: string | null;
  accessSessionId: string;
};

type ContentItem = {
  contentId: string;
  slug?: string;
  title: string;
  subtitle: string;
  duration: string;
  badge?: string;
  video?: string;
  description?: string;
  category?: string;
  performer?: string;
  seriesName?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  bunnyVideoId?: string;
  bunnyLibraryId?: string;
  bunnyStatus?: string;
  publishedAt?: string | null;
  accessTier: VideoAccessTier;
};

type HeaderNavTab =
  | "home"
  | "videos"
  | "performers"
  | "apply"
  | "plans";

type ViewMode =
  | "home"
  | "search"
  | "favorites"
  | "detail"
  | "account"
  | "studio"
  | "apply"
  | "legal";

type LegalPageKey =
  | "terms"
  | "privacy"
  | "2257"
  | "content-removal"
  | "billing"
  | "support";

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

type VideoRecord = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  duration_seconds: number | null;
  duration?: string | null;
  category: string | null;
  performer?: string | null;
  series?: string | null;
  series_name: string | null;
  badge: string | null;
  thumbnail_url: string | null;
  preview_url: string | null;
  video_path?: string | null;
  bunny_video_id?: string | null;
  bunny_library_id?: string | null;
  bunny_status?: string | null;
  bunny_thumbnail_url?: string | null;
  price_cents: number | null;
  currency: string;
  access_tier: VideoAccessTier;
  is_published: boolean;
  is_featured?: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

type HomepageBanner = {
  id: string;
  image_url: string;
  eyebrow: string | null;
  title: string | null;
  subtitle: string | null;
  button_text: string | null;
  button_link: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
};

type HomepageTile = {
  id: string;
  image_url: string;
  title: string | null;
  subtitle: string | null;
  button_text: string | null;
  button_link: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
};

type HomepageBrand = {
  id: string;
  logo_url: string;
  name: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string | null;
};

type HomepagePerformer = {
  id: string;
  name: string;
  subtitle: string | null;
  image_url: string;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string | null;
};

type ModelApplicationStatus =
  | "new"
  | "reviewing"
  | "accepted"
  | "declined";

type ModelApplication = {
  id: string;
  stage_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  social_links: string | null;
  experience: "new" | "some" | "experienced";
  interests: string[];
  availability: string | null;
  message: string | null;
  age_confirmed: boolean;
  status: ModelApplicationStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
};
type CompliancePerformer = {
  id: string;
  stage_name: string;
  legal_name: string;
  date_of_birth: string;
  aliases: string[];
  id_type: string | null;
  id_number_last4: string | null;
  id_expiration: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type CompliancePerformerFormState = {
  stageName: string;
  legalName: string;
  dateOfBirth: string;
  aliases: string;
  idType: string;
  idNumberLast4: string;
  idExpiration: string;
  notes: string;
};

const EMPTY_COMPLIANCE_PERFORMER_FORM: CompliancePerformerFormState = {
  stageName: "",
  legalName: "",
  dateOfBirth: "",
  aliases: "",
  idType: "",
  idNumberLast4: "",
  idExpiration: "",
  notes: "",
};

type ComplianceDocumentType =
  | "government_id"
  | "2257_record"
  | "performer_release"
  | "consent_form"
  | "other";

type ComplianceDocument = {
  id: string;
  performer_id: string | null;
  production_id: string | null;
  document_type: ComplianceDocumentType;
  storage_path: string;
  original_filename: string | null;
  issued_date: string | null;
  expiration_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
  retention_until: string | null;
};

type ComplianceProduction = {
  id: string;
  video_id: string | null;
  production_code: string;
  title: string;
  production_date: string;
  published_url: string | null;
  compliance_status: "incomplete" | "review" | "complete";
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ComplianceProductionPerformer = {
  id: string;
  production_id: string;
  performer_id: string;
  created_at: string;
};

type ProductionCompliancePerformerCheck = {
  performerId: string;
  stageName: string;
  governmentId: boolean;
  record2257: boolean;
  consentForm: boolean;
  performerRelease: boolean;
};

type ProductionComplianceCheck = {
  productionId: string;
  videoId: string | null;
  productionCode: string;
  productionDate: string;
  productionCodePresent: boolean;
  productionDatePresent: boolean;
  performerCount: number;
  performers: ProductionCompliancePerformerCheck[];
  recordsReady: boolean;
  complianceStatus: "incomplete" | "review" | "complete";
  publishReady: boolean;
};

type VideoFormState = {
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  durationMinutes: string;
  category: string;
  performer: string;
  seriesName: string;
  badge: string;
  accessTier: VideoAccessTier;
  isPublished: boolean;
  isFeatured: boolean;
};

/* =========================================================
   CONSTANTS/* =========================================================
   CONSTANTS
   ========================================================= */

const THIRTY_DAY_PRICE = "$9.99";
const TWO_DAY_PRICE = "$0.99";
const TWO_DAY_RENEWAL_PRICE = "$32.99";

const MEMBERSHIP_STORAGE_KEY =
  "spikeydeevip-paid-access";

const PENDING_CHECKOUT_STORAGE_KEY =
  "spikeydeevip-pending-checkout";

type PaidPlan = Exclude<AccessLevel, "none">;

const PLAN_LABELS: Record<PaidPlan, string> = {
  lifetime: "Lifetime Membership",
  twelve_month: "12 Month Membership",
  thirty_day: "30 Day Membership",
  two_day_pass: "2 Day Pass",
};



const AGE_GATE_STORAGE_KEY =
  "spikeydeevip-age-verified";

const MAX_HOMEPAGE_BANNERS = 6;
const MAX_HOMEPAGE_TILES = 6;
const MAX_HOMEPAGE_BRANDS = 12;
const MAX_HOMEPAGE_PERFORMERS = 8;

const SUPPORT_EMAIL = "spikeydeevip@gmail.com";
const BILLING_SUPPORT_EMAIL = "consumersupport@ccbill.com";
const BILLING_SUPPORT_PHONE = "888-596-9279";
const COMPLAINTS_EMAIL = "spikeydeevip@gmail.com";
const BUSINESS_NAME = "Spikeydee VIP";
const BUSINESS_PRINCIPAL = "Noah Wayne Curd";
const BUSINESS_CITY = "Las Vegas";
const BUSINESS_STATE = "Nevada";
const BUSINESS_COUNTRY = "United States";
const RECORDS_CUSTODIAN_NAME = "Noah Wayne Curd";
const RECORDS_CUSTODIAN_ADDRESS = "6605 Grand Montecito Pkwy, Suite 100, Las Vegas, NV 89149, USA";
const CCBILL_COMPLAINT_FORM =
  "https://www.ccbillcomplaintform.com/ccbill/form/CCBillContentRemovalRequest1/formperma/sBK2jfIoZWAFw2hRRt5Rv2PQncscFzpvOH6bPcwopas";

// Bunny Stream CDN hostname for this video library. This is public delivery
// configuration, not a secret API credential.
const BUNNY_STREAM_CDN_HOSTNAME = "vz-356f665c-64d.b-cdn.net";

const VIDEO_FILE = "";
const EMPTY_VIDEO_FORM: VideoFormState = {
  title: "",
  slug: "",
  subtitle: "",
  description: "",
  durationMinutes: "",
  category: "",
  performer: "",
  seriesName: "",
  badge: "",
  accessTier: "monthly_only",
  isPublished: false,
  isFeatured: false,
};

/* =========================================================
   FALLBACK DEMO CONTENT
   ========================================================= */

const fallbackFeatured: ContentItem[] = [
  {
    contentId: "after-dark",
    title: "After Dark",
    subtitle: "Spikeydeevip Original",
    duration: "36 min",
    badge: "ORIGINAL",
    video: VIDEO_FILE,
    description:
      "A premium Spikeydee VIP studio presentation.",
    category: "Jerk Off Videos",
    seriesName: "Spikeydee VIP Originals",
    accessTier: "day_and_monthly",
  },

  {
    contentId: "midnight-sessions",
    title: "Midnight Sessions",
    subtitle: "Studio Collection",
    duration: "51 min",
    badge: "NEW",
    description:
      "A premium release from the Spikeydee VIP catalog.",
    category: "Fetish Videos",
    accessTier: "day_and_monthly",
  },

  {
    contentId: "private-collection",
    title: "Private Collection",
    subtitle: "Premium Series",
    duration: "44 min",
    badge: "POPULAR",
    description:
      "Part of the premium Spikeydee VIP collection.",
    category: "Self Suck",
    accessTier: "monthly_only",
  },

  {
    contentId: "late-night",
    title: "Late Night",
    subtitle: "Spikeydeevip Exclusive",
    duration: "39 min",
    description:
      "Exclusive studio entertainment from Spikeydee VIP.",
    category: "Collab Videos",
    accessTier: "monthly_only",
  },
];

const fallbackNewReleases: ContentItem[] = [
  {
    contentId: "weekend-collection",
    title: "The Weekend Collection",
    subtitle: "New Release",
    duration: "48 min",
    badge: "NEW",
    category: "Jerk Off Videos",
    accessTier: "day_and_monthly",
  },

  {
    contentId: "vip-sessions",
    title: "VIP Sessions",
    subtitle: "Original Series",
    duration: "42 min",
    category: "Self Fuck",
    accessTier: "monthly_only",
  },

  {
    contentId: "studio-nights",
    title: "Studio Nights",
    subtitle: "Exclusive",
    duration: "55 min",
    category: "Collab Videos",
    accessTier: "monthly_only",
  },

  {
    contentId: "private-access",
    title: "Private Access",
    subtitle: "Premium",
    duration: "37 min",
    category: "Fetish Videos",
    accessTier: "day_and_monthly",
  },
];

const fallbackPopular: ContentItem[] = [
  {
    contentId: "top-picks",
    title: "Top Picks",
    subtitle: "Most Watched",
    duration: "46 min",
    badge: "TOP",
    category: "Self Suck",
    accessTier: "monthly_only",
  },

  {
    contentId: "vip-favorites",
    title: "VIP Favorites",
    subtitle: "Fan Favorites",
    duration: "41 min",
    category: "Jerk Off Videos",
    accessTier: "day_and_monthly",
  },

  {
    contentId: "the-collection",
    title: "The Collection",
    subtitle: "Popular Series",
    duration: "52 min",
    category: "Self Fuck",
    accessTier: "monthly_only",
  },

  {
    contentId: "after-hours",
    title: "After Hours",
    subtitle: "Trending",
    duration: "35 min",
    category: "Fetish Videos",
    accessTier: "day_and_monthly",
  },
];

const fallbackAllContent: ContentItem[] = [
  ...fallbackFeatured,
  ...fallbackNewReleases,
  ...fallbackPopular,
];

/* =========================================================
   HELPERS
   ========================================================= */

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDuration(
  seconds: number | null
) {
  if (!seconds) {
    return "—";
  }

  const minutes =
    Math.round(seconds / 60);

  return `${minutes} min`;
}

function accessTierLabel(
  tier: VideoAccessTier
) {
  return tier ===
    "day_and_monthly"
    ? "2-Day Pass + Full Membership"
    : "Full Membership Only";
}

function bunnyThumbnailUrl(videoId?: string | null) {
  if (!videoId) return undefined;

  return `https://${BUNNY_STREAM_CDN_HOSTNAME}/${videoId}/thumbnail.jpg`;
}

function videoRecordToContentItem(
  video: VideoRecord
): ContentItem {
  return {
    contentId: video.id,
    slug: video.slug,
    title: video.title,
    subtitle: video.subtitle ?? video.category ?? "Spikeydee VIP",
    duration: formatDuration(video.duration_seconds),
    badge: video.badge ?? undefined,
    // preview_url may be public promotional media only. The private full
    // video_path is intentionally never placed into public page state.
    video: video.preview_url ?? undefined,
    previewUrl: video.preview_url ?? undefined,
    // Prefer a manually uploaded poster. If none exists, use Bunny Stream's
    // generated thumbnail for the encoded video.
    thumbnailUrl:
      video.thumbnail_url ??
      video.bunny_thumbnail_url ??
      bunnyThumbnailUrl(video.bunny_video_id),
    bunnyVideoId: video.bunny_video_id ?? undefined,
    bunnyLibraryId: video.bunny_library_id ?? undefined,
    bunnyStatus: video.bunny_status ?? undefined,
    description: video.description ?? undefined,
    category: video.category ?? undefined,
    performer: video.performer ?? undefined,
    seriesName: video.series ?? video.series_name ?? undefined,
    publishedAt: video.published_at,
    accessTier: video.access_tier,
  };
}

function isAtLeast18OnDate(dateOfBirth: string, productionDate: string) {
  if (!dateOfBirth || !productionDate) return false;

  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const production = new Date(`${productionDate}T00:00:00`);

  if (Number.isNaN(birth.getTime()) || Number.isNaN(production.getTime())) {
    return false;
  }

  let age = production.getFullYear() - birth.getFullYear();
  const monthDifference = production.getMonth() - birth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && production.getDate() < birth.getDate())
  ) {
    age -= 1;
  }

  return age >= 18;
}

function loadStoredMembership(): MembershipState {
  const empty: MembershipState = {
    level: "none",
    expiresAt: null,
    accessSessionId: null,
    customerEmail: null,
  };

  try {
    const stored = localStorage.getItem(MEMBERSHIP_STORAGE_KEY);
    if (!stored) return empty;

    const parsed = JSON.parse(stored) as Partial<MembershipState>;
    const validLevels: AccessLevel[] = [
      "two_day_pass",
      "thirty_day",
      "twelve_month",
      "lifetime",
    ];

    if (!parsed.level || !validLevels.includes(parsed.level as AccessLevel)) {
      return empty;
    }

    if (!parsed.accessSessionId) return empty;

    if (parsed.expiresAt) {
      const expiration = new Date(parsed.expiresAt).getTime();
      if (Number.isFinite(expiration) && expiration <= Date.now()) {
        localStorage.removeItem(MEMBERSHIP_STORAGE_KEY);
        return empty;
      }
    }

    return {
      level: parsed.level as AccessLevel,
      expiresAt: parsed.expiresAt ?? null,
      accessSessionId: parsed.accessSessionId,
      customerEmail: parsed.customerEmail ?? null,
    };
  } catch {
    return empty;
  }
}

function loadAgeVerification() {
  try {
    return (
      window.sessionStorage.getItem(
        AGE_GATE_STORAGE_KEY
      ) === "true"
    );
  } catch {
    return false;
  }
}

/* =========================================================
   VIP ACCESS / CHECKOUT
   ========================================================= */

/* =========================================================
   VIP ACCESS / SIGNUP FLOW
   ========================================================= */

type AccessModalProps = {
  currentAccess: AccessLevel;
  initialEmail?: string;
  onClose: () => void;
  onCheckEmail: (
    email: string
  ) => Promise<string | null>;
  onStartCheckout: (
    plan: PaidPlan,
    email: string
  ) => Promise<string | null>;
};

function AccessModal({
  currentAccess,
  initialEmail = "",
  onClose,
  onCheckEmail,
  onStartCheckout,
}: AccessModalProps) {
  const [step, setStep] = useState<1 | 2>(currentAccess !== "none" ? 2 : 1);
  const [email, setEmail] = useState(initialEmail);
  const [notice, setNotice] = useState("");
  const [emailCheckBusy, setEmailCheckBusy] = useState(false);
  const [checkoutBusyPlan, setCheckoutBusyPlan] = useState<PaidPlan | null>(null);

  const continueToPlans = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (emailCheckBusy) return;

    const normalized = email
      .trim()
      .toLowerCase();

    if (
      !/^\S+@\S+\.\S+$/.test(
        normalized
      )
    ) {
      setNotice(
        "Enter a valid email address to continue."
      );

      return;
    }

    setEmail(normalized);
    setNotice("");
    setEmailCheckBusy(true);

    const existingMembershipMessage =
      await onCheckEmail(normalized);

    setEmailCheckBusy(false);

    if (existingMembershipMessage) {
      setNotice(existingMembershipMessage);
      return;
    }

    setStep(2);
  };

  const choosePlan = async (
    plan: PaidPlan
  ) => {
    if (checkoutBusyPlan) return;

    setCheckoutBusyPlan(plan);
    setNotice("");

    const message =
      await onStartCheckout(
        plan,
        email.trim().toLowerCase()
      );

    if (message) {
      setNotice(message);
      setCheckoutBusyPlan(null);
    }
  };

  const planCardStyle = {
    padding: "24px",
    border:
      "1px solid rgba(255,255,255,.10)",
    borderRadius: "18px",
    background: "var(--surface)",
    display: "flex",
    flexDirection: "column" as const,
    minHeight: "360px",
  };

  const hasCurrentPlan =
    currentAccess !== "none";

  const isCurrentPlan = (
    plan: PaidPlan
  ) =>
    hasCurrentPlan &&
    currentAccess === plan;

  const memberPlanCardStyle = (
    plan: PaidPlan
  ) => ({
    ...planCardStyle,
    border: isCurrentPlan(plan)
      ? "1px solid rgba(231,187,69,.88)"
      : "1px solid rgba(255,255,255,.10)",
    boxShadow: isCurrentPlan(plan)
      ? "0 0 0 1px rgba(231,187,69,.20), 0 18px 45px rgba(0,0,0,.30)"
      : undefined,
  });

  /* =======================================================
     STEP 1 — EMAIL SIGNUP LANDING PAGE
     ======================================================= */

  if (step === 1) {
    return (
      <div
        className="vip-signup-page"
        role="dialog"
        aria-modal="true"
        aria-label="Join Spikeydee VIP"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1200,
          overflowY: "auto",
        }}
      >
        <button
          type="button"
          aria-label="Close signup"
          onClick={onClose}
          className="vip-signup-close"
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            zIndex: 10,

            width: "44px",
            height: "44px",

            border:
              "1px solid rgba(255,255,255,.12)",

            borderRadius: "10px",

            background: "#101011",
            color: "#fff",

            fontSize: "22px",
          }}
        >
          ×
        </button>

        <div className="vip-signup-inner">

          {/* LOGO */}

          <img
            src={spikeydeeVipLogo}
            alt="Spikeydee VIP"
            className="vip-signup-logo"
          />


          {/* MAIN SIGNUP AREA */}

          <section className="vip-signup-hero">

            <h1>
              <span>JOIN VIP</span>{" "}
              FOR EXCLUSIVE ACCESS TO

              <strong>
                2,000+ RELEASES
              </strong>
            </h1>


            <form
              className="vip-signup-form"
              onSubmit={continueToPlans}
            >
              <div className="vip-signup-step">
                GET STARTED WITH YOUR EMAIL

                <span>
                  1 / 2
                </span>
              </div>


              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="Enter your email address"
                aria-label="Email address"
              />


              <button
                type="submit"
                className="vip-signup-continue"
                disabled={emailCheckBusy}
              >
                {emailCheckBusy ? "CHECKING…" : "CONTINUE"}
              </button>


              {notice && (
                <div
                  role="status"
                  style={{
                    marginTop: "16px",

                    padding:
                      "12px 14px",

                    border:
                      "1px solid rgba(231,187,69,.25)",

                    borderRadius:
                      "10px",

                    background:
                      "rgba(231,187,69,.05)",

                    color:
                      "#d8d8da",

                    fontSize:
                      "13px",

                    lineHeight:
                      1.5,
                  }}
                >
                  {notice}
                </div>
              )}

            </form>

          </section>


          {/* =================================================
              MEMBERSHIP BENEFITS
              ================================================= */}

          <section className="vip-benefits">

            <div className="vip-benefits-heading">

              <span className="vip-benefits-icon">
                ◆
              </span>

              <h2>
                YOUR{" "}

                <strong>
                  VIP MEMBERSHIP
                </strong>{" "}

                INCLUDES
              </h2>

            </div>


            <div className="vip-benefits-grid">

              {/* 1 */}

              <article className="vip-benefit-card">

                <div className="vip-benefit-number">
                  2000+
                </div>

                <h3>
                  Premium Releases
                </h3>

                <p>
                  Explore the complete
                  Spikeydee VIP collection.
                </p>

              </article>


              {/* 2 */}

              <article className="vip-benefit-card">

                <div className="vip-benefit-icon">
                  ✦
                </div>

                <h3>
                  New Releases
                </h3>

                <p>
                  New premium releases
                  added regularly.
                </p>

              </article>


              {/* 3 */}

              <article className="vip-benefit-card">

                <div className="vip-benefit-icon">
                  ▶
                </div>

                <h3>
                  HD Streaming
                </h3>

                <p>
                  High-quality playback
                  across the VIP library.
                </p>

              </article>


              {/* 4 */}

              <article className="vip-benefit-card">

                <div className="vip-benefit-icon">
                  ★
                </div>

                <h3>
                  VIP Exclusives
                </h3>

                <p>
                  Members-only releases
                  and premium collections.
                </p>

              </article>


              {/* 5 */}

              <article className="vip-benefit-card">

                <div className="vip-benefit-icon">
                  ▸
                </div>

                <h3>
                  Watch Anywhere
                </h3>

                <p>
                  Access from phone,
                  tablet, laptop,
                  or desktop.
                </p>

              </article>

            </div>

          </section>


          <div
            style={{
              marginTop: "50px",

              color:
                "var(--text-dim)",

              fontSize:
                "11px",

              lineHeight:
                1.6,
            }}
          >
            Adults 18+ only.
            Membership terms and billing
            details are shown before purchase.
          </div>
{/* =========================================================
    SOCIAL PROOF / AWARDS / LEGAL
    ========================================================= */}

<section className="vip-proof-section">

  {/* TESTIMONIALS */}

  <div className="vip-testimonials">

    <span className="section-kicker">
      SPIKEYDEE VIP
    </span>

    <h2 className="vip-proof-title">
      WHAT MEMBERS ARE SAYING
    </h2>

    <div className="vip-testimonial-grid">

      <blockquote className="vip-testimonial">
        <span className="vip-quote-mark">“</span>

        <p>
          SpikeyDeeVIP is easily one of my favorite memberships. The content
    feels exclusive, the quality is great, and there’s always something
    worth watching.
        </p>

        <footer>
          VERIFIED MEMBER
        </footer>
      </blockquote>


      <blockquote className="vip-testimonial">
        <span className="vip-quote-mark">“</span>

        <p>
          I joined for Spikey Dee and ended up loving the whole site.
    Everything feels much more personal and premium than the usual
    subscription sites.
        </p>

        <footer>
          VERIFIED MEMBER
        </footer>
      </blockquote>


      <blockquote className="vip-testimonial">
        <span className="vip-quote-mark">“</span>

        <p>
          The membership was completely worth it for me. Great content,
    easy to use, and I love having access to the full collection
    in one place.
        </p>

        <footer>
          VERIFIED MEMBER
        </footer>
      </blockquote>

    </div>

  </div>


  {/* AWARD */}

  <div className="vip-award-section">

    <span className="section-kicker">
      RECOGNITION
    </span>

    <div className="vip-award">

      <div className="vip-laurel vip-laurel-left">
        ❮
      </div>

      <div className="vip-award-copy">

        <span className="vip-award-small">
          AWARD-WINNING
        </span>

        <strong className="vip-award-number">
          3×
        </strong>

        <span className="vip-award-name">
          AVN AWARD WINNER
        </span>

      </div>

      <div className="vip-laurel vip-laurel-right">
        ❯
      </div>

    </div>

  </div>


{/* MEMBERSHIP DISCLOSURES */}

<section className="vip-membership-disclosures">

  <span className="section-kicker">
    MEMBERSHIP & BILLING
  </span>

  <h2>
    MEMBERSHIP DISCLOSURES
  </h2>

  <div className="vip-disclosure-copy">

    <p>
      <strong>Bimboy All Access — 1 Year Membership:</strong>{" "}
      $365.00 for 365 days of access to Bimboy + SpikeyDeeVIP.
      This plan launches October 10, 2026 and is not available
      for purchase before the launch date.
    </p>

    <p>
      <strong>30 Day Membership:</strong>{" "}
      $9.99 for the first 30 days. After the first 30 days,
      membership automatically renews at $32.99 every 30 days
      until cancelled.
    </p>

    <p>
      <strong>2 Day Pass:</strong>{" "}
      $0.99 for the first 2 days. After the promotional period,
      membership automatically renews at $32.99 every 30 days
      until cancelled.
    </p>

  </div>

  <div className="vip-legal-divider" />

  <div className="vip-legal-copy">

    <p>
      Adults 18+ only. All performers depicted in content
      available through SpikeyDeeVIP are represented as adults.
    </p>

    <p>
      Recurring memberships continue until cancelled.
      Final pricing, billing frequency, renewal terms,
      cancellation terms, and applicable conditions are
      displayed before purchase.
    </p>

    <p>
      By using SpikeyDeeVIP, you agree to the applicable
      Terms, Privacy Policy, Billing, Cancellation & Refund
      Policy, and Content Removal & Complaints Policy.
    </p>

    <p>
      Records required pursuant to 18 U.S.C. § 2257 are
      maintained in accordance with the site's published
      record-keeping compliance statement.
    </p>

  </div>

</section>


  {/* RTA */}

  <div className="vip-rta-section">

    <img
      src="/rta-logo.png"
      alt="RTA Restricted to Adults"
      className="vip-rta-logo"
    />

    <p>
      Restricted to adults 18+.
    </p>

  </div>

</section>
        </div>
      </div>
    );
  }


  /* =======================================================
     STEP 2 — MEMBERSHIP OPTIONS
     ======================================================= */

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.currentTarget ===
          event.target
        ) {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,

        zIndex: 1200,

        overflowY: "auto",

        padding: "28px 18px",

        background:
          "rgba(0,0,0,.92)",

        backdropFilter:
          "blur(14px)",
      }}
    >

      <section
        className="vip-access-page-shell"
        role="dialog"
        aria-modal="true"
        aria-label="Choose Spikeydee VIP membership"
        style={{
          width:
            "min(1260px, 100%)",

          margin:
            "0 auto",

          padding:
            "30px",

          border:
            "1px solid rgba(255,255,255,.10)",

          borderRadius:
            "22px",

          background:
            "#0c0c0d",

          boxShadow:
            "0 35px 100px rgba(0,0,0,.72)",
        }}
      >

        {/* TOP BAR */}

        <div
          style={{
            display: "flex",

            justifyContent:
              "space-between",

            alignItems:
              "flex-start",

            gap: "20px",
          }}
        >

          <div className="vip-access-heading">

            <span className="vip-access-eyebrow">
              SPIKEYDEE VIP MEMBERSHIP
            </span>

            <h2>
              CHOOSE YOUR ACCESS
            </h2>

            <p className="vip-access-subtitle">
              Select the membership that works best for you.
            </p>

            <p className="vip-access-account">
              <span>Signed in as</span>{" "}
              <strong>{email}</strong>
            </p>

            <div
              className="vip-access-heading-accent"
              aria-hidden="true"
            />

          </div>



        </div>

        {/* =================================================
            MEMBERSHIP GRID
            ================================================= */}

        <div
          className="vip-access-grid"
          style={{
            marginTop:
              "10px",
          }}
        >

          {/* BIMBOY ALL ACCESS — LAUNCHES 10/10/26 */}

          <article
            className={`vip-access-card bimboy-launch-card${
              isCurrentPlan("lifetime") ? " vip-access-card-current" : ""
            }`}
            aria-disabled={!isCurrentPlan("lifetime")}
            style={{
              ...memberPlanCardStyle("lifetime"),
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div className="bimboy-brand-lockup">
              <div className="bimboy-logo-slot">
                <img
                  src={bimboyLogo}
                  alt="Bimboy"
                  className="bimboy-card-logo"
                />
              </div>

              <div
                className="bimboy-all-access-text"
                aria-label="Bimboy All Access"
              >
                ALL ACCESS
              </div>
            </div>

            <h3 className="bimboy-plan-title">
              1 Year Membership
            </h3>

            <div className="bimboy-plan-price">
              $365.00
            </div>

            <div className="bimboy-plan-period">
              $1 / day
            </div>

            <p className="bimboy-plan-description">
              Access to Bimboy + SpikeyDeeVIP for 1 year.
            </p>

            <div
              className="bimboy-launch-date"
              aria-label="Launching October 10, 2026"
            >
              <span>LAUNCHING</span>
              <strong>10.10.26</strong>
            </div>

            <button
              type="button"
              className="bimboy-available-button"
              disabled
            >
              {isCurrentPlan("lifetime")
                ? "CURRENT PLAN"
                : hasCurrentPlan
                  ? "UPGRADE"
                  : "AVAILABLE OCT 10"}
            </button>
          </article>






          {/* 30 DAY */}

          <article
            className={`vip-access-card${
              isCurrentPlan("thirty_day") ? " vip-access-card-current" : ""
            }`}
            style={memberPlanCardStyle("thirty_day")}
          >

            <div className="spikeydeevip-badge-slot">


              <img


                src={spikeydeeVipLogo}


                alt="SpikeyDee VIP Only"


                className="spikeydeevip-only-badge"


              />
              <span
                aria-hidden="true"
                className="spikeydeevip-only-text"
              >
                ONLY
              </span>


            </div>

            <h3 className="membership-plan-title"
              style={{
                margin:
                  "12px 0 8px",

                fontSize:
                  "24px",
              }}
            >
              30 Day Membership
            </h3>


            <div className="membership-plan-price"
              style={{
                fontSize:
                  "38px",

                fontWeight:
                  850,
              }}
            >
              {THIRTY_DAY_PRICE}
            </div>


            <div className="membership-plan-period"
              style={{
                color:
                  "var(--text-muted)",

                marginTop:
                  "2px",
              }}
            >
              / first 30 days
            </div>


            <p className="membership-card-disclosure">
              First 30 days for $9.99. After the first 30 days, membership automatically renews at $32.99 every 30 days until cancelled.</p>


            <button
              type="button"
              className="primary-button"
              disabled={isCurrentPlan("thirty_day")}
              onClick={() => {
                if (!isCurrentPlan("thirty_day")) {
                  void choosePlan("thirty_day");
                }
              }}
            >
              {isCurrentPlan("thirty_day")
                ? "CURRENT PLAN"
                : checkoutBusyPlan === "thirty_day"
                  ? "OPENING CCBILL…"
                  : hasCurrentPlan
                    ? "UPGRADE"
                    : "START MEMBERSHIP"}
            </button>

          </article>


          {/* 2 DAY */}

          <article
            className={`vip-access-card${
              isCurrentPlan("two_day_pass") ? " vip-access-card-current" : ""
            }`}
            style={memberPlanCardStyle("two_day_pass")}
          >

            <div className="spikeydeevip-badge-slot">


              <img


                src={spikeydeeVipLogo}


                alt="SpikeyDee VIP Only"


                className="spikeydeevip-only-badge"


              />
              <span
                aria-hidden="true"
                className="spikeydeevip-only-text"
              >
                ONLY
              </span>


            </div>

            <h3 className="membership-plan-title"
              style={{
                margin:
                  "12px 0 8px",

                fontSize:
                  "24px",
              }}
            >
              2 Day Pass
            </h3>


            <div className="membership-plan-price"
              style={{
                fontSize:
                  "38px",

                fontWeight:
                  850,
              }}
            >
              {TWO_DAY_PRICE}
            </div>


            <div className="membership-plan-period"
              style={{
                color:
                  "var(--text-muted)",

                marginTop:
                  "2px",
              }}
            >
              / first 2 days
            </div>


            <p className="membership-card-disclosure">
              Initial 2-day promotional
              access. After 2 days,
              membership automatically
              renews at{" "}
              {TWO_DAY_RENEWAL_PRICE}{" "}
              every 30 days until
              cancelled.
            </p>


            <button
              type="button"
              className="primary-button"
              disabled={isCurrentPlan("two_day_pass")}
              onClick={() => {
                if (!isCurrentPlan("two_day_pass")) {
                  void choosePlan("two_day_pass");
                }
              }}
            >
              {isCurrentPlan("two_day_pass")
                ? "CURRENT PLAN"
                : checkoutBusyPlan === "two_day_pass"
                  ? "OPENING CCBILL…"
                  : hasCurrentPlan
                    ? "UPGRADE"
                    : "START MEMBERSHIP"}
            </button>

          </article>

        </div>


        {/* BIMBOY MEMBERSHIP BENEFITS */}

        <section className="bimboy-membership-benefits" aria-labelledby="bimboy-benefits-title">
          <h2 id="bimboy-benefits-title" className="bimboy-benefits-title">
            <span>YOUR</span>

            <img
              src={bimboyLogo}
              alt="Bimboy"
              className="bimboy-benefits-logo"
            />

            <span>MEMBERSHIP BENEFITS</span>
          </h2>

          <div className="bimboy-benefits-grid">
            <article className="bimboy-benefit-card">
              <div className="bimboy-benefit-icon bimboy-benefit-icon-4k">4K</div>
              <h3>Premium Quality</h3>
              <p>HD &amp; 4K streaming</p>
            </article>

            <article className="bimboy-benefit-card">
              <div className="bimboy-benefit-icon">NEW</div>
              <h3>New Releases</h3>
              <p>Fresh Bimboy content</p>
            </article>

            <article className="bimboy-benefit-card">
              <div className="bimboy-benefit-icon">▶</div>
              <h3>All Access</h3>
              <p>Bimboy + SpikeyDeeVIP</p>
            </article>

            <article className="bimboy-benefit-card">
              <div className="bimboy-benefit-icon">★</div>
              <h3>Premium Catalog</h3>
              <p>Members-only access</p>
            </article>

            <article className="bimboy-benefit-card">
              <div className="bimboy-benefit-icon">▶</div>
              <h3>Stream Anywhere</h3>
              <p>Watch on your devices</p>
            </article>
          </div>
        </section>


        {/* BILLING DISCLOSURE */}

        <section className="billing-disclosure billing-disclosure-expanded">
          <div className="billing-disclosure-header">
            <span className="billing-disclosure-kicker">SPIKEYDEE VIP</span>
            <h3>BILLING & MEMBERSHIP DISCLOSURE</h3>
          </div>

<div className="billing-plan-terms">
  <p>
    <strong>Bimboy All Access — 1 Year:</strong>{" "}
    $365.00 for 365 days of access. This plan launches October 10, 2026
    and is not available for purchase yet.
  </p>

  <p>
    <strong>30 Day Membership:</strong>{" "}
    $9.99 for the first 30 days. After the first 30 days,
    membership automatically renews at $32.99 every 30 days
    until cancelled. Full premium catalog access remains active
    while the membership is current.
  </p>

  <p>
    <strong>2 Day Pass:</strong>{" "}
    $0.99 for the first 2 days. After the promotional period,
    membership automatically renews at $32.99 every 30 days
    until cancelled.
  </p>
</div>

          <div className="billing-disclosure-divider" />

          <div className="billing-disclosure-notice">
            <p>
              Recurring memberships continue until cancelled. Final pricing,
              billing frequency, renewal terms, cancellation terms, and any
              applicable conditions are shown before purchase.
            </p>

            <p>
              Billing is processed by CCBill. For billing questions or
              cancellation assistance, contact CCBill Consumer Support at{" "}
              <strong>{BILLING_SUPPORT_PHONE}</strong> or{" "}
              <strong>{BILLING_SUPPORT_EMAIL}</strong>.
            </p>
          </div>

          <div className="billing-disclosure-divider" />

          <div className="billing-disclosure-legal">
            <p>
              SpikeyDeeVIP.com is intended for adults 18+ only. All performers
              appearing in content available through the service are adults,
              and content is produced by consenting adults for adult audiences.
            </p>

            <p>
              By purchasing or using a membership, you agree to the applicable
              Terms of Service, Privacy Policy, Billing, Cancellation & Refund
              Policy, and Content Removal & Complaints Policy.
            </p>

            <p>
              Records required pursuant to 18 U.S.C. § 2257 are maintained in
              accordance with the site's published record-keeping compliance
              statement.
            </p>
          </div>

          <div className="billing-disclosure-footer">
            <span>© 2026 SpikeyDeeVIP.com. All rights reserved.</span>

            <img
              src="/rta-logo.png"
              alt="RTA Restricted to Adults"
              className="billing-rta-logo"
            />
          </div>
        </section>


        {/* CHANGE EMAIL — only before a paid membership is active */}

        {!hasCurrentPlan && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setNotice("");
              setStep(1);
            }}
            style={{
              marginTop:
                "18px",
            }}
          >
            ← Change Email
          </button>
        )}


        {/* ERROR / NOTICE */}

        {notice && (
          <div
            role="status"
            className="membership-checkout-notice"
            style={{
              marginTop: "14px",
              maxWidth: "760px",
              padding: "10px 12px",
              border: "1px solid rgba(239,68,68,.30)",
              borderRadius: "10px",
              background: "rgba(127,29,29,.16)",
              color: "#f2b8b5",
              fontSize: "12.5px",
              lineHeight: 1.5,
            }}
          >
            {notice}
          </div>
        )}


        {/* CURRENT MEMBERSHIP */}

        {currentAccess !== "none" && (
          <p
            style={{
              marginTop:
                "18px",

              color:
                "var(--text-muted)",
            }}
          >
            Current access:{" "}

            {PLAN_LABELS[
              currentAccess as PaidPlan
            ] ?? "VIP access"}
          </p>
        )}

      </section>
    </div>
  );
}

/* =========================================================
   CONTENT CARD
   ========================================================= */

type ContentCardProps = {
  item:
    ContentItem;

  canWatch:
    boolean;

  onOpen:
    (
      item:
        ContentItem
    ) => void;

  isFavorite:
    boolean;

  onToggleFavorite:
    (
      item:
        ContentItem
    ) => void;

  favoriteBusy?:
    boolean;
};

function ContentCard({
  item,
  canWatch,
  onOpen,
  isFavorite,
  onToggleFavorite,
  favoriteBusy = false,
}: ContentCardProps) {
  return (
    <article className="content-card">
      <button
        type="button"
        className="card-image"
        onClick={() =>
          onOpen(
            item
          )
        }
        aria-label={`Open ${item.title}`}
      >
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt={`${item.title} thumbnail`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : item.video ? (
          <video
            className="card-video"
            src={item.video}
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="card-gradient" />
        )}

        <div className="card-gradient" />

        {item.badge && (
          <span className="card-badge">
            {
              item.badge
            }
          </span>
        )}

        <span
          style={{
            position:
              "absolute",

            top:
              "14px",

            right:
              "14px",

            padding:
              "7px 10px",

            borderRadius:
              "8px",

            background:
              "rgba(0,0,0,.76)",

            color:
              "#fff",

            fontSize:
              "11px",

            fontWeight:
              800,

            zIndex:
              4,
          }}
        >
          {item.accessTier ===
          "monthly_only"
            ? "MONTHLY VIP"
            : "1-DAY + VIP"}
        </span>

        <span className="card-play">
          {canWatch
            ? "▶"
            : "🔒"}
        </span>

        <span className="card-duration">
          {
            item.duration
          }
        </span>
      </button>

      <div className="card-info">
        <h3>
          {
            item.title
          }
        </h3>

        <p>
          {
            item.subtitle
          }
        </p>

        <div className="card-actions">
          <button
            type="button"
            className="small-button"
            onClick={() =>
              onOpen(
                item
              )
            }
          >
            {canWatch
              ? "Watch"
              : "Unlock"}
          </button>

          <button
            type="button"
            className={`favorite-button ${
              isFavorite
                ? "is-favorite"
                : ""
            }`}
            disabled={
              favoriteBusy
            }
            onClick={() =>
              onToggleFavorite(
                item
              )
            }
          >
            {favoriteBusy
              ? "…"
              : isFavorite
                ? "♥"
                : "♡"}
          </button>
        </div>
      </div>
    </article>
  );
}

/* =========================================================
   CONTENT ROW
   ========================================================= */

type ContentRowProps = {
  title:
    string;

  items:
    ContentItem[];

  onOpen:
    (
      item:
        ContentItem
    ) => void;

  sectionId:
    string;

  canWatchVideo:
    (
      item:
        ContentItem
    ) => boolean;

  favorites:
    string[];

  onToggleFavorite:
    (
      item:
        ContentItem
    ) => void;

  favoriteBusyIds:
    string[];
};

function ContentRow({
  title,
  items,
  onOpen,
  sectionId,
  canWatchVideo,
  favorites,
  onToggleFavorite,
  favoriteBusyIds,
}: ContentRowProps) {
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            SPIKEYDEE VIP
          </span>

          <h2>
            {
              title
            }
          </h2>
        </div>

        <button
          type="button"
          className="view-all"
          onClick={() =>
            document
              .getElementById(
                sectionId
              )
              ?.scrollIntoView({
                behavior:
                  "smooth",
              })
          }
        >
          View all →
        </button>
      </div>

      <div className="card-row">
        {items.map(
          (
            item
          ) => (
            <ContentCard
              key={
                item.contentId
              }
              item={
                item
              }
              canWatch={
                canWatchVideo(
                  item
                )
              }
              onOpen={
                onOpen
              }
              isFavorite={
                favorites.includes(
                  item.contentId
                )
              }
              onToggleFavorite={
                onToggleFavorite
              }
              favoriteBusy={
                favoriteBusyIds.includes(
                  item.contentId
                )
              }
            />
          )
        )}
      </div>
    </section>
  );
}

/* =========================================================
   SEARCH
   ========================================================= */

type SearchResultsProps = {
  query:
    string;

  items:
    ContentItem[];

  onOpen:
    (
      item:
        ContentItem
    ) => void;

  onClear:
    () => void;

  canWatchVideo:
    (
      item:
        ContentItem
    ) => boolean;

  favorites:
    string[];

  onToggleFavorite:
    (
      item:
        ContentItem
    ) => void;

  favoriteBusyIds:
    string[];
};

function SearchResults({
  query,
  items,
  onOpen,
  onClear,
  canWatchVideo,
  favorites,
  onToggleFavorite,
  favoriteBusyIds,
}: SearchResultsProps) {
  return (
    <main>
      <div className="content-wrapper">
        <section
          className="content-section"
          style={{
            paddingTop:
              "70px",

            paddingBottom:
              "70px",
          }}
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                SEARCH
              </span>

              <h2>
                Results for “
                {query}”
              </h2>
            </div>

            <button
              type="button"
              className="view-all"
              onClick={
                onClear
              }
            >
              Clear search ×
            </button>
          </div>

          {items.length >
          0 ? (
            <div className="card-row">
              {items.map(
                (
                  item
                ) => (
                  <ContentCard
                    key={
                      item.contentId
                    }
                    item={
                      item
                    }
                    canWatch={
                      canWatchVideo(
                        item
                      )
                    }
                    onOpen={
                      onOpen
                    }
                    isFavorite={
                      favorites.includes(
                        item.contentId
                      )
                    }
                    onToggleFavorite={
                      onToggleFavorite
                    }
                    favoriteBusy={
                      favoriteBusyIds.includes(
                        item.contentId
                      )
                    }
                  />
                )
              )}
            </div>
          ) : (
            <div
              style={{
                padding:
                  "70px 20px",

                textAlign:
                  "center",
              }}
            >
              <h2>
                Nothing matched “
                {query}”
              </h2>

              <button
                type="button"
                className="primary-button"
                onClick={
                  onClear
                }
              >
                Back to Browse
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   VIDEO DETAIL
   ========================================================= */

type VideoDetailProps = {
  item:
    ContentItem;

  canWatch:
    boolean;

  membership:
    MembershipState;

  adminAccess:
    boolean;

  onBack:
    () => void;

  onOpenAccess:
    () => void;

  favorites:
    string[];

  onToggleFavorite:
    (
      item:
        ContentItem
    ) => void;

  favoriteBusyIds:
    string[];
};

function VideoDetail({
  item,
  canWatch,
  membership,
  adminAccess,
  onBack,
  onOpenAccess,
  favorites,
  onToggleFavorite,
  favoriteBusyIds,
}: VideoDetailProps) {
  const isFavorite =
    favorites.includes(
      item.contentId
    );

  const favoriteBusy =
    favoriteBusyIds.includes(
      item.contentId
    );

  const requiresUpgrade =
    !adminAccess &&
    membership.level ===
      "two_day_pass" &&
    item.accessTier ===
      "monthly_only";

  const [bunnyEmbedUrl, setBunnyEmbedUrl] =
    useState<string | null>(null);
  const [playbackLoading, setPlaybackLoading] =
    useState(false);
  const [playbackError, setPlaybackError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    const loadBunnyPlayback = async () => {
      setBunnyEmbedUrl(null);
      setPlaybackError("");

      if (!canWatch || !item.bunnyVideoId) return;

      setPlaybackLoading(true);

      const { data, error } = await supabase.functions.invoke(
        "bunny-stream-playback",
        {
          body: {
            videoId: item.bunnyVideoId,
            accessSessionId: membership.accessSessionId ?? undefined,
          },
        }
      );

      if (cancelled) return;

      if (error) {
        console.error("Bunny playback Edge Function error:", error);
        setPlaybackError(
          "The secure video player could not be authorized. Try again in a moment."
        );
        setPlaybackLoading(false);
        return;
      }

      const response = data as { embedUrl?: unknown } | null;
      const embedUrl =
        typeof response?.embedUrl === "string"
          ? response.embedUrl
          : null;

      if (!embedUrl) {
        setPlaybackError(
          "The streaming service did not return a playable video URL."
        );
        setPlaybackLoading(false);
        return;
      }

      setBunnyEmbedUrl(embedUrl);
      setPlaybackLoading(false);
    };

    void loadBunnyPlayback();

    return () => {
      cancelled = true;
    };
  }, [canWatch, item.bunnyVideoId, membership.accessSessionId]);

  const accessText =
    adminAccess
      ? "Studio Admin"
      : canWatch && membership.level !== "none"
        ? PLAN_LABELS[membership.level as PaidPlan]
        : requiresUpgrade
          ? "Full Membership Required"
          : accessTierLabel(item.accessTier);

  return (
    <main className="video-detail-page">
      <section className="video-detail-hero">
        <button
          type="button"
          className="back-button"
          onClick={
            onBack
          }
        >
          ← Back to Browse
        </button>

        <div className="video-player">
          {canWatch && item.bunnyVideoId ? (
            bunnyEmbedUrl ? (
              <iframe
                title={`${item.title} video player`}
                src={bunnyEmbedUrl}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                style={{
                  width: "100%",
                  height: "100%",
                  minHeight: "560px",
                  border: 0,
                  display: "block",
                  background: "#000",
                }}
              />
            ) : (
  <div className="video-player-placeholder">
  {playbackLoading ? (
    <div className="video-buffer-spinner" />
  ) : (
    <p>{playbackError || "Preparing secure video playback..."}</p>
  )}
</div>
            )
          ) : canWatch && item.video ? (
            <video
              className="video-element"
              src={item.video}
              controls
              playsInline
              preload="metadata"
            />
          ) : canWatch ? (
            <div className="video-player-placeholder">
              <span className="video-player-button">▶</span>
              <p>This video is not connected to Bunny Stream yet.</p>
            </div>
          ) : (
            <div className="video-player-placeholder">
              <span
                className="video-player-button"
                style={{
                  fontSize:
                    "42px",
                }}
              >
                🔒
              </span>

              <p>
                {requiresUpgrade
                  ? "This title requires a full SpikeyDeeVIP membership."
                  : "VIP access required."}
              </p>

              <button
                type="button"
                className="primary-button"
                onClick={
                  onOpenAccess
                }
              >
                {requiresUpgrade
                  ? "View Full Memberships"
                  : "Choose VIP Access"}
              </button>
            </div>
          )}
        </div>

        <div className="video-detail-content">
          <span className="video-detail-kicker">
            SPIKEYDEE VIP
          </span>

          <h1>
            {
              item.title
            }
          </h1>

          <div className="video-detail-meta">
            <span>
              {
                item.duration
              }
            </span>

            <span>
              •
            </span>

            <span>
              {item.category ??
                "Premium"}
            </span>

            <span>
              •
            </span>

            <span>
              {canWatch
                ? "✓ ACCESS ACTIVE"
                : "🔒 ACCESS REQUIRED"}
            </span>
          </div>

          <p className="video-detail-description">
            {item.description ??
              "Premium studio entertainment from Spikeydee VIP."}
          </p>

          <div className="detail-actions">
            {canWatch ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  const video =
                    document.querySelector<HTMLVideoElement>(
                      ".video-element"
                    );

                  if (video) {
                    void video.play();
                    return;
                  }

                  document
                    .querySelector(".video-player")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                ▶ Watch Now
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                onClick={
                  onOpenAccess
                }
              >
                {requiresUpgrade
                  ? "View Full Memberships"
                  : "🔒 Unlock Access"}
              </button>
            )}

            <button
              type="button"
              className={`secondary-button ${
                isFavorite
                  ? "is-favorite"
                  : ""
              }`}
              disabled={
                favoriteBusy
              }
              onClick={() =>
                onToggleFavorite(
                  item
                )
              }
            >
              {favoriteBusy
                ? "Saving..."
                : isFavorite
                  ? "♥ In Favorites"
                  : "♡ Add to Favorites"}
            </button>
          </div>

          <div className="detail-information">
            <div className="detail-information-item">
              <span>
                Required Access
              </span>

              <strong>
                {accessTierLabel(
                  item.accessTier
                )}
              </strong>
            </div>

            <div className="detail-information-item">
              <span>
                Your Access
              </span>

              <strong>
                {
                  accessText
                }
              </strong>
            </div>

            <div className="detail-information-item">
              <span>
                Category
              </span>

              <strong>
                {item.category ??
                  "Premium"}
              </strong>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/* =========================================================
   FAVORITES
   ========================================================= */

type FavoritesPageProps = {
  items:
    ContentItem[];

  onOpen:
    (
      item:
        ContentItem
    ) => void;

  onBack:
    () => void;

  canWatchVideo:
    (
      item:
        ContentItem
    ) => boolean;

  favorites:
    string[];

  onToggleFavorite:
    (
      item:
        ContentItem
    ) => void;

  favoriteBusyIds:
    string[];

  loading:
    boolean;
};

function FavoritesPage({
  items,
  onOpen,
  onBack,
  canWatchVideo,
  favorites,
  onToggleFavorite,
  favoriteBusyIds,
  loading,
}: FavoritesPageProps) {
  return (
    <main>
      <div className="content-wrapper">
        <section
          className="content-section"
          style={{
            paddingTop:
              "70px",

            paddingBottom:
              "70px",
          }}
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                YOUR LIBRARY
              </span>

              <h2>
                Favorites
              </h2>
            </div>

            <button
              type="button"
              className="view-all"
              onClick={
                onBack
              }
            >
              Back to Browse
            </button>
          </div>

          {loading ? (
            <p>
              Loading favorites...
            </p>
          ) : items.length >
            0 ? (
            <div className="card-row">
              {items.map(
                (
                  item
                ) => (
                  <ContentCard
                    key={
                      item.contentId
                    }
                    item={
                      item
                    }
                    canWatch={
                      canWatchVideo(
                        item
                      )
                    }
                    onOpen={
                      onOpen
                    }
                    isFavorite={
                      favorites.includes(
                        item.contentId
                      )
                    }
                    onToggleFavorite={
                      onToggleFavorite
                    }
                    favoriteBusy={
                      favoriteBusyIds.includes(
                        item.contentId
                      )
                    }
                  />
                )
              )}
            </div>
          ) : (
            <p>
              No favorites yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   PAID CHECKOUT RETURN + ACCOUNT CREATION
   ========================================================= */

type CheckoutReturnModalProps = {
  checkoutId: string | null;
  onActivated: (membership: MembershipState) => void;
  onClose: () => void;
};

function CheckoutReturnModal({
  checkoutId,
  onActivated,
  onClose,
}: CheckoutReturnModalProps) {
  const [status, setStatus] = useState<CheckoutStatus>("pending");
  const [statusMessage, setStatusMessage] = useState(
    "Confirming your CCBill payment…"
  );
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [plan, setPlan] = useState<PaidPlan | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!checkoutId) {
      setStatus("failed");
      setStatusMessage(
        "We could not find this checkout in the browser. Please contact support with your CCBill receipt."
      );
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let timer: number | null = null;

    const checkStatus = async () => {
      attempts += 1;

      const { data, error } = await supabase.functions.invoke(
        "membership-status",
        {
          body: { checkoutId },
        }
      );

      if (cancelled) return;

      if (error) {
        if (attempts < 20) {
          timer = window.setTimeout(checkStatus, 2500);
          return;
        }

        setStatus("failed");
        setStatusMessage(
          "We could not confirm the payment yet. Your payment may still be processing."
        );
        return;
      }

      const result = data as CheckoutStatusResponse | null;

      if (!result?.ok) {
        setStatus("failed");
        setStatusMessage(
          result?.message ?? "We could not verify this checkout."
        );
        return;
      }

      setStatus(result.status);

      if (result.email) {
        setVerifiedEmail(result.email);
      }

      if (result.plan) {
        setPlan(result.plan);
      }

      if (result.status === "paid") {
        setStatusMessage(
          "Payment confirmed. Create your Spikeydee VIP password to activate your account."
        );
        return;
      }

      if (["failed", "cancelled", "expired"].includes(result.status)) {
        setStatusMessage(
          result.message ?? "This checkout is not active."
        );
        return;
      }

      if (attempts < 20) {
        setStatusMessage(
          "Payment received by CCBill. Waiting for the secure confirmation…"
        );
        timer = window.setTimeout(checkStatus, 2500);
      } else {
        setStatusMessage(
          "CCBill has not finished confirming the payment yet. Wait a moment and refresh this page."
        );
      }
    };

    void checkStatus();

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [checkoutId]);

  const createAccount = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setErrorMessage("");

    if (!checkoutId) {
      setErrorMessage("Missing checkout ID.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage(
        "Use a password with at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    setCreating(true);

    const { data, error } = await supabase.functions.invoke(
      "membership-create-account",
      {
        body: {
          checkoutId,
          password,
        },
      }
    );

    if (error) {
      setErrorMessage(error.message);
      setCreating(false);
      return;
    }

    const result = data as CheckoutActivationResponse | null;

    if (!result?.ok || !result.email) {
      setErrorMessage(
        "Your payment is confirmed, but the member account could not be activated."
      );
      setCreating(false);
      return;
    }

    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      });

    if (signInError) {
      setErrorMessage(
        `Your account was created, but automatic sign-in failed: ${signInError.message}`
      );
      setCreating(false);
      return;
    }

    sessionStorage.removeItem(
      PENDING_CHECKOUT_STORAGE_KEY
    );

    onActivated({
      level: result.plan,
      expiresAt: result.expiresAt,
      accessSessionId: result.accessSessionId,
      customerEmail: result.email,
    });

    setCreating(false);
    onClose();
  };

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1350,
        display: "grid",
        placeItems: "center",
        padding: "20px",
        overflowY: "auto",
        background: "rgba(0,0,0,.94)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Complete VIP membership"
        style={{
          width: "min(560px, 100%)",
          padding: "30px",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: "18px",
          background: "#0d0d0e",
          color: "#fff",
          boxShadow: "0 30px 90px rgba(0,0,0,.55)",
        }}
      >
        <span className="section-kicker">
          SECURE MEMBERSHIP ACTIVATION
        </span>

        <h2
          style={{
            margin: "10px 0 8px",
            fontSize: "30px",
          }}
        >
          {status === "paid"
            ? "Create Your VIP Password"
            : "Confirming Your Membership"}
        </h2>

        <p
          style={{
            margin: "0 0 20px",
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          {statusMessage}
        </p>

        {status === "paid" && (
          <>
            <div
              style={{
                marginBottom: "20px",
                padding: "14px 16px",
                border: "1px solid rgba(231,187,69,.22)",
                borderRadius: "12px",
                background: "rgba(231,187,69,.05)",
              }}
            >
              <strong
                style={{
                  display: "block",
                  color: "var(--gold-2)",
                }}
              >
                {plan ? PLAN_LABELS[plan] : "VIP Membership"}
              </strong>

              <span
                style={{
                  display: "block",
                  marginTop: "4px",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                }}
              >
                {verifiedEmail}
              </span>
            </div>

            <form onSubmit={createAccount}>
              <input
                required
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Create password"
                style={{
                  width: "100%",
                  height: "50px",
                  padding: "0 14px",
                  marginBottom: "12px",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  background: "#131314",
                  color: "#fff",
                }}
              />

              <input
                required
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Confirm password"
                style={{
                  width: "100%",
                  height: "50px",
                  padding: "0 14px",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  background: "#131314",
                  color: "#fff",
                }}
              />

              {errorMessage && (
                <p
                  role="alert"
                  style={{
                    color: "#ff7777",
                    lineHeight: 1.5,
                  }}
                >
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                className="vip-signup-continue"
                disabled={creating}
                style={{
                  width: "100%",
                  marginTop: "16px",
                }}
              >
                {creating
                  ? "ACTIVATING ACCOUNT…"
                  : "CREATE VIP ACCOUNT"}
              </button>
            </form>
          </>
        )}

        {status !== "paid" && (
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            style={{
              marginTop: "6px",
            }}
          >
            Return to Site
          </button>
        )}
      </section>
    </div>
  );
}

/* =========================================================
   MEMBER LOGIN
   ========================================================= */

type AuthModalProps = {
  onClose:
    () => void;
};

function AuthModal({
  onClose,
}: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
  
  };

  const handlePasswordReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    setErrorMessage("");
    setSuccessMessage("");

    if (!normalizedEmail) {
      setErrorMessage(
        "Enter your member email above, then select Reset password."
      );
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setResetLoading(true);

    const redirectTo =
      `${window.location.origin}/member-reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo,
      }
    );

    if (error) {
      setErrorMessage(error.message);
      setResetLoading(false);
      return;
    }

    setSuccessMessage(
      "Password reset email sent. Check your inbox and open the reset link."
    );
    setResetLoading(false);
  };

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        display: "grid",
        placeItems: "center",
        padding: "20px",
        background: "rgba(0,0,0,.86)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Member Login"
        style={{
          width: "min(430px,100%)",
          padding: "28px",
          background: "#0d0d0d",
          border: "1px solid var(--border)",
          borderRadius: "18px",
        }}
      >
        <span className="section-kicker">
          MEMBER ACCESS
        </span>

        <h2>
          Member Login
        </h2>

        <form onSubmit={handleSubmit}>
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="Email"
            style={{
              width: "100%",
              height: "46px",
              marginBottom: "12px",
              padding: "0 14px",
            }}
          />

          <input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Password"
            style={{
              width: "100%",
              height: "46px",
              padding: "0 14px",
            }}
          />

          {errorMessage && (
            <p
              role="alert"
              style={{
                color: "#ff7777",
                lineHeight: 1.5,
              }}
            >
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p
              role="status"
              style={{
                color: "#ffffff",
                lineHeight: 1.5,
              }}
            >
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={loading || resetLoading}
            style={{
              width: "100%",
              marginTop: "18px",
            }}
          >
            {loading
              ? "Please wait..."
              : "Log In"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void handlePasswordReset()}
          disabled={loading || resetLoading}
          style={{
            display: "block",
            margin: "14px auto 0",
            padding: 0,
            border: 0,
            background: "transparent",
            color: "var(--gold-2)",
            font: "inherit",
            fontSize: "13px",
            fontWeight: 750,
            textDecoration: "underline",
            textUnderlineOffset: "3px",
            cursor: resetLoading ? "default" : "pointer",
          }}
        >
          {resetLoading
            ? "Sending reset email..."
            : "Reset password"}
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={onClose}
          style={{
            marginTop: "16px",
          }}
        >
          Close
        </button>
      </section>
    </div>
  );
}

/* =========================================================
   STUDIO PASSWORD RESET
   ========================================================= */

type ResetPasswordModalProps = {
  onComplete: () => void;
};

function ResetPasswordModal({
  onComplete,
}: ResetPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const handleReset = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (password.length < 8) {
      setErrorMessage(
        "Use a password with at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        "The two passwords do not match."
      );
      return;
    }

    setLoading(true);

    const { data: sessionData } =
      await supabase.auth.getSession();

    if (!sessionData.session) {
      setErrorMessage(
        "This password-reset link is invalid or has expired. Request a new reset email from Studio Login."
      );
      setLoading(false);
      return;
    }

    const { error } =
      await supabase.auth.updateUser({
        password,
      });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();

    setPassword("");
    setConfirmPassword("");
    setSuccessMessage(
      "Password updated successfully. You can now return to Studio Login and sign in with your new password."
    );
    setLoading(false);
  };

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        display: "grid",
        placeItems: "center",
        padding: "20px",
        background: "rgba(0,0,0,.92)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Set new Studio password"
        style={{
          width: "min(430px,100%)",
          padding: "28px",
          background: "#0d0d0d",
          border: "1px solid var(--border)",
          borderRadius: "18px",
        }}
      >
        <span className="section-kicker">
          PRIVATE ADMIN
        </span>

        <h2>
          Set New Password
        </h2>

        {!successMessage ? (
          <form onSubmit={handleReset}>
            <input
              required
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="New password"
              style={{
                width: "100%",
                height: "46px",
                marginBottom: "12px",
                padding: "0 14px",
              }}
            />

            <input
              required
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              placeholder="Confirm new password"
              style={{
                width: "100%",
                height: "46px",
                padding: "0 14px",
              }}
            />

            {errorMessage && (
              <p
                role="alert"
                style={{
                  color: "#ff7777",
                  lineHeight: 1.5,
                }}
              >
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
              style={{
                width: "100%",
                marginTop: "18px",
              }}
            >
              {loading
                ? "Updating..."
                : "Set New Password"}
            </button>
          </form>
        ) : (
          <>
            <p
              role="status"
              style={{
                color: "#ffffff",
                lineHeight: 1.6,
              }}
            >
              {successMessage}
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={onComplete}
              style={{
                width: "100%",
                marginTop: "10px",
              }}
            >
              Return to Studio Login
            </button>
          </>
        )}
      </section>
    </div>
  );
}

/* =========================================================
   ACCOUNT
   ========================================================= */

type AccountPageProps = {
  session:
    Session;

  profile:
    Profile | null;

  profileLoading:
    boolean;

  favoritesCount:
    number;

  membership:
    MembershipState;

  onSaveDisplayName:
    (
      displayName:
        string
    ) => Promise<boolean>;

  onStudio:
    () => void;

  onLogout:
    () => void;

  onBack:
    () => void;
};

function AccountPage({
  session,
  profile,
  profileLoading,
  favoritesCount,
  membership,
  onSaveDisplayName,
  onStudio,
  onLogout,
  onBack,
}: AccountPageProps) {
  const [
    displayName,
    setDisplayName,
  ] =
    useState("");

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  useEffect(() => {
    setDisplayName(
      profile?.display_name ??
        ""
    );
  }, [
    profile?.display_name,
  ]);

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      setSaving(
        true
      );

      await onSaveDisplayName(
        displayName.trim()
      );

      setSaving(
        false
      );
    };

  const [accountNotice, setAccountNotice] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const membershipName =
    membership.level !== "none"
      ? PLAN_LABELS[membership.level as PaidPlan]
      : "No active membership";

  const membershipExpiration =
    membership.level === "lifetime"
      ? "Lifetime access"
      : membership.expiresAt
        ? new Date(membership.expiresAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "—";

  const sendPasswordReset = async () => {
    const email = session.user.email;
    if (!email || passwordBusy) return;

    setPasswordBusy(true);
    setAccountNotice("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/member-reset-password`,
    });

    setPasswordBusy(false);
    setAccountNotice(
      error
        ? error.message
        : "Password reset email sent. Check your inbox to continue.",
    );
  };

  return (
    <main>
      <div className="content-wrapper">
        <section
          className="content-section"
          style={{ paddingTop: "70px", paddingBottom: "90px" }}
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">MEMBER ACCOUNT</span>
              <h2>Account Settings</h2>
            </div>

            <button type="button" className="view-all" onClick={onBack}>
              Back to Site
            </button>
          </div>

          {profileLoading ? (
            <p>Loading account...</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "18px",
              }}
            >
              <section
                style={{
                  padding: "26px",
                  border: "1px solid var(--border)",
                  borderRadius: "18px",
                  background: "var(--surface)",
                }}
              >
                <span className="section-kicker">MEMBERSHIP</span>
                <h3 style={{ margin: "10px 0 18px", fontSize: "26px" }}>
                  {membershipName}
                </h3>

                <div style={{ display: "grid", gap: "14px" }}>
                  <div>
                    <div style={{ color: "var(--text-dim)", fontSize: "11px", letterSpacing: ".1em" }}>STATUS</div>
                    <strong style={{ color: "var(--gold-2)" }}>
                      {membership.level !== "none" ? "ACTIVE" : "INACTIVE"}
                    </strong>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-dim)", fontSize: "11px", letterSpacing: ".1em" }}>ACCESS THROUGH</div>
                    <strong>{membershipExpiration}</strong>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-dim)", fontSize: "11px", letterSpacing: ".1em" }}>EMAIL</div>
                    <strong>{session.user.email}</strong>
                  </div>
                </div>
              </section>

              <section
                style={{
                  padding: "26px",
                  border: "1px solid var(--border)",
                  borderRadius: "18px",
                  background: "var(--surface)",
                }}
              >
                <span className="section-kicker">PROFILE</span>
                <h3 style={{ margin: "10px 0 18px", fontSize: "26px" }}>Member Profile</h3>
                <form onSubmit={handleSubmit}>
                  <label htmlFor="member-display-name" style={{ display: "block", marginBottom: "8px", color: "var(--text-muted)", fontSize: "12px" }}>
                    Display name
                  </label>
                  <input
                    id="member-display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Display name"
                    style={{ width: "100%" }}
                  />
                  <button type="submit" className="primary-button" disabled={saving} style={{ width: "100%", marginTop: "12px" }}>
                    {saving ? "Saving..." : "Save Profile"}
                  </button>
                </form>
                <p style={{ margin: "18px 0 0", color: "var(--text-muted)" }}>
                  Favorites: <strong style={{ color: "#fff" }}>{favoritesCount}</strong>
                </p>
              </section>

              <section
                style={{
                  padding: "26px",
                  border: "1px solid var(--border)",
                  borderRadius: "18px",
                  background: "var(--surface)",
                }}
              >
                <span className="section-kicker">SECURITY & SUPPORT</span>
                <h3 style={{ margin: "10px 0 18px", fontSize: "26px" }}>Account Actions</h3>
                <div style={{ display: "grid", gap: "10px" }}>
                  <button type="button" className="secondary-button" onClick={() => void sendPasswordReset()} disabled={passwordBusy} style={{ width: "100%" }}>
                    {passwordBusy ? "Sending..." : "Change Password"}
                  </button>
                  <a
                    className="secondary-button"
                    href={`mailto:${BILLING_SUPPORT_EMAIL}`}
                    style={{ width: "100%", boxSizing: "border-box", textAlign: "center", textDecoration: "none" }}
                  >
                    Billing Support
                  </a>
                  {profile?.is_admin && (
                    <button type="button" className="primary-button" onClick={onStudio} style={{ width: "100%" }}>
                      Open Studio
                    </button>
                  )}
                  <button type="button" className="secondary-button" onClick={onLogout} style={{ width: "100%" }}>
                    Log Out
                  </button>
                </div>
                {accountNotice && (
                  <p role="status" style={{ margin: "16px 0 0", color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {accountNotice}
                  </p>
                )}
              </section>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   APPLY TO MODEL
   ========================================================= */

function ApplyToModelPage({ onBack }: { onBack: () => void }) {
  const [stageName, setStageName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [experience, setExperience] =
    useState<"new" | "some" | "experienced">("new");
  const [interests, setInterests] = useState<string[]>([]);
  const [availability, setAvailability] = useState("");
  const [message, setMessage] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [website, setWebsite] = useState("");
  const [frontPhoto, setFrontPhoto] = useState<File | null>(null);
  const [backPhoto, setBackPhoto] = useState<File | null>(null);
  const [sidePhoto, setSidePhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const toggleInterest = (value: string) => {
    setInterests((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  };

  const MAX_PORTFOLIO_FILE_BYTES = 15 * 1024 * 1024;
  const ALLOWED_PORTFOLIO_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);

  const portfolioExtension = (file: File) => {
    const byType: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/heic": "heic",
      "image/heif": "heif",
    };

    return byType[file.type] ?? "jpg";
  };

  const validatePortfolioPhoto = (file: File | null, label: string) => {
    if (!file) return `${label} photo is required.`;

    if (!ALLOWED_PORTFOLIO_TYPES.has(file.type)) {
      return `${label} photo must be JPG, PNG, WEBP, HEIC, or HEIF.`;
    }

    if (file.size > MAX_PORTFOLIO_FILE_BYTES) {
      return `${label} photo must be 15 MB or smaller.`;
    }

    return "";
  };

  const submitApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitError("");

    if (website.trim()) {
      setSubmitted(true);
      return;
    }

    if (!stageName.trim()) {
      setSubmitError("Enter your stage or preferred name.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setSubmitError("Enter a valid email address.");
      return;
    }

    if (!ageConfirmed) {
      setSubmitError("You must confirm that you are at least 18 years old.");
      return;
    }

    const portfolioValidationError =
      validatePortfolioPhoto(frontPhoto, "Front") ||
      validatePortfolioPhoto(backPhoto, "Back") ||
      validatePortfolioPhoto(sidePhoto, "Side");

    if (portfolioValidationError) {
      setSubmitError(portfolioValidationError);
      return;
    }

    setSubmitting(true);

    const applicationId = crypto.randomUUID();

    const { error } = await supabase.from("model_applications").insert({
      id: applicationId,
      stage_name: stageName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      social_links: socialLinks.trim() || null,
      experience,
      interests,
      availability: availability.trim() || null,
      message: message.trim() || null,
      age_confirmed: true,
      status: "new",
    });

    if (error) {
      setSubmitting(false);
      console.error("Could not submit model application:", error);
      setSubmitError("We could not submit your application. Please try again.");
      return;
    }

    const portfolioUploads = [
      ["front", frontPhoto],
      ["back", backPhoto],
      ["side", sidePhoto],
    ] as const;

    for (const [view, file] of portfolioUploads) {
      if (!file) continue;

      const storagePath =
        `applications/${applicationId}/${view}.${portfolioExtension(file)}`;

      const { error: uploadError } = await supabase.storage
        .from("model-application-portfolios")
        .upload(storagePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        setSubmitting(false);
        console.error(`Could not upload ${view} portfolio photo:`, uploadError);
        setSubmitError(
          "Your application was saved, but one or more portfolio photos could not be uploaded. Please contact the studio before submitting again."
        );
        return;
      }
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  const fieldStyle = {
    width: "100%",
    minHeight: "52px",
    padding: "0 15px",
    borderRadius: "11px",
    border: "1px solid rgba(255,255,255,.10)",
    background: "#121213",
    color: "#fff",
    outline: "none",
    boxSizing: "border-box" as const,
    fontSize: "15px",
  };

  const labelStyle = {
    display: "grid",
    gap: "8px",
    color: "#d8d8da",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: ".06em",
    textTransform: "uppercase" as const,
  };

  const cardStyle = {
    border: "1px solid rgba(255,255,255,.09)",
    borderRadius: "20px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,.008)), #0d0d0e",
    boxShadow: "0 24px 70px rgba(0,0,0,.24)",
  };

  return (
    <main>
      <div className="content-wrapper">
        <section
          className="content-section"
          style={{
            paddingTop: "54px",
            paddingBottom: "100px",
          }}
        >
          {/* HERO */}
          <div
            style={{
              ...cardStyle,
              position: "relative",
              overflow: "hidden",
              padding: "clamp(26px, 5vw, 54px)",
              marginBottom: "28px",
              background:
                "radial-gradient(circle at 82% 10%, rgba(231,187,69,.14), transparent 28%), linear-gradient(135deg, #111 0%, #0b0b0c 64%)",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, rgba(231,187,69,.05), transparent 34%)",
                pointerEvents: "none",
              }}
            />

            <div
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, .65fr)",
                gap: "clamp(28px, 5vw, 70px)",
                alignItems: "center",
              }}
            >
              <div>
                <span className="section-kicker">SPIKEYDEE VIP CASTING</span>

                <h1
                  style={{
                    margin: "12px 0 14px",
                    maxWidth: "760px",
                    fontSize: "clamp(42px, 6vw, 72px)",
                    lineHeight: .96,
                    letterSpacing: "-.045em",
                  }}
                >
                  Want to work
                  <br />
                  <span style={{ color: "var(--gold-2)" }}>with SpikeyDeeVIP?</span>
                </h1>

                <p
                  style={{
                    maxWidth: "720px",
                    margin: 0,
                    color: "var(--text-muted)",
                    lineHeight: 1.75,
                    fontSize: "16px",
                  }}
                >
                  Apply to be considered for upcoming SpikeyDeeVIP studio
                  productions. Tell us who you are, what you are interested in,
                  and how to reach you. If there is a fit, our studio will contact
                  you directly.
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    marginTop: "22px",
                  }}
                >
                  {["18+ ONLY", "PRIVATE APPLICATION", "STUDIO REVIEW"].map(
                    (item) => (
                      <span
                        key={item}
                        style={{
                          padding: "8px 11px",
                          borderRadius: "999px",
                          border: "1px solid rgba(231,187,69,.20)",
                          background: "rgba(231,187,69,.06)",
                          color: "#dbc678",
                          fontSize: "10px",
                          fontWeight: 900,
                          letterSpacing: ".09em",
                        }}
                      >
                        {item}
                      </span>
                    )
                  )}
                </div>
              </div>

              <div
                style={{
                  padding: "22px",
                  borderRadius: "16px",
                  border: "1px solid rgba(255,255,255,.08)",
                  background: "rgba(0,0,0,.24)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <span className="section-kicker">HOW IT WORKS</span>

                {[
                  ["01", "Apply", "Send your basic information."],
                  ["02", "Studio review", "We review applications privately."],
                  ["03", "We contact you", "If there is a fit, we reach out directly."],
                ].map(([number, title, copy], index) => (
                  <div
                    key={number}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1fr",
                      gap: "12px",
                      padding: "15px 0",
                      borderBottom:
                        index < 2
                          ? "1px solid rgba(255,255,255,.07)"
                          : "none",
                    }}
                  >
                    <strong
                      style={{
                        color: "var(--gold-2)",
                        fontSize: "12px",
                        letterSpacing: ".08em",
                      }}
                    >
                      {number}
                    </strong>
                    <div>
                      <strong
                        style={{
                          display: "block",
                          color: "#fff",
                          fontSize: "14px",
                        }}
                      >
                        {title}
                      </strong>
                      <span
                        style={{
                          display: "block",
                          marginTop: "4px",
                          color: "var(--text-muted)",
                          fontSize: "12px",
                          lineHeight: 1.5,
                        }}
                      >
                        {copy}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {submitted ? (
            <div
              style={{
                ...cardStyle,
                maxWidth: "820px",
                padding: "clamp(28px, 5vw, 48px)",
                border: "1px solid rgba(80,220,130,.28)",
                background:
                  "radial-gradient(circle at 100% 0%, rgba(80,220,130,.09), transparent 34%), #0d0d0e",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  display: "grid",
                  placeItems: "center",
                  marginBottom: "20px",
                  borderRadius: "50%",
                  background: "rgba(80,220,130,.12)",
                  border: "1px solid rgba(80,220,130,.28)",
                  color: "#72df9a",
                  fontSize: "22px",
                  fontWeight: 900,
                }}
              >
                ✓
              </div>

              <span className="section-kicker">APPLICATION RECEIVED</span>
              <h2
                style={{
                  margin: "10px 0",
                  fontSize: "clamp(28px, 4vw, 40px)",
                }}
              >
                You’re in our casting queue.
              </h2>
              <p
                style={{
                  maxWidth: "680px",
                  color: "var(--text-muted)",
                  lineHeight: 1.75,
                }}
              >
                Your application has been sent to the SpikeyDeeVIP studio team.
                If there is a fit for an upcoming production, we will contact you
                using the information you provided.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={onBack}
                style={{ marginTop: "8px" }}
              >
                RETURN TO SPIKEYDEE VIP
              </button>
            </div>
          ) : (
            <form
              onSubmit={submitApplication}
              style={{
                display: "grid",
                gap: "18px",
              }}
            >
              <input
                aria-hidden="true"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                style={{
                  position: "absolute",
                  left: "-10000px",
                  width: "1px",
                  height: "1px",
                }}
              />

              {/* SECTION 1 */}
              <section
                style={{
                  ...cardStyle,
                  padding: "clamp(22px, 4vw, 34px)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    marginBottom: "24px",
                  }}
                >
                  <span
                    style={{
                      width: "34px",
                      height: "34px",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "9px",
                      background: "rgba(231,187,69,.10)",
                      border: "1px solid rgba(231,187,69,.22)",
                      color: "var(--gold-2)",
                      fontSize: "11px",
                      fontWeight: 900,
                    }}
                  >
                    01
                  </span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "20px" }}>
                      About you
                    </h2>
                    <p
                      style={{
                        margin: "4px 0 0",
                        color: "var(--text-muted)",
                        fontSize: "13px",
                      }}
                    >
                      Start with your basic contact information.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(250px, 1fr))",
                    gap: "16px",
                  }}
                >
                  <label style={labelStyle}>
                    Stage / preferred name *
                    <input
                      required
                      value={stageName}
                      onChange={(event) => setStageName(event.target.value)}
                      placeholder="How should we address you?"
                      style={fieldStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Email address *
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      style={fieldStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Phone
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="Optional"
                      style={fieldStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Social links
                    <input
                      value={socialLinks}
                      onChange={(event) => setSocialLinks(event.target.value)}
                      placeholder="Instagram, X, website, etc."
                      style={fieldStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    City
                    <input
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      placeholder="City"
                      style={fieldStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    State
                    <input
                      value={state}
                      onChange={(event) => setState(event.target.value)}
                      placeholder="State"
                      style={fieldStyle}
                    />
                  </label>
                </div>
              </section>

              {/* SECTION 2 */}
              <section
                style={{
                  ...cardStyle,
                  padding: "clamp(22px, 4vw, 34px)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    marginBottom: "24px",
                  }}
                >
                  <span
                    style={{
                      width: "34px",
                      height: "34px",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "9px",
                      background: "rgba(231,187,69,.10)",
                      border: "1px solid rgba(231,187,69,.22)",
                      color: "var(--gold-2)",
                      fontSize: "11px",
                      fontWeight: 900,
                    }}
                  >
                    02
                  </span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "20px" }}>
                      Experience & interests
                    </h2>
                    <p
                      style={{
                        margin: "4px 0 0",
                        color: "var(--text-muted)",
                        fontSize: "13px",
                      }}
                    >
                      Tell us where you are starting and what you want to do.
                    </p>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "24px" }}>
                  <div>
                    <span className="section-kicker">EXPERIENCE</span>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: "10px",
                        marginTop: "11px",
                      }}
                    >
                      {([
                        ["new", "New", "No professional experience required."],
                        ["some", "Some Experience", "I have filmed or modeled before."],
                        ["experienced", "Experienced", "I regularly work in productions."],
                      ] as const).map(([value, label, copy]) => {
                        const selected = experience === value;

                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setExperience(value)}
                            style={{
                              minHeight: "78px",
                              padding: "14px",
                              textAlign: "left",
                              borderRadius: "12px",
                              border: selected
                                ? "1px solid rgba(231,187,69,.72)"
                                : "1px solid rgba(255,255,255,.09)",
                              background: selected
                                ? "rgba(231,187,69,.09)"
                                : "#111",
                              color: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            <strong
                              style={{
                                display: "block",
                                color: selected
                                  ? "var(--gold-2)"
                                  : "#fff",
                                fontSize: "13px",
                              }}
                            >
                              {selected ? "✓ " : ""}
                              {label}
                            </strong>
                            <span
                              style={{
                                display: "block",
                                marginTop: "5px",
                                color: "var(--text-muted)",
                                fontSize: "11px",
                                lineHeight: 1.45,
                              }}
                            >
                              {copy}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="section-kicker">
                      WHAT ARE YOU INTERESTED IN?
                    </span>
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginTop: "11px",
                      }}
                    >
                      {[
                        "Solo",
                        "Collaborations",
                        "Studio Productions",
                        "Other",
                      ].map((value) => {
                        const selected = interests.includes(value);

                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => toggleInterest(value)}
                            style={{
                              minHeight: "42px",
                              padding: "0 15px",
                              borderRadius: "999px",
                              border: selected
                                ? "1px solid rgba(231,187,69,.70)"
                                : "1px solid rgba(255,255,255,.10)",
                              background: selected
                                ? "rgba(231,187,69,.10)"
                                : "#111",
                              color: selected
                                ? "var(--gold-2)"
                                : "#ddd",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            {selected ? "✓ " : ""}
                            {value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 3 */}
              <section
                style={{
                  ...cardStyle,
                  padding: "clamp(22px, 4vw, 34px)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    marginBottom: "24px",
                  }}
                >
                  <span
                    style={{
                      width: "34px",
                      height: "34px",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "9px",
                      background: "rgba(231,187,69,.10)",
                      border: "1px solid rgba(231,187,69,.22)",
                      color: "var(--gold-2)",
                      fontSize: "11px",
                      fontWeight: 900,
                    }}
                  >
                    03
                  </span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "20px" }}>
                      Availability & introduction
                    </h2>
                    <p
                      style={{
                        margin: "4px 0 0",
                        color: "var(--text-muted)",
                        fontSize: "13px",
                      }}
                    >
                      Give us enough context to understand whether an upcoming
                      production might fit.
                    </p>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "16px" }}>
                  <label style={labelStyle}>
                    Availability / travel willingness
                    <input
                      value={availability}
                      onChange={(event) => setAvailability(event.target.value)}
                      placeholder="Example: Las Vegas, weekends, willing to travel"
                      style={fieldStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Tell us about yourself
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Introduce yourself, tell us what you are comfortable sharing, and what kind of work you are interested in."
                      rows={6}
                      style={{
                        ...fieldStyle,
                        padding: "15px",
                        resize: "vertical",
                        minHeight: "160px",
                        lineHeight: 1.6,
                      }}
                    />
                  </label>
                </div>
              </section>

              {/* SECTION 4 */}
              <section
                style={{
                  ...cardStyle,
                  padding: "clamp(22px, 4vw, 34px)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    marginBottom: "24px",
                  }}
                >
                  <span
                    style={{
                      width: "34px",
                      height: "34px",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "9px",
                      background: "rgba(231,187,69,.10)",
                      border: "1px solid rgba(231,187,69,.22)",
                      color: "var(--gold-2)",
                      fontSize: "11px",
                      fontWeight: 900,
                    }}
                  >
                    04
                  </span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "20px", color: "#fff" }}>
                      Portfolio
                    </h2>
                    <p
                      style={{
                        margin: "4px 0 0",
                        color: "var(--text-muted)",
                        fontSize: "13px",
                      }}
                    >
                      Please upload 3 photos: front, back, and side.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(230px, 1fr))",
                    gap: "14px",
                  }}
                >
                  {[
                    {
                      key: "front",
                      label: "Front photo",
                      file: frontPhoto,
                      setFile: setFrontPhoto,
                    },
                    {
                      key: "back",
                      label: "Back photo",
                      file: backPhoto,
                      setFile: setBackPhoto,
                    },
                    {
                      key: "side",
                      label: "Side photo",
                      file: sidePhoto,
                      setFile: setSidePhoto,
                    },
                  ].map(({ key, label, file, setFile }) => (
                    <label
                      key={key}
                      style={{
                        display: "grid",
                        gap: "10px",
                        minHeight: "168px",
                        padding: "18px",
                        borderRadius: "14px",
                        border: file
                          ? "1px solid rgba(231,187,69,.48)"
                          : "1px dashed rgba(255,255,255,.16)",
                        background: file
                          ? "rgba(231,187,69,.055)"
                          : "#111112",
                        cursor: "pointer",
                        alignContent: "center",
                      }}
                    >
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        required
                        onChange={(event) =>
                          setFile(event.target.files?.[0] ?? null)
                        }
                        style={{
                          position: "absolute",
                          opacity: 0,
                          pointerEvents: "none",
                          width: "1px",
                          height: "1px",
                        }}
                      />

                      <span
                        style={{
                          width: "38px",
                          height: "38px",
                          display: "grid",
                          placeItems: "center",
                          borderRadius: "10px",
                          border: "1px solid rgba(231,187,69,.22)",
                          background: "rgba(231,187,69,.08)",
                          color: "var(--gold-2)",
                          fontSize: "18px",
                          fontWeight: 900,
                        }}
                      >
                        {file ? "✓" : "+"}
                      </span>

                      <strong
                        style={{
                          color: "#fff",
                          fontSize: "14px",
                        }}
                      >
                        {label}
                      </strong>

                      <span
                        style={{
                          color: file ? "#d9c67b" : "var(--text-muted)",
                          fontSize: "12px",
                          lineHeight: 1.5,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {file
                          ? file.name
                          : "Click to choose a photo"}
                      </span>
                    </label>
                  ))}
                </div>

                <p
                  style={{
                    margin: "14px 0 0",
                    color: "var(--text-dim)",
                    fontSize: "11px",
                    lineHeight: 1.6,
                  }}
                >
                  JPG, PNG, WEBP, HEIC, or HEIF. Maximum 15 MB per photo.
                  Portfolio photos are stored privately and are intended only
                  for studio casting review.
                </p>
              </section>

              {/* CONFIRM & SUBMIT */}
              <section
                style={{
                  ...cardStyle,
                  padding: "clamp(22px, 4vw, 30px)",
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: "24px",
                  alignItems: "center",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "flex",
                      gap: "13px",
                      alignItems: "flex-start",
                      color: "#ddd",
                      lineHeight: 1.6,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={ageConfirmed}
                      onChange={(event) =>
                        setAgeConfirmed(event.target.checked)
                      }
                      style={{
                        width: "18px",
                        height: "18px",
                        marginTop: "3px",
                        accentColor: "#e7bb45",
                        flex: "0 0 auto",
                      }}
                    />
                    <span>
                      <strong style={{ color: "#fff" }}>
                        I confirm I am at least 18 years old.
                      </strong>{" "}
                      I understand that this is only a casting application.
                      Identity, age, consent, and production documentation are
                      completed separately if the studio decides to work with me.
                    </span>
                  </label>

                  <p
                    style={{
                      margin: "12px 0 0 31px",
                      color: "var(--text-dim)",
                      fontSize: "11px",
                      lineHeight: 1.55,
                    }}
                  >
                    Do not submit identification documents or other sensitive
                    records through this public form.
                  </p>

                  {submitError && (
                    <p
                      role="alert"
                      style={{
                        margin: "14px 0 0 31px",
                        color: "#ff8888",
                        fontSize: "13px",
                      }}
                    >
                      {submitError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={submitting}
                  style={{
                    minWidth: "210px",
                    minHeight: "50px",
                    padding: "0 22px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {submitting
                    ? "SUBMITTING…"
                    : "SUBMIT APPLICATION →"}
                </button>
              </section>

              <button
                type="button"
                className="secondary-button"
                onClick={onBack}
                style={{
                  justifySelf: "start",
                  marginTop: "4px",
                }}
              >
                ← BACK TO SITE
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   STUDIO DASHBOARD
   ========================================================= */

type StudioDashboardTab =
  | "overview"
  | "homepage"
  | "videos"
  | "models"
  | "compliance";

type StudioDashboardProps = {
  session: Session;
  profile: Profile;
  onBack: () => void;
  onCatalogChanged: () => Promise<void>;
  onViewVideo: (slug: string) => void;
};

type ComplianceBackupFailure = {
  id: string;
  document_id: string;
  failure_reason: string;
  first_failed_at: string;
  last_failed_at: string;
  consecutive_failures: number;
  initial_alert_sent_at: string | null;
  escalation_alert_sent_at: string | null;
};

type ComplianceBackupHealth = {
  ok: boolean;
  status: "healthy" | "warning" | "critical";
  totalDocuments: number;
  activeFailures: number;
  escalatedFailures: number;
  lastIntegrityActivity: string | null;
  lastIntegrityAction: string | null;
  failures: ComplianceBackupFailure[];
  checkedAt: string;
};

type ComplianceAuditHistoryEvent = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

type ComplianceAuditHistoryResponse = {
  ok: boolean;
  events: ComplianceAuditHistoryEvent[];
  count: number;
  checkedAt: string;
};

function StudioDashboard({
  session,
  profile,
  onBack,
  onCatalogChanged,
  onViewVideo,
}: StudioDashboardProps) {
  const [studioTab, setStudioTab] =
    useState<StudioDashboardTab>("overview");

  const openStudioTab = (tab: StudioDashboardTab) => {
    setStudioTab(tab);

    window.setTimeout(() => {
      document.getElementById("studio-tab-content")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const [modelApplications, setModelApplications] =
    useState<ModelApplication[]>([]);
  const [modelApplicationsLoading, setModelApplicationsLoading] =
    useState(false);
  const [modelApplicationsError, setModelApplicationsError] =
    useState("");
  const [modelApplicationsNotice, setModelApplicationsNotice] =
    useState("");
  const [modelApplicationSavingId, setModelApplicationSavingId] =
    useState<string | null>(null);

  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoRecord | null>(null);
  const [form, setForm] = useState<VideoFormState>(EMPTY_VIDEO_FORM);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [complianceBackupHealth, setComplianceBackupHealth] =
    useState<ComplianceBackupHealth | null>(null);
  const [complianceBackupHealthLoading, setComplianceBackupHealthLoading] =
    useState(false);
  const [complianceBackupHealthError, setComplianceBackupHealthError] =
    useState("");
  const [complianceAuditHistory, setComplianceAuditHistory] =
    useState<ComplianceAuditHistoryEvent[]>([]);
  const [complianceAuditHistoryLoading, setComplianceAuditHistoryLoading] =
    useState(false);
  const [complianceAuditHistoryError, setComplianceAuditHistoryError] =
    useState("");
  const [complianceAuditExportLoading, setComplianceAuditExportLoading] =
    useState(false);
  const [complianceAuditExportError, setComplianceAuditExportError] =
    useState("");
  const [complianceAuditExportMessage, setComplianceAuditExportMessage] =
    useState("");
  const [complianceAuditActionFilter, setComplianceAuditActionFilter] =
    useState("");
  const [complianceAuditEntityIdFilter, setComplianceAuditEntityIdFilter] =
    useState("");
  const [complianceAuditFromFilter, setComplianceAuditFromFilter] =
    useState("");
  const [complianceAuditToFilter, setComplianceAuditToFilter] =
    useState("");
  const [complianceAuditLimitFilter, setComplianceAuditLimitFilter] =
    useState("100");
type HomepageHeroSettings = {
  setting_key: string;
  featured_video_id: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_description: string | null;
  teaser_start_seconds: number;
  teaser_end_seconds: number | null;
  autoplay: boolean;
  loop_teaser: boolean;
};

const [heroSettings, setHeroSettings] = useState<HomepageHeroSettings>({
  setting_key: "homepage_hero",
  featured_video_id: null,
  hero_title: "Featured Release",
  hero_subtitle: "SPIKEYDEE VIP ORIGINAL",
  hero_description: "Watch the latest featured release from Spikeydee VIP.",
  teaser_start_seconds: 0,
  teaser_end_seconds: null,
  autoplay: true,
  loop_teaser: true,
});

const [heroSaving, setHeroSaving] = useState(false);
const [heroMessage, setHeroMessage] = useState("");
const [heroError, setHeroError] = useState("");
const [homepageBanners, setHomepageBanners] = useState<HomepageBanner[]>([]);
const [bannerFile, setBannerFile] = useState<File | null>(null);
const [bannerEyebrow, setBannerEyebrow] = useState("SPIKEYDEE VIP");
const [bannerTitle, setBannerTitle] = useState("");
const [bannerSubtitle, setBannerSubtitle] = useState("");
const [bannerSaving, setBannerSaving] = useState(false);
const [bannerMessage, setBannerMessage] = useState("");
const [bannerError, setBannerError] = useState("");

const activeHomepageBannerCount = homepageBanners.filter(
  (banner) => banner.is_published
).length;

const [homepageTiles, setHomepageTiles] = useState<HomepageTile[]>([]);
const [tileFile, setTileFile] = useState<File | null>(null);
const [tileTitle, setTileTitle] = useState("");
const [tileSubtitle, setTileSubtitle] = useState("");
const [tileSaving, setTileSaving] = useState(false);
const [tileMessage, setTileMessage] = useState("");
const [tileError, setTileError] = useState("");

const activeHomepageTileCount = homepageTiles.filter(
  (tile) => tile.is_published
).length;

const [homepageBrands, setHomepageBrands] = useState<HomepageBrand[]>([]);
const [brandFile, setBrandFile] = useState<File | null>(null);
const [brandName, setBrandName] = useState("");
const [brandSaving, setBrandSaving] = useState(false);
const [brandMessage, setBrandMessage] = useState("");
const [brandError, setBrandError] = useState("");

const activeHomepageBrandCount = homepageBrands.filter(
  (brand) => brand.is_published
).length;

const [homepagePerformers, setHomepagePerformers] = useState<HomepagePerformer[]>([]);
const [performerFile, setPerformerFile] = useState<File | null>(null);
const [performerName, setPerformerName] = useState("");
const [performerSubtitle, setPerformerSubtitle] = useState("FEATURED PERFORMER");
const [performerSaving, setPerformerSaving] = useState(false);
const [performerMessage, setPerformerMessage] = useState("");
const [performerError, setPerformerError] = useState("");

const activeHomepagePerformerCount = homepagePerformers.filter(
  (performer) => performer.is_published
).length;
const [compliancePerformers, setCompliancePerformers] = useState<CompliancePerformer[]>([]);
const [compliancePerformerForm, setCompliancePerformerForm] =
  useState<CompliancePerformerFormState>(EMPTY_COMPLIANCE_PERFORMER_FORM);
const [compliancePerformerSaving, setCompliancePerformerSaving] = useState(false);
const [compliancePerformerMessage, setCompliancePerformerMessage] = useState("");
const [compliancePerformerError, setCompliancePerformerError] = useState("");

const [complianceDocuments, setComplianceDocuments] = useState<ComplianceDocument[]>([]);
const [complianceDocumentPerformerId, setComplianceDocumentPerformerId] = useState("");
const [complianceDocumentType, setComplianceDocumentType] =
  useState<ComplianceDocumentType>("government_id");
const [complianceDocumentFile, setComplianceDocumentFile] = useState<File | null>(null);
const [complianceDocumentIssuedDate, setComplianceDocumentIssuedDate] = useState("");
const [complianceDocumentExpirationDate, setComplianceDocumentExpirationDate] = useState("");
const [complianceDocumentNotes, setComplianceDocumentNotes] = useState("");
const [complianceDocumentSaving, setComplianceDocumentSaving] = useState(false);
const [complianceDocumentMessage, setComplianceDocumentMessage] = useState("");
const [complianceDocumentError, setComplianceDocumentError] = useState("");
const [complianceRestoreBusyDocumentId, setComplianceRestoreBusyDocumentId] =
  useState<string | null>(null);

const [productionCode, setProductionCode] = useState("");
const [productionDate, setProductionDate] = useState("");
const [editingComplianceProductionId, setEditingComplianceProductionId] =
  useState<string | null>(null);
const [selectedCompliancePerformerIds, setSelectedCompliancePerformerIds] =
  useState<string[]>([]);
const [selectedComplianceDocumentIds, setSelectedComplianceDocumentIds] =
  useState<string[]>([]);
const [productionComplianceMessage, setProductionComplianceMessage] = useState("");
const [productionComplianceError, setProductionComplianceError] = useState("");
const [productionComplianceCheck, setProductionComplianceCheck] =
  useState<ProductionComplianceCheck | null>(null);
const [productionComplianceCheckLoading, setProductionComplianceCheckLoading] =
  useState(false);
const [productionComplianceApprovalBusy, setProductionComplianceApprovalBusy] =
  useState(false);

  type BunnyUploadCredentials = {
    success?: boolean;
    videoId: string;
    libraryId: string;
    expirationTime: number;
    signature: string;
    embedUrl?: string;
  };

  const loadVideos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setVideos([]);
    } else {
      setVideos((data ?? []) as VideoRecord[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (profile.is_admin) void loadVideos();
  }, [profile.is_admin]);
const loadHeroSettings = async () => {
  const { data, error } = await supabase
    .from("site_settings")
    .select(
      `
        setting_key,
        featured_video_id,
        hero_title,
        hero_subtitle,
        hero_description,
        teaser_start_seconds,
        teaser_end_seconds,
        autoplay,
        loop_teaser
      `
    )
    .eq("setting_key", "homepage_hero")
    .single();

  if (error) {
    console.error("Could not load homepage hero settings:", error);
    setHeroError("Could not load homepage hero settings.");
    return;
  }

  if (data) {
    setHeroSettings({
      setting_key: data.setting_key,
      featured_video_id: data.featured_video_id,
      hero_title: data.hero_title,
      hero_subtitle: data.hero_subtitle,
      hero_description: data.hero_description,
      teaser_start_seconds: data.teaser_start_seconds ?? 0,
      teaser_end_seconds: data.teaser_end_seconds,
      autoplay: data.autoplay ?? true,
      loop_teaser: data.loop_teaser ?? true,
    });
  }
};

useEffect(() => {
  if (profile.is_admin) {
    void loadHeroSettings();
    void loadHomepageBanners();
    void loadHomepageBrands();
    void loadHomepageTiles();
    void loadHomepagePerformers();
    void loadCompliancePerformers();
    void loadComplianceDocuments();
  }
}, [profile.is_admin]);

const loadHomepageBanners = async () => {
  const { data, error } = await supabase
    .from("homepage_banners")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Could not load homepage banners:", error);
    setBannerError(error.message);
    return;
  }

  setHomepageBanners((data ?? []) as HomepageBanner[]);
};

const loadHomepageBrands = async () => {
  const { data, error } = await supabase
    .from("homepage_brands")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Could not load homepage brands:", error);
    setBrandError(error.message);
    return;
  }

  setHomepageBrands((data ?? []) as HomepageBrand[]);
};

const loadHomepageTiles = async () => {
  const { data, error } = await supabase
    .from("homepage_tiles")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Could not load homepage tiles:", error);
    setTileError(error.message);
    return;
  }

  setHomepageTiles((data ?? []) as HomepageTile[]);
};

const loadHomepagePerformers = async () => {
  const { data, error } = await supabase
    .from("homepage_performers")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("Could not load homepage performers:", error);
    setPerformerError(error.message);
    return;
  }
  setHomepagePerformers((data ?? []) as HomepagePerformer[]);
};


const loadCompliancePerformers = async () => {
  const { data, error } = await supabase
    .from("compliance_performers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load compliance performers:", error);
    setCompliancePerformerError(error.message);
    return;
  }

  setCompliancePerformers((data ?? []) as CompliancePerformer[]);
};

const loadComplianceDocuments = async () => {
  const { data, error } = await supabase
    .from("compliance_documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load compliance documents:", error);
    setComplianceDocumentError(error.message);
    return;
  }

  setComplianceDocuments((data ?? []) as ComplianceDocument[]);
};

const resetProductionComplianceForm = () => {
  setProductionCode("");
  setProductionDate("");
  setEditingComplianceProductionId(null);
  setSelectedCompliancePerformerIds([]);
  setSelectedComplianceDocumentIds([]);
  setProductionComplianceMessage("");
  setProductionComplianceError("");
  setProductionComplianceCheck(null);
  setProductionComplianceCheckLoading(false);
};

const refreshProductionComplianceCheck = async (productionId: string) => {
  setProductionComplianceCheckLoading(true);

  const { data, error } = await supabase.rpc(
    "get_production_compliance_check",
    { p_production_id: productionId }
  );

  setProductionComplianceCheckLoading(false);

  if (error) {
    setProductionComplianceCheck(null);
    setProductionComplianceError(
      `Could not load the server compliance checklist: ${error.message}`
    );
    return null;
  }

  const check = data as ProductionComplianceCheck;
  setProductionComplianceCheck(check);
  return check;
};

const loadProductionComplianceForVideo = async (videoId: string) => {
  setProductionComplianceError("");
  setProductionComplianceMessage("");

  const { data: production, error: productionError } = await supabase
    .from("compliance_productions")
    .select("*")
    .eq("video_id", videoId)
    .maybeSingle();

  if (productionError) {
    setProductionComplianceError(productionError.message);
    return;
  }

  if (!production) {
    resetProductionComplianceForm();
    return;
  }

  const typedProduction = production as ComplianceProduction;
  setEditingComplianceProductionId(typedProduction.id);
  setProductionCode(typedProduction.production_code);
  setProductionDate(typedProduction.production_date);

  const [performerResult, documentResult] = await Promise.all([
    supabase
      .from("compliance_production_performers")
      .select("id, production_id, performer_id, created_at")
      .eq("production_id", typedProduction.id),
    supabase
      .from("compliance_documents")
      .select("id, archived_at")
      .eq("production_id", typedProduction.id)
      .is("archived_at", null),
  ]);

  if (performerResult.error) {
    setProductionComplianceError(performerResult.error.message);
    return;
  }

  if (documentResult.error) {
    setProductionComplianceError(documentResult.error.message);
    return;
  }

  setSelectedCompliancePerformerIds(
    ((performerResult.data ?? []) as ComplianceProductionPerformer[]).map(
      (row) => row.performer_id
    )
  );
  setSelectedComplianceDocumentIds(
    (documentResult.data ?? []).map((row) => row.id as string)
  );

  await refreshProductionComplianceCheck(typedProduction.id);
};

const toggleCompliancePerformerForProduction = (performerId: string) => {
  setSelectedCompliancePerformerIds((current) =>
    current.includes(performerId)
      ? current.filter((id) => id !== performerId)
      : [...current, performerId]
  );

  if (selectedCompliancePerformerIds.includes(performerId)) {
    const performerDocumentIds = complianceDocuments
      .filter(
        (document) =>
          document.performer_id === performerId &&
          !document.archived_at
      )
      .map((document) => document.id);
    setSelectedComplianceDocumentIds((current) =>
      current.filter((id) => !performerDocumentIds.includes(id))
    );
  }
};

const toggleComplianceDocumentForProduction = (documentId: string) => {
  setSelectedComplianceDocumentIds((current) =>
    current.includes(documentId)
      ? current.filter((id) => id !== documentId)
      : [...current, documentId]
  );
};

const saveProductionCompliance = async (
  videoId: string,
  title: string,
  slug: string
) => {
  const code = productionCode.trim();
  const date = productionDate;
  const hasAnyComplianceInput =
    Boolean(code) ||
    Boolean(date) ||
    selectedCompliancePerformerIds.length > 0 ||
    selectedComplianceDocumentIds.length > 0;

  if (!hasAnyComplianceInput) return;

  if (!code || !date) {
    throw new Error(
      "Production ID and production date are required when adding a compliance record."
    );
  }

  if (selectedCompliancePerformerIds.length === 0) {
    throw new Error(
      "Choose at least one compliance performer for this production."
    );
  }

  setProductionComplianceError("");
  setProductionComplianceMessage("");

  const productionPayload = {
    video_id: videoId,
    production_code: code,
    title,
    production_date: date,
    published_url: `${window.location.origin}/video/${slug}`,
    compliance_status: "review",
    updated_at: new Date().toISOString(),
  };

  let productionId = editingComplianceProductionId;

  if (productionId) {
    const { error } = await supabase
      .from("compliance_productions")
      .update(productionPayload)
      .eq("id", productionId);
    if (error) throw new Error(`Could not update compliance production: ${error.message}`);
  } else {
    const { data, error } = await supabase
      .from("compliance_productions")
      .insert({
        ...productionPayload,
        created_by: session.user.id,
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      throw new Error(
        `Could not create compliance production: ${error?.message ?? "Unknown database error"}`
      );
    }
    productionId = data.id as string;
    setEditingComplianceProductionId(productionId);
  }

  const { error: deleteLinkError } = await supabase
    .from("compliance_production_performers")
    .delete()
    .eq("production_id", productionId);
  if (deleteLinkError) {
    throw new Error(`Could not update production performers: ${deleteLinkError.message}`);
  }

  const { error: insertLinkError } = await supabase
    .from("compliance_production_performers")
    .insert(
      selectedCompliancePerformerIds.map((performerId) => ({
        production_id: productionId,
        performer_id: performerId,
      }))
    );
  if (insertLinkError) {
    throw new Error(`Could not link performers to production: ${insertLinkError.message}`);
  }

  // Scene-specific documents may be linked to one production. Government IDs
  // remain performer-level identity records and are intentionally not reassigned.
  const { error: clearDocsError } = await supabase
    .from("compliance_documents")
    .update({ production_id: null })
    .eq("production_id", productionId)
    .neq("document_type", "government_id");
  if (clearDocsError) {
    throw new Error(`Could not refresh linked compliance documents: ${clearDocsError.message}`);
  }

  const sceneDocumentIds = complianceDocuments
    .filter(
      (document) =>
        selectedComplianceDocumentIds.includes(document.id) &&
        document.document_type !== "government_id"
    )
    .map((document) => document.id);

  if (sceneDocumentIds.length > 0) {
    const { error: linkDocsError } = await supabase
      .from("compliance_documents")
      .update({ production_id: productionId })
      .in("id", sceneDocumentIds);
    if (linkDocsError) {
      throw new Error(`Could not link compliance documents: ${linkDocsError.message}`);
    }
  }

  await supabase.from("compliance_audit_log").insert({
    user_id: session.user.id,
    action: editingComplianceProductionId
      ? "production_updated"
      : "production_created",
    entity_type: "compliance_production",
    entity_id: productionId,
    details: {
      video_id: videoId,
      production_code: code,
      performer_ids: selectedCompliancePerformerIds,
      document_ids: sceneDocumentIds,
    },
  });

  setProductionComplianceMessage(
    "Production compliance record linked to this video. Status: REVIEW."
  );
  await loadComplianceDocuments();
  await refreshProductionComplianceCheck(productionId);
};

const markProductionComplianceComplete = async () => {
  if (!editingComplianceProductionId) {
    setProductionComplianceError(
      "Save the video and production compliance record before approving it."
    );
    return;
  }

  setProductionComplianceApprovalBusy(true);
  setProductionComplianceError("");
  setProductionComplianceMessage("");

  try {
    const check = await refreshProductionComplianceCheck(
      editingComplianceProductionId
    );

    if (!check?.recordsReady) {
      throw new Error(
        "Compliance cannot be approved yet. One or more required records are missing."
      );
    }

    const linkedPerformerIds = new Set(
      check.performers.map((performer) => performer.performerId)
    );

    const underageAtProduction = compliancePerformers.find(
      (performer) =>
        linkedPerformerIds.has(performer.id) &&
        !isAtLeast18OnDate(performer.date_of_birth, productionDate)
    );

    if (underageAtProduction) {
      throw new Error(
        `${underageAtProduction.stage_name} was not at least 18 years old on the production date. Publishing must remain blocked.`
      );
    }

    const { error } = await supabase
      .from("compliance_productions")
      .update({
        compliance_status: "complete",
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingComplianceProductionId);

    if (error) {
      throw new Error(`Could not approve compliance: ${error.message}`);
    }

    await supabase.from("compliance_audit_log").insert({
      user_id: session.user.id,
      action: "production_compliance_approved",
      entity_type: "compliance_production",
      entity_id: editingComplianceProductionId,
      details: {
        video_id: editingVideo?.id ?? null,
        production_code: productionCode.trim(),
      },
    });

    const approvedCheck = await refreshProductionComplianceCheck(
      editingComplianceProductionId
    );

    if (!approvedCheck?.publishReady) {
      throw new Error(
        "The record was marked complete, but the server still reports that publishing is not ready. Refresh and review the checklist."
      );
    }

    setProductionComplianceMessage(
      "Compliance approved. This production is ready for publishing."
    );
  } catch (error) {
    setProductionComplianceError(
      error instanceof Error ? error.message : "Could not approve compliance."
    );
  } finally {
    setProductionComplianceApprovalBusy(false);
  }
};

const complianceDocumentLabel = (type: ComplianceDocumentType) => {
  switch (type) {
    case "government_id":
      return "Government ID";
    case "2257_record":
      return "2257 Record";
    case "performer_release":
      return "Performer Release";
    case "consent_form":
      return "Consent Form";
    default:
      return "Other Document";
  }
};

const uploadComplianceDocument = async () => {
  if (!complianceDocumentPerformerId) {
    setComplianceDocumentError("Choose the performer this document belongs to.");
    return;
  }

  if (!complianceDocumentFile) {
    setComplianceDocumentError("Choose a document file first.");
    return;
  }

  const allowedTypes = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

  if (
    complianceDocumentFile.type &&
    !allowedTypes.has(complianceDocumentFile.type)
  ) {
    setComplianceDocumentError(
      "Use a PDF, JPG, PNG, or WEBP file for compliance documents."
    );
    return;
  }

  if (complianceDocumentFile.size > 20 * 1024 * 1024) {
    setComplianceDocumentError(
      "Compliance documents must be 20 MB or smaller."
    );
    return;
  }

  setComplianceDocumentSaving(true);
  setComplianceDocumentError("");
  setComplianceDocumentMessage("");

  let uploadedPath: string | null = null;

  try {
    const safeName = complianceDocumentFile.name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-");

    const uniqueId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const filePath =
      `performers/${complianceDocumentPerformerId}/` +
      `${complianceDocumentType}/${uniqueId}-${safeName}`;

    uploadedPath = filePath;

    const { error: uploadError } = await supabase.storage
      .from("compliance-vault")
      .upload(filePath, complianceDocumentFile, {
        upsert: false,
        contentType:
          complianceDocumentFile.type || "application/octet-stream",
        cacheControl: "0",
      });

    if (uploadError) {
      throw new Error(`Secure upload failed: ${uploadError.message}`);
    }

    const { data: insertedDocument, error: insertError } = await supabase
      .from("compliance_documents")
      .insert({
        performer_id: complianceDocumentPerformerId,
        production_id: null,
        document_type: complianceDocumentType,
        storage_path: filePath,
        original_filename: complianceDocumentFile.name,
        issued_date: complianceDocumentIssuedDate || null,
        expiration_date: complianceDocumentExpirationDate || null,
        notes: complianceDocumentNotes.trim() || null,
        created_by: session.user.id,
      })
      .select("*")
      .single();

    if (insertError) {
      await supabase.storage
        .from("compliance-vault")
        .remove([filePath]);
      uploadedPath = null;
      throw new Error(`Could not save document record: ${insertError.message}`);
    }

    if (insertedDocument) {
      await supabase.from("compliance_audit_log").insert({
        user_id: session.user.id,
        action: "document_uploaded",
        entity_type: "compliance_document",
        entity_id: insertedDocument.id,
        details: {
          performer_id: complianceDocumentPerformerId,
          document_type: complianceDocumentType,
          original_filename: complianceDocumentFile.name,
        },
      });
    }

    // 10C.8 — After the primary Supabase vault record exists, request the
    // server-side Cloudflare R2 backup by document ID. The Edge Function
    // validates the database record and reads the private source object using
    // server credentials; no R2 credentials or private file bytes are exposed
    // to the browser.
    let backupSucceeded = false;
    let backupWarning = "";

    if (insertedDocument?.id) {
      try {
        const { data: backupResult, error: backupError } =
          await supabase.functions.invoke("compliance-vault-backup", {
            body: {
              documentId: insertedDocument.id,
            },
          });

        if (backupError) {
          throw backupError;
        }

        // A successful backup can be either:
        // - alreadyBackedUp: false -> this request just created the R2 copy, or
        // - alreadyBackedUp: true  -> the R2 copy already existed.
        // In both cases, ok: true is the server-side confirmation we need.
        if (!backupResult?.ok) {
          throw new Error(
            backupResult?.message ||
              "The compliance document was saved, but the R2 backup was not confirmed."
          );
        }

        backupSucceeded = true;

        await supabase.from("compliance_audit_log").insert({
          user_id: session.user.id,
          action: "document_backup_confirmed",
          entity_type: "compliance_document",
          entity_id: insertedDocument.id,
          details: {
            storage_path: filePath,
            backup_provider: "cloudflare_r2",
          },
        });
      } catch (backupError) {
        backupWarning =
          backupError instanceof Error
            ? backupError.message
            : "The Cloudflare R2 backup could not be confirmed.";

        // IMPORTANT: do not delete the primary Supabase vault object or its
        // compliance_documents record when the secondary backup fails.
        await supabase.from("compliance_audit_log").insert({
          user_id: session.user.id,
          action: "document_backup_failed",
          entity_type: "compliance_document",
          entity_id: insertedDocument.id,
          details: {
            storage_path: filePath,
            backup_provider: "cloudflare_r2",
            error: backupWarning,
          },
        });
      }
    }

    // The primary document is now committed. Clear uploadedPath so the outer
    // catch block can never remove it because of a secondary-backup problem.
    uploadedPath = null;
    setComplianceDocumentFile(null);
    setComplianceDocumentIssuedDate("");
    setComplianceDocumentExpirationDate("");
    setComplianceDocumentNotes("");

    if (backupSucceeded) {
      setComplianceDocumentMessage(
        "Secure compliance document uploaded and Cloudflare R2 backup confirmed."
      );
    } else {
      setComplianceDocumentMessage(
        `Secure compliance document uploaded. Backup needs attention${
          backupWarning ? `: ${backupWarning}` : "."
        }`
      );
    }

    await loadComplianceDocuments();
  } catch (error) {
    if (uploadedPath) {
      try {
        await supabase.storage
          .from("compliance-vault")
          .remove([uploadedPath]);
      } catch {
        // Best-effort cleanup only.
      }
    }

    setComplianceDocumentError(
      error instanceof Error
        ? error.message
        : "Could not upload compliance document."
    );
  } finally {
    setComplianceDocumentSaving(false);
  }
};

const viewComplianceDocument = async (document: ComplianceDocument) => {
  setComplianceDocumentError("");

  const { data, error } = await supabase.storage
    .from("compliance-vault")
    .createSignedUrl(document.storage_path, 60);

  if (error || !data?.signedUrl) {
    setComplianceDocumentError(
      error?.message ?? "Could not open the secure document."
    );
    return;
  }

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
};

const restoreComplianceDocumentFromBackup = async (
  document: ComplianceDocument
) => {
  if (complianceRestoreBusyDocumentId) return;

  const displayName =
    document.original_filename ??
    complianceDocumentLabel(document.document_type);

  const confirmed = window.confirm(
    `Check the Cloudflare R2 backup for "${displayName}"?\n\n` +
      "If the primary compliance-vault file already exists, nothing will be changed. " +
      "If it is missing, the backup will be restored and SHA-256 verified."
  );

  if (!confirmed) return;

  setComplianceRestoreBusyDocumentId(document.id);
  setComplianceDocumentError("");
  setComplianceDocumentMessage("");

  try {
    const { data, error } = await supabase.functions.invoke(
      "compliance-vault-restore",
      {
        body: {
          documentId: document.id,
        },
      }
    );

    if (error) {
      throw error;
    }

    if (!data?.ok) {
      throw new Error(
        data?.message ?? "Could not restore the compliance document."
      );
    }

    if (data.alreadyPresent) {
      setComplianceDocumentMessage(
        "Primary compliance document is already present. No restore was needed."
      );
      return;
    }

    if (data.restored && data.integrityVerified) {
      setComplianceDocumentMessage(
        "Compliance document restored from Cloudflare R2 and SHA-256 verification passed."
      );
      return;
    }

    if (data.restored) {
      setComplianceDocumentMessage(
        "Compliance document was restored from Cloudflare R2."
      );
      return;
    }

    setComplianceDocumentMessage(
      data.message ?? "Backup restore check completed."
    );
  } catch (error) {
    console.error("Could not restore compliance document from backup:", error);

    setComplianceDocumentError(
      error instanceof Error
        ? error.message
        : "Could not restore the compliance document from backup."
    );
  } finally {
    setComplianceRestoreBusyDocumentId(null);
  }
};

const archiveComplianceDocument = async (document: ComplianceDocument) => {
  const reason = window.prompt(
    `Archive ${document.original_filename ?? complianceDocumentLabel(document.document_type)}?

Enter the reason for archiving this compliance record:`
  );

  if (reason === null) return;

  const trimmedReason = reason.trim();

  if (!trimmedReason) {
    setComplianceDocumentError("An archive reason is required.");
    return;
  }

  setComplianceDocumentError("");
  setComplianceDocumentMessage("");

  const { error } = await supabase.rpc(
    "archive_compliance_document",
    {
      p_document_id: document.id,
      p_reason: trimmedReason,
    }
  );

  if (error) {
    setComplianceDocumentError(
      `Could not archive the compliance record: ${error.message}`
    );
    return;
  }

  setSelectedComplianceDocumentIds((current) =>
    current.filter((id) => id !== document.id)
  );

  setComplianceDocumentMessage(
    "Compliance record archived. The secure file was retained in the compliance vault."
  );

  await loadComplianceDocuments();

  if (editingComplianceProductionId) {
    await refreshProductionComplianceCheck(editingComplianceProductionId);
  }
};

const updateCompliancePerformerForm = <
  K extends keyof CompliancePerformerFormState
>(
  key: K,
  value: CompliancePerformerFormState[K]
) => {
  setCompliancePerformerForm((current) => ({
    ...current,
    [key]: value,
  }));
};

const createCompliancePerformer = async () => {
  const stageName = compliancePerformerForm.stageName.trim();
  const legalName = compliancePerformerForm.legalName.trim();
  const dateOfBirth = compliancePerformerForm.dateOfBirth;

  if (!stageName || !legalName || !dateOfBirth) {
    setCompliancePerformerError(
      "Stage name, legal name, and date of birth are required."
    );
    return;
  }

  const dobDate = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dobDate.getTime())) {
    setCompliancePerformerError("Enter a valid date of birth.");
    return;
  }

  const ageCutoff = new Date();
  ageCutoff.setFullYear(ageCutoff.getFullYear() - 18);
  if (dobDate > ageCutoff) {
    setCompliancePerformerError(
      "This performer is not at least 18 years old."
    );
    return;
  }

  const last4 = compliancePerformerForm.idNumberLast4.trim();
  if (last4 && !/^.{4}$/.test(last4)) {
    setCompliancePerformerError(
      "ID last 4 must contain exactly four characters."
    );
    return;
  }

  setCompliancePerformerSaving(true);
  setCompliancePerformerError("");
  setCompliancePerformerMessage("");

  const aliases = compliancePerformerForm.aliases
    .split(",")
    .map((alias) => alias.trim())
    .filter(Boolean);

  const { data, error } = await supabase
    .from("compliance_performers")
    .insert({
      stage_name: stageName,
      legal_name: legalName,
      date_of_birth: dateOfBirth,
      aliases,
      id_type: compliancePerformerForm.idType.trim() || null,
      id_number_last4: last4 || null,
      id_expiration: compliancePerformerForm.idExpiration || null,
      notes: compliancePerformerForm.notes.trim() || null,
      created_by: session.user.id,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    setCompliancePerformerError(error.message);
    setCompliancePerformerSaving(false);
    return;
  }

  if (data) {
    await supabase.from("compliance_audit_log").insert({
      user_id: session.user.id,
      action: "performer_created",
      entity_type: "compliance_performer",
      entity_id: data.id,
      details: {
        stage_name: data.stage_name,
      },
    });
  }

  setCompliancePerformerForm(EMPTY_COMPLIANCE_PERFORMER_FORM);
  setCompliancePerformerMessage(
    "Compliance performer record created. Secure document uploads are the next step."
  );
  await loadCompliancePerformers();
  setCompliancePerformerSaving(false);
};

const uploadHomepagePerformer = async () => {
  if (!performerName.trim()) { setPerformerError("Enter the performer's name."); return; }
  if (!performerFile) { setPerformerError("Choose a performer photo first."); return; }
  if (activeHomepagePerformerCount >= MAX_HOMEPAGE_PERFORMERS) {
    setPerformerError(`You already have ${MAX_HOMEPAGE_PERFORMERS} active featured performers.`); return;
  }
  setPerformerSaving(true); setPerformerError(""); setPerformerMessage("");
  let uploadedFilePath: string | null = null;
  try {
    const { data: rows, error: rowsError } = await supabase.from("homepage_performers").select("sort_order").order("sort_order", { ascending: true });
    if (rowsError) throw new Error(rowsError.message);
    const nextSortOrder = (rows ?? []).reduce((m,row)=>Math.max(m,Number(row.sort_order)||0),0)+1;
    const extension = performerFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const uniqueId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const filePath = `performers/performer-${uniqueId}.${extension}`; uploadedFilePath = filePath;
    const uploadResult = await supabase.storage.from("homepage-media").upload(filePath, performerFile, { upsert:false, contentType: performerFile.type || "image/jpeg", cacheControl:"3600" });
    if (uploadResult.error) throw new Error(uploadResult.error.message);
    const { data: publicUrlData } = supabase.storage.from("homepage-media").getPublicUrl(filePath);
    const insertResult = await supabase.from("homepage_performers").insert({
      name: performerName.trim(), subtitle: performerSubtitle.trim() || "FEATURED PERFORMER", image_url: publicUrlData.publicUrl,
      sort_order: nextSortOrder, is_published: true, created_by: session.user.id
    });
    if (insertResult.error) { await supabase.storage.from("homepage-media").remove([filePath]); uploadedFilePath=null; throw new Error(insertResult.error.message); }
    uploadedFilePath=null; setPerformerFile(null); setPerformerName(""); setPerformerSubtitle("FEATURED PERFORMER"); setPerformerMessage("Featured performer added.");
    await loadHomepagePerformers();
  } catch (error) {
    if (uploadedFilePath) { try { await supabase.storage.from("homepage-media").remove([uploadedFilePath]); } catch {} }
    setPerformerError(error instanceof Error ? error.message : "Could not upload featured performer.");
  } finally { setPerformerSaving(false); }
};

const toggleHomepagePerformer = async (performer: HomepagePerformer) => {
  const nextPublishedState = !performer.is_published;
  if (nextPublishedState && activeHomepagePerformerCount >= MAX_HOMEPAGE_PERFORMERS) { setPerformerError(`You already have ${MAX_HOMEPAGE_PERFORMERS} active featured performers.`); return; }
  const { error } = await supabase.from("homepage_performers").update({ is_published: nextPublishedState, updated_at: new Date().toISOString() }).eq("id", performer.id);
  if (error) { setPerformerError(error.message); return; }
  setPerformerError(""); setPerformerMessage(nextPublishedState ? "Featured performer published." : "Featured performer hidden."); await loadHomepagePerformers();
};

const deleteHomepagePerformer = async (performer: HomepagePerformer) => {
  if (!window.confirm(`Delete ${performer.name} from Featured Performers?`)) return;
  const { error } = await supabase.from("homepage_performers").delete().eq("id", performer.id);
  if (error) { setPerformerError(error.message); return; }
  const marker = "/storage/v1/object/public/homepage-media/"; const markerIndex = performer.image_url.indexOf(marker);
  if (markerIndex >= 0) { const path = decodeURIComponent(performer.image_url.slice(markerIndex + marker.length)); await supabase.storage.from("homepage-media").remove([path]); }
  setPerformerError(""); setPerformerMessage("Featured performer removed."); await loadHomepagePerformers();
};

const uploadHomepageBanner = async () => {
  if (!bannerFile) {
    setBannerError("Choose a banner image first.");
    return;
  }

  setBannerSaving(true);
  setBannerError("");
  setBannerMessage("");

  let uploadedFilePath: string | null = null;

  try {
    // Count only banners that are actually published in the public slideshow.
    // Old/unpublished banner rows no longer consume one of the six active slots.
    const { data: activeRows, error: activeRowsError } = await supabase
      .from("homepage_banners")
      .select("id, sort_order, is_published")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });

    if (activeRowsError) {
      throw new Error(
        `Could not check active banners: ${
          activeRowsError.message ?? String(activeRowsError)
        }`
      );
    }

    const activeBanners = activeRows ?? [];

    if (activeBanners.length >= MAX_HOMEPAGE_BANNERS) {
      setBannerError(
        `The slideshow already has ${MAX_HOMEPAGE_BANNERS} active banners. Unpublish or delete one before adding another.`
      );
      return;
    }

    // Read all sort orders so the next banner always receives a unique position,
    // even if there are older unpublished rows in the table.
    const { data: allRows, error: allRowsError } = await supabase
      .from("homepage_banners")
      .select("sort_order")
      .order("sort_order", { ascending: true });

    if (allRowsError) {
      throw new Error(
        `Could not determine banner order: ${
          allRowsError.message ?? String(allRowsError)
        }`
      );
    }

    const nextSortOrder =
      (allRows ?? []).reduce(
        (highest, banner) =>
          Math.max(highest, Number(banner.sort_order ?? -1)),
        -1
      ) + 1;

    const extension =
      bannerFile.name.split(".").pop()?.toLowerCase() || "jpg";

    const uniqueId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const filePath = `banners/banner-${uniqueId}.${extension}`;
    uploadedFilePath = filePath;

    const { error: uploadError } = await supabase.storage
      .from("homepage-media")
      .upload(filePath, bannerFile, {
        upsert: false,
        contentType: bannerFile.type || "image/jpeg",
      });

    if (uploadError) {
      throw new Error(
        `Storage upload failed: ${
          uploadError.message ?? String(uploadError)
        }`
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("homepage-media")
      .getPublicUrl(filePath);

    const { data: insertedBanner, error: insertError } = await supabase
      .from("homepage_banners")
      .insert({
        image_url: publicUrlData.publicUrl,
        eyebrow: bannerEyebrow.trim() || "SPIKEYDEE VIP",
        title: bannerTitle.trim() || null,
        subtitle: bannerSubtitle.trim() || null,
        button_text: "JOIN VIP",
        button_link: "membership",
        sort_order: nextSortOrder,
        is_published: true,
        created_by: session.user.id,
      })
      .select("*")
      .single();

    if (insertError) {
      await supabase.storage
        .from("homepage-media")
        .remove([filePath]);

      uploadedFilePath = null;

      throw new Error(
        `Banner database insert failed: ${
          insertError.message ?? String(insertError)
        }`
      );
    }

    if (insertedBanner) {
      setHomepageBanners((current) =>
        [
          ...current.filter((banner) => banner.id !== insertedBanner.id),
          insertedBanner as HomepageBanner,
        ].sort((a, b) => a.sort_order - b.sort_order)
      );
    }

    setBannerFile(null);
    setBannerEyebrow("SPIKEYDEE VIP");
    setBannerTitle("");
    setBannerSubtitle("");
    setBannerMessage(
      `Banner added. ${activeBanners.length + 1} / ${MAX_HOMEPAGE_BANNERS} active slideshow banners.`
    );

    await loadHomepageBanners();
  } catch (error) {
    if (uploadedFilePath) {
      await supabase.storage
        .from("homepage-media")
        .remove([uploadedFilePath]);
    }

    setBannerError(
      error instanceof Error ? error.message : "Could not upload banner."
    );
  } finally {
    setBannerSaving(false);
  }
};

const deleteHomepageBanner = async (banner: HomepageBanner) => {
  if (!window.confirm("Delete this homepage banner?")) return;

  const { error } = await supabase
    .from("homepage_banners")
    .delete()
    .eq("id", banner.id);

  if (error) {
    setBannerError(error.message);
    return;
  }

  const marker = "/storage/v1/object/public/homepage-media/";
  const markerIndex = banner.image_url.indexOf(marker);

  if (markerIndex >= 0) {
    const path = decodeURIComponent(
      banner.image_url.slice(markerIndex + marker.length)
    );

    await supabase.storage
      .from("homepage-media")
      .remove([path]);
  }

  setBannerMessage("Banner removed.");
  await loadHomepageBanners();
};

const toggleHomepageBanner = async (banner: HomepageBanner) => {
  const { error } = await supabase
    .from("homepage_banners")
    .update({
      is_published: !banner.is_published,
      updated_at: new Date().toISOString(),
    })
    .eq("id", banner.id);

  if (error) {
    setBannerError(error.message);
    return;
  }

  await loadHomepageBanners();
};


const uploadHomepageBrand = async () => {
  if (!brandFile) {
    setBrandError("Choose a brand logo first.");
    return;
  }

  setBrandSaving(true);
  setBrandError("");
  setBrandMessage("");

  let uploadedFilePath: string | null = null;

  const withTimeout = async <T,>(
    promise: PromiseLike<T>,
    label: string,
    timeoutMs = 60000
  ): Promise<T> => {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        window.setTimeout(() => {
          reject(
            new Error(
              `${label} timed out. Check your connection and try again.`
            )
          );
        }, timeoutMs);
      }),
    ]);
  };

  try {
    const activeResult = await withTimeout(
      supabase
        .from("homepage_brands")
        .select("id, sort_order, is_published")
        .eq("is_published", true)
        .order("sort_order", { ascending: true }),
      "Checking brand logos"
    );

    if (activeResult.error) {
      throw new Error(
        `Could not check active brand logos: ${
          activeResult.error.message ?? String(activeResult.error)
        }`
      );
    }

    const activeBrands = activeResult.data ?? [];

    if (activeBrands.length >= MAX_HOMEPAGE_BRANDS) {
      setBrandError(
        `The homepage brand carousel already has ${MAX_HOMEPAGE_BRANDS} active logos. Unpublish or delete one before adding another.`
      );
      return;
    }

    const allRowsResult = await withTimeout(
      supabase
        .from("homepage_brands")
        .select("sort_order")
        .order("sort_order", { ascending: true }),
      "Checking brand logo order"
    );

    if (allRowsResult.error) {
      throw new Error(
        `Could not determine brand logo order: ${
          allRowsResult.error.message ?? String(allRowsResult.error)
        }`
      );
    }

    const nextSortOrder =
      (allRowsResult.data ?? []).reduce(
        (highest, brand) =>
          Math.max(highest, Number(brand.sort_order ?? -1)),
        -1
      ) + 1;

    const extension =
      brandFile.name.split(".").pop()?.toLowerCase() || "png";

    const uniqueId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const filePath = `brands/brand-${uniqueId}.${extension}`;
    uploadedFilePath = filePath;

    const uploadResult = await withTimeout(
      supabase.storage
        .from("homepage-media")
        .upload(filePath, brandFile, {
          upsert: false,
          contentType: brandFile.type || "image/png",
          cacheControl: "3600",
        }),
      "Brand logo upload",
      90000
    );

    if (uploadResult.error) {
      throw new Error(
        `Storage upload failed: ${
          uploadResult.error.message ?? String(uploadResult.error)
        }`
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("homepage-media")
      .getPublicUrl(filePath);

    const insertResult = await withTimeout(
      supabase
        .from("homepage_brands")
        .insert({
          logo_url: publicUrlData.publicUrl,
          name: brandName.trim() || null,
          sort_order: nextSortOrder,
          is_published: true,
          created_by: session.user.id,
        }),
      "Saving brand logo"
    );

    if (insertResult.error) {
      await supabase.storage
        .from("homepage-media")
        .remove([filePath]);

      uploadedFilePath = null;

      throw new Error(
        `Brand logo database insert failed: ${
          insertResult.error.message ?? String(insertResult.error)
        }`
      );
    }

    uploadedFilePath = null;
    setBrandFile(null);
    setBrandName("");
    setBrandMessage(
      `Brand logo added. ${activeBrands.length + 1} / ${MAX_HOMEPAGE_BRANDS} active logos.`
    );

    await loadHomepageBrands();
  } catch (error) {
    if (uploadedFilePath) {
      try {
        await supabase.storage
          .from("homepage-media")
          .remove([uploadedFilePath]);
      } catch {
        // Keep the original error visible.
      }
    }

    setBrandError(
      error instanceof Error ? error.message : "Could not upload brand logo."
    );
  } finally {
    setBrandSaving(false);
  }
};

const deleteHomepageBrand = async (brand: HomepageBrand) => {
  if (!window.confirm("Delete this brand logo?")) return;

  const { error } = await supabase
    .from("homepage_brands")
    .delete()
    .eq("id", brand.id);

  if (error) {
    setBrandError(error.message);
    return;
  }

  const marker = "/storage/v1/object/public/homepage-media/";
  const markerIndex = brand.logo_url.indexOf(marker);

  if (markerIndex >= 0) {
    const path = decodeURIComponent(
      brand.logo_url.slice(markerIndex + marker.length)
    );

    await supabase.storage
      .from("homepage-media")
      .remove([path]);
  }

  setBrandMessage("Brand logo removed.");
  await loadHomepageBrands();
};

const toggleHomepageBrand = async (brand: HomepageBrand) => {
  const nextPublishedState = !brand.is_published;

  if (
    nextPublishedState &&
    activeHomepageBrandCount >= MAX_HOMEPAGE_BRANDS
  ) {
    setBrandError(
      `You already have ${MAX_HOMEPAGE_BRANDS} active brand logos. Hide or delete one before publishing another.`
    );
    return;
  }

  const { error } = await supabase
    .from("homepage_brands")
    .update({
      is_published: nextPublishedState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", brand.id);

  if (error) {
    setBrandError(error.message);
    return;
  }

  setBrandError("");
  await loadHomepageBrands();
};

const uploadHomepageTile = async () => {
  if (!tileFile) {
    setTileError("Choose a tile image first.");
    return;
  }

  setTileSaving(true);
  setTileError("");
  setTileMessage("");

  let uploadedFilePath: string | null = null;

  // Prevent the Studio button from remaining on "Uploading..." forever
  // if Storage or the database does not answer.
  const withTimeout = async <T,>(
    promise: PromiseLike<T>,
    label: string,
    timeoutMs = 60000
  ): Promise<T> => {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        window.setTimeout(() => {
          reject(
            new Error(
              `${label} timed out. Check your connection and try the upload again.`
            )
          );
        }, timeoutMs);
      }),
    ]);
  };

  try {
    const activeResult = await withTimeout(
      supabase
        .from("homepage_tiles")
        .select("id, sort_order, is_published")
        .eq("is_published", true)
        .order("sort_order", { ascending: true }),
      "Checking homepage photos"
    );

    const activeRows = activeResult.data;
    const activeRowsError = activeResult.error;

    if (activeRowsError) {
      throw new Error(
        `Could not check active homepage photos: ${
          activeRowsError.message ?? String(activeRowsError)
        }`
      );
    }

    const activeTiles = activeRows ?? [];

    if (activeTiles.length >= MAX_HOMEPAGE_TILES) {
      setTileError(
        `The homepage photo grid already has ${MAX_HOMEPAGE_TILES} active photos. Unpublish or delete one before adding another.`
      );
      return;
    }

    const allRowsResult = await withTimeout(
      supabase
        .from("homepage_tiles")
        .select("sort_order")
        .order("sort_order", { ascending: true }),
      "Checking homepage photo order"
    );

    const allRows = allRowsResult.data;
    const allRowsError = allRowsResult.error;

    if (allRowsError) {
      throw new Error(
        `Could not determine homepage photo order: ${
          allRowsError.message ?? String(allRowsError)
        }`
      );
    }

    const nextSortOrder =
      (allRows ?? []).reduce(
        (highest, tile) =>
          Math.max(highest, Number(tile.sort_order ?? -1)),
        -1
      ) + 1;

    const extension =
      tileFile.name.split(".").pop()?.toLowerCase() || "jpg";

    const uniqueId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const filePath = `tiles/tile-${uniqueId}.${extension}`;
    uploadedFilePath = filePath;

    const uploadResult = await withTimeout(
      supabase.storage
        .from("homepage-media")
        .upload(filePath, tileFile, {
          upsert: false,
          contentType: tileFile.type || "image/jpeg",
          cacheControl: "3600",
        }),
      "Photo upload",
      90000
    );

    if (uploadResult.error) {
      throw new Error(
        `Storage upload failed: ${
          uploadResult.error.message ?? String(uploadResult.error)
        }`
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("homepage-media")
      .getPublicUrl(filePath);

    // Do not request the inserted row back with .select().single().
    // The extra SELECT can be blocked by RLS and make the Studio UI appear
    // stuck even after the image itself successfully uploaded.
    const insertResult = await withTimeout(
      supabase
        .from("homepage_tiles")
        .insert({
          image_url: publicUrlData.publicUrl,
          title: tileTitle.trim() || null,
          subtitle: tileSubtitle.trim() || null,
          button_text: "JOIN VIP",
          button_link: "membership",
          sort_order: nextSortOrder,
          is_published: true,
          created_by: session.user.id,
        }),
      "Saving homepage photo"
    );

    if (insertResult.error) {
      await supabase.storage
        .from("homepage-media")
        .remove([filePath]);

      uploadedFilePath = null;

      throw new Error(
        `Homepage photo database insert failed: ${
          insertResult.error.message ?? String(insertResult.error)
        }`
      );
    }

    // The database row is now saved, so do not delete the Storage file
    // if refreshing the Studio list has a separate problem.
    uploadedFilePath = null;

    setTileFile(null);
    setTileTitle("");
    setTileSubtitle("");
    setTileMessage(
      `Homepage photo added. ${activeTiles.length + 1} / ${MAX_HOMEPAGE_TILES} active grid photos.`
    );

    await loadHomepageTiles();
  } catch (error) {
    if (uploadedFilePath) {
      try {
        await supabase.storage
          .from("homepage-media")
          .remove([uploadedFilePath]);
      } catch {
        // Ignore cleanup errors so the real upload error is shown.
      }
    }

    setTileError(
      error instanceof Error ? error.message : "Could not upload homepage photo."
    );
  } finally {
    setTileSaving(false);
  }
};

const deleteHomepageTile = async (tile: HomepageTile) => {
  if (!window.confirm("Delete this homepage tile?")) return;

  const { error } = await supabase
    .from("homepage_tiles")
    .delete()
    .eq("id", tile.id);

  if (error) {
    setTileError(error.message);
    return;
  }

  const marker = "/storage/v1/object/public/homepage-media/";
  const markerIndex = tile.image_url.indexOf(marker);

  if (markerIndex >= 0) {
    const path = decodeURIComponent(
      tile.image_url.slice(markerIndex + marker.length)
    );

    await supabase.storage
      .from("homepage-media")
      .remove([path]);
  }

  setTileMessage("Homepage tile removed.");
  await loadHomepageTiles();
};

const toggleHomepageTile = async (tile: HomepageTile) => {
  const { error } = await supabase
    .from("homepage_tiles")
    .update({
      is_published: !tile.is_published,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tile.id);

  if (error) {
    setTileError(error.message);
    return;
  }

  await loadHomepageTiles();
};

const updateHeroSetting = <
  K extends keyof HomepageHeroSettings
>(
  key: K,
  value: HomepageHeroSettings[K]
) => {
  setHeroSettings((current) => ({
    ...current,
    [key]: value,
  }));
};

const saveHeroSettings = async () => {
  setHeroSaving(true);
  setHeroMessage("");
  setHeroError("");

  const { error } = await supabase
    .from("site_settings")
    .upsert(
      {
        setting_key: "homepage_hero",
        featured_video_id: heroSettings.featured_video_id,
        hero_title: heroSettings.hero_title,
        hero_subtitle: heroSettings.hero_subtitle,
        hero_description: heroSettings.hero_description,
        teaser_start_seconds:
          heroSettings.teaser_start_seconds ?? 0,
        teaser_end_seconds:
          heroSettings.teaser_end_seconds,
        autoplay: heroSettings.autoplay,
        loop_teaser: heroSettings.loop_teaser,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "setting_key",
      }
    );

  if (error) {
    console.error("Could not save homepage hero settings:", error);
    setHeroError("Could not save homepage hero settings.");
  } else {
    setHeroMessage("Homepage hero settings saved.");
  }

  setHeroSaving(false);
};
  const updateForm = <K extends keyof VideoFormState>(
    key: K,
    value: VideoFormState[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setEditingVideo(null);
    setForm(EMPTY_VIDEO_FORM);
    setVideoFile(null);
    setThumbnailFile(null);
    setMessage("");
    setErrorMessage("");
    setUploadStatus("");
    setUploadProgress(0);
    resetProductionComplianceForm();
  };

  const startEdit = (video: VideoRecord) => {
    setEditingVideo(video);
    setForm({
      title: video.title,
      slug: video.slug,
      subtitle: video.subtitle ?? "",
      description: video.description ?? "",
      durationMinutes: video.duration_seconds
        ? String(Math.round(video.duration_seconds / 60))
        : "",
      category: video.category ?? "",
      performer: video.performer ?? "",
      seriesName: video.series ?? video.series_name ?? "",
      badge: video.badge ?? "",
      accessTier: video.access_tier ?? "monthly_only",
      isPublished: Boolean(video.is_published),
      isFeatured: Boolean(video.is_featured),
    });
    setVideoFile(null);
    setThumbnailFile(null);
    setMessage("");
    setErrorMessage("");
    setUploadStatus("");
    setUploadProgress(0);
    void loadProductionComplianceForVideo(video.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const safeFileName = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");

  const describeSupabaseError = (error: unknown, fallback: string) => {
    if (!error) return fallback;
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "object") {
      const value = error as {
        message?: unknown;
        error?: unknown;
        statusCode?: unknown;
        status?: unknown;
      };
      const message =
        typeof value.message === "string"
          ? value.message
          : typeof value.error === "string"
            ? value.error
            : fallback;
      const status = value.statusCode ?? value.status;
      return status ? `${message} (status ${String(status)})` : message;
    }
    return String(error) || fallback;
  };

  const requestBunnyUploadCredentials = async (
    title: string
  ): Promise<BunnyUploadCredentials> => {
    setUploadStatus("1 of 4 — Creating Bunny Stream video…");

    const { data, error } = await supabase.functions.invoke(
      "bunny-stream-upload",
      { body: { title, action: "create" } }
    );

    if (error) {
      console.error("Bunny Edge Function error:", error);
      throw new Error(
        `Could not create Bunny upload: ${describeSupabaseError(
          error,
          "Unknown Edge Function error"
        )}`
      );
    }

    const credentials = data as Partial<BunnyUploadCredentials> | null;

    if (
      !credentials?.videoId ||
      !credentials?.libraryId ||
      !credentials?.expirationTime ||
      !credentials?.signature
    ) {
      throw new Error(
        "The bunny-stream-upload Edge Function did not return TUS upload credentials. " +
          "Update that function so it returns videoId, libraryId, expirationTime, and signature."
      );
    }

    return credentials as BunnyUploadCredentials;
  };

  const uploadToBunny = async (
    file: File,
    title: string,
    credentials: BunnyUploadCredentials
  ) => {
    setUploadStatus("2 of 4 — Uploading video to Bunny Stream…");
    setUploadProgress(0);

    await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: "https://video.bunnycdn.com/tusupload",
        retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
        chunkSize: 16 * 1024 * 1024,
        removeFingerprintOnSuccess: true,
        headers: {
          AuthorizationSignature: credentials.signature,
          AuthorizationExpire: String(credentials.expirationTime),
          VideoId: credentials.videoId,
          LibraryId: credentials.libraryId,
        },
        metadata: {
          filetype: file.type || "video/mp4",
          title,
          filename: file.name,
        },
        onError: (error) => {
          console.error("Bunny TUS upload error:", error);
          reject(new Error(`Bunny upload failed: ${error.message}`));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percent =
            bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0;
          setUploadProgress(percent);
          setUploadStatus(`2 of 4 — Uploading video to Bunny Stream… ${percent}%`);
        },
        onSuccess: () => {
          setUploadProgress(100);
          resolve();
        },
      });

      // Always start this Bunny video as a fresh TUS upload.
      // Reusing a previous browser fingerprint can point at an interrupted
      // Bunny upload URL that is still locked (HTTP 423), especially after
      // switching tabs or retrying an upload.
      //
      // The Edge Function has already created a fresh Bunny videoId and
      // fresh signed upload credentials for this submission, so resuming an
      // older upload URL here is both unnecessary and unsafe.
      upload.start();
    });
  };

  const uploadThumbnailAsset = async (slug: string) => {
    if (!thumbnailFile) return editingVideo?.thumbnail_url ?? null;

    setUploadStatus("3 of 4 — Uploading poster / thumbnail…");
    const path = `${session.user.id}/${Date.now()}-${slug}-${safeFileName(
      thumbnailFile.name
    )}`;

    const { error } = await supabase.storage
      .from("video-thumbnails")
      .upload(path, thumbnailFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: thumbnailFile.type || "image/jpeg",
      });

    if (error) {
      console.error("Thumbnail upload error:", error);
      throw new Error(
        `Thumbnail upload failed: ${describeSupabaseError(
          error,
          "Unknown Storage error"
        )}`
      );
    }

    const { data } = supabase.storage.from("video-thumbnails").getPublicUrl(path);
    return data.publicUrl;
  };

  const removeThumbnailByUrl = async (url: string | null | undefined) => {
    if (!url) return;
    const marker = "/storage/v1/object/public/video-thumbnails/";
    const idx = url.indexOf(marker);
    if (idx < 0) return;
    const path = decodeURIComponent(url.slice(idx + marker.length));
    if (path) await supabase.storage.from("video-thumbnails").remove([path]);
  };

  const selectedPerformersAgeReady =
    Boolean(productionDate) &&
    selectedCompliancePerformerIds.length > 0 &&
    selectedCompliancePerformerIds.every((performerId) => {
      const performer = compliancePerformers.find((item) => item.id === performerId);
      return performer
        ? isAtLeast18OnDate(performer.date_of_birth, productionDate)
        : false;
    });

  const compliancePublishReady = Boolean(
    editingComplianceProductionId &&
      productionComplianceCheck?.publishReady &&
      selectedPerformersAgeReady
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setErrorMessage("");
    setUploadStatus("");
    setUploadProgress(0);

    const title = form.title.trim();
    const slug = makeSlug(form.slug.trim() || title);
    const minutes = Number(form.durationMinutes);

    const hasAnyComplianceInput =
      Boolean(productionCode.trim()) ||
      Boolean(productionDate) ||
      selectedCompliancePerformerIds.length > 0 ||
      selectedComplianceDocumentIds.length > 0;

    if (hasAnyComplianceInput) {
      if (!productionCode.trim() || !productionDate) {
        setErrorMessage(
          "Production ID and production date are required when adding compliance information."
        );
        setSaving(false);
        return;
      }
      if (selectedCompliancePerformerIds.length === 0) {
        setErrorMessage("Choose at least one performer in Production & Compliance.");
        setSaving(false);
        return;
      }
    }

    const isTryingToPublishNow =
      form.isPublished && !Boolean(editingVideo?.is_published);

    if (isTryingToPublishNow && !compliancePublishReady) {
      setErrorMessage(
        "Publishing is locked until the server compliance checklist is complete and an admin marks the production COMPLETE. Save as a draft first."
      );
      setSaving(false);
      return;
    }

    let savedVideoId = editingVideo?.id ?? null;
    let bunnyVideoId = editingVideo?.bunny_video_id ?? null;
    let bunnyLibraryId = editingVideo?.bunny_library_id ?? null;
    let bunnyStatus = editingVideo?.bunny_status ?? null;
    let newThumbnailUrl: string | null = editingVideo?.thumbnail_url ?? null;

    try {
      if (!editingVideo && !videoFile) {
        throw new Error("Choose a video file before creating this catalog entry.");
      }

      if (videoFile) {
        const credentials = await requestBunnyUploadCredentials(title);
        await uploadToBunny(videoFile, title, credentials);
        bunnyVideoId = credentials.videoId;
        bunnyLibraryId = credentials.libraryId;
        bunnyStatus = "uploaded";
      }

      newThumbnailUrl = await uploadThumbnailAsset(slug);

      const payload = {
        slug,
        title,
        subtitle: form.subtitle.trim() || null,
        description: form.description.trim() || null,
        duration_seconds:
          Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null,
        category: form.category.trim() || null,
        performer: form.performer.trim() || null,
        series: form.seriesName.trim() || null,
        series_name: form.seriesName.trim() || null,
        badge: form.badge.trim() || null,
        thumbnail_url: newThumbnailUrl,
        video_path: null,
        bunny_video_id: bunnyVideoId,
        bunny_library_id: bunnyLibraryId,
        bunny_status: bunnyStatus,
        bunny_thumbnail_url:
          (bunnyVideoId ? bunnyThumbnailUrl(bunnyVideoId) : undefined) ??
          editingVideo?.bunny_thumbnail_url ??
          null,
        access_tier: form.accessTier,
        is_featured: form.isFeatured,
        price_cents: null,
        currency: "USD",
      };

      setUploadStatus("4 of 4 — Saving catalog record…");

      if (editingVideo) {
        const { error } = await supabase
          .from("videos")
          .update({
            ...payload,
            ...(form.isPublished !== editingVideo.is_published
              ? { is_published: form.isPublished }
              : {}),
          })
          .eq("id", editingVideo.id);

        if (error) {
          console.error("Video catalog update error:", error);
          throw new Error(
            `Catalog update failed: ${describeSupabaseError(
              error,
              "Unknown database error"
            )}`
          );
        }

        if (
          thumbnailFile &&
          editingVideo.thumbnail_url &&
          editingVideo.thumbnail_url !== newThumbnailUrl
        ) {
          await removeThumbnailByUrl(editingVideo.thumbnail_url);
        }

        setMessage("Video updated successfully.");
      } else {
        const { data: insertedVideo, error } = await supabase
          .from("videos")
          .insert({
            ...payload,
            // New uploads always start as drafts. Compliance is linked and
            // reviewed before the separate Publish action can succeed.
            is_published: false,
            created_by: session.user.id,
          })
          .select("id")
          .single();

        if (error || !insertedVideo?.id) {
          console.error("Video catalog insert error:", error);
          if (thumbnailFile && newThumbnailUrl) {
            await removeThumbnailByUrl(newThumbnailUrl);
          }
          throw new Error(
            `Catalog save failed: ${describeSupabaseError(
              error,
              "Unknown database error"
            )}`
          );
        }

        savedVideoId = insertedVideo.id as string;

        setMessage(
          "Video uploaded to Bunny Stream and saved as a draft. Complete the compliance review, then publish it."
        );
      }

      if (savedVideoId && hasAnyComplianceInput) {
        setUploadStatus("Saving production compliance links…");
        await saveProductionCompliance(savedVideoId, title, slug);
      }

      setEditingVideo(null);
      setForm(EMPTY_VIDEO_FORM);
      setVideoFile(null);
      setThumbnailFile(null);
      setUploadStatus("");
      setUploadProgress(0);
      setProductionCode("");
      setProductionDate("");
      setEditingComplianceProductionId(null);
      setSelectedCompliancePerformerIds([]);
      setSelectedComplianceDocumentIds([]);
      await loadVideos();
      await onCatalogChanged();
    } catch (error) {
      const text = describeSupabaseError(error, "Upload failed.");
      console.error("Studio Bunny upload workflow failed:", error);
      setErrorMessage(text);
      setUploadStatus("");
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (video: VideoRecord) => {
    setErrorMessage("");

    // Unpublishing is always allowed. The compliance lock only protects the
    // transition from draft -> published.
    if (video.is_published) {
      const { error } = await supabase
        .from("videos")
        .update({ is_published: false })
        .eq("id", video.id);

      if (error) return setErrorMessage(error.message);
      await loadVideos();
      await onCatalogChanged();
      return;
    }

    const { data: production, error: productionError } = await supabase
      .from("compliance_productions")
      .select("id, production_date, compliance_status")
      .eq("video_id", video.id)
      .maybeSingle();

    if (productionError) {
      setErrorMessage(productionError.message);
      return;
    }

    if (!production?.id) {
      setErrorMessage(
        "Publishing blocked: this video does not have a linked production compliance record. Edit the video and complete Production & Compliance first."
      );
      return;
    }

    const { data: checkData, error: checkError } = await supabase.rpc(
      "get_production_compliance_check",
      { p_production_id: production.id }
    );

    if (checkError) {
      setErrorMessage(
        `Publishing blocked: could not verify compliance (${checkError.message}).`
      );
      return;
    }

    const check = checkData as ProductionComplianceCheck;

    if (!check.publishReady) {
      setErrorMessage(
        "Publishing blocked: required records are missing or this production has not been marked COMPLETE."
      );
      return;
    }

    const performerIds = check.performers.map((performer) => performer.performerId);

    const { data: performerRows, error: performerError } = await supabase
      .from("compliance_performers")
      .select("id, stage_name, date_of_birth")
      .in("id", performerIds);

    if (performerError) {
      setErrorMessage(
        `Publishing blocked: could not verify performer ages (${performerError.message}).`
      );
      return;
    }

    const underageAtProduction = (performerRows ?? []).find((performer) =>
      !isAtLeast18OnDate(performer.date_of_birth, production.production_date)
    );

    if (underageAtProduction) {
      setErrorMessage(
        `Publishing blocked: ${underageAtProduction.stage_name} was not at least 18 on the production date.`
      );
      return;
    }

    const { error } = await supabase
      .from("videos")
      .update({ is_published: true })
      .eq("id", video.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await loadVideos();
    await onCatalogChanged();
  };

  const toggleFeatured = async (video: VideoRecord) => {
    const { error } = await supabase
      .from("videos")
      .update({ is_featured: !video.is_featured })
      .eq("id", video.id);
    if (error) return setErrorMessage(error.message);
    await loadVideos();
    await onCatalogChanged();
  };

  const deleteVideo = async (video: VideoRecord) => {
    if (
      !window.confirm(
        `Delete "${video.title}" from the site catalog? The Bunny Stream source is not deleted by this action yet.`
      )
    ) {
      return;
    }

    const { error } = await supabase.from("videos").delete().eq("id", video.id);
    if (error) return setErrorMessage(error.message);
    await removeThumbnailByUrl(video.thumbnail_url);
    if (editingVideo?.id === video.id) resetForm();
    await loadVideos();
    await onCatalogChanged();
  };

  const loadModelApplications = async () => {
    if (!profile?.is_admin) return;

    setModelApplicationsLoading(true);
    setModelApplicationsError("");

    const { data, error } = await supabase
      .from("model_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load model applications:", error);
      setModelApplicationsError(error.message);
      setModelApplicationsLoading(false);
      return;
    }

    setModelApplications((data ?? []) as ModelApplication[]);
    setModelApplicationsLoading(false);
  };

  const updateModelApplication = async (
    application: ModelApplication,
    updates: Partial<Pick<ModelApplication, "status" | "admin_notes">>
  ) => {
    if (!profile?.is_admin || modelApplicationSavingId) return;

    setModelApplicationSavingId(application.id);
    setModelApplicationsError("");
    setModelApplicationsNotice("");

    const nextStatus = updates.status ?? application.status;
    const becomingAccepted =
      updates.status === "accepted" && application.status !== "accepted";

    const { error } = await supabase
      .from("model_applications")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        reviewed_at:
          nextStatus === "new"
            ? null
            : application.reviewed_at ?? new Date().toISOString(),
      })
      .eq("id", application.id);

    if (error) {
      setModelApplicationsError(error.message);
      setModelApplicationSavingId(null);
      return;
    }

    if (becomingAccepted) {
      const { data: emailResult, error: emailError } =
        await supabase.functions.invoke("model-application-accepted-email", {
          body: { applicationId: application.id },
        });

      if (emailError || !emailResult?.ok) {
        console.error(
          "Acceptance email could not be sent:",
          emailError ?? emailResult
        );
        setModelApplicationsError(
          "The application was marked Accepted, but the acceptance email could not be sent. Check the Edge Function logs before trying again."
        );
      } else if (emailResult?.alreadySent) {
        setModelApplicationsNotice(
          `Application accepted. An acceptance email had already been sent to ${application.email}.`
        );
      } else {
        setModelApplicationsNotice(
          `Application accepted. Acceptance email sent to ${application.email}.`
        );
      }
    }

    await loadModelApplications();
    setModelApplicationSavingId(null);
  };

  useEffect(() => {
    if (!profile?.is_admin) return;
    void loadModelApplications();
  }, [profile?.is_admin]);

  const loadComplianceBackupHealth = async () => {
    setComplianceBackupHealthLoading(true);
    setComplianceBackupHealthError("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "compliance-backup-health",
        {
          body: {},
        }
      );

      if (error) {
        throw error;
      }

      if (!data?.ok) {
        throw new Error(
          data?.message ?? "Could not load compliance backup health."
        );
      }

      setComplianceBackupHealth(data as ComplianceBackupHealth);
    } catch (error) {
      console.error("Could not load compliance backup health:", error);

      setComplianceBackupHealthError(
        error instanceof Error
          ? error.message
          : "Could not load compliance backup health."
      );
    } finally {
      setComplianceBackupHealthLoading(false);
    }
  };

  useEffect(() => {
    if (!profile?.is_admin) return;

    void loadComplianceBackupHealth();
  }, [profile?.is_admin]);

  const loadComplianceAuditHistory = async (
    filters?: {
      action?: string;
      entityId?: string;
      from?: string;
      to?: string;
      limit?: number;
    }
  ) => {
    setComplianceAuditHistoryLoading(true);
    setComplianceAuditHistoryError("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "compliance-audit-history",
        {
          body: filters ?? {},
        }
      );

      if (error) {
        throw error;
      }

      if (!data?.ok) {
        throw new Error(
          data?.message ?? "Could not load compliance audit history."
        );
      }

      const response = data as ComplianceAuditHistoryResponse;
      setComplianceAuditHistory(response.events ?? []);
    } catch (error) {
      console.error("Could not load compliance audit history:", error);

      setComplianceAuditHistoryError(
        error instanceof Error
          ? error.message
          : "Could not load compliance audit history."
      );
    } finally {
      setComplianceAuditHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!profile?.is_admin) return;

    void loadComplianceAuditHistory();
  }, [profile?.is_admin]);

  const applyComplianceAuditFilters = async () => {
    const limitNumber = Number(complianceAuditLimitFilter);

    const fromIso = complianceAuditFromFilter
      ? new Date(`${complianceAuditFromFilter}T00:00:00`).toISOString()
      : undefined;

    const toIso = complianceAuditToFilter
      ? new Date(`${complianceAuditToFilter}T23:59:59.999`).toISOString()
      : undefined;

    await loadComplianceAuditHistory({
      action: complianceAuditActionFilter || undefined,
      entityId: complianceAuditEntityIdFilter.trim() || undefined,
      from: fromIso,
      to: toIso,
      limit:
        Number.isFinite(limitNumber) && limitNumber > 0
          ? Math.min(Math.floor(limitNumber), 250)
          : 100,
    });
  };

  const clearComplianceAuditFilters = async () => {
    setComplianceAuditActionFilter("");
    setComplianceAuditEntityIdFilter("");
    setComplianceAuditFromFilter("");
    setComplianceAuditToFilter("");
    setComplianceAuditLimitFilter("100");

    await loadComplianceAuditHistory();
  };

  const exportComplianceAuditHistory = async () => {
    if (complianceAuditExportLoading) return;

    setComplianceAuditExportLoading(true);
    setComplianceAuditExportError("");
    setComplianceAuditExportMessage("");

    try {
      const fromIso = complianceAuditFromFilter
        ? new Date(`${complianceAuditFromFilter}T00:00:00`).toISOString()
        : undefined;

      const toIso = complianceAuditToFilter
        ? new Date(`${complianceAuditToFilter}T23:59:59.999`).toISOString()
        : undefined;

      const { data, error } = await supabase.functions.invoke(
        "compliance-audit-export",
        {
          body: {
            action: complianceAuditActionFilter || undefined,
            entityId: complianceAuditEntityIdFilter.trim() || undefined,
            from: fromIso,
            to: toIso,
            limit: 5000,
          },
        }
      );

      if (error) {
        throw error;
      }

      if (!data?.ok || typeof data?.csv !== "string") {
        throw new Error(
          data?.message ?? "Could not export compliance audit history."
        );
      }

      const filename =
        typeof data.filename === "string" && data.filename.trim()
          ? data.filename
          : `spikeydeevip-compliance-audit-${Date.now()}.csv`;

      const blob = new Blob([data.csv], {
        type: "text/csv;charset=utf-8",
      });

      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(downloadUrl);

      setComplianceAuditExportMessage(
        `${Number(data.count ?? 0)} compliance audit event${
          Number(data.count ?? 0) === 1 ? "" : "s"
        } exported.`
      );
    } catch (error) {
      console.error("Could not export compliance audit history:", error);

      setComplianceAuditExportError(
        error instanceof Error
          ? error.message
          : "Could not export compliance audit history."
      );
    } finally {
      setComplianceAuditExportLoading(false);
    }
  };

  const complianceAuditActionLabel = (action: string) => {
    switch (action) {
      case "document_uploaded":
        return "DOCUMENT UPLOADED";
      case "document_backup_confirmed":
        return "BACKUP CONFIRMED";
      case "document_backup_failed":
        return "DOCUMENT BACKUP FAILED";
      case "backup_completed":
        return "R2 BACKUP COMPLETED";
      case "backup_already_exists":
        return "BACKUP ALREADY EXISTS";
      case "backup_failed":
        return "BACKUP FAILED";
      case "backup_integrity_verified":
        return "INTEGRITY VERIFIED";
      case "backup_integrity_failed":
        return "INTEGRITY FAILED";
      default:
        return action.replace(/_/g, " ").toUpperCase();
    }
  };

  const complianceAuditActionTone = (action: string) => {
    if (
      action === "document_backup_failed" ||
      action === "backup_failed" ||
      action === "backup_integrity_failed"
    ) {
      return {
        border: "1px solid rgba(255,70,70,.45)",
        background: "rgba(255,70,70,.07)",
      };
    }

    if (
      action === "document_backup_confirmed" ||
      action === "backup_completed" ||
      action === "backup_already_exists" ||
      action === "backup_integrity_verified"
    ) {
      return {
        border: "1px solid rgba(80,220,130,.30)",
        background: "rgba(80,220,130,.05)",
      };
    }

    return {
      border: "1px solid var(--border)",
      background: "rgba(255,255,255,.02)",
    };
  };
  if (!profile.is_admin) {
    return (
      <main>
        <div className="content-wrapper">
          <section className="content-section">
            <h2>Access denied</h2>
          </section>
        </div>
      </main>
    );
  }

  const currentSlug =
    makeSlug(form.slug || form.title || "video-title") || "video-title";
  const publicPath = `/video/${currentSlug}`;

  const fieldStyle = {
    width: "100%",
    minHeight: "46px",
    padding: "0 14px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.035)",
    color: "#f4f4f4",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.025)",
  } as const;

  const uploadBoxStyle = {
    padding: "20px",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: "16px",
    background: "linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,.012))",
    boxShadow: "0 12px 34px rgba(0,0,0,.14)",
  } as const;

  return (
    <main>
      <div className="content-wrapper">
        <section
          className="content-section studio-dashboard-modern"
          style={{ paddingTop: "44px", paddingBottom: "80px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "20px",
              flexWrap: "wrap",
              marginBottom: "22px",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "7px",
                }}
              >
                <span className="section-kicker">STUDIO ADMIN</span>
                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: "999px",
                    border: "1px solid rgba(80,220,130,.22)",
                    background: "rgba(80,220,130,.07)",
                    color: "#8ff0ad",
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: ".08em",
                  }}
                >
                  SECURE
                </span>
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(28px, 3vw, 40px)",
                  lineHeight: 1.05,
                  letterSpacing: "-.035em",
                }}
              >
                Studio Dashboard
              </h1>
              <p
                style={{
                  margin: "10px 0 0",
                  color: "var(--text-muted)",
                  maxWidth: "680px",
                  lineHeight: 1.55,
                }}
              >
                Manage your storefront, videos, and compliance records from one place.
              </p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={onBack}
              style={{ minHeight: "42px", padding: "0 16px" }}
            >
              ← Back to Site
            </button>
          </div>

          <div
            role="tablist"
            aria-label="Studio dashboard sections"
            style={{
              position: "sticky",
              top: "74px",
              zIndex: 30,
              display: "flex",
              gap: "28px",
              overflowX: "auto",
              marginBottom: "30px",
              padding: "0 4px",
              borderBottom: "1px solid rgba(255,255,255,.08)",
              background: "rgba(8,8,8,.94)",
              backdropFilter: "blur(18px)",
            }}
          >
            {(
              [
                ["overview", "Overview"],
                ["homepage", "Homepage"],
                ["videos", "Videos"],
                ["models", "Models"],
                ["compliance", "Compliance & 2257"],
              ] as Array<[StudioDashboardTab, string]>
            ).map(([tab, label]) => {
              const active = studioTab === tab;

              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => openStudioTab(tab)}
                  style={{
                    position: "relative",
                    flex: "0 0 auto",
                    minHeight: "52px",
                    padding: "0 2px",
                    border: 0,
                    background: "transparent",
                    color: active ? "#f4d86d" : "#929292",
                    fontSize: "13px",
                    fontWeight: 800,
                    letterSpacing: ".025em",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: "2px",
                      borderRadius: "999px 999px 0 0",
                      background: active ? "#e7bb45" : "transparent",
                      boxShadow: active ? "0 0 18px rgba(231,187,69,.28)" : "none",
                    }}
                  />
                </button>
              );
            })}
          </div>

          <div id="studio-tab-content" style={{ scrollMarginTop: "150px" }} />

          <style>{`
            .studio-dashboard-modern {
              --admin-line: rgba(255,255,255,.08);
            }
            .studio-dashboard-modern input,
            .studio-dashboard-modern textarea,
            .studio-dashboard-modern select {
              border-color: rgba(255,255,255,.10) !important;
              background: rgba(255,255,255,.035) !important;
              color: #f5f5f5 !important;
              border-radius: 12px !important;
              box-shadow: inset 0 1px 0 rgba(255,255,255,.025) !important;
            }
            .studio-dashboard-modern input::placeholder,
            .studio-dashboard-modern textarea::placeholder {
              color: #777 !important;
              opacity: 1;
            }
            .studio-dashboard-modern input:focus,
            .studio-dashboard-modern textarea:focus,
            .studio-dashboard-modern select:focus {
              outline: none !important;
              border-color: rgba(231,187,69,.55) !important;
              box-shadow: 0 0 0 3px rgba(231,187,69,.08) !important;
            }
            .studio-dashboard-modern textarea {
              padding: 13px 14px !important;
            }
            .studio-dashboard-modern label {
              letter-spacing: .02em;
            }
            .studio-dashboard-modern > div,
            .studio-dashboard-modern article {
              transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
            }
            .studio-dashboard-modern .secondary-button,
            .studio-dashboard-modern .primary-button {
              border-radius: 11px;
            }
            .studio-dashboard-modern .section-kicker {
              font-size: 10px;
              letter-spacing: .18em;
            }
          `}</style>

          {studioTab === "overview" && (
            <>
          {/* =====================================================
              COMPLIANCE BACKUP HEALTH
          ===================================================== */}

          <div
            style={{
              padding: "26px",
              border: "1px solid var(--border)",
              borderRadius: "18px",
              marginBottom: "36px",
              background: "#101010",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "20px",
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div>
                <span className="section-kicker">COMPLIANCE SYSTEM</span>
                <h2 style={{ margin: "8px 0" }}>Backup Health</h2>
                <p
                  style={{
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  Supabase compliance vault and Cloudflare R2 integrity status.
                </p>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() => void loadComplianceBackupHealth()}
                disabled={complianceBackupHealthLoading}
              >
                {complianceBackupHealthLoading
                  ? "Checking..."
                  : "Refresh Health"}
              </button>
            </div>

            {complianceBackupHealthError && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,80,80,.35)",
                  background: "rgba(255,80,80,.08)",
                }}
              >
                <strong>Could not load backup health.</strong>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "var(--text-muted)",
                  }}
                >
                  {complianceBackupHealthError}
                </p>
              </div>
            )}

            {!complianceBackupHealthError &&
              complianceBackupHealthLoading &&
              !complianceBackupHealth && (
                <p
                  style={{
                    marginTop: "20px",
                    color: "var(--text-muted)",
                  }}
                >
                  Checking compliance backup health...
                </p>
              )}

            {complianceBackupHealth && (
              <>
                <div
                  style={{
                    marginTop: "22px",
                    padding: "18px",
                    borderRadius: "14px",
                    border:
                      complianceBackupHealth.status === "healthy"
                        ? "1px solid rgba(80,220,130,.35)"
                        : complianceBackupHealth.status === "critical"
                          ? "1px solid rgba(255,70,70,.45)"
                          : "1px solid rgba(255,190,70,.45)",
                    background:
                      complianceBackupHealth.status === "healthy"
                        ? "rgba(80,220,130,.08)"
                        : complianceBackupHealth.status === "critical"
                          ? "rgba(255,70,70,.08)"
                          : "rgba(255,190,70,.08)",
                  }}
                >
                  <span className="section-kicker">CURRENT STATUS</span>
                  <h3 style={{ margin: "8px 0 0", fontSize: "24px" }}>
                    {complianceBackupHealth.status === "healthy"
                      ? "SYSTEM HEALTHY"
                      : complianceBackupHealth.status === "critical"
                        ? "CRITICAL ATTENTION REQUIRED"
                        : "ATTENTION REQUIRED"}
                  </h3>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "14px",
                    marginTop: "18px",
                  }}
                >
                  <div
                    style={{
                      padding: "18px",
                      border: "1px solid var(--border)",
                      borderRadius: "14px",
                    }}
                  >
                    <span className="section-kicker">DOCUMENTS</span>
                    <strong
                      style={{
                        display: "block",
                        fontSize: "28px",
                        marginTop: "6px",
                      }}
                    >
                      {complianceBackupHealth.totalDocuments}
                    </strong>
                    <span style={{ color: "var(--text-muted)" }}>
                      Compliance records monitored
                    </span>
                  </div>

                  <div
                    style={{
                      padding: "18px",
                      border: "1px solid var(--border)",
                      borderRadius: "14px",
                    }}
                  >
                    <span className="section-kicker">ACTIVE FAILURES</span>
                    <strong
                      style={{
                        display: "block",
                        fontSize: "28px",
                        marginTop: "6px",
                      }}
                    >
                      {complianceBackupHealth.activeFailures}
                    </strong>
                    <span style={{ color: "var(--text-muted)" }}>
                      Current integrity problems
                    </span>
                  </div>

                  <div
                    style={{
                      padding: "18px",
                      border: "1px solid var(--border)",
                      borderRadius: "14px",
                    }}
                  >
                    <span className="section-kicker">ESCALATED</span>
                    <strong
                      style={{
                        display: "block",
                        fontSize: "28px",
                        marginTop: "6px",
                      }}
                    >
                      {complianceBackupHealth.escalatedFailures}
                    </strong>
                    <span style={{ color: "var(--text-muted)" }}>
                      3+ consecutive failures
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "18px",
                    padding: "16px",
                    border: "1px solid var(--border)",
                    borderRadius: "14px",
                  }}
                >
                  <strong>Last integrity activity</strong>
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "var(--text-muted)",
                    }}
                  >
                    {complianceBackupHealth.lastIntegrityActivity
                      ? new Date(
                          complianceBackupHealth.lastIntegrityActivity
                        ).toLocaleString()
                      : "No integrity activity recorded yet."}
                  </p>

                  {complianceBackupHealth.lastIntegrityAction && (
                    <p
                      style={{
                        margin: "4px 0 0",
                        color: "var(--text-muted)",
                        fontSize: "12px",
                      }}
                    >
                      {complianceBackupHealth.lastIntegrityAction}
                    </p>
                  )}
                </div>

                {complianceBackupHealth.failures.length > 0 && (
                  <div
                    style={{
                      marginTop: "18px",
                      display: "grid",
                      gap: "12px",
                    }}
                  >
                    <span className="section-kicker">
                      ACTIVE FAILURE DETAILS
                    </span>

                    {complianceBackupHealth.failures.map((failure) => (
                      <article
                        key={failure.id}
                        style={{
                          padding: "16px",
                          border:
                            failure.consecutive_failures >= 3
                              ? "1px solid rgba(255,70,70,.45)"
                              : "1px solid rgba(255,190,70,.4)",
                          borderRadius: "14px",
                          background: "rgba(255,255,255,.02)",
                        }}
                      >
                        <strong>
                          {failure.failure_reason
                            .replace(/_/g, " ")
                            .toUpperCase()}
                        </strong>

                        <p
                          style={{
                            margin: "8px 0 0",
                            color: "var(--text-muted)",
                            wordBreak: "break-word",
                          }}
                        >
                          Document ID: {failure.document_id}
                        </p>

                        <p
                          style={{
                            margin: "4px 0 0",
                            color: "var(--text-muted)",
                          }}
                        >
                          Consecutive failures:{" "}
                          {failure.consecutive_failures}
                        </p>

                        <p
                          style={{
                            margin: "4px 0 0",
                            color: "var(--text-muted)",
                          }}
                        >
                          Last failure:{" "}
                          {new Date(failure.last_failed_at).toLocaleString()}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {/* =====================================================
              COMPLIANCE AUDIT & INTEGRITY HISTORY
          ===================================================== */}

          <div
            style={{
              padding: "26px",
              border: "1px solid var(--border)",
              borderRadius: "18px",
              marginBottom: "36px",
              background: "#101010",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "20px",
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div>
                <span className="section-kicker">COMPLIANCE SYSTEM</span>
                <h2 style={{ margin: "8px 0" }}>
                  Audit &amp; Integrity History
                </h2>
                <p
                  style={{
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                    margin: 0,
                    maxWidth: "760px",
                  }}
                >
                  Recent protected compliance events, document backup activity,
                  and integrity verification results.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void loadComplianceAuditHistory()}
                  disabled={
                    complianceAuditHistoryLoading ||
                    complianceAuditExportLoading
                  }
                >
                  {complianceAuditHistoryLoading
                    ? "Loading..."
                    : "Refresh History"}
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void exportComplianceAuditHistory()}
                  disabled={
                    complianceAuditHistoryLoading ||
                    complianceAuditExportLoading
                  }
                >
                  {complianceAuditExportLoading
                    ? "Exporting..."
                    : "Export CSV"}
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                marginTop: "20px",
                padding: "18px",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                background: "rgba(255,255,255,.02)",
              }}
            >
              <label
                style={{
                  display: "grid",
                  gap: "7px",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                }}
              >
                Event Type
                <select
                  value={complianceAuditActionFilter}
                  onChange={(event) =>
                    setComplianceAuditActionFilter(event.target.value)
                  }
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "0 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "#0b0b0b",
                    color: "#fff",
                  }}
                >
                  <option value="">All Events</option>
                  <option value="document_uploaded">
                    Document Uploaded
                  </option>
                  <option value="document_backup_confirmed">
                    Backup Confirmed
                  </option>
                  <option value="document_backup_failed">
                    Document Backup Failed
                  </option>
                  <option value="backup_completed">
                    R2 Backup Completed
                  </option>
                  <option value="backup_already_exists">
                    Backup Already Exists
                  </option>
                  <option value="backup_failed">
                    Backup Failed
                  </option>
                  <option value="backup_integrity_verified">
                    Integrity Verified
                  </option>
                  <option value="backup_integrity_failed">
                    Integrity Failed
                  </option>
                </select>
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "7px",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                }}
              >
                Record ID
                <input
                  type="text"
                  value={complianceAuditEntityIdFilter}
                  onChange={(event) =>
                    setComplianceAuditEntityIdFilter(event.target.value)
                  }
                  placeholder="UUID / record ID"
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    boxSizing: "border-box",
                    padding: "0 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "#0b0b0b",
                    color: "#fff",
                  }}
                />
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "7px",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                }}
              >
                From Date
                <input
                  type="date"
                  value={complianceAuditFromFilter}
                  onChange={(event) =>
                    setComplianceAuditFromFilter(event.target.value)
                  }
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    boxSizing: "border-box",
                    padding: "0 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "#0b0b0b",
                    color: "#fff",
                  }}
                />
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "7px",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                }}
              >
                To Date
                <input
                  type="date"
                  value={complianceAuditToFilter}
                  onChange={(event) =>
                    setComplianceAuditToFilter(event.target.value)
                  }
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    boxSizing: "border-box",
                    padding: "0 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "#0b0b0b",
                    color: "#fff",
                  }}
                />
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "7px",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                }}
              >
                Results
                <select
                  value={complianceAuditLimitFilter}
                  onChange={(event) =>
                    setComplianceAuditLimitFilter(event.target.value)
                  }
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "0 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "#0b0b0b",
                    color: "#fff",
                  }}
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="250">250</option>
                </select>
              </label>

              <div
                style={{
                  display: "flex",
                  alignItems: "end",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void applyComplianceAuditFilters()}
                  disabled={complianceAuditHistoryLoading}
                >
                  {complianceAuditHistoryLoading
                    ? "Applying..."
                    : "Apply Filters"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void clearComplianceAuditFilters()}
                  disabled={complianceAuditHistoryLoading}
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {complianceAuditExportMessage && (
              <div
                role="status"
                style={{
                  marginTop: "14px",
                  padding: "11px 13px",
                  border: "1px solid rgba(34,197,94,.35)",
                  borderRadius: "10px",
                  background: "rgba(34,197,94,.08)",
                  color: "#b7efc5",
                  fontSize: "12.5px",
                  lineHeight: 1.5,
                }}
              >
                {complianceAuditExportMessage}
              </div>
            )}

            {complianceAuditExportError && (
              <div
                role="alert"
                style={{
                  marginTop: "14px",
                  padding: "11px 13px",
                  border: "1px solid rgba(239,68,68,.35)",
                  borderRadius: "10px",
                  background: "rgba(127,29,29,.16)",
                  color: "#f2b8b5",
                  fontSize: "12.5px",
                  lineHeight: 1.5,
                }}
              >
                {complianceAuditExportError}
              </div>
            )}

            {complianceAuditHistoryError && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,80,80,.35)",
                  background: "rgba(255,80,80,.08)",
                }}
              >
                <strong>Could not load compliance history.</strong>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "var(--text-muted)",
                  }}
                >
                  {complianceAuditHistoryError}
                </p>
              </div>
            )}

            {!complianceAuditHistoryError &&
              complianceAuditHistoryLoading &&
              complianceAuditHistory.length === 0 && (
                <p
                  style={{
                    marginTop: "20px",
                    color: "var(--text-muted)",
                  }}
                >
                  Loading compliance audit history...
                </p>
              )}

            {!complianceAuditHistoryError &&
              !complianceAuditHistoryLoading &&
              complianceAuditHistory.length === 0 && (
                <div
                  style={{
                    marginTop: "20px",
                    padding: "18px",
                    border: "1px solid var(--border)",
                    borderRadius: "14px",
                    color: "var(--text-muted)",
                  }}
                >
                  No compliance audit history has been recorded yet.
                </div>
              )}

            {complianceAuditHistory.length > 0 && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "center",
                    flexWrap: "wrap",
                    marginTop: "20px",
                    marginBottom: "12px",
                  }}
                >
                  <span className="section-kicker">
                    RECENT EVENTS
                  </span>

                  <span
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "12px",
                    }}
                  >
                    {complianceAuditHistory.length} event
                    {complianceAuditHistory.length === 1 ? "" : "s"} loaded
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "10px",
                    maxHeight: "620px",
                    overflowY: "auto",
                    paddingRight: "4px",
                  }}
                >
                  {complianceAuditHistory.map((event) => {
                    const tone = complianceAuditActionTone(event.action);

                    return (
                      <article
                        key={event.id}
                        style={{
                          padding: "16px",
                          borderRadius: "14px",
                          ...tone,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "14px",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <strong
                              style={{
                                display: "block",
                                fontSize: "14px",
                              }}
                            >
                              {complianceAuditActionLabel(event.action)}
                            </strong>

                            <span
                              style={{
                                display: "block",
                                marginTop: "5px",
                                color: "var(--text-muted)",
                                fontSize: "12px",
                              }}
                            >
                              {new Date(event.created_at).toLocaleString()}
                            </span>
                          </div>

                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontSize: "11px",
                              textTransform: "uppercase",
                              letterSpacing: ".08em",
                            }}
                          >
                            {event.entity_type ?? "compliance event"}
                          </span>
                        </div>

                        {event.entity_id && (
                          <p
                            style={{
                              margin: "10px 0 0",
                              color: "var(--text-muted)",
                              fontSize: "12px",
                              wordBreak: "break-word",
                            }}
                          >
                            Record ID: {event.entity_id}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </div>

            </>
          )}

          {studioTab === "homepage" && (
            <>
          {/* =====================================================
    PUBLIC HOMEPAGE MANAGER
===================================================== */}

<div
  style={{
    padding: "26px",
    border: "1px solid var(--border)",
    borderRadius: "18px",
    marginBottom: "36px",
    background: "#101010",
  }}
>
  <span className="section-kicker">PUBLIC HOMEPAGE</span>

  <h2 style={{ margin: "8px 0" }}>
    Homepage Slideshow Banners
  </h2>

  <p
    style={{
      color: "var(--text-muted)",
      lineHeight: 1.6,
      marginBottom: "24px",
    }}
  >
    Upload promotional banners shown in the slideshow at the top of the
    public Spikeydee VIP homepage. You can add up to {MAX_HOMEPAGE_BANNERS}.
  </p>

  <p
    style={{
      color: activeHomepageBannerCount >= MAX_HOMEPAGE_BANNERS ? "var(--gold-2)" : "var(--text-muted)",
      fontSize: "12px",
      fontWeight: 800,
      letterSpacing: ".08em",
      margin: "-10px 0 20px",
    }}
  >
    {activeHomepageBannerCount} / {MAX_HOMEPAGE_BANNERS} ACTIVE BANNERS
  </p>

  <div
    style={{
      display: "grid",
      gap: "14px",
    }}
  >
    <input
      type="text"
      value={bannerEyebrow}
      onChange={(event) => setBannerEyebrow(event.target.value)}
      placeholder="Small heading — SPIKEYDEE VIP"
      style={fieldStyle}
    />

    <input
      type="text"
      value={bannerTitle}
      onChange={(event) => setBannerTitle(event.target.value)}
      placeholder="Banner title"
      style={fieldStyle}
    />

    <input
      type="text"
      value={bannerSubtitle}
      onChange={(event) => setBannerSubtitle(event.target.value)}
      placeholder="Banner subtitle"
      style={fieldStyle}
    />

    <input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      onChange={(event) =>
        setBannerFile(event.target.files?.[0] ?? null)
      }
      style={fieldStyle}
    />

    <button
      type="button"
      className="primary-button"
      disabled={bannerSaving || activeHomepageBannerCount >= MAX_HOMEPAGE_BANNERS}
      onClick={() => void uploadHomepageBanner()}
      style={{
        width: "fit-content",
      }}
    >
      {bannerSaving
        ? "Uploading..."
        : activeHomepageBannerCount >= MAX_HOMEPAGE_BANNERS
          ? "6 Banner Limit Reached"
          : "Add Slideshow Banner"}
    </button>
  </div>

  {bannerMessage && (
    <p style={{ color: "#fff" }}>
      {bannerMessage}
    </p>
  )}

  {bannerError && (
    <p style={{ color: "#ff6b6b" }}>
      {bannerError}
    </p>
  )}

  {homepageBanners.length > 0 && (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "16px",
        marginTop: "26px",
      }}
    >
      {homepageBanners.map((banner) => (
        <article
          key={banner.id}
          style={uploadBoxStyle}
        >
          <img
            src={banner.image_url}
            alt={banner.title ?? "Homepage banner"}
            style={{
              display: "block",
              width: "100%",
              aspectRatio: "16 / 6",
              objectFit: "cover",
              borderRadius: "10px",
            }}
          />

          <div style={{ marginTop: "14px" }}>
            <span className="section-kicker">
              {banner.is_published ? "PUBLISHED" : "HIDDEN"}
            </span>

            <h3
              style={{
                margin: "7px 0 4px",
              }}
            >
              {banner.title || "Untitled Banner"}
            </h3>

            {banner.subtitle && (
              <p
                style={{
                  margin: 0,
                  color: "var(--text-muted)",
                }}
              >
                {banner.subtitle}
              </p>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "16px",
            }}
          >
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void toggleHomepageBanner(banner)
              }
            >
              {banner.is_published ? "Hide" : "Publish"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void deleteHomepageBanner(banner)
              }
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  )}
</div>


{/* =====================================================
    HOMEPAGE BRAND LOGO CAROUSEL
===================================================== */}

<div
  style={{
    padding: "26px",
    border: "1px solid var(--border)",
    borderRadius: "18px",
    marginBottom: "36px",
    background: "#101010",
  }}
>
  <span className="section-kicker">PUBLIC HOMEPAGE</span>

  <h2 style={{ margin: "8px 0" }}>
    Brand Logo Slideshow
  </h2>

  <p
    style={{
      color: "var(--text-muted)",
      lineHeight: 1.6,
      marginBottom: "24px",
    }}
  >
    Upload transparent PNG or WebP brand logos for the carousel shown directly
    underneath the public homepage banner slideshow. You can publish up to{" "}
    {MAX_HOMEPAGE_BRANDS}.
  </p>

  <p
    style={{
      color:
        activeHomepageBrandCount >= MAX_HOMEPAGE_BRANDS
          ? "var(--gold-2)"
          : "var(--text-muted)",
      fontSize: "12px",
      fontWeight: 800,
      letterSpacing: ".08em",
      margin: "-10px 0 20px",
    }}
  >
    {activeHomepageBrandCount} / {MAX_HOMEPAGE_BRANDS} ACTIVE LOGOS
  </p>

  <div
    style={{
      display: "grid",
      gap: "14px",
    }}
  >
    <input
      type="text"
      value={brandName}
      onChange={(event) => setBrandName(event.target.value)}
      placeholder="Brand / series name (optional)"
      style={fieldStyle}
    />

    <input
      type="file"
      accept="image/png,image/webp,image/jpeg"
      onChange={(event) =>
        setBrandFile(event.target.files?.[0] ?? null)
      }
      style={fieldStyle}
    />

    <button
      type="button"
      className="primary-button"
      disabled={
        brandSaving ||
        activeHomepageBrandCount >= MAX_HOMEPAGE_BRANDS
      }
      onClick={() => void uploadHomepageBrand()}
      style={{
        width: "fit-content",
      }}
    >
      {brandSaving
        ? "Uploading..."
        : activeHomepageBrandCount >= MAX_HOMEPAGE_BRANDS
          ? "12 Logo Limit Reached"
          : "Add Brand Logo"}
    </button>
  </div>

  {brandMessage && (
    <p style={{ color: "#fff" }}>
      {brandMessage}
    </p>
  )}

  {brandError && (
    <p style={{ color: "#ff6b6b" }}>
      {brandError}
    </p>
  )}

  {homepageBrands.length > 0 && (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "16px",
        marginTop: "26px",
      }}
    >
      {homepageBrands.map((brand) => (
        <article
          key={brand.id}
          style={uploadBoxStyle}
        >
          <div
            style={{
              minHeight: "150px",
              display: "grid",
              placeItems: "center",
              padding: "20px",
              background: "#050505",
              borderRadius: "10px",
            }}
          >
            <img
              src={brand.logo_url}
              alt={brand.name ?? "Brand logo"}
              style={{
                display: "block",
                width: "100%",
                maxWidth: "220px",
                maxHeight: "100px",
                objectFit: "contain",
              }}
            />
          </div>

          <div style={{ marginTop: "14px" }}>
            <span className="section-kicker">
              {brand.is_published ? "PUBLISHED" : "HIDDEN"}
            </span>

            <h3
              style={{
                margin: "7px 0 4px",
              }}
            >
              {brand.name || "Untitled Brand"}
            </h3>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "16px",
            }}
          >
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void toggleHomepageBrand(brand)
              }
            >
              {brand.is_published ? "Hide" : "Publish"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void deleteHomepageBrand(brand)
              }
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  )}
</div>


{/* =====================================================
    HOMEPAGE PHOTO GRID
===================================================== */}

<div
  style={{
    padding: "26px",
    border: "1px solid var(--border)",
    borderRadius: "18px",
    marginBottom: "36px",
    background: "#101010",
  }}
>
  <span className="section-kicker">PUBLIC HOMEPAGE</span>

  <h2 style={{ margin: "8px 0" }}>
    Homepage Photo Grid
  </h2>

  <p
    style={{
      color: "var(--text-muted)",
      lineHeight: 1.6,
      marginBottom: "24px",
    }}
  >
    Upload promotional artwork for the image grid displayed underneath
    the homepage slideshow. You can add up to {MAX_HOMEPAGE_TILES}.
  </p>

  <p
    style={{
      color: activeHomepageTileCount >= MAX_HOMEPAGE_TILES ? "var(--gold-2)" : "var(--text-muted)",
      fontSize: "12px",
      fontWeight: 800,
      letterSpacing: ".08em",
      margin: "-10px 0 20px",
    }}
  >
    {activeHomepageTileCount} / {MAX_HOMEPAGE_TILES} ACTIVE PHOTOS
  </p>

  <div
    style={{
      display: "grid",
      gap: "14px",
    }}
  >
    <input
      type="text"
      value={tileTitle}
      onChange={(event) =>
        setTileTitle(event.target.value)
      }
      placeholder="Tile title"
      style={fieldStyle}
    />

    <input
      type="text"
      value={tileSubtitle}
      onChange={(event) =>
        setTileSubtitle(event.target.value)
      }
      placeholder="Tile subtitle (optional)"
      style={fieldStyle}
    />

    <input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      onChange={(event) =>
        setTileFile(event.target.files?.[0] ?? null)
      }
      style={fieldStyle}
    />

    <button
      type="button"
      className="primary-button"
      disabled={tileSaving || activeHomepageTileCount >= MAX_HOMEPAGE_TILES}
      onClick={() => void uploadHomepageTile()}
      style={{
        width: "fit-content",
      }}
    >
      {tileSaving
        ? "Uploading..."
        : activeHomepageTileCount >= MAX_HOMEPAGE_TILES
          ? "6 Photo Limit Reached"
          : "Add Homepage Photo"}
    </button>
  </div>

  {tileMessage && (
    <p style={{ color: "#fff" }}>
      {tileMessage}
    </p>
  )}

  {tileError && (
    <p style={{ color: "#ff6b6b" }}>
      {tileError}
    </p>
  )}

  {homepageTiles.length > 0 && (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "16px",
        marginTop: "26px",
      }}
    >
      {homepageTiles.map((tile) => (
        <article
          key={tile.id}
          style={uploadBoxStyle}
        >
          <img
            src={tile.image_url}
            alt={tile.title ?? "Homepage artwork"}
            style={{
              display: "block",
              width: "100%",
              aspectRatio: "4 / 5",
              objectFit: "cover",
              borderRadius: "10px",
            }}
          />

          <div style={{ marginTop: "14px" }}>
            <span className="section-kicker">
              {tile.is_published ? "PUBLISHED" : "HIDDEN"}
            </span>

            <h3
              style={{
                margin: "7px 0 4px",
              }}
            >
              {tile.title || "Untitled Photo"}
            </h3>

            {tile.subtitle && (
              <p
                style={{
                  margin: 0,
                  color: "var(--text-muted)",
                }}
              >
                {tile.subtitle}
              </p>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "16px",
            }}
          >
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void toggleHomepageTile(tile)
              }
            >
              {tile.is_published ? "Hide" : "Publish"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void deleteHomepageTile(tile)
              }
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  )}
</div>

            </>
          )}

          {studioTab === "models" && (
            <>
              <div
                style={{
                  padding: "26px",
                  border: "1px solid rgba(255,255,255,.09)",
                  borderRadius: "18px",
                  marginBottom: "36px",
                  background: "#0f0f10",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    flexWrap: "wrap",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <span className="section-kicker">CASTING PIPELINE</span>
                    <h2 style={{ margin: "8px 0" }}>Model Applications</h2>
                    <p style={{ margin: 0, color: "var(--text-muted)", lineHeight: 1.6 }}>
                      Review public applications without mixing applicant information
                      into your performer compliance records.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void loadModelApplications()}
                    disabled={modelApplicationsLoading}
                  >
                    {modelApplicationsLoading ? "Refreshing…" : "Refresh Applications"}
                  </button>
                </div>

                {modelApplicationsError && (
                  <p style={{ color: "#ff8888", marginTop: "18px" }}>
                    {modelApplicationsError}
                  </p>
                )}

                {modelApplicationsNotice && (
                  <p style={{ color: "#8ff0ad", marginTop: "18px" }}>
                    {modelApplicationsNotice}
                  </p>
                )}

                {!modelApplicationsLoading && modelApplications.length === 0 ? (
                  <div
                    style={{
                      marginTop: "22px",
                      padding: "24px",
                      borderRadius: "14px",
                      border: "1px dashed rgba(255,255,255,.12)",
                      color: "var(--text-muted)",
                    }}
                  >
                    No model applications yet.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "16px", marginTop: "22px" }}>
                    {modelApplications.map((application) => (
                      <article
                        key={application.id}
                        style={{
                          padding: "22px",
                          border: "1px solid rgba(255,255,255,.09)",
                          borderRadius: "16px",
                          background: "#111",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0,1fr) minmax(180px,240px)",
                            gap: "20px",
                            alignItems: "start",
                          }}
                        >
                          <div>
                            <span className="section-kicker">
                              {new Date(application.created_at).toLocaleString()}
                            </span>
                            <h3 style={{ margin: "8px 0 4px", fontSize: "23px" }}>
                              {application.stage_name}
                            </h3>
                            <p style={{ margin: 0, color: "var(--text-muted)" }}>
                              {application.email}
                              {application.phone ? ` • ${application.phone}` : ""}
                            </p>
                            {(application.city || application.state) && (
                              <p style={{ margin: "6px 0 0", color: "var(--text-muted)" }}>
                                {[application.city, application.state].filter(Boolean).join(", ")}
                              </p>
                            )}
                          </div>

                          <select
                            value={application.status}
                            onChange={(event) =>
                              void updateModelApplication(application, {
                                status: event.target.value as ModelApplicationStatus,
                              })
                            }
                            disabled={modelApplicationSavingId === application.id}
                            style={{
                              minHeight: "44px",
                              borderRadius: "10px",
                              border: "1px solid rgba(255,255,255,.12)",
                              background: "#090909",
                              color: "#fff",
                              padding: "0 12px",
                            }}
                          >
                            <option value="new">New</option>
                            <option value="reviewing">Reviewing</option>
                            <option value="accepted">Accepted</option>
                            <option value="declined">Declined</option>
                          </select>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: "14px",
                            marginTop: "18px",
                          }}
                        >
                          <div>
                            <span className="section-kicker">EXPERIENCE</span>
                            <p>{application.experience.replace(/_/g, " ")}</p>
                          </div>
                          <div>
                            <span className="section-kicker">INTERESTS</span>
                            <p>{application.interests.length ? application.interests.join(", ") : "—"}</p>
                          </div>
                          <div>
                            <span className="section-kicker">SOCIAL</span>
                            <p style={{ overflowWrap: "anywhere" }}>{application.social_links || "—"}</p>
                          </div>
                          <div>
                            <span className="section-kicker">AVAILABILITY</span>
                            <p>{application.availability || "—"}</p>
                          </div>
                        </div>

                        {application.message && (
                          <div style={{ marginTop: "10px" }}>
                            <span className="section-kicker">APPLICANT MESSAGE</span>
                            <p style={{ color: "var(--text-muted)", lineHeight: 1.65 }}>
                              {application.message}
                            </p>
                          </div>
                        )}

                        <label style={{ display: "grid", gap: "8px", marginTop: "14px" }}>
                          <span className="section-kicker">PRIVATE ADMIN NOTES</span>
                          <textarea
                            defaultValue={application.admin_notes ?? ""}
                            rows={3}
                            onBlur={(event) => {
                              const value = event.target.value.trim();
                              if (value !== (application.admin_notes ?? "")) {
                                void updateModelApplication(application, {
                                  admin_notes: value || null,
                                });
                              }
                            }}
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              padding: "12px 14px",
                              borderRadius: "10px",
                              border: "1px solid rgba(255,255,255,.10)",
                              background: "#090909",
                              color: "#fff",
                              resize: "vertical",
                            }}
                          />
                        </label>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {studioTab === "compliance" && (
            <>
{/* =====================================================
    COMPLIANCE & 2257 — PERFORMER RECORDS
===================================================== */}
<div
  style={{
    padding: "26px",
    border: "1px solid rgba(231,187,69,.30)",
    borderRadius: "18px",
    marginBottom: "36px",
    background: "#101010",
  }}
>
  <span className="section-kicker">PRIVATE STUDIO COMPLIANCE</span>

  <h2 style={{ margin: "8px 0" }}>
    Compliance &amp; 2257 — Performer Records
  </h2>

  <p
    style={{
      color: "var(--text-muted)",
      lineHeight: 1.6,
      marginBottom: "24px",
      maxWidth: "900px",
    }}
  >
    Create the master identity record for each performer before linking
    documents and productions. These records are restricted to authorized
    Studio administrators.
  </p>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      gap: "14px",
    }}
  >
    <input
      type="text"
      value={compliancePerformerForm.stageName}
      onChange={(event) =>
        updateCompliancePerformerForm("stageName", event.target.value)
      }
      placeholder="Stage name *"
      autoComplete="off"
      style={fieldStyle}
    />

    <input
      type="text"
      value={compliancePerformerForm.legalName}
      onChange={(event) =>
        updateCompliancePerformerForm("legalName", event.target.value)
      }
      placeholder="Legal name *"
      autoComplete="off"
      style={fieldStyle}
    />

    <label
      style={{
        display: "grid",
        gap: "7px",
        color: "var(--text-muted)",
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      DATE OF BIRTH *
      <input
        type="date"
        value={compliancePerformerForm.dateOfBirth}
        onChange={(event) =>
          updateCompliancePerformerForm("dateOfBirth", event.target.value)
        }
        style={fieldStyle}
      />
    </label>

    <input
      type="text"
      value={compliancePerformerForm.aliases}
      onChange={(event) =>
        updateCompliancePerformerForm("aliases", event.target.value)
      }
      placeholder="Aliases / former stage names — comma separated"
      autoComplete="off"
      style={fieldStyle}
    />

    <select
      value={compliancePerformerForm.idType}
      onChange={(event) =>
        updateCompliancePerformerForm("idType", event.target.value)
      }
      style={{
        ...fieldStyle,
        background: "#151515",
        color: "#fff",
      }}
    >
      <option value="">Government ID type</option>
      <option value="drivers_license">Driver license</option>
      <option value="state_id">State ID</option>
      <option value="passport">Passport</option>
      <option value="other_government_id">Other government ID</option>
    </select>

    <input
      type="text"
      inputMode="text"
      maxLength={4}
      value={compliancePerformerForm.idNumberLast4}
      onChange={(event) =>
        updateCompliancePerformerForm(
          "idNumberLast4",
          event.target.value.slice(0, 4)
        )
      }
      placeholder="ID number — last 4 only"
      autoComplete="off"
      style={fieldStyle}
    />

    <label
      style={{
        display: "grid",
        gap: "7px",
        color: "var(--text-muted)",
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      ID EXPIRATION
      <input
        type="date"
        value={compliancePerformerForm.idExpiration}
        onChange={(event) =>
          updateCompliancePerformerForm("idExpiration", event.target.value)
        }
        style={fieldStyle}
      />
    </label>

    <textarea
      value={compliancePerformerForm.notes}
      onChange={(event) =>
        updateCompliancePerformerForm("notes", event.target.value)
      }
      placeholder="Private compliance notes"
      rows={4}
      style={{
        ...fieldStyle,
        minHeight: "112px",
        resize: "vertical",
        gridColumn: "1 / -1",
      }}
    />
  </div>

  <div
    style={{
      display: "flex",
      gap: "12px",
      flexWrap: "wrap",
      alignItems: "center",
      marginTop: "18px",
    }}
  >
    <button
      type="button"
      className="primary-button"
      disabled={compliancePerformerSaving}
      onClick={() => void createCompliancePerformer()}
    >
      {compliancePerformerSaving
        ? "Creating..."
        : "Create Performer Record"}
    </button>

    <span
      style={{
        color: "var(--text-muted)",
        fontSize: "12px",
      }}
    >
      {compliancePerformers.length} performer record
      {compliancePerformers.length === 1 ? "" : "s"} on file
    </span>
  </div>

  {compliancePerformerMessage && (
    <p role="status" style={{ color: "#fff" }}>
      {compliancePerformerMessage}
    </p>
  )}

  {compliancePerformerError && (
    <p role="alert" style={{ color: "#ff6b6b" }}>
      {compliancePerformerError}
    </p>
  )}

  {compliancePerformers.length > 0 && (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "16px",
        marginTop: "26px",
      }}
    >
      {compliancePerformers.map((performer) => (
        <article
          key={performer.id}
          style={{
            ...uploadBoxStyle,
            borderColor: "rgba(231,187,69,.20)",
          }}
        >
          <span className="section-kicker">PERFORMER RECORD</span>

          <h3 style={{ margin: "8px 0 4px" }}>
            {performer.stage_name}
          </h3>

          <p
            style={{
              margin: "0 0 14px",
              color: "var(--text-muted)",
            }}
          >
            Legal name: {performer.legal_name}
          </p>

          <div
            style={{
              display: "grid",
              gap: "8px",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            <div>
              <strong>DOB:</strong>{" "}
              {new Date(
                `${performer.date_of_birth}T00:00:00`
              ).toLocaleDateString()}
            </div>

            <div>
              <strong>Aliases:</strong>{" "}
              {performer.aliases?.length
                ? performer.aliases.join(", ")
                : "None"}
            </div>

            <div>
              <strong>ID type:</strong>{" "}
              {performer.id_type || "Not entered"}
            </div>

            <div>
              <strong>ID last 4:</strong>{" "}
              {performer.id_number_last4
                ? `•••• ${performer.id_number_last4}`
                : "Not entered"}
            </div>

            <div>
              <strong>ID expiration:</strong>{" "}
              {performer.id_expiration
                ? new Date(
                    `${performer.id_expiration}T00:00:00`
                  ).toLocaleDateString()
                : "Not entered"}
            </div>
          </div>

          <div
            style={{
              marginTop: "16px",
              padding: "10px 12px",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: "10px",
              background: "#0b0b0b",
              color: "var(--text-muted)",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            {complianceDocuments.filter(
              (document) =>
                document.performer_id === performer.id &&
                !document.archived_at
            ).length} active secure document
            {complianceDocuments.filter(
              (document) =>
                document.performer_id === performer.id &&
                !document.archived_at
            ).length === 1
              ? ""
              : "s"}{" "}
            ·{" "}
            {complianceDocuments.filter(
              (document) =>
                document.performer_id === performer.id &&
                Boolean(document.archived_at)
            ).length} archived
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setComplianceDocumentPerformerId(performer.id);
              document
                .getElementById("compliance-document-vault")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            style={{ marginTop: "12px", width: "100%" }}
          >
            Add / View Documents
          </button>
        </article>
      ))}
    </div>
  )}
</div>

{/* =====================================================
    COMPLIANCE & 2257 — SECURE DOCUMENT VAULT
===================================================== */}
<div
  id="compliance-document-vault"
  style={{
    padding: "26px",
    border: "1px solid rgba(231,187,69,.30)",
    borderRadius: "18px",
    marginBottom: "36px",
    background: "#101010",
  }}
>
  <span className="section-kicker">PRIVATE SECURE STORAGE</span>
  <h2 style={{ margin: "8px 0" }}>Compliance Document Vault</h2>
  <p
    style={{
      color: "var(--text-muted)",
      lineHeight: 1.6,
      maxWidth: "900px",
      marginBottom: "22px",
    }}
  >
    Upload government ID copies, performer releases, consent forms, and
    §2257 records. Files are stored in the private compliance-vault bucket,
    opened only through short-lived signed links, and archived rather than
    permanently deleted during the retention period.
  </p>

  {compliancePerformers.length === 0 ? (
    <div
      style={{
        padding: "16px",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: "12px",
        color: "var(--text-muted)",
      }}
    >
      Create a performer record above before uploading compliance documents.
    </div>
  ) : (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "14px",
        }}
      >
        <select
          value={complianceDocumentPerformerId}
          onChange={(event) =>
            setComplianceDocumentPerformerId(event.target.value)
          }
          style={{ ...fieldStyle, background: "#151515", color: "#fff" }}
        >
          <option value="">Choose performer *</option>
          {compliancePerformers.map((performer) => (
            <option key={performer.id} value={performer.id}>
              {performer.stage_name} — {performer.legal_name}
            </option>
          ))}
        </select>

        <select
          value={complianceDocumentType}
          onChange={(event) =>
            setComplianceDocumentType(
              event.target.value as ComplianceDocumentType
            )
          }
          style={{ ...fieldStyle, background: "#151515", color: "#fff" }}
        >
          <option value="government_id">Government ID</option>
          <option value="2257_record">2257 Record</option>
          <option value="performer_release">Performer Release</option>
          <option value="consent_form">Consent Form</option>
          <option value="other">Other Document</option>
        </select>

        <label
          style={{
            display: "grid",
            gap: "7px",
            color: "var(--text-muted)",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          ISSUED / SIGNED DATE
          <input
            type="date"
            value={complianceDocumentIssuedDate}
            onChange={(event) =>
              setComplianceDocumentIssuedDate(event.target.value)
            }
            style={fieldStyle}
          />
        </label>

        <label
          style={{
            display: "grid",
            gap: "7px",
            color: "var(--text-muted)",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          EXPIRATION DATE
          <input
            type="date"
            value={complianceDocumentExpirationDate}
            onChange={(event) =>
              setComplianceDocumentExpirationDate(event.target.value)
            }
            style={fieldStyle}
          />
        </label>

        <label
          style={{
            display: "grid",
            gap: "7px",
            color: "var(--text-muted)",
            fontSize: "12px",
            fontWeight: 700,
            gridColumn: "1 / -1",
          }}
        >
          SECURE FILE *
          <input
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            onChange={(event) =>
              setComplianceDocumentFile(event.target.files?.[0] ?? null)
            }
            style={fieldStyle}
          />
        </label>

        <textarea
          value={complianceDocumentNotes}
          onChange={(event) =>
            setComplianceDocumentNotes(event.target.value)
          }
          placeholder="Private document notes"
          rows={3}
          style={{
            ...fieldStyle,
            minHeight: "96px",
            resize: "vertical",
            gridColumn: "1 / -1",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "center",
          marginTop: "18px",
        }}
      >
        <button
          type="button"
          className="primary-button"
          disabled={complianceDocumentSaving}
          onClick={() => void uploadComplianceDocument()}
        >
          {complianceDocumentSaving
            ? "Uploading Securely..."
            : "Upload Secure Document"}
        </button>

        <span
          style={{
            color: "var(--text-muted)",
            fontSize: "12px",
          }}
        >
          PDF, JPG, PNG or WEBP · 20 MB max
        </span>
      </div>

      {complianceDocumentMessage && (
        <p role="status" style={{ color: "#fff" }}>
          {complianceDocumentMessage}
        </p>
      )}

      {complianceDocumentError && (
        <p role="alert" style={{ color: "#ff6b6b" }}>
          {complianceDocumentError}
        </p>
      )}

      {complianceDocumentPerformerId && (
        <div style={{ marginTop: "28px" }}>
          <span className="section-kicker">ACTIVE RECORDS</span>
          <h3 style={{ margin: "8px 0 16px" }}>
            {
              compliancePerformers.find(
                (performer) =>
                  performer.id === complianceDocumentPerformerId
              )?.stage_name
            }
          </h3>

          {complianceDocuments.filter(
            (document) =>
              document.performer_id === complianceDocumentPerformerId &&
              !document.archived_at
          ).length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>
              No active secure documents are linked to this performer yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {complianceDocuments
                .filter(
                  (document) =>
                    document.performer_id ===
                      complianceDocumentPerformerId &&
                    !document.archived_at
                )
                .map((document) => (
                  <article
                    key={document.id}
                    style={{
                      ...uploadBoxStyle,
                      display: "grid",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <span className="section-kicker">
                        {complianceDocumentLabel(document.document_type)}
                      </span>
                      <h3 style={{ margin: "8px 0 4px" }}>
                        {document.original_filename ??
                          complianceDocumentLabel(document.document_type)}
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--text-muted)",
                          fontSize: "12px",
                          lineHeight: 1.5,
                        }}
                      >
                        Uploaded{" "}
                        {new Date(document.created_at).toLocaleString()}
                        {document.expiration_date
                          ? ` · Expires ${new Date(
                              `${document.expiration_date}T00:00:00`
                            ).toLocaleDateString()}`
                          : ""}
                        {document.retention_until
                          ? ` · Retain through ${new Date(
                              document.retention_until
                            ).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>

                    {document.notes && (
                      <p
                        style={{
                          margin: 0,
                          color: "var(--text-muted)",
                          lineHeight: 1.5,
                        }}
                      >
                        {document.notes}
                      </p>
                    )}

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          void viewComplianceDocument(document)
                        }
                      >
                        View Secure Document
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        disabled={complianceRestoreBusyDocumentId !== null}
                        onClick={() =>
                          void restoreComplianceDocumentFromBackup(document)
                        }
                      >
                        {complianceRestoreBusyDocumentId === document.id
                          ? "Checking Backup..."
                          : "Restore from Backup"}
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          void archiveComplianceDocument(document)
                        }
                      >
                        Archive Record
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          )}

          <div
            style={{
              marginTop: "28px",
              paddingTop: "22px",
              borderTop: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <span className="section-kicker">ARCHIVED RECORDS</span>

            {complianceDocuments.filter(
              (document) =>
                document.performer_id === complianceDocumentPerformerId &&
                Boolean(document.archived_at)
            ).length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>
                No archived compliance records for this performer.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  marginTop: "14px",
                }}
              >
                {complianceDocuments
                  .filter(
                    (document) =>
                      document.performer_id ===
                        complianceDocumentPerformerId &&
                      Boolean(document.archived_at)
                  )
                  .map((document) => (
                    <article
                      key={document.id}
                      style={{
                        ...uploadBoxStyle,
                        display: "grid",
                        gap: "10px",
                        opacity: 0.78,
                      }}
                    >
                      <div>
                        <span className="section-kicker">
                          ARCHIVED ·{" "}
                          {complianceDocumentLabel(document.document_type)}
                        </span>

                        <h3 style={{ margin: "8px 0 4px" }}>
                          {document.original_filename ??
                            complianceDocumentLabel(document.document_type)}
                        </h3>

                        <p
                          style={{
                            margin: 0,
                            color: "var(--text-muted)",
                            fontSize: "12px",
                            lineHeight: 1.6,
                          }}
                        >
                          Archived{" "}
                          {document.archived_at
                            ? new Date(
                                document.archived_at
                              ).toLocaleString()
                            : "—"}
                          {document.retention_until
                            ? ` · Retain through ${new Date(
                                document.retention_until
                              ).toLocaleDateString()}`
                            : ""}
                        </p>
                      </div>

                      {document.archive_reason && (
                        <p
                          style={{
                            margin: 0,
                            color: "var(--text-muted)",
                            lineHeight: 1.5,
                          }}
                        >
                          <strong>Archive reason:</strong>{" "}
                          {document.archive_reason}
                        </p>
                      )}

                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            void viewComplianceDocument(document)
                          }
                        >
                          View Retained Document
                        </button>

                        <button
                          type="button"
                          className="secondary-button"
                          disabled={complianceRestoreBusyDocumentId !== null}
                          onClick={() =>
                            void restoreComplianceDocumentFromBackup(document)
                          }
                        >
                          {complianceRestoreBusyDocumentId === document.id
                            ? "Checking Backup..."
                            : "Restore from Backup"}
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
      )
    </>
  )}
</div>

            </>
          )}

          {studioTab === "homepage" && (
            <>
{/* =====================================================
    FEATURED PERFORMERS
===================================================== */}
<div style={{ padding:"26px", border:"1px solid var(--border)", borderRadius:"18px", marginBottom:"36px", background:"#101010" }}>
  <span className="section-kicker">PUBLIC HOMEPAGE</span>
  <h2 style={{ margin:"8px 0" }}>Featured Performers</h2>
  <p style={{ color:"var(--text-muted)", lineHeight:1.6, marginBottom:"24px" }}>Upload performer photos for the Featured Performers section on the public homepage. You can publish up to {MAX_HOMEPAGE_PERFORMERS}.</p>
  <p style={{ color: activeHomepagePerformerCount >= MAX_HOMEPAGE_PERFORMERS ? "var(--gold-2)" : "var(--text-muted)", fontSize:"12px", fontWeight:800, letterSpacing:".08em", margin:"-10px 0 20px" }}>{activeHomepagePerformerCount} / {MAX_HOMEPAGE_PERFORMERS} ACTIVE PERFORMERS</p>
  <div style={{ display:"grid", gap:"14px" }}>
    <input type="text" value={performerName} onChange={(e)=>setPerformerName(e.target.value)} placeholder="Performer name" style={fieldStyle} />
    <input type="text" value={performerSubtitle} onChange={(e)=>setPerformerSubtitle(e.target.value)} placeholder="Subtitle — FEATURED PERFORMER" style={fieldStyle} />
    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>setPerformerFile(e.target.files?.[0] ?? null)} style={fieldStyle} />
    <button type="button" className="primary-button" disabled={performerSaving || activeHomepagePerformerCount >= MAX_HOMEPAGE_PERFORMERS} onClick={()=>void uploadHomepagePerformer()} style={{width:"fit-content"}}>{performerSaving ? "Uploading..." : activeHomepagePerformerCount >= MAX_HOMEPAGE_PERFORMERS ? "Performer Limit Reached" : "Add Featured Performer"}</button>
  </div>
  {performerMessage && <p style={{color:"#fff"}}>{performerMessage}</p>}
  {performerError && <p style={{color:"#ff6b6b"}}>{performerError}</p>}
  {homepagePerformers.length > 0 && (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:"16px", marginTop:"26px" }}>
      {homepagePerformers.map((performer)=>(
        <article key={performer.id} style={uploadBoxStyle}>
          <img src={performer.image_url} alt={performer.name} style={{ display:"block", width:"100%", aspectRatio:"4 / 5", objectFit:"cover", borderRadius:"10px", background:"#090909" }} />
          <div style={{marginTop:"14px"}}><span className="section-kicker">{performer.is_published ? "PUBLISHED" : "HIDDEN"}</span><h3 style={{margin:"7px 0 4px"}}>{performer.name}</h3><p style={{margin:0,color:"var(--text-muted)"}}>{performer.subtitle || "FEATURED PERFORMER"}</p></div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"10px",marginTop:"16px"}}>
            <button type="button" className="secondary-button" onClick={()=>void toggleHomepagePerformer(performer)}>{performer.is_published ? "Hide" : "Publish"}</button>
            <button type="button" className="secondary-button" onClick={()=>void deleteHomepagePerformer(performer)}>Delete</button>
          </div>
        </article>
      ))}
    </div>
  )}
</div>

         {/* =====================================================
    HOMEPAGE FEATURED TEASER EDITOR
===================================================== */}
<div
  style={{
    padding: "26px",
    border: "1px solid var(--border)",
    borderRadius: "18px",
    marginBottom: "36px",
    background: "#101010",
  }}
>
  <span className="section-kicker">HOMEPAGE FEATURED TEASER</span>

  <h2 style={{ marginTop: "8px", marginBottom: "8px" }}>
    Featured Hero
  </h2>

  <p
    style={{
      color: "var(--text-muted)",
      lineHeight: 1.6,
      marginTop: 0,
      marginBottom: "24px",
    }}
  >
    Choose which uploaded Bunny Stream release appears as the cinematic
    centerpiece on the public homepage. You can change this at any time
    without redeploying the site.
  </p>

  <div
    style={{
      display: "grid",
      gap: "18px",
    }}
  >
    {/* FEATURED VIDEO */}
    <div style={uploadBoxStyle}>
      <span className="section-kicker">FEATURED RELEASE</span>
      <h3 style={{ marginTop: "8px" }}>Choose Homepage Video</h3>

      <select
        value={heroSettings.featured_video_id ?? ""}
        onChange={(event) =>
          updateHeroSetting(
            "featured_video_id",
            event.target.value || null
          )
        }
        style={fieldStyle}
      >
        <option value="">Select an uploaded video...</option>

        {videos
          .filter((video) => Boolean(video.bunny_video_id))
          .map((video) => (
            <option
              key={video.bunny_video_id}
              value={video.bunny_video_id ?? ""}
            >
              {video.title}
            </option>
          ))}
      </select>

      <p
        style={{
          color: "var(--text-muted)",
          marginBottom: 0,
          lineHeight: 1.5,
        }}
      >
        The selected Bunny Stream video will supply the hero artwork and
        teaser video.
      </p>
    </div>

    {/* HERO COPY */}
    <div style={uploadBoxStyle}>
      <span className="section-kicker">HERO COPY</span>
      <h3 style={{ marginTop: "8px" }}>Homepage Presentation</h3>

      <div
        style={{
          display: "grid",
          gap: "14px",
        }}
      >
        <label>
          <span
            style={{
              display: "block",
              marginBottom: "7px",
              fontWeight: 700,
            }}
          >
            Hero Title
          </span>

          <input
            type="text"
            value={heroSettings.hero_title ?? ""}
            onChange={(event) =>
              updateHeroSetting("hero_title", event.target.value)
            }
            placeholder="Featured release title"
            style={fieldStyle}
          />
        </label>

        <label>
          <span
            style={{
              display: "block",
              marginBottom: "7px",
              fontWeight: 700,
            }}
          >
            Kicker / Subtitle
          </span>

          <input
            type="text"
            value={heroSettings.hero_subtitle ?? ""}
            onChange={(event) =>
              updateHeroSetting("hero_subtitle", event.target.value)
            }
            placeholder="SPIKEYDEE VIP ORIGINAL"
            style={fieldStyle}
          />
        </label>

        <label>
          <span
            style={{
              display: "block",
              marginBottom: "7px",
              fontWeight: 700,
            }}
          >
            Description
          </span>

          <textarea
            value={heroSettings.hero_description ?? ""}
            onChange={(event) =>
              updateHeroSetting(
                "hero_description",
                event.target.value
              )
            }
            placeholder="Short description shown over the featured teaser."
            rows={4}
            style={{
              ...fieldStyle,
              minHeight: "120px",
              resize: "vertical",
            }}
          />
        </label>
      </div>
    </div>

    {/* TEASER PLAYBACK */}
    <div style={uploadBoxStyle}>
      <span className="section-kicker">TEASER PLAYBACK</span>
      <h3 style={{ marginTop: "8px" }}>Preview Timing</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
        }}
      >
        <label>
          <span
            style={{
              display: "block",
              marginBottom: "7px",
              fontWeight: 700,
            }}
          >
            Start Time (seconds)
          </span>

          <input
            type="number"
            min="0"
            step="1"
            value={heroSettings.teaser_start_seconds}
            onChange={(event) =>
              updateHeroSetting(
                "teaser_start_seconds",
                Math.max(0, Number(event.target.value) || 0)
              )
            }
            style={fieldStyle}
          />
        </label>

        <label>
          <span
            style={{
              display: "block",
              marginBottom: "7px",
              fontWeight: 700,
            }}
          >
            End Time (seconds)
          </span>

          <input
            type="number"
            min="0"
            step="1"
            value={heroSettings.teaser_end_seconds ?? ""}
            onChange={(event) =>
              updateHeroSetting(
                "teaser_end_seconds",
                event.target.value === ""
                  ? null
                  : Math.max(0, Number(event.target.value) || 0)
              )
            }
            placeholder="Optional"
            style={fieldStyle}
          />
        </label>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "22px",
          marginTop: "20px",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={heroSettings.autoplay}
            onChange={(event) =>
              updateHeroSetting("autoplay", event.target.checked)
            }
          />

          <span>Autoplay muted teaser</span>
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={heroSettings.loop_teaser}
            onChange={(event) =>
              updateHeroSetting("loop_teaser", event.target.checked)
            }
          />

          <span>Loop teaser</span>
        </label>
      </div>

      <p
        style={{
          color: "var(--text-muted)",
          marginBottom: 0,
          marginTop: "18px",
          lineHeight: 1.5,
        }}
      >
        The homepage teaser will be muted when autoplay is enabled.
        Visitors will still need VIP access to watch protected full
        releases.
      </p>
    </div>

    {/* SAVE */}
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "16px",
      }}
    >
      <button
        type="button"
        onClick={() => void saveHeroSettings()}
        disabled={heroSaving}
        style={{
          minHeight: "48px",
          padding: "0 22px",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          fontWeight: 800,
          cursor: heroSaving ? "wait" : "pointer",
          opacity: heroSaving ? 0.65 : 1,
        }}
      >
        {heroSaving ? "Saving..." : "Save Homepage Hero"}
      </button>

      {heroMessage && (
        <span
          style={{
            color: "#fff",
            fontWeight: 700,
          }}
        >
          {heroMessage}
        </span>
      )}

      {heroError && (
        <span
          style={{
            color: "#ff6b6b",
            fontWeight: 700,
          }}
        >
          {heroError}
        </span>
      )}
    </div>
  </div>
</div>
            </>
          )}

          {studioTab === "videos" && (
            <>
          <div
            style={{
              padding: "26px",
              border: "1px solid var(--border)",
              borderRadius: "18px",
              marginBottom: "36px",
            }}
          >
            <span className="section-kicker">
              {editingVideo ? "EDIT VIDEO" : "BUNNY STREAM UPLOAD"}
            </span>
            <h2>{editingVideo ? `Editing ${editingVideo.title}` : "Add a New Video"}</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              Video masters upload directly from this browser to Bunny Stream using a short-lived,
              server-signed TUS authorization. Your Bunny API key never enters App.tsx.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
              <div style={uploadBoxStyle}>
                <span className="section-kicker">BUNNY STREAM VIDEO</span>
                <h3>Choose Video File</h3>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/*"
                  onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
                  style={{ ...fieldStyle, paddingTop: "10px" }}
                />
                <p style={{ color: "var(--text-muted)", marginBottom: 0 }}>
                  {videoFile
                    ? `Selected: ${videoFile.name} (${(videoFile.size / 1024 / 1024).toFixed(1)} MB)`
                    : editingVideo?.bunny_video_id
                      ? `Bunny video already connected: ${editingVideo.bunny_video_id}`
                      : "No video selected yet."}
                </p>
                <p style={{ color: "var(--text-muted)", marginBottom: 0 }}>
                  Resumable TUS uploads are intended for your longer production files and can resume after many network interruptions.
                </p>
              </div>

              <div style={uploadBoxStyle}>
                <span className="section-kicker">POSTER / THUMBNAIL</span>
                <h3>Choose Poster Image</h3>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  onChange={(event) => setThumbnailFile(event.target.files?.[0] ?? null)}
                  style={{ ...fieldStyle, paddingTop: "10px" }}
                />
                {editingVideo?.thumbnail_url && !thumbnailFile && (
                  <img
                    src={editingVideo.thumbnail_url}
                    alt="Current poster"
                    style={{
                      marginTop: "14px",
                      width: "180px",
                      maxHeight: "120px",
                      objectFit: "cover",
                      borderRadius: "10px",
                    }}
                  />
                )}
              </div>

              <input
                required
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value;
                  updateForm("title", title);
                  if (!editingVideo) updateForm("slug", makeSlug(title));
                }}
                placeholder="Title"
                style={fieldStyle}
              />

              <div style={uploadBoxStyle}>
                <span className="section-kicker">PUBLIC VIDEO PAGE</span>
                <p style={{ margin: "10px 0 6px", fontWeight: 700 }}>
                  {window.location.origin}
                  {publicPath}
                </p>
                <small style={{ color: "var(--text-muted)" }}>
                  This address is generated automatically. Bunny handles the underlying stream;
                  viewers remain on your /video/&lt;slug&gt; page.
                </small>
              </div>

              <input
                required
                value={form.slug}
                onChange={(e) => updateForm("slug", makeSlug(e.target.value))}
                placeholder="Slug"
                style={fieldStyle}
              />
              <input
                value={form.subtitle}
                onChange={(e) => updateForm("subtitle", e.target.value)}
                placeholder="Subtitle"
                style={fieldStyle}
              />
              <textarea
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                rows={5}
                placeholder="Description"
                style={{ ...fieldStyle, paddingTop: "12px" }}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                  gap: "14px",
                }}
              >
                <input
                  type="number"
                  min={0}
                  value={form.durationMinutes}
                  onChange={(e) => updateForm("durationMinutes", e.target.value)}
                  placeholder="Duration (minutes)"
                  style={fieldStyle}
                />
                <input
                  value={form.category}
                  onChange={(e) => updateForm("category", e.target.value)}
                  placeholder="Category"
                  style={fieldStyle}
                />
                <input
                  value={form.performer}
                  onChange={(e) => updateForm("performer", e.target.value)}
                  placeholder="Performer"
                  style={fieldStyle}
                />
                <input
                  value={form.seriesName}
                  onChange={(e) => updateForm("seriesName", e.target.value)}
                  placeholder="Series"
                  style={fieldStyle}
                />
                <input
                  value={form.badge}
                  onChange={(e) => updateForm("badge", e.target.value)}
                  placeholder="Badge (NEW, ORIGINAL, etc.)"
                  style={fieldStyle}
                />
              </div>

              <div style={uploadBoxStyle}>
                <span className="section-kicker">PRODUCTION &amp; COMPLIANCE</span>
                <h3>Link this video to its performer records and documents</h3>
                <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                  Create the production record that ties this exact video to the performers
                  depicted in it. Government IDs stay attached to the performer record;
                  scene-specific consent, release, and 2257 documents can be linked here.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                    gap: "14px",
                    marginTop: "14px",
                  }}
                >
                  <input
                    value={productionCode}
                    onChange={(event) => setProductionCode(event.target.value.toUpperCase())}
                    placeholder="Production ID — e.g. SDV-2026-0001"
                    style={fieldStyle}
                  />
                  <input
                    type="date"
                    value={productionDate}
                    onChange={(event) => setProductionDate(event.target.value)}
                    aria-label="Original production date"
                    style={fieldStyle}
                  />
                </div>

                <div style={{ marginTop: "20px" }}>
                  <strong style={{ display: "block", marginBottom: "10px" }}>
                    PERFORMERS IN THIS VIDEO
                  </strong>

                  {compliancePerformers.length === 0 ? (
                    <p style={{ color: "var(--text-muted)" }}>
                      No compliance performers exist yet. Add performers in the Compliance &amp;
                      2257 section before linking a production.
                    </p>
                  ) : (
                    <div style={{ display: "grid", gap: "10px" }}>
                      {compliancePerformers.map((performer) => {
                        const selected = selectedCompliancePerformerIds.includes(performer.id);
                        const performerDocs = complianceDocuments.filter(
                          (document) => document.performer_id === performer.id
                        );
                        const governmentIds = performerDocs.filter(
                          (document) => document.document_type === "government_id"
                        );
                        const selectableDocs = performerDocs.filter(
                          (document) =>
                            document.document_type !== "government_id" &&
                            (!document.production_id ||
                              document.production_id === editingComplianceProductionId)
                        );

                        return (
                          <div
                            key={performer.id}
                            style={{
                              padding: "14px",
                              border: selected
                                ? "1px solid rgba(231,187,69,.65)"
                                : "1px solid var(--border)",
                              borderRadius: "12px",
                              background: selected ? "rgba(231,187,69,.05)" : "#101010",
                            }}
                          >
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() =>
                                  toggleCompliancePerformerForProduction(performer.id)
                                }
                              />
                              <span>
                                <strong>{performer.stage_name}</strong>
                                <span
                                  style={{
                                    display: "block",
                                    marginTop: "3px",
                                    color: "var(--text-muted)",
                                    fontSize: "12px",
                                  }}
                                >
                                  Compliance performer record
                                </span>
                              </span>
                            </label>

                            {selected && (
                              <div style={{ marginTop: "14px", paddingLeft: "26px" }}>
                                <div
                                  style={{
                                    marginBottom: "10px",
                                    color: governmentIds.length > 0 ? "#fff" : "#ffb3b3",
                                    fontSize: "13px",
                                  }}
                                >
                                  {governmentIds.length > 0
                                    ? `✓ Government ID record on file (${governmentIds.length})`
                                    : "⚠ No Government ID document on file"}
                                </div>

                                {selectableDocs.length > 0 ? (
                                  <div style={{ display: "grid", gap: "8px" }}>
                                    <span
                                      style={{
                                        color: "var(--text-muted)",
                                        fontSize: "12px",
                                        fontWeight: 800,
                                      }}
                                    >
                                      LINK SCENE-SPECIFIC DOCUMENTS
                                    </span>
                                    {selectableDocs.map((document) => (
                                      <label
                                        key={document.id}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "9px",
                                          fontSize: "13px",
                                          cursor: "pointer",
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={selectedComplianceDocumentIds.includes(
                                            document.id
                                          )}
                                          onChange={() =>
                                            toggleComplianceDocumentForProduction(document.id)
                                          }
                                        />
                                        <span>
                                          {complianceDocumentLabel(document.document_type)}
                                          {document.original_filename
                                            ? ` — ${document.original_filename}`
                                            : ""}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                ) : (
                                  <p
                                    style={{
                                      margin: 0,
                                      color: "var(--text-muted)",
                                      fontSize: "13px",
                                    }}
                                  >
                                    No unlinked consent, release, or 2257 documents are currently
                                    available for this performer.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    marginTop: "18px",
                    padding: "16px",
                    borderRadius: "12px",
                    border: compliancePublishReady
                      ? "1px solid rgba(74,222,128,.42)"
                      : "1px solid rgba(231,187,69,.24)",
                    background: compliancePublishReady
                      ? "rgba(74,222,128,.05)"
                      : "rgba(231,187,69,.04)",
                    fontSize: "13px",
                    lineHeight: 1.55,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#fff" }}>COMPLIANCE STATUS: </strong>
                      <strong>
                        {productionComplianceCheckLoading
                          ? "CHECKING…"
                          : productionComplianceCheck?.complianceStatus?.toUpperCase() ??
                            (editingComplianceProductionId ? "REVIEW" : "NOT YET SAVED")}
                      </strong>
                    </div>
                    <strong
                      style={{
                        color: compliancePublishReady ? "#8ff0ad" : "#ffcf70",
                      }}
                    >
                      {compliancePublishReady
                        ? "READY TO PUBLISH"
                        : "PUBLISHING LOCKED"}
                    </strong>
                  </div>

                  <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
                    <div>
                      {productionCode.trim() ? "✓" : "✕"} Production ID
                    </div>
                    <div>
                      {productionDate ? "✓" : "✕"} Production date
                    </div>
                    <div>
                      {selectedCompliancePerformerIds.length > 0 ? "✓" : "✕"} At least one
                      performer linked
                    </div>
                    <div>
                      {selectedPerformersAgeReady ? "✓" : "✕"} Every linked performer was
                      18+ on the production date
                    </div>
                  </div>

                  {productionComplianceCheck?.performers?.length ? (
                    <div style={{ display: "grid", gap: "10px", marginTop: "16px" }}>
                      {productionComplianceCheck.performers.map((performer) => {
                        const performerRecord = compliancePerformers.find(
                          (item) => item.id === performer.performerId
                        );
                        const ageReady = performerRecord
                          ? isAtLeast18OnDate(performerRecord.date_of_birth, productionDate)
                          : false;

                        return (
                          <div
                            key={performer.performerId}
                            style={{
                              padding: "12px",
                              border: "1px solid var(--border)",
                              borderRadius: "10px",
                              background: "#0c0c0c",
                            }}
                          >
                            <strong>{performer.stageName}</strong>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fit,minmax(180px,1fr))",
                                gap: "6px 14px",
                                marginTop: "8px",
                                color: "var(--text-muted)",
                              }}
                            >
                              <span>{ageReady ? "✓" : "✕"} 18+ on production date</span>
                              <span>{performer.governmentId ? "✓" : "✕"} Government ID</span>
                              <span>{performer.record2257 ? "✓" : "✕"} 2257 record</span>
                              <span>{performer.consentForm ? "✓" : "✕"} Consent form</span>
                              <span>
                                {performer.performerRelease ? "✓" : "✕"} Performer release
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ marginBottom: 0, color: "var(--text-muted)" }}>
                      Save this video as a draft with its production links to generate the
                      server-side performer checklist.
                    </p>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                      marginTop: "16px",
                    }}
                  >
                    {editingComplianceProductionId && (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={productionComplianceCheckLoading}
                        onClick={() =>
                          void refreshProductionComplianceCheck(
                            editingComplianceProductionId
                          )
                        }
                      >
                        Refresh Checklist
                      </button>
                    )}

                    {editingComplianceProductionId &&
                      productionComplianceCheck?.complianceStatus !== "complete" && (
                        <button
                          type="button"
                          className="primary-button"
                          disabled={
                            productionComplianceApprovalBusy ||
                            !productionComplianceCheck?.recordsReady ||
                            !selectedPerformersAgeReady
                          }
                          onClick={() => void markProductionComplianceComplete()}
                        >
                          {productionComplianceApprovalBusy
                            ? "Checking…"
                            : "Mark Compliance Complete"}
                        </button>
                      )}
                  </div>
                </div>

                {productionComplianceError && (
                  <p style={{ color: "#ff7777" }}>{productionComplianceError}</p>
                )}
                {productionComplianceMessage && (
                  <p style={{ color: "#fff" }}>{productionComplianceMessage}</p>
                )}
              </div>

              <div style={uploadBoxStyle}>
                <span className="section-kicker">VIDEO PERMISSION</span>
                <h3>Access Level</h3>
                <select
                  value={form.accessTier}
                  onChange={(e) =>
                    updateForm("accessTier", e.target.value as VideoAccessTier)
                  }
                  style={{ ...fieldStyle, background: "#151515", color: "#fff" }}
                >
                  <option value="monthly_only">Full Membership Only</option>
                  <option value="day_and_monthly">2-Day Pass + Full Membership</option>
                </select>
                <p style={{ color: "var(--text-muted)" }}>
                  {form.accessTier === "monthly_only"
                    ? "Only full-membership customers can watch this title."
                    : "Both 2-Day promotional-pass and full-membership customers can watch this title."}
                </p>
              </div>

              <div style={uploadBoxStyle}>
                <span className="section-kicker">DISPLAY & PUBLISHING</span>
                <div
                  style={{
                    display: "flex",
                    gap: "26px",
                    flexWrap: "wrap",
                    marginTop: "14px",
                  }}
                >
                  <label style={{ display: "flex", gap: "9px", alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={form.isFeatured}
                      onChange={(e) => updateForm("isFeatured", e.target.checked)}
                    />{" "}
                    Featured
                  </label>
                  <label style={{ display: "flex", gap: "9px", alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={form.isPublished}
                      disabled={!form.isPublished && !compliancePublishReady}
                      onChange={(e) => {
                        if (e.target.checked && !compliancePublishReady) {
                          setErrorMessage(
                            "Publishing is locked until compliance is COMPLETE and the server checklist is ready."
                          );
                          return;
                        }
                        updateForm("isPublished", e.target.checked);
                      }}
                    />{" "}
                    Publish immediately
                  </label>
                </div>
                <p
                  style={{
                    marginBottom: 0,
                    color: compliancePublishReady ? "#8ff0ad" : "var(--text-muted)",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  {compliancePublishReady
                    ? "Compliance is complete. Publishing is unlocked."
                    : "Publishing remains locked until the production record is saved, all required performer records are present, every performer was 18+ on the production date, and an admin marks compliance COMPLETE."}
                </p>
              </div>

              {uploadStatus && <p style={{ fontWeight: 700 }}>{uploadStatus}</p>}
              {saving && uploadProgress > 0 && uploadProgress < 100 && (
                <div
                  aria-label={`Upload ${uploadProgress}% complete`}
                  style={{
                    height: "10px",
                    overflow: "hidden",
                    borderRadius: "999px",
                    background: "#222",
                  }}
                >
                  <div
                    style={{
                      width: `${uploadProgress}%`,
                      height: "100%",
                      background: "#fff",
                      transition: "width 180ms ease",
                    }}
                  />
                </div>
              )}
              {errorMessage && <p style={{ color: "#ff7777" }}>{errorMessage}</p>}
              {message && <p>{message}</p>}

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving
                    ? "Uploading / Saving…"
                    : editingVideo
                      ? "Save Changes"
                      : "Upload to Bunny & Save Draft"}
                </button>
                {editingVideo && (
                  <button type="button" className="secondary-button" onClick={resetForm}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="section-heading">
            <div>
              <span className="section-kicker">CATALOG + PUBLIC POSTERS</span>
              <h2>Studio Videos</h2>
              <p style={{ color: "var(--text-muted)", lineHeight: 1.55, marginBottom: 0 }}>
                Edit a video's thumbnail to change its poster. Use “Show as Public Poster”
                to display that artwork on the public homepage without exposing the member
                video library.
              </p>
            </div>
          </div>

          {loading ? (
            <p>Loading catalog…</p>
          ) : videos.length === 0 ? (
            <p>No catalog videos yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {videos.map((video) => (
                <article
                  key={video.id}
                  style={{
                    padding: "22px",
                    border: "1px solid var(--border)",
                    borderRadius: "16px",
                    background: "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0,1fr) auto",
                      gap: "20px",
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <span className="section-kicker">
                          {video.is_published ? "PUBLISHED" : "DRAFT"}
                        </span>
                        {video.is_featured && (
                          <span className="section-kicker">PUBLIC POSTER</span>
                        )}
                      </div>
                      <h3>{video.title}</h3>
                      <p>{video.subtitle ?? "No subtitle"}</p>
                      <p>
                        {video.performer ? `Performer: ${video.performer} • ` : ""}
                        {video.category ?? "Uncategorized"} • {formatDuration(video.duration_seconds)}
                      </p>
                      <p>
                        <strong>Access:</strong> {accessTierLabel(video.access_tier)}
                      </p>
                      <p>
                        <strong>Public page:</strong> {window.location.origin}/video/{video.slug}
                      </p>
                      <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                        <strong>Bunny Stream:</strong>{" "}
                        {video.bunny_video_id
                          ? `${video.bunny_status ?? "connected"} • ${video.bunny_video_id}`
                          : "Not connected"}
                      </p>
                    </div>
                    {video.thumbnail_url && (
                      <img
                        src={video.thumbnail_url}
                        alt=""
                        style={{
                          width: "160px",
                          height: "100px",
                          objectFit: "cover",
                          borderRadius: "10px",
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                      marginTop: "16px",
                    }}
                  >
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => startEdit(video)}
                    >
                      Edit
                    </button>
                    {video.is_published && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => onViewVideo(video.slug)}
                      >
                        View Page
                      </button>
                    )}
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void togglePublished(video)}
                    >
                      {video.is_published ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void toggleFeatured(video)}
                    >
                      {video.is_featured ? "Remove Public Poster" : "Show as Public Poster"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void deleteVideo(video)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   HEADER
   ========================================================= */

type SiteHeaderProps = {
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (value: boolean) => void;
  searchValue: string;
  setSearchValue: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onHome: () => void;
  onApply: () => void;
  activeNav: HeaderNavTab;
  onActiveNavChange: (tab: HeaderNavTab) => void;
  onLegal: (page: LegalPageKey) => void;
  onSubscribe: () => void;
  onMemberLogin: () => void;
  session: Session | null;
  profile: Profile | null;
  onAccount: () => void;
  onLogout: () => void;
  membership: MembershipState;
  accessActive: boolean;
};

function SiteHeader({
  menuOpen,
  setMenuOpen,
  searchOpen,
  setSearchOpen,
  searchValue,
  setSearchValue,
  onSearch,
  onHome,
  onApply,
  activeNav,
  onActiveNavChange,
  onLegal,
  onSubscribe,
  onMemberLogin,
  session,
  profile,
  onAccount,
  onLogout,
  membership,
  accessActive,
}: SiteHeaderProps) {
  const membershipLabel =
    accessActive && membership.level !== "none"
      ? PLAN_LABELS[membership.level as PaidPlan]
      : "Join VIP";

  const closeMenu = () => setMenuOpen(false);

  const desktopNavButtonClass = (tab: HeaderNavTab) =>
    activeNav === tab ? "is-active" : "";

  const openVideos = () => {
    closeMenu();

    if (!accessActive && !profile?.is_admin) {
      onSubscribe();
      onActiveNavChange("plans");
      return;
    }

    onHome();

    window.setTimeout(() => {
      onActiveNavChange("videos");

      document.getElementById("member-videos")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const openModels = () => {
    closeMenu();

    onHome();

    window.setTimeout(() => {
      onActiveNavChange("performers");

      document.getElementById("public-performers")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  return (
    <header className="site-header">
      <div className="header-inner">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? "×" : "☰"}
        </button>

   <button
  type="button"
  className="brand"
  onClick={() => {
    closeMenu();
    onActiveNavChange("home");
    onHome();
  }}
>
  <div className="brand-lockup">
    <img
      src={spikeydeeVipLogo}
      alt="Spikeydee VIP"
      className="brand-logo-image"
    />

    <div className="brand-studio-line">
      <span>A</span>
      <strong>BIMBOY</strong>
      <span>STUDIO</span>
    </div>
  </div>
</button>    
<nav className="desktop-nav" aria-label="Desktop navigation">
  <button
    type="button"
    aria-current={activeNav === "home" ? "page" : undefined}
    className={desktopNavButtonClass("home")}
    onClick={() => {
      closeMenu();
      onActiveNavChange("home");
      onHome();
    }}
  >
    HOME
  </button>

  <button
    type="button"
    aria-current={activeNav === "videos" ? "page" : undefined}
    className={desktopNavButtonClass("videos")}
    onClick={openVideos}
  >
    VIDEOS
  </button>

  <button
    type="button"
    aria-current={activeNav === "performers" ? "page" : undefined}
    className={desktopNavButtonClass("performers")}
    onClick={openModels}
  >
    PERFORMERS
  </button>

  <button
    type="button"
    aria-current={activeNav === "apply" ? "page" : undefined}
    className={desktopNavButtonClass("apply")}
    onClick={() => {
      closeMenu();
      onActiveNavChange("apply");
      onApply();
    }}
  >
    APPLY
  </button>

  <button
    type="button"
    aria-current={activeNav === "plans" ? "page" : undefined}
    className={desktopNavButtonClass("plans")}
    onClick={() => {
      closeMenu();
      onSubscribe();

      window.setTimeout(() => {
        onActiveNavChange("plans");
      }, 0);
    }}
  >
    PLANS
  </button>
</nav>
<div className="header-actions">
  {(accessActive || profile?.is_admin) && (
    <button
      type="button"
      className="search-button"
      onClick={() => setSearchOpen(!searchOpen)}
      aria-label="Search videos"
    >
      ⌕
    </button>
  )}

  <button
    type="button"
    className="signup-button"
    onClick={session ? onAccount : onSubscribe}
    title={session && accessActive ? membershipLabel : undefined}
    style={{
      width: "156px",
      height: "50px",
      flexShrink: 0,
      whiteSpace: "nowrap",
    }}
  >
    {session ? "ACCOUNT" : "JOIN VIP"}
  </button>

  {!session && (
    <button
      type="button"
      className="secondary-button"
      onClick={onMemberLogin}
      style={{
        width: "156px",
        height: "50px",
        flexShrink: 0,
        whiteSpace: "nowrap",
        padding: "0 12px",
        fontSize: "13px",
        fontWeight: 800,
        letterSpacing: ".04em",
        color: "var(--gold-2)",
        borderColor: "var(--gold-2)",
      }}
    >
      MEMBER LOGIN
    </button>
  )}
</div>
      </div>

      {menuOpen && (
        <nav
          aria-label="Main navigation"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1100,
            padding: "20px clamp(20px, 4vw, 56px) 26px",
            borderTop: "1px solid rgba(255,255,255,.08)",
            borderBottom: "1px solid rgba(255,255,255,.12)",
            background: "rgba(3,3,3,.98)",
            boxShadow: "0 26px 70px rgba(0,0,0,.72)",
            backdropFilter: "blur(18px)",
          }}
        >
          <div
            style={{
              width: "min(1180px, 100%)",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: "10px",
            }}
          >
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                closeMenu();
                onHome();
              }}
              style={{
  minHeight: "54px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
}}
            >
              HOME
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={openModels}
              style={{
  minHeight: "54px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
}}
            >
              MODELS
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                closeMenu();
                onApply();
              }}
              style={{
                minHeight: "54px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              APPLY TO MODEL
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={openVideos}
              style={{
  minHeight: "54px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
}}
            >
              VIDEOS
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={() => {
                closeMenu();
                if (session) {
                  onAccount();
                } else {
                  onSubscribe();
                }
              }}
              style={{
  minHeight: "54px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
}}
            >
              {session ? "ACCOUNT" : "JOIN / UNLOCK VIP"}
            </button>

            {!session && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  closeMenu();
                  onMemberLogin();
                }}
                style={{ minHeight: "54px" }}
              >
                MEMBER LOGIN
              </button>
            )}
          </div>

          <div
            style={{
              width: "min(1180px, 100%)",
              margin: "16px auto 0",
              display: "flex",
              gap: "18px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="view-all"
              onClick={() => {
                closeMenu();
                onLegal("terms");
              }}
            >
              Terms
            </button>

            <button
              type="button"
              className="view-all"
              onClick={() => {
                closeMenu();
                onLegal("privacy");
              }}
            >
              Privacy
            </button>

            {session && (
              <button
                type="button"
                className="view-all"
                onClick={() => {
                  closeMenu();
                  onLogout();
                }}
              >
                Log Out
              </button>
            )}
          </div>
        </nav>
      )}

      {(accessActive || profile?.is_admin) && searchOpen && (
        <form className="search-panel" onSubmit={onSearch}>
          <input
            autoFocus
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search Spikeydeevip..."
          />
          <button type="submit">Search</button>
        </form>
      )}
    </header>
  );
}

/* =========================================================
   18+ AGE GATE
   ========================================================= */

type AgeGateProps = {
  onConfirm: () => void;
};

function AgeGate({ onConfirm }: AgeGateProps) {
  const leaveSite = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = "about:blank";
  };

  return (
    <div
      className="age-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
    >
      <section className="age-gate-inner">
        <div className="age-gate-brand">
          <span>SPIKEYDEE</span>
          <strong>VIP</strong>
        </div>

        <h1 id="age-gate-title">ADULTS ONLY — 18+</h1>

        <p className="age-gate-lead">
          This website contains sexually explicit material intended only for adults.
        </p>

        <p className="age-gate-copy">
          By entering Spikeydee VIP, you confirm that you are at least 18 years old
          and have reached the age of majority required to view adult content in the
          jurisdiction where you are located.
        </p>

        <p className="age-gate-copy">
          You also confirm that accessing sexually explicit material is lawful where
          you are located.
        </p>

        <div className="age-gate-confirmation">
          <h2>
            BY SELECTING “I AM 18+ — ENTER,” YOU CONFIRM THAT:
          </h2>

          <ul>
            <li>
              You are at least 18 years old and meet the applicable age-of-majority
              requirements in your jurisdiction.
            </li>

            <li>
              You are legally permitted to access sexually explicit adult material.
            </li>

            <li>
              You understand that this website contains explicit adult content.
            </li>

            <li>
              You agree to the Spikeydee VIP Terms of Service and Privacy Policy.
            </li>

            <li>
              If you are under 18 or otherwise prohibited from viewing this material,
              you must leave this website immediately.
            </li>
          </ul>
        </div>

        <div className="age-gate-actions">
          <button
            type="button"
            className="age-gate-enter"
            onClick={onConfirm}
          >
            I AM 18+ — ENTER
          </button>

          <button
            type="button"
            className="age-gate-exit"
            onClick={leaveSite}
          >
            EXIT SITE
          </button>
        </div>

        <p className="age-gate-fine-print">
          Adults only. By entering, you acknowledge that you meet all applicable
          age and legal requirements for accessing this website.
        </p>
      </section>
    </div>
  );
}
/* =========================================================
   PUBLIC LEGAL / COMPLIANCE PAGES
   ========================================================= */

type LegalPageProps = {
  page: LegalPageKey;
  onBack: () => void;
  onLegal: (page: LegalPageKey) => void;
};

type LegalSection = {
  heading: string;
  body: ReactNode;
};

type LegalPageContent = {
  title: string;
  kicker: string;
  intro: string;
  sections: LegalSection[];
};

const legalNavigation: Array<{
  key: LegalPageKey;
  label: string;
}> = [
  { key: "terms", label: "Terms" },
  { key: "privacy", label: "Privacy" },
  { key: "2257", label: "2257" },
  { key: "content-removal", label: "Content Removal" },
  { key: "billing", label: "Billing & Refunds" },
  { key: "support", label: "Support" },
];

const legalCopy: Record<LegalPageKey, LegalPageContent> = {
  terms: {
    title: "Terms of Service",
    kicker: "LEGAL",
    intro:
      "These Terms of Service govern access to and use of Spikeydee VIP and its membership services.",
    sections: [
      {
        heading: "Adults Only",
        body: (
          <p>
            {BUSINESS_NAME} is intended only for adults. You must be at least 18
            years old, or the age of majority where you live if that age is
            higher, to enter or use the service.
          </p>
        ),
      },
      {
        heading: "Access Plans",
        body: (
          <div>
            <p>
              Spikeydee VIP currently offers the following membership options.
              Individual videos are not sold separately.
            </p>
            <p>
              <strong>Bimboy All Access — 1 Year:</strong> $365.00 for 365 days
              of access to Bimboy and SpikeyDeeVIP. This membership becomes
              available beginning October 10, 2026.
            </p>
            <p>
              <strong>30 Day Membership:</strong> {THIRTY_DAY_PRICE} for the
              first 30 days, then automatically renews at {TWO_DAY_RENEWAL_PRICE}
              every 30 days until cancelled.
            </p>
            <p>
              <strong>2 Day Pass:</strong> {TWO_DAY_PRICE} for the first 2 days,
              then automatically renews at {TWO_DAY_RENEWAL_PRICE} every 30 days
              until cancelled.
            </p>
          </div>
        ),
      },
      {
        heading: "Permitted Use",
        body: (
          <p>
            Paid access is for the purchaser's personal viewing only. Protected
            content may not be redistributed, resold, recorded, copied,
            republished, scraped, publicly displayed, or shared in violation of
            applicable law or the rights of the studio and performers.
          </p>
        ),
      },
      {
        heading: "Account and Studio Access",
        body: (
          <p>
            Public viewers do not receive studio publishing privileges.
            Administrative tools are reserved for authorized administrators.
            Attempts to bypass access controls or use another person's
            credentials may result in access being blocked or terminated.
          </p>
        ),
      },
      {
        heading: "Changes and Availability",
        body: (
          <p>
            The catalog, access tiers, features, and availability of content may
            change. Applicable billing terms are presented before purchase.
          </p>
        ),
      },
    ],
  },

  privacy: {
    title: "Privacy Policy",
    kicker: "PRIVACY",
    intro:
      "This Privacy Policy explains how Spikeydee VIP handles information used to provide, secure, support, and bill for the service.",
    sections: [
      {
        heading: "Information We Collect",
        body: (
          <p>
            We may collect account and contact information, membership and access
            information, support communications, device and browser information,
            and information reasonably necessary to operate and secure the
            service.
          </p>
        ),
      },
      {
        heading: "Cookies and Browser Storage",
        body: (
          <p>
            Spikeydee VIP uses cookies and browser storage for functions such as
            age-gate confirmation, session continuity, preferences, and
            access-related functionality.
          </p>
        ),
      },
      {
        heading: "Payments",
        body: (
          <p>
            Payments are processed through CCBill. Payment-card information is
            entered through the payment processor's checkout rather than stored
            as full card numbers or card-security codes by Spikeydee VIP.
          </p>
        ),
      },
      {
        heading: "Service Providers",
        body: (
          <p>
            We use service providers to operate portions of the website,
            including payment processing, application infrastructure, hosting,
            and video delivery. Information may be provided to those services
            only as reasonably necessary to perform their functions or comply
            with law.
          </p>
        ),
      },
      {
        heading: "Privacy Requests",
        body: (
          <p>
            Questions or privacy-related requests may be sent to{" "}
            <strong>{SUPPORT_EMAIL}</strong>. Requests are reviewed and handled
            in accordance with applicable law.
          </p>
        ),
      },
    ],
  },

  "2257": {
    title: "18 U.S.C. § 2257 Record-Keeping Requirements Compliance Statement",
    kicker: "RECORDKEEPING",
    intro:
      "Spikeydee VIP maintains records as required by 18 U.S.C. §§ 2257 and 2257A and applicable provisions of 28 C.F.R. Part 75 for visual depictions subject to those requirements.",
    sections: [
      {
        heading: "Age Verification",
        body: (
          <div>
            <p>
              All performers appearing in visual depictions of actual sexually
              explicit conduct produced by Spikeydee VIP were 18 years of age
              or older at the time of production.
            </p>
            <p>
              Performer age and identity documentation for covered productions
              is obtained and maintained in accordance with applicable federal
              record-keeping requirements.
            </p>
          </div>
        ),
      },
      {
        heading: "Custodian of Records",
        body: (
          <div>
            <p>
              Records required pursuant to 18 U.S.C. § 2257 and applicable
              provisions of 28 C.F.R. Part 75 are maintained by:
            </p>
            <p>
              <strong>{RECORDS_CUSTODIAN_NAME}</strong>
              <br />
              Custodian of Records
              <br />
              Spikeydee VIP
              <br />
              {RECORDS_CUSTODIAN_ADDRESS}
            </p>
          </div>
        ),
      },
      {
        heading: "Record-Keeping",
        body: (
          <p>
            Required age and identity records for performers appearing in
            covered productions are maintained by the Custodian of Records at
            the location identified above and are available for inspection as
            required by applicable law.
          </p>
        ),
      },
      {
        heading: "Adults Only",
        body: <p>Spikeydee VIP is intended only for adults age 18 or older.</p>,
      },
    ],
  },

  "content-removal": {
    title: "Content Removal, Complaints & Appeals",
    kicker: "SAFETY & COMPLIANCE",
    intro:
      "Spikeydee VIP accepts reports concerning content that may be illegal, non-consensual, unauthorized, incorrectly identified, or otherwise in violation of our standards.",
    sections: [
      {
        heading: "Anti-Human Trafficking Policy",
        body: (
          <div>
            <p>
              Spikeydee VIP does not condone, permit, or tolerate human sex
              trafficking, sexual exploitation, or forced participation in any
              content or activity.
            </p>
            <p>
              Any instance of suspected human trafficking identified or reported
              to Spikeydee VIP will be reported to the appropriate authorities
              as required by applicable law.
            </p>
          </div>
        ),
      },
      {
        heading: "How to Submit a Complaint or Takedown Request",
        body: (
          <div>
            <p>
              Any person may report content that may be illegal or that otherwise
              violates our standards. Reports may be sent to{" "}
              <strong>{COMPLAINTS_EMAIL}</strong>. Include the video title or
              page URL, the reason for the complaint, and enough information for
              us to identify the material.
            </p>
            <p>
              You may also submit a complaint or takedown request through the{" "}
              <a href={CCBILL_COMPLAINT_FORM} rel="nofollow noreferrer" target="_blank">
                CCBill complaints/takedown request form
              </a>.
            </p>
          </div>
        ),
      },
      {
        heading: "Review and Resolution",
        body: (
          <div>
            <p>
              All reported complaints are reviewed and resolved within five
              business days. We evaluate the reported material, the reason for
              the complaint, available records, consent documentation where
              relevant, and any other information reasonably necessary to reach
              a decision.
            </p>
            <p>
              Content may be temporarily restricted or removed while a review is
              pending when appropriate for safety, legal compliance, or
              preservation of relevant records.
            </p>
          </div>
        ),
      },
      {
        heading: "Potential Outcomes",
        body: (
          <p>
            A review may result in removal or disabling of content, temporary
            restriction while additional information is obtained, correction of
            information associated with content, restoration or retention of
            content when the complaint is not substantiated, account or access
            restrictions where appropriate, preservation of relevant records,
            or referral to law enforcement or other appropriate authorities when
            required.
          </p>
        ),
      },
      {
        heading: "Appeal Procedure for Depicted Persons",
        body: (
          <div>
            <p>
              Any person depicted in content may appeal a decision and request
              removal by contacting <strong>{COMPLAINTS_EMAIL}</strong>. The
              appeal should identify the content and explain the basis for the
              request, including any claim that consent was not given, was
              withdrawn where legally effective, or is void under applicable
              law.
            </p>
            <p>
              The appeal will be reviewed using available identity, age, consent,
              production, and other relevant records. If the investigation
              determines that consent was not given or is void under applicable
              law, the content will be removed.
            </p>
          </div>
        ),
      },
      {
        heading: "Disagreement Regarding an Appeal",
        body: (
          <p>
            If a depicted person disagrees with the outcome of an appeal, the
            disagreement may be submitted to a neutral body for resolution at
            Spikeydee VIP's expense. Spikeydee VIP will cooperate with the
            neutral review and implement the resulting determination as required.
          </p>
        ),
      },
      {
        heading: "Urgent Safety or Illegal Content",
        body: (
          <p>
            Reports involving suspected trafficking, child sexual abuse
            material, non-consensual intimate imagery, exploitation, or other
            serious illegal conduct receive priority review and may be reported
            to the appropriate authorities as required by law.
          </p>
        ),
      },
      {
        heading: "Copyright Complaints",
        body: (
          <p>
            Copyright or intellectual-property complaints may be sent to{" "}
            <strong>{COMPLAINTS_EMAIL}</strong>. Please identify the copyrighted
            work, the material claimed to infringe, where the material appears,
            your contact information, and the basis for your claim so the matter
            can be reviewed.
          </p>
        ),
      },
    ],
  },

  billing: {
    title: "Billing, Cancellation & Refunds",
    kicker: "BILLING",
    intro:
      "This page explains the membership prices, recurring billing terms, cancellation options, and billing-support information for Spikeydee VIP.",
    sections: [
      {
        heading: "Bimboy All Access — 1 Year — $365.00",
        body: (
          <p>
            Bimboy All Access is $365.00 for 365 days of access to Bimboy and
            SpikeyDeeVIP. This membership becomes available beginning October 10,
            2026 and is not available for purchase before the launch date.
          </p>
        ),
      },
      {
        heading: `30 Day Membership — ${THIRTY_DAY_PRICE} introductory price`,
        body: (
          <p>
            The 30 Day Membership is {THIRTY_DAY_PRICE} for the first 30 days.
            After the first 30 days, it automatically renews at
            {TWO_DAY_RENEWAL_PRICE} every 30 days until cancelled and provides
            full premium catalog access while active.
          </p>
        ),
      },
      {
        heading: `2 Day Pass — ${TWO_DAY_PRICE} introductory price`,
        body: (
          <p>
            The promotional 2 Day Pass is {TWO_DAY_PRICE} for the first 2 days.
            After the promotional period, it automatically renews at
            {TWO_DAY_RENEWAL_PRICE} every 30 days until cancelled. During the
            initial 2-day period, access is limited to videos assigned to the
            promotional-access tier.
          </p>
        ),
      },
      {
        heading: "Recurring Billing and Cancellation",
        body: (
          <p>
            Recurring memberships continue at the price and interval disclosed
            at checkout until cancelled. For cancellation or billing assistance,
            contact CCBill Consumer Support at{" "}
            <strong>{BILLING_SUPPORT_PHONE}</strong> or{" "}
            <strong>{BILLING_SUPPORT_EMAIL}</strong>. Cancellation stops future
            recurring charges subject to the terms presented at checkout.
          </p>
        ),
      },
      {
        heading: "Refunds and Billing Questions",
        body: (
          <p>
            Refund and billing requests, including questions concerning duplicate
            charges or access problems, are reviewed based on the circumstances
            of the transaction and applicable CCBill terms. Contact CCBill
            Consumer Support at <strong>{BILLING_SUPPORT_PHONE}</strong> or{" "}
            <strong>{BILLING_SUPPORT_EMAIL}</strong> for billing assistance.
          </p>
        ),
      },
    ],
  },

  support: {
    title: "Contact Us & Support",
    kicker: "HELP",
    intro:
      "Contact Spikeydee VIP for general support, account questions, content complaints, or assistance locating CCBill billing support.",
    sections: [
      {
        heading: "Business Contact",
        body: (
          <div>
            <p><strong>{BUSINESS_NAME}</strong></p>
            <p>Principal: <strong>{BUSINESS_PRINCIPAL}</strong></p>
            <p>
              {BUSINESS_CITY}, {BUSINESS_STATE}
              <br />
              {BUSINESS_COUNTRY}
            </p>
            <p>
              Email: <strong>{SUPPORT_EMAIL}</strong>
            </p>
          </div>
        ),
      },
      {
        heading: "Billing Support",
        body: (
          <p>
            CCBill Consumer Support
            <br />
            Phone: <strong>{BILLING_SUPPORT_PHONE}</strong>
            <br />
            Email: <strong>{BILLING_SUPPORT_EMAIL}</strong>
          </p>
        ),
      },
      {
        heading: "Content Complaints",
        body: (
          <p>
            Email: <strong>{COMPLAINTS_EMAIL}</strong>
            <br />
            Complaints, takedown requests, and appeals are handled under our
            Content Removal, Complaints & Appeals Policy.
          </p>
        ),
      },
    ],
  },
};

function LegalPage({ page, onBack, onLegal }: LegalPageProps) {
  const content = legalCopy[page];

  return (
    <main>
      <div className="content-wrapper">
        <section
          className="content-section"
          style={{
            paddingTop: "70px",
            paddingBottom: "90px",
          }}
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">{content.kicker}</span>
              <h2>{content.title}</h2>
            </div>

            <button type="button" className="view-all" onClick={onBack}>
              Back to Site
            </button>
          </div>

          <nav
            aria-label="Legal pages"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "22px",
            }}
          >
            {legalNavigation.map((item) => (
              <button
                key={item.key}
                type="button"
                className={item.key === page ? "primary-button" : "secondary-button"}
                onClick={() => onLegal(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <article
            style={{
              maxWidth: "960px",
              padding: "30px",
              border: "1px solid var(--border)",
              borderRadius: "18px",
              background: "var(--surface)",
              lineHeight: 1.8,
            }}
          >
            <p
              style={{
                marginTop: 0,
                color: "var(--text-muted)",
                fontSize: "16px",
              }}
            >
              {content.intro}
            </p>

            <div style={{ display: "grid", gap: "26px", marginTop: "28px" }}>
              {content.sections.map((section) => (
                <section key={section.heading}>
                  <h3 style={{ marginBottom: "8px" }}>{section.heading}</h3>
                  <div style={{ color: "var(--text-muted)" }}>{section.body}</div>
                </section>
              ))}
            </div>

            <div
              style={{
                marginTop: "32px",
                paddingTop: "20px",
                borderTop: "1px solid var(--border)",
                color: "var(--text-muted)",
                fontSize: "12px",
              }}
            >
              Development compliance copy. Final production language should match
              the studio's actual business practices, vendors, records, and
              processor requirements.
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   FOOTER
   ========================================================= */
type SiteFooterProps = {
  onLegal: (page: LegalPageKey) => void;
};

function SiteFooter({ onLegal }: SiteFooterProps) {
  return (
    <footer className="site-footer site-footer-premium">
      <div className="footer-inner">

        <div className="footer-brand-premium">
          <span>SPIKEYDEE</span>
          <strong>VIP</strong>
        </div>

        <nav
          className="footer-legal-grid"
          aria-label="Legal and support links"
        >
          <button
            type="button"
            onClick={() => onLegal("2257")}
          >
            2257
          </button>

          <button
            type="button"
            onClick={() => onLegal("terms")}
          >
            TERMS
          </button>

          <button
            type="button"
            onClick={() => onLegal("privacy")}
          >
            PRIVACY POLICY
          </button>

          <button
            type="button"
            onClick={() => onLegal("billing")}
          >
            REFUND POLICY
          </button>

          <button
            type="button"
            onClick={() => onLegal("support")}
          >
            F.A.Q.'S
          </button>

          <button
            type="button"
            onClick={() => onLegal("support")}
          >
            HELP
          </button>

          <button
            type="button"
            onClick={() => onLegal("support")}
          >
            CUSTOMER SERVICE
          </button>

          <button
            type="button"
            onClick={() => onLegal("billing")}
          >
            BILLING SUPPORT
          </button>

          <button
            type="button"
            onClick={() => onLegal("content-removal")}
          >
            CONTENT REMOVAL
          </button>

          <button
            type="button"
            onClick={() => onLegal("content-removal")}
          >
            COMPLAINTS
          </button>

          <button
            type="button"
            onClick={() => onLegal("content-removal")}
          >
            DMCA
          </button>

          <button
            type="button"
            onClick={() => onLegal("content-removal")}
          >
            TRUST &amp; SAFETY
          </button>

          <button
            type="button"
            onClick={() => onLegal("support")}
          >
            WEBMASTER
          </button>
        </nav>

        <div className="footer-compliance-copy">

          <p>
            For billing inquiries, membership cancellation,
            or account support, please visit our{" "}
            <button
              type="button"
              onClick={() => onLegal("billing")}
            >
              billing support page
            </button>
            .
          </p>

          <p>
            All performers appearing in content available
            through Spikeydee VIP are adults age 18 or older.
          </p>

          <p>
            By accessing Spikeydee VIP, you confirm your
            agreement to our{" "}
            <button
              type="button"
              onClick={() => onLegal("terms")}
            >
              Terms of Service
            </button>
            ,{" "}
            <button
              type="button"
              onClick={() => onLegal("privacy")}
            >
              Privacy Policy
            </button>{" "}
            and applicable site policies.
          </p>

          <p>
            <button
              type="button"
              onClick={() => onLegal("2257")}
            >
              Click here for records required pursuant to
              18 U.S.C. § 2257 Record-Keeping Requirements
              Compliance Statement.
            </button>
          </p>

        </div>

        <div className="footer-copyright">
          Copyright © 2026{" "}
          <strong>Spikeydee VIP.</strong>{" "}
          ALL RIGHTS RESERVED
        </div>

        <div className="footer-rta">
          <img
            src="/rta-logo.png"
            alt="RTA Restricted to Adults"
          />

          <span>
            RESTRICTED TO ADULTS 18+
          </span>
        </div>

      </div>
    </footer>
  );
}
/* =========================================================
   APP
   ========================================================= */

function MainApp() {
  const [activeNav, setActiveNav] =
    useState<HeaderNavTab>("home");

  const [legalPage, setLegalPage] =
    useState<LegalPageKey>("terms");

  const [
    menuOpen,
    setMenuOpen,
  ] =
    useState(
      false
    );

  const [
    searchOpen,
    setSearchOpen,
  ] =
    useState(
      false
    );

  const [
    searchValue,
    setSearchValue,
  ] =
    useState(
      ""
    );

  const [
    activeSearch,
    setActiveSearch,
  ] =
    useState(
      ""
    );

  const [
    selectedItem,
    setSelectedItem,
  ] =
    useState<ContentItem | null>(
      null
    );

  const [
    viewMode,
    setViewMode,
  ] =
    useState<ViewMode>(
      "home"
    );

  const [
    session,
    setSession,
  ] =
    useState<Session | null>(
      null
    );

  const [
    profile,
    setProfile,
  ] =
    useState<Profile | null>(
      null
    );

  const [
    profileLoading,
    setProfileLoading,
  ] =
    useState(
      false
    );

  const [
    authOpen,
    setAuthOpen,
  ] =
    useState(
      false
    );

  const [
    passwordResetOpen,
    setPasswordResetOpen,
  ] =
    useState(
      false
    );

  const [
    checkoutReturnOpen,
    setCheckoutReturnOpen,
  ] =
    useState(
      false
    );

  const [
    checkoutReturnId,
    setCheckoutReturnId,
  ] =
    useState<string | null>(
      null
    );

  const [
    accessOpen,
    setAccessOpen,
  ] =
    useState(
      false
    );

  const [
    membership,
    setMembership,
  ] =
    useState<MembershipState>(
      loadStoredMembership
    );
const [publicHeroSettings, setPublicHeroSettings] = useState<{
  featured_video_id: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_description: string | null;
  teaser_start_seconds: number;
  teaser_end_seconds: number | null;
  autoplay: boolean;
  loop_teaser: boolean;
}>({
  featured_video_id: null,
  hero_title: "Featured Release",
  hero_subtitle: "SPIKEYDEE VIP ORIGINAL",
  hero_description: "Watch the latest featured release from Spikeydee VIP.",
  teaser_start_seconds: 0,
  teaser_end_seconds: null,
  autoplay: true,
  loop_teaser: true,
});

const [, setPublicHeroLoading] = useState(false);
const [homepageBanners, setHomepageBanners] = useState<HomepageBanner[]>([]);
const [homepageBrands, setHomepageBrands] = useState<HomepageBrand[]>([]);
const [homepageTiles, setHomepageTiles] = useState<HomepageTile[]>([]);
const [homepagePerformers, setHomepagePerformers] = useState<HomepagePerformer[]>([]);
const [activeBannerIndex, setActiveBannerIndex] = useState(0);
const [, setActiveBrandStartIndex] = useState(0);
  const [
    favorites,
    setFavorites,
  ] =
    useState<string[]>(
      []
    );

  const [
    favoritesLoading,
    setFavoritesLoading,
  ] =
    useState(
      false
    );

  const [
    favoriteBusyIds,
    setFavoriteBusyIds,
  ] =
    useState<string[]>(
      []
    );

  const [
    publicVideos,
    setPublicVideos,
  ] =
    useState<VideoRecord[]>(
      []
    );

  const [
    catalogLoading,
    setCatalogLoading,
  ] =
    useState(
      true
    );

  /* =======================================================
     MEMBERSHIP STATE
     ======================================================= */

  const twoDayActive =
    membership.level === "two_day_pass" &&
    Boolean(membership.accessSessionId) &&
    (!membership.expiresAt || new Date(membership.expiresAt).getTime() > Date.now());

  const fullMembershipActive =
    ["thirty_day", "twelve_month", "lifetime"].includes(membership.level) &&
    Boolean(membership.accessSessionId) &&
    (!membership.expiresAt || new Date(membership.expiresAt).getTime() > Date.now());

  const accessActive = Boolean(session) && (twoDayActive || fullMembershipActive);

  const adminAccess = profile?.is_admin === true;

  /* =======================================================
     PRIVATE STUDIO AUTH ROUTES
     /studio-login and /studio-reset-password are intentionally
     not linked from public navigation. Supabase authentication
     remains the actual security layer.
     ======================================================= */

  useEffect(() => {
    const syncStudioAuthRoute = () => {
      const path = window.location.pathname;

      if (path === "/checkout/return") {
        setAuthOpen(false);
        setPasswordResetOpen(false);

        const urlCheckoutId =
          new URLSearchParams(window.location.search)
            .get("checkout_id");

        let storedCheckoutId: string | null = null;

        try {
          const stored = sessionStorage.getItem(
            PENDING_CHECKOUT_STORAGE_KEY
          );

          if (stored) {
            const parsed = JSON.parse(stored) as {
              checkoutId?: string;
            };

            storedCheckoutId =
              parsed.checkoutId ?? null;
          }
        } catch {
          storedCheckoutId = null;
        }

        setCheckoutReturnId(
          urlCheckoutId ?? storedCheckoutId
        );
        setCheckoutReturnOpen(true);
        return;
      }

      setCheckoutReturnOpen(false);

      if (path === "/studio") {
        setAuthOpen(false);
        setPasswordResetOpen(false);

        if (session && profile?.is_admin) {
          setViewMode("studio");
        }

        return;
      }

      if (path === "/apply") {
        setAuthOpen(false);
        setPasswordResetOpen(false);
        setViewMode("apply");
        return;
      }

      if (path === "/account") {
        setAuthOpen(false);
        setPasswordResetOpen(false);

        if (session) {
          setViewMode("account");
        }

        return;
      }

      if (path === "/studio-reset-password" || path === "/member-reset-password") {
        setAuthOpen(false);
        setPasswordResetOpen(true);
        return;
      }

      setPasswordResetOpen(false);

      if (path === "/studio-login" || path === "/member-login") {
        if (session) {
          setAuthOpen(false);
          setViewMode("account");
        } else {
          setAuthOpen(true);
        }
      }
    };

    syncStudioAuthRoute();

    window.addEventListener(
      "popstate",
      syncStudioAuthRoute
    );

    return () => {
      window.removeEventListener(
        "popstate",
        syncStudioAuthRoute
      );
    };
  }, [session, profile?.is_admin]);

  const closeStudioLogin = () => {
    setAuthOpen(false);

    if (
      window.location.pathname === "/studio-login" ||
      window.location.pathname === "/member-login"
    ) {
      window.history.replaceState(
        {},
        "",
        "/"
      );

      setViewMode("home");
    }
  };

  const returnToStudioLogin = () => {
    setPasswordResetOpen(false);
    setAuthOpen(true);

    window.history.replaceState(
      {},
      "",
      "/member-login"
    );

    setViewMode("home");
  };

  const closeCheckoutReturn = () => {
    setCheckoutReturnOpen(false);
    setCheckoutReturnId(null);

    if (
      window.location.pathname ===
      "/checkout/return"
    ) {
      window.history.replaceState(
        {},
        "",
        "/"
      );
    }

    setViewMode("home");
  };

  useEffect(() => {
    if (membership.level === "none") {
      localStorage.removeItem(MEMBERSHIP_STORAGE_KEY);
      return;
    }
    localStorage.setItem(MEMBERSHIP_STORAGE_KEY, JSON.stringify(membership));
  }, [membership]);

  useEffect(() => {
    if (
      membership.expiresAt &&
      new Date(membership.expiresAt).getTime() <= Date.now()
    ) {
      setMembership({
        level: "none",
        expiresAt: null,
        accessSessionId: null,
        customerEmail: membership.customerEmail,
      });
    }
  }, [membership]);

  const checkEmailForExistingMembership = async (
    email: string
  ): Promise<string | null> => {
    const normalizedEmail =
      email.trim().toLowerCase();

    const { data, error } =
      await supabase.functions.invoke(
        "ccbill-checkout-start",
        {
          body: {
            email: normalizedEmail,
            checkOnly: true,
          },
        }
      );

  if (error) {
  return "We couldn't verify this email right now. Please try again.";
}

    const result = data as {
      ok?: boolean;
      code?: string;
      message?: string;
    } | null;

    if (!result?.ok) {
      return (
        result?.message ??
        "We could not verify this email right now. Please try again."
      );
    }

    return null;
  };


  const beginCcbillCheckout = async (
    plan: PaidPlan,
    email: string
  ): Promise<string | null> => {
    const normalizedEmail =
      email.trim().toLowerCase();

    const { data, error } =
      await supabase.functions.invoke(
        "ccbill-checkout-start",
        {
          body: {
            plan,
            email: normalizedEmail,
          },
        }
      );

    if (error) {
      return (
        "Could not start CCBill checkout: " +
        error.message
      );
    }

    const result = data as {
      ok?: boolean;
      checkoutId?: string;
      checkoutUrl?: string;
      message?: string;
    } | null;

    if (
      !result?.ok ||
      !result.checkoutId ||
      !result.checkoutUrl
    ) {
      return (
        result?.message ??
        `CCBill checkout for ${PLAN_LABELS[plan]} is not configured yet.`
      );
    }

    sessionStorage.setItem(
      PENDING_CHECKOUT_STORAGE_KEY,
      JSON.stringify({
        checkoutId: result.checkoutId,
        plan,
        email: normalizedEmail,
        startedAt:
          new Date().toISOString(),
      })
    );

    window.location.assign(
      result.checkoutUrl
    );

    return null;
  };



  /* =======================================================
     PER-VIDEO AUTHORIZATION
     ======================================================= */

  const canWatchVideo = (
    item:
      ContentItem
  ) => {
    /*
      Studio admin can inspect all catalog content while
      developing/administering the site.
    */

    if (
      adminAccess
    ) {
      return true;
    }

    /*
      The browser only mirrors access for UX. The
      bunny-stream-playback Edge Function remains authoritative.
    */

    if (fullMembershipActive) return true;

    if (
      twoDayActive &&
      item.accessTier === "day_and_monthly"
    ) {
      return true;
    }

    return false;
  };

  /* =======================================================
     AUTH
     ======================================================= */

  useEffect(() => {
    const initialize =
      async () => {
        const {
          data,
        } =
          await supabase.auth
            .getSession();

        setSession(
          data.session
        );
      };

    void initialize();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth
        .onAuthStateChange(
          (
            event,
            nextSession
          ) => {
            setSession(
              nextSession
            );

            if (
              event === "PASSWORD_RECOVERY"
            ) {
              setAuthOpen(false);
              setPasswordResetOpen(true);

              if (
                window.location.pathname !== "/studio-reset-password" &&
                window.location.pathname !== "/member-reset-password"
              ) {
                window.history.replaceState(
                  {},
                  "",
                  "/member-reset-password"
                );
              }
            }

            if (
              !nextSession
            ) {
              setProfile(
                null
              );
            }
          }
        );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /* =======================================================
     PROFILE
     ======================================================= */

  useEffect(() => {
    const loadProfile =
      async () => {
        if (
          !session?.user.id
        ) {
          setProfile(
            null
          );

          return;
        }

        setProfileLoading(
          true
        );

        const {
          data,
          error,
        } =
          await supabase
            .from(
              "profiles"
            )
            .select(
              "id, display_name, avatar_url, is_admin, created_at, updated_at"
            )
            .eq(
              "id",
              session.user.id
            )
            .single();

        if (!error) {
          setProfile(
            data as Profile
          );
        }

        setProfileLoading(
          false
        );
      };

    void loadProfile();
  }, [
    session?.user.id,
  ]);

  /* =======================================================
     PUBLIC CATALOG
     ======================================================= */
const loadPublicHeroSettings = async () => {
  setPublicHeroLoading(true);

  const { data, error } = await supabase
    .from("site_settings")
    .select(
      `
        featured_video_id,
        hero_title,
        hero_subtitle,
        hero_description,
        teaser_start_seconds,
        teaser_end_seconds,
        autoplay,
        loop_teaser
      `
    )
    .eq("setting_key", "homepage_hero")
    .single();

  if (error) {
    console.error(
      "Could not load public homepage hero settings:",
      error
    );
    setPublicHeroLoading(false);
    return;
  }

  if (data) {
    setPublicHeroSettings({
      featured_video_id: data.featured_video_id,
      hero_title: data.hero_title,
      hero_subtitle: data.hero_subtitle,
      hero_description: data.hero_description,
      teaser_start_seconds: data.teaser_start_seconds ?? 0,
      teaser_end_seconds: data.teaser_end_seconds,
      autoplay: data.autoplay ?? true,
      loop_teaser: data.loop_teaser ?? true,
    });
  }

  setPublicHeroLoading(false);
};
  const loadPublicHomepageBanners = async () => {
    const { data, error } = await supabase
      .from("homepage_banners")
      .select("*")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Could not load public homepage banners:", error);
      setHomepageBanners([]);
      return;
    }

    setHomepageBanners((data ?? []) as HomepageBanner[]);
  };

  const loadPublicHomepageBrands = async () => {
    const { data, error } = await supabase
      .from("homepage_brands")
      .select("*")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Could not load public homepage brands:", error);
      setHomepageBrands([]);
      return;
    }

    setHomepageBrands((data ?? []) as HomepageBrand[]);
  };

  const loadPublicHomepageTiles = async () => {
    const { data, error } = await supabase
      .from("homepage_tiles")
      .select("*")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Could not load public homepage tiles:", error);
      setHomepageTiles([]);
      return;
    }

    setHomepageTiles((data ?? []) as HomepageTile[]);
  };

  const loadPublicHomepagePerformers = async () => {
    const { data, error } = await supabase
      .from("homepage_performers")
      .select("*")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });
    if (error) { console.error("Could not load public homepage performers:", error); setHomepagePerformers([]); return; }
    setHomepagePerformers((data ?? []) as HomepagePerformer[]);
  };

  const loadPublicCatalog =
    async () => {
      setCatalogLoading(
        true
      );

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "videos"
          )
          .select(
            `
              id,
              slug,
              title,
              subtitle,
              description,
              duration_seconds,
              category,
              performer,
              series,
              series_name,
              badge,
              thumbnail_url,
              preview_url,
              bunny_video_id,
              bunny_library_id,
              bunny_status,
              bunny_thumbnail_url,
              price_cents,
              currency,
              access_tier,
              is_published,
              is_featured,
              published_at,
              created_at,
              updated_at,
              created_by
            `
          )
          .eq(
            "is_published",
            true
          )
          .order(
            "published_at",
            {
              ascending:
                false,

              nullsFirst:
                false,
            }
          );

      if (!error) {
        setPublicVideos(
          (data ??
            []) as VideoRecord[]
        );
      } else {
        console.error(
          "Catalog error:",
          error.message
        );

        setPublicVideos(
          []
        );
      }

      setCatalogLoading(
        false
      );
    };

  useEffect(() => {
    void loadPublicCatalog();
    void loadPublicHeroSettings();
    void loadPublicHomepageBanners();
    void loadPublicHomepageBrands();
    void loadPublicHomepageTiles();
    void loadPublicHomepagePerformers();
  }, []);

  useEffect(() => {
    if (accessActive || adminAccess || homepageBanners.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveBannerIndex((current) =>
        (current + 1) % homepageBanners.length
      );
    }, 6000);

    return () => window.clearInterval(timer);
  }, [accessActive, adminAccess, homepageBanners.length]);

  useEffect(() => {
    if (activeBannerIndex >= homepageBanners.length) {
      setActiveBannerIndex(0);
    }
  }, [activeBannerIndex, homepageBanners.length]);

  useEffect(() => {
    const loadPaidMembership =
      async () => {
        if (!session?.user.id) {
          return;
        }

        const { data, error } =
          await supabase
            .from("memberships")
            .select(
              "id, plan, status, expires_at, customer_email"
            )
            .eq(
              "user_id",
              session.user.id
            )
            .eq(
              "status",
              "active"
            )
            .order(
              "created_at",
              {
                ascending: false,
              }
            )
            .limit(1)
            .maybeSingle();

        if (error) {
          console.error(
            "Could not load paid membership:",
            error
          );
          return;
        }

        if (!data) {
          return;
        }

        const expiresAt =
          data.expires_at ?? null;

        if (
          expiresAt &&
          new Date(expiresAt).getTime() <=
            Date.now()
        ) {
          return;
        }

        setMembership({
          level:
            data.plan as PaidPlan,
          expiresAt,
          accessSessionId:
            data.id,
          customerEmail:
            data.customer_email ??
            session.user.email ??
            null,
        });
      };

    void loadPaidMembership();
  }, [session?.user.id]);

  /* =======================================================
     FAVORITES
     ======================================================= */

  useEffect(() => {
    const loadFavorites =
      async () => {
        if (
          !session?.user.id
        ) {
          setFavorites(
            []
          );

          return;
        }

        setFavoritesLoading(
          true
        );

        const {
          data,
          error,
        } =
          await supabase
            .from(
              "favorites"
            )
            .select(
              "content_id"
            )
            .eq(
              "user_id",
              session.user.id
            );

        if (!error) {
          setFavorites(
            (
              data ??
              []
            )
              .map(
                (
                  row
                ) =>
                  row.content_id
              )
              .filter(
                (
                  value
                ): value is string =>
                  typeof value ===
                  "string"
              )
          );
        }

        setFavoritesLoading(
          false
        );
      };

    void loadFavorites();
  }, [
    session?.user.id,
  ]);

  /* =======================================================
     CATALOG MAPPING
     ======================================================= */

  const databaseContent =
    useMemo(
      () =>
        publicVideos.map(
          videoRecordToContentItem
        ),

      [
        publicVideos,
      ]
    );

  const publicCatalog =
    databaseContent.length >
    0
      ? databaseContent
      : fallbackAllContent;

  const featuredItems =
    databaseContent.length >
    0
      ? databaseContent.slice(
          0,
          4
        )
      : fallbackFeatured;

  const newReleaseItems =
    databaseContent.length >
    0
      ? databaseContent
      : fallbackNewReleases;

  // Public marketing posters are stored independently in site_settings.
  // Never derive unpaid homepage content from the videos table.

  const heroItem =
  publicCatalog.find(
    (item) => item.contentId === publicHeroSettings.featured_video_id
  ) ??
  featuredItems[0] ??
  fallbackFeatured[0];

  useEffect(() => {
    const syncVideoRoute = () => {
      const match = window.location.pathname.match(/^\/video\/([^/]+)$/);
      if (!match) return;
      const slug = decodeURIComponent(match[1]);
      const item = publicCatalog.find((candidate) => candidate.slug === slug);
      if (item) openItem(item, false);
    };

    syncVideoRoute();
    window.addEventListener("popstate", syncVideoRoute);
    return () => window.removeEventListener("popstate", syncVideoRoute);
  }, [publicCatalog]);

  /* =======================================================
     SEARCH
     ======================================================= */

  const searchResults =
    useMemo(() => {
      if (
        !activeSearch
      ) {
        return [];
      }

      const needle =
        activeSearch.toLowerCase();

      return publicCatalog.filter(
        (
          item
        ) =>
          [
            item.title,
            item.subtitle,
            item.category ??
              "",
            item.seriesName ??
              "",
            item.badge ??
              "",
          ]
            .join(
              " "
            )
            .toLowerCase()
            .includes(
              needle
            )
      );
    }, [
      activeSearch,
      publicCatalog,
    ]);

  const favoriteItems =
    publicCatalog.filter(
      (
        item
      ) =>
        favorites.includes(
          item.contentId
        )
    );

  /* =======================================================
     FAVORITE ACTION
     ======================================================= */

  const toggleFavorite =
    async (
      item:
        ContentItem
    ) => {
      if (
        !session?.user.id
      ) {
        return;
      }

      const exists =
        favorites.includes(
          item.contentId
        );

      setFavoriteBusyIds(
        (
          current
        ) => [
          ...current,
          item.contentId,
        ]
      );

      if (
        exists
      ) {
        const {
          error,
        } =
          await supabase
            .from(
              "favorites"
            )
            .delete()
            .eq(
              "user_id",
              session.user.id
            )
            .eq(
              "content_id",
              item.contentId
            );

        if (
          !error
        ) {
          setFavorites(
            (
              current
            ) =>
              current.filter(
                (
                  id
                ) =>
                  id !==
                  item.contentId
              )
          );
        }
      } else {
        const {
          error,
        } =
          await supabase
            .from(
              "favorites"
            )
            .insert({
              user_id:
                session.user.id,

              content_id:
                item.contentId,
            });

        if (
          !error
        ) {
          setFavorites(
            (
              current
            ) =>
              current.includes(
                item.contentId
              )
                ? current
                : [
                    ...current,
                    item.contentId,
                  ]
          );
        }
      }

      setFavoriteBusyIds(
        (
          current
        ) =>
          current.filter(
            (
              id
            ) =>
              id !==
              item.contentId
          )
      );
    };

  /* =======================================================
     PROFILE SAVE
     ======================================================= */

  const saveDisplayName =
    async (
      displayName:
        string
    ) => {
      if (
        !session?.user.id
      ) {
        return false;
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "profiles"
          )
          .update({
            display_name:
              displayName,
          })
          .eq(
            "id",
            session.user.id
          )
          .select(
            "id, display_name, avatar_url, is_admin, created_at, updated_at"
          )
          .single();

      if (
        error
      ) {
        return false;
      }

      setProfile(
        data as Profile
      );

      return true;
    };

  /* =======================================================
     NAVIGATION
     ======================================================= */

  const openItem = (
    item:
      ContentItem,
    updateUrl = true
  ) => {
    if (!canWatchVideo(item) && !adminAccess) {
      setSelectedItem(item);
      setAccessOpen(true);
      setSearchOpen(false);
      setMenuOpen(false);
      return;
    }

    if (updateUrl && item.slug) {
      window.history.pushState({}, "", `/video/${item.slug}`);
    }
    setSelectedItem(
      item
    );

    setViewMode(
      "detail"
    );

    setSearchOpen(
      false
    );

    setMenuOpen(
      false
    );

    window.scrollTo({
      top:
        0,

      behavior:
        "smooth",
    });
  };

  const goHome =
    () => {
      setActiveNav("home");
      if (window.location.pathname !== "/") {
        window.history.pushState({}, "", "/");
      }
      setSelectedItem(
        null
      );

      setViewMode(
        "home"
      );

      setSearchValue(
        ""
      );

      setActiveSearch(
        ""
      );

      setSearchOpen(
        false
      );

      setMenuOpen(
        false
      );

      window.scrollTo({
        top:
          0,

        behavior:
          "smooth",
      });
    };

  const showApply = () => {
    setActiveNav("apply");

    if (window.location.pathname !== "/apply") {
      window.history.pushState({}, "", "/apply");
    }

    setSelectedItem(null);
    setSearchOpen(false);
    setMenuOpen(false);
    setViewMode("apply");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showStudio =
    () => {
      if (
        session &&
        profile?.is_admin
      ) {
        if (window.location.pathname !== "/studio") {
          window.history.pushState({}, "", "/studio");
        }

        setViewMode(
          "studio"
        );

        window.scrollTo({
          top:
            0,
        });
      }
    };

  const showAccount =
    () => {
      if (
        session
      ) {
        if (window.location.pathname !== "/account") {
          window.history.pushState({}, "", "/account");
        }

        setViewMode(
          "account"
        );

        window.scrollTo({
          top:
            0,
        });
      }
    };

  /* =======================================================
     SEARCH SUBMIT
     ======================================================= */

  const handleSearch =
    (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (!accessActive && !adminAccess) {
        setSearchOpen(false);
        setAccessOpen(true);
        return;
      }

      const value =
        searchValue.trim();

      if (
        !value
      ) {
        return;
      }

      setActiveSearch(
        value
      );

      setViewMode(
        "search"
      );

      setSearchOpen(
        false
      );
    };

  /* =======================================================
     LEGAL NAVIGATION
     ======================================================= */

  const openLegalPage = (
    page: LegalPageKey
  ) => {
    setLegalPage(page);
    setViewMode("legal");
    setSelectedItem(null);
    setSearchOpen(false);
    setMenuOpen(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* =======================================================
     LOG OUT
     ======================================================= */

  const logout =
    async () => {
      await supabase.auth
        .signOut();

      setProfile(
        null
      );

      setViewMode(
        "home"
      );
    };

  /* =======================================================
     RENDER
     ======================================================= */

  const activeHomepageBanner =
    homepageBanners.length > 0
      ? homepageBanners[Math.min(activeBannerIndex, homepageBanners.length - 1)]
      : null;

  const showPreviousBanner = () => {
    if (homepageBanners.length <= 1) return;
    setActiveBannerIndex((current) =>
      (current - 1 + homepageBanners.length) % homepageBanners.length
    );
  };

  const showNextBanner = () => {
    if (homepageBanners.length <= 1) return;
    setActiveBannerIndex((current) =>
      (current + 1) % homepageBanners.length
    );
  };

  

  const showPreviousBrands = () => {
    if (homepageBrands.length <= 3) return;
    setActiveBrandStartIndex((current) =>
      (current - 1 + homepageBrands.length) % homepageBrands.length
    );
  };

  const showNextBrands = () => {
    if (homepageBrands.length <= 3) return;
    setActiveBrandStartIndex((current) =>
      (current + 1) % homepageBrands.length
    );
  };

  return (
    <div className="app-shell">
      <SiteHeader
        menuOpen={
          menuOpen
        }
        setMenuOpen={
          setMenuOpen
        }
        searchOpen={
          searchOpen
        }
        setSearchOpen={
          setSearchOpen
        }
        searchValue={
          searchValue
        }
        setSearchValue={
          setSearchValue
        }
        onSearch={
          handleSearch
        }
        onHome={
          goHome
        }
        onApply={
          showApply
        }
        activeNav={activeNav}
        onActiveNavChange={setActiveNav}
        onLegal={
          openLegalPage
        }
        onSubscribe={() =>
          setAccessOpen(
            true
          )
        }
        onMemberLogin={() => {
          setAccessOpen(false);
          setAuthOpen(true);
          window.history.pushState({}, "", "/member-login");
        }}
        session={
          session
        }
        profile={
          profile
        }
        onAccount={
          showAccount
        }
        onLogout={() => {
          void logout();
        }}
        membership={
          membership
        }
        accessActive={
          accessActive
        }
      />

      {viewMode ===
        "legal" ? (
        <LegalPage
          page={legalPage}
          onBack={goHome}
          onLegal={openLegalPage}
        />
      ) : viewMode === "apply" ? (
        <ApplyToModelPage onBack={goHome} />
      ) : viewMode ===
        "detail" &&
      selectedItem ? (
        <VideoDetail
          item={
            selectedItem
          }
          canWatch={
            canWatchVideo(
              selectedItem
            )
          }
          membership={
            membership
          }
          adminAccess={
            adminAccess
          }
          onBack={
            goHome
          }
          onOpenAccess={() =>
            setAccessOpen(
              true
            )
          }
          favorites={
            favorites
          }
          onToggleFavorite={(
            item
          ) => {
            void toggleFavorite(
              item
            );
          }}
          favoriteBusyIds={
            favoriteBusyIds
          }
        />
      ) : viewMode ===
        "search" ? (
        <SearchResults
          query={
            activeSearch
          }
          items={
            searchResults
          }
          onOpen={
            openItem
          }
          onClear={
            goHome
          }
          canWatchVideo={
            canWatchVideo
          }
          favorites={
            favorites
          }
          onToggleFavorite={(
            item
          ) => {
            void toggleFavorite(
              item
            );
          }}
          favoriteBusyIds={
            favoriteBusyIds
          }
        />
      ) : viewMode ===
          "favorites" &&
        session ? (
        <FavoritesPage
          items={
            favoriteItems
          }
          onOpen={
            openItem
          }
          onBack={
            goHome
          }
          canWatchVideo={
            canWatchVideo
          }
          favorites={
            favorites
          }
          onToggleFavorite={(
            item
          ) => {
            void toggleFavorite(
              item
            );
          }}
          favoriteBusyIds={
            favoriteBusyIds
          }
          loading={
            favoritesLoading
          }
        />
      ) : viewMode ===
          "account" &&
        session ? (
        <AccountPage
          session={
            session
          }
          profile={
            profile
          }
          profileLoading={
            profileLoading
          }
          favoritesCount={
            favorites.length
          }
          membership={
            membership
          }
          onSaveDisplayName={
            saveDisplayName
          }
          onStudio={
            showStudio
          }
          onLogout={() => {
            void logout();
          }}
          onBack={
            goHome
          }
        />
      ) : viewMode ===
          "studio" &&
        session &&
        profile?.is_admin ? (
        <StudioDashboard
          session={
            session
          }
          profile={
            profile
          }
          onBack={
            goHome
          }
          onCatalogChanged={
            loadPublicCatalog
          }
          onViewVideo={(slug) => {
            const item = publicCatalog.find((candidate) => candidate.slug === slug);
            if (item) openItem(item);
          }}
        />
      ) : (
        <main>
{!accessActive && !adminAccess ? (
  <section className="public-home-slideshow" aria-label="Spikeydee VIP featured promotions">
    {activeHomepageBanner ? (
      <>
        {homepageBanners.map((banner, index) => (
          <img
            key={banner.id}
            className={`public-home-slide ${index === activeBannerIndex ? "is-active" : ""}`}
            src={banner.image_url}
            alt=""
            aria-hidden="true"
          />
        ))}
        <div className="public-home-slide-overlay" />

<div className="public-home-slide-content">
  <span className="public-home-eyebrow">
    {activeHomepageBanner.eyebrow || "SPIKEYDEE VIP ORIGINALS"}
  </span>

  <h1>
    {activeHomepageBanner.title || (
      <>
        EXCLUSIVE CONTENT.
        <strong> ONLY ON SPIKEYDEE VIP.</strong>
      </>
    )}
  </h1>

  <p>
    {activeHomepageBanner.subtitle ||
      "Get instant access to the complete SpikeyDeeVIP collection, exclusive series, and new premium releases."}
  </p>

  <div className="public-home-hero-actions">
    <button
      type="button"
      className="public-home-cta"
      onClick={() => setAccessOpen(true)}
    >
      {activeHomepageBanner.button_text || "GET INSTANT ACCESS"} →
    </button>

    <button
      type="button"
      className="public-home-secondary-cta"
      onClick={() =>
        document
          .getElementById("exclusive-series")
          ?.scrollIntoView({ behavior: "smooth" })
      }
    >
      SEE WHAT'S INSIDE
    </button>
  </div>
</div>
        {homepageBanners.length > 1 && (
          <>
            <button type="button" className="public-home-arrow public-home-arrow-left" onClick={showPreviousBanner} aria-label="Previous banner">‹</button>
            <button type="button" className="public-home-arrow public-home-arrow-right" onClick={showNextBanner} aria-label="Next banner">›</button>
            <div className="public-home-dots" aria-label="Choose banner">
              {homepageBanners.map((banner, index) => (
                <button key={banner.id} type="button" className={index === activeBannerIndex ? "is-active" : ""} onClick={() => setActiveBannerIndex(index)} aria-label={`Show banner ${index + 1}`} />
              ))}
            </div>
          </>
        )}
      </>
    ) : (
      <div className="public-home-empty-hero">
        <div>
          <span className="public-home-eyebrow">SPIKEYDEE VIP</span>
          <button type="button" className="public-home-cta" onClick={() => setAccessOpen(true)}>JOIN VIP</button>
        </div>
      </div>
    )}
  </section>
 ) : (
  <section
    className="public-home-slideshow"
    aria-label="Spikeydee VIP member banner"
    style={{ background: "#000" }}
  >
    {activeHomepageBanner?.image_url ? (
      <img
        className="public-home-slide is-active"
        src={activeHomepageBanner.image_url}
        alt=""
        aria-hidden="true"
      />
    ) : heroItem?.thumbnailUrl ? (
      <img
        className="public-home-slide is-active"
        src={heroItem.thumbnailUrl}
        alt=""
        aria-hidden="true"
      />
    ) : null}
  </section>
)}
{!accessActive && !adminAccess && (
  <section className="public-benefits-strip">
    <div className="public-benefits-inner">
      <div className="public-benefit-item">
        <strong>2,000+</strong>
        <span>RELEASES</span>
      </div>

      <div className="public-benefit-item">
        <strong>NEW</strong>
        <span>CONTENT REGULARLY</span>
      </div>

      <div className="public-benefit-item">
        <strong>HD</strong>
        <span>STREAMING</span>
      </div>

      <div className="public-benefit-item">
        <strong>VIP</strong>
        <span>PRIVATE MEMBERSHIP ACCESS</span>
      </div>
    </div>
  </section>
)}
          {!accessActive && !adminAccess && homepageBrands.length > 0 && (
            <section
              id="exclusive-series"
              className="public-home-brands"
              aria-label="Spikeydee VIP brands and series"
            >
            <div className="public-home-brands-heading">
  <span className="public-home-brands-kicker">
   
  </span>

  <h2>
    OUR EXCLUSIVE <strong>SERIES</strong>
  </h2>

  <p>
    Explore original series available with VIP membership.
  </p>
</div>  

              <div className="public-home-brands-track-wrap">
                {homepageBrands.length > 3 && (
                  <button
                    type="button"
                    className="public-home-brand-arrow public-home-brand-arrow-left"
                    onClick={showPreviousBrands}
                    aria-label="Previous brands"
                  >
                    ‹
                  </button>
                )}

                <div className="public-home-brands-grid">
  {homepageBrands.map((brand) => (
    <button
      key={brand.id}
      type="button"
      className="public-home-brand-card"
      onClick={() => setAccessOpen(true)}
      aria-label={
        brand.name
          ? `View membership for ${brand.name}`
          : "View Spikeydee VIP membership"
      }
    >
      <img
        src={brand.logo_url}
        alt={brand.name ?? "Spikeydee VIP brand"}
      />
    </button>
  ))}
</div>

                {homepageBrands.length > 3 && (
                  <button
                    type="button"
                    className="public-home-brand-arrow public-home-brand-arrow-right"
                    onClick={showNextBrands}
                    aria-label="Next brands"
                  >
                    ›
                  </button>
                )}
              </div>
            </section>
          )}


          <div className="content-wrapper">
            {(accessActive || adminAccess) && catalogLoading && (
              <p style={{ textAlign: "center" }}>
                Loading homepage...
              </p>
            )}

            {/* PUBLIC HOMEPAGE — PROMOTIONAL GRID */}
            {!accessActive && !adminAccess && (
              <>
                <section id="public-gallery" className="public-releases-section">
  <div className="public-releases-heading">
    <div>
      <span className="public-releases-kicker">
        MOST WATCHED
      </span>

      <h2>
        POPULAR <strong>MOVIES</strong>
      </h2>
    </div>

    <button
      type="button"
      className="public-releases-view-all"
      onClick={() => setAccessOpen(true)}
    >
      VIEW ALL →
    </button>
  </div>

  {homepageTiles.length > 0 ? (
    <div className="public-releases-grid">
      {homepageTiles.slice(0, 4).map((tile) => (
        <button
          key={tile.id}
          type="button"
          className="public-release-card"
          onClick={() => setAccessOpen(true)}
        >
          <div className="public-release-image">
            <img
              src={tile.image_url}
              alt={tile.title || "Spikeydee VIP release"}
            />

            <span className="public-release-badge">
              VIP
            </span>

            <span className="public-release-play">
              ▶
            </span>
          </div>

          <div className="public-release-info">
            <strong>
              {tile.title || "Spikeydee VIP Exclusive"}
            </strong>

            <span>
              {tile.subtitle || "Exclusive VIP release"}
            </span>
          </div>
        </button>
      ))}
    </div>
  ) : (
    <div className="public-home-grid-empty">
      Add homepage release artwork from your Studio Dashboard.
    </div>
  )}
</section>
<section id="public-performers" className="public-performers-section">
  <div className="public-performers-heading">
    <span className="public-performers-kicker">MEET THE TALENT</span>
    <h2>FEATURED <strong>PERFORMERS</strong></h2>
    <p>Discover featured performers from SpikeyDeeVIP productions.</p>
  </div>
  {homepagePerformers.length > 0 ? (
    <div className="public-performers-grid">
      {homepagePerformers.map((performer)=>(
        <button key={performer.id} type="button" className="public-performer-card" onClick={()=>setAccessOpen(true)}>
          <div className="public-performer-placeholder"><img src={performer.image_url} alt={performer.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} /></div>
          <div className="public-performer-info"><strong>{performer.name}</strong><span>{performer.subtitle || "FEATURED PERFORMER"}</span></div>
        </button>
      ))}
    </div>
  ) : (
    <div className="public-performers-grid">
      <button type="button" className="public-performer-card" onClick={()=>setAccessOpen(true)}>
        <div className="public-performer-placeholder"><span>SPIKEY DEE</span></div>
        <div className="public-performer-info"><strong>Spikey Dee</strong><span>FEATURED PERFORMER</span></div>
      </button>
      {[1,2,3].map((slot)=>(
        <button key={slot} type="button" className="public-performer-card" onClick={()=>setAccessOpen(true)}>
          <div className="public-performer-placeholder"><span>COMING SOON</span></div>
          <div className="public-performer-info"><strong>New Performer</strong><span>COMING SOON</span></div>
        </button>
      ))}
    </div>
  )}
</section>
 <section className="public-home-membership-cta">
  <div className="public-membership-cta-inner">

    <span className="public-membership-kicker">
      YOUR ALL-ACCESS PASS
    </span>

    <h2>
      ONE MEMBERSHIP.
      <strong> EVERYTHING UNLOCKED.</strong>
    </h2>

    <p>
      Get unlimited access to the SpikeyDeeVIP library, exclusive
      releases, featured performers, and new content.
    </p>

    <button
      type="button"
      className="public-membership-button"
      onClick={() => setAccessOpen(true)}
    >
      JOIN SPIKEYDEE VIP →
    </button>

    <div className="public-membership-stats">
      <div>
        <strong>2,000+</strong>
        <span>RELEASES</span>
      </div>

      <div>
        <strong>VIP</strong>
        <span>EXCLUSIVE CONTENT</span>
      </div>

      <div>
        <strong>NEW</strong>
        <span>CONTENT REGULARLY</span>
      </div>
    </div>

  </div>
</section>

              </>
            )}

            {/* =====================================================
                PAID MEMBER / STUDIO VIDEO LIBRARY
               ===================================================== */}
            {(accessActive || adminAccess) && (
              <div id="member-videos">
                <div id="new">
                  <ContentRow
                    title="New Releases"
                    items={newReleaseItems}
                    onOpen={openItem}
                    sectionId="new"
                    canWatchVideo={canWatchVideo}
                    favorites={favorites}
                    onToggleFavorite={(item) => {
                      void toggleFavorite(item);
                    }}
                    favoriteBusyIds={favoriteBusyIds}
                  />
                </div>
              </div>
            )}

            {/* MEMBERSHIP OVERVIEW */}

            <section className="subscription-banner">
              <div>
                <span className="section-kicker">VIP MEMBERSHIPS</span>
                <h2>Choose the access that fits you.</h2>
                <p>
                  1 Year Membership $365.00 • first 30 days $9.99, then $32.99
every 30 days until cancelled • 2-day promotional pass $0.99, then $32.99 every 30 days
until cancelled.
                </p>
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={() => setAccessOpen(true)}
              >
                {accessActive && membership.level !== "none"
                  ? `✓ ${PLAN_LABELS[membership.level as PaidPlan]}`
                  : "View Memberships"}
              </button>
            </section>

            {accessActive && !adminAccess && membership.level !== "none" && (
              <section className="subscription-banner" style={{ marginTop: "24px" }}>
                <div>
                  <span className="section-kicker">ACCESS ACTIVE</span>
                  <h2>✓ {PLAN_LABELS[membership.level as PaidPlan]}</h2>
                  <p>
                    Playback authorization is verified by the server for each protected Bunny Stream video.
                  </p>
                </div>
              </section>
            )}

            {profile?.is_admin && (
              <section
                className="subscription-banner"
                style={{
                  marginTop:
                    "24px",
                }}
              >
                <div>
                  <span className="section-kicker">
                    STUDIO ADMIN
                  </span>

                  <h2>
                    Manage video permissions.
                  </h2>

                  <p>
                    Add, edit, publish, and
                    assign each video to either
                    2-Day promotional access or
                    Full Membership Only.
                  </p>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    showStudio
                  }
                >
                  Open Studio
                </button>
              </section>
            )}
          </div>
        </main>
      )}

      {accessOpen && (
        <AccessModal
          currentAccess={accessActive ? membership.level : "none"}
          initialEmail={membership.customerEmail ?? ""}
          onClose={() => setAccessOpen(false)}
          onCheckEmail={checkEmailForExistingMembership}
          onStartCheckout={beginCcbillCheckout}
        />
      )}

      {checkoutReturnOpen && (
        <CheckoutReturnModal
          checkoutId={checkoutReturnId}
          onActivated={setMembership}
          onClose={closeCheckoutReturn}
        />
      )}

      {authOpen && (
        <AuthModal
          onClose={closeStudioLogin}
        />
      )}

      {passwordResetOpen && (
        <ResetPasswordModal
          onComplete={returnToStudioLogin}
        />
      )}

      <SiteFooter onLegal={openLegalPage} />
    </div>
  );
}

/* =========================================================
   HARD AGE-GATE WRAPPER
   The main site is not mounted until the visitor confirms 18+.
   This prevents MainApp effects, catalog requests, thumbnails,
   previews, auth UI, and other site content from rendering/loading
   behind the age gate.
   ========================================================= */

function App() {
  const [ageVerified, setAgeVerified] =
    useState<boolean>(() => loadAgeVerification());

  const confirmAge = () => {
    try {
      window.sessionStorage.setItem(
        AGE_GATE_STORAGE_KEY,
        "true"
      );
    } catch (error) {
      console.warn(
        "Could not persist age verification for this session:",
        error
      );
    }

    setAgeVerified(true);
  };

  if (!ageVerified) {
    return <AgeGate onConfirm={confirmAge} />;
  }

  return <MainApp />;
}

export default App;
