import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import formationRoutes from './routes/formationRoutes.js';
import { sequelize } from './models/index.js';
import apiRouter from './routes/apiRoutes.js';
import session from 'express-session';
import etudiantsRoutes from './routes/etudiantsRoutes.js';

// Configuration ES6 pour __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
dotenv.config();

// Initialisation Express
const app = express();

// Configuration EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour fichiers statiques et parsing JSON/URL
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuration de la session
app.use(session({
  secret: process.env.SESSION_SECRET || 'default_secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Headers de sécurité basiques
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// MIDDLEWARE DE DEBUG - Logs détaillés des requêtes
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔍 [${timestamp}] ${req.method} ${req.url}`);
  
  // Log des headers importants
  if (req.headers['content-type']) {
    console.log(`📄 Content-Type: ${req.headers['content-type']}`);
  }
  
  // Log du body pour les POST
  if (req.method === 'POST' && req.body) {
    console.log(`📝 Body:`, req.body);
  }
  
  // Log des query parameters
  if (Object.keys(req.query).length > 0) {
    console.log(`🔍 Query:`, req.query);
  }
  
  next();
});

// ROUTE DE TEST SIMPLE
app.get('/test-server', (req, res) => {
  console.log('✅ Route /test-server appelée');
  res.json({ 
    message: 'Serveur ADSIAM OK', 
    timestamp: new Date(),
    nodeEnv: process.env.NODE_ENV 
  });
});

// ROUTE DE TEST AUTH API
app.post('/test-auth', (req, res) => {
  console.log('✅ Route POST /test-auth appelée');
  console.log('Body reçu:', req.body);
  res.json({
    success: true,
    message: 'Test auth API OK',
    receivedData: req.body
  });
});

console.log('🔧 Chargement des routes...');

// Routes principales
console.log('📋 Montage de formationRoutes sur /');
app.use('/', formationRoutes);

console.log('👥 Montage de etudiantsRoutes sur /');
app.use('/', etudiantsRoutes);



console.log('🔌 Montage de apiRouter sur /api');
app.use('/api', apiRouter);

// MIDDLEWARE DE DEBUG - Afficher toutes les routes montées
app._router.stack.forEach((middleware) => {
  if (middleware.route) { // Route directe
    console.log(`📍 Route directe: ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
  } else if (middleware.name === 'router') { // Router
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        const methods = Object.keys(handler.route.methods).join(', ').toUpperCase();
        const fullPath = middleware.regexp.source.replace('\\/?(?=\\/|$)', '') + handler.route.path;
        console.log(`📍 Route montée: ${methods} ${fullPath}`);
      }
    });
  }
});

// Middleware 404 avec debug
app.use((req, res) => {
  console.log(`❌ 404 - Route non trouvée: ${req.method} ${req.url}`);
  
  // Lister les routes disponibles dans la réponse 404
  const availableRoutes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      availableRoutes.push(`${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods).join(', ').toUpperCase();
          const fullPath = middleware.regexp.source.replace('\\/?(?=\\/|$)', '') + handler.route.path;
          availableRoutes.push(`${methods} ${fullPath}`);
        }
      });
    }
  });

  res.status(404).json({
    success: false,
    message: `Route non trouvée: ${req.method} ${req.url}`,
    availableRoutes: availableRoutes,
    timestamp: new Date()
  });
});

// Middleware gestion des erreurs
app.use((err, req, res, next) => {
  console.error('💥 Erreur serveur:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'production' ? {} : err.stack
  });
});

// Démarrage du serveur avec vérification de la base de données
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Test connexion DB
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données réussie');

    // Synchronisation des modèles en dev
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
      console.log('✅ Modèles synchronisés');
    }

    // Démarrage serveur
    app.listen(PORT, () => {
      console.log(`\n🚀 Serveur ADSIAM démarré sur le port ${PORT}`);
      console.log(`🌐 Accédez à l'application : http://localhost:${PORT}`);
      console.log(`🧪 Test serveur: http://localhost:${PORT}/test-server`);
      console.log(`🔐 Test auth: POST http://localhost:${PORT}/test-auth`);
      
      console.log('\n📋 Routes probablement disponibles:');
      console.log('  GET  /test-server           - Test serveur');
      console.log('  POST /test-auth             - Test auth API');
      console.log('  GET  /connexion             - Page connexion (si dans authRouter)');
      console.log('  POST /auth/api/connexion    - API connexion (si dans authRouter)');
      console.log('  GET  /auth/api/verifier-auth - Vérifier auth (si dans authRouter)');
      
      console.log('\n🔍 Testez ces commandes dans la console du navigateur:');
      console.log('  fetch("/test-server").then(r => r.json()).then(console.log)');
      console.log('  fetch("/test-auth", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({test:true})}).then(r => r.json()).then(console.log)');
    });

  } catch (error) {
    console.error('❌ Erreur lors du démarrage:', error);
    process.exit(1);
  }
}

startServer();

export default app;