import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import formationRoutes from './routes/formationRoutes.js';
import { sequelize } from './models/index.js';
import authRouter from './routes/authRoutes.js';

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

// Logs des requêtes en développement
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });
}

// Routes principales
app.use('/', formationRoutes);
app.use('/', etudiantsRoutes);
app.use('/', authRouter);


// Middleware 404
app.use((req, res) => {
  res.status(404).render('error', {
    message: 'Page non trouvée',
    error: {
      status: 404,
      stack: process.env.NODE_ENV === 'production' ? '' : 'Route non définie'
    }
  });
});

// Middleware gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(err.status || 500).render('error', {
    message: err.message || 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'production' ? {} : err
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
      console.log(`🚀 Serveur ADSIAM démarré sur le port ${PORT}`);
      console.log(`🌐 Accédez à l'application : http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors du démarrage:', error);
    process.exit(1);
  }
}

startServer();

export default app;
