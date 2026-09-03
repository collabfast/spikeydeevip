import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import * as tus from "tus-js-client";

import { supabase } from "./lib/supabase";
import "./App.css";
import spikeydeeVipLogo from "./assets/spikeydeevip-logo.png";

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

type ViewMode =
  | "home"
  | "search"
  | "favorites"
  | "detail"
  | "account"
  | "studio"
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

const LIFETIME_PRICE = "$225.00";
const TWELVE_MONTH_MONTHLY_EQUIVALENT = "$9.99";
const TWELVE_MONTH_TOTAL = "$119.88";
const THIRTY_DAY_PRICE = "$29.99";
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

/*
  Replace these placeholders with your real business details before launch.
  Keeping them centralized makes the legal pages easy to update later.
*/
const SUPPORT_EMAIL = "spikeydeevip@gmail.com";
const BILLING_SUPPORT_EMAIL = "consumersupport@ccbill.com";
const BILLING_SUPPORT_PHONE = "888-596-9279";
const COMPLAINTS_EMAIL = "spikeydeevip@gmail.com";
const BUSINESS_NAME = "Spikeydee VIP";
const BUSINESS_ADDRESS = "[ADD BUSINESS ADDRESS]";
const RECORDS_CUSTODIAN_NAME = "Noah Wayne Curd";
const RECORDS_CUSTODIAN_ADDRESS = "[6605 Grand Montecito Pkwy, Suite 100, Las Vegas, NV 89149, USA]";
const BILLING_DESCRIPTOR = "[ADD CARD STATEMENT DESCRIPTOR]";

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
    if (
      window.localStorage.getItem(
        AGE_GATE_STORAGE_KEY
      ) === "true"
    ) {
      return true;
    }

    return document.cookie
      .split(";")
      .some((cookie) =>
        cookie.trim() ===
        `${AGE_GATE_STORAGE_KEY}=true`
      );
  } catch {
    return false;
  }
}

/* =========================================================
   VIP ACCESS / CHECKOUT PLACEHOLDER
   ========================================================= */

/* =========================================================
   VIP ACCESS / SIGNUP FLOW
   ========================================================= */

type AccessModalProps = {
  currentAccess: AccessLevel;
  initialEmail?: string;
  onClose: () => void;
  onStartCheckout: (
    plan: PaidPlan,
    email: string
  ) => Promise<string | null>;
};

function AccessModal({
  currentAccess,
  initialEmail = "",
  onClose,
  onStartCheckout,
}: AccessModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(initialEmail);
  const [notice, setNotice] = useState("");
  const [checkoutBusyPlan, setCheckoutBusyPlan] = useState<PaidPlan | null>(null);

  const continueToPlans = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

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
              >
                CONTINUE
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
        <strong>Lifetime Membership:</strong>{" "}
        One-time payment of {LIFETIME_PRICE}.
        Non-recurring. Includes full premium catalog access.
      </p>

      <p>
        <strong>12 Month Membership:</strong>{" "}
        One payment of {TWELVE_MONTH_TOTAL}
        for 12 months of full premium access.
      </p>

      <p>
        <strong>30 Day Membership:</strong>{" "}
        {THIRTY_DAY_PRICE} every 30 days until cancelled.
        Includes full premium catalog access while membership
        remains active.
      </p>

      <p>
        <strong>2 Day Promotional Access:</strong>{" "}
        {TWO_DAY_PRICE} for the first 2 days.
        After the promotional period, membership automatically
        renews at {TWO_DAY_RENEWAL_PRICE} every 30 days until
        cancelled.
      </p>

    </div>


    <div className="vip-legal-divider" />


    <div className="vip-legal-copy">

      <p>
        Adults 18+ only. All performers depicted in content
        available through Spikeydee VIP are represented as adults.
      </p>

      <p>
        Recurring memberships continue until cancelled.
        Final pricing, billing frequency, renewal terms,
        cancellation terms, and applicable conditions are
        displayed before purchase.
      </p>

      <p>
        By using Spikeydee VIP, you agree to the applicable
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

          <div>

            <span className="section-kicker">
              SPIKEYDEE VIP
            </span>

            <h2
              style={{
                margin:
                  "8px 0 10px",

                fontSize:
                  "32px",

                color:
                  "#ffffff",

                letterSpacing:
                  "-0.03em",
              }}
            >
              CHOOSE YOUR VIP ACCESS
            </h2>


            <p
              style={{
                margin: 0,

                color:
                  "var(--text-muted)",

                lineHeight:
                  1.6,
              }}
            >
              Membership options for{" "}

              <strong
                style={{
                  color:
                    "#fff",
                }}
              >
                {email}
              </strong>
            </p>

          </div>


          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width:
                "42px",

              height:
                "42px",

              flexShrink:
                0,

              border:
                "1px solid var(--border)",

              borderRadius:
                "10px",

              background:
                "#151515",

              color:
                "#fff",

              fontSize:
                "20px",
            }}
          >
            ×
          </button>

        </div>


        {/* =================================================
            MEMBERSHIP GRID
            ================================================= */}

        <div
          className="vip-access-grid"
          style={{
            marginTop:
              "28px",
          }}
        >

          {/* LIFETIME */}

          <article
            className="vip-access-card"
            style={{
              ...planCardStyle,

              border:
                "1px solid rgba(231,187,69,.62)",

              background:
                "linear-gradient(180deg, rgba(231,187,69,.055), rgba(255,255,255,.008)), var(--surface)",

              boxShadow:
                "0 16px 38px rgba(0,0,0,.28)",
            }}
          >

            <span
              style={{
                alignSelf:
                  "flex-start",

                padding:
                  "6px 9px",

                border:
                  "1px solid rgba(231,187,69,.5)",

                borderRadius:
                  "7px",

                color:
                  "var(--gold-2)",

                fontSize:
                  "9px",

                fontWeight:
                  900,

                letterSpacing:
                  ".12em",
              }}
            >
              BEST VALUE
            </span>


            <h3
              style={{
                margin:
                  "18px 0 8px",

                fontSize:
                  "24px",
              }}
            >
              Lifetime Membership
            </h3>


            <div
              style={{
                fontSize:
                  "38px",

                fontWeight:
                  850,
              }}
            >
              {LIFETIME_PRICE}
            </div>


            <div
              style={{
                color:
                  "var(--text-muted)",

                marginTop:
                  "2px",
              }}
            >
              / lifetime
            </div>


            <p className="membership-card-disclosure">
              One-time payment of
              $225.00. Non-recurring.
              Full premium catalog access.
            </p>


            <button
              type="button"
              className="vip-signup-continue"
              onClick={() =>
                choosePlan(
                  "lifetime"
                )
              }
              style={{
                width:
                  "100%",

                marginTop:
                  "auto",
              }}
            >
              {checkoutBusyPlan === "lifetime" ? "OPENING CCBILL…" : "START MEMBERSHIP"}
            </button>

          </article>


          {/* 12 MONTH */}

          <article
            className="vip-access-card"
            style={planCardStyle}
          >

            <h3
              style={{
                margin:
                  "12px 0 8px",

                fontSize:
                  "24px",
              }}
            >
              12 Month Membership
            </h3>


            <div
              style={{
                fontSize:
                  "38px",

                fontWeight:
                  850,
              }}
            >
              {TWELVE_MONTH_MONTHLY_EQUIVALENT}
            </div>


            <div
              style={{
                color:
                  "var(--text-muted)",

                marginTop:
                  "2px",
              }}
            >
              / month
            </div>


            <p className="membership-card-disclosure">
              Billed as one payment
              of {TWELVE_MONTH_TOTAL} for
              12 months of full premium
              access.
            </p>


            <button
              type="button"
              className="primary-button"
              onClick={() =>
                choosePlan(
                  "twelve_month"
                )
              }
            >
              {checkoutBusyPlan === "twelve_month" ? "OPENING CCBILL…" : "START MEMBERSHIP"}
            </button>

          </article>


          {/* 30 DAY */}

          <article
            className="vip-access-card"
            style={planCardStyle}
          >

            <h3
              style={{
                margin:
                  "12px 0 8px",

                fontSize:
                  "24px",
              }}
            >
              30 Day Membership
            </h3>


            <div
              style={{
                fontSize:
                  "38px",

                fontWeight:
                  850,
              }}
            >
              {THIRTY_DAY_PRICE}
            </div>


            <div
              style={{
                color:
                  "var(--text-muted)",

                marginTop:
                  "2px",
              }}
            >
              / 30 days
            </div>


            <p className="membership-card-disclosure">
              Billed $29.99 every
              30 days until cancelled.
              Full premium catalog
              access while active.
            </p>


            <button
              type="button"
              className="primary-button"
              onClick={() =>
                choosePlan(
                  "thirty_day"
                )
              }
            >
              {checkoutBusyPlan === "thirty_day" ? "OPENING CCBILL…" : "START MEMBERSHIP"}
            </button>

          </article>


          {/* 2 DAY */}

          <article
            className="vip-access-card"
            style={planCardStyle}
          >

            <h3
              style={{
                margin:
                  "12px 0 8px",

                fontSize:
                  "24px",
              }}
            >
              2 Day Pass
            </h3>


            <div
              style={{
                fontSize:
                  "38px",

                fontWeight:
                  850,
              }}
            >
              {TWO_DAY_PRICE}
            </div>


            <div
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
              onClick={() =>
                choosePlan(
                  "two_day_pass"
                )
              }
            >
              {checkoutBusyPlan === "two_day_pass" ? "OPENING CCBILL…" : "START MEMBERSHIP"}
            </button>

          </article>

        </div>


        {/* BILLING DISCLOSURE */}

        <div
          className="billing-disclosure"
          style={{
            marginTop:
              "22px",

            padding:
              "16px 18px",

            border:
              "1px solid var(--border)",

            borderRadius:
              "14px",

            background:
              "#111",

            color:
              "var(--text-muted)",

            lineHeight:
              1.6,
          }}
        >

          <strong
            style={{
              color:
                "#fff",
            }}
          >
            Billing disclosure:
          </strong>{" "}

          The 2 Day Pass is $0.99
          for the first 2 days.
          After the promotional period
          it automatically renews at{" "}
          {TWO_DAY_RENEWAL_PRICE} every
          30 days until cancelled.
          Recurring plans continue until
          cancelled according to the
          terms shown at checkout.

        </div>


        {/* CHANGE EMAIL */}

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


        {/* ERROR / NOTICE */}

        {notice && (
          <div
            role="status"
            style={{
              marginTop:
                "20px",

              padding:
                "14px 16px",

              border:
                "1px solid rgba(255,255,255,.16)",

              borderRadius:
                "12px",

              background:
                "#111",

              lineHeight:
                1.6,
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
                <span className="video-player-button">▶</span>
                <p>
                  {playbackLoading
                    ? "Authorizing secure Bunny Stream playback…"
                    : playbackError || "Preparing secure video playback…"}
                </p>
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
                  ? "This title requires a 30-Day, 12-Month, or Lifetime membership."
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
   STUDIO LOGIN
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
        "Enter your Studio admin email above, then select Reset password."
      );
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setResetLoading(true);

    const redirectTo =
      `${window.location.origin}/studio-reset-password`;

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
        aria-label="Studio Login"
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
          Studio Login
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

  return (
    <main>
      <div className="content-wrapper">
        <section
          className="content-section"
          style={{
            paddingTop:
              "70px",
          }}
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                STUDIO ACCOUNT
              </span>

              <h2>
                Account
              </h2>
            </div>

            <button
              type="button"
              className="view-all"
              onClick={
                onBack
              }
            >
              Back to Site
            </button>
          </div>

          {profileLoading ? (
            <p>
              Loading account...
            </p>
          ) : (
            <section
              style={{
                padding:
                  "26px",

                border:
                  "1px solid var(--border)",

                borderRadius:
                  "18px",
              }}
            >
              <form
                onSubmit={
                  handleSubmit
                }
              >
                <input
                  value={
                    displayName
                  }
                  onChange={(
                    event
                  ) =>
                    setDisplayName(
                      event.target.value
                    )
                  }
                  placeholder="Display name"
                />

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    saving
                  }
                  style={{
                    marginLeft:
                      "10px",
                  }}
                >
                  {saving
                    ? "Saving..."
                    : "Save Profile"}
                </button>
              </form>

              <p>
                Email:{" "}
                {
                  session.user.email
                }
              </p>

              <p>
                Favorites:{" "}
                {
                  favoritesCount
                }
              </p>

              <p>
                Role:{" "}
                {profile?.is_admin
                  ? "Studio Administrator"
                  : "Member"}
              </p>

              {profile?.is_admin && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    onStudio
                  }
                >
                  Open Studio
                </button>
              )}

              <button
                type="button"
                className="secondary-button"
                onClick={
                  onLogout
                }
                style={{
                  marginLeft:
                    "10px",
                }}
              >
                Log Out
              </button>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   STUDIO DASHBOARD
   ========================================================= */

type StudioDashboardProps = {
  session: Session;
  profile: Profile;
  onBack: () => void;
  onCatalogChanged: () => Promise<void>;
  onViewVideo: (slug: string) => void;
};

function StudioDashboard({
  session,
  profile,
  onBack,
  onCatalogChanged,
  onViewVideo,
}: StudioDashboardProps) {
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

      void upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
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
        is_published: form.isPublished,
        is_featured: form.isFeatured,
        price_cents: null,
        currency: "USD",
      };

      setUploadStatus("4 of 4 — Saving catalog record…");

      if (editingVideo) {
        const { error } = await supabase
          .from("videos")
          .update(payload)
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
        const { error } = await supabase.from("videos").insert({
          ...payload,
          created_by: session.user.id,
        });

        if (error) {
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

        setMessage(
          form.isPublished
            ? "Video uploaded to Bunny Stream and published."
            : "Video uploaded to Bunny Stream and saved as a draft."
        );
      }

      setEditingVideo(null);
      setForm(EMPTY_VIDEO_FORM);
      setVideoFile(null);
      setThumbnailFile(null);
      setUploadStatus("");
      setUploadProgress(0);
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
    const { error } = await supabase
      .from("videos")
      .update({ is_published: !video.is_published })
      .eq("id", video.id);
    if (error) return setErrorMessage(error.message);
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
    minHeight: "48px",
    padding: "0 14px",
    borderRadius: "10px",
    border: "1px solid var(--border)",
    background: "#fff",
    color: "#111",
  } as const;

  const uploadBoxStyle = {
    padding: "20px",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    background: "#101010",
  } as const;

  return (
    <main>
      <div className="content-wrapper">
        <section
          className="content-section"
          style={{ paddingTop: "70px", paddingBottom: "80px" }}
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">PRIVATE ADMIN</span>
              <h2>Studio Dashboard</h2>
            </div>
            <button type="button" className="view-all" onClick={onBack}>
              Back to Site
            </button>
          </div>

        
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
                      onChange={(e) => updateForm("isPublished", e.target.checked)}
                    />{" "}
                    Publish immediately
                  </label>
                </div>
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
                      : form.isPublished
                        ? "Upload to Bunny & Publish"
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
  onLegal: (page: LegalPageKey) => void;
  onSubscribe: () => void;
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
  onLegal,
  onSubscribe,
  session,
  profile,
  onLogout,
  membership,
  accessActive,
}: SiteHeaderProps) {
  const membershipLabel =
    accessActive && membership.level !== "none"
      ? PLAN_LABELS[membership.level as PaidPlan]
      : "Join VIP";

  const closeMenu = () => setMenuOpen(false);

  const goToSection = (id: string) => {
    closeMenu();
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const openVideos = () => {
    closeMenu();

    if (!accessActive && !profile?.is_admin) {
      onSubscribe();
      return;
    }

    onHome();
    window.setTimeout(() => {
      document.getElementById("member-videos")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const openModels = () => {
    closeMenu();
    if (!accessActive && !profile?.is_admin) {
      onSubscribe();
      return;
    }
    onHome();
    goToSection("member-videos");
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
    onClick={() => {
      closeMenu();
      onHome();
    }}
  >
    HOME
  </button>

  <button
    type="button"
    onClick={openVideos}
  >
    VIDEOS
  </button>

  <button
    type="button"
    onClick={openModels}
  >
    PERFORMERS
  </button>

  <button
    type="button"
    onClick={() => {
      closeMenu();
      onSubscribe();
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
    onClick={onSubscribe}
  >
    {accessActive ? membershipLabel : "JOIN VIP"}
  </button>
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
              style={{ minHeight: "54px", textAlign: "left" }}
            >
              HOME
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={openModels}
              style={{ minHeight: "54px", textAlign: "left" }}
            >
              MODELS
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={openVideos}
              style={{ minHeight: "54px", textAlign: "left" }}
            >
              VIDEOS
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={() => {
                closeMenu();
                onSubscribe();
              }}
              style={{ minHeight: "54px" }}
            >
              {accessActive ? membershipLabel.toUpperCase() : "JOIN / UNLOCK VIP"}
            </button>
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
      "These development terms establish the basic rules for accessing Spikeydee VIP. Replace or revise them with counsel-reviewed production terms before accepting live payments.",
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
          <p>
            Spikeydee VIP offers a $225.00 non-recurring Lifetime Membership, a
            12 Month Membership billed as one payment of $119.88, a 30 Day
            Membership billed at $29.99 every 30 days until cancelled, and a
            promotional 2 Day Pass billed at $0.99 for the first 2 days and then
            $32.99 every 30 days until cancelled. Individual videos are not sold
            separately.
          </p>
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
            Public viewers do not receive studio publishing privileges. Studio
            authentication and administrative tools are reserved for authorized
            administrators. Attempts to bypass access controls or use another
            person's credentials may result in access being blocked.
          </p>
        ),
      },
      {
        heading: "Changes and Availability",
        body: (
          <p>
            The catalog, access tiers, features, and availability of content may
            change. Material billing terms will be presented before a live
            purchase is completed.
          </p>
        ),
      },
    ],
  },

  privacy: {
    title: "Privacy Policy",
    kicker: "PRIVACY",
    intro:
      "This development policy describes the data flows currently used by the site and identifies disclosures that must be finalized before production launch.",
    sections: [
      {
        heading: "Browser Storage",
        body: (
          <p>
            The site currently uses browser storage and a first-party cookie to
            remember age-gate confirmation. During development, browser storage
            is also used to simulate VIP access. Production paid access will not
            rely on browser storage as the source of truth.
          </p>
        ),
      },
      {
        heading: "Studio Authentication and Application Data",
        body: (
          <p>
            Supabase is used for authorized studio authentication and application
            data such as profiles, catalog records, and access-related metadata.
            The final production policy should describe the categories of data
            retained, retention periods, security practices, and deletion
            procedures actually used.
          </p>
        ),
      },
      {
        heading: "Payment Information",
        body: (
          <p>
            When live billing is enabled, payment-card information should be
            entered directly into the approved payment processor's secure
            checkout. This React application should not store full card numbers
            or card-security codes.
          </p>
        ),
      },
      {
        heading: "Service Providers",
        body: (
          <p>
            Before launch, identify the production payment processor, hosting,
            video-delivery provider, analytics tools, email services, and other
            vendors that process personal information on behalf of the site.
          </p>
        ),
      },
      {
        heading: "Privacy Requests",
        body: (
          <p>
            Production privacy requests should be directed to {SUPPORT_EMAIL}.
            Add procedures appropriate to the jurisdictions in which the service
            is offered before launch.
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
      body: (
        <p>
          Spikeydee VIP is intended only for adults age 18 or older.
        </p>
      ),
    },
  ],
},

  "content-removal": {
    title: "Content Removal & Complaints",
    kicker: "SAFETY & COMPLIANCE",
    intro:
      "This page provides the public-facing structure for reporting potentially unauthorized, unlawful, non-consensual, incorrectly identified, or otherwise reviewable content.",
    sections: [
      {
        heading: "How to Submit a Report",
        body: (
          <div>
            <p>
              Send reports to <strong>{COMPLAINTS_EMAIL}</strong> and include the
              video title or page URL, the reason for the request, and enough
              information for the studio to identify the material.
            </p>
            <p>
              Do not include unnecessary sensitive personal information in the
              initial report.
            </p>
          </div>
        ),
      },
      {
        heading: "Review Process",
        body: (
          <p>
            Reports should be reviewed promptly and documented. Where appropriate,
            content may be temporarily restricted while the studio evaluates the
            request and preserves relevant records.
          </p>
        ),
      },
      {
        heading: "Urgent Safety or Illegal Content",
        body: (
          <p>
            Reports alleging non-consensual intimate imagery, exploitation,
            trafficking, child sexual abuse material, or other serious illegal
            conduct should receive immediate priority and should be escalated in
            accordance with applicable law and platform obligations.
          </p>
        ),
      },
      {
        heading: "Copyright Notices",
        body: (
          <p>
            Before launch, add the studio's chosen process and designated contact
            information for copyright infringement notices if applicable.
          </p>
        ),
      },
    ],
  },

  billing: {
    title: "Billing, Cancellation & Refunds",
    kicker: "BILLING",
    intro:
      "The live processor is not connected yet. This page states the intended product structure so the final processor-approved terms can be inserted without redesigning the site.",
    sections: [
      {
        heading: `Lifetime Membership — ${LIFETIME_PRICE}`,
        body: (
          <p>
            Lifetime access is billed once at $225.00 and is non-recurring.
          </p>
        ),
      },
      {
        heading: `12 Month Membership — ${TWELVE_MONTH_TOTAL}`,
        body: (
          <p>
            The 12 Month Membership is billed as one payment of $119.88,
            equivalent to $9.99 per month for the 12-month access period.
          </p>
        ),
      },
      {
        heading: `30 Day Membership — ${THIRTY_DAY_PRICE}`,
        body: (
          <p>
            The 30 Day Membership is billed at $29.99 every 30 days until
            cancelled and provides full-catalog access while active.
          </p>
        ),
      },
      {
        heading: `2 Day Pass — ${TWO_DAY_PRICE}`,
        body: (
          <p>
            The promotional 2 Day Pass is $0.99 for the first 2 days. After the
            promotional period, it automatically renews at $32.99 every 30 days
            until cancelled. During the initial 2-day period, access is limited to
            videos assigned to the promotional-access tier.
          </p>
        ),
      },
      {
        heading: "Recurring Billing and Cancellation",
        body: (
          <p>
            Before live checkout is enabled, the checkout and this page must state
            the processor-approved rebilling interval, cancellation method,
            cancellation effective date, and any renewal reminders or notices
            that apply.
          </p>
        ),
      },
      {
        heading: "Refunds",
        body: (
          <p>
            Insert the final processor-approved refund policy before launch,
            including treatment of duplicate charges, technical-access issues,
            charge disputes, and any circumstances in which refunds are or are
            not offered.
          </p>
        ),
      },
      {
        heading: "Billing Descriptor and Support",
        body: (
          <div>
            <p>
              Planned card statement descriptor: <strong>{BILLING_DESCRIPTOR}</strong>
            </p>
            <p>
              Billing support: <strong>{BILLING_SUPPORT_PHONE}</strong> · <strong>{BILLING_SUPPORT_EMAIL}</strong>
            </p>
          </div>
        ),
      },
      {
        heading: "Development Checkout",
        body: (
          <p>
            The current CCBill screen is a development placeholder only. It does
            not collect card information and does not create a real charge.
          </p>
        ),
      },
    ],
  },

  support: {
    title: "Support",
    kicker: "HELP",
    intro:
      "Use this page as the central public support destination for access, technical, billing, and content-related questions.",
    sections: [
      {
        heading: "General Support",
        body: (
          <p>
            Email: <strong>{SUPPORT_EMAIL}</strong>
          </p>
        ),
      },
      {
        heading: "Billing Support",
        body: (
          <p>
            Phone: <strong>{BILLING_SUPPORT_PHONE}</strong><br />
            Email: <strong>{BILLING_SUPPORT_EMAIL}</strong>
          </p>
        ),
      },
      {
        heading: "Content Complaints",
        body: (
          <p>
            Email: <strong>{COMPLAINTS_EMAIL}</strong>
          </p>
        ),
      },
      {
        heading: "Business Contact",
        body: (
          <div>
            <p>
              <strong>{BUSINESS_NAME}</strong>
            </p>
            <p>
              <strong>{BUSINESS_ADDRESS}</strong>
            </p>
          </div>
        ),
      },
      {
        heading: "Before Launch",
        body: (
          <p>
            Replace every bracketed placeholder on these pages with a monitored
            contact or verified business detail, and test each public support
            path before accepting payment.
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

function App() {
  const [ageVerified, setAgeVerified] =
    useState<boolean>(() => loadAgeVerification());

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

      if (path === "/studio-reset-password") {
        setAuthOpen(false);
        setPasswordResetOpen(true);
        return;
      }

      setPasswordResetOpen(false);

      if (path === "/studio-login") {
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
  }, [session]);

  const closeStudioLogin = () => {
    setAuthOpen(false);

    if (
      window.location.pathname ===
      "/studio-login"
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
      "/studio-login"
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
                window.location.pathname !==
                "/studio-reset-password"
              ) {
                window.history.replaceState(
                  {},
                  "",
                  "/studio-reset-password"
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
      ? databaseContent.slice(
          0,
          4
        )
      : fallbackNewReleases;

  const popularItems =
    databaseContent.length >
    0
      ? databaseContent.slice(
          0,
          4
        )
      : fallbackPopular;

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

  const showStudio =
    () => {
      if (
        session &&
        profile?.is_admin
      ) {
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
     AGE GATE + LEGAL NAVIGATION
     ======================================================= */

  const confirmAge = () => {
    try {
      window.localStorage.setItem(
        AGE_GATE_STORAGE_KEY,
        "true"
      );

      document.cookie = `${AGE_GATE_STORAGE_KEY}=true; Max-Age=31536000; Path=/; SameSite=Lax`;
    } catch (error) {
      console.warn(
        "Could not persist age verification:",
        error
      );
    }

    setAgeVerified(true);
  };

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
        onLegal={
          openLegalPage
        }
        onSubscribe={() =>
          setAccessOpen(
            true
          )
        }
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
  <section className="hero">
    {heroItem ? (
      <>
        {heroItem.thumbnailUrl ? <img className="hero-background" src={heroItem.thumbnailUrl} alt="" aria-hidden="true" /> : null}
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="hero-kicker">SPIKEYDEE VIP ORIGINAL</span>
          <h1>{publicHeroSettings.hero_title || heroItem.title}</h1>
          {(publicHeroSettings.hero_subtitle || heroItem.subtitle) && <p className="hero-subtitle">{publicHeroSettings.hero_subtitle || heroItem.subtitle}</p>}
          <p className="hero-description">{publicHeroSettings.hero_description || heroItem.description || "Watch the latest featured release from Spikeydee VIP."}</p>
          <div className="hero-meta">
            {heroItem.duration && <span>{heroItem.duration}</span>}
            {heroItem.category && <span>{heroItem.category}</span>}
            <span>VIP</span>
          </div>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={() => openItem(heroItem)}>{canWatchVideo(heroItem) ? "▶ Watch Now" : "View Release"}</button>
            <button type="button" className="secondary-button" onClick={() => setAccessOpen(true)}>{accessActive && membership.level !== "none" ? PLAN_LABELS[membership.level as PaidPlan] : "View Memberships"}</button>
          </div>
        </div>
      </>
    ) : (
      <>
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="hero-kicker">SPIKEYDEE VIP</span>
          <h1>Premium. Private. Yours.</h1>
        </div>
      </>
    )}
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
        POPULAR <strong>RELEASES</strong>
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
<section className="public-performers-section">
  <div className="public-performers-heading">
    <span className="public-performers-kicker">
      MEET THE TALENT
    </span>

    <h2>
      FEATURED <strong>PERFORMERS</strong>
    </h2>

    <p>
      Discover featured performers from SpikeyDeeVIP productions.
    </p>
  </div>

  <div className="public-performers-grid">
    <button
      type="button"
      className="public-performer-card"
      onClick={() => setAccessOpen(true)}
    >
      <div className="public-performer-placeholder">
        <span>SPIKEY DEE</span>
      </div>

      <div className="public-performer-info">
        <strong>Spikey Dee</strong>
        <span>FEATURED PERFORMER</span>
      </div>
    </button>

    <button
      type="button"
      className="public-performer-card"
      onClick={() => setAccessOpen(true)}
    >
      <div className="public-performer-placeholder">
        <span>COMING SOON</span>
      </div>

      <div className="public-performer-info">
        <strong>New Performer</strong>
        <span>COMING SOON</span>
      </div>
    </button>

    <button
      type="button"
      className="public-performer-card"
      onClick={() => setAccessOpen(true)}
    >
      <div className="public-performer-placeholder">
        <span>COMING SOON</span>
      </div>

      <div className="public-performer-info">
        <strong>New Performer</strong>
        <span>COMING SOON</span>
      </div>
    </button>

    <button
      type="button"
      className="public-performer-card"
      onClick={() => setAccessOpen(true)}
    >
      <div className="public-performer-placeholder">
        <span>COMING SOON</span>
      </div>

      <div className="public-performer-info">
        <strong>New Performer</strong>
        <span>COMING SOON</span>
      </div>
    </button>
  </div>
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
                <div id="featured">
                  <ContentRow
                    title="Featured"
                    items={featuredItems}
                    onOpen={openItem}
                    sectionId="featured"
                    canWatchVideo={canWatchVideo}
                    favorites={favorites}
                    onToggleFavorite={(item) => {
                      void toggleFavorite(item);
                    }}
                    favoriteBusyIds={favoriteBusyIds}
                  />
                </div>

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

                <div id="popular">
                  <ContentRow
                    title="Popular"
                    items={popularItems}
                    onOpen={openItem}
                    sectionId="popular"
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
                  Lifetime $225 one time • 12 months $119.88 one time • 30 days $29.99 • 2-day promotional pass $0.99, then $32.99 every 30 days until cancelled.
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

      {!ageVerified && (
        <AgeGate onConfirm={confirmAge} />
      )}

      <SiteFooter onLegal={openLegalPage} />
    </div>
  );
}

export default App;
