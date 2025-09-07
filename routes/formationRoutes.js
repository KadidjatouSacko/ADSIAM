// routes/visiteurRoutes.js - Version complète
import express from 'express';
import FormationController from "../controllers/FormationController.js";

const router = express.Router();

// ====================== PAGES PRINCIPALES ======================
// Page d'accueil
router.get('/', FormationController.accueil.bind(FormationController));

// Catalogue des formations avec filtres
router.get('/formations', FormationController.catalogue.bind(FormationController));

// Détail d'une formation spécifique
router.get('/formations/:id', FormationController.detail.bind(FormationController));

// Page de contact
router.get('/contact', FormationController.contact.bind(FormationController));
router.post('/contact', FormationController.traitementContact.bind(FormationController));

// ====================== ACTIONS FORMATIONS ======================
// Commencer une formation (redirection vers tableau de bord étudiant)
router.get('/formations/:id/commencer', (req, res) => {
    const { id } = req.params;
    
    // Vérifier si l'utilisateur est connecté
    if (!req.session.user) {
        req.session.returnTo = `/formations/${id}/commencer`;
        return res.redirect('/auth/connexion?message=Connectez-vous pour accéder à cette formation');
    }
    
    // Vérifier si l'utilisateur est inscrit à cette formation
    // TODO: Implémenter la vérification d'inscription
    
    // Rediriger vers le tableau de bord étudiant
    res.redirect(`/dashboard/formations/${id}`);
});

// Acheter une formation (redirection vers paiement)
router.get('/formations/:id/acheter', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Récupérer les détails de la formation
        const formation = await Formation.findByPk(id, {
            attributes: ['id', 'titre', 'prix', 'gratuit']
        });
        
        if (!formation) {
            return res.status(404).render('error', { 
                message: 'Formation non trouvée' 
            });
        }
        
        if (formation.gratuit) {
            return res.redirect(`/formations/${id}/commencer`);
        }
        
        // Rediriger vers la page de paiement
        res.render('visiteurs/paiement', {
            formation,
            title: `Acheter ${formation.titre} - ADSIAM`
        });
        
    } catch (error) {
        console.error('Erreur achat formation:', error);
        res.status(500).render('error', { message: 'Erreur serveur' });
    }
});

// ====================== API RECHERCHE ======================
// API pour recherche en temps réel
router.get('/api/recherche', FormationController.recherche.bind(FormationController));

// API pour filtres avancés
router.get('/api/formations/filtres', async (req, res) => {
    try {
        const { domaine, niveau, prix_max, gratuit_seulement } = req.query;
        
        const where = { actif: true };
        
        if (domaine) where.domaine = domaine;
        if (niveau) where.niveau = niveau;
        if (prix_max) where.prix = { [Op.lte]: parseFloat(prix_max) };
        if (gratuit_seulement === 'true') where.gratuit = true;
        
        const formations = await Formation.findAll({
            where,
            attributes: ['id', 'titre', 'prix', 'gratuit', 'icone', 'niveau', 'domaine'],
            limit: 20
        });
        
        res.json({
            success: true,
            formations,
            total: formations.length
        });
        
    } catch (error) {
        console.error('Erreur API filtres:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors du filtrage' 
        });
    }
});

// ====================== PAGES STATIQUES ======================
// À propos
router.get('/a-propos', (req, res) => {
    res.render('visiteurs/about', {
        title: 'À propos - ADSIAM',
        stats: {
            professionnelsFormes: 2847,
            formationsDisponibles: 36,
            tauxSatisfaction: 97,
            anneesExperience: 8
        }
    });
});

// Mentions légales
router.get('/mentions-legales', (req, res) => {
    res.render('visiteurs/legal', {
        title: 'Mentions légales - ADSIAM'
    });
});

// Politique de confidentialité
router.get('/politique-confidentialite', (req, res) => {
    res.render('visiteurs/privacy', {
        title: 'Politique de confidentialité - ADSIAM'
    });
});

// FAQ
router.get('/faq', (req, res) => {
    const faqData = [
        {
            category: 'Formations',
            questions: [
                {
                    question: 'Comment accéder à mes formations ?',
                    answer: 'Après votre inscription, connectez-vous à votre tableau de bord pour accéder à toutes vos formations.'
                },
                {
                    question: 'Les formations sont-elles certifiantes ?',
                    answer: 'Oui, toutes nos formations délivrent un certificat de réussite reconnu dans le secteur.'
                }
            ]
        },
        {
            category: 'Paiement',
            questions: [
                {
                    question: 'Quels moyens de paiement acceptez-vous ?',
                    answer: 'Nous acceptons les cartes bancaires, PayPal et les virements SEPA.'
                }
            ]
        }
    ];
    
    res.render('visiteurs/faq', {
        title: 'FAQ - Questions fréquentes - ADSIAM',
        faqData
    });
});

// ====================== REDIRECTIONS COMPATIBILITÉ ======================
// Redirections pour compatibilité avec ancienne structure
router.get('/formations/catalogue', (req, res) => res.redirect('/formations'));
router.get('/formation/:id', (req, res) => res.redirect(`/formations/${req.params.id}`));
router.get('/cours/:id', (req, res) => res.redirect(`/formations/${req.params.id}`));

// ====================== GESTION DES ERREURS ======================
// Page 404 pour les routes non trouvées
router.get('*', (req, res) => {
    res.status(404).render('errors/404', {
        title: 'Page non trouvée - ADSIAM',
        message: 'La page que vous cherchez n\'existe pas.',
        suggestions: [
            { text: 'Retour à l\'accueil', url: '/' },
            { text: 'Voir nos formations', url: '/formations' },
            { text: 'Nous contacter', url: '/contact' }
        ]
    });
});

export default router;