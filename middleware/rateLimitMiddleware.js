import { redisService } from '../services/RedisService.js';
// Service Redis pour le cache
// const redisService = new RedisService();


/**
 * Middleware de limitation de taux (rate limiting)
 * @param {number} maxAttempts - Nombre maximum de tentatives
 * @param {number} windowMinutes - Fenêtre de temps en minutes
 * @param {object} options - Options supplémentaires
 */
export const rateLimitMiddleware = (maxAttempts = 5, windowMinutes = 15, options = {}) => {
    return async (req, res, next) => {
        try {
            // Identifier l'utilisateur (IP ou user ID si connecté)
            const identifier = getIdentifier(req, options);
            const key = `rate_limit:${options.prefix || 'default'}:${identifier}`;
            
            // Récupérer le nombre de tentatives actuelles
            const current = await redisService.get(key);
            const attempts = current ? parseInt(current) : 0;
            
            // Vérifier si la limite est atteinte
            if (attempts >= maxAttempts) {
                const ttl = await redisService.ttl(key);
                const resetTime = Math.ceil(ttl / 60); // minutes restantes
                
                return res.status(429).json({
                    success: false,
                    message: options.message || `Trop de tentatives. Réessayez dans ${resetTime} minute(s).`,
                    retryAfter: resetTime * 60, // en secondes
                    limit: maxAttempts,
                    remaining: 0,
                    resetTime: new Date(Date.now() + (ttl * 1000))
                });
            }
            
            // Incrémenter le compteur
            const newCount = attempts + 1;
            const windowSeconds = windowMinutes * 60;
            
            if (attempts === 0) {
                // Premier essai, définir l'expiration
                await redisService.setex(key, windowSeconds, newCount);
            } else {
                // Incrémenter sans modifier l'expiration
                await redisService.incr(key);
            }
            
            // Ajouter les headers de rate limiting
            const remaining = Math.max(0, maxAttempts - newCount);
            const ttl = await redisService.ttl(key);
            
            res.set({
                'X-RateLimit-Limit': maxAttempts,
                'X-RateLimit-Remaining': remaining,
                'X-RateLimit-Reset': new Date(Date.now() + (ttl * 1000)).toISOString(),
                'X-RateLimit-Window': `${windowMinutes}m`
            });
            
            next();
            
        } catch (error) {
            console.error('Rate limit middleware error:', error);
            // En cas d'erreur Redis, laisser passer la requête
            next();
        }
    };
};

/**
 * Limitation spécifique pour les connexions
 */
export const loginRateLimit = rateLimitMiddleware(5, 15, {
    prefix: 'login',
    message: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.'
});

/**
 * Limitation pour les inscriptions
 */
export const registerRateLimit = rateLimitMiddleware(3, 60, {
    prefix: 'register',
    message: 'Trop d\'inscriptions depuis cette adresse. Réessayez plus tard.'
});

/**
 * Limitation pour les demandes de réinitialisation de mot de passe
 */
export const forgotPasswordRateLimit = rateLimitMiddleware(3, 60, {
    prefix: 'forgot_password',
    message: 'Trop de demandes de réinitialisation. Réessayez plus tard.'
});

/**
 * Limitation pour l'envoi d'emails de vérification
 */
export const verificationEmailRateLimit = rateLimitMiddleware(2, 60, {
    prefix: 'verification_email',
    message: 'Trop de demandes de vérification. Réessayez plus tard.'
});

/**
 * Limitation globale pour l'API
 */
export const apiRateLimit = rateLimitMiddleware(100, 15, {
    prefix: 'api',
    message: 'Trop de requêtes API. Ralentissez vos appels.'
});

/**
 * Limitation stricte pour les actions sensibles
 */
export const strictRateLimit = rateLimitMiddleware(3, 60, {
    prefix: 'strict',
    message: 'Action sensible limitée. Réessayez plus tard.'
});

/**
 * Limitation pour les uploads de fichiers
 */
export const uploadRateLimit = rateLimitMiddleware(10, 60, {
    prefix: 'upload',
    message: 'Trop d\'uploads de fichiers. Ralentissez.'
});

/**
 * Middleware pour réinitialiser le compteur en cas de succès
 */
export const resetRateLimitOnSuccess = (prefix = 'default') => {
    return async (req, res, next) => {
        // Intercepter la réponse
        const originalJson = res.json;
        
        res.json = async function(data) {
            // Si la réponse indique un succès, réinitialiser le compteur
            if (data && data.success === true) {
                try {
                    const identifier = getIdentifier(req);
                    const key = `rate_limit:${prefix}:${identifier}`;
                    await redisService.del(key);
                } catch (error) {
                    console.error('Error resetting rate limit:', error);
                }
            }
            
            return originalJson.call(this, data);
        };
        
        next();
    };
};

/**
 * Middleware pour limitation progressive (augmente la durée à chaque violation)
 */
export const progressiveRateLimit = (baseMaxAttempts = 3, baseWindowMinutes = 15) => {
    return async (req, res, next) => {
        try {
            const identifier = getIdentifier(req);
            const violationKey = `rate_violations:${identifier}`;
            
            // Récupérer le nombre de violations
            const violations = await redisService.get(violationKey) || 0;
            const violationCount = parseInt(violations);
            
            // Calculer les limites ajustées
            const windowMultiplier = Math.pow(2, violationCount); // 1, 2, 4, 8, 16...
            const adjustedWindow = baseWindowMinutes * windowMultiplier;
            const adjustedMaxAttempts = Math.max(1, baseMaxAttempts - violationCount);
            
            // Appliquer la limitation normale
            const rateLimitCheck = rateLimitMiddleware(adjustedMaxAttempts, adjustedWindow, {
                prefix: 'progressive',
                message: `Trop de tentatives répétées. Fenêtre étendue à ${adjustedWindow} minutes.`
            });
            
            // Modifier la réponse pour enregistrer les violations
            const originalJson = res.json;
            res.json = async function(data) {
                if (this.statusCode === 429) {
                    // Enregistrer la violation
                    await redisService.setex(violationKey, 24 * 60 * 60, violationCount + 1); // 24h
                }
                
                return originalJson.call(this, data);
            };
            
            await rateLimitCheck(req, res, next);
            
        } catch (error) {
            console.error('Progressive rate limit error:', error);
            next();
        }
    };
};

/**
 * Middleware pour whitelist d'IPs (bypass du rate limiting)
 */
export const whitelistBypass = (whitelist = []) => {
    return (req, res, next) => {
        const clientIP = getClientIP(req);
        
        // Vérifier si l'IP est dans la whitelist
        if (whitelist.includes(clientIP)) {
            // Ajouter un flag pour bypasser les autres limitations
            req.rateLimitBypassed = true;
            return next();
        }
        
        next();
    };
};

/**
 * Middleware pour limitation basée sur l'utilisateur connecté
 */
export const userBasedRateLimit = (maxAttempts = 10, windowMinutes = 15) => {
    return async (req, res, next) => {
        // Si l'utilisateur est connecté, utiliser son ID, sinon l'IP
        const identifier = req.user ? `user:${req.user.id}` : `ip:${getClientIP(req)}`;
        
        // Les utilisateurs connectés ont généralement une limite plus élevée
        const userMultiplier = req.user ? 2 : 1;
        const adjustedMax = maxAttempts * userMultiplier;
        
        const rateLimit = rateLimitMiddleware(adjustedMax, windowMinutes, {
            prefix: 'user_based'
        });
        
        return rateLimit(req, res, next);
    };
};

/**
 * Middleware pour limitation par endpoint spécifique
 */
export const endpointRateLimit = (limits = {}) => {
    return (req, res, next) => {
        const endpoint = req.route?.path || req.path;
        const method = req.method;
        const key = `${method}:${endpoint}`;
        
        const config = limits[key] || limits.default || { max: 20, window: 15 };
        
        const rateLimit = rateLimitMiddleware(config.max, config.window, {
            prefix: 'endpoint',
            message: config.message
        });
        
        return rateLimit(req, res, next);
    };
};

/**
 * Obtenir l'identifiant unique pour le rate limiting
 */
function getIdentifier(req, options = {}) {
    if (req.rateLimitBypassed) {
        return 'bypassed';
    }
    
    // Si l'utilisateur est connecté et que l'option le permet
    if (options.useUserId !== false && req.user) {
        return `user:${req.user.id}`;
    }
    
    // Utiliser l'IP comme fallback
    return `ip:${getClientIP(req)}`;
}

/**
 * Obtenir l'IP réelle du client
 */
function getClientIP(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           '127.0.0.1';
}

/**
 * Middleware pour logging des violations de rate limit
 */
export const logRateLimitViolations = async (req, res, next) => {
    const originalJson = res.json;
    
    res.json = async function(data) {
        if (this.statusCode === 429) {
            const violation = {
                ip: getClientIP(req),
                userId: req.user?.id || null,
                endpoint: req.path,
                method: req.method,
                userAgent: req.headers['user-agent'],
                timestamp: new Date(),
                headers: {
                    'x-forwarded-for': req.headers['x-forwarded-for'],
                    'x-real-ip': req.headers['x-real-ip']
                }
            };
            
            console.warn('Rate limit violation:', violation);
            
            // Optionnel: sauvegarder en base pour analyse
            // await saveRateLimitViolation(violation);
        }
        
        return originalJson.call(this, data);
    };
    
    next();
};

/**
 * Middleware pour adaptation dynamique du rate limit
 */
export const adaptiveRateLimit = (baseConfig = { max: 10, window: 15 }) => {
    return async (req, res, next) => {
        try {
            // Récupérer les statistiques de charge du serveur
            const serverLoad = await getServerLoad();
            
            // Ajuster les limites selon la charge
            let multiplier = 1;
            if (serverLoad > 0.8) {
                multiplier = 0.5; // Réduire de moitié si charge élevée
            } else if (serverLoad < 0.3) {
                multiplier = 1.5; // Augmenter si charge faible
            }
            
            const adjustedMax = Math.ceil(baseConfig.max * multiplier);
            
            const rateLimit = rateLimitMiddleware(adjustedMax, baseConfig.window, {
                prefix: 'adaptive',
                message: `Limite ajustée selon la charge serveur: ${adjustedMax} requêtes/${baseConfig.window}min`
            });
            
            return rateLimit(req, res, next);
            
        } catch (error) {
            console.error('Adaptive rate limit error:', error);
            // Fallback vers la limite de base
            const rateLimit = rateLimitMiddleware(baseConfig.max, baseConfig.window);
            return rateLimit(req, res, next);
        }
    };
};

/**
 * Obtenir la charge actuelle du serveur (placeholder)
 */
async function getServerLoad() {
    // Implémentation simplifiée - à adapter selon vos besoins
    const used = process.memoryUsage();
    const total = require('os').totalmem();
    return used.heapUsed / total;
}