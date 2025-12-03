// netlify/functions/contact.js
// Gestion messages de contact + envoi emails

const { neon } = require('@neondatabase/serverless');
const nodemailer = require('nodemailer');

const sql = neon(process.env.DATABASE_URL);

// Configuration email
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'parfaitguiri@gmail.com',
    pass: process.env.SMTP_PASS // App password Gmail
  }
});

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/contact', '');
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    // ENVOYER MESSAGE
    if (event.httpMethod === 'POST' && path === '/send') {
      const { name, email, whatsapp, message } = body;

      if (!name || !email || !message) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Données manquantes' })
        };
      }

      // Sauvegarder dans DB
      const result = await sql`
        INSERT INTO messages (name, email, whatsapp, message, is_read)
        VALUES (${name}, ${email}, ${whatsapp}, ${message}, false)
        RETURNING id, created_at
      `;

      // Envoyer email notification à l'admin
      try {
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: 'parfaitguiri@gmail.com',
          subject: `🔔 Nouveau message de ${name}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
              <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #8a2be2;">📧 Nouveau Message Contact</h2>
                <hr style="border: 1px solid #e0e0e0;">
                <p><strong>Nom:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                ${whatsapp ? `<p><strong>WhatsApp:</strong> ${whatsapp}</p>` : ''}
                <p><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</p>
                <hr style="border: 1px solid #e0e0e0;">
                <h3>Message:</h3>
                <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #8a2be2; margin: 15px 0;">
                  ${message}
                </div>
                <hr style="border: 1px solid #e0e0e0;">
                <p style="color: #666; font-size: 12px;">
                  Accédez au dashboard pour répondre: 
                  <a href="https://votre-site.netlify.app/admin">Dashboard Admin</a>
                </p>
              </div>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Email error:', emailError);
        // Continue même si email échoue
      }

      // Envoyer email de confirmation au client
      try {
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: email,
          subject: '✅ Message reçu - GPS&ANALYTICS Neo-Lab',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
              <div style="background: linear-gradient(135deg, #0a0014 0%, #1a0033 100%); padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto; color: #e0e0ff;">
                <h2 style="color: #00d4ff;">⚡ GPS&ANALYTICS_MARKETING Neo-Lab</h2>
                <hr style="border: 1px solid rgba(138, 43, 226, 0.3);">
                <p>Bonjour <strong>${name}</strong>,</p>
                <p>Merci de nous avoir contactés ! Votre message a bien été reçu.</p>
                <p>Je vous répondrai dans les plus brefs délais (généralement sous 24h).</p>
                <hr style="border: 1px solid rgba(138, 43, 226, 0.3);">
                <p><strong>Votre message :</strong></p>
                <div style="background: rgba(138, 43, 226, 0.2); padding: 15px; border-left: 4px solid #00d4ff; margin: 15px 0;">
                  ${message}
                </div>
                <hr style="border: 1px solid rgba(138, 43, 226, 0.3);">
                <p style="color: #00d4ff;"><strong>Parfait Guiri</strong></p>
                <p style="font-size: 14px;">
                  📞 +225 05 55 70 94 75<br>
                  ✉️ parfaitguiri@gmail.com
                </p>
              </div>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Confirmation email error:', emailError);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Message envoyé avec succès',
          messageId: result[0].id
        })
      };
    }

    // LIRE TOUS LES MESSAGES (Admin)
    if (event.httpMethod === 'GET' && path === '/all') {
      const messages = await sql`
        SELECT * FROM messages
        ORDER BY created_at DESC
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          messages: messages
        })
      };
    }

    // MARQUER COMME LU
    if (event.httpMethod === 'PUT' && path.startsWith('/read/')) {
      const messageId = path.replace('/read/', '');

      await sql`
        UPDATE messages
        SET is_read = true
        WHERE id = ${messageId}
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Message marqué comme lu'
        })
      };
    }

    // SUPPRIMER MESSAGE
    if (event.httpMethod === 'DELETE' && path.startsWith('/delete/')) {
      const messageId = path.replace('/delete/', '');

      await sql`
        DELETE FROM messages WHERE id = ${messageId}
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Message supprimé'
        })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route non trouvée' })
    };

  } catch (error) {
    console.error('Contact error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur serveur', details: error.message })
    };
  }
};
