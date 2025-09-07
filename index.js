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
// 🌐 MIDDLEWARE GLOBAUX - VERSION CORRIGÉE
// ========================================

// CORRECTION: Un seul middleware global pour gérer l'utilisateur
app.use(async (req, res, next) => {
    try {
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

        res.locals.getStatusBadge = (status) => {
            const badges = {
                'actif': 'badge-success',
                'en_attente': 'badge-warning', 
                'inactif': 'badge-secondary',
                'suspendu': 'badge-danger'
            };
            return badges[status] || 'badge-secondary';
        };

        // CORRECTION: Variables d'authentification unifiées
        res.locals.isAuthenticated = !!req.session?.userId;
        res.locals.currentUser = null;
        res.locals.user = null; // Pour compatibilité
        res.locals.admin = null;
        
        // CORRECTION: Enrichir les données utilisateur depuis la table 'users'
        if (req.session?.userId) {
            // Vérifier si on a déjà les données en session
            if (!req.session.user || !req.session.user.role) {
                console.log('🔄 Récupération des données utilisateur depuis la table users');
                const { QueryTypes } = await import('sequelize');
                
                // CORRECTION: Utiliser la table 'users' au lieu de 'utilisateurs'
                const userData = await sequelize.query(`
                    SELECT 
                        u.id, u.prenom, u.nom, u.email, u.role, u.statut,
                        u.type_utilisateur, u.societe_rattachee, u.telephone,
                        u.date_inscription, u.derniere_connexion,
                        CASE 
                            WHEN u.type_utilisateur = 'aide_domicile' THEN 'Aide à domicile'
                            WHEN u.type_utilisateur = 'aide_soignant' THEN 'Aide-soignant'
                            WHEN u.type_utilisateur = 'formateur' THEN 'Formateur'
                            WHEN u.role = 'societe' THEN 'Entreprise'
                            WHEN u.role = 'admin' THEN 'Administrateur'
                            ELSE 'Étudiant'
                        END as type_display
                    FROM users u 
                    WHERE u.id = :userId
                `, {
                    type: QueryTypes.SELECT,
                    replacements: { userId: req.session.userId }
                });
                
                if (userData[0]) {
                    req.session.user = userData[0];
                    console.log(`✅ Données utilisateur récupérées: ${userData[0].prenom} ${userData[0].nom} (${userData[0].role})`);
                } else {
                    console.log('❌ Utilisateur non trouvé, destruction session');
                    req.session.destroy();
                    return next();
                }
            }
            
            // Définir toutes les variables utilisateur
            const user = req.session.user;
            res.locals.currentUser = user;
            res.locals.user = user; // Pour compatibilité avec les anciennes vues
            res.locals.admin = user.role === 'admin' ? user : null;
            
            // Helpers pour les rôles
            res.locals.hasRole = (role) => user.type_utilisateur === role || user.role === role;
            res.locals.isActive = () => user.statut === 'actif';
            res.locals.isAdmin = user.role === 'admin';
            res.locals.isCompany = user.role === 'societe';
            
            console.log(`👤 Utilisateur en session: ${user.prenom} ${user.nom} (Role: ${user.role}, Statut: ${user.statut})`);
        } else {
            // Utilisateur non connecté - définir les helpers par défaut
            res.locals.hasRole = () => false;
            res.locals.isActive = () => false;
            res.locals.isAdmin = false;
            res.locals.isCompany = false;
        }

        // CORRECTION: Fonctions utilitaires pour les entreprises
        res.locals.getCompanyEmployeeCount = async (companyName) => {
            try {
                const { QueryTypes } = await import('sequelize');
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
                const { QueryTypes } = await import('sequelize');
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
        
    } catch (error) {
        console.error('💥 Erreur middleware global:', error);
        // En cas d'erreur, continuer sans bloquer l'application
        res.locals.isAuthenticated = false;
        res.locals.currentUser = null;
        res.locals.user = null;
        res.locals.admin = null;
        res.locals.hasRole = () => false;
        res.locals.isActive = () => false;
        res.locals.isAdmin = false;
        res.locals.isCompany = false;
        next();
    }
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
            console.log(`👤 User connecté: ID ${req.session.userId}, Role: ${req.session.user?.role}`);
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
        sessionId: req.sessionID,
        userRole: req.session?.user?.role
    });
});

app.post('/test-auth', (req, res) => {
    console.log('✅ Route POST /test-auth appelée');
    console.log('Body reçu:', req.body);
    res.json({
        success: true,
        message: 'Test auth API OK',
        receivedData: req.body,
        authenticated: !!req.session?.userId,
        userRole: req.session?.user?.role
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

// 🏢 CORRECTION: Routes entreprise (AVANT les autres pour éviter les conflits)
console.log('🏢 Montage des routes Espace Entreprise sur /entreprise');
app.use('/entreprise', companyRoutes);

// 📊 Routes Dashboard
console.log('📊 Montage des routes Dashboard');
app.use('/', dashboardRoutes);

// 📋 Routes de formation existantes
console.log('📋 Montage de formationRoutes sur /');
app.use('/', formationRoutes);

// 👥 Routes étudiants existantes
console.log('👥 Montage de etudiantsRoutes sur /');
app.use('/', etudiantsRoutes);

// ========================================
// 🏠 ROUTES PRINCIPALES
// ========================================

// Page d'accueil
app.get('/', (req, res) => {
    console.log('🏠 Accès page d\'accueil');
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

// CORRECTION: Dashboard avec redirection selon authentification
app.get('/dashboard', async (req, res, next) => {
    console.log('📊 Accès route /dashboard');
    
    if (!req.session?.userId) {
        console.log('❌ Utilisateur non connecté');
        req.flash('info', 'Veuillez vous connecter pour accéder au tableau de bord.');
        return res.redirect('/auth/login');
    }
    
    // CORRECTION: Les données utilisateur sont déjà récupérées par le middleware global
    const user = req.session.user;
    
    if (!user || !user.role) {
        console.log('❌ Données utilisateur manquantes, redirection login');
        req.session.destroy();
        return res.redirect('/auth/login');
    }
    
    const userRole = user.role;
    console.log(`🎯 Role utilisateur: ${userRole}`);
    
    // Redirection selon le rôle
    switch (userRole) {
        case 'societe':
            console.log('🏢 Redirection entreprise vers /entreprise');
            return res.redirect('/entreprise');
            
        case 'admin':
            console.log('👑 Redirection admin vers /admin');
            return res.redirect('/admin');
            
        case 'instructeur':
        case 'formateur':
            console.log('🎓 Redirection formateur vers /instructeur/dashboard');
            return res.redirect('/instructeur/dashboard');
            
        default:
            // Utilisateurs normaux (employés, étudiants, etc.)
            console.log('👤 Affichage dashboard étudiant');
            try {
                await DashboardController.dashboard(req, res);
            } catch (error) {
                console.error('💥 Erreur dashboard controller:', error);
                next(error);
            }
            break;
    }
});

// Route de déconnexion rapide
app.get('/logout', (req, res) => {
    console.log('🚪 Déconnexion utilisateur');
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
            console.log(`🏢 Entreprise: http://localhost:${PORT}/entreprise`);
            
            console.log('\n🧪 Routes de test:');
            console.log(`  GET  http://localhost:${PORT}/test-server`);
            console.log(`  POST http://localhost:${PORT}/test-auth`);
            
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