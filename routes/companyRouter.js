import express from 'express';
import CompanyController from '../controllers/CompanyController.js';
import { checkCompany } from '../middleware/checkCompany.js';

const router = express.Router();

// Middleware global pour toutes les routes de l'espace entreprise
router.use(checkCompany);

// ========================================
// 📊 DASHBOARD ENTREPRISE
// ========================================
router.get('/', CompanyController.dashboard);
router.get('/dashboard', CompanyController.dashboard);

// ========================================
// 👥 GESTION DES SALARIÉS
// ========================================
router.get('/salaries', CompanyController.listEmployees);
router.get('/salaries/:id', CompanyController.employeeDetails);
router.post('/salaries/:id/inscription', CompanyController.enrollEmployee);

// ========================================
// 📝 INSCRIPTIONS & FORMATIONS
// ========================================
router.get('/inscriptions', CompanyController.inscriptions);
router.get('/inscriptions/nouvelle', CompanyController.newInscription);
router.post('/inscriptions', CompanyController.processInscription);
router.get('/inscriptions/:id', CompanyController.inscriptionDetails);
router.put('/inscriptions/:id/statut', CompanyController.updateInscriptionStatus);

// Inscription groupée
router.get('/inscriptions/groupee', CompanyController.groupInscription);
router.post('/inscriptions/groupee', CompanyController.processGroupInscription);

// ========================================
// 💰 FACTURATION & DEVIS
// ========================================
router.get('/facturation', CompanyController.billing);
router.get('/facturation/devis', CompanyController.quotes);
router.get('/facturation/factures', CompanyController.invoices);
router.get('/facturation/paiements', CompanyController.payments);

// Export PDF/CSV
router.get('/facturation/devis/:id/pdf', CompanyController.exportQuotePdf);
router.get('/facturation/factures/:id/pdf', CompanyController.exportInvoicePdf);
router.get('/facturation/export/:type', CompanyController.exportBillingData);

// ========================================
// 📊 RAPPORTS & ATTESTATIONS
// ========================================
router.get('/rapports', CompanyController.reports);
router.get('/rapports/progression', CompanyController.progressReports);
router.get('/rapports/attestations', CompanyController.certificates);
router.get('/rapports/export', CompanyController.exportReports);

// Téléchargement des attestations
router.get('/attestations/:id/pdf', CompanyController.downloadCertificate);
router.post('/attestations/batch-download', CompanyController.batchDownloadCertificates);

// ========================================
// ⚙️ PARAMÈTRES ENTREPRISE
// ========================================
router.get('/parametres', CompanyController.settings);
router.put('/parametres', CompanyController.updateSettings);
router.get('/parametres/equipe', CompanyController.teamManagement);
router.post('/parametres/equipe/invite', CompanyController.inviteTeamMember);

// ========================================
// 📨 API ENDPOINTS
// ========================================
router.get('/api/stats', CompanyController.getStats);
router.get('/api/employees/search', CompanyController.searchEmployees);
router.get('/api/formations/available', CompanyController.getAvailableFormations);
router.post('/api/notifications/mark-read', CompanyController.markNotificationsRead);
import { manageCompanies, updateCompanyStatus } from '../controllers/CompanyController.js';
router.get('/entreprises', manageCompanies);
router.post('/entreprises/:id/statut', updateCompanyStatus);
export default router;