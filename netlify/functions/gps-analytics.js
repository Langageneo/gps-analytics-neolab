// netlify/functions/gps-analytics.js
// GPS Precision Pro - Intégration multi-API satellites

const { neon } = require('@neondatabase/serverless');
const axios = require('axios');

const sql = neon(process.env.DATABASE_URL);

// Configuration API Satellites et Maps
const GPS_APIS = {
  google: {
    key: process.env.GOOGLE_MAPS_API_KEY,
    distanceUrl: 'https://maps.googleapis.com/maps/api/distancematrix/json',
    geocodeUrl: 'https://maps.googleapis.com/maps/api/geocode/json'
  },
  mapbox: {
    token: process.env.MAPBOX_ACCESS_TOKEN,
    directionsUrl: 'https://api.mapbox.com/directions/v5/mapbox/driving'
  },
  openstreetmap: {
    url: 'https://nominatim.openstreetmap.org/reverse'
  },
  here: {
    apiKey: process.env.HERE_API_KEY,
    routeUrl: 'https://router.hereapi.com/v8/routes'
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

  const path = event.path.replace('/.netlify/functions/gps-analytics', '');
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    // CALCULER ANALYTICS GPS
    if (event.httpMethod === 'POST' && path === '/calculate') {
      const {
        userId,
        serviceType,
        latStart,
        lonStart,
        latEnd,
        lonEnd,
        timeMinutes,
        price,
        useRealAPI = true // Utiliser vraies API ou calcul basique
      } = body;

      // Validation
      if (!latStart || !lonStart || !latEnd || !lonEnd) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Coordonnées GPS manquantes' })
        };
      }

      let analytics;

      if (useRealAPI) {
        // Utiliser les vraies API pour précision maximale
        analytics = await calculateWithRealAPIs({
          latStart,
          lonStart,
          latEnd,
          lonEnd,
          timeMinutes,
          price
        });
      } else {
        // Calcul basique avec formule Haversine
        analytics = calculateBasicAnalytics({
          latStart,
          lonStart,
          latEnd,
          lonEnd,
          timeMinutes,
          price
        });
      }

      // Sauvegarder dans la base de données
      await sql`
        INSERT INTO gps_analytics (
          user_id, service_type, lat_start, lon_start, lat_end, lon_end,
          distance, time_minutes, price, score
        ) VALUES (
          ${userId || null}, ${serviceType}, ${latStart}, ${lonStart},
          ${latEnd}, ${lonEnd}, ${analytics.distance}, ${timeMinutes},
          ${price}, ${analytics.score}
        )
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          analytics: analytics,
          message: 'Analyse GPS complétée avec succès'
        })
      };
    }

    // OBTENIR ADRESSE DEPUIS COORDONNÉES
    if (event.httpMethod === 'POST' && path === '/reverse-geocode') {
      const { lat, lon } = body;

      const address = await reverseGeocode(lat, lon);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          address: address
        })
      };
    }

    // OBTENIR ROUTE OPTIMALE
    if (event.httpMethod === 'POST' && path === '/optimal-route') {
      const { waypoints } = body; // Array of {lat, lon}

      const route = await getOptimalRoute(waypoints);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          route: route
        })
      };
    }

    // STATISTIQUES UTILISATEUR
    if (event.httpMethod === 'GET' && path.startsWith('/stats/')) {
      const userId = path.replace('/stats/', '');

      const stats = await sql`
        SELECT 
          COUNT(*) as total_trips,
          SUM(distance) as total_distance,
          AVG(distance) as avg_distance,
          SUM(price) as total_revenue,
          AVG(score) as avg_score,
          AVG(price / NULLIF(distance, 0)) as avg_price_per_km
        FROM gps_analytics
        WHERE user_id = ${userId}
      `;

      const recentTrips = await sql`
        SELECT * FROM gps_analytics
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 10
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          stats: stats[0],
          recentTrips: recentTrips
        })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route non trouvée' })
    };

  } catch (error) {
    console.error('GPS Analytics error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur serveur', details: error.message })
    };
  }
};

// Calcul basique avec formule Haversine
function calculateBasicAnalytics({ latStart, lonStart, latEnd, lonEnd, timeMinutes, price }) {
  // Formule de Haversine pour distance
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(latEnd - latStart);
  const dLon = toRad(lonEnd - lonStart);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(latStart)) * Math.cos(toRad(latEnd)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  // Calculs
  const speed = timeMinutes > 0 ? (distance / (timeMinutes / 60)) : 0;
  const hourlyRate = timeMinutes > 0 ? ((price / timeMinutes) * 60) : 0;
  const efficiency = Math.min(100, (speed * 10));
  const pricePerKm = distance > 0 ? (price / distance) : 0;
  
  // Score global (0-100)
  const score = Math.min(100, Math.round(
    (efficiency * 0.4) + 
    (Math.min(100, hourlyRate / 50) * 0.3) +
    (Math.min(100, pricePerKm * 10) * 0.3)
  ));

  return {
    distance: parseFloat(distance.toFixed(2)),
    speed: parseFloat(speed.toFixed(2)),
    hourlyRate: Math.round(hourlyRate),
    efficiency: parseFloat(efficiency.toFixed(1)),
    pricePerKm: parseFloat(pricePerKm.toFixed(2)),
    score: score,
    method: 'haversine'
  };
}

// Calcul précis avec Google Maps API
async function calculateWithRealAPIs({ latStart, lonStart, latEnd, lonEnd, timeMinutes, price }) {
  try {
    // Appel Google Maps Distance Matrix API
    const response = await axios.get(GPS_APIS.google.distanceUrl, {
      params: {
        origins: `${latStart},${lonStart}`,
        destinations: `${latEnd},${lonEnd}`,
        key: GPS_APIS.google.key,
        mode: 'driving',
        units: 'metric'
      }
    });

    const element = response.data.rows[0].elements[0];
    
    if (element.status === 'OK') {
      const distanceMeters = element.distance.value;
      const durationSeconds = element.duration.value;
      const distance = distanceMeters / 1000; // Convertir en km
      const estimatedTime = durationSeconds / 60; // Convertir en minutes

      // Utiliser le temps réel ou estimé
      const actualTime = timeMinutes || estimatedTime;
      
      // Calculs avancés
      const speed = actualTime > 0 ? (distance / (actualTime / 60)) : 0;
      const hourlyRate = actualTime > 0 ? ((price / actualTime) * 60) : 0;
      const efficiency = Math.min(100, (estimatedTime / actualTime) * 100);
      const pricePerKm = distance > 0 ? (price / distance) : 0;
      
      // Score basé sur efficacité réelle
      const score = Math.min(100, Math.round(
        (efficiency * 0.5) + 
        (Math.min(100, hourlyRate / 50) * 0.3) +
        (Math.min(100, pricePerKm * 10) * 0.2)
      ));

      return {
        distance: parseFloat(distance.toFixed(2)),
        speed: parseFloat(speed.toFixed(2)),
        hourlyRate: Math.round(hourlyRate),
        efficiency: parseFloat(efficiency.toFixed(1)),
        pricePerKm: parseFloat(pricePerKm.toFixed(2)),
        score: score,
        estimatedTime: parseFloat(estimatedTime.toFixed(2)),
        actualTime: actualTime,
        method: 'google_maps_api'
      };
    }
  } catch (error) {
    console.error('Google Maps API error:', error);
    // Fallback vers calcul basique si API échoue
    return calculateBasicAnalytics({ latStart, lonStart, latEnd, lonEnd, timeMinutes, price });
  }
}

// Reverse Geocoding - Obtenir adresse depuis coordonnées
async function reverseGeocode(lat, lon) {
  try {
    // Essayer Google Maps d'abord
    if (GPS_APIS.google.key) {
      const response = await axios.get(GPS_APIS.google.geocodeUrl, {
        params: {
          latlng: `${lat},${lon}`,
          key: GPS_APIS.google.key,
          language: 'fr'
        }
      });

      if (response.data.results.length > 0) {
        return response.data.results[0].formatted_address;
      }
    }

    // Fallback vers OpenStreetMap (gratuit)
    const osmResponse = await axios.get(GPS_APIS.openstreetmap.url, {
      params: {
        lat: lat,
        lon: lon,
        format: 'json',
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'Neo-Lab GPS Analytics'
      }
    });

    return osmResponse.data.display_name;
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return 'Adresse non disponible';
  }
}

// Route optimale avec Mapbox
async function getOptimalRoute(waypoints) {
  try {
    const coordinates = waypoints.map(w => `${w.lon},${w.lat}`).join(';');
    
    const response = await axios.get(
      `${GPS_APIS.mapbox.directionsUrl}/${coordinates}`,
      {
        params: {
          access_token: GPS_APIS.mapbox.token,
          geometries: 'geojson',
          overview: 'full'
        }
      }
    );

    const route = response.data.routes[0];
    
    return {
      distance: (route.distance / 1000).toFixed(2), // km
      duration: (route.duration / 60).toFixed(2), // minutes
      geometry: route.geometry
    };
  } catch (error) {
    console.error('Route optimization error:', error);
    return null;
  }
}

// Conversion degrés vers radians
function toRad(degrees) {
  return degrees * (Math.PI / 180);
  }
