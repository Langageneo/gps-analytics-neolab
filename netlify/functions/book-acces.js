// netlify/functions/book-access.js
// Gestion accès au livre LangageNeo (Standard vs Premium)

const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

const sql = neon(process.env.DATABASE_URL);
const JWT_SECRET = process.env.JWT_SECRET || 'votre-secret-super-securise';

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/book-access', '');

  try {
    // Vérifier token
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Token manquant' })
      };
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Token invalide' })
      };
    }

    const userId = decoded.userId;

    // VÉRIFIER ACCÈS
    if (event.httpMethod === 'GET' && path === '/check') {
      // Vérifier si l'utilisateur a acheté le livre
      const purchases = await sql`
        SELECT * FROM book_access 
        WHERE user_id = ${userId} 
        AND access_type = 'full'
      `;

      // Vérifier si l'utilisateur a un abonnement actif
      const subscriptions = await sql`
        SELECT * FROM subscriptions 
        WHERE user_id = ${userId} 
        AND status = 'active' 
        AND end_date > NOW()
        ORDER BY end_date DESC LIMIT 1
      `;

      const hasPurchased = purchases.length > 0;
      const hasActiveSubscription = subscriptions.length > 0;
      const hasAccess = hasPurchased || hasActiveSubscription;

      let accessType = 'none';
      let expiryDate = null;

      if (hasPurchased) {
        accessType = 'full'; // Accès permanent
      } else if (hasActiveSubscription) {
        accessType = 'subscription'; // Accès abonnement
        expiryDate = subscriptions[0].end_date;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          hasAccess: hasAccess,
          accessType: accessType,
          expiryDate: expiryDate,
          message: hasAccess 
            ? 'Accès autorisé' 
            : 'Veuillez acheter le livre ou souscrire un abonnement'
        })
      };
    }

    // OBTENIR LE PDF (pour utilisateurs premium)
    if (event.httpMethod === 'GET' && path === '/download') {
      // Vérifier accès
      const purchases = await sql`
        SELECT * FROM book_access 
        WHERE user_id = ${userId} 
        AND access_type = 'full'
      `;

      const subscriptions = await sql`
        SELECT * FROM subscriptions 
        WHERE user_id = ${userId} 
        AND status = 'active' 
        AND end_date > NOW()
      `;

      if (purchases.length === 0 && subscriptions.length === 0) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ 
            error: 'Accès refusé. Veuillez acheter le livre ou souscrire un abonnement.' 
          })
        };
      }

      // TODO: Retourner URL signée pour télécharger le PDF
      // Pour l'instant, retourner URL du fichier
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          downloadUrl: '/assets/langageneo.pdf',
          message: 'Téléchargement autorisé'
        })
      };
    }

    // LIRE EN LIGNE (chapitre par chapitre pour abonnés)
    if (event.httpMethod === 'GET' && path.startsWith('/read/')) {
      const chapter = path.replace('/read/', '');

      // Vérifier accès
      const purchases = await sql`
        SELECT * FROM book_access 
        WHERE user_id = ${userId}
      `;

      const subscriptions = await sql`
        SELECT * FROM subscriptions 
        WHERE user_id = ${userId} 
        AND status = 'active' 
        AND end_date > NOW()
      `;

      if (purchases.length === 0 && subscriptions.length === 0) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ 
            error: 'Accès refusé' 
          })
        };
      }

      // TODO: Retourner le contenu du chapitre
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          chapter: chapter,
          content: `Contenu du chapitre ${chapter}...`,
          message: 'Chapitre accessible'
        })
      };
    }

    // STATISTIQUES D'ACCÈS (Admin)
    if (event.httpMethod === 'GET' && path === '/stats') {
      const totalPurchases = await sql`
        SELECT COUNT(*) as count FROM book_access WHERE access_type = 'full'
      `;

      const totalSubscriptions = await sql`
        SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'
      `;

      const revenue = await sql`
        SELECT 
          SUM(CASE WHEN payment_type = 'book_purchase' THEN amount ELSE 0 END) as book_revenue,
          SUM(CASE WHEN payment_type = 'subscription' THEN amount ELSE 0 END) as subscription_revenue,
          SUM(amount) as total_revenue
        FROM payments
        WHERE status = 'paid'
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          stats: {
            totalPurchases: totalPurchases[0].count,
            totalSubscriptions: totalSubscriptions[0].count,
            revenue: revenue[0]
          }
        })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route non trouvée' })
    };

  } catch (error) {
    console.error('Book access error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur serveur', details: error.message })
    };
  }
};
