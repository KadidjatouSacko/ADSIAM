import crypto from 'crypto';
import { redisService } from './RedisService.js';

export class SocialAuthService {
    constructor() {
        this.providers = {
            google: {
                authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                tokenUrl: 'https://oauth2.googleapis.com/token',
                userUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
                scope: 'openid email profile'
            },
            microsoft: {
                authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
                tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
                userUrl: 'https://graph.microsoft.com/v1.0/me',
                scope: 'openid email profile'
            }
        };
    }

    /**
     * Générer l'URL d'authentification pour un fournisseur
     */
    async getAuthUrl(provider, req) {
        if (!this.providers[provider]) {
            throw new Error(`Provider ${provider} not supported`);
        }

        const config = this.getProviderConfig(provider);
        if (!config.clientId || !config.clientSecret) {
            throw new Error(`${provider} OAuth not configured`);
        }

        // Générer un état unique pour la sécurité CSRF
        const state = crypto.randomBytes(32).toString('hex');
        
        // Stocker l'état en cache avec expiration (5 minutes)
        await redisService.setex(`oauth_state:${state}`, 300, {
            provider,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: Date.now()
        });

        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            response_type: 'code',
            scope: this.providers[provider].scope,
            state: state,
            access_type: 'offline', // Pour Google refresh token
            prompt: 'select_account' // Force la sélection de compte
        });

        return `${this.providers[provider].authUrl}?${params.toString()}`;
    }

    /**
     * Gérer le callback OAuth et récupérer les informations utilisateur
     */
    async handleCallback(provider, code, req) {
        try {
            if (!this.providers[provider]) {
                throw new Error(`Provider ${provider} not supported`);
            }

            const state = req.query.state;
            if (!state) {
                throw new Error('Missing state parameter');
            }

            // Vérifier l'état CSRF
            const storedState = await redisService.get(`oauth_state:${state}`);
            if (!storedState) {
                throw new Error('Invalid or expired state');
            }

            // Supprimer l'état utilisé
            await redisService.del(`oauth_state:${state}`);

            // Vérifier que la requête vient de la même IP (sécurité supplémentaire)
            if (storedState.ip !== req.ip) {
                console.warn(`OAuth state IP mismatch: ${storedState.ip} vs ${req.ip}`);
            }

            // Échanger le code contre un token d'accès
            const tokenData = await this.exchangeCodeForToken(provider, code);
            
            // Récupérer les informations utilisateur
            const userData = await this.getUserInfo(provider, tokenData.access_token);

            return this.normalizeUserData(provider, userData, tokenData);

        } catch (error) {
            console.error(`OAuth callback error for ${provider}:`, error);
            return null;
        }
    }

    /**
     * Échanger le code d'autorisation contre un token d'accès
     */
    async exchangeCodeForToken(provider, code) {
        const config = this.getProviderConfig(provider);
        const tokenUrl = this.providers[provider].tokenUrl;

        const params = {
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: config.redirectUri
        };

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams(params).toString()
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token exchange failed: ${error}`);
        }

        const tokenData = await response.json();
        
        if (!tokenData.access_token) {
            throw new Error('No access token received');
        }

        return tokenData;
    }

    /**
     * Récupérer les informations utilisateur depuis l'API du fournisseur
     */
    async getUserInfo(provider, accessToken) {
        const userUrl = this.providers[provider].userUrl;
        
        const response = await fetch(userUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`User info request failed: ${error}`);
        }

        return await response.json();
    }

    /**
     * Normaliser les données utilisateur selon le fournisseur
     */
    normalizeUserData(provider, userData, tokenData) {
        const normalized = {
            provider: provider,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresIn: tokenData.expires_in,
            tokenType: tokenData.token_type || 'Bearer'
        };

        switch (provider) {
            case 'google':
                normalized.id = userData.id;
                normalized.email = userData.email;
                normalized.firstName = userData.given_name || '';
                normalized.lastName = userData.family_name || '';
                normalized.avatar = userData.picture;
                normalized.verified = userData.verified_email;
                normalized.locale = userData.locale;
                break;

            case 'microsoft':
                normalized.id = userData.id;
                normalized.email = userData.mail || userData.userPrincipalName;
                normalized.firstName = userData.givenName || '';
                normalized.lastName = userData.surname || '';
                normalized.avatar = null; // Microsoft Graph nécessite une requête séparée pour la photo
                normalized.verified = true; // Microsoft vérifie toujours les emails
                normalized.locale = userData.preferredLanguage;
                break;

            default:
                throw new Error(`Normalization not implemented for ${provider}`);
        }

        // Validation des données essentielles
        if (!normalized.email) {
            throw new Error(`No email provided by ${provider}`);
        }

        if (!normalized.firstName && !normalized.lastName) {
            // Essayer d'extraire le nom depuis l'email ou utiliser un nom par défaut
            const emailPart = normalized.email.split('@')[0];
            normalized.firstName = emailPart.charAt(0).toUpperCase() + emailPart.slice(1);
            normalized.lastName = 'User';
        }

        return normalized;
    }

    /**
     * Récupérer la photo de profil Microsoft (requête séparée)
     */
    async getMicrosoftProfilePhoto(accessToken) {
        try {
            const response = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const buffer = await blob.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return `data:${blob.type};base64,${base64}`;
            }
        } catch (error) {
            console.warn('Failed to fetch Microsoft profile photo:', error.message);
        }
        return null;
    }

    /**
     * Rafraîchir un token d'accès expiré
     */
    async refreshAccessToken(provider, refreshToken) {
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        const config = this.getProviderConfig(provider);
        const tokenUrl = this.providers[provider].tokenUrl;

        const params = {
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        };

        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: new URLSearchParams(params).toString()
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Token refresh failed: ${error}`);
            }

            const tokenData = await response.json();
            return {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token || refreshToken, // Certains providers ne renvoient pas un nouveau refresh token
                expires_in: tokenData.expires_in
            };

        } catch (error) {
            console.error(`Failed to refresh ${provider} token:`, error);
            throw error;
        }
    }

    /**
     * Révoquer un token d'accès
     */
    async revokeToken(provider, token) {
        const revokeUrls = {
            google: 'https://oauth2.googleapis.com/revoke',
            microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/logout'
        };

        const revokeUrl = revokeUrls[provider];
        if (!revokeUrl) {
            console.warn(`Token revocation not implemented for ${provider}`);
            return false;
        }

        try {
            const params = provider === 'google' 
                ? { token: token }
                : { post_logout_redirect_uri: process.env.APP_URL };

            const response = await fetch(revokeUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams(params).toString()
            });

            return response.ok;

        } catch (error) {
            console.error(`Failed to revoke ${provider} token:`, error);
            return false;
        }
    }

    /**
     * Obtenir la configuration d'un fournisseur OAuth
     */
    getProviderConfig(provider) {
        const configs = {
            google: {
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/auth/social/google/callback`
            },
            microsoft: {
                clientId: process.env.MICROSOFT_CLIENT_ID,
                clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
                redirectUri: process.env.MICROSOFT_REDIRECT_URI || `${process.env.APP_URL}/auth/social/microsoft/callback`
            }
        };

        return configs[provider];
    }

    /**
     * Vérifier si un fournisseur est configuré
     */
    isProviderConfigured(provider) {
        const config = this.getProviderConfig(provider);
        return !!(config.clientId && config.clientSecret);
    }

    /**
     * Obtenir la liste des fournisseurs configurés
     */
    getAvailableProviders() {
        return Object.keys(this.providers).filter(provider => 
            this.isProviderConfigured(provider)
        );
    }

    /**
     * Générer un lien de déconnexion social
     */
    getLogoutUrl(provider, redirectUrl) {
        const logoutUrls = {
            google: `https://accounts.google.com/logout?continue=${encodeURIComponent(redirectUrl)}`,
            microsoft: `https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(redirectUrl)}`
        };

        return logoutUrls[provider] || redirectUrl;
    }

    /**
     * Valider et nettoyer les données utilisateur reçues
     */
    validateUserData(userData) {
        const required = ['id', 'email', 'firstName', 'lastName'];
        const missing = required.filter(field => !userData[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        // Validation de l'email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userData.email)) {
            throw new Error('Invalid email format from social provider');
        }

        // Nettoyage des données
        return {
            ...userData,
            email: userData.email.toLowerCase().trim(),
            firstName: userData.firstName.trim(),
            lastName: userData.lastName.trim()
        };
    }

    /**
     * Gérer les erreurs OAuth spécifiques
     */
    handleOAuthError(error, provider) {
        const errorMappings = {
            'access_denied': 'L\'utilisateur a refusé l\'autorisation',
            'invalid_request': 'Requête invalide',
            'invalid_client': 'Configuration OAuth incorrecte',
            'invalid_grant': 'Code d\'autorisation invalide ou expiré',
            'unsupported_response_type': 'Type de réponse non supporté'
        };

        const userMessage = errorMappings[error] || 'Erreur d\'authentification sociale';
        
        console.error(`OAuth error for ${provider}:`, error);
        
        return {
            success: false,
            message: userMessage,
            provider: provider,
            error: error
        };
    }

    /**
     * Logger les événements d'authentification sociale
     */
    logSocialAuthEvent(provider, event, userId = null, metadata = {}) {
        const logData = {
            timestamp: new Date().toISOString(),
            provider,
            event, // 'login', 'register', 'link', 'unlink', 'error'
            userId,
            ...metadata
        };

        console.log('Social Auth Event:', logData);
        
        // Optionnel: envoyer à un service de logging externe
        // this.sendToAnalytics(logData);
    }

    /**
     * Nettoyer les tokens expirés du cache
     */
    async cleanupExpiredTokens() {
        try {
            const pattern = 'oauth_state:*';
            const keys = await redisService.keys(pattern);
            
            let cleanedCount = 0;
            for (const key of keys) {
                const ttl = await redisService.ttl(key);
                if (ttl === -1) { // Pas d'expiration définie
                    await redisService.del(key);
                    cleanedCount++;
                }
            }
            
            if (cleanedCount > 0) {
                console.log(`Cleaned up ${cleanedCount} expired OAuth states`);
            }
            
        } catch (error) {
            console.error('Failed to cleanup expired tokens:', error);
        }
    }
}

// Export d'une instance singleton
export const socialAuthService = new SocialAuthService();

// Nettoyage périodique des tokens expirés (toutes les heures)
setInterval(() => {
    socialAuthService.cleanupExpiredTokens();
}, 60 * 60 * 1000);