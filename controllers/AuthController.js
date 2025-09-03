import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { EmailService } from '../services/EmailService.js';
// import { SocialAuthService } from '../services/SocialAuthService.js';
import RedisService from '../services/RedisService.js';
export class AuthController {
    constructor() {
        this.emailService = new EmailService();
        // this.socialAuthService = new SocialAuthService();
this.redisService = RedisService;    }

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
            title: 'Inscription - ADSIAM'
        });
    };

    // Afficher la page mot de passe oublié
    showForgotPassword = (req, res) => {
        res.render('auth/forgot-password', {
            title: 'Mot de passe oublié - ADSIAM'
        });
    };

    // Afficher la page de réinitialisation
    showResetPassword = async (req, res) => {
        const { token } = req.params;
        
        try {
            const user = await User.findOne({
                where: {
                    passwordResetToken: token,
                    passwordResetExpires: {
                        [Op.gt]: new Date()
                    }
                }
            });

            if (!user) {
                return res.render('auth/reset-error', {
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
            res.render('auth/reset-error', {
                title: 'Erreur - ADSIAM',
                message: 'Une erreur est survenue'
            });
        }
    };

    // Traiter la connexion
    login = async (req, res) => {
        try {
            const { email, password, remember = false } = req.body;

            // Vérifier le rate limiting
            const loginAttempts = await this.redisService.get(`login_attempts:${req.ip}`);
            if (loginAttempts && parseInt(loginAttempts) >= 5) {
                return res.status(429).json({
                    success: false,
                    message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.'
                });
            }

            // Trouver l'utilisateur
            const user = await User.findOne({ 
                where: { email: email.toLowerCase() }
            });

            if (!user) {
                await this.incrementLoginAttempts(req.ip);
                return res.status(401).json({
                    success: false,
                    message: 'Email ou mot de passe incorrect'
                });
            }

            // Vérifier le statut du compte
            if (user.status !== 'active') {
                return res.status(401).json({
                    success: false,
                    message: user.status === 'pending_verification' 
                        ? 'Veuillez vérifier votre email avant de vous connecter'
                        : 'Votre compte a été désactivé'
                });
            }

            // Vérifier le mot de passe
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                await this.incrementLoginAttempts(req.ip);
                await user.increment('failedLoginAttempts');
                
                // Verrouiller après 5 tentatives
                if (user.failedLoginAttempts >= 4) {
                    await user.update({
                        lockedUntil: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
                    });
                }

                return res.status(401).json({
                    success: false,
                    message: 'Email ou mot de passe incorrect'
                });
            }

            // Vérifier si le compte est verrouillé
            if (user.lockedUntil && user.lockedUntil > new Date()) {
                return res.status(423).json({
                    success: false,
                    message: 'Compte temporairement verrouillé. Réessayez plus tard.'
                });
            }

            // Connexion réussie
            await this.clearLoginAttempts(req.ip);
            await user.update({
                failedLoginAttempts: 0,
                lockedUntil: null,
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
                user: this.sanitizeUser(user),
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

    // Traiter l'inscription
    register = async (req, res) => {
        try {
            const { firstName, lastName, email, password } = req.body;

            // Vérifier si l'email existe déjà
            const existingUser = await User.findOne({
                where: { email: email.toLowerCase() }
            });

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'Cette adresse email est déjà utilisée'
                });
            }

            // Hacher le mot de passe
            const hashedPassword = await bcrypt.hash(password, 12);

            // Générer le token de vérification
            const verificationToken = crypto.randomBytes(32).toString('hex');

            // Créer l'utilisateur
            const user = await User.create({
                firstName,
                lastName,
                email: email.toLowerCase(),
                password: hashedPassword,
                role: 'student',
                status: 'pending_verification',
                emailVerificationToken: verificationToken,
                createdAt: new Date()
            });

            // Envoyer l'email de vérification
            await this.emailService.sendVerificationEmail(user, verificationToken);

            res.status(201).json({
                success: true,
                message: 'Compte créé avec succès. Vérifiez votre email pour activer votre compte.',
                user: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email
                }
            });

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({
                success: false,
                message: 'Une erreur est survenue lors de la création du compte'
            });
        }
    };

    // Vérification de l'email
    verifyEmail = async (req, res) => {
        try {
            const { token } = req.params;

            const user = await User.findOne({
                where: {
                    emailVerificationToken: token
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
                status: 'active',
                emailVerifiedAt: new Date(),
                emailVerificationToken: null
            });

            // Connexion automatique
            const tokens = this.generateTokens(user);
            this.setAuthCookie(res, tokens.accessToken, false);

            res.render('auth/verification-success', {
                title: 'Email vérifié - ADSIAM',
                user: this.sanitizeUser(user),
                redirectUrl: '/dashboard'
            });

        } catch (error) {
            console.error('Email verification error:', error);
            res.render('auth/verification-error', {
                title: 'Erreur - ADSIAM',
                message: 'Une erreur est survenue lors de la vérification'
            });
        }
    };

    // Mot de passe oublié
    forgotPassword = async (req, res) => {
        try {
            const { email } = req.body;

            const user = await User.findOne({
                where: { email: email.toLowerCase() }
            });

            if (user) {
                // Générer le token de réinitialisation
                const resetToken = crypto.randomBytes(32).toString('hex');
                const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

                await user.update({
                    passwordResetToken: resetToken,
                    passwordResetExpires: resetTokenExpires
                });

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

            const user = await User.findOne({
                where: {
                    passwordResetToken: token,
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

            // Hacher le nouveau mot de passe
            const hashedPassword = await bcrypt.hash(password, 12);

            // Mettre à jour le mot de passe
            await user.update({
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
                refreshToken: null // Invalider tous les refresh tokens
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

    // Connexion sociale
    socialLogin = async (req, res) => {
        try {
            const { provider } = req.params;

            if (!['google', 'microsoft'].includes(provider)) {
                return res.redirect('/login?error=provider_invalid');
            }

            const authUrl = await this.socialAuthService.getAuthUrl(provider, req);
            res.redirect(authUrl);

        } catch (error) {
            console.error('Social login error:', error);
            res.redirect('/login?error=social_error');
        }
    };

    // Callback connexion sociale
    socialCallback = async (req, res) => {
        try {
            const { provider } = req.params;
            const { code } = req.query;

            if (!code) {
                return res.redirect('/login?error=auth_cancelled');
            }

            const socialUser = await this.socialAuthService.handleCallback(provider, code, req);
            
            if (!socialUser) {
                return res.redirect('/login?error=auth_failed');
            }

            // Trouver ou créer l'utilisateur
            let user = await User.findOne({
                where: { email: socialUser.email.toLowerCase() }
            });

            if (!user) {
                // Créer un nouvel utilisateur
                user = await User.create({
                    firstName: socialUser.firstName,
                    lastName: socialUser.lastName,
                    email: socialUser.email.toLowerCase(),
                    avatar: socialUser.avatar,
                    role: 'student',
                    status: 'active',
                    emailVerifiedAt: new Date(),
                    socialProvider: provider,
                    socialId: socialUser.id,
                    createdAt: new Date()
                });
            } else {
                // Mettre à jour les informations sociales
                await user.update({
                    socialProvider: provider,
                    socialId: socialUser.id,
                    avatar: socialUser.avatar || user.avatar,
                    lastLoginAt: new Date(),
                    lastLoginIp: req.ip
                });
            }

            // Connexion
            const tokens = this.generateTokens(user);
            this.setAuthCookie(res, tokens.accessToken, false);

            res.redirect('/dashboard');

        } catch (error) {
            console.error('Social callback error:', error);
            res.redirect('/login?error=callback_error');
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
                res.redirect('/login?message=logout_success');
            }

        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Une erreur est survenue lors de la déconnexion'
            });
        }
    };

    // Vérifier l'authentification
    checkAuth = (req, res) => {
        res.json({
            authenticated: !!req.user,
            user: req.user || null
        });
    };

    // Obtenir le profil
    getProfile = async (req, res) => {
        try {
            const user = await User.findByPk(req.user.id, {
                attributes: { exclude: ['password', 'passwordResetToken', 'refreshToken'] }
            });

            res.json({
                success: true,
                user: this.sanitizeUser(user)
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
            const { firstName, lastName, avatar } = req.body;
            const userId = req.user.id;

            const user = await User.findByPk(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Utilisateur introuvable'
                });
            }

            await user.update({
                firstName: firstName || user.firstName,
                lastName: lastName || user.lastName,
                avatar: avatar || user.avatar
            });

            res.json({
                success: true,
                message: 'Profil mis à jour avec succès',
                user: this.sanitizeUser(user)
            });

        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la mise à jour du profil'
            });
        }
    };

    // Renvoyer l'email de vérification
    resendVerification = async (req, res) => {
        try {
            const { email } = req.body;

            const user = await User.findOne({
                where: { email: email.toLowerCase() }
            });

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
            await user.update({ emailVerificationToken: verificationToken });

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

    // Méthodes utilitaires
    generateTokens = (user) => {
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role
        };

        const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '1d'
        });

        const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
            expiresIn: '30d'
        });

        return { accessToken, refreshToken };
    };

    setAuthCookie = (res, token, remember) => {
        const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge
        });
    };

    sanitizeUser = (user) => {
        const { password, passwordResetToken, refreshToken, emailVerificationToken, ...sanitizedUser } = user.toJSON();
        return sanitizedUser;
    };

    getRedirectUrl = (role) => {
        switch (role) {
            case 'admin':
                return '/admin/dashboard';
            case 'instructor':
                return '/instructor/dashboard';
            default:
                return '/dashboard';
        }
    };

    incrementLoginAttempts = async (ip) => {
        const key = `login_attempts:${ip}`;
        const current = await this.redisService.get(key);
        const attempts = current ? parseInt(current) + 1 : 1;
        
        await this.redisService.setex(key, 900, attempts); // 15 minutes
    };

    clearLoginAttempts = async (ip) => {
        await this.redisService.del(`login_attempts:${ip}`);
    };
};