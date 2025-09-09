import { Router } from 'express';
import { sequelize } from '../models/index.js'; // AJOUTEZ CETTE LIGNE
import { QueryTypes } from 'sequelize'; // AJOUTEZ CETTE LIGNE
import {
    showProfil,
    updateProfil,
    deleteProfil,
    createProfil,
    showDashboard,
    showFormations,
    showMessagerie,
    showFormationInteractive,
    redirectToFirstModule,
    saveVideoProgress,
    submitQuiz,
    saveTimeSpent,
    downloadDocument
} from '../controllers/EtudiantsController.js';
import { isStudent, ensureAuth } from '../middleware/auth.js';
const router = Router();

// Middleware test si pas d'auth
const isAuthenticated = (req, res, next) => {
  req.session = req.session || {};
  req.session.userId = 1; // user test
  next();
};

// Routes CRUD profil
router.get('/etudiants/profil', isStudent, showProfil);
router.post('/etudiants/profil/modifier', isStudent, updateProfil);
router.post('/etudiants/profil/supprimer', isStudent, deleteProfil);

// Route pour afficher le formulaire de création
router.get('/etudiant/profil/nouveau', isStudent, (req, res) => {
  res.render('etudiants/nouveauProfil', { user: null, successMessage: null });
});

// Route pour traiter la création
router.post('/etudiant/profil/nouveau', isStudent, createProfil);

// Dashboard Etudiant
router.get('/etudiant/dashboard', isStudent, showDashboard);
router.get('/etudiant/formations', isStudent, showFormations);
router.get('/messagerie', ensureAuth, showMessagerie);

// Routes formation interactive
router.get('/formation/:formationId', redirectToFirstModule);
router.get('/formation/:formationId/module/:moduleNumber', showFormationInteractive);
// Route pour continuer une formation (redirige vers le dernier module en cours)
// Route pour continuer une formation
router.get('/formation/:formationId/continuer', isStudent, async (req, res) => {
    try {
        const { formationId } = req.params;
        const userId = req.session.userId;

        console.log(`🔄 Route continuer - Formation: ${formationId}, User: ${userId}`);

        // Vérifier l'inscription
        const inscription = await sequelize.query(`
            SELECT i.id 
            FROM inscriptions i 
            WHERE i.user_id = :userId AND i.formation_id = :formationId
        `, {
            type: QueryTypes.SELECT,
            replacements: { userId, formationId }
        });

        if (!inscription.length) {
            req.flash('error', 'Vous n\'êtes pas inscrit à cette formation');
            return res.redirect('/mes-formations');
        }

        // Trouver le dernier module en cours ou le premier non terminé
        const dernierModule = await sequelize.query(`
            SELECT m.ordre 
            FROM modules m
            LEFT JOIN progressions_modules pm ON m.id = pm.module_id AND pm.user_id = :userId
            WHERE m.formation_id = :formationId
            AND (pm.statut IS NULL OR pm.statut != 'termine')
            ORDER BY m.ordre ASC
            LIMIT 1
        `, {
            type: QueryTypes.SELECT,
            replacements: { formationId, userId }
        });

        const moduleNumber = dernierModule[0]?.ordre || 1;
        
        console.log(`➡️ Redirection vers module ${moduleNumber}`);
        res.redirect(`/formation/${formationId}/module/${moduleNumber}`);
        
    } catch (error) {
        console.error('❌ Erreur route continuer:', error);
        req.flash('error', 'Erreur lors de l\'accès à la formation');
        res.redirect('/mes-formations');
    }
});

// Route pour commencer une formation (redirige vers le premier module)
router.get('/formation/:formationId/commencer', isStudent, async (req, res) => {
    try {
        const { formationId } = req.params;
        
        // Créer l'inscription si elle n'existe pas
        const userId = req.session.userId;
        
        await sequelize.query(`
            INSERT INTO inscriptions (user_id, formation_id, date_inscription, statut, progression_pourcentage, createdat, updatedat)
            VALUES (:userId, :formationId, NOW(), 'en_cours', 0, NOW(), NOW())
            ON CONFLICT (user_id, formation_id) DO NOTHING
        `, {
            replacements: { userId, formationId }
        });

        // Rediriger vers le premier module
        res.redirect(`/formation/${formationId}/module/1`);
        
    } catch (error) {
        console.error('Erreur route commencer:', error);
        res.redirect(`/formation/${formationId}`);
    }
});

// Route pour terminer une formation
router.post('/api/formation/complete', isStudent, async (req, res) => {
    try {
        const { formationId } = req.body;
        const userId = req.session.userId;

        await sequelize.query(`
            UPDATE inscriptions 
            SET statut = 'termine', 
                progression_pourcentage = 100,
                certifie = true,
                date_certification = NOW()
            WHERE formation_id = :formationId AND user_id = :userId
        `, {
            replacements: { formationId, userId }
        });

        res.json({ success: true, message: 'Formation terminée' });
    } catch (error) {
        console.error('Erreur completion formation:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Route de test temporaire
router.get('/test-formation-route', (req, res) => {
    res.json({ 
        message: 'Route fonctionne',
        userId: req.session.userId,
        timestamp: new Date()
    });
});
// API Routes
router.post('/api/video/progress', saveVideoProgress);
router.post('/api/quiz/submit', submitQuiz);
router.post('/api/progress/time', saveTimeSpent);
router.get('/api/documents/:documentId/download', downloadDocument);

export default router;