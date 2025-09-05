// routes/adminRoutes.js
import express from 'express';
import { AdminController } from '../controllers/AdminController.js';
import { checkAdmin, checkAdminAPI } from '../middleware/checkAdmin.js';

const router = express.Router();
const adminController = new AdminController();

// Toutes les routes admin nécessitent l'authentification admin
router.use(checkAdmin);

// ====================== TABLEAU DE BORD ======================
router.get('/', adminController.dashboard);
router.get('/dashboard', adminController.dashboard);
router.get('/stats', adminController.getStats);

// ====================== GESTION DES UTILISATEURS ======================
// Liste et recherche
router.get('/utilisateurs', adminController.getUsers);
router.get('/utilisateurs/search', adminController.searchUsers);

// Création
router.get('/utilisateurs/nouveau', adminController.createUserForm);
router.post('/utilisateurs/nouveau', adminController.createUser);

// Édition
router.get('/utilisateurs/:id/edit', adminController.editUserForm);
router.put('/utilisateurs/:id', adminController.updateUser);

// Suppression
router.delete('/utilisateurs/:id', adminController.deleteUser);

// Actions en lot
router.post('/utilisateurs/bulk-action', adminController.bulkUserAction);

// Détails utilisateur
router.get('/utilisateurs/:id', adminController.getUserDetails);

// ====================== GESTION DES FORMATIONS ======================
// Liste
router.get('/formations', adminController.getFormations);
router.get('/formations/search', adminController.searchFormations);

// Création
router.get('/formations/nouvelle', adminController.createFormationForm);
router.post('/formations/nouvelle', adminController.createFormation);

// Édition
router.get('/formations/:id/edit', adminController.editFormationForm);
router.put('/formations/:id', adminController.updateFormation);

// Suppression
router.delete('/formations/:id', adminController.deleteFormation);

// Modules
router.get('/formations/:id/modules', adminController.getFormationModules);
router.post('/formations/:id/modules', adminController.createModule);
router.put('/formations/:formationId/modules/:moduleId', adminController.updateModule);
router.delete('/formations/:formationId/modules/:moduleId', adminController.deleteModule);

// ====================== GESTION DES INSCRIPTIONS ======================
router.get('/inscriptions', adminController.getInscriptions);
router.get('/inscriptions/en-attente', adminController.getPendingInscriptions);
router.post('/inscriptions/:id/valider', adminController.validateInscription);
router.post('/inscriptions/:id/refuser', adminController.rejectInscription);
router.get('/inscriptions/:id', adminController.getInscriptionDetails);

// ====================== FACTURATION / PAIEMENTS ======================
router.get('/facturation', adminController.getBilling);
router.get('/facturation/factures', adminController.getInvoices);
router.get('/facturation/paiements', adminController.getPayments);
router.get('/facturation/factures/:id', adminController.getInvoiceDetails);
router.post('/facturation/factures/:id/generer', adminController.generateInvoice);
router.get('/facturation/export', adminController.exportBilling);

// ====================== RAPPORTS ET STATISTIQUES ======================
router.get('/rapports', adminController.getReports);
router.get('/rapports/utilisateurs', adminController.getUsersReport);
router.get('/rapports/formations', adminController.getFormationsReport);
router.get('/rapports/financier', adminController.getFinancialReport);
router.get('/rapports/progression', adminController.getProgressReport);
router.get('/rapports/export/:type', adminController.exportReport);

// ====================== MESSAGERIE / NOTIFICATIONS ======================
router.get('/messagerie', adminController.getMessaging);
router.get('/messagerie/conversations', adminController.getConversations);
router.get('/messagerie/conversations/:id', adminController.getConversation);
router.post('/messagerie/conversations', adminController.createConversation);
router.post('/messagerie/messages', adminController.sendMessage);
router.get('/notifications', adminController.getNotifications);
router.post('/notifications', adminController.createNotification);
router.put('/notifications/:id/marquer-lu', adminController.markNotificationRead);

// ====================== ÉVÉNEMENTS ======================
router.get('/evenements', adminController.getEvents);
router.get('/evenements/nouveau', adminController.createEventForm);
router.post('/evenements/nouveau', adminController.createEvent);
router.get('/evenements/:id/edit', adminController.editEventForm);
router.put('/evenements/:id', adminController.updateEvent);
router.delete('/evenements/:id', adminController.deleteEvent);

// ====================== PARAMÈTRES GÉNÉRAUX ======================
router.get('/parametres', adminController.getSettings);
router.put('/parametres/organisme', adminController.updateOrganismSettings);
router.put('/parametres/site', adminController.updateSiteSettings);
router.put('/parametres/notifications', adminController.updateNotificationSettings);

// ====================== API ENDPOINTS ======================
// Utiliser checkAdminAPI pour les endpoints JSON
router.use('/api', checkAdminAPI);

// Stats en temps réel
router.get('/api/stats/live', adminController.getLiveStats);
router.get('/api/stats/dashboard', adminController.getDashboardStats);

// Recherche autocomplete
router.get('/api/users/search', adminController.searchUsersAPI);
router.get('/api/formations/search', adminController.searchFormationsAPI);

// Actions rapides
router.post('/api/users/:id/toggle-status', adminController.toggleUserStatus);
router.post('/api/formations/:id/toggle-status', adminController.toggleFormationStatus);

// Upload de fichiers
router.post('/api/upload/avatar', adminController.uploadAvatar);
router.post('/api/upload/formation-image', adminController.uploadFormationImage);
router.post('/api/upload/document', adminController.uploadDocument);

export default router;