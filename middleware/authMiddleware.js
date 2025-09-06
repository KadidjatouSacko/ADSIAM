import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt_super_securise_adsiam_2024';

// Middleware pour vérifier l'authentification
export const authMiddleware = async (req, res, next) => {
    try {
        // Récupérer le token depuis le cookie ou l'en-tête Authorization
        let token = req.cookies.auth_token;
        
        if (!token && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token d\'authentification manquant'
            });
        }

        // Vérifier et décoder le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Récupérer l'utilisateur
        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password', 'passwordResetToken', 'refreshToken'] }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Utilisateur introuvable'
            });
        }

        // Vérifier le statut du compte
        if (!user.canLogin()) {
            let message = 'Accès refusé';
            
            if (user.status !== 'active') {
                message = 'Compte non activé';
            } else if (!user.isVerified()) {
                message = 'Email non vérifié';
            } else if (user.isLocked()) {
                message = 'Compte temporairement verrouillé';
            }
            
            return res.status(403).json({
                success: false,
                message
            });
        }

        // Ajouter l'utilisateur à la requête
        req.user = user;
        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token invalide'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expiré'
            });
        }

        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur d\'authentification'
        });
    }
};

// Middleware pour les invités (redirige si connecté)
export const guestMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.auth_token;
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findByPk(decoded.id);
            
            if (user && user.canLogin()) {
                // Utilisateur connecté, rediriger vers le dashboard
                if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                    return res.json({
                        success: false,
                        message: 'Déjà connecté',
                        redirect: '/dashboard'
                    });
                }
                return res.redirect('/dashboard');
            }
        }
        
        next();
    } catch (error) {
        // Token invalide ou expiré, continuer vers la page d'auth
        next();
    }
};

// Middleware pour vérifier les rôles
export const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentification requise'
            });
        }

        const userRole = req.user.role;
        const hasRole = Array.isArray(allowedRoles) 
            ? allowedRoles.includes(userRole)
            : allowedRoles === userRole;

        if (!hasRole) {
            return res.status(403).json({
                success: false,
                message: 'Permissions insuffisantes'
            });
        }

        next();
    };
};

// Middleware pour vérifier les permissions spécifiques
export const permissionMiddleware = (requiredPermission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentification requise'
            });
        }

        if (!req.user.hasPermission(requiredPermission)) {
            return res.status(403).json({
                success: false,
                message: `Permission '${requiredPermission}' requise`
            });
        }

        next();
    };
};

// Middleware pour l'authentification optionnelle (ajoute user si connecté)
export const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.auth_token;
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findByPk(decoded.id, {
                attributes: { exclude: ['password', 'passwordResetToken', 'refreshToken'] }
            });
            
            if (user && user.canLogin()) {
                req.user = user;
            }
        }
    } catch (error) {
        // Ignorer les erreurs, l'auth est optionnelle
        console.log('Optional auth middleware error:', error.message);
    }
    
    next();
};

// Middleware pour vérifier l'email vérifié
export const emailVerifiedMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentification requise'
        });
    }

    if (!req.user.isVerified()) {
        return res.status(403).json({
            success: false,
            message: 'Vérification de l\'email requise',
            code: 'EMAIL_NOT_VERIFIED'
        });
    }

    next();
};

// Middleware pour vérifier que le compte est actif
export const activeAccountMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentification requise'
        });
    }

    if (!req.user.isActive()) {
        return res.status(403).json({
            success: false,
            message: 'Compte non actif',
            code: 'ACCOUNT_INACTIVE'
        });
    }

    next();
};

// Middleware pour les propriétaires de ressources
export const ownershipMiddleware = (resourceModel, resourceIdParam = 'id') => {
    return async (req, res, next) => {
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

            const resourceId = req.params[resourceIdParam];
            const resource = await resourceModel.findByPk(resourceId);

            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: 'Ressource introuvable'
                });
            }

            // Vérifier si l'utilisateur est propriétaire
            if (resource.userId !== req.user.id && resource.authorId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès refusé à cette ressource'
                });
            }

            req.resource = resource;
            next();

        } catch (error) {
            console.error('Ownership middleware error:', error);
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de la vérification des droits'
            });
        }
    };
};

// Middleware pour limiter l'accès par statut de compte
export const accountStatusMiddleware = (allowedStatuses) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentification requise'
            });
        }

        const statusArray = Array.isArray(allowedStatuses) ? allowedStatuses : [allowedStatuses];
        
        if (!statusArray.includes(req.user.status)) {
            return res.status(403).json({
                success: false,
                message: 'Statut de compte non autorisé',
                code: 'INVALID_ACCOUNT_STATUS'
            });
        }

        next();
    };
};


// 🛡️ Middleware d'authentification
export const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token d\'accès manquant'
            });
        }

        // Vérifier le token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Vérifier que l'utilisateur existe toujours
        const user = await User.findByPk(decoded.userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        // Vérifier que le compte est actif
        if (user.statut === 'suspendu') {
            return res.status(403).json({
                success: false,
                message: 'Compte suspendu'
            });
        }

        // Ajouter les infos user à la requête
        req.user = {
            userId: user.id,
            email: user.email,
            role: user.role,
            statut: user.statut
        };

        next();

    } catch (error) {
        console.error('Erreur authentification:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token invalide'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expiré'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Erreur lors de la vérification du token'
        });
    }
};

/**
 * 🛡️ Middleware d'authentification principal
 * Vérifie la session ET les tokens JWT
 */
export const requireAuth = async (req, res, next) => {
    try {
        let user = null;
        let userId = null;

        // 1. Vérifier la session d'abord
        if (req.session?.userId) {
            userId = req.session.userId;
        }
        // 2. Sinon vérifier le cookie "Remember Me"
        else if (req.cookies?.rememberToken) {
            try {
                const decoded = jwt.verify(req.cookies.rememberToken, JWT_SECRET);
                userId = decoded.userId;
                
                // Restaurer la session
                req.session.userId = userId;
                req.session.userToken = req.cookies.rememberToken;
            } catch (tokenError) {
                // Token invalide, supprimer le cookie
                res.clearCookie('rememberToken');
            }
        }
        // 3. Enfin vérifier l'en-tête Authorization (pour API)
        else if (req.headers.authorization) {
            const token = req.headers.authorization.split(' ')[1];
            if (token) {
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    userId = decoded.userId;
                } catch (tokenError) {
                    console.error('Token JWT invalide:', tokenError.message);
                }
            }
        }

        // Si aucune authentification trouvée
        if (!userId) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentification requise',
                    redirectTo: '/auth/login'
                });
            }
            return res.redirect('/auth/login');
        }

        // Récupérer l'utilisateur de la base de données
        user = await User.findByPk(userId);
        if (!user) {
            // Utilisateur n'existe plus, nettoyer la session
            req.session.destroy();
            res.clearCookie('rememberToken');
            
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({
                    success: false,
                    message: 'Utilisateur non trouvé',
                    redirectTo: '/auth/login'
                });
            }
            return res.redirect('/auth/login');
        }

        // Vérifier le statut du compte
        if (user.statut === 'suspendu') {
            req.session.destroy();
            res.clearCookie('rememberToken');
            
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(403).json({
                    success: false,
                    message: 'Compte suspendu',
                    redirectTo: '/auth/login'
                });
            }
            
            req.flash('error', 'Votre compte a été suspendu. Contactez l\'administrateur.');
            return res.redirect('/auth/login');
        }

        // Attacher les infos utilisateur à la requête
        req.user = {
            userId: userId,
            email: user.email,
            prenom: user.prenom,
            nom: user.nom,
            role: user.role,
            statut: user.statut,
            nomComplet: user.getNomComplet(),
            isActive: user.isActive(),
            hasRole: (role) => user.hasRole(role)
        };

        // Rendre l'utilisateur disponible dans les vues
        res.locals.currentUser = req.user;

        next();

    } catch (error) {
        console.error('Erreur middleware auth:', error);
        
        // Nettoyer en cas d'erreur
        if (req.session) {
            req.session.destroy();
        }
        res.clearCookie('rememberToken');

        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(500).json({
                success: false,
                message: 'Erreur d\'authentification',
                redirectTo: '/auth/login'
            });
        }
        
        res.redirect('/auth/login');
    }
};

/**
 * 👑 Middleware de vérification des rôles
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
 * ✅ Middleware pour vérifier le statut actif
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

/**
 * 🔄 Middleware optionnel d'authentification
 * N'exige pas l'authentification mais charge l'utilisateur si connecté
 */
export const optionalAuth = async (req, res, next) => {
    try {
        let userId = null;

        // Vérifier la session
        if (req.session?.userId) {
            userId = req.session.userId;
        }
        // Vérifier le cookie Remember Me
        else if (req.cookies?.rememberToken) {
            try {
                const decoded = jwt.verify(req.cookies.rememberToken, JWT_SECRET);
                userId = decoded.userId;
                req.session.userId = userId;
                req.session.userToken = req.cookies.rememberToken;
            } catch (error) {
                res.clearCookie('rememberToken');
            }
        }

        if (userId) {
            const user = await User.findByPk(userId);
            if (user && user.statut !== 'suspendu') {
                req.user = {
                    userId: user.id,
                    email: user.email,
                    prenom: user.prenom,
                    nom: user.nom,
                    role: user.role,
                    statut: user.statut,
                    nomComplet: user.getNomComplet(),
                    isActive: user.isActive(),
                    hasRole: (role) => user.hasRole(role)
                };

                res.locals.currentUser = req.user;
            }
        }

        next();
    } catch (error) {
        console.error('Erreur middleware auth optionnel:', error);
        next(); // Continuer même en cas d'erreur
    }
};

/**
 * 🚫 Middleware pour les utilisateurs NON connectés
 * Redirige les utilisateurs connectés vers le dashboard
 */
export const redirectIfAuthenticated = (req, res, next) => {
    if (req.session?.userId || req.cookies?.rememberToken) {
        return res.redirect('/dashboard');
    }
    next();
};

// Middlewares spécifiques par rôle
export const requireAdmin = requireRole('admin');
export const requireInstructeur = requireRole('admin', 'instructeur');
export const requireEtudiant = requireRole('admin', 'instructeur', 'etudiant');

/**
 * 🔒 Middleware pour protéger les routes API
 */
export const requireApiAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token d\'authentification requis',
                code: 'MISSING_TOKEN'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Utilisateur non trouvé',
                code: 'USER_NOT_FOUND'
            });
        }

        if (user.statut === 'suspendu') {
            return res.status(403).json({
                success: false,
                message: 'Compte suspendu',
                code: 'ACCOUNT_SUSPENDED'
            });
        }

        req.user = {
            userId: user.id,
            email: user.email,
            role: user.role,
            statut: user.statut
        };

        next();

    } catch (error) {
        console.error('Erreur auth API:', error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token invalide',
                code: 'INVALID_TOKEN'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expiré',
                code: 'EXPIRED_TOKEN'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Erreur d\'authentification',
            code: 'AUTH_ERROR'
        });
    }
};