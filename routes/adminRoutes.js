// routes/adminRoutes.js
import express from 'express';
import { AdminController } from '../controllers/AdminController.js';
import { checkAdmin, checkAdminAPI } from '../middleware/checkAdmin.js';
import { processFormWithFiles, parseFormData, uploadSingle } from '../middleware/uploadMiddleware.js';

const router = express.Router();
const adminController = new AdminController();

// Middleware d'authentification pour toutes les routes admin
router.use(checkAdmin);

// ====================== TABLEAU DE BORD ======================
router.get('/', adminController.dashboard.bind(adminController));
router.get('/dashboard', adminController.dashboard.bind(adminController));

// ====================== GESTION DES UTILISATEURS ======================
router.get('/utilisateurs', adminController.getUsers.bind(adminController));
router.get('/utilisateurs/nouveau', adminController.createUserForm.bind(adminController));

// Route POST avec middleware d'upload pour les utilisateurs
router.post('/utilisateurs/nouveau', 
    processFormWithFiles([
        { name: 'photo_profil', maxCount: 1 },
        { name: 'documents', maxCount: 3 }
    ]),
    parseFormData,
    adminController.createUser.bind(adminController)
);

router.get('/utilisateurs/:id/modifier', adminController.editUserForm.bind(adminController));
router.put('/utilisateurs/:id', 
    parseFormData,
    adminController.updateUser.bind(adminController)
);
router.delete('/utilisateurs/:id', adminController.deleteUser.bind(adminController));

// ====================== GESTION DES FORMATIONS ======================
// Liste des formations
router.get('/formations', adminController.getFormations.bind(adminController));

// Formulaire de création
router.get('/formations/nouvelle', adminController.createFormationForm.bind(adminController));

// Création de formation - Route corrigée pour gérer JSON et FormData
router.post('/formations/nouvelle',
    (req, res, next) => {
        const contentType = req.headers['content-type'];
        if (contentType && contentType.includes('application/json')) {
            express.json({ limit: '10mb' })(req, res, next);
        } else if (contentType && contentType.includes('multipart/form-data')) {
            // ✅ Accept all files dynamically
            processFormWithFiles()(req, res, next);
        } else {
            express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
        }
    },
    parseFormData,
    adminController.createFormation.bind(adminController)
);


// Détail d'une formation
router.get('/formations/:id', adminController.viewFormation.bind(adminController));

// Formulaire d'édition
router.get('/formations/:id/modifier', adminController.editFormationForm.bind(adminController));

// Mise à jour d'une formation
router.put('/formations/:id', 
    express.json(),
    parseFormData,
    adminController.updateFormation.bind(adminController)
);

// Suppression d'une formation
router.delete('/formations/:id', adminController.deleteFormation.bind(adminController));

// Actions spéciales sur les formations
router.post('/formations/:id/dupliquer', adminController.duplicateFormation.bind(adminController));
router.patch('/formations/:id/toggle-status', adminController.toggleFormationStatus.bind(adminController));
router.get('/formations/:id/preview', adminController.previewFormation.bind(adminController));
router.get('/formations/:id/stats', adminController.getFormationStats.bind(adminController));

// Export des formations
router.get('/formations/export/:format', adminController.exportFormations.bind(adminController));

// ====================== GESTION DES MODULES ======================

// Modules d'une formation
router.get('/formations/:id/modules', adminController.getFormationModules.bind(adminController));

// Créer un module
router.post('/formations/:id/modules', 
    processFormWithFiles([
        { name: 'video', maxCount: 1 },
        { name: 'documents', maxCount: 5 }
    ]),
    parseFormData,
    adminController.createModule.bind(adminController)
);

// Modifier un module
router.put('/modules/:id', 
    express.json(),
    adminController.updateModule.bind(adminController)
);

// Supprimer un module
router.delete('/modules/:id', adminController.deleteModule.bind(adminController));

// Réorganiser les modules
// router.patch('/modules/reorder', 
//     express.json(),
//     adminController.reorderModules.bind(adminController)
// );

// ====================== GESTION DES DOMAINES ======================

// API pour les domaines
router.get('/api/domaines', adminController.getDomains.bind(adminController));
router.post('/api/domaines', 
    express.json(),
    adminController.addDomain.bind(adminController)
);
router.put('/api/domaines/:id', 
    express.json(),
    adminController.updateDomain.bind(adminController)
);
router.delete('/api/domaines/:id', adminController.deleteDomain.bind(adminController));


// ====================== GESTION DES INSCRIPTIONS ======================
router.get('/inscriptions', adminController.getInscriptions.bind(adminController));
router.patch('/inscriptions/:id/valider', adminController.validateInscription.bind(adminController));
router.patch('/inscriptions/:id/refuser', (req, res) => {
    // Route pour refuser une inscription
    res.json({ success: true, message: 'Inscription refusée' });
});

// ====================== RAPPORTS ET STATISTIQUES ======================
router.get('/rapports', adminController.getReports.bind(adminController));

// ====================== MESSAGERIE ======================
router.get('/messagerie', adminController.getMessaging.bind(adminController));
router.post('/messagerie/envoyer', adminController.sendMessage.bind(adminController));

// ====================== GESTION DES ÉVÉNEMENTS ======================
router.get('/evenements', adminController.getEvents.bind(adminController));
router.get('/evenements/nouveau', adminController.createEventForm.bind(adminController));
router.post('/evenements/nouveau', 
    parseFormData,
    adminController.createEvent.bind(adminController)
);
// ====================== GESTION DES ÉVÉNEMENTS (complet) ======================
router.get('/evenements', adminController.getEvents.bind(adminController));
router.get('/evenements/nouveau', adminController.createEventForm.bind(adminController));
router.post('/evenements/nouveau', 
    parseFormData,
    adminController.createEvent.bind(adminController)
);

// Routes manquantes à ajouter :
router.get('/evenements/:id/modifier', adminController.editEventForm.bind(adminController));
router.put('/evenements/:id', 
    parseFormData,
    adminController.updateEvent.bind(adminController)
);
router.delete('/evenements/:id', adminController.deleteEvent.bind(adminController));
router.get('/evenements/:id', adminController.viewEvent.bind(adminController));
// ====================== PARAMÈTRES ======================
router.get('/parametres', adminController.getSettings.bind(adminController));
router.put('/parametres/organisme', adminController.updateOrganismSettings.bind(adminController));

// ====================== ROUTES MANQUANTES ======================

// Route pour la facturation (nouvelle)
router.get('/facturation', (req, res) => {
    res.render('admin/billing/dashboard', {
        title: 'Facturation - ADSIAM Admin',
        admin: req.admin,
        currentPage: 'billing',
        layout: 'layouts/admin',
        // Données facturation simulées
        billingData: {
            totalRevenue: 12450,
            monthlyRevenue: 2847,
            pendingPayments: 5,
            totalInvoices: 156,
            recentInvoices: [
                { id: 1, amount: 49, client: 'Marie Dupont', status: 'paid', date: new Date() },
                { id: 2, amount: 79, client: 'Jean Martin', status: 'pending', date: new Date() }
            ]
        }
    });
});

// Route pour les notifications (nouvelle)
router.get('/notifications', (req, res) => {
    res.render('admin/notifications/dashboard', {
        title: 'Notifications - ADSIAM Admin',
        admin: req.admin,
        currentPage: 'notifications',
        layout: 'layouts/admin',
        notifications: [
            { id: 1, title: 'Nouvelle inscription', message: 'Sophie Bernard s\'est inscrite', type: 'info', read: false, date: new Date() },
            { id: 2, title: 'Paiement reçu', message: 'Paiement de 49€ reçu', type: 'success', read: false, date: new Date() }
        ]
    });
});

// ====================== API ENDPOINTS ======================
// Utiliser checkAdminAPI pour les routes API qui retournent du JSON
router.use('/api/*', checkAdminAPI);

router.get('/api/stats/live', adminController.getLiveStats.bind(adminController));
router.get('/api/recherche/utilisateurs', adminController.searchUsersAPI.bind(adminController));
router.patch('/api/utilisateurs/:id/toggle-status', adminController.toggleUserStatus.bind(adminController));
router.post('/api/utilisateurs/bulk-action', adminController.bulkUserAction.bind(adminController));
router.get('/api/export/:type', adminController.exportReport.bind(adminController));

// ====================== NOTIFICATIONS ======================
router.post('/notifications/creer', adminController.createNotification.bind(adminController));

export default router;