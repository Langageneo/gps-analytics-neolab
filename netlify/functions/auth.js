// netlify/functions/auth.js
// Gestion authentification avec Neon Database

const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const sql = neon(process.env.DATABASE_URL);
const JWT_SECRET = process.env.JWT_SECRET || 'votre-secret-super-securise';

exports.handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/auth', '');
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    // INSCRIPTION
    if (event.httpMethod === 'POST' && path === '/register') {
      const { name, email, password, whatsapp } = body;

      // Validation
      if (!name || !email || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Données manquantes' })
        };
      }

      // Vérifier si email existe déjà
      const existingUser = await sql`
        SELECT id FROM users WHERE email = ${email}
      `;

      if (existingUser.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email déjà utilisé' })
        };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Créer utilisateur
      const result = await sql`
        INSERT INTO users (name, email, password_hash, whatsapp)
        VALUES (${name}, ${email}, ${passwordHash}, ${whatsapp})
        RETURNING id, name, email, whatsapp, created_at
      `;

      const user = result[0];

      // Générer token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Compte créé avec succès',
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            whatsapp: user.whatsapp
          }
        })
      };
    }

    // CONNEXION
    if (event.httpMethod === 'POST' && path === '/login') {
      const { email, password } = body;

      if (!email || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email et mot de passe requis' })
        };
      }

      // Récupérer utilisateur
      const users = await sql`
        SELECT * FROM users WHERE email = ${email} AND status = 'active'
      `;

      if (users.length === 0) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Email ou mot de passe incorrect' })
        };
      }

      const user = users[0];

      // Vérifier password
      const isValid = await bcrypt.compare(password, user.password_hash);

      if (!isValid) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Email ou mot de passe incorrect' })
        };
      }

      // Générer token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      // Vérifier abonnement
      const subscriptions = await sql`
        SELECT * FROM subscriptions 
        WHERE user_id = ${user.id} 
        AND status = 'active' 
        AND end_date > NOW()
        ORDER BY end_date DESC LIMIT 1
      `;

      const isPremium = subscriptions.length > 0;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            whatsapp: user.whatsapp,
            accountType: isPremium ? 'premium' : 'standard',
            memberSince: user.created_at
          }
        })
      };
    }

    // VÉRIFIER TOKEN
    if (event.httpMethod === 'GET' && path === '/verify') {
      const token = event.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Token manquant' })
        };
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const users = await sql`
          SELECT id, name, email, whatsapp, created_at, status 
          FROM users 
          WHERE id = ${decoded.userId}
        `;

        if (users.length === 0) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Utilisateur non trouvé' })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            user: users[0]
          })
        };
      } catch (err) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Token invalide' })
        };
      }
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route non trouvée' })
    };

  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur serveur', details: error.message })
    };
  }
};
