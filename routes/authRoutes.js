import express from 'express';
import {
    renderLogin,
    renderRegister,
    renderProfile,
    processLogin,
    processRegister,
    updateProfile,
    changePassword,
    logout,
    checkAuthStatus
} from '../controllers/authController.js';

import {
    requireAuth,
    requireActiveUser,
    requireRole,
    requireAdmin,
    requireInstructeur,
    redirectIfAuthenticated,
    optionalAuth,
    requireApiAuth
} from '../middleware/authMiddleware.js';

const router = express.Router();

// ========================================
// 🔐 ROUTES D'AUTHENTIFICATION
// ========================================

/**
 * 📄 Routes des pages d'authentification
 */
// Page de connexion (accessible uniquement si non connecté)
router.get('/login', redirectIfAuthenticated, renderLogin);

// Page d'inscription (accessible uniquement si non connecté)  
router.get('/register', redirectIfAuthenticated, renderRegister);

// Page de profil (nécessite authentification)
router.get('/profile', requireAuth, renderProfile);

/**
 * 📝 Routes de traitement des formulaires
 */
// Traitement de la connexion
router.post('/login', redirectIfAuthenticated, processLogin);

// Traitement de l'inscription
router.post('/register', redirectIfAuthenticated, processRegister);

// Mise à jour du profil
router.post('/profile', requireAuth, updateProfile);

// Changement de mot de passe
router.post('/change-password', requireAuth, changePassword);

// Déconnexion
router.post('/logout', requireAuth, logout);
router.get('/logout', requireAuth, logout); // Support GET pour les liens

// ========================================
// 🔌 ROUTES API
// ========================================

/**
 * API d'authentification (pour AJAX/SPA)
 */
router.get('/api/status', requireApiAuth, checkAuthStatus);

// Vérification rapide du statut (sans token obligatoire)
router.get('/api/check', optionalAuth, (req, res) => {
    res.json({
        authenticated: !!req.user,
        user: req.user || null
    });
});

// API de déconnexion
router.post('/api/logout', requireApiAuth, (req, res) => {
    req.session.destroy((err) => {
        res.clearCookie('connect.sid');
        res.clearCookie('rememberToken');
        res.json({ 
            success: true, 
            message: 'Déconnexion réussie' 
        });
    });
});

// ========================================
// 🎯 ROUTES DE REDIRECTION
// ========================================

/**
 * Routes de redirection selon le rôle
 */
router.get('/dashboard-redirect', requireAuth, (req, res) => {
    const { role } = req.user;
    
    switch (role) {
        case 'admin':
            res.redirect('/admin/dashboard');
            break;
        case 'instructeur':
            res.redirect('/instructeur/dashboard');
            break;
        case 'societe':       // <-- Ajouté ici
            res.redirect('/entreprise/dashboard');
            break;
        case 'etudiant':
        default:
            res.redirect('/etudiant/dashboard');
            break;
    }
});

// ========================================
// 🛡️ ROUTES DE DÉMONSTRATION DES PERMISSIONS
// ========================================

/**
 * Exemples de routes protégées par rôle
 */
// Route accessible aux administrateurs uniquement
router.get('/admin-only', requireAuth, requireAdmin, (req, res) => {
    res.render('admin/admin-panel', {
        title: 'Administration - ADSIAM',
        user: req.user
    });
});

// Route accessible aux instructeurs et administrateurs
router.get('/instructeur-access', requireAuth, requireInstructeur, (req, res) => {
    res.render('instructeur/panel', {
        title: 'Espace Instructeur - ADSIAM',
        user: req.user
    });
});

// Route nécessitant un compte actif
router.get('/formations-actives', requireAuth, requireActiveUser, (req, res) => {
    res.render('formations/catalogue', {
        title: 'Formations Disponibles - ADSIAM',
        user: req.user,
        layout: 'layouts/main'
    });
});

// Route avec rôles spécifiques
router.get('/gestion-utilisateurs', requireAuth, requireRole('admin', 'instructeur'), (req, res) => {
    res.render('admin/users-management', {
        title: 'Gestion des Utilisateurs - ADSIAM',
        user: req.user,
        canManageAll: req.user.role === 'admin'
    });
});

// ========================================
// 🔄 ROUTES DE RÉCUPÉRATION DE MOT DE PASSE
// ========================================

/**
 * Routes pour la récupération de mot de passe (à implémenter)
 */
router.get('/forgot-password', redirectIfAuthenticated, (req, res) => {
    res.render('auth/forgot-password', {
        title: 'Mot de passe oublié - ADSIAM',
        layout: 'layouts/auth',
        error: req.flash('error'),
        success: req.flash('success')
    });
});

router.post('/forgot-password', redirectIfAuthenticated, (req, res) => {
    // TODO: Implémenter la logique d'envoi d'email
    req.flash('success', 'Si votre email existe dans notre base, vous recevrez un lien de réinitialisation.');
    res.redirect('/auth/forgot-password');
});

router.get('/reset-password/:token', redirectIfAuthenticated, (req, res) => {
    // TODO: Vérifier la validité du token
    res.render('auth/reset-password', {
        title: 'Réinitialiser le mot de passe - ADSIAM',
        layout: 'layouts/auth',
        token: req.params.token,
        error: req.flash('error')
    });
});

// ========================================
// 🔍 ROUTES DE GESTION DES ERREURS
// ========================================

/**
 * Route pour les erreurs d'authentification
 */
router.get('/error/unauthorized', (req, res) => {
    res.status(401).render('errors/401', {
        title: 'Accès non autorisé - ADSIAM',
        layout: 'layouts/error',
        message: 'Vous devez être connecté pour accéder à cette page.'
    });
});

router.get('/error/forbidden', (req, res) => {
    res.status(403).render('errors/403', {
        title: 'Accès interdit - ADSIAM', 
        layout: 'layouts/error',
        message: 'Vous n\'avez pas les permissions nécessaires.'
    });
});

// ========================================
// 🎫 MIDDLEWARE D'INITIALISATION DU USER
// ========================================

/**
 * Middleware pour toutes les routes auth
 * Initialise les données utilisateur dans res.locals
 */
router.use('*', optionalAuth, (req, res, next) => {
    // Rendre les helpers disponibles dans toutes les vues
    res.locals.isAuthenticated = !!req.user;
    res.locals.currentUser = req.user || null;
    
    // Helpers pour les vues EJS
    res.locals.hasRole = (role) => {
        return req.user ? req.user.hasRole(role) : false;
    };
    
    res.locals.isActive = () => {
        return req.user ? req.user.isActive() : false;
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
    
    res.locals.getStatusText = (status) => {
        const texts = {
            'actif': 'Actif',
            'en_attente': 'En attente',
            'inactif': 'Inactif',
            'suspendu': 'Suspendu'
        };
        return texts[status] || 'Inconnu';
    };

    next();
});

export default router;