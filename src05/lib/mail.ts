export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

export async function sendEmail({ to, subject, text, html }: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const configuredFromEmail = process.env.EMAIL_FROM?.trim();
  const defaultFromEmail = "onboarding@resend.dev";
  const fromEmail = configuredFromEmail && !configuredFromEmail.toLowerCase().endsWith("@gmail.com")
    ? configuredFromEmail
    : defaultFromEmail;

  if (!apiKey) {
    const error = "RESEND_API_KEY is not configured.";
    console.warn("Resend email skipped:", error);
    return { success: false, error };
  }

  if (!configuredFromEmail) {
    console.warn("EMAIL_FROM not set; using Resend default sender:", defaultFromEmail);
  } else if (fromEmail !== configuredFromEmail) {
    console.warn(
      "Configured EMAIL_FROM uses gmail.com, which requires a verified domain on Resend. Falling back to:",
      defaultFromEmail,
    );
  }

  const body: any = {
    from: fromEmail,
    to,
    subject,
    text,
  };

  if (html) body.html = html;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    const error = `Resend email failed: ${errorText}`;
    console.error(error);
    return { success: false, error };
  }

  return { success: true };
}

/** Escape text before placing it inside the HTML email. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Zola-branded HTML email. Plain, table-based markup with inline styles so
 * it renders consistently in Gmail, Outlook and mobile mail apps.
 */
export function emailLayout(opts: {
  heading: string;
  intro: string;
  rows?: [string, string][];
  totalRow?: [string, string];
  cta?: { label: string; url: string };
  note?: string;
}): string {
  const rows = (opts.rows || [])
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#54708A;font-size:14px;">${esc(k)}</td><td style="padding:8px 0;color:#102A43;font-size:14px;font-weight:600;text-align:right;">${esc(v)}</td></tr>`
    )
    .join("");
  const total = opts.totalRow
    ? `<tr><td style="padding:12px 0 4px;border-top:1px solid #E9EEF4;color:#102A43;font-size:15px;font-weight:700;">${esc(opts.totalRow[0])}</td><td style="padding:12px 0 4px;border-top:1px solid #E9EEF4;color:#102A43;font-size:17px;font-weight:700;text-align:right;">${esc(opts.totalRow[1])}</td></tr>`
    : "";
  const table = rows || total
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 4px;border-collapse:collapse;">${rows}${total}</table>`
    : "";
  const cta = opts.cta
    ? `<p style="margin:24px 0 0;"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:#087F5B;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:10px;">${esc(opts.cta.label)}</a></p>`
    : "";
  const note = opts.note
    ? `<p style="margin:22px 0 0;padding:12px 14px;background:#E6F7F1;border-radius:10px;color:#05593F;font-size:14px;line-height:1.5;">${esc(opts.note)}</p>`
    : "";

  return `<!doctype html><html><body style="margin:0;padding:0;background:#F8FAFC;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:'Plus Jakarta Sans',-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
<tr><td style="padding:0 4px 16px;font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#087F5B;">Zola</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #D9E2EC;border-radius:14px;padding:28px 24px;">
<h1 style="margin:0 0 10px;font-size:21px;line-height:1.25;color:#102A43;font-weight:700;">${esc(opts.heading)}</h1>
<p style="margin:0;color:#334E68;font-size:15px;line-height:1.6;">${esc(opts.intro)}</p>
${table}${cta}${note}
</td></tr>
<tr><td style="padding:18px 4px 0;color:#627D98;font-size:13px;line-height:1.5;">Zola &mdash; Secure transactions. Simple payments.</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
