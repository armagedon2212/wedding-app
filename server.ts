import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

// Pobieranie zmiennej z .env lub przypisanie nulla w przypadku braku
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API do wysyłania zaproszeń
  app.post("/api/invite", async (req, res) => {
    try {
      const { email, inviteUrl } = req.body;

      if (!email || !inviteUrl) {
        return res.status(400).json({ error: "Missing email or inviteUrl" });
      }

      if (!resend) {
        return res.status(500).json({ error: "Serwer nie ma skonfigurowanego klucza RESEND_API_KEY. Ustaw go w ustawieniach środowiska." });
      }

      const htmlTemplate = `
        <div style="font-family: 'Georgia', serif; color: #4A5D4E; max-width: 600px; margin: 0 auto; text-align: center; background-color: #FDFBF7; padding: 40px; border-radius: 12px; border: 1px solid #EAE8E2;">
          <h1 style="font-size: 28px; font-weight: normal; font-style: italic; margin-bottom: 20px;">Zaproszenie</h1>
          <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #666; margin-bottom: 30px;">
            Otrzymałeś zaproszenie do zarządzania Pamiątką Ślubną Elizy i Miłosza! <br/>
            Kliknij poniższy przycisk, aby utworzyć konto i dołączyć do naszego panelu.
          </p>
          <a href="${inviteUrl}" style="display: inline-block; background-color: #4A5D4E; color: #ffffff; text-decoration: none; padding: 14px 28px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-radius: 30px;">
            Załóż Konto
          </a>
          <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; color: #999; margin-top: 40px;">
            Jeśli nie spodziewałeś się tej wiadomości, możesz ją bezpiecznie zignorować.
          </p>
        </div>
      `;

      const data = await resend.emails.send({
        from: "Zaproszenie Ślubne <onboarding@resend.dev>",
        to: [email],
        subject: "Zaproszenie do Panelu Ślubnego - Eliza & Miłosz",
        html: htmlTemplate,
      });

      res.status(200).json({ success: true, data });
    } catch (error: any) {
      console.error("Błąd wysyłania emaila:", error);
      res.status(500).json({ error: error.message || "Wystąpił błąd podczas wysyłania zaproszenia." });
    }
  });

  // Vite middleware dla developmentu
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
