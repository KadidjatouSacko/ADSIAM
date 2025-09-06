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
import companyRoutes from './routes/companyRouter.js';

// Import des nouvelles routes d'authentification
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// Import de la configuration DB
import { sequelize } from './models/index.js';
import methodOverride from 'method-override';


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

// Configuration express-ejs-layouts
app.use(expressLayouts);
app.set('layout', 'layout');

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
        tableName: 'user_sessions',
        createTableIfMissing: true
    }),
    name: 'adsiam.sid',
    secret: process.env.SESSION_SECRET || 'votre_secret_session_super_securise_adsiam_2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'strict'
    },
    rolling: true
}));

// Configuration Flash messages
app.use(flash());
app.use(methodOverride('_method'));
// ========================================
// 🛡️ SÉCURITÉ
// ========================================

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// ========================================
// 🌐 MIDDLEWARE GLOBAUX
// ========================================

// Middleware global pour les variables locales
app.use(async (req, res, next) => {
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

    // Variables d'authentification
    res.locals.isAuthenticated = !!req.session?.userId;
    res.locals.currentUser = null;
    
    // Enrichir les données utilisateur
    if (req.session?.userId) {
        try {
            if (!req.session.user || !req.session.user.type_display) {
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
            res.locals.isAdmin = req.session.user?.role === 'admin';
            
        } catch (error) {
            console.error('Erreur enrichissement utilisateur global:', error);
        }
    }
    
    // Helpers pour les rôles par défaut
    res.locals.hasRole = res.locals.hasRole || (() => false);
    res.locals.isActive = res.locals.isActive || (() => false);
    res.locals.isAdmin = res.locals.isAdmin || false;
    res.locals.getStatusBadge = (status) => {
        const badges = {
            'actif': 'badge-success',
            'en_attente': 'badge-warning', 
            'inactif': 'badge-secondary',
            'suspendu': 'badge-danger'
        };
        return badges[status] || 'badge-secondary';
    };
res.locals.getCompanyEmployeeCount = async (companyName) => {
    try {
        const result = await sequelize.query(`
            SELECT COUNT(*) as count 
            FROM users 
            WHERE societe_rattachee = :company 
            AND role != 'societe'
        `, {
            type: QueryTypes.SELECT,
            replacements: { company: companyName }
        });
        return result[0]?.count || 0;
    } catch (error) {
        console.error('Erreur count employés:', error);
        return 0;
    }
};

res.locals.getCompanyStats = async (companyName) => {
    try {
        const stats = await sequelize.query(`
            SELECT 
                COUNT(DISTINCT u.id) as employes,
                COUNT(DISTINCT i.id) as inscriptions,
                COUNT(DISTINCT CASE WHEN i.statut = 'termine' THEN i.id END) as terminees,
                ROUND(AVG(i.progression_pourcentage), 1) as progression
            FROM users u
            LEFT JOIN inscriptions i ON u.id = i.user_id  
            WHERE u.societe_rattachee = :company
            AND u.role != 'societe'
        `, {
            type: QueryTypes.SELECT,
            replacements: { company: companyName }
        });
        return stats[0] || {};
    } catch (error) {
        console.error('Erreur stats entreprise:', error);
        return {};
    }
};

    next();
});



// MIDDLEWARE DE DEBUG
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        const timestamp = new Date().toISOString();
        console.log(`\n🔍 [${timestamp}] ${req.method} ${req.url}`);
        
        if (req.headers['content-type']) {
            console.log(`📄 Content-Type: ${req.headers['content-type']}`);
        }
        
        if (req.method === 'POST' && req.body) {
            const logBody = { ...req.body };
            if (logBody.mot_de_passe) logBody.mot_de_passe = '[HIDDEN]';
            if (logBody.confirm_password) logBody.confirm_password = '[HIDDEN]';
            console.log(`📝 Body:`, logBody);
        }
        
        if (Object.keys(req.query).length > 0) {
            console.log(`🔍 Query:`, req.query);
        }
        
        if (req.session?.userId) {
            console.log(`👤 User connecté: ID ${req.session.userId}`);
        }
        
        next();
    });
}

// ========================================
// 🧪 ROUTES DE TEST
// ========================================

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

// 👑 Routes administrateur (PROTECTION ADMIN)
console.log('👑 Montage des routes administrateur sur /admin');
app.use('/admin', adminRoutes);

// 📊 Routes Dashboard
console.log('📊 Montage des routes Dashboard');
app.use('/', dashboardRoutes);

// 📋 Routes de formation existantes
console.log('📋 Montage de formationRoutes sur /');
app.use('/', formationRoutes);

// 👥 Routes étudiants existantes
console.log('👥 Montage de etudiantsRoutes sur /');
app.use('/', etudiantsRoutes);

console.log('🏢 Montage des routes Espace Entreprise sur /entreprise');
app.use('/entreprise', companyRoutes);

// ========================================
// 🏠 ROUTES PRINCIPALES
// ========================================

// Page d'accueil
app.get('/', (req, res) => {
    if (req.session?.userId) {
        res.render('home', {
            title: 'ADSIAM - Formation Excellence Aide à Domicile & EHPAD',
            layout: 'layouts/main',
            showDashboardLink: true
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
// Dashboard avec redirection selon authentification
app.get('/dashboard', async (req, res, next) => {
    if (!req.session?.userId) {
        req.flash('info', 'Veuillez vous connecter pour accéder au tableau de bord.');
        return res.redirect('/auth/login');
    }
    
    // AJOUT : Redirection automatique pour les entreprises
    // Récupérer le rôle depuis la base si pas en session
    if (!req.session.user?.role) {
        try {
            const { QueryTypes } = await import('sequelize');
            const userData = await sequelize.query(`
                SELECT role, statut, societe_rattachee, prenom, nom 
                FROM users 
                WHERE id = :userId
            `, {
                type: QueryTypes.SELECT,
                replacements: { userId: req.session.userId }
            });
            
            if (userData[0]) {
                req.session.user = userData[0];
            }
        } catch (error) {
            console.error('Erreur récupération rôle:', error);
        }
    }
    
    // Redirection selon le rôle
    if (req.session.user?.role === 'societe') {
        console.log('Redirection entreprise pour:', req.session.user.prenom);
        return res.redirect('/entreprise');
    }
    
    try {
        await DashboardController.dashboard(req, res);
    } catch (error) {
        next(error);
    }
});

// Route de déconnexion rapide
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
                tempsEtude: Math.round(stats.tempsTotalSemaine / 60)
            }
        });
    } catch (error) {
        console.error('💥 Erreur quick-stats:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

app.get('/api/company/quick-stats', async (req, res) => {
    if (!req.session?.userId || req.session.user?.role !== 'societe') {
        return res.status(401).json({ error: 'Non autorisé' });
    }
    
    try {
        const companyName = req.session.user.societe_rattachee;
        const stats = await res.locals.getCompanyStats(companyName);
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Erreur API company stats:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});


// ========================================
// 🚫 GESTION DES ERREURS
// ========================================

// Middleware 404
app.use((req, res) => {
    console.log(`❌ 404 - Route non trouvée: ${req.method} ${req.url}`);
    
    if (req.xhr || req.headers.accept?.includes('application/json')) {
        res.status(404).json({
            success: false,
            message: `Route non trouvée: ${req.method} ${req.url}`,
            timestamp: new Date()
        });
    } else {
        res.status(404).render('errors/404', {
            title: 'Page non trouvée - ADSIAM',
            layout: 'layouts/error',
            url: req.originalUrl
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
            console.log(`\n🚀 Serveur ADSIAM avec Authentification démarré sur le port ${PORT}`);
            console.log(`🌐 Accédez à l'application : http://localhost:${PORT}`);
            console.log(`🏠 Page d'accueil: http://localhost:${PORT}/`);
            console.log(`🔐 Connexion: http://localhost:${PORT}/auth/login`);
            console.log(`📝 Inscription: http://localhost:${PORT}/auth/register`);
            console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
            console.log(`👑 Admin: http://localhost:${PORT}/admin`);
            
            console.log('\n🧪 Routes de test:');
            console.log(`  GET  http://localhost:${PORT}/test-server`);
            console.log(`  POST http://localhost:${PORT}/test-auth`);
            
            console.log('\n📊 API Dashboard:');
            console.log('  GET  /api/dashboard/quick-stats     - Stats rapides');
            
            console.log('\n🔐 Routes d\'authentification principales:');
            console.log('  GET  /auth/login    - Page de connexion');
            console.log('  POST /auth/login    - Traitement connexion');
            console.log('  GET  /auth/register - Page d\'inscription');
            console.log('  POST /auth/register - Traitement inscription');
            
            console.log('\n👑 Routes administrateur:');
            console.log('  GET  /admin                     - Dashboard admin');
            console.log('  GET  /admin/utilisateurs        - Gestion utilisateurs');
            console.log('  GET  /admin/formations          - Gestion formations');
            console.log('  GET  /admin/inscriptions        - Gestion inscriptions');
            
            if (process.env.NODE_ENV !== 'production') {
                console.log('\n🚨 Mode développement activé - Logs détaillés disponibles');
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