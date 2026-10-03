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
