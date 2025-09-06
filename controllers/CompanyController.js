import { sequelize } from '../models/index.js';
import { QueryTypes } from 'sequelize';

class CompanyController {
    // ========================================
    // 📊 DASHBOARD ENTREPRISE
    // ========================================
    static async dashboard(req, res) {
        try {
            const companyId = req.session.user.societe_rattachee;
            
            // Stats principales
            const stats = await sequelize.query(`
                SELECT 
                    COUNT(DISTINCT u.id) as total_employes,
                    COUNT(DISTINCT i.id) as total_inscriptions,
                    COUNT(DISTINCT CASE WHEN i.statut = 'termine' THEN i.id END) as formations_terminees,
                    ROUND(AVG(i.progression_pourcentage), 1) as progression_moyenne,
                    COUNT(DISTINCT CASE WHEN i.certifie = true THEN i.id END) as certifications_obtenues,
                    SUM(i.temps_total_minutes) as temps_total_formation
                FROM users u
                LEFT JOIN inscriptions i ON u.id = i.user_id
                WHERE u.societe_rattachee = :companyId
                AND u.role != 'societe'
            `, {
                type: QueryTypes.SELECT,
                replacements: { companyId }
            });

            // Dernières activités
            const recentActivities = await sequelize.query(`
                SELECT 
                    u.prenom, u.nom,
                    f.titre as formation_titre,
                    i.statut,
                    i.progression_pourcentage,
                    i.updatedat as derniere_activite
                FROM inscriptions i
                JOIN users u ON i.user_id = u.id
                JOIN formations f ON i.formation_id = f.id
                WHERE u.societe_rattachee = :companyId
                ORDER BY i.updatedat DESC
                LIMIT 10
            `, {
                type: QueryTypes.SELECT,
                replacements: { companyId }
            });

            // Formations populaires
            const topFormations = await sequelize.query(`
                SELECT 
                    f.titre,
                    f.icone,
                    COUNT(i.id) as nb_inscriptions,
                    ROUND(AVG(i.progression_pourcentage), 1) as progression_moyenne
                FROM formations f
                JOIN inscriptions i ON f.id = i.formation_id
                JOIN users u ON i.user_id = u.id
                WHERE u.societe_rattachee = :companyId
                GROUP BY f.id, f.titre, f.icone
                ORDER BY nb_inscriptions DESC
                LIMIT 5
            `, {
                type: QueryTypes.SELECT,
                replacements: { companyId }
            });

            res.render('entreprises/dashboard', {
                title: 'Tableau de bord Entreprise - ADSIAM',
                layout: 'layouts/company',
                stats: stats[0] || {},
                recentActivities,
                topFormations,
                currentUser: req.session.user
            });

        } catch (error) {
            console.error('Erreur dashboard entreprise:', error);
            req.flash('error', 'Erreur lors du chargement du tableau de bord.');
            res.redirect('/dashboard');
        }
    }

    // ========================================
    // 👥 GESTION DES SALARIÉS
    // ========================================
    static async listEmployees(req, res) {
        try {
            const companyId = req.session.user.societe_rattachee;
            const page = parseInt(req.query.page) || 1;
            const limit = 20;
            const offset = (page - 1) * limit;

            // Liste des employés avec leurs statistiques
            const employees = await sequelize.query(`
                SELECT 
                    u.id, u.prenom, u.nom, u.email, u.telephone,
                    u.type_utilisateur, u.statut, u.derniere_connexion,
                    COUNT(DISTINCT i.id) as nb_formations,
                    COUNT(DISTINCT CASE WHEN i.statut = 'termine' THEN i.id END) as formations_terminees,
                    ROUND(AVG(i.progression_pourcentage), 1) as progression_moyenne,
                    SUM(i.temps_total_minutes) as temps_total,
                    COUNT(DISTINCT CASE WHEN i.certifie = true THEN i.id END) as certifications
                FROM users u
                LEFT JOIN inscriptions i ON u.id = i.user_id
                WHERE u.societe_rattachee = :companyId
                AND u.role != 'societe'
                GROUP BY u.id
                ORDER BY u.nom, u.prenom
                LIMIT :limit OFFSET :offset
            `, {
                type: QueryTypes.SELECT,
                replacements: { companyId, limit, offset }
            });

            // Total pour pagination
            const totalResult = await sequelize.query(`
                SELECT COUNT(*) as total
                FROM users 
                WHERE societe_rattachee = :companyId 
                AND role != 'societe'
            `, {
                type: QueryTypes.SELECT,
                replacements: { companyId }
            });

            const total = parseInt(totalResult[0].total);
            const totalPages = Math.ceil(total / limit);

            res.render('entreprises/employees', {
                title: 'Mes Salariés - ADSIAM',
                layout: 'layouts/company',
                employees,
                pagination: {
                    current: page,
                    total: totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            });

        } catch (error) {
            console.error('Erreur liste employés:', error);
            req.flash('error', 'Erreur lors du chargement des employés.');
            res.redirect('/entreprise/dashboard');
        }
    }

    static async employeeDetails(req, res) {
        try {
            const employeeId = req.params.id;
            const companyId = req.session.user.societe_rattachee;

            // Détails de l'employé
            const employee = await sequelize.query(`
                SELECT u.*, 
                    COUNT(DISTINCT i.id) as nb_formations,
                    COUNT(DISTINCT CASE WHEN i.statut = 'termine' THEN i.id END) as formations_terminees,
                    ROUND(AVG(i.progression_pourcentage), 1) as progression_moyenne,
                    SUM(i.temps_total_minutes) as temps_total
                FROM users u
                LEFT JOIN inscriptions i ON u.id = i.user_id
                WHERE u.id = :employeeId 
                AND u.societe_rattachee = :companyId
                GROUP BY u.id
            `, {
                type: QueryTypes.SELECT,
                replacements: { employeeId, companyId }
            });

            if (!employee[0]) {
                req.flash('error', 'Employé non trouvé.');
                return res.redirect('/entreprise/salaries');
            }

            // Formations de l'employé
            const formations = await sequelize.query(`
                SELECT 
                    f.titre, f.icone, f.niveau,
                    i.statut, i.progression_pourcentage,
                    i.date_inscription, i.date_certification,
                    i.temps_total_minutes, i.note_finale,
                    i.certifie
                FROM inscriptions i
                JOIN formations f ON i.formation_id = f.id
                WHERE i.user_id = :employeeId
                ORDER BY i.date_inscription DESC
            `, {
                type: QueryTypes.SELECT,
                replacements: { employeeId }
            });

            res.render('entreprises/employee-details', {
                title: `${employee[0].prenom} ${employee[0].nom} - ADSIAM`,
                layout: 'layouts/company',
                employee: employee[0],
                formations
            });

        } catch (error) {
            console.error('Erreur détails employé:', error);
            req.flash('error', 'Erreur lors du chargement des détails.');
            res.redirect('/entreprise/salaries');
        }
    }

    // ========================================
    // 📝 INSCRIPTIONS & FORMATIONS
    // ========================================
    static async inscriptions(req, res) {
        try {
            const companyId = req.session.user.societe_rattachee;

            // Toutes les inscriptions de l'entreprise
            const inscriptions = await sequelize.query(`
                SELECT 
                    i.id, i.statut, i.progression_pourcentage,
                    i.date_inscription, i.date_fin_prevue,
                    u.prenom, u.nom,
                    f.titre, f.icone, f.niveau, f.prix
                FROM inscriptions i
                JOIN users u ON i.user_id = u.id
                JOIN formations f ON i.formation_id = f.id
                WHERE u.societe_rattachee = :companyId
                ORDER BY i.date_inscription DESC
            `, {
                type: QueryTypes.SELECT,
                replacements: { companyId }
            });

            // Stats des inscriptions
            const stats = await sequelize.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN statut = 'en_cours' THEN 1 END) as en_cours,
                    COUNT(CASE WHEN statut = 'termine' THEN 1 END) as terminees,
                    COUNT(CASE WHEN certifie = true THEN 1 END) as certifiees
                FROM inscriptions i
                JOIN users u ON i.user_id = u.id
                WHERE u.societe_rattachee = :companyId
            `, {
                type: QueryTypes.SELECT,
                replacements: { companyId }
            });

            res.render('entreprises/inscriptions', {
                title: 'Inscriptions - ADSIAM',
                layout: 'layouts/company',
                inscriptions,
                stats: stats[0]
            });

        } catch (error) {
            console.error('Erreur inscriptions:', error);
            req.flash('error', 'Erreur lors du chargement des inscriptions.');
            res.redirect('/entreprise/dashboard');
        }
    }

    static async newInscription(req, res) {
        try {
            const companyId = req.session.user.societe_rattachee;

            // Employés non inscrits à une formation spécifique
            const employees = await sequelize.query(`
                SELECT id, prenom, nom, email, type_utilisateur
                FROM users 
                WHERE societe_rattachee = :companyId 
                AND role != 'societe'
                AND statut = 'actif'
                ORDER BY nom, prenom
            `, {
                type: QueryTypes.SELECT,
                replacements: { companyId }
            });

            // Formations disponibles
            const formations = await sequelize.query(`
                SELECT id, titre, description, icone, niveau, 
                       duree_heures, prix, domaine
                FROM formations 
                WHERE actif = true
                ORDER BY titre
            `, {
                type: QueryTypes.SELECT
            });

            res.render('entreprises/new-inscription', {
                title: 'Nouvelle Inscription - ADSIAM',
                layout: 'layouts/company',
                employees,
                formations
            });

        } catch (error) {
            console.error('Erreur nouvelle inscription:', error);
            req.flash('error', 'Erreur lors du chargement du formulaire.');
            res.redirect('/entreprise/inscriptions');
        }
    }

    static async processInscription(req, res) {
        try {
            const { employeeIds, formationId, dateFinPrevue } = req.body;
            const companyId = req.session.user.societe_rattachee;

            // Vérification que les employés appartiennent à l'entreprise
            const validEmployees = await sequelize.query(`
                SELECT id FROM users 
                WHERE id = ANY(:employeeIds) 
                AND societe_rattachee = :companyId
            `, {
                type: QueryTypes.SELECT,
                replacements: { 
                    employeeIds: Array.isArray(employeeIds) ? employeeIds : [employeeIds],
                    companyId 
                }
            });

            if (validEmployees.length === 0) {
                req.flash('error', 'Aucun employé valide sélectionné.');
                return res.redirect('/entreprise/inscriptions/nouvelle');
            }

            // Création des inscriptions
            const inscriptionPromises = validEmployees.map(emp => 
                sequelize.query(`
                    INSERT INTO inscriptions 
                    (user_id, formation_id, date_inscription, date_fin_prevue, statut, progression_pourcentage, createdat, updatedat)
                    VALUES (:userId, :formationId, NOW(), :dateFin, 'non_commence', 0, NOW(), NOW())
                    RETURNING id
                `, {
                    type: QueryTypes.INSERT,
                    replacements: {
                        userId: emp.id,
                        formationId,
                        dateFin: dateFinPrevue || null
                    }
                })
            );

            await Promise.all(inscriptionPromises);

            req.flash('success', `${validEmployees.length} inscription(s) créée(s) avec succès.`);
            res.redirect('/entreprise/inscriptions');

        } catch (error) {
            console.error('Erreur traitement inscription:', error);
            req.flash('error', 'Erreur lors de la création des inscriptions.');
            res.redirect('/entreprise/inscriptions/nouvelle');
        }
    }

    // ========================================
    // 💰 FACTURATION & DEVIS
    // ========================================
    static async billing(req, res) {
        try {
            // Cette fonction nécessiterait une table de facturation
            // Pour l'instant, on simule avec les inscriptions
            res.render('entreprises/billing', {
                title: 'Facturation - ADSIAM',
                layout: 'layouts/company',
                message: 'Module de facturation en développement'
            });
        } catch (error) {
            console.error('Erreur facturation:', error);
            req.flash('error', 'Erreur lors du chargement de la facturation.');
            res.redirect('/entreprise/dashboard');
        }
    }

    // ========================================
    // 📊 RAPPORTS & ATTESTATIONS
    // ========================================
    static async reports(req, res) {
        try {
            const companyId = req.session.user.societe_rattachee;

            // Rapports de progression par formation
            const progressionReports = await sequelize.query(`
                SELECT 
                    f.titre as formation,
                    COUNT(i.id) as nb_inscrits,
                    COUNT(CASE WHEN i.statut = 'termine' THEN 1 END) as nb_termines,
                    ROUND(AVG(i.progression_pourcentage), 1) as progression_moyenne,
                    COUNT(CASE WHEN i.certifie = true THEN 1 END) as nb_certifies
                FROM formations f
                JOIN inscriptions i ON f.id = i.formation_id
                JOIN users u ON i.user_id = u.id
                WHERE u.societe_rattachee = :companyId
                GROUP BY f.id, f.titre
                ORDER BY nb_inscrits DESC
            `, {
                type: QueryTypes.SELECT,
                replacements: { companyId }
            });

            res.render('entreprises/reports', {
                title: 'Rapports - ADSIAM',
                layout: 'layouts/company',
                progressionReports
            });

        } catch (error) {
            console.error('Erreur rapports:', error);
            req.flash('error', 'Erreur lors du chargement des rapports.');
            res.redirect('/entreprise/dashboard');
        }
    }

    // ========================================
    // ⚙️ API ENDPOINTS
    // ========================================
    static async getStats(req, res) {
        try {
            const companyId = req.session.user.societe_rattachee;

            const stats = await sequelize.query(`
                SELECT 
                    COUNT(DISTINCT u.id) as employes,
                    COUNT(DISTINCT i.id) as inscriptions,
                    COUNT(DISTINCT CASE WHEN i.statut = 'termine' THEN i.id END) as terminees,
                    ROUND(AVG(i.progression_pourcentage), 1) as progression
                FROM users u
                LEFT JOIN inscriptions i ON u.id = i.user_id
                WHERE u.societe_rattachee = :companyId
                AND u.role != 'societe'
            `, {
                type: QueryTypes.SELECT,
                replacements: { companyId }
            });

            res.json({
                success: true,
                stats: stats[0]
            });

        } catch (error) {
            console.error('Erreur API stats:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération des statistiques'
            });
        }
    }

    static async searchEmployees(req, res) {
        try {
            const { q } = req.query;
            const companyId = req.session.user.societe_rattachee;

            const employees = await sequelize.query(`
                SELECT id, prenom, nom, email
                FROM users 
                WHERE societe_rattachee = :companyId 
                AND role != 'societe'
                AND (prenom ILIKE :search OR nom ILIKE :search OR email ILIKE :search)
                ORDER BY nom, prenom
                LIMIT 10
            `, {
                type: QueryTypes.SELECT,
                replacements: { 
                    companyId,
                    search: `%${q}%`
                }
            });

            res.json({
                success: true,
                employees
            });

        } catch (error) {
            console.error('Erreur recherche employés:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la recherche'
            });
        }
    }
    

    // ========================================
    // 🔧 MÉTHODES UTILITAIRES
    // ========================================
    static async enrollEmployee(req, res) {
        // Inscription d'un employé à une formation
        res.json({ message: 'À implémenter' });
    }

    static async groupInscription(req, res) {
        // Page d'inscription groupée
        res.render('entreprises/group-inscription', {
            title: 'Inscription Groupée - ADSIAM',
            layout: 'layouts/company'
        });
    }

    static async processGroupInscription(req, res) {
        // Traitement inscription groupée
        res.json({ message: 'À implémenter' });
    }

    static async quotes(req, res) {
        // Gestion des devis
        res.render('entreprises/quotes', {
            title: 'Devis - ADSIAM',
            layout: 'layouts/company'
        });
    }

    static async invoices(req, res) {
        // Gestion des factures
        res.render('entreprises/invoices', {
            title: 'Factures - ADSIAM',
            layout: 'layouts/company'
        });
    }

    static async payments(req, res) {
        // Historique des paiements
        res.render('entreprises/payments', {
            title: 'Paiements - ADSIAM',
            layout: 'layouts/company'
        });
    }

    static async settings(req, res) {
        // Paramètres de l'entreprise
        res.render('entreprises/settings', {
            title: 'Paramètres - ADSIAM',
            layout: 'layouts/company'
        });
    }

    static async updateSettings(req, res) {
        // Mise à jour des paramètres
        res.json({ message: 'À implémenter' });
    }

    // Méthodes pour les exports PDF/CSV à implémenter
    static async exportQuotePdf(req, res) { res.json({ message: 'Export PDF devis à implémenter' }); }
    static async exportInvoicePdf(req, res) { res.json({ message: 'Export PDF facture à implémenter' }); }
    static async exportBillingData(req, res) { res.json({ message: 'Export données facturation à implémenter' }); }
    static async downloadCertificate(req, res) { res.json({ message: 'Téléchargement attestation à implémenter' }); }
    static async batchDownloadCertificates(req, res) { res.json({ message: 'Téléchargement groupé à implémenter' }); }
    static async progressReports(req, res) { res.json({ message: 'Rapports progression à implémenter' }); }
    static async certificates(req, res) { res.json({ message: 'Gestion attestations à implémenter' }); }
    static async exportReports(req, res) { res.json({ message: 'Export rapports à implémenter' }); }
    static async teamManagement(req, res) { res.json({ message: 'Gestion équipe à implémenter' }); }
    static async inviteTeamMember(req, res) { res.json({ message: 'Invitation équipe à implémenter' }); }
    static async inscriptionDetails(req, res) { res.json({ message: 'Détails inscription à implémenter' }); }
    static async updateInscriptionStatus(req, res) { res.json({ message: 'Mise à jour statut à implémenter' }); }
    static async getAvailableFormations(req, res) { res.json({ message: 'Formations disponibles à implémenter' }); }
    static async markNotificationsRead(req, res) { res.json({ message: 'Marquer notifications lues à implémenter' }); }
}

export const manageCompanies = async (req, res) => {
    try {
        const { QueryTypes } = await import('sequelize');
        
        // Récupérer toutes les entreprises
        const companies = await sequelize.query(`
            SELECT 
                u.id,
                u.prenom,
                u.nom,
                u.email,
                u.statut,
                u.societe_rattachee,
                u.cree_le,
                u.derniere_connexion_le,
                COUNT(DISTINCT emp.id) as nombre_employes,
                COUNT(DISTINCT i.id) as total_inscriptions
            FROM users u
            LEFT JOIN users emp ON emp.societe_rattachee = u.societe_rattachee AND emp.role != 'societe'
            LEFT JOIN inscriptions i ON emp.id = i.user_id
            WHERE u.role = 'societe'
            GROUP BY u.id, u.prenom, u.nom, u.email, u.statut, u.societe_rattachee, u.cree_le, u.derniere_connexion_le
            ORDER BY u.cree_le DESC
        `, {
            type: QueryTypes.SELECT
        });

        res.render('admin/companies', {
            title: 'Gestion des Entreprises - ADSIAM',
            layout: 'layouts/admin',
            companies,
            currentPage: 'companies'
        });

    } catch (error) {
        console.error('Erreur gestion entreprises:', error);
        req.flash('error', 'Erreur lors du chargement des entreprises');
        res.redirect('/admin');
    }
};

// Modifier le statut d'une entreprise
export const updateCompanyStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { statut } = req.body;

        if (!['actif', 'en_attente', 'suspendu', 'inactif'].includes(statut)) {
            req.flash('error', 'Statut invalide');
            return res.redirect('/admin/entreprises');
        }

        const { QueryTypes } = await import('sequelize');
        
        // Mettre à jour le statut
        await sequelize.query(`
            UPDATE users 
            SET statut = :statut, modifie_le = NOW()
            WHERE id = :id AND role = 'societe'
        `, {
            type: QueryTypes.UPDATE,
            replacements: { id, statut }
        });

        // Récupérer les infos de l'entreprise pour le message
        const company = await sequelize.query(`
            SELECT prenom, nom, societe_rattachee 
            FROM users 
            WHERE id = :id
        `, {
            type: QueryTypes.SELECT,
            replacements: { id }
        });

        if (company[0]) {
            req.flash('success', `Statut de l'entreprise ${company[0].societe_rattachee} mis à jour: ${statut}`);
        }

        res.redirect('/admin/entreprises');

    } catch (error) {
        console.error('Erreur mise à jour statut:', error);
        req.flash('error', 'Erreur lors de la mise à jour du statut');
        res.redirect('/admin/entreprises');
    }
};

export default CompanyController;