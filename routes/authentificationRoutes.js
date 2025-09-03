import express from 'express';
import ControleurAuth from '../controllers/ControleurAuth.js';

const router = express.Router();

// =====================================================
// ROUTES D'AFFICHAGE (Pages HTML)
// =====================================================

// Page de connexion
router.get('/connexion', (req, res) => {
    res.render('auth/login', {
        title: 'Connexion - ADSIAM',
        error: req.query.error,
        message: req.query.message
    });
});

// Page d'inscription
router.get('/inscription', (req, res) => {
    res.render('auth/register', {
        title: 'Inscription - ADSIAM',
        error: req.query.error
    });
});

// Page mot de passe oublié
router.get('/mot-de-passe-oublie', (req, res) => {
    res.render('auth/mot-de-passe-oublie', {
        title: 'Mot de passe oublié - ADSIAM',
        error: req.query.error
    });
});

// Page de réinitialisation
router.get('/reinitialiser-mot-de-passe/:token', async (req, res) => {
    const { token } = req.params;
    
    try {
        // Vérifier si le token est valide
        const utilisateur = await Utilisateur.trouverParTokenReinitialisation(token);
        
        if (!utilisateur) {
            return res.render('auth/reinitialisation-erreur', {
                title: 'Erreur - ADSIAM',
                message: 'Token de réinitialisation invalide ou expiré'
            });
        }

        res.render('auth/reinitialiser-mot-de-passe', {
            title: 'Réinitialiser le mot de passe - ADSIAM',
            token
        });

    } catch (erreur) {
        console.error('Erreur affichage réinitialisation:', erreur);
        res.render('auth/reinitialisation-erreur', {
            title: 'Erreur - ADSIAM',
            message: 'Une erreur est survenue'
        });
    }
});

// Page de vérification email
router.get('/verifier-email/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        const utilisateur = await Utilisateur.trouverParTokenVerification(token);
        
        if (!utilisateur) {
            return res.render('auth/verification-erreur', {
                title: 'Erreur de vérification - ADSIAM',
                message: 'Token de vérification invalide'
            });
        }

        // Vérifier l'expiration (24h)
        const ageToken = Date.now() - utilisateur.creeLe.getTime();
        if (ageToken > 24 * 60 * 60 * 1000) {
            return res.render('auth/verification-erreur', {
                title: 'Erreur de vérification - ADSIAM',
                message: 'Token de vérification expiré. Demandez un nouveau lien.'
            });
        }

        // Marquer comme vérifié
        await utilisateur.marquerEmailVerifie();

        // Connexion automatique
        const tokens = ControleurAuth.genererTokens(utilisateur);
        ControleurAuth.definirCookieAuth(res, tokens.accessToken, false);

        res.render('auth/verification-succes', {
            title: 'Email vérifié - ADSIAM',
            utilisateur: {
                id: utilisateur.id,
                prenom: utilisateur.prenom,
                nom: utilisateur.nom,
                email: utilisateur.email
            },
            urlRedirection: '/tableau-de-bord'
        });

    } catch (erreur) {
        console.error('Erreur vérification email:', erreur);
        res.render('auth/verification-erreur', {
            title: 'Erreur - ADSIAM',
            message: 'Une erreur est survenue lors de la vérification'
        });
    }
});

// Page tableau de bord (après connexion)
router.get('/tableau-de-bord', ControleurAuth.middlewareAuth, (req, res) => {
    res.render('dashboard/tableau-bord', {
        title: 'Mon Espace - ADSIAM',
        utilisateur: req.utilisateur,
        layout: 'layouts/dashboard'
    });
});

// =====================================================
// ROUTES API (Traitement des formulaires)
// =====================================================

// Traitement inscription
router.post('/api/inscription', ControleurAuth.inscription);

// Traitement connexion
router.post('/api/connexion', ControleurAuth.connexion);

// Déconnexion
router.post('/api/deconnexion', ControleurAuth.middlewareAuth, ControleurAuth.deconnexion);

// Mot de passe oublié
router.post('/api/mot-de-passe-oublie', ControleurAuth.motDePasseOublie);

// Réinitialiser mot de passe
router.post('/api/reinitialiser-mot-de-passe/:token', ControleurAuth.reinitialiserMotDePasse);

// Renvoyer email de vérification
router.post('/api/renvoyer-verification', async (req, res) => {
    try {
        const { email } = req.body;

        const utilisateur = await Utilisateur.trouverParEmail(email);

        if (!utilisateur) {
            return res.status(404).json({
                succes: false,
                message: 'Utilisateur introuvable'
            });
        }

        if (utilisateur.estEmailVerifie()) {
            return res.status(400).json({
                succes: false,
                message: 'Email déjà vérifié'
            });
        }

        // Générer un nouveau token
        utilisateur.genererTokenVerification();
        await utilisateur.save();

        // TODO: Envoyer email
        console.log(`📧 Email de vérification à renvoyer à : ${email}`);
        console.log(`🔑 Token : ${utilisateur.tokenVerificationEmail}`);

        res.json({
            succes: true,
            message: 'Email de vérification renvoyé'
        });

    } catch (erreur) {
        console.error('Erreur renvoi email:', erreur);
        res.status(500).json({
            succes: false,
            message: 'Erreur lors de l\'envoi'
        });
    }
});

// =====================================================
// ROUTES PROFIL UTILISATEUR (avec authentification)
// =====================================================

// Mon profil API
router.get('/api/mon-profil', ControleurAuth.middlewareAuth, ControleurAuth.monProfil);

// Mettre à jour profil
router.put('/api/mon-profil', ControleurAuth.middlewareAuth, async (req, res) => {
    try {
        const utilisateur = req.utilisateur;
        const { prenom, nom, telephone, ville, etablissement, preferences } = req.body;

        // Validation
        const erreurs = [];
        if (prenom && prenom.trim().length < 2) {
            erreurs.push({ champ: 'prenom', message: 'Prénom trop court' });
        }
        if (nom && nom.trim().length < 2) {
            erreurs.push({ champ: 'nom', message: 'Nom trop court' });
        }

        if (erreurs.length > 0) {
            return res.status(400).json({
                succes: false,
                message: 'Données invalides',
                erreurs
            });
        }

        // Mise à jour
        if (prenom) utilisateur.prenom = prenom.trim();
        if (nom) utilisateur.nom = nom.trim();
        if (telephone !== undefined) utilisateur.telephone = telephone;
        if (ville) utilisateur.ville = ville;
        if (etablissement) utilisateur.etablissement = etablissement;
        if (preferences) {
            utilisateur.preferences = { ...utilisateur.preferences, ...preferences };
        }

        await utilisateur.save();

        res.json({
            succes: true,
            message: 'Profil mis à jour',
            utilisateur: {
                id: utilisateur.id,
                prenom: utilisateur.prenom,
                nom: utilisateur.nom,
                email: utilisateur.email,
                telephone: utilisateur.telephone,
                ville: utilisateur.ville,
                etablissement: utilisateur.etablissement,
                preferences: utilisateur.preferences,
                nomComplet: utilisateur.obtenirNomComplet(),
                initiales: utilisateur.obtenirInitiales()
            }
        });

    } catch (erreur) {
        console.error('Erreur mise à jour profil:', erreur);
        res.status(500).json({
            succes: false,
            message: 'Erreur lors de la mise à jour'
        });
    }
});

// Changer mot de passe
router.put('/api/changer-mot-de-passe', ControleurAuth.middlewareAuth, async (req, res) => {
    try {
        const utilisateur = req.utilisateur;
        const { ancienMotDePasse, nouveauMotDePasse, confirmationMotDePasse } = req.body;

        if (!ancienMotDePasse || !nouveauMotDePasse || !confirmationMotDePasse) {
            return res.status(400).json({
                succes: false,
                message: 'Tous les champs sont obligatoires'
            });
        }

        if (nouveauMotDePasse !== confirmationMotDePasse) {
            return res.status(400).json({
                succes: false,
                message: 'Les nouveaux mots de passe ne correspondent pas'
            });
        }

        // Vérifier l'ancien mot de passe
        const ancienValide = await utilisateur.verifierMotDePasse(ancienMotDePasse);
        if (!ancienValide) {
            return res.status(400).json({
                succes: false,
                message: 'Ancien mot de passe incorrect'
            });
        }

        // Valider le nouveau
        const validation = utilisateur.constructor.validerForceMotDePasse(nouveauMotDePasse);
        if (!validation.estValide) {
            return res.status(400).json({
                succes: false,
                message: 'Nouveau mot de passe trop faible',
                suggestions: validation.feedback
            });
        }

        // Mettre à jour
        utilisateur.motDePasse = nouveauMotDePasse;
        utilisateur.tokenActualisation = null;
        utilisateur.expirationTokenActualisation = null;
        await utilisateur.save();

        res.json({
            succes: true,
            message: 'Mot de passe changé avec succès'
        });

    } catch (erreur) {
        console.error('Erreur changement mot de passe:', erreur);
        res.status(500).json({
            succes: false,
            message: 'Erreur lors du changement'
        });
    }
});

// =====================================================
// ROUTES ADMIN (pour les administrateurs)
// =====================================================

// Liste des utilisateurs (admin)
router.get('/api/admin/utilisateurs', 
    ControleurAuth.middlewareAuth, 
    ControleurAuth.middlewareRole('administrateur'),
    async (req, res) => {
        try {
            const { page = 1, limit = 20, recherche, role, statut } = req.query;
            
            const offset = (page - 1) * limit;
            const whereClause = { supprimeLe: null };

            // Filtres
            if (recherche) {
                whereClause[Op.or] = [
                    { prenom: { [Op.iLike]: `%${recherche}%` } },
                    { nom: { [Op.iLike]: `%${recherche}%` } },
                    { email: { [Op.iLike]: `%${recherche}%` } }
                ];
            }
            if (role) whereClause.role = role;
            if (statut) whereClause.statut = statut;

            const { count, rows } = await Utilisateur.findAndCountAll({
                where: whereClause,
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['creeLe', 'DESC']],
                attributes: {
                    exclude: ['motDePasse', 'tokenVerificationEmail', 'tokenReinitialisation', 'tokenActualisation']
                }
            });

            res.json({
                succes: true,
                utilisateurs: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    pages: Math.ceil(count / limit),
                    limit: parseInt(limit)
                }
            });

        } catch (erreur) {
            console.error('Erreur liste utilisateurs:', erreur);
            res.status(500).json({
                succes: false,
                message: 'Erreur lors de la récupération'
            });
        }
    }
);

// Statistiques utilisateurs (admin)
router.get('/api/admin/statistiques', 
    ControleurAuth.middlewareAuth, 
    ControleurAuth.middlewareRole('administrateur'),
    async (req, res) => {
        try {
            const statistiques = await Utilisateur.obtenirStatistiques();
            
            res.json({
                succes: true,
                statistiques
            });

        } catch (erreur) {
            console.error('Erreur statistiques:', erreur);
            res.status(500).json({
                succes: false,
                message: 'Erreur lors de la récupération des statistiques'
            });
        }
    }
);

// =====================================================
// ROUTES DE REDIRECTION ET STATUT
// =====================================================

// Vérifier l'authentification
router.get('/api/verifier-auth', (req, res) => {
    const token = req.cookies?.accessToken;
    let utilisateur = null;
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'adsiam_secret_key');
            utilisateur = decoded;
        } catch (erreur) {
            // Token invalide
        }
    }
    
    res.json({
        authentifie: !!utilisateur,
        utilisateur
    });
});

// Redirection après connexion selon le rôle
router.get('/redirection-apres-connexion', ControleurAuth.middlewareAuth, (req, res) => {
    const utilisateur = req.utilisateur;
    
    let urlRedirection = '/tableau-de-bord';
    
    switch (utilisateur.role) {
        case 'administrateur':
            urlRedirection = '/admin/tableau-de-bord';
            break;
        case 'formateur':
            urlRedirection = '/formateur/tableau-de-bord';
            break;
        case 'apprenant':
        default:
            urlRedirection = '/tableau-de-bord';
            break;
    }
    
    res.redirect(urlRedirection);
});

export default router;