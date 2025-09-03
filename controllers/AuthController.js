// controllers/AuthController.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { User } from '../models/User.js';
import { EmailService } from '../services/EmailService.js';
import { SocialAuthService } from '../services/SocialAuthService.js';

export class AuthController {
    constructor() {
        this.emailService = new EmailService();
        this.socialAuthService = new SocialAuthService();
    }

    // ==================== PAGES D'AFFICHAGE ====================

    // Afficher la page de connexion
    showLogin = (req, res) => {
        res.render('auth/login', {
            title: 'Connexion - ADSIAM',
            error: req.query.error,
            message: req.query.message
        });
    };

    // Afficher la page d'inscription
    showRegister = (req, res) => {
        res.render('auth/register', {
            title: 'Inscription - ADSIAM',
            error: req.query.error
        });
    };

    // Afficher la page mot de passe oublié
    showForgotPassword = (req, res) => {
        res.render('auth/forgot-password', {
            title: 'Mot de passe oublié - ADSIAM',
            error: req.query.error
        });
    };

    // Afficher la page de réinitialisation
    showResetPassword = async (req, res) => {
        const { token } = req.params;
        
        try {
            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
            
            const user = await User.findOne({
                where: {
                    passwordResetToken: hashedToken,
                    passwordResetExpires: {
                        [Op.gt]: new Date()
                    }
                }
            });

            if (!user) {
                return res.render('auth/reset-password-error', {
                    title: 'Erreur - ADSIAM',
                    message: 'Token de réinitialisation invalide ou expiré'
                });
            }

            res.render('auth/reset-password', {
                title: 'Réinitialiser le mot de passe - ADSIAM',
                token
            });

        } catch (error) {
            console.error('Show reset password error:', error);
            res.render('auth/reset-password-error', {
                title: 'Erreur - ADSIAM',
                message: 'Une erreur est survenue'
            });
        }
    };

    // ==================== TRAITEMENT DES FORMULAIRES ====================

    // Traiter l'inscription
    register = async (req, res) => {
        try {
            const { prenom, nom, email, telephone, mot_de_passe } = req.body;

            // Validation des données
            const errors = this.validateRegistrationData({ prenom, nom, email, mot_de_passe });
            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Données invalides',
                    errors
                });
            }

            // Vérifier si l'email existe déjà
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'Cette adresse email est déjà utilisée'
                });
            }

            // Générer le token de vérification
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const hashedVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

            // Créer l'utilisateur
            const user = await User.create({
                prenom: prenom.trim(),
                nom: nom.trim(),
                email: email.toLowerCase().trim(),
                telephone: telephone?.trim() || null,
                mot_de_passe,
                role: 'student',
                type_utilisateur: 'etudiant',
                statut: 'pending_verification',
                emailVerificationToken: hashedVerificationToken,
                date_inscription: new Date()
            });

            // Envoyer l'email de vérification
            await this.emailService.sendVerificationEmail(user, verificationToken);

            res.status(201).json({
                success: true,
                message: 'Compte créé avec succès. Vérifiez votre email pour activer votre compte.',
                user: user.toSafeJSON()
            });

        } catch (error) {
            console.error('Registration error:', error);
            
            if (error.name === 'SequelizeValidationError') {
                const errors = error.errors.map(err => err.message);
                return res.status(400).json({
                    success: false,
                    message: 'Données invalides',
                    errors
                });
            }

            res.status(500).json({
                success: false,
                message: 'Une erreur est survenue lors de la création du compte'
            });
        }
    };

    // Traiter la connexion
    login = async (req, res) => {
        try {
            const { email, mot_de_passe, remember = false } = req.body;

            // Validation basique
            if (!email || !mot_de_passe) {
                return res.status(400).json({
                    success: false,
                    message: 'Email et mot de passe requis'
                });
            }

            // Trouver l'utilisateur
            const user = await User.findByEmail(email);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Email ou mot de passe incorrect'
                });
            }

            // Vérifier si le compte est verrouillé
            if (user.isAccountLocked()) {
                return res.status(423).json({
                    success: false,
                    message: 'Compte temporairement verrouillé. Réessayez plus tard.'
                });
            }

            // Vérifier le statut du compte
            if (user.statut !== 'active') {
                return res.status(401).json({
                    success: false,
                    message: user.statut === 'pending_verification' 
                        ? 'Veuillez vérifier votre email avant de vous connecter'
                        : 'Votre compte a été désactivé'
                });
            }

            // Vérifier le mot de passe
            const isValidPassword = await user.checkPassword(mot_de_passe);
            if (!isValidPassword) {
                await user.incrementFailedLogins();
                return res.status(401).json({
                    success: false,
                    message: 'Email ou mot de passe incorrect'
                });
            }

            // Connexion réussie
            await user.resetFailedLogins();
            await user.update({
                derniere_connexion: new Date(),
                lastLoginAt: new Date(),
                lastLoginIp: req.ip
            });

            // Générer les tokens
            const tokens = this.generateTokens(user);
            
            // Définir le cookie de session
            this.setAuthCookie(res, tokens.accessToken, remember);

            // Si remember me, stocker le refresh token
            if (remember) {
                await user.update({
                    refreshToken: tokens.refreshToken,
                    refreshTokenExpires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
                });
            }

            res.json({
                success: true,
                message: 'Connexion réussie',
                user: user.toSafeJSON(),
                redirect: this.getRedirectUrl(user.role)
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Une erreur est survenue lors de la connexion'
            });
        }
    };

    // Déconnexion
    logout = async (req, res) => {
        try {
            // Invalider le refresh token en base
            if (req.user) {
                await User.update(
                    { 
                        refreshToken: null,
                        refreshTokenExpires: null 
                    },
                    { where: { id: req.user.id } }
                );
            }

            // Supprimer le cookie
            res.clearCookie('auth_token');

            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                res.json({
                    success: true,
                    message: 'Déconnexion réussie'
                });
            } else {
                res.redirect('/auth/connexion?message=logout_success');
            }

        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Une erreur est survenue lors de la déconnexion'
            });
        }
    };

    // ==================== GESTION DES EMAILS ====================

    // Vérification de l'email
    verifyEmail = async (req, res) => {
        try {
            const { token } = req.params;
            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

            const user = await User.findOne({
                where: {
                    emailVerificationToken: hashedToken
                }
            });

            if (!user) {
                return res.render('auth/verification-error', {
                    title: 'Erreur de vérification - ADSIAM',
                    message: 'Token de vérification invalide'
                });
            }

            // Vérifier l'expiration (24h)
            const tokenAge = Date.now() - user.createdAt.getTime();
            if (tokenAge > 24 * 60 * 60 * 1000) {
                return res.render('auth/verification-error', {
                    title: 'Erreur de vérification - ADSIAM',
                    message: 'Token de vérification expiré. Demandez un nouveau lien.'
                });
            }

            // Activer le compte
            await user.update({
                statut: 'active',
                emailVerifiedAt: new Date(),
                emailVerificationToken: null
            });

            // Connexion automatique
            const tokens = this.generateTokens(user);
            this.setAuthCookie(res, tokens.accessToken, false);

            res.render('auth/verification-success', {
                title: 'Email vérifié - ADSIAM',
                user: user.toSafeJSON(),
                redirectUrl: '/tableau-de-bord'
            });

        } catch (error) {
            console.error('Email verification error:', error);
            res.render('auth/verification-error', {
                title: 'Erreur - ADSIAM',
                message: 'Une erreur est survenue lors de la vérification'
            });
        }
    };

    // Renvoyer l'email de vérification
    resendVerification = async (req, res) => {
        try {
            const { email } = req.body;

            const user = await User.findByEmail(email);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Utilisateur introuvable'
                });
            }

            if (user.emailVerifiedAt) {
                return res.status(400).json({
                    success: false,
                    message: 'Email déjà vérifié'
                });
            }

            // Générer un nouveau token
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const hashedVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
            
            await user.update({ 
                emailVerificationToken: hashedVerificationToken 
            });

            // Renvoyer l'email
            await this.emailService.sendVerificationEmail(user, verificationToken);

            res.json({
                success: true,
                message: 'Email de vérification renvoyé'
            });

        } catch (error) {
            console.error('Resend verification error:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi'
            });
        }
    };

    // ==================== MOT DE PASSE OUBLIÉ ====================

    // Mot de passe oublié
    forgotPassword = async (req, res) => {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'Email requis'
                });
            }

            const user = await User.findByEmail(email);

            if (user) {
                // Générer le token de réinitialisation
                const resetToken = user.generatePasswordResetToken();
                await user.save();

                // Envoyer l'email
                await this.emailService.sendPasswordResetEmail(user, resetToken);
            }

            // Toujours retourner success pour la sécurité
            res.json({
                success: true,
                message: 'Si cette adresse email existe, vous recevrez un lien de réinitialisation'
            });

        } catch (error) {
            console.error('Forgot password error:', error);
            res.status(500).json({
                success: false,
                message: 'Une erreur est survenue lors de l\'envoi du lien'
            });
        }
    };

    // Réinitialisation du mot de passe
    resetPassword = async (req, res) => {
        try {
            const { token, password } = req.body;

            if (!token || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Token et nouveau mot de passe requis'
                });
            }

            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

            const user = await User.findOne({
                where: {
                    passwordResetToken: hashedToken,
                    passwordResetExpires: {
                        [Op.gt]: new Date()
                    }
                }
            });

            if (!user) {
                return res.status(400).json({
                    success: false,
                    message: 'Token de réinitialisation invalide ou expiré'
                });
            }

            // Validation du mot de passe
            if (!this.isStrongPassword(password)) {
                return res.status(400).json({
                    success: false,
                    message: 'Le mot de passe n\'est pas assez fort'
                });
            }

            // Mettre à jour le mot de passe
            await user.update({
                mot_de_passe: password, // Le hook beforeUpdate va hasher automatiquement
                passwordResetToken: null,
                passwordResetExpires: null,
                refreshToken: null, // Invalider tous les refresh tokens
                failedLoginAttempts: 0,
                lockedUntil: null
            });

            res.json({
                success: true,
                message: 'Mot de passe réinitialisé avec succès'
            });

        } catch (error) {
            console.error('Reset password error:', error);
            res.status(500).json({
                success: false,
                message: 'Une erreur est survenue lors de la réinitialisation'
            });
        }
    };

    // ==================== AUTHENTIFICATION SOCIALE ====================

    // Connexion sociale
    socialLogin = async (req, res) => {
        try {
            const { provider } = req.params;

            if (!['google', 'microsoft'].includes(provider)) {
                return res.redirect('/auth/connexion?error=provider_invalid');
            }

            const authUrl = await this.socialAuthService.getAuthUrl(provider, req);
            res.redirect(authUrl);

        } catch (error) {
            console.error('Social login error:', error);
            res.redirect('/auth/connexion?error=social_error');
        }
    };

    // Callback connexion sociale
    socialCallback = async (req, res) => {
        try {
            const { provider } = req.params;
            const { code } = req.query;

            if (!code) {
                return res.redirect('/auth/connexion?error=auth_cancelled');
            }

            const socialUser = await this.socialAuthService.handleCallback(provider, code, req);
            
            if (!socialUser) {
                return res.redirect('/auth/connexion?error=auth_failed');
            }

            // Trouver ou créer l'utilisateur
            let user = await User.findByEmail(socialUser.email);

            if (!user) {
                // Créer un nouvel utilisateur
                user = await User.create({
                    prenom: socialUser.firstName,
                    nom: socialUser.lastName,
                    email: socialUser.email.toLowerCase(),
                    photo_profil: socialUser.avatar,
                    role: 'student',
                    type_utilisateur: 'etudiant',
                    statut: 'active',
                    emailVerifiedAt: new Date(),
                    socialProvider: provider,
                    socialId: socialUser.id,
                    date_inscription: new Date()
                });
            } else {
                // Mettre à jour les informations sociales
                await user.update({
                    socialProvider: provider,
                    socialId: socialUser.id,
                    photo_profil: socialUser.avatar || user.photo_profil,
                    derniere_connexion: new Date(),
                    lastLoginAt: new Date(),
                    lastLoginIp: req.ip
                });
            }

            // Connexion
            const tokens = this.generateTokens(user);
            this.setAuthCookie(res, tokens.accessToken, false);

            res.redirect('/tableau-de-bord');

        } catch (error) {
            console.error('Social callback error:', error);
            res.redirect('/auth/connexion?error=callback_error');
        }
    };

    // ==================== PROFIL UTILISATEUR ====================

    // Vérifier l'authentification
    checkAuth = (req, res) => {
        res.json({
            authenticated: !!req.user,
            user: req.user ? req.user.toSafeJSON() : null
        });
    };

    // Obtenir le profil
    getProfile = async (req, res) => {
        try {
            const user = await User.findByPk(req.user.id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Utilisateur introuvable'
                });
            }

            res.json({
                success: true,
                user: user.toSafeJSON()
            });

        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération du profil'
            });
        }
    };

    // Mettre à jour le profil
    updateProfile = async (req, res) => {
        try {
            const { prenom, nom, telephone, photo_profil, date_naissance } = req.body;
            const userId = req.user.id;

            const user = await User.findByPk(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Utilisateur introuvable'
                });
            }

            // Validation des données
            const errors = [];
            if (prenom && prenom.trim().length < 2) {
                errors.push('Le prénom doit contenir au moins 2 caractères');
            }
            if (nom && nom.trim().length < 2) {
                errors.push('Le nom doit contenir au moins 2 caractères');
            }
            if (telephone && !this.isValidPhone(telephone)) {
                errors.push('Format de téléphone invalide');
            }

            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Données invalides',
                    errors
                });
            }

            await user.update({
                prenom: prenom?.trim() || user.prenom,
                nom: nom?.trim() || user.nom,
                telephone: telephone?.trim() || user.telephone,
                photo_profil: photo_profil || user.photo_profil,
                date_naissance: date_naissance || user.date_naissance
            });

            res.json({
                success: true,
                message: 'Profil mis à jour avec succès',
                user: user.toSafeJSON()
            });

        } catch (error) {
            console.error('Update profile error:', error);
            
            if (error.name === 'SequelizeValidationError') {
                const errors = error.errors.map(err => err.message);
                return res.status(400).json({
                    success: false,
                    message: 'Données invalides',
                    errors
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur lors de la mise à jour du profil'
            });
        }
    };

    // Changer le mot de passe
    changePassword = async (req, res) => {
        try {
            const { ancien_mot_de_passe, nouveau_mot_de_passe, confirmer_mot_de_passe } = req.body;
            const userId = req.user.id;

            const user = await User.findByPk(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Utilisateur introuvable'
                });
            }

            // Vérifier l'ancien mot de passe
            const isValidOldPassword = await user.checkPassword(ancien_mot_de_passe);
            if (!isValidOldPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Ancien mot de passe incorrect'
                });
            }

            // Valider le nouveau mot de passe
            if (!this.isStrongPassword(nouveau_mot_de_passe)) {
                return res.status(400).json({
                    success: false,
                    message: 'Le nouveau mot de passe n\'est pas assez fort'
                });
            }

            // Vérifier la confirmation
            if (nouveau_mot_de_passe !== confirmer_mot_de_passe) {
                return res.status(400).json({
                    success: false,
                    message: 'Les mots de passe ne correspondent pas'
                });
            }

            // Mettre à jour le mot de passe
            await user.update({
                mot_de_passe: nouveau_mot_de_passe,
                refreshToken: null, // Invalider les refresh tokens
                refreshTokenExpires: null
            });

            res.json({
                success: true,
                message: 'Mot de passe changé avec succès'
            });

        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du changement de mot de passe'
            });
        }
    };

    // ==================== MÉTHODES UTILITAIRES ====================

    // Générer les tokens JWT
    generateTokens = (user) => {
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role,
            prenom: user.prenom,
            nom: user.nom,
            type_utilisateur: user.type_utilisateur
        };

        const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '1d'
        });

        const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
            expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
        });

        return { accessToken, refreshToken };
    };

    // Définir le cookie d'authentification
    setAuthCookie = (res, token, remember) => {
        const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 30 jours ou 1 jour
        
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge,
            path: '/'
        });
    };

    // Obtenir l'URL de redirection selon le rôle
    getRedirectUrl = (role) => {
        switch (role) {
            case 'admin':
            case 'administrateur':
                return '/admin/tableau-de-bord';
            case 'instructor':
            case 'formateur':
                return '/formateur/tableau-de-bord';
            case 'student':
            case 'etudiant':
            default:
                return '/tableau-de-bord';
        }
    };

    // ==================== VALIDATIONS ====================

    // Validation des données d'inscription
    validateRegistrationData = (data) => {
        const errors = [];
        
        if (!data.prenom || data.prenom.trim().length < 2) {
            errors.push('Le prénom doit contenir au moins 2 caractères');
        }
        
        if (!data.nom || data.nom.trim().length < 2) {
            errors.push('Le nom doit contenir au moins 2 caractères');
        }
        
        if (!data.email || !this.isValidEmail(data.email)) {
            errors.push('Email invalide');
        }
        
        if (!data.mot_de_passe || !this.isStrongPassword(data.mot_de_passe)) {
            errors.push('Le mot de passe doit contenir au moins 8 caractères avec majuscules, minuscules et chiffres');
        }
        
        return errors;
    };

    // Validation d'email
    isValidEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Validation de mot de passe fort
    isStrongPassword = (password) => {
        // Au moins 8 caractères, une majuscule, une minuscule, un chiffre
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
        return passwordRegex.test(password);
    };

    // Validation de numéro de téléphone
    isValidPhone = (phone) => {
        const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,20}$/;
        return phoneRegex.test(phone);
    };

    // ==================== GESTION DES REFRESH TOKENS ====================

    // Rafraîchir le token d'accès
    refreshToken = async (req, res) => {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(401).json({
                    success: false,
                    message: 'Refresh token requis'
                });
            }

            // Vérifier le refresh token
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            
            const user = await User.findOne({
                where: {
                    id: decoded.id,
                    refreshToken: refreshToken,
                    refreshTokenExpires: {
                        [Op.gt]: new Date()
                    }
                }
            });

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Refresh token invalide'
                });
            }

            // Générer de nouveaux tokens
            const tokens = this.generateTokens(user);

            // Mettre à jour le refresh token en base
            await user.update({
                refreshToken: tokens.refreshToken,
                refreshTokenExpires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });

            res.json({
                success: true,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken
            });

        } catch (error) {
            console.error('Refresh token error:', error);
            res.status(401).json({
                success: false,
                message: 'Refresh token invalide ou expiré'
            });
        }
    };

    // ==================== GESTION DES SESSIONS ====================

    // Obtenir toutes les sessions actives
    getActiveSessions = async (req, res) => {
        try {
            const userId = req.user.id;
            
            // Ici vous pourriez implémenter une table de sessions
            // Pour l'instant, on retourne les informations basiques
            const user = await User.findByPk(userId, {
                attributes: ['id', 'derniere_connexion', 'lastLoginIp']
            });

            res.json({
                success: true,
                sessions: [{
                    id: 'current',
                    ip: user.lastLoginIp,
                    derniere_activite: user.derniere_connexion,
                    current: true
                }]
            });

        } catch (error) {
            console.error('Get active sessions error:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des sessions'
            });
        }
    };

    // Révoquer toutes les sessions (sauf la courante)
    revokeAllSessions = async (req, res) => {
        try {
            const userId = req.user.id;

            await User.update(
                { 
                    refreshToken: null,
                    refreshTokenExpires: null 
                },
                { where: { id: userId } }
            );

            res.json({
                success: true,
                message: 'Toutes les sessions ont été révoquées'
            });

        } catch (error) {
            console.error('Revoke sessions error:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la révocation des sessions'
            });
        }
    };
};