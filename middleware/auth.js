import { sequelize } from '../models/index.js';
import { QueryTypes } from 'sequelize';

// ========================================
// 🛡️ MIDDLEWARE D'AUTHENTIFICATION PRINCIPAL
// ========================================

/**
 * Middleware d'authentification basé sur les sessions
 * Compatible avec votre table `users` existante
 */
export const requireAuth = async (req, res, next) => {
    try {
        // Vérifier si l'utilisateur est connecté via session
        if (!req.session?.userId) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentification requise',
                    redirectTo: '/auth/login'
                });
            }
            req.flash('info', 'Veuillez vous connecter pour accéder à cette page.');
            return res.redirect('/auth/login');
        }

        // Récupérer l'utilisateur depuis la base de données
        const userData = await sequelize.query(`
            SELECT 
                u.id, u.prenom, u.nom, u.email, u.telephone,
                u.type_utilisateur, u.statut, u.role, u.societe_rattachee,
                u.derniere_connexion, u.date_inscription,
                CASE 
                    WHEN u.type_utilisateur = 'aide_domicile' THEN 'Aide à domicile'
                    WHEN u.type_utilisateur = 'aide_soignant' THEN 'Aide-soignant'
                    WHEN u.type_utilisateur = 'formateur' THEN 'Formateur'
                    WHEN u.type_utilisateur = 'gestionnaire' THEN 'Gestionnaire'
                    ELSE 'Utilisateur'
                END as type_display
            FROM users u 
            WHERE u.id = :userId AND u.statut != 'supprime'
        `, {
            type: QueryTypes.SELECT,
            replacements: { userId: req.session.userId }
        });

        if (!userData || userData.length === 0) {
            // Utilisateur non trouvé, nettoyer la session
            req.session.destroy();
            
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({
                    success: false,
                    message: 'Utilisateur non trouvé',
                    redirectTo: '/auth/login'
                });
            }
            req.flash('error', 'Votre session a expiré. Veuillez vous reconnecter.');
            return res.redirect('/auth/login');
        }

        const user = userData[0];

        // Vérifier le statut du compte
        if (user.statut === 'suspendu' || user.statut === 'inactif') {
            req.session.destroy();
            
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(403).json({
                    success: false,
                    message: user.statut === 'suspendu' ? 'Compte suspendu' : 'Compte inactif',
                    redirectTo: '/auth/login'
                });
            }
            
            req.flash('error', 
                user.statut === 'suspendu' 
                    ? 'Votre compte a été suspendu. Contactez l\'administrateur.'
                    : 'Votre compte est inactif. Contactez le support.'
            );
            return res.redirect('/auth/login');
        }

        // Attacher les informations utilisateur à la requête
        req.user = {
            id: user.id,
            prenom: user.prenom,
            nom: user.nom,
            email: user.email,
            telephone: user.telephone,
            type_utilisateur: user.type_utilisateur,
            type_display: user.type_display,
            statut: user.statut,
            role: user.role,
            societe_rattachee: user.societe_rattachee,
            derniere_connexion: user.derniere_connexion,
            date_inscription: user.date_inscription,
            // Méthodes utilitaires
            nomComplet: `${user.prenom} ${user.nom}`,
            isActive: () => user.statut === 'actif',
            hasRole: (role) => user.role === role,
            isCompany: () => user.role === 'societe',
            isAdmin: () => user.role === 'admin',
            isStudent: () => user.role === 'apprenant',
            isInstructor: () => user.role === 'formateur'
        };

        // Rendre l'utilisateur disponible dans les vues
        res.locals.currentUser = req.user;
        res.locals.isAuthenticated = true;

        next();

    } catch (error) {
        console.error('Erreur middleware auth:', error);
        
        // Nettoyer en cas d'erreur
        if (req.session) {
            req.session.destroy();
        }

        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(500).json({
                success: false,
                message: 'Erreur d\'authentification',
                redirectTo: '/auth/login'
            });
        }
        
        req.flash('error', 'Une erreur est survenue. Veuillez vous reconnecter.');
        res.redirect('/auth/login');
    }
};

// ========================================
// 🔐 MIDDLEWARE DE VÉRIFICATION DES RÔLES
// ========================================

/**
 * Middleware pour vérifier les rôles spécifiques
 */
export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentification requise'
                });
            }
            return res.redirect('/auth/login');
        }

        if (!allowedRoles.includes(req.user.role)) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permissions insuffisantes'
                });
            }
            
            req.flash('error', 'Vous n\'avez pas les permissions pour accéder à cette page.');
            return res.redirect('/dashboard');
        }

        next();
    };
};

/**
 * Middleware pour vérifier le statut actif
 */
export const requireActiveUser = (req, res, next) => {
    if (!req.user) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({
                success: false,
                message: 'Authentification requise'
            });
        }
        return res.redirect('/auth/login');
    }

    if (req.user.statut !== 'actif') {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(403).json({
                success: false,
                message: 'Compte non activé',
                userStatus: req.user.statut
            });
        }

        let message = 'Votre compte n\'est pas encore activé.';
        if (req.user.statut === 'en_attente') {
            message = 'Votre compte est en attente de validation par un administrateur.';
        } else if (req.user.statut === 'inactif') {
            message = 'Votre compte est inactif. Contactez le support pour le réactiver.';
        }

        req.flash('warning', message);
        return res.redirect('/dashboard');
    }

    next();
};

// ========================================
// 🔓 MIDDLEWARE D'AUTHENTIFICATION OPTIONNELLE
// ========================================

/**
 * Middleware optionnel qui charge l'utilisateur s'il est connecté
 * N'exige pas l'authentification
 */
export const optionalAuth = async (req, res, next) => {
    try {
        if (req.session?.userId) {
            const userData = await sequelize.query(`
                SELECT 
                    u.id, u.prenom, u.nom, u.email, u.type_utilisateur, 
                    u.statut, u.role, u.societe_rattachee,
                    CASE 
                        WHEN u.type_utilisateur = 'aide_domicile' THEN 'Aide à domicile'
                        WHEN u.type_utilisateur = 'aide_soignant' THEN 'Aide-soignant'
                        WHEN u.type_utilisateur = 'formateur' THEN 'Formateur'
                        WHEN u.type_utilisateur = 'gestionnaire' THEN 'Gestionnaire'
                        ELSE 'Utilisateur'
                    END as type_display
                FROM users u 
                WHERE u.id = :userId AND u.statut NOT IN ('suspendu', 'supprime')
            `, {
                type: QueryTypes.SELECT,
                replacements: { userId: req.session.userId }
            });

            if (userData && userData.length > 0) {
                const user = userData[0];
                req.user = {
                    id: user.id,
                    prenom: user.prenom,
                    nom: user.nom,
                    email: user.email,
                    type_utilisateur: user.type_utilisateur,
                    type_display: user.type_display,
                    statut: user.statut,
                    role: user.role,
                    societe_rattachee: user.societe_rattachee,
                    nomComplet: `${user.prenom} ${user.nom}`,
                    isActive: () => user.statut === 'actif',
                    hasRole: (role) => user.role === role,
                    isCompany: () => user.role === 'societe',
                    isAdmin: () => user.role === 'admin'
                };

                res.locals.currentUser = req.user;
                res.locals.isAuthenticated = true;
            }
        }

        next();
    } catch (error) {
        console.error('Erreur middleware auth optionnel:', error);
        next(); // Continuer même en cas d'erreur
    }
};

// ========================================
// 🚫 MIDDLEWARE POUR UTILISATEURS NON CONNECTÉS
// ========================================

/**
 * Redirige les utilisateurs connectés vers le dashboard
 */
export const redirectIfAuthenticated = (req, res, next) => {
    if (req.session?.userId) {
        return res.redirect('/dashboard');
    }
    next();
};

// ========================================
// 🏢 MIDDLEWARE SPÉCIFIQUE POUR LES ENTREPRISES
// ========================================

/**
 * Vérifie que l'utilisateur a le rôle 'societe'
 */
export const requireCompany = [
    requireAuth,
    requireRole('societe'),
    requireActiveUser
];

/**
 * Vérifie que l'utilisateur connecté a bien le rôle société
 * (Version simplifiée du checkCompany pour les routes /entreprise)
 */
export const checkCompany = async (req, res, next) => {
    try {
        // Vérification de l'authentification
        if (!req.session?.userId) {
            req.flash('error', 'Vous devez être connecté pour accéder à cet espace.');
            return res.redirect('/auth/login');
        }

        // Récupérer l'utilisateur pour vérifier son rôle
        const userData = await sequelize.query(`
            SELECT role, statut, societe_rattachee, prenom, nom 
            FROM users 
            WHERE id = :userId
        `, {
            type: QueryTypes.SELECT,
            replacements: { userId: req.session.userId }
        });

        if (!userData || userData.length === 0) {
            req.flash('error', 'Utilisateur non trouvé.');
            return res.redirect('/auth/login');
        }

        const user = userData[0];

        // Vérification du rôle société
        if (user.role !== 'societe') {
            req.flash('error', 'Accès réservé aux entreprises partenaires.');
            return res.redirect('/dashboard');
        }

        // Vérification du statut actif
        if (user.statut !== 'actif') {
            req.flash('warning', 'Votre compte entreprise est en attente d\'activation. Contactez notre équipe.');
            return res.redirect('/dashboard');
        }

        // Enrichir la session avec les données entreprise si pas déjà fait
        if (!req.session.user || !req.session.user.societe_rattachee) {
            req.session.user = {
                id: req.session.userId,
                role: user.role,
                statut: user.statut,
                societe_rattachee: user.societe_rattachee,
                prenom: user.prenom,
                nom: user.nom
            };
        }

        next();
    } catch (error) {
        console.error('Erreur middleware checkCompany:', error);
        req.flash('error', 'Erreur d\'authentification. Veuillez vous reconnecter.');
        res.redirect('/auth/login');
    }
};

// ========================================
// 🎯 MIDDLEWARE SPÉCIFIQUES PAR RÔLE
// ========================================

// Middleware pour administrateurs
export const requireAdmin = [
    requireAuth,
    requireRole('admin'),
    requireActiveUser
];

// Middleware pour formateurs
export const requireInstructor = [
    requireAuth,
    requireRole('formateur', 'admin'),
    requireActiveUser
];

// Middleware pour apprenants
export const requireStudent = [
    requireAuth,
    requireRole('apprenant', 'admin'),
    requireActiveUser
];

// Middleware générique pour vérifier un rôle spécifique
export const hasRole = (role) => [
    requireAuth,
    requireRole(role),
    requireActiveUser
];

// ========================================
// 🔧 HELPERS POUR LES MIDDLEWARES
// ========================================

/**
 * Vérifie si l'utilisateur peut accéder à une ressource d'une entreprise
 */
export const checkCompanyAccess = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentification requise'
            });
        }

        // Les admins ont accès à tout
        if (req.user.role === 'admin') {
            return next();
        }

        // Pour les entreprises, vérifier l'accès à leur propre société
        if (req.user.role === 'societe') {
            // L'utilisateur ne peut accéder qu'aux données de sa propre entreprise
            const companyId = req.params.companyId || req.user.societe_rattachee;
            
            if (req.user.societe_rattachee !== companyId) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès refusé à cette entreprise'
                });
            }
        }

        next();
    } catch (error) {
        console.error('Erreur vérification accès entreprise:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors de la vérification des droits'
        });
    }
};

// ========================================
// 📱 EXPORTS POUR COMPATIBILITÉ
// ========================================

// Export des middlewares dans le format demandé
export const ensureAuth = requireAuth;
export const isStudent = requireStudent;
export const isAdmin = requireAdmin;
export const isInstructor = requireInstructor;
export const emailVerified = requireActiveUser; // Adaptation - pas de système email séparé
export const activeAccount = requireActiveUser;

// Fonction helper pour créer des middlewares de permission
export const hasPermission = (permission) => [
    requireAuth,
    (req, res, next) => {
        // Logique de permission personnalisée selon vos besoins
        // Pour l'instant, on utilise les rôles existants
        if (req.user.role === 'admin') {
            return next();
        }
        
        return res.status(403).json({
            success: false,
            message: `Permission '${permission}' requise`
        });
    }
];

export default {
    requireAuth,
    requireRole,
    requireActiveUser,
    optionalAuth,
    redirectIfAuthenticated,
    requireCompany,
    checkCompany,
    requireAdmin,
    requireInstructor,
    requireStudent,
    hasRole,
    checkCompanyAccess,
    ensureAuth,
    isStudent,
    isAdmin,
    isInstructor,
    emailVerified,
    activeAccount,
    hasPermission
};

// // middleware/auth.js
// import { authMiddleware, roleMiddleware, permissionMiddleware, optionalAuthMiddleware, emailVerifiedMiddleware, activeAccountMiddleware } from './authMiddleware.js';

// // Vérifie que l'utilisateur est connecté et actif
// export const ensureAuth = authMiddleware;

// // Vérifie que l'utilisateur est un étudiant
// export const isStudent = [
//     authMiddleware,
//     roleMiddleware('student')
// ];

// // Vérifie que l'utilisateur est un administrateur
// export const isAdmin = [
//     authMiddleware,
//     roleMiddleware('admin')
// ];

// // Vérifie que l'utilisateur est un instructeur
// export const isInstructor = [
//     authMiddleware,
//     roleMiddleware('instructor')
// ];

// // Vérifie un rôle spécifique
// export const hasRole = (role) => [
//     authMiddleware,
//     roleMiddleware(role)
// ];

// // Vérifie une permission spécifique
// export const hasPermission = (permission) => [
//     authMiddleware,
//     permissionMiddleware(permission)
// ];

// // Vérification optionnelle (user ajouté si connecté)
// export const optionalAuth = optionalAuthMiddleware;

// // Vérifie que l'email est confirmé
// export const emailVerified = emailVerifiedMiddleware;

// // Vérifie que le compte est actif
// export const activeAccount = activeAccountMiddleware;
