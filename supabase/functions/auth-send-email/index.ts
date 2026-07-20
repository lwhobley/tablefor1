import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type EmailActionType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email"
  | "reauthentication"
  | "password_changed_notification"
  | "email_changed_notification"
  | "phone_changed_notification"
  | "identity_linked_notification"
  | "identity_unlinked_notification"
  | "mfa_factor_enrolled_notification"
  | "mfa_factor_unenrolled_notification";

type HookPayload = {
  user: { id: string; email: string; new_email?: string; updated_at?: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
    old_email?: string;
    old_phone?: string;
    provider?: string;
    factor_type?: string;
  };
};

type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencySource: string;
};

type TemplateCopy = {
  subject: string;
  preview: string;
  heading: string;
  intro: string;
  button?: string;
  securityNote: string;
  showCode?: boolean;
  showHowItWorks?: boolean;
};

const DEFAULT_LOGO_URL =
  "https://raw.githubusercontent.com/lwhobley/tablefor1/main/assets/images/table_for_2_logo.png";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeEmailHeader(value: unknown): string {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

function confirmationUrl(
  supabaseUrl: string,
  action: EmailActionType,
  tokenHash: string,
  redirectTo: string,
): string {
  const url = new URL("/auth/v1/verify", supabaseUrl);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", action);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

function templateCopy(action: EmailActionType): TemplateCopy {
  const templates: Record<EmailActionType, TemplateCopy> = {
    signup: {
      subject: "Confirm your Table for 2 account",
      preview:
        "Confirm your email and finish creating your Table for 2 account.",
      heading: "Confirm your email",
      intro:
        "Confirm this email address to finish creating your Table for 2 account. After confirmation, you can complete your dining profile and start exploring tables.",
      button: "Confirm my email",
      securityNote:
        "If you did not create a Table for 2 account, you can safely ignore this email.",
      showHowItWorks: true,
    },
    invite: {
      subject: "You are invited to Table for 2",
      preview: "Accept your invitation to join Table for 2.",
      heading: "Your seat is waiting",
      intro: "You have been invited to create a Table for 2 account.",
      button: "Accept invitation",
      securityNote:
        "If you were not expecting this invitation, you can ignore this email.",
    },
    magiclink: {
      subject: "Your Table for 2 sign-in link",
      preview: "Use this secure link to sign in to Table for 2.",
      heading: "Sign in to Table for 2",
      intro:
        "Use the secure link below to sign in. The link expires shortly and can be used once.",
      button: "Sign in",
      securityNote:
        "If you did not request this link, you can safely ignore this email.",
      showCode: true,
    },
    email: {
      subject: "Your Table for 2 verification link",
      preview: "Verify your email to continue to Table for 2.",
      heading: "Verify your email",
      intro: "Use the secure link below to continue to Table for 2.",
      button: "Verify email",
      securityNote:
        "If you did not request this message, you can safely ignore it.",
      showCode: true,
    },
    recovery: {
      subject: "Reset your Table for 2 password",
      preview: "Choose a new password for your Table for 2 account.",
      heading: "Reset your password",
      intro: "We received a request to reset your Table for 2 password.",
      button: "Reset password",
      securityNote:
        "If you did not request a password reset, you can safely ignore this email. Your password will not change.",
    },
    email_change: {
      subject: "Confirm your Table for 2 email change",
      preview: "Confirm the email address for your Table for 2 account.",
      heading: "Confirm your email change",
      intro:
        "Use the secure link below to confirm this email address for your Table for 2 account.",
      button: "Confirm email change",
      securityNote:
        "If you did not request this change, do not use the link and review your account security.",
    },
    reauthentication: {
      subject: "Your Table for 2 verification code",
      preview: "Use this code to verify your identity.",
      heading: "Verify it is you",
      intro: "Enter this one-time code in Table for 2 to continue.",
      securityNote:
        "If you did not request this code, do not share it with anyone.",
      showCode: true,
    },
    password_changed_notification: {
      subject: "Your Table for 2 password was changed",
      preview: "A security update was made to your Table for 2 account.",
      heading: "Password changed",
      intro:
        "The password for your Table for 2 account was changed successfully.",
      securityNote:
        "If this was not you, reset your password and contact support immediately.",
    },
    email_changed_notification: {
      subject: "Your Table for 2 email was changed",
      preview: "A security update was made to your Table for 2 account.",
      heading: "Email address changed",
      intro:
        "The email address for your Table for 2 account was changed successfully.",
      securityNote: "If this was not you, contact support immediately.",
    },
    phone_changed_notification: {
      subject: "Your Table for 2 phone number was changed",
      preview: "A security update was made to your Table for 2 account.",
      heading: "Phone number changed",
      intro:
        "The phone number for your Table for 2 account was changed successfully.",
      securityNote: "If this was not you, contact support immediately.",
    },
    identity_linked_notification: {
      subject: "A sign-in method was linked to Table for 2",
      preview: "A security update was made to your Table for 2 account.",
      heading: "Sign-in method linked",
      intro: "A new sign-in method was linked to your Table for 2 account.",
      securityNote:
        "If this was not you, review your account security immediately.",
    },
    identity_unlinked_notification: {
      subject: "A sign-in method was removed from Table for 2",
      preview: "A security update was made to your Table for 2 account.",
      heading: "Sign-in method removed",
      intro: "A sign-in method was removed from your Table for 2 account.",
      securityNote:
        "If this was not you, review your account security immediately.",
    },
    mfa_factor_enrolled_notification: {
      subject: "Two-step verification was added to Table for 2",
      preview: "A security update was made to your Table for 2 account.",
      heading: "Two-step verification added",
      intro:
        "A new two-step verification method was added to your Table for 2 account.",
      securityNote:
        "If this was not you, review your account security immediately.",
    },
    mfa_factor_unenrolled_notification: {
      subject: "Two-step verification was removed from Table for 2",
      preview: "A security update was made to your Table for 2 account.",
      heading: "Two-step verification removed",
      intro:
        "A two-step verification method was removed from your Table for 2 account.",
      securityNote:
        "If this was not you, review your account security immediately.",
    },
  };

  return templates[action];
}

function emailHtml(
  copy: TemplateCopy,
  logoUrl: string,
  actionUrl?: string,
  token?: string,
): string {
  const safeLogoUrl = escapeHtml(logoUrl);
  const safeActionUrl = actionUrl ? escapeHtml(actionUrl) : "";
  const safeToken = token ? escapeHtml(token) : "";
  const actionButton = copy.button && safeActionUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 24px 0;"><tr><td style="background:#b94f32;border-radius:6px;"><a href="${safeActionUrl}" style="display:inline-block;padding:14px 24px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">${
      escapeHtml(copy.button)
    }</a></td></tr></table>`
    : "";
  const codeBlock = copy.showCode && safeToken
    ? `<p style="margin:22px 0 8px 0;color:#62594f;font-size:13px;">One-time code</p><p style="margin:0 0 24px 0;padding:14px 18px;background:#f7f2ec;border:1px solid #e8ddd2;border-radius:6px;color:#1f1b16;font-family:Consolas,Monaco,monospace;font-size:24px;font-weight:700;letter-spacing:4px;text-align:center;">${safeToken}</p>`
    : "";
  const howItWorks = copy.showHowItWorks
    ? `<div style="margin:28px 0 0 0;padding-top:24px;border-top:1px solid #eadfd4;">
        <h2 style="margin:0 0 14px 0;color:#1f1b16;font-size:18px;line-height:1.35;">What happens next</h2>
        <p style="margin:0 0 10px 0;color:#51483f;font-size:15px;"><strong>1. Build your dining profile.</strong> Share your food preferences, conversation style, dietary needs, and neighborhood.</p>
        <p style="margin:0 0 10px 0;color:#51483f;font-size:15px;"><strong>2. Choose a table.</strong> Browse curated dinners, brunches, food crawls, and mystery experiences in your city.</p>
        <p style="margin:0;color:#51483f;font-size:15px;"><strong>3. Meet your people.</strong> Get your match details, check in at the restaurant, and reconnect after dinner when the feeling is mutual.</p>
      </div>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(copy.subject)}</title>
  </head>
  <body style="margin:0;background:#f7f2ec;color:#1f1b16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.6;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${
    escapeHtml(copy.preview)
  }</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f2ec;">
      <tr><td align="center" style="padding:28px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e8ddd2;border-radius:8px;">
          <tr><td style="padding:28px 32px 12px 32px;text-align:center;"><img src="${safeLogoUrl}" width="210" alt="Table for 2" style="display:inline-block;width:210px;max-width:70%;height:auto;border:0;"></td></tr>
          <tr><td style="padding:12px 32px 32px 32px;">
            <h1 style="margin:0 0 14px 0;color:#1f1b16;font-size:28px;line-height:1.25;">${
    escapeHtml(copy.heading)
  }</h1>
            <p style="margin:0;color:#51483f;font-size:16px;">${
    escapeHtml(copy.intro)
  }</p>
            ${actionButton}${codeBlock}${howItWorks}
            <p style="margin:28px 0 0 0;padding-top:20px;border-top:1px solid #eadfd4;color:#7a6f64;font-size:13px;">${
    escapeHtml(copy.securityNote)
  }</p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0 0;color:#8c7f73;font-size:12px;">Table for 2 &copy; ${
    new Date().getUTCFullYear()
  }</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

function emailText(
  copy: TemplateCopy,
  actionUrl?: string,
  token?: string,
): string {
  const lines = [copy.heading, "", copy.intro];
  if (copy.button && actionUrl) lines.push("", `${copy.button}: ${actionUrl}`);
  if (copy.showCode && token) lines.push("", `One-time code: ${token}`);
  if (copy.showHowItWorks) {
    lines.push(
      "",
      "What happens next",
      "1. Build your dining profile with your preferences, dietary needs, and conversation style.",
      "2. Browse and book curated dining experiences in your city.",
      "3. Get your match details, meet at the table, and reconnect after dinner when it is mutual.",
    );
  }
  lines.push("", copy.securityNote, "", "Table for 2");
  return lines.join("\n");
}

function makeMessage(
  to: string,
  copy: TemplateCopy,
  logoUrl: string,
  idempotencySource: string,
  actionUrl?: string,
  token?: string,
): EmailMessage {
  return {
    to,
    subject: sanitizeEmailHeader(copy.subject),
    html: emailHtml(copy, logoUrl, actionUrl, token),
    text: emailText(copy, actionUrl, token),
    idempotencySource,
  };
}

function buildMessages(
  payload: HookPayload,
  supabaseUrl: string,
  logoUrl: string,
): EmailMessage[] {
  const { user, email_data: emailData } = payload;
  const action = emailData.email_action_type;
  const copy = templateCopy(action);

  if (action === "email_change") {
    const newEmail = user.new_email?.trim();
    if (newEmail && emailData.token_hash_new && emailData.token_new) {
      return [
        makeMessage(
          user.email,
          copy,
          logoUrl,
          `${user.id}:${action}:current:${emailData.token_hash_new}`,
          confirmationUrl(
            supabaseUrl,
            action,
            emailData.token_hash_new,
            emailData.redirect_to,
          ),
          emailData.token,
        ),
        makeMessage(
          newEmail,
          copy,
          logoUrl,
          `${user.id}:${action}:new:${emailData.token_hash}`,
          confirmationUrl(
            supabaseUrl,
            action,
            emailData.token_hash,
            emailData.redirect_to,
          ),
          emailData.token_new,
        ),
      ];
    }

    if (!newEmail) {
      throw new Error("Email change payload is missing the new email address");
    }
    const token = emailData.token_new || emailData.token;
    return [
      makeMessage(
        newEmail,
        copy,
        logoUrl,
        `${user.id}:${action}:${emailData.token_hash}`,
        confirmationUrl(
          supabaseUrl,
          action,
          emailData.token_hash,
          emailData.redirect_to,
        ),
        token,
      ),
    ];
  }

  const notification = action.endsWith("_notification");
  const codeOnly = action === "reauthentication";
  const actionUrl = notification || codeOnly ? undefined : confirmationUrl(
    supabaseUrl,
    action,
    emailData.token_hash,
    emailData.redirect_to,
  );

  return [
    makeMessage(
      user.email,
      copy,
      logoUrl,
      `${user.id}:${action}:${
        emailData.token_hash ||
        emailData.token ||
        user.updated_at ||
        emailData.old_email ||
        emailData.old_phone ||
        emailData.provider ||
        emailData.factor_type
      }`,
      actionUrl,
      emailData.token,
    ),
  ];
}

async function idempotencyKey(source: string): Promise<string> {
  const bytes = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `auth-email-${hex}`;
}

function errorResponse(message: string, status: number): Response {
  return Response.json(
    { error: { http_code: status, message } },
    { status, headers: { "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const fromEmail = sanitizeEmailHeader(
    Deno.env.get("AUTH_FROM_EMAIL") ??
      Deno.env.get("WELCOME_FROM_EMAIL") ??
      Deno.env.get("ADMIN_EMAIL"),
  );
  const logoUrl = Deno.env.get("AUTH_EMAIL_LOGO_URL") ?? DEFAULT_LOGO_URL;

  if (!resendApiKey || !hookSecret || !supabaseUrl || !fromEmail) {
    console.error("Missing Auth email configuration");
    return errorResponse("Email service not configured", 500);
  }

  const rawBody = await req.text();
  let payload: HookPayload;
  try {
    const secret = hookSecret.replace("v1,whsec_", "");
    payload = new Webhook(secret).verify(
      rawBody,
      Object.fromEntries(req.headers),
    ) as HookPayload;
  } catch (error) {
    console.error("Invalid Auth email hook signature:", error);
    return errorResponse("Invalid webhook signature", 401);
  }

  try {
    const messages = buildMessages(payload, supabaseUrl, logoUrl);
    for (const message of messages) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": await idempotencyKey(message.idempotencySource),
        },
        body: JSON.stringify({
          from: fromEmail,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });

      if (!response.ok) {
        console.error(
          "Resend Auth email error:",
          response.status,
          await response.text(),
        );
        return errorResponse("Failed to send authentication email", 502);
      }
    }

    return Response.json({});
  } catch (error) {
    console.error("auth-send-email error:", error);
    return errorResponse("Failed to process authentication email", 500);
  }
});
