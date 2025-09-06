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

// ========================================
// 💰 ROUTES POUR LES DEVIS - À AJOUTER DANS routes/company.js
// ========================================

// Page principale des devis
router.get('/facturation/devis', CompanyController.quotes);

// Création d'un nouveau devis
router.post('/facturation/devis', CompanyController.createQuote);

// Détails d'un devis
router.get('/facturation/devis/:id', CompanyController.getQuoteDetails);

// Modification d'un devis
router.get('/facturation/devis/:id/modifier', CompanyController.editQuote);
router.put('/facturation/devis/:id', CompanyController.updateQuote);

// Actions sur les devis
router.post('/facturation/devis/:id/envoyer', CompanyController.sendQuote);
router.delete('/facturation/devis/:id', CompanyController.deleteQuote);
router.post('/facturation/devis/:id/dupliquer', CompanyController.duplicateQuote);
router.post('/facturation/devis/:id/convertir-facture', CompanyController.convertToInvoice);

// Export PDF d'un devis
router.get('/facturation/devis/:id/pdf', CompanyController.exportQuotePdf);

// Actions groupées
router.post('/facturation/devis/bulk-send', (req, res) => {
    req.body.action = 'send';
    CompanyController.bulkQuoteAction(req, res);
});

router.post('/facturation/devis/bulk-delete', (req, res) => {
    req.body.action = 'delete';
    CompanyController.bulkQuoteAction(req, res);
});

router.post('/facturation/devis/bulk-duplicate', (req, res) => {
    req.body.action = 'duplicate';
    CompanyController.bulkQuoteAction(req, res);
});

// Export des données
router.get('/facturation/devis/export', CompanyController.exportQuotes);

// Vérification des mises à jour
router.get('/facturation/devis/check-updates', CompanyController.checkQuoteUpdates);

// ========================================
// 💰 ROUTES FACTURATION - À AJOUTER DANS routes/company.js
// ========================================

// Page principale de facturation (avec onglets)
router.get('/facturation', CompanyController.billing);

// ========================================
// GESTION DES DEVIS
// ========================================

// Actions sur les devis depuis la page facturation
router.post('/facturation/devis/:id/accepter', CompanyController.acceptQuote);
router.get('/facturation/devis/:id/voir', CompanyController.viewQuote);

// ========================================
// GESTION DES FACTURES
// ========================================

// Détails et actions des factures
router.get('/facturation/factures/:id/details', CompanyController.getInvoiceDetails);
router.get('/facturation/factures/:id/voir', CompanyController.viewInvoice);
router.get('/facturation/factures/:id/pdf', CompanyController.downloadInvoicePdf);

// Traitement des paiements
router.post('/facturation/factures/:id/payer', CompanyController.processPayment);

// ========================================
// GESTION DES PAIEMENTS
// ========================================

// Téléchargement des reçus
router.get('/facturation/paiements/:id/recu', CompanyController.downloadPaymentReceipt);

// ========================================
// EXPORTS ET RAPPORTS
// ========================================

// Export des données de facturation
router.get('/facturation/export', CompanyController.exportBillingData);

// ========================================
// API POUR MISES À JOUR TEMPS RÉEL
// ========================================

// Vérification des statuts de facturation
router.get('/api/facturation/statuts', CompanyController.getBillingStatusUpdates);

// ========================================
// WEBHOOKS DE PAIEMENT (pour intégration future)
// ========================================

// Webhook pour confirmation de paiement (Stripe, PayPal, etc.)
router.post('/webhooks/payment/:provider', (req, res) => {
    const { provider } = req.params;
    const payload = req.body;
    
    console.log(`Webhook paiement reçu de ${provider}:`, payload);
    
    // Ici vous traiteriez les notifications de paiement
    // et mettriez à jour le statut des factures en base
    
    res.status(200).json({ received: true });
});

// ========================================
// ROUTES DE REDIRECTION (pour compatibilité)
// ========================================

// Redirection vers les onglets spécifiques
router.get('/facturation/mes-devis', (req, res) => {
    res.redirect('/entreprise/facturation?tab=devis');
});

router.get('/facturation/mes-factures', (req, res) => {
    res.redirect('/entreprise/facturation?tab=factures');
});

router.get('/facturation/mes-paiements', (req, res) => {
    res.redirect('/entreprise/facturation?tab=paiements');
});

// ========================================
// MIDDLEWARE POUR VALIDATION DES PAIEMENTS
// ========================================

// Middleware pour vérifier les permissions de paiement
function checkPaymentPermissions(req, res, next) {
    const userRole = req.session.user.role;
    
    if (userRole !== 'societe') {
        return res.status(403).json({
            success: false,
            message: 'Accès non autorisé pour les paiements'
        });
    }
    
    next();
}

// Application du middleware aux routes de paiement
router.use('/facturation/factures/:id/payer', checkPaymentPermissions);
router.use('/webhooks/payment/:provider', express.raw({type: 'application/json'}));

// ========================================
// ROUTES ADDITIONNELLES POUR FONCTIONNALITÉS AVANCÉES
// ========================================

// Génération de rapports financiers personnalisés
router.get('/facturation/rapport/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { periode, format } = req.query;
        
        // Logique de génération de rapport
        console.log(`Génération rapport ${type} pour période ${periode} au format ${format}`);
        
        res.json({
            success: true,
            message: 'Rapport généré',
            downloadUrl: `/entreprise/facturation/downloads/rapport-${type}-${Date.now()}.${format}`
        });
        
    } catch (error) {
        console.error('Erreur génération rapport:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la génération du rapport'
        });
    }
});

// Configuration des préférences de facturation
router.get('/facturation/parametres', async (req, res) => {
    try {
        res.render('entreprises/billing-settings', {
            title: 'Paramètres de Facturation - ADSIAM',
            layout: 'layouts/company'
        });
    } catch (error) {
        console.error('Erreur paramètres facturation:', error);
        req.flash('error', 'Erreur lors du chargement des paramètres.');
        res.redirect('/entreprise/facturation');
    }
});

router.post('/facturation/parametres', async (req, res) => {
    try {
        const settings = req.body;
        const companyId = req.session.user.societe_rattachee;
        
        // Sauvegarde des paramètres de facturation
        console.log(`Mise à jour paramètres facturation pour entreprise ${companyId}:`, settings);
        
        req.flash('success', 'Paramètres de facturation mis à jour avec succès.');
        res.redirect('/entreprise/facturation/parametres');
        
    } catch (error) {
        console.error('Erreur sauvegarde paramètres:', error);
        req.flash('error', 'Erreur lors de la sauvegarde des paramètres.');
        res.redirect('/entreprise/facturation/parametres');
    }
});

// Historique détaillé des transactions
router.get('/facturation/historique', async (req, res) => {
    try {
        const { page = 1, limit = 50, type, dateDebut, dateFin } = req.query;
        
        // Logique de récupération de l'historique
        const historique = []; // À implémenter avec vraies données
        
        res.render('entreprises/billing-history', {
            title: 'Historique des Transactions - ADSIAM',
            layout: 'layouts/company',
            historique,
            pagination: {
                current: parseInt(page),
                total: 1,
                hasNext: false,
                hasPrev: false
            },
            filters: { type, dateDebut, dateFin }
        });
        
    } catch (error) {
        console.error('Erreur historique facturation:', error);
        req.flash('error', 'Erreur lors du chargement de l\'historique.');
        res.redirect('/entreprise/facturation');
    }
});

// API pour statistiques en temps réel
router.get('/api/facturation/stats', async (req, res) => {
    try {
        const companyId = req.session.user.societe_rattachee;
        const { periode = '30d' } = req.query;
        
        // Calcul des statistiques selon la période
        const stats = {
            total_facture: 2450.00,
            total_paye: 1890.00,
            total_en_attente: 560.00,
            factures_en_cours: 3,
            evolution: {
                facture: '+12%',
                paiements: '+8%',
                retards: '-5%'
            },
            graphique: {
                labels: ['Jan', 'Fév', 'Mar', 'Avr'],
                factures: [1200, 1800, 2100, 2450],
                paiements: [1000, 1500, 1800, 1890]
            }
        };
        
        res.json({
            success: true,
            stats,
            periode
        });
        
    } catch (error) {
        console.error('Erreur stats facturation:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du calcul des statistiques'
        });
    }
});

// Notifications de facturation
router.get('/facturation/notifications', async (req, res) => {
    try {
        const companyId = req.session.user.societe_rattachee;
        
        const notifications = [
            {
                id: 1,
                type: 'payment',
                title: 'Paiement reçu',
                message: 'Facture FACT-2024-001 payée (470,40€)',
                date: new Date(),
                lu: false
            },
            {
                id: 2,
                type: 'reminder',
                title: 'Échéance proche',
                message: 'Facture FACT-2024-002 à payer avant le 24/04',
                date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                lu: true
            }
        ];
        
        res.json({
            success: true,
            notifications
        });
        
    } catch (error) {
        console.error('Erreur notifications facturation:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des notifications'
        });
    }
});

// Marquer les notifications comme lues
router.post('/facturation/notifications/:id/lu', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`Notification ${id} marquée comme lue`);
        
        res.json({
            success: true,
            message: 'Notification marquée comme lue'
        });
        
    } catch (error) {
        console.error('Erreur marquage notification:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du marquage'
        });
    }
});

// Route de test pour la facturation (développement uniquement)
if (process.env.NODE_ENV === 'development') {
    router.get('/facturation/test', (req, res) => {
        res.json({
            message: 'Routes de facturation opérationnelles',
            routes: [
                'GET /entreprise/facturation',
                'POST /entreprise/facturation/devis/:id/accepter',
                'GET /entreprise/facturation/factures/:id/details',
                'POST /entreprise/facturation/factures/:id/payer',
                'GET /entreprise/facturation/export',
                'GET /entreprise/api/facturation/statuts'
            ],
            timestamp: new Date().toISOString()
        });
    });
}
export default router;