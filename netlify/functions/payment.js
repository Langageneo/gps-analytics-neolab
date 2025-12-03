// netlify/functions/payment.js
// Intégration paiement Mobile Money (CinetPay, FedaPay, PayDunya)

const { neon } = require('@neondatabase/serverless');
const axios = require('axios');

const sql = neon(process.env.DATABASE_URL);

// Configuration multi-providers
const PAYMENT_PROVIDERS = {
  cinetpay: {
    apiKey: process.env.CINETPAY_API_KEY,
    siteId: process.env.CINETPAY_SITE_ID,
    url: 'https://api-checkout.cinetpay.com/v2/payment'
  },
  fedapay: {
    apiKey: process.env.FEDAPAY_API_KEY,
    url: 'https://api.fedapay.com/v1/transactions'
  },
  paydunya: {
    masterKey: process.env.PAYDUNYA_MASTER_KEY,
    privateKey: process.env.PAYDUNYA_PRIVATE_KEY,
    token: process.env.PAYDUNYA_TOKEN,
    url: 'https://app.paydunya.com/api/v1/checkout-invoice/create'
  }
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/payment', '');
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    // INITIER PAIEMENT
    if (event.httpMethod === 'POST' && path === '/initiate') {
      const { 
        userId, 
        amount, 
        paymentType, // 'book_purchase' ou 'subscription'
        provider, // 'cinetpay', 'fedapay', ou 'paydunya'
        phoneNumber,
        operator // 'orange', 'mtn', 'moov', 'wave'
      } = body;

      // Validation
      if (!userId || !amount || !paymentType || !provider || !phoneNumber) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Données manquantes' })
        };
      }

      // Générer transaction ID
      const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Créer enregistrement paiement
      await sql`
        INSERT INTO payments (user_id, transaction_id, amount, payment_method, payment_type, status)
        VALUES (${userId}, ${transactionId}, ${amount}, ${operator}, ${paymentType}, 'pending')
      `;

      // Appeler l'API du provider
      let paymentResponse;

      if (provider === 'cinetpay') {
        paymentResponse = await initiateCinetPay({
          transactionId,
          amount,
          phoneNumber,
          operator,
          description: paymentType === 'book_purchase' ? 'Achat LangageNeo' : 'Abonnement Neo-Lab'
        });
      } else if (provider === 'fedapay') {
        paymentResponse = await initiateFedaPay({
          transactionId,
          amount,
          phoneNumber,
          description: paymentType === 'book_purchase' ? 'Achat LangageNeo' : 'Abonnement Neo-Lab'
        });
      } else if (provider === 'paydunya') {
        paymentResponse = await initiatePayDunya({
          transactionId,
          amount,
          description: paymentType === 'book_purchase' ? 'Achat LangageNeo' : 'Abonnement Neo-Lab'
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          transactionId,
          paymentUrl: paymentResponse.paymentUrl,
          message: 'Paiement initié. Suivez les instructions sur votre téléphone.'
        })
      };
    }

    // WEBHOOK - CONFIRMATION PAIEMENT
    if (event.httpMethod === 'POST' && path === '/webhook') {
      const { transactionId, status, provider } = body;

      if (status === 'SUCCESS' || status === 'ACCEPTED') {
        // Mettre à jour paiement
        await sql`
          UPDATE payments 
          SET status = 'paid' 
          WHERE transaction_id = ${transactionId}
        `;

        // Récupérer infos paiement
        const payments = await sql`
          SELECT * FROM payments WHERE transaction_id = ${transactionId}
        `;

        const payment = payments[0];

        // Si achat livre
        if (payment.payment_type === 'book_purchase') {
          await sql`
            INSERT INTO book_access (user_id, access_type, purchase_date)
            VALUES (${payment.user_id}, 'full', NOW())
          `;
        }

        // Si abonnement
        if (payment.payment_type === 'subscription') {
          await sql`
            INSERT INTO subscriptions (user_id, start_date, end_date, status, amount)
            VALUES (
              ${payment.user_id}, 
              NOW(), 
              NOW() + INTERVAL '1 month',
              'active',
              ${payment.amount}
            )
          `;
        }

        // TODO: Envoyer email confirmation
        // await sendConfirmationEmail(payment.user_id);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ received: true })
      };
    }

    // VÉRIFIER STATUT PAIEMENT
    if (event.httpMethod === 'GET' && path.startsWith('/status/')) {
      const transactionId = path.replace('/status/', '');

      const payments = await sql`
        SELECT * FROM payments WHERE transaction_id = ${transactionId}
      `;

      if (payments.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Transaction non trouvée' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          payment: payments[0]
        })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route non trouvée' })
    };

  } catch (error) {
    console.error('Payment error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur serveur', details: error.message })
    };
  }
};

// Fonction CinetPay
async function initiateCinetPay({ transactionId, amount, phoneNumber, operator, description }) {
  try {
    const response = await axios.post(PAYMENT_PROVIDERS.cinetpay.url, {
      apikey: PAYMENT_PROVIDERS.cinetpay.apiKey,
      site_id: PAYMENT_PROVIDERS.cinetpay.siteId,
      transaction_id: transactionId,
      amount: amount,
      currency: 'XOF',
      channels: 'MOBILE_MONEY',
      description: description,
      customer_name: 'Client Neo-Lab',
      customer_phone_number: phoneNumber,
      notify_url: 'https://votre-site.netlify.app/.netlify/functions/payment/webhook',
      return_url: 'https://votre-site.netlify.app/payment-success',
      metadata: operator
    });

    return {
      paymentUrl: response.data.data.payment_url,
      token: response.data.data.payment_token
    };
  } catch (error) {
    console.error('CinetPay error:', error);
    throw error;
  }
}

// Fonction FedaPay
async function initiateFedaPay({ transactionId, amount, phoneNumber, description }) {
  try {
    const response = await axios.post(
      PAYMENT_PROVIDERS.fedapay.url,
      {
        description: description,
        amount: amount,
        currency: { iso: 'XOF' },
        callback_url: 'https://votre-site.netlify.app/.netlify/functions/payment/webhook',
        customer: {
          phone_number: {
            number: phoneNumber,
            country: 'CI'
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${PAYMENT_PROVIDERS.fedapay.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      paymentUrl: response.data.url,
      token: response.data.token
    };
  } catch (error) {
    console.error('FedaPay error:', error);
    throw error;
  }
}

// Fonction PayDunya
async function initiatePayDunya({ transactionId, amount, description }) {
  try {
    const response = await axios.post(
      PAYMENT_PROVIDERS.paydunya.url,
      {
        invoice: {
          total_amount: amount,
          description: description
        },
        store: {
          name: 'GPS&ANALYTICS Neo-Lab',
          website_url: 'https://votre-site.netlify.app'
        },
        actions: {
          callback_url: 'https://votre-site.netlify.app/.netlify/functions/payment/webhook',
          return_url: 'https://votre-site.netlify.app/payment-success'
        }
      },
      {
        headers: {
          'PAYDUNYA-MASTER-KEY': PAYMENT_PROVIDERS.paydunya.masterKey,
          'PAYDUNYA-PRIVATE-KEY': PAYMENT_PROVIDERS.paydunya.privateKey,
          'PAYDUNYA-TOKEN': PAYMENT_PROVIDERS.paydunya.token,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      paymentUrl: response.data.response_text,
      token: response.data.token
    };
  } catch (error) {
    console.error('PayDunya error:', error);
    throw error;
  }
  }
