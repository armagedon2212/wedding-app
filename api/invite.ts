import { Resend } from "resend";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return res.status(500).json({ error: "RESEND_API_KEY is not configured on Vercel" });
  }

  const resend = new Resend(resendApiKey);

  try {
    const { email, inviteUrl } = req.body;

    if (!email || !inviteUrl) {
      return res.status(400).json({ error: "Missing email or inviteUrl" });
    }

    const htmlTemplate = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4A5D4E;">Zaproszenie do Panelu Administracyjnego</h2>
        <p>Zostałeś dodany jako administrator w panelu ślubnym Elizy i Miłosza.</p>
        <p>Kliknij poniższy link, aby ustawić hasło i uzyskać dostęp:</p>
        <div style="margin: 30px 0;">
          <a href="${inviteUrl}" style="background-color: #4A5D4E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Akceptuj zaproszenie
          </a>
        </div>
        <p style="color: #666; font-size: 12px;">Jeśli przycisk nie działa, skopiuj ten link: <br/> ${inviteUrl}</p>
      </div>
    `;

    const data = await resend.emails.send({
      from: "Zaproszenie Ślubne <zaproszenie@miloszeliza.pl>",
      to: [email],
      subject: "Zaproszenie do Panelu Ślubnego - Eliza & Miłosz",
      html: htmlTemplate,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Resend error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
}
