import express from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { authMiddleware, guestMiddleware } from '../middleware/authMiddleware.js';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';
import { validateRegistration, validateLogin, validatePasswordReset } from '../middleware/validationMiddleware.js';

const router = express.Router();
const authController = new AuthController();

// Pages d'authentification (redirige si déjà connecté)
router.get('/connexion', guestMiddleware, authController.showLogin);
router.get('/inscription', guestMiddleware, authController.showRegister);
router.get('/mot-de-passe-oublie', guestMiddleware, authController.showForgotPassword);
router.get('/reinitialiser-mot-de-passe/:token', guestMiddleware, authController.showResetPassword);

// API d'authentification avec limitation de taux
router.post('/api/connexion', 
    rateLimitMiddleware(5, 15), // 5 tentatives par 15 minutes
    validateLogin,
    authController.login
);

router.post('/api/inscription',
    rateLimitMiddleware(3, 60), // 3 inscriptions par heure
    validateRegistration,
    authController.register
);

router.post('/api/mot-de-passe-oublie',
    rateLimitMiddleware(3, 60), // 3 demandes par heure
    authController.forgotPassword
);

router.post('/api/reinitialiser-mot-de-passe',
    rateLimitMiddleware(3, 15), // 3 tentatives par 15 minutes
    validatePasswordReset,
    authController.resetPassword
);

router.post('/api/deconnexion', authMiddleware, authController.logout);

// Vérification d'email
router.get('/verifier-email/:token', authController.verifyEmail);
router.post('/api/renvoyer-verification', 
    rateLimitMiddleware(2, 60), // 2 envois par heure
    authController.resendVerification
);

// Authentification sociale
router.get('/connexion/:provider', authController.socialLogin);
router.get('/connexion/:provider/callback', authController.socialCallback);

// Vérification de l'état d'authentification
router.get('/api/verifier-auth', authController.checkAuth);

// Profil utilisateur (protégé)
router.get('/api/profil', authMiddleware, authController.getProfile);
router.put('/api/profil', authMiddleware, authController.updateProfile);

export default router;
