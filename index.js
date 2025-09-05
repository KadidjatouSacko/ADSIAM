import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import flash from 'connect-flash';
import cookieParser from 'cookie-parser';
import expressLayouts from 'express-ejs-layouts';

// Import des routes existantes
import formationRoutes from './routes/formationRoutes.js';
import etudiantsRoutes from './routes/etudiantsRoutes.js';

import dashboardRoutes from './routes/dashboardRoutes.js';
import DashboardController from './controllers/DashboardController.js';
import { checkAdmin } from './middleware/checkAdmin.js';

// Import des nouvelles routes d'authentification
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// Import de la configuration DB (adapter selon votre structure)
import { sequelize } from './models/index.js';

// Configuration ES6 pour __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
dotenv.config();

// Initialisation Express
const app = express();

// ========================================
// 🔧 CONFIGURATION DE BASE
// ========================================

// Configuration EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// Configuration express-ejs-layouts pour votre structure
app.use(expressLayouts);

// IMPORTANT : Configuration du layout pour pointer vers votre fichier layout.ejs
app.set('layout', 'layout'); // Pointe vers views/layout.ejs

// Configuration pour que contentFor fonctionne
// app.set('layout extractScripts', true);  // Pour contentFor('scripts')
// app.set('layout extractStyles', true);   // Pour contentFor('styles')
// app.set('layout extractMetas', true);    // Pour contentFor('head')


// Middleware pour fichiers statiques et parsing JSON/URL
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ========================================
// 🔐 CONFIGURATION AUTHENTIFICATION
// ========================================

// Configuration des sessions avec PostgreSQL
const pgSession = connectPgSimple(session);

app.use(session({
    store: new pgSession({
        conString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
        tableName: 'user_sessions', // Table pour stocker les sessions
        createTableIfMissing: true
    }),
    name: 'adsiam.sid',
    secret: process.env.SESSION_SECRET || 'votre_secret_session_super_securise_adsiam_2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 heures
        sameSite: 'strict'
    },
    rolling: true // Renouvelle le cookie à chaque requête
}));

// Configuration Flash messages pour les notifications
app.use(flash());

// ========================================
// 🛡️ SÉCURITÉ
// ========================================

// Headers de sécurité basiques
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// ========================================
// 🌐 MIDDLEWARE GLOBAUX
// ========================================

// Middleware global pour les variables locales (flash messages + helpers)
app.use((req, res, next) => {
    // Flash messages
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.warning = req.flash('warning');
    res.locals.info = req.flash('info');
    
    // Helpers globaux pour les vues EJS
    res.locals.formatDate = (date) => {
        return new Date(date).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    
    res.locals.formatTime = (date) => {
        return new Date(date).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    res.locals.capitalize = (str) => {
        return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    };

    // Variables d'authentification (seront surchargées par le middleware auth)
    res.locals.isAuthenticated = !!req.session?.userId;
    res.locals.currentUser = null;
    
    // Helpers pour les rôles
    res.locals.hasRole = (role) => false;
    res.locals.isActive = () => false;
    res.locals.getStatusBadge = (status) => {
        const badges = {
            'actif': 'badge-success',
            'en_attente': 'badge-warning', 
            'inactif': 'badge-secondary',
            'suspendu': 'badge-danger'
        };
        return badges[status] || 'badge-secondary';
    };

    next();
});

// MIDDLEWARE DE DEBUG - Logs détaillés des requêtes
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        const timestamp = new Date().toISOString();
        console.log(`\n🔍 [${timestamp}] ${req.method} ${req.url}`);
        
        // Log des headers importants
        if (req.headers['content-type']) {
            console.log(`📄 Content-Type: ${req.headers['content-type']}`);
        }
        
        // Log du body pour les POST (sans les mots de passe)
        if (req.method === 'POST' && req.body) {
            const logBody = { ...req.body };
            if (logBody.mot_de_passe) logBody.mot_de_passe = '[HIDDEN]';
            if (logBody.confirm_password) logBody.confirm_password = '[HIDDEN]';
            console.log(`📝 Body:`, logBody);
        }
        
        // Log des query parameters
        if (Object.keys(req.query).length > 0) {
            console.log(`🔍 Query:`, req.query);
        }
        
        // Log des infos de session
        if (req.session?.userId) {
            console.log(`👤 User connecté: ID ${req.session.userId}`);
        }
        
        next();
    });
}

// ========================================
// 🧪 ROUTES DE TEST
// ========================================

// ROUTE DE TEST SIMPLE
app.get('/test-server', (req, res) => {
    console.log('✅ Route /test-server appelée');
    res.json({ 
        message: 'Serveur ADSIAM OK avec Auth', 
        timestamp: new Date(),
        nodeEnv: process.env.NODE_ENV,
        authenticated: !!req.session?.userId,
        sessionId: req.sessionID
    });
});

// ROUTE DE TEST AUTH API
app.post('/test-auth', (req, res) => {
    console.log('✅ Route POST /test-auth appelée');
    console.log('Body reçu:', req.body);
    res.json({
        success: true,
        message: 'Test auth API OK',
        receivedData: req.body,
        authenticated: !!req.session?.userId
    });
});

// ========================================
// 🛣️ MONTAGE DES ROUTES
// ========================================

console.log('🔧 Chargement des routes...');

// 🔐 Routes d'authentification (PRIORITÉ)
console.log('🔐 Montage des routes d\'authentification sur /auth');
app.use('/auth', authRoutes);

// 📋 Routes de formation existantes
console.log('📋 Montage de formationRoutes sur /');
app.use('/', formationRoutes);

// 👥 Routes étudiants existantes  
console.log('👥 Montage de etudiantsRoutes sur /');
app.use('/', etudiantsRoutes);

// 🔐 Routes d'authentification (PRIORITÉ) - GARDEZ CELLE-CI
console.log('🔐 Montage des routes d\'authentification sur /auth');
app.use('/auth', authRoutes);

// 📊 Routes Dashboard (NOUVELLES) - AJOUTEZ CETTE LIGNE
console.log('📊 Montage des routes Dashboard');
app.use('/', dashboardRoutes);

// 📋 Routes de formation existantes - GARDEZ CELLE-CI
console.log('📋 Montage de formationRoutes sur /');
app.use('/', formationRoutes);

// 👥 Routes étudiants existantes - GARDEZ CELLE-CI
console.log('👥 Montage de etudiantsRoutes sur /');
app.use('/', etudiantsRoutes);

router.use('/admin', checkAdmin, adminRoutes);


// ========================================
// 🏠 ROUTES PRINCIPALES
// ========================================

// Page d'accueil
app.get('/', (req, res) => {
    // Si connecté, proposer d'aller au dashboard
    if (req.session?.userId) {
        res.render('home', {
            title: 'ADSIAM - Formation Excellence Aide à Domicile & EHPAD',
            layout: 'layouts/main',
            showDashboardLink: true // Nouvelle variable pour afficher un lien vers le dashboard
        });
    } else {
        res.render('home', {
            title: 'ADSIAM - Formation Excellence Aide à Domicile & EHPAD',
            layout: 'layouts/main',
            showDashboardLink: false
        });
    }
});

// Dashboard avec redirection selon authentification
app.get('/dashboard', async (req, res, next) => {
    // Rediriger vers la route complète du dashboard
    if (!req.session?.userId) {
        req.flash('info', 'Veuillez vous connecter pour accéder au tableau de bord.');
        return res.redirect('/auth/login');
    }
    
    // Utiliser le contrôleur complet
    try {
        await DashboardController.dashboard(req, res);
    } catch (error) {
        next(error);
    }
});

// Route de déconnexion rapide (GET pour les liens)
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Erreur destruction session:', err);
        }
        res.clearCookie('connect.sid');
        res.clearCookie('rememberToken');
        res.redirect('/auth/login');
    });
});

// API pour les statistiques temps réel
app.get('/api/dashboard/quick-stats', async (req, res) => {
    if (!req.session?.userId) {
        return res.status(401).json({ error: 'Non authentifié' });
    }
    
    try {
        const userId = req.session.userId;
        const stats = await DashboardController.getStats(userId);
        
        res.json({
            success: true,
            stats: {
                progression: Math.round(stats.progressionGlobale),
                formations: stats.inscriptionsActives,
                certifications: stats.certificationsObtenues,
                tempsEtude: Math.round(stats.tempsTotalSemaine / 60) // en heures
            }
        });
    } catch (error) {
        console.error('💥 Erreur quick-stats:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ========================================
// 🎯 MIDDLEWARE GLOBAL ENRICHI POUR DASHBOARD
// ========================================

// ENRICHISSEZ votre middleware global existant avec ces ajouts :
app.use(async (req, res, next) => {
    // Flash messages - GARDEZ CETTE PARTIE
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.warning = req.flash('warning');
    res.locals.info = req.flash('info');
    
    // Helpers globaux - GARDEZ CETTE PARTIE
    res.locals.formatDate = (date) => {
        return new Date(date).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    
    res.locals.formatTime = (date) => {
        return new Date(date).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    res.locals.capitalize = (str) => {
        return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    };

    // AJOUTEZ ces nouveaux helpers pour le dashboard :
    res.locals.formatDuration = (minutes) => {
        if (!minutes) return '0min';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
        }
        return `${mins}min`;
    };

    res.locals.getProgressColor = (percentage) => {
        if (percentage >= 80) return 'var(--success)';
        if (percentage >= 50) return 'var(--warning)';
        return 'var(--info)';
    };

    res.locals.getStatusBadgeClass = (status) => {
        const badges = {
            'en_cours': 'status-current',
            'termine': 'status-completed',
            'non_commence': 'status-locked',
            'suspendu': 'status-locked'
        };
        return badges[status] || 'status-locked';
    };

    res.locals.truncateText = (text, length = 100) => {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
    };

    // Variables d'authentification - GARDEZ CETTE PARTIE MAIS ENRICHISSEZ-LA
    res.locals.isAuthenticated = !!req.session?.userId;
    res.locals.currentUser = null;
    
    // AJOUTEZ cette partie pour enrichir les données utilisateur
    if (req.session?.userId) {
        try {
            // Récupérer les données utilisateur enrichies si pas déjà fait
            if (!req.session.user || !req.session.user.type_display) {
                const { sequelize } = await import('./models/index.js');
                const { QueryTypes } = await import('sequelize');
                
                const userData = await sequelize.query(`
                    SELECT 
                        u.*,
                        CASE 
                            WHEN u.type_utilisateur = 'aide_domicile' THEN 'Aide à domicile'
                            WHEN u.type_utilisateur = 'aide_soignant' THEN 'Aide-soignant'
                            WHEN u.type_utilisateur = 'formateur' THEN 'Formateur'
                            ELSE 'Étudiant'
                        END as type_display
                    FROM utilisateurs u 
                    WHERE u.id = :userId
                `, {
                    type: QueryTypes.SELECT,
                    replacements: { userId: req.session.userId }
                });
                
                if (userData[0]) {
                    req.session.user = userData[0];
                }
            }
            
            res.locals.currentUser = req.session.user;
            res.locals.hasRole = (role) => req.session.user?.type_utilisateur === role;
            res.locals.isActive = () => req.session.user?.statut === 'actif';
            
        } catch (error) {
            console.error('💥 Erreur enrichissement utilisateur global:', error);
        }
    }
    
    // Helpers pour les rôles - GARDEZ CETTE PARTIE
    res.locals.hasRole = res.locals.hasRole || (() => false);
    res.locals.isActive = res.locals.isActive || (() => false);
    res.locals.getStatusBadge = (status) => {
        const badges = {
            'actif': 'badge-success',
            'en_attente': 'badge-warning', 
            'inactif': 'badge-secondary',
            'suspendu': 'badge-danger'
        };
        return badges[status] || 'badge-secondary';
    };

    next();
});

// ========================================
// 🔍 DEBUG - AFFICHAGE DES ROUTES
// ========================================

// MIDDLEWARE DE DEBUG - Afficher toutes les routes montées
if (process.env.NODE_ENV !== 'production') {
    console.log('\n📍 Routes disponibles:');
    app._router.stack.forEach((middleware) => {
        if (middleware.route) { // Route directe
            console.log(`📍 Route directe: ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
        } else if (middleware.name === 'router') { // Router
            middleware.handle.stack.forEach((handler) => {
                if (handler.route) {
                    const methods = Object.keys(handler.route.methods).join(', ').toUpperCase();
                    const fullPath = middleware.regexp.source.replace('\\/?(?=\\/|$)', '') + handler.route.path;
                    console.log(`📍 Route montée: ${methods} ${fullPath.replace(/\\/g, '')}`);
                }
            });
        }
    });
}

// ========================================
// 🚫 GESTION DES ERREURS
// ========================================

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
                    availableRoutes.push(`${methods} ${fullPath.replace(/\\/g, '')}`);
                }
            });
        }
    });

    // Vérifier si c'est une requête API ou une page
    if (req.xhr || req.headers.accept?.includes('application/json')) {
        res.status(404).json({
            success: false,
            message: `Route non trouvée: ${req.method} ${req.url}`,
            availableRoutes: availableRoutes,
            timestamp: new Date()
        });
    } else {
        // Afficher une page 404 HTML
        res.status(404).render('errors/404', {
            title: 'Page non trouvée - ADSIAM',
            layout: 'layouts/error',
            url: req.originalUrl,
            availableRoutes: availableRoutes
        });
    }
});

// Middleware gestion des erreurs
app.use((err, req, res, next) => {
    console.error('💥 Erreur serveur:', err);
    
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (req.xhr || req.headers.accept?.includes('application/json')) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Erreur interne du serveur',
            error: isDevelopment ? err.stack : undefined
        });
    } else {
        res.status(err.status || 500).render('errors/500', {
            title: 'Erreur serveur - ADSIAM',
            layout: 'layouts/error',
            error: isDevelopment ? err : null,
            message: isDevelopment ? err.message : 'Une erreur inattendue s\'est produite'
        });
    }
});


// ========================================
// 🚀 DÉMARRAGE DU SERVEUR
// ========================================

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // Test connexion DB - GARDEZ CETTE PARTIE
        await sequelize.authenticate();
        console.log('✅ Connexion à la base de données réussie');

        // Synchronisation des modèles en dev - GARDEZ CETTE PARTIE
        if (process.env.NODE_ENV !== 'production') {
            await sequelize.sync({ alter: true });
            console.log('✅ Modèles synchronisés');
        }

        // Démarrage serveur - GARDEZ CETTE PARTIE
        app.listen(PORT, () => {
            console.log(`\n🚀 Serveur ADSIAM avec Authentification démarré sur le port ${PORT}`);
            console.log(`🌐 Accédez à l'application : http://localhost:${PORT}`);
            console.log(`🏠 Page d'accueil: http://localhost:${PORT}/`);
            console.log(`🔐 Connexion: http://localhost:${PORT}/auth/login`);
            console.log(`📝 Inscription: http://localhost:${PORT}/auth/register`);
            
            // AJOUTEZ ces nouvelles routes dans les logs :
            console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
            console.log(`📚 Mes Formations: http://localhost:${PORT}/mes-formations`);
            console.log(`📈 Ma Progression: http://localhost:${PORT}/ma-progression`);
            console.log(`🏆 Mes Certifications: http://localhost:${PORT}/mes-certifications`);
            
            console.log('\n🧪 Routes de test:');
            console.log(`  GET  http://localhost:${PORT}/test-server - Test serveur`);
            console.log(`  POST http://localhost:${PORT}/test-auth - Test auth API`);
            
            // AJOUTEZ ces nouvelles routes API dans les logs :
            console.log('\n📊 Nouvelles API Dashboard:');
            console.log('  GET  /api/dashboard/stats           - Statistiques temps réel');
            console.log('  GET  /api/dashboard/quick-stats     - Stats rapides');
            console.log('  POST /api/evenements/:id/inscription - Inscription événement');
            console.log('  GET  /api/sse/notifications         - Stream notifications');
            
            console.log('\n🔐 Routes d\'authentification principales:');
            console.log('  GET  /auth/login                - Page de connexion');
            console.log('  POST /auth/login                - Traitement connexion');
            console.log('  GET  /auth/register             - Page d\'inscription');
            console.log('  POST /auth/register             - Traitement inscription');
            console.log('  GET  /auth/profile              - Page de profil');
            console.log('  POST /auth/logout               - Déconnexion');
            console.log('  GET  /auth/api/check            - Vérifier statut auth (API)');
            
            console.log('\n🔍 Testez ces commandes dans la console du navigateur:');
            console.log('  fetch("/test-server").then(r => r.json()).then(console.log)');
            console.log('  fetch("/auth/api/check").then(r => r.json()).then(console.log)');
            console.log('  fetch("/api/dashboard/quick-stats").then(r => r.json()).then(console.log)');
            
            if (process.env.NODE_ENV !== 'production') {
                console.log('\n🚨 Mode développement activé - Logs détaillés disponibles');
                console.log('📊 Dashboard avec données réelles de la base PostgreSQL');
                console.log('🎨 Interface avec vos couleurs ADSIAM (#e7a6b7, #a5bfd4)');
            }
        });

    } catch (error) {
        console.error('❌ Erreur lors du démarrage:', error);
        process.exit(1);
    }
}


// Gestion de l'arrêt propre du serveur
process.on('SIGTERM', async () => {
    console.log('\n🔄 Arrêt du serveur en cours...');
    try {
        await sequelize.close();
        console.log('✅ Connexions fermées proprement');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors de l\'arrêt:', error);
        process.exit(1);
    }
});

process.on('SIGINT', async () => {
    console.log('\n🔄 Interruption détectée, arrêt du serveur...');
    try {
        await sequelize.close();
        console.log('✅ Arrêt propre du serveur');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors de l\'arrêt:', error);
        process.exit(1);
    }
});

startServer();

export default app;