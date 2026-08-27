import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import * as tus from "tus-js-client";

import { supabase } from "./lib/supabase";
import "./App.css";

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

const CCBILL_CHECKOUT_URLS: Record<PaidPlan, string> = {
  lifetime: import.meta.env.VITE_CCBILL_LIFETIME_URL ?? "",
  twelve_month: import.meta.env.VITE_CCBILL_12_MONTH_URL ?? "",
  thirty_day: import.meta.env.VITE_CCBILL_30_DAY_URL ?? "",
  two_day_pass: import.meta.env.VITE_CCBILL_2_DAY_URL ?? "",
};

const AGE_GATE_STORAGE_KEY =
  "spikeydeevip-age-verified";

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
const RECORDS_CUSTODIAN_NAME = "[ADD RECORDS CUSTODIAN NAME]";
const RECORDS_CUSTODIAN_ADDRESS = "[ADD RECORDS CUSTODIAN ADDRESS]";
const BILLING_DESCRIPTOR = "[ADD CARD STATEMENT DESCRIPTOR]";

// Bunny Stream CDN hostname for this video library. This is public delivery
// configuration, not a secret API credential.
const BUNNY_STREAM_CDN_HOSTNAME = "vz-356f665c-64d.b-cdn.net";

const VIDEO_FILE =
  "/videos/video-output-6677BD65-1317-4C4E-9DF5-2BB89429679C-1.mov";

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

type AccessModalProps = {
  currentAccess: AccessLevel;
  initialEmail?: string;
  onClose: () => void;
  onStartCheckout: (plan: PaidPlan, email: string) => string | null;
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

  const continueToPlans = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      setNotice("Enter a valid email address to continue.");
      return;
    }
    setEmail(normalized);
    setNotice("");
    setStep(2);
  };

  const choosePlan = (plan: PaidPlan) => {
    const message = onStartCheckout(plan, email.trim().toLowerCase());
    if (message) setNotice(message);
  };

  const planCardStyle = {
    padding: "24px",
    border: "1px solid var(--border)",
    borderRadius: "18px",
    background: "var(--surface)",
    display: "flex",
    flexDirection: "column" as const,
    minHeight: "360px",
  };

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        overflowY: "auto",
        padding: "28px 18px",
        background: "rgba(0,0,0,.9)",
        backdropFilter: "blur(14px)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Choose Spikeydee VIP membership"
        style={{
          width: "min(1260px, 100%)",
          margin: "0 auto",
          padding: "30px",
          border: "1px solid var(--border)",
          borderRadius: "22px",
          background: "#0d0d0d",
          boxShadow: "0 35px 100px rgba(0,0,0,.7)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "20px",
          }}
        >
          <div>
            <span className="section-kicker">SPIKEYDEE VIP</span>
            <h2 style={{ margin: "8px 0 10px", fontSize: "32px" }}>
              {step === 1 ? "STEP 1 OF 2 — ENTER YOUR EMAIL" : "STEP 2 OF 2 — CHOOSE YOUR VIP ACCESS"}
            </h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              {step === 1
                ? "Enter the email you want associated with your Spikeydee VIP access."
                : `Membership options for ${email}.`}
            </p>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width: "42px",
              height: "42px",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              background: "#151515",
              color: "#fff",
            }}
          >
            ×
          </button>
        </div>

        {step === 1 ? (
          <form onSubmit={continueToPlans} style={{ maxWidth: "720px", margin: "34px auto 10px" }}>
            <label style={{ display: "block", fontWeight: 800, marginBottom: "10px" }}>
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              style={{
                width: "100%",
                minHeight: "58px",
                padding: "0 18px",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                background: "#080808",
                color: "#fff",
                fontSize: "18px",
              }}
            />

            <button
              type="submit"
              className="primary-button"
              style={{ width: "100%", marginTop: "24px", minHeight: "54px" }}
            >
              CONTINUE TO MEMBERSHIPS
            </button>
          </form>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "16px",
                marginTop: "28px",
              }}
            >
              <article style={{ ...planCardStyle, border: "2px solid rgba(255,255,255,.72)" }}>
                <span className="section-kicker">BEST VALUE</span>
                <h3 style={{ margin: "12px 0 8px", fontSize: "24px" }}>Lifetime Membership</h3>
                <div style={{ fontSize: "38px", fontWeight: 850 }}>{LIFETIME_PRICE}</div>
                <div style={{ color: "var(--text-muted)", marginTop: "2px" }}>/ lifetime</div>
                <p style={{ color: "var(--text-muted)", lineHeight: 1.6, marginTop: "18px", flex: 1 }}>
                  One-time payment of $225.00. Non-recurring. Full premium catalog access.
                </p>
                <button type="button" className="primary-button" onClick={() => choosePlan("lifetime")}>
                  START MEMBERSHIP
                </button>
              </article>

              <article style={planCardStyle}>
                <span className="section-kicker">12 MONTH MEMBERSHIP</span>
                <h3 style={{ margin: "12px 0 8px", fontSize: "24px" }}>12 Month Membership</h3>
                <div style={{ fontSize: "38px", fontWeight: 850 }}>{TWELVE_MONTH_MONTHLY_EQUIVALENT}</div>
                <div style={{ color: "var(--text-muted)", marginTop: "2px" }}>/ month</div>
                <p style={{ color: "var(--text-muted)", lineHeight: 1.6, marginTop: "18px", flex: 1 }}>
                  Billed as one payment of {TWELVE_MONTH_TOTAL} for 12 months of full premium access.
                </p>
                <button type="button" className="primary-button" onClick={() => choosePlan("twelve_month")}>
                  START MEMBERSHIP
                </button>
              </article>

              <article style={planCardStyle}>
                <span className="section-kicker">30 DAY MEMBERSHIP</span>
                <h3 style={{ margin: "12px 0 8px", fontSize: "24px" }}>30 Day Membership</h3>
                <div style={{ fontSize: "38px", fontWeight: 850 }}>{THIRTY_DAY_PRICE}</div>
                <div style={{ color: "var(--text-muted)", marginTop: "2px" }}>/ 30 days</div>
                <p style={{ color: "var(--text-muted)", lineHeight: 1.6, marginTop: "18px", flex: 1 }}>
                  Billed $29.99 every 30 days until cancelled. Full premium catalog access while active.
                </p>
                <button type="button" className="primary-button" onClick={() => choosePlan("thirty_day")}>
                  START MEMBERSHIP
                </button>
              </article>

              <article style={planCardStyle}>
                <span className="section-kicker">2 DAY PASS</span>
                <h3 style={{ margin: "12px 0 8px", fontSize: "24px" }}>2 Day Pass</h3>
                <div style={{ fontSize: "38px", fontWeight: 850 }}>{TWO_DAY_PRICE}</div>
                <div style={{ color: "var(--text-muted)", marginTop: "2px" }}>/ first 2 days</div>
                <p style={{ color: "var(--text-muted)", lineHeight: 1.6, marginTop: "18px", flex: 1 }}>
                  Initial 2-day promotional access. After 2 days, membership automatically renews at {TWO_DAY_RENEWAL_PRICE} every 30 days until cancelled.
                </p>
                <button type="button" className="primary-button" onClick={() => choosePlan("two_day_pass")}>
                  START MEMBERSHIP
                </button>
              </article>
            </div>

            <div
              style={{
                marginTop: "22px",
                padding: "16px 18px",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                background: "#111",
                color: "var(--text-muted)",
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: "#fff" }}>Billing disclosure:</strong>{" "}
              The 2 Day Pass is $0.99 for the first 2 days. After the promotional period it automatically renews at $32.99 every 30 days until cancelled. Recurring plans continue until cancelled according to the terms shown at checkout.
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => { setNotice(""); setStep(1); }}
              style={{ marginTop: "18px" }}
            >
              ← Change Email
            </button>
          </>
        )}

        {notice && (
          <div
            role="status"
            style={{
              marginTop: "20px",
              padding: "14px 16px",
              border: "1px solid rgba(255,255,255,.16)",
              borderRadius: "12px",
              background: "#111",
              lineHeight: 1.6,
            }}
          >
            {notice}
          </div>
        )}

        {currentAccess !== "none" && (
          <p style={{ marginTop: "18px", color: "var(--text-muted)" }}>
            Current access: {PLAN_LABELS[currentAccess as PaidPlan] ?? "VIP access"}
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
   STUDIO LOGIN
   ========================================================= */

type AuthModalProps = {
  onClose:
    () => void;
};

function AuthModal({
  onClose,
}: AuthModalProps) {
  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      setLoading(
        true
      );

      setErrorMessage(
        ""
      );

      const {
        error,
      } =
        await supabase.auth
          .signInWithPassword({
            email:
              email.trim(),

            password,
          });

      if (error) {
        setErrorMessage(
          error.message
        );

        setLoading(
          false
        );

        return;
      }

      setLoading(
        false
      );

      onClose();
    };

  return (
    <div
      role="presentation"
      style={{
        position:
          "fixed",

        inset:
          0,

        zIndex:
          1300,

        display:
          "grid",

        placeItems:
          "center",

        padding:
          "20px",

        background:
          "rgba(0,0,0,.86)",
      }}
    >
      <section
        style={{
          width:
            "min(430px,100%)",

          padding:
            "28px",

          background:
            "#0d0d0d",

          border:
            "1px solid var(--border)",

          borderRadius:
            "18px",
        }}
      >
        <span className="section-kicker">
          PRIVATE ADMIN
        </span>

        <h2>
          Studio Login
        </h2>

        <form
          onSubmit={
            handleSubmit
          }
        >
          <input
            required
            type="email"
            value={
              email
            }
            onChange={(
              event
            ) =>
              setEmail(
                event.target.value
              )
            }
            placeholder="Email"
            style={{
              width:
                "100%",

              height:
                "46px",

              marginBottom:
                "12px",

              padding:
                "0 14px",
            }}
          />

          <input
            required
            type="password"
            value={
              password
            }
            onChange={(
              event
            ) =>
              setPassword(
                event.target.value
              )
            }
            placeholder="Password"
            style={{
              width:
                "100%",

              height:
                "46px",

              padding:
                "0 14px",
            }}
          />

          {errorMessage && (
            <p
              style={{
                color:
                  "#ff7777",
              }}
            >
              {
                errorMessage
              }
            </p>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={
              loading
            }
            style={{
              width:
                "100%",

              marginTop:
                "18px",
            }}
          >
            {loading
              ? "Please wait..."
              : "Log In"}
          </button>
        </form>

        <button
          type="button"
          className="secondary-button"
          onClick={
            onClose
          }
          style={{
            marginTop:
              "12px",
          }}
        >
          Close
        </button>
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
              <span className="section-kicker">CATALOG</span>
              <h2>Studio Videos</h2>
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
                          <span className="section-kicker">FEATURED</span>
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
                      {video.is_featured ? "Remove Featured" : "Make Featured"}
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
  menuOpen:
    boolean;

  setMenuOpen:
    (
      value:
        boolean
    ) => void;

  searchOpen:
    boolean;

  setSearchOpen:
    (
      value:
        boolean
    ) => void;

  searchValue:
    string;

  setSearchValue:
    (
      value:
        string
    ) => void;

  onSearch:
    (
      event:
        FormEvent<HTMLFormElement>
    ) => void;

  onHome:
    () => void;

  onLegal:
    (page: LegalPageKey) => void;

  onSubscribe:
    () => void;

  session:
    Session | null;

  profile:
    Profile | null;

  onAccount:
    () => void;

  onStudio:
    () => void;

  onStudioLogin:
    () => void;

  onLogout:
    () => void;

  membership:
    MembershipState;

  accessActive:
    boolean;
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
  onAccount,
  onStudio,
  onStudioLogin,
  onLogout,
  membership,
  accessActive,
}: SiteHeaderProps) {
  const membershipLabel =
    accessActive && membership.level !== "none"
      ? PLAN_LABELS[membership.level as PaidPlan]
      : "Sign Up";

  return (
    <header className="site-header">
      <div className="header-inner">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={() =>
            setMenuOpen(
              !menuOpen
            )
          }
          aria-label="Open menu"
        >
          ☰
        </button>

        <button
          type="button"
          className="brand"
          onClick={
            onHome
          }
        >
          <span className="brand-main">
            SPIKEYDEE
          </span>

          <span className="brand-vip">
            VIP
          </span>
        </button>

        <nav
          className={`main-nav ${
            menuOpen
              ? "nav-open"
              : ""
          }`}
        >
          <button
            type="button"
            onClick={
              onHome
            }
          >
            Home
          </button>

          <button
            type="button"
            onClick={() =>
              onLegal("terms")
            }
          >
            Legal
          </button>

          <button
            type="button"
            onClick={
              onSubscribe
            }
          >
            {
              membershipLabel
            }
          </button>

          {profile?.is_admin && (
            <button
              type="button"
              onClick={
                onStudio
              }
            >
              Studio
            </button>
          )}
        </nav>

        <div className="header-actions">
          <button
            type="button"
            className="search-button"
            onClick={() =>
              setSearchOpen(
                !searchOpen
              )
            }
            aria-label="Search"
          >
            ⌕
          </button>

          <button
            type="button"
            className="signup-button"
            onClick={
              onSubscribe
            }
          >
            {accessActive
              ? `✓ ${membershipLabel}`
              : "Unlock VIP"}
          </button>

          {session ? (
            <>
              <button
                type="button"
                className="login-button"
                onClick={
                  onAccount
                }
              >
                Account
              </button>

              {profile?.is_admin && (
                <button
                  type="button"
                  className="login-button"
                  onClick={
                    onStudio
                  }
                >
                  Studio
                </button>
              )}

              <button
                type="button"
                className="login-button"
                onClick={
                  onLogout
                }
              >
                Log Out
              </button>
            </>
          ) : (
            <button
              type="button"
              className="login-button"
              onClick={
                onStudioLogin
              }
            >
              Studio Log In
            </button>
          )}
        </div>
      </div>

      {searchOpen && (
        <form
          className="search-panel"
          onSubmit={
            onSearch
          }
        >
          <input
            autoFocus
            type="search"
            value={
              searchValue
            }
            onChange={(
              event
            ) =>
              setSearchValue(
                event.target.value
              )
            }
            placeholder="Search Spikeydeevip..."
          />

          <button
            type="submit"
          >
            Search
          </button>
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5000,
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#050505",
      }}
    >
      <section
        style={{
          width: "min(620px, 100%)",
          padding: "38px",
          border: "1px solid var(--border)",
          borderRadius: "22px",
          background: "#0d0d0d",
          textAlign: "center",
          boxShadow: "0 35px 100px rgba(0,0,0,.75)",
        }}
      >
        <span className="section-kicker">SPIKEYDEE VIP</span>

        <h1
          id="age-gate-title"
          style={{
            margin: "14px 0 12px",
            fontSize: "clamp(34px, 7vw, 64px)",
            lineHeight: 1,
          }}
        >
          Adults Only
        </h1>

        <p
          style={{
            maxWidth: "500px",
            margin: "0 auto",
            color: "var(--text-muted)",
            lineHeight: 1.7,
            fontSize: "16px",
          }}
        >
          This website contains adult material intended only for people who are
          18 years of age or older. By entering, you confirm that you are at
          least 18 and agree to follow the site Terms and Privacy Policy.
        </p>

        <div
          style={{
            display: "grid",
            gap: "12px",
            marginTop: "28px",
          }}
        >
          <button
            type="button"
            className="primary-button"
            onClick={onConfirm}
            style={{ width: "100%" }}
          >
            ENTER — I AM 18+
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={leaveSite}
            style={{ width: "100%" }}
          >
            EXIT
          </button>
        </div>

        <p
          style={{
            margin: "18px 0 0",
            color: "var(--text-muted)",
            fontSize: "12px",
            lineHeight: 1.5,
          }}
        >
          Age confirmation is stored on this browser so you do not need to
          confirm again on every refresh.
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
    title: "18 U.S.C. § 2257 Records Notice",
    kicker: "RECORDKEEPING",
    intro:
      "This page is a production placeholder for the studio's final records-compliance notice. The exact notice depends on the content, producer status, and recordkeeping arrangement that actually apply.",
    sections: [
      {
        heading: "Records Custodian",
        body: (
          <div>
            <p>
              Records custodian: <strong>{RECORDS_CUSTODIAN_NAME}</strong>
            </p>
            <p>
              Records location: <strong>{RECORDS_CUSTODIAN_ADDRESS}</strong>
            </p>
          </div>
        ),
      },
      {
        heading: "Production Notice",
        body: (
          <p>
            Before launch, insert the legally accurate statement addressing 18
            U.S.C. §§ 2257 and 2257A, including any applicable producer,
            secondary-producer, exemption, or record-location language.
          </p>
        ),
      },
      {
        heading: "No Placeholder Publication",
        body: (
          <p>
            Do not launch with placeholder custodian names or addresses. The
            final notice should be reviewed against the studio's real performer
            age-verification and recordkeeping practices.
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
    <footer className="site-footer">
      <div className="footer-brand">
        <span>SPIKEYDEE</span>
        <strong>VIP</strong>
      </div>

      <div className="footer-links">
        <button type="button" onClick={() => onLegal("terms")}>Terms</button>
        <button type="button" onClick={() => onLegal("privacy")}>Privacy</button>
        <button type="button" onClick={() => onLegal("2257")}>2257</button>
        <button type="button" onClick={() => onLegal("content-removal")}>
          Content Removal & Complaints
        </button>
        <button type="button" onClick={() => onLegal("billing")}>
          Billing, Cancellation & Refunds
        </button>
        <button type="button" onClick={() => onLegal("support")}>Support</button>
      </div>

      <p>Adults 18+ only.</p>
      <p>© 2026 Spikeydeevip. All rights reserved.</p>
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

  const accessActive = twoDayActive || fullMembershipActive;

  const adminAccess = profile?.is_admin === true;

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

  const beginCcbillCheckout = (plan: PaidPlan, email: string): string | null => {
    const checkoutUrl = CCBILL_CHECKOUT_URLS[plan];

    sessionStorage.setItem(
      PENDING_CHECKOUT_STORAGE_KEY,
      JSON.stringify({ plan, email, startedAt: new Date().toISOString() })
    );

    if (!checkoutUrl) {
      return (
        `CCBill checkout for ${PLAN_LABELS[plan]} is not configured yet. ` +
        `Add the corresponding VITE_CCBILL_* URL to .env.local after CCBill gives you the hosted payment-form link.`
      );
    }

    window.location.assign(checkoutUrl);
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
            _event,
            nextSession
          ) => {
            setSession(
              nextSession
            );

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
  }, []);

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

  const heroItem =
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
        onStudio={
          showStudio
        }
        onStudioLogin={() =>
          setAuthOpen(
            true
          )
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
          <section className="hero">
            <div className="hero-overlay" />

            <div className="hero-content">
              <span className="hero-kicker">
                SPIKEYDEE VIP ORIGINAL
              </span>

              <h1>
                Premium.
                <br />
                Private.
                <br />
                Yours.
              </h1>

              <p className="hero-description">
                Browse the catalog, choose your membership, and unlock premium
                Spikeydee VIP releases through secure CCBill checkout.
              </p>

              <div className="hero-meta">
                <span>
                  2 Day Pass
                </span>

                <span>
                  {TWO_DAY_PRICE}
                </span>

                <span>
                  •
                </span>

                <span>
                  VIP Memberships
                </span>

                <span>
                  From {TWO_DAY_PRICE}
                </span>
              </div>

              <div className="hero-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    openItem(
                      heroItem
                    )
                  }
                >
                  {canWatchVideo(
                    heroItem
                  )
                    ? "▶ Watch Now"
                    : "🔒 View Premium"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setAccessOpen(
                      true
                    )
                  }
                >
                  {accessActive && membership.level !== "none"
                    ? `✓ ${PLAN_LABELS[membership.level as PaidPlan]}`
                    : "Choose Membership"}
                </button>
              </div>
            </div>
          </section>

          <div className="content-wrapper">
            {catalogLoading && (
              <p
                style={{
                  textAlign:
                    "center",
                }}
              >
                Loading catalog...
              </p>
            )}

            <div id="featured">
              <ContentRow
                title="Featured"
                items={
                  featuredItems
                }
                onOpen={
                  openItem
                }
                sectionId="featured"
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
            </div>

            <div id="new">
              <ContentRow
                title="New Releases"
                items={
                  newReleaseItems
                }
                onOpen={
                  openItem
                }
                sectionId="new"
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
            </div>

            <div id="popular">
              <ContentRow
                title="Popular"
                items={
                  popularItems
                }
                onOpen={
                  openItem
                }
                sectionId="popular"
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
            </div>

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

      {authOpen && (
        <AuthModal
          onClose={() =>
            setAuthOpen(
              false
            )
          }
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