// routes/entrepriseRoutes.js
import express from 'express';
import EntrepriseController from '../controllers/EntrepriseController.js';

const router = express.Router();

// Middleware d'authentification (à adapter selon votre système)
const requireAuth = (req, res, next) => {
    if (!req.session?.userId) {
        req.flash('error', 'Veuillez vous connecter pour accéder à cette page');
        return res.redirect('/auth/login');
    }
    next();
};

// Middleware pour vérifier les droits admin/formateur
const requireAdminOrFormateur = (req, res, next) => {
    if (!req.session?.user || !['administrateur', 'formateur'].includes(req.session.user.type_utilisateur)) {
        req.flash('error', 'Accès non autorisé');
        return res.redirect('/dashboard');
    }
    next();
};

// 📋 ROUTES PRINCIPALES ENTREPRISES
// ========================================

// Liste des entreprises avec filtres et pagination
router.get('/entreprises', requireAuth, requireAdminOrFormateur, EntrepriseController.index);

// Affichage détaillé d'une entreprise
router.get('/entreprises/:id', requireAuth, requireAdminOrFormateur, EntrepriseController.show);

// Dashboard spécifique à une entreprise
router.get('/entreprises/:id/dashboard', requireAuth, requireAdminOrFormateur, EntrepriseController.dashboard);

// Formulaire de création d'une nouvelle entreprise
router.get('/entreprises/nouveau', requireAuth, requireAdminOrFormateur, EntrepriseController.create);

// Sauvegarde d'une nouvelle entreprise
router.post('/entreprises', requireAuth, requireAdminOrFormateur, EntrepriseController.store);

// Formulaire d'édition d'une entreprise
router.get('/entreprises/:id/modifier', requireAuth, requireAdminOrFormateur, EntrepriseController.edit);

// Mise à jour d'une entreprise
router.put('/entreprises/:id', requireAuth, requireAdminOrFormateur, EntrepriseController.update);
router.post('/entreprises/:id', requireAuth, requireAdminOrFormateur, EntrepriseController.update); // Support POST pour formulaires

// Suppression d'une entreprise
router.delete('/entreprises/:id', requireAuth, requireAdminOrFormateur, EntrepriseController.destroy);

// 🔄 ROUTES ACTIONS SPÉCIFIQUES
// ========================================

// Changement de statut d'une entreprise
router.patch('/entreprises/:id/statut', requireAuth, requireAdminOrFormateur, EntrepriseController.updateStatut);

// 🔍 ROUTES API ENTREPRISES
// ========================================

// API de recherche d'entreprises (pour autocomplete)
router.get('/api/entreprises/search', requireAuth, EntrepriseController.search);

// API statistiques globales entreprises
router.get('/api/entreprises/stats', requireAuth, requireAdminOrFormateur, async (req, res) => {
    try {
        const stats = await EntrepriseController.getStatistiques();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Erreur API stats entreprises:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// API pour obtenir les détails d'une entreprise (JSON)
router.get('/api/entreprises/:id', requireAuth, requireAdminOrFormateur, async (req, res) => {
    try {
        const entreprise = await Entreprise.findByPk(req.params.id);
        if (!entreprise) {
            return res.status(404).json({ success: false, message: 'Entreprise non trouvée' });
        }
        res.json({ success: true, entreprise });
    } catch (error) {
        console.error('Erreur API entreprise détails:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// 👥 ROUTES GESTION UTILISATEURS ENTREPRISE
// ========================================

// Liste des utilisateurs d'une entreprise
router.get('/entreprises/:id/utilisateurs', requireAuth, requireAdminOrFormateur, async (req, res) => {
    try {
        const { id } = req.params;
        const entreprise = await Entreprise.findByPk(id);
        
        if (!entreprise) {
            req.flash('error', 'Entreprise non trouvée');
            return res.redirect('/entreprises');
        }

        const utilisateurs = await sequelize.query(`
            SELECT 
                u.id, u.prenom, u.nom, u.email, u.type_utilisateur,
                u.statut, u.derniere_connexion_le, u.cree_le,
                COUNT(DISTINCT i.id) as formations_inscrites,
                COUNT(DISTINCT CASE WHEN i.certifie THEN i.id END) as certifications,
                AVG(i.progression_pourcentage) as progression_moyenne,
                SUM(i.temps_total_minutes) as temps_total
            FROM utilisateurs u
            LEFT JOIN inscriptions i ON u.id = i.user_id
            WHERE u.societe_rattachee = :entrepriseNom
            GROUP BY u.id
            ORDER BY u.nom, u.prenom
        `, {
            type: QueryTypes.SELECT,
            replacements: { entrepriseNom: entreprise.nom }
        });

        res.render('entreprises/utilisateurs', {
            title: `Utilisateurs - ${entreprise.nom}`,
            layout: 'layouts/admin',
            entreprise,
            utilisateurs
        });
    } catch (error) {
        console.error('Erreur utilisateurs entreprise:', error);
        req.flash('error', 'Erreur lors du chargement des utilisateurs');
        res.redirect('/entreprises');
    }
});

// Ajout d'un utilisateur à une entreprise
router.post('/entreprises/:id/utilisateurs', requireAuth, requireAdminOrFormateur, async (req, res) => {
    try {
        const { id } = req.params;
        const { email_utilisateur } = req.body;
        
        const entreprise = await Entreprise.findByPk(id);
        if (!entreprise) {
            return res.status(404).json({ success: false, message: 'Entreprise non trouvée' });
        }

        // Vérifier si l'entreprise a encore des licences disponibles
        if (entreprise.getLicencesDisponibles() <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucune licence disponible pour cette entreprise'
            });
        }

        // Rechercher l'utilisateur
        const utilisateur = await sequelize.query(`
            SELECT * FROM utilisateurs WHERE email = :email
        `, {
            type: QueryTypes.SELECT,
            replacements: { email: email_utilisateur }
        });

        if (utilisateur.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé avec cet email'
            });
        }

        // Rattacher l'utilisateur à l'entreprise
        await sequelize.query(`
            UPDATE utilisateurs 
            SET societe_rattachee = :entrepriseNom
            WHERE email = :email
        `, {
            replacements: { 
                entrepriseNom: entreprise.nom,
                email: email_utilisateur 
            }
        });

        // Incrémenter le nombre de licences utilisées
        await entreprise.increment('nombre_licences_utilisees');

        res.json({
            success: true,
            message: `Utilisateur ajouté à ${entreprise.nom}`
        });
    } catch (error) {
        console.error('Erreur ajout utilisateur entreprise:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Retrait d'un utilisateur d'une entreprise
router.delete('/entreprises/:id/utilisateurs/:userId', requireAuth, requireAdminOrFormateur, async (req, res) => {
    try {
        const { id, userId } = req.params;
        
        const entreprise = await Entreprise.findByPk(id);
        if (!entreprise) {
            return res.status(404).json({ success: false, message: 'Entreprise non trouvée' });
        }

        // Retirer l'utilisateur de l'entreprise
        await sequelize.query(`
            UPDATE utilisateurs 
            SET societe_rattachee = NULL
            WHERE id = :userId
        `, {
            replacements: { userId }
        });

        // Décrémenter le nombre de licences utilisées
        if (entreprise.nombre_licences_utilisees > 0) {
            await entreprise.decrement('nombre_licences_utilisees');
        }

        res.json({
            success: true,
            message: 'Utilisateur retiré de l\'entreprise'
        });
    } catch (error) {
        console.error('Erreur retrait utilisateur entreprise:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// 📊 ROUTES RAPPORTS ET EXPORTS
// ========================================

// Export CSV des entreprises
router.get('/entreprises/export/csv', requireAuth, requireAdminOrFormateur, async (req, res) => {
    try {
        const entreprises = await Entreprise.findAll({
            order: [['nom', 'ASC']]
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=entreprises_adsiam.csv');
        
        let csv = 'Nom,SIRET,Secteur,Ville,Email,Statut,Type Contrat,Licences Max,Licences Utilisées,Tarif Mensuel,Date Création\n';
        
        entreprises.forEach(e => {
            csv += `"${e.nom}","${e.siret}","${e.secteur_activite}","${e.ville}","${e.email_contact}","${e.statut}","${e.type_contrat}","${e.nombre_licences_max}","${e.nombre_licences_utilisees}","${e.tarif_mensuel || ''}","${e.createdAt.toLocaleDateString()}"\n`;
        });

        res.send(csv);
    } catch (error) {
        console.error('Erreur export CSV entreprises:', error);
        req.flash('error', 'Erreur lors de l\'export');
        res.redirect('/entreprises');
    }
});

export default router;