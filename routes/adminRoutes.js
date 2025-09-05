// routes/adminRoutes.js
import express from 'express';
import { AdminController } from '../controllers/AdminController.js';
import { authMiddleware } from '../middleware/authMiddleware.js'; // Votre middleware existant
import { checkAdminAPI } from '../middleware/checkAdmin.js';
const router = express.Router();
const adminController = new AdminController();

// Middleware d'authentification pour toutes les routes admin
router.use(authMiddleware);

// ====================== TABLEAU DE BORD ======================
router.get('/', adminController.dashboard.bind(adminController));
router.get('/dashboard', adminController.dashboard.bind(adminController));

// ====================== GESTION DES UTILISATEURS ======================
router.get('/utilisateurs', adminController.getUsers.bind(adminController));
router.get('/utilisateurs/nouveau', adminController.createUserForm.bind(adminController));
router.post('/utilisateurs/nouveau', adminController.createUser.bind(adminController));
router.get('/utilisateurs/:id/modifier', adminController.editUserForm.bind(adminController));
router.put('/utilisateurs/:id', adminController.updateUser.bind(adminController));
router.delete('/utilisateurs/:id', adminController.deleteUser.bind(adminController));

// ====================== GESTION DES FORMATIONS ======================
router.get('/formations', adminController.getFormations.bind(adminController));
router.get('/formations/nouvelle', adminController.createFormationForm.bind(adminController));
router.post('/formations/nouvelle', adminController.createFormation.bind(adminController));

// ====================== GESTION DES INSCRIPTIONS ======================
router.get('/inscriptions', adminController.getInscriptions.bind(adminController));
router.patch('/inscriptions/:id/valider', adminController.validateInscription.bind(adminController));

// ====================== RAPPORTS ET STATISTIQUES ======================
router.get('/rapports', adminController.getReports.bind(adminController));

// ====================== MESSAGERIE ======================
router.get('/messagerie', adminController.getMessaging.bind(adminController));
router.post('/messagerie/envoyer', adminController.sendMessage.bind(adminController));

// ====================== GESTION DES ÉVÉNEMENTS ======================
router.get('/evenements', adminController.getEvents.bind(adminController));
router.get('/evenements/nouveau', adminController.createEventForm.bind(adminController));
router.post('/evenements/nouveau', adminController.createEvent.bind(adminController));

// ====================== PARAMÈTRES ======================
router.get('/parametres', adminController.getSettings.bind(adminController));
router.put('/parametres/organisme', adminController.updateOrganismSettings.bind(adminController));

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

