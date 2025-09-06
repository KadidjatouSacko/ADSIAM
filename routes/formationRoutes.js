import express from 'express';
import { FormationController } from "../controllers/FormationController.js";

const router = express.Router();

// Créer une instance du contrôleur
const formationController = new FormationController();

// Middleware d'authentification (à adapter selon votre système)
const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentification requise' });
    }
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès administrateur requis' });
    }
    next();
};

// ====================== ROUTES PUBLIQUES ======================

// Page d'accueil
router.get('/', async (req, res) => {
    try {
        // Récupérer quelques formations populaires pour l'accueil
        const { Formation, Avis } = await import('../models/index.js');
        
        const formationsPopulaires = await Formation.findAll({
            where: { 
                actif: true, 
                populaire: true 
            },
            include: [
                {
                    model: Avis,
                    as: 'avis',
                    where: { verifie: true },
                    required: false
                }
            ],
            limit: 6,
            order: [['createdAt', 'DESC']]
        });

        res.render('visiteurs/home', { 
            formations: formationsPopulaires,
            title: 'ADSIAM - Formation Excellence Aide à Domicile & EHPAD'
        });
    } catch (error) {
        console.error('Erreur page accueil:', error);
        res.status(500).render('error', { message: 'Erreur serveur' });
    }
});

// Catalogue des formations (accessible à tous)
router.get('/formations', formationController.list.bind(formationController));

// Détail d'une formation (accessible à tous, mais contenu limité si non connecté)
router.get('/formations/:id', formationController.detail.bind(formationController));

// Page de contact
router.get('/contact', (req, res) => {
    res.render('visiteurs/contact', { 
        title: 'Contact & Support | ADSIAM'
    });
});

// Traitement du formulaire de contact
router.post('/contact', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, subject, message } = req.body;
        
        // Ici vous pourriez envoyer un email, sauvegarder en base, etc.
        console.log('Nouveau message de contact:', { firstName, lastName, email, subject });
        
        // Pour l'instant, on simule le succès
        res.json({ 
            success: true, 
            message: 'Votre message a été envoyé avec succès !' 
        });
    } catch (error) {
        console.error('Erreur traitement contact:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de l\'envoi du message' 
        });
    }
});

// API pour recherche (optionnel)
router.get('/api/recherche', async (req, res) => {
    try {
        const { q, domaine, niveau } = req.query;
        const { Formation, Op } = await import('../models/index.js');
        
        const where = { actif: true };
        
        if (q) {
            where[Op.or] = [
                { titre: { [Op.iLike]: `%${q}%` } },
                { description: { [Op.iLike]: `%${q}%` } }
            ];
        }
        
        if (domaine) where.domaine = domaine;
        if (niveau) where.niveau = niveau;
        
        const formations = await Formation.findAll({
            where,
            attributes: ['id', 'titre', 'description', 'prix', 'gratuit', 'icone'],
            limit: 10
        });
        
        res.json({ formations });
    } catch (error) {
        console.error('Erreur recherche:', error);
        res.status(500).json({ error: 'Erreur de recherche' });
    }
});

// ====================== ROUTES UTILISATEURS CONNECTÉS ======================

// Streaming vidéo (réservé aux utilisateurs connectés)
router.get('/videos/:videoId/stream', 
    requireAuth, 
    formationController.streamVideo.bind(formationController)
);

// Récupérer un quiz
router.get('/quiz/:quizId', 
    requireAuth, 
    formationController.getQuiz.bind(formationController)
);

// Soumettre un quiz
router.post('/quiz/:quizId/submit', 
    requireAuth, 
    formationController.submitQuiz.bind(formationController)
);

// Télécharger un document
router.get('/documents/:documentId/download', 
    requireAuth, 
    formationController.downloadDocument.bind(formationController)
);

// Mettre à jour la progression vidéo
router.post('/videos/:videoId/progress', 
    requireAuth, 
    formationController.updateVideoProgress.bind(formationController)
);

// Récupérer la progression d'un module
router.get('/modules/:moduleId/progress', 
    requireAuth, 
    formationController.getProgressionModule.bind(formationController)
);

// S'inscrire à une formation
router.post('/:id/inscription', 
    requireAuth, 
    async (req, res) => {
        try {
            const { id: formationId } = req.params;
            const userId = req.user.id;
            
            // Vérifier si l'utilisateur est déjà inscrit
            const { Inscription, Formation } = await import('../models/index.js');
            
            const inscriptionExistante = await Inscription.findOne({
                where: { user_id: userId, formation_id: formationId }
            });
            
            if (inscriptionExistante) {
                return res.json({ 
                    success: false, 
                    message: 'Vous êtes déjà inscrit à cette formation' 
                });
            }
            
            // Vérifier si la formation existe et est active
            const formation = await Formation.findOne({
                where: { id: formationId, actif: true }
            });
            
            if (!formation) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Formation non trouvée' 
                });
            }
            
            // Créer l'inscription
            await Inscription.create({
                user_id: userId,
                formation_id: formationId,
                statut: 'active',
                date_inscription: new Date(),
                progression_pourcentage: 0
            });
            
            res.json({ 
                success: true, 
                message: 'Inscription réussie à la formation' 
            });
        } catch (error) {
            console.error('Erreur inscription formation:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur lors de l\'inscription' 
            });
        }
    }
);

// ====================== ROUTES ADMINISTRATEUR ======================

// Formulaire de création de formation
router.get('/admin/create', 
    requireAdmin, 
    formationController.createForm.bind(formationController)
);

// Créer une formation avec upload de fichiers
router.post('/admin/create', 
    requireAdmin,
    FormationController.getUploadMiddleware(),
    formationController.create.bind(formationController)
);

// Statistiques d'une formation (admin)
router.get('/:id/stats', 
    requireAdmin, 
    formationController.getFormationStats.bind(formationController)
);

// Nettoyage des fichiers orphelins (admin)
router.post('/admin/cleanup', 
    requireAdmin, 
    formationController.cleanupUnusedFiles.bind(formationController)
);

// ====================== REDIRECTIONS POUR COMPATIBILITÉ ======================

// Redirections pour compatibilité
router.get('/formations/catalogue', (req, res) => res.redirect('/formations'));
router.get('/formation/:id', (req, res) => res.redirect(`/formations/${req.params.id}`));

export default router;