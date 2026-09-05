import { Resend } from "resend";

export async function sendNewLeadAlert(
  subject: string,
  text: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;

  if (!apiKey || !to) {
    return;
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "HoraCerta <onboarding@resend.dev>",
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error("Falha ao enviar alerta de novo lead:", error);
  }
}
