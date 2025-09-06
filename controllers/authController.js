import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User } from '../models/index.js';
import { Op } from 'sequelize';

// Configuration JWT
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt_super_securise_adsiam_2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * 🔐 Génération du token JWT
 */
const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * 📝 Page d'inscription
 */
export const renderRegister = (req, res) => {
    res.render('auth/register', {
        title: 'Inscription - ADSIAM',
        layout: 'layouts/auth',
        error: null,
        formData: {}
    });
};

/**
 * 🔑 Page de connexion
 */
export const renderLogin = (req, res) => {
    res.render('auth/login', {
        title: 'Connexion - ADSIAM',
        layout: 'layouts/auth',
        error: null
    });
};

/**
 * 👤 Page de profil
 */
export const renderProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.userId, {
            attributes: { exclude: ['mot_de_passe'] }
        });

        if (!user) {
            return res.redirect('/auth/login');
        }

        res.render('auth/profile', {
            title: 'Mon Profil - ADSIAM',
            layout: 'layouts/main',
            user: user.toJSON(),
            success: req.flash('success'),
            error: req.flash('error')
        });

    } catch (error) {
        console.error('Erreur page profil:', error);
        req.flash('error', 'Erreur lors du chargement du profil');
        res.redirect('/dashboard');
    }
};

/**
 * 📧 Traitement de l'inscription
 */
export const processRegister = async (req, res) => {
    try {
        const { prenom, nom, email, mot_de_passe, confirm_password, telephone, societe_rattachee } = req.body;

        // Validation des données
        const errors = {};

        if (!prenom || prenom.trim().length < 2) {
            errors.prenom = 'Le prénom doit contenir au moins 2 caractères';
        }

        if (!nom || nom.trim().length < 2) {
            errors.nom = 'Le nom doit contenir au moins 2 caractères';
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.email = 'Adresse email invalide';
        }

        if (!mot_de_passe || mot_de_passe.length < 8) {
            errors.mot_de_passe = 'Le mot de passe doit contenir au moins 8 caractères';
        }

        if (mot_de_passe !== confirm_password) {
            errors.confirm_password = 'Les mots de passe ne correspondent pas';
        }

        // Si erreurs de validation
        if (Object.keys(errors).length > 0) {
            return res.render('auth/register', {
                title: 'Inscription - ADSIAM',
                layout: 'layouts/auth',
                errors,
                formData: req.body
            });
        }

        // Vérifier si l'utilisateur existe déjà
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.render('auth/register', {
                title: 'Inscription - ADSIAM',
                layout: 'layouts/auth',
                error: 'Un compte existe déjà avec cette adresse email',
                formData: req.body
            });
        }

        // Créer l'utilisateur
        const newUser = await User.create({
            prenom: prenom.trim(),
            nom: nom.trim(),
            email: email.toLowerCase().trim(),
            mot_de_passe,
            telephone: telephone?.trim() || null,
            societe_rattachee: societe_rattachee?.trim() || null,
            role: 'etudiant',
            statut: 'en_attente'
        });

        // Générer le token
        const token = generateToken(newUser.id);

        // Stocker les infos dans la session
        req.session.userId = newUser.id;
        req.session.userToken = token;

        req.flash('success', 'Inscription réussie ! Votre compte est en attente de validation.');
        if (newUser.role === 'admin') {
    res.redirect('/admin');
} else {
    res.redirect('/dashboard');
}

    } catch (error) {
        console.error('Erreur inscription:', error);
        
        // Gestion des erreurs Sequelize
        if (error.name === 'SequelizeValidationError') {
            const errors = {};
            error.errors.forEach(err => {
                errors[err.path] = err.message;
            });
            
            return res.render('auth/register', {
                title: 'Inscription - ADSIAM',
                layout: 'layouts/auth',
                errors,
                formData: req.body
            });
        }

        res.render('auth/register', {
            title: 'Inscription - ADSIAM',
            layout: 'layouts/auth',
            error: 'Erreur lors de l\'inscription. Veuillez réessayer.',
            formData: req.body
        });
    }
};

/**
 * 🔑 Traitement de la connexion
 */
export const processLogin = async (req, res) => {
    try {
        const { email, mot_de_passe, remember } = req.body;

        // Validation des données
        if (!email || !mot_de_passe) {
            return res.render('auth/login', {
                title: 'Connexion - ADSIAM',
                layout: 'layouts/auth',
                error: 'Email et mot de passe sont obligatoires',
                email
            });
        }

        // Rechercher l'utilisateur
        const user = await User.findByEmail(email);
        if (!user) {
            return res.render('auth/login', {
                title: 'Connexion - ADSIAM',
                layout: 'layouts/auth',
                error: 'Email ou mot de passe incorrect',
                email
            });
        }

        // Vérifier le mot de passe
        const isPasswordValid = await user.checkPassword(mot_de_passe);
        if (!isPasswordValid) {
            return res.render('auth/login', {
                title: 'Connexion - ADSIAM',
                layout: 'layouts/auth',
                error: 'Email ou mot de passe incorrect',
                email
            });
        }

        // Vérifier le statut du compte
        if (user.statut === 'suspendu') {
            return res.render('auth/login', {
                title: 'Connexion - ADSIAM',
                layout: 'layouts/auth',
                error: 'Votre compte a été suspendu. Contactez l\'administrateur.',
                email
            });
        }

        if (user.statut === 'inactif') {
            return res.render('auth/login', {
                title: 'Connexion - ADSIAM',
                layout: 'layouts/auth',
                error: 'Votre compte est inactif. Veuillez le réactiver.',
                email
            });
        }

        // Mettre à jour la dernière connexion
        await user.update({ derniere_connexion: new Date() });

        // Générer le token
        const token = generateToken(user.id);

        // --- Configuration session ---
        req.session.userId = user.id;
        req.session.userToken = token;

        // Stockage complet de l'utilisateur dans la session
        req.session.user = {
            id: user.id,
            prenom: user.prenom,
            nom: user.nom,
            email: user.email,
            role: user.role,                  // 'societe', 'employe', 'admin', etc.
            statut: user.statut,              // 'actif', 'inactif', 'suspendu'
            societe_rattachee: user.societe_rattachee || null // utile pour les middleware société
        };

        // Cookie persistant "Se souvenir de moi"
        if (remember) {
            res.cookie('rememberToken', token, {
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production'
            });
        }

        req.flash('success', `Bienvenue ${user.getNomComplet()} !`);

        // Redirection selon le rôle
        if (user.role === 'admin') {
            return res.redirect('/admin');
        } else if (user.role === 'societe') {
            return res.redirect('/entreprise/dashboard');
        } else {
            return res.redirect('/dashboard');
        }

    } catch (error) {
        console.error('Erreur connexion:', error);
        res.render('auth/login', {
            title: 'Connexion - ADSIAM',
            layout: 'layouts/auth',
            error: 'Erreur lors de la connexion. Veuillez réessayer.',
            email: req.body.email
        });
    }
};


/**
 * ✏️ Mise à jour du profil
 */
export const updateProfile = async (req, res) => {
    try {
        const { prenom, nom, telephone, societe_rattachee } = req.body;

        const user = await User.findByPk(req.user.userId);
        if (!user) {
            req.flash('error', 'Utilisateur non trouvé');
            return res.redirect('/auth/login');
        }

        // Validation
        const errors = {};

        if (!prenom || prenom.trim().length < 2) {
            errors.prenom = 'Le prénom doit contenir au moins 2 caractères';
        }

        if (!nom || nom.trim().length < 2) {
            errors.nom = 'Le nom doit contenir au moins 2 caractères';
        }

        if (Object.keys(errors).length > 0) {
            return res.render('auth/profile', {
                title: 'Mon Profil - ADSIAM',
                layout: 'layouts/main',
                user: user.toJSON(),
                errors,
                success: null,
                error: null
            });
        }

        // Mise à jour
        await user.update({
            prenom: prenom.trim(),
            nom: nom.trim(),
            telephone: telephone?.trim() || user.telephone,
            societe_rattachee: societe_rattachee?.trim() || user.societe_rattachee
        });

        req.flash('success', 'Profil mis à jour avec succès !');
        res.redirect('/auth/profile');

    } catch (error) {
        console.error('Erreur mise à jour profil:', error);
        req.flash('error', 'Erreur lors de la mise à jour du profil');
        res.redirect('/auth/profile');
    }
};

/**
 * 🔒 Changement de mot de passe
 */
export const changePassword = async (req, res) => {
    try {
        const { ancien_mot_de_passe, nouveau_mot_de_passe, confirm_nouveau_mot_de_passe } = req.body;

        const user = await User.findByPk(req.user.userId);
        if (!user) {
            req.flash('error', 'Utilisateur non trouvé');
            return res.redirect('/auth/login');
        }

        // Validation
        const errors = {};

        if (!ancien_mot_de_passe) {
            errors.ancien_mot_de_passe = 'Ancien mot de passe requis';
        }

        if (!nouveau_mot_de_passe || nouveau_mot_de_passe.length < 8) {
            errors.nouveau_mot_de_passe = 'Le nouveau mot de passe doit contenir au moins 8 caractères';
        }

        if (nouveau_mot_de_passe !== confirm_nouveau_mot_de_passe) {
            errors.confirm_nouveau_mot_de_passe = 'La confirmation ne correspond pas';
        }

        // Vérifier l'ancien mot de passe
        if (ancien_mot_de_passe) {
            const isOldPasswordValid = await user.checkPassword(ancien_mot_de_passe);
            if (!isOldPasswordValid) {
                errors.ancien_mot_de_passe = 'Ancien mot de passe incorrect';
            }
        }

        if (Object.keys(errors).length > 0) {
            return res.render('auth/profile', {
                title: 'Mon Profil - ADSIAM',
                layout: 'layouts/main',
                user: user.toJSON(),
                passwordErrors: errors,
                success: null,
                error: null
            });
        }

        // Mettre à jour le mot de passe
        await user.update({ mot_de_passe: nouveau_mot_de_passe });

        req.flash('success', 'Mot de passe modifié avec succès !');
        res.redirect('/auth/profile');

    } catch (error) {
        console.error('Erreur changement mot de passe:', error);
        req.flash('error', 'Erreur lors du changement de mot de passe');
        res.redirect('/auth/profile');
    }
};

/**
 * 🚪 Déconnexion
 */
export const logout = (req, res) => {
    // Détruire la session
    req.session.destroy((err) => {
        if (err) {
            console.error('Erreur destruction session:', err);
            req.flash('error', 'Erreur lors de la déconnexion');
            return res.redirect('/dashboard');
        }

        // Supprimer les cookies
        res.clearCookie('connect.sid');
        res.clearCookie('rememberToken');

        res.redirect('/auth/login');
    });
};

/**
 * ✅ API - Vérification du statut de connexion
 */
export const checkAuthStatus = async (req, res) => {
    try {
        if (!req.user) {
            return res.json({
                success: false,
                authenticated: false
            });
        }

        const user = await User.findByPk(req.user.userId, {
            attributes: { exclude: ['mot_de_passe'] }
        });

        if (!user) {
            return res.json({
                success: false,
                authenticated: false
            });
        }

        res.json({
            success: true,
            authenticated: true,
            user: {
                id: user.id,
                prenom: user.prenom,
                nom: user.nom,
                email: user.email,
                role: user.role,
                statut: user.statut,
                nomComplet: user.getNomComplet()
            }
        });

    } catch (error) {
        console.error('Erreur vérification auth:', error);
        res.json({
            success: false,
            authenticated: false,
            error: 'Erreur lors de la vérification'
        });
    }
};