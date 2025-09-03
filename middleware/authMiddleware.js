import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

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