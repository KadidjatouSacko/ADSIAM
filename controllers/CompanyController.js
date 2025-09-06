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

        // CORRECTION: Liste des employés avec préfixes explicites
        const employees = await sequelize.query(`
            SELECT 
                u.id, u.prenom, u.nom, u.email, u.telephone,
                u.type_utilisateur, u.statut as statut_employe, u.derniere_connexion,
                COUNT(DISTINCT i.id) as nb_formations,
                COUNT(DISTINCT CASE WHEN i.statut = 'termine' THEN i.id END) as formations_terminees,
                ROUND(AVG(i.progression_pourcentage), 1) as progression_moyenne,
                SUM(i.temps_total_minutes) as temps_total,
                COUNT(DISTINCT CASE WHEN i.certifie = true THEN i.id END) as certifications
            FROM users u
            LEFT JOIN inscriptions i ON u.id = i.user_id
            WHERE u.societe_rattachee = :companyId
            AND u.role != 'societe'
            GROUP BY u.id, u.prenom, u.nom, u.email, u.telephone, u.type_utilisateur, u.statut, u.derniere_connexion
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

        // CORRECTION: Stats des inscriptions avec préfixes explicites
        const stats = await sequelize.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN i.statut = 'en_cours' THEN 1 END) as en_cours,
                COUNT(CASE WHEN i.statut = 'termine' THEN 1 END) as terminees,
                COUNT(CASE WHEN i.certifie = true THEN 1 END) as certifiees
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
            AND role != 'societe'
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

        // Vérifier que la formation existe et est active
        const formation = await sequelize.query(`
            SELECT id, titre, prix FROM formations 
            WHERE id = :formationId AND actif = true
        `, {
            type: QueryTypes.SELECT,
            replacements: { formationId }
        });

        if (!formation[0]) {
            req.flash('error', 'Formation non trouvée ou inactive.');
            return res.redirect('/entreprise/inscriptions/nouvelle');
        }

        // Création des inscriptions avec transaction
        const transaction = await sequelize.transaction();
        
        try {
            const inscriptionPromises = validEmployees.map(emp => 
                sequelize.query(`
                    INSERT INTO inscriptions 
                    (user_id, formation_id, date_inscription, date_fin_prevue, statut, progression_pourcentage, createdat, updatedat)
                    VALUES (:userId, :formationId, NOW(), :dateFin, 'non_commence', 0, NOW(), NOW())
                    RETURNING id
                `, {
                    type: QueryTypes.INSERT,
                    transaction,
                    replacements: {
                        userId: emp.id,
                        formationId,
                        dateFin: dateFinPrevue || null
                    }
                })
            );

            await Promise.all(inscriptionPromises);
            await transaction.commit();

            req.flash('success', `${validEmployees.length} inscription(s) créée(s) avec succès pour la formation "${formation[0].titre}".`);
            res.redirect('/entreprise/inscriptions');

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

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
        const companyId = req.session.user.societe_rattachee;
        const activeTab = req.query.tab || 'devis';
        const filters = {
            status: req.query.filter_status || '',
            month: req.query.month || new Date().toISOString().substr(0, 7)
        };

        // ========================================
        // STATISTIQUES FINANCIÈRES
        // ========================================
        const billingStats = await sequelize.query(`
            WITH stats_base AS (
                SELECT 
                    COUNT(DISTINCT i.id) as nb_inscriptions,
                    SUM(CASE WHEN f.gratuit = false THEN f.prix ELSE 0 END) as total_formations,
                    COUNT(DISTINCT u.id) as nb_employes
                FROM inscriptions i
                JOIN users u ON i.user_id = u.id
                JOIN formations f ON i.formation_id = f.id
                WHERE u.societe_rattachee = :companyId
            )
            SELECT 
                (total_formations * 1.2) as total_facture,
                (total_formations * 0.8 * 1.2) as total_paye,
                (total_formations * 0.2 * 1.2) as total_en_attente,
                GREATEST(nb_inscriptions - 2, 0) as factures_en_cours
            FROM stats_base
        `, {
            type: QueryTypes.SELECT,
            replacements: { companyId }
        });

        // ========================================
        // DONNÉES DES DEVIS (simulation basée sur inscriptions)
        // ========================================
        const devis = await sequelize.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY i.createdat DESC) as id,
                'DEV-2024-' || LPAD(ROW_NUMBER() OVER (ORDER BY i.createdat DESC)::text, 3, '0') as numero_devis,
                i.createdat as date_creation,
                f.titre as formation_titre,
                CASE 
                    WHEN f.titre LIKE '%Communication%' THEN 'Formation équipe communication'
                    WHEN f.titre LIKE '%Hygiène%' THEN 'Formation personnel soignant'
                    WHEN f.titre LIKE '%Ergonomie%' THEN 'Formation équipe technique'
                    ELSE 'Formation générale'
                END as description_courte,
                CASE 
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 3 = 1 THEN 12
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 3 = 2 THEN 8
                    ELSE 6
                END as nombre_participants,
                CASE 
                    WHEN f.gratuit = true THEN 0
                    ELSE (f.prix * 
                        CASE 
                            WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 3 = 1 THEN 12
                            WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 3 = 2 THEN 8
                            ELSE 6
                        END * 0.9)
                END as montant_ht,
                CASE 
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 5 = 0 THEN 'accepte'
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 5 = 1 THEN 'envoye'
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 5 = 2 THEN 'en_attente'
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 5 = 3 THEN 'brouillon'
                    ELSE 'refuse'
                END as statut,
                CASE 
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 5 = 0 THEN true
                    ELSE false
                END as facture_creee
            FROM inscriptions i
            JOIN users u ON i.user_id = u.id
            JOIN formations f ON i.formation_id = f.id
            WHERE u.societe_rattachee = :companyId
            ORDER BY i.createdat DESC
            LIMIT 10
        `, {
            type: QueryTypes.SELECT,
            replacements: { companyId }
        });

        // ========================================
        // DONNÉES DES FACTURES (simulation)
        // ========================================
        let factures = await sequelize.query(`
            SELECT 
                'FACT-2024-' || LPAD(ROW_NUMBER() OVER (ORDER BY i.createdat DESC)::text, 3, '0') as numero_facture,
                i.createdat as date_emission,
                (i.createdat + INTERVAL '30 days') as date_echeance,
                f.titre as formation_titre,
                CASE 
                    WHEN f.gratuit = true THEN 0
                    ELSE (f.prix * 8 * 1.2)
                END as montant_ttc,
                CASE 
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 4 = 0 THEN 'payee'
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 4 = 1 THEN 'a_payer'
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 4 = 2 THEN 'en_retard'
                    ELSE 'a_payer'
                END as statut
            FROM inscriptions i
            JOIN users u ON i.user_id = u.id
            JOIN formations f ON i.formation_id = f.id
            WHERE u.societe_rattachee = :companyId
            AND i.statut = 'termine'
            ORDER BY i.createdat DESC
            LIMIT 8
        `, {
            type: QueryTypes.SELECT,
            replacements: { companyId }
        });

        // Filtrage des factures selon le statut
        if (filters.status) {
            factures = factures.filter(f => {
                const now = new Date();
                const echeance = new Date(f.date_echeance);
                
                switch (filters.status) {
                    case 'payee':
                        return f.statut === 'payee';
                    case 'a_payer':
                        return f.statut !== 'payee' && echeance >= now;
                    case 'en_retard':
                        return f.statut !== 'payee' && echeance < now;
                    default:
                        return true;
                }
            });
        }

        // ========================================
        // DONNÉES DES PAIEMENTS (simulation)
        // ========================================
        const paiements = await sequelize.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY i.createdat DESC) as id,
                i.createdat as date_paiement,
                'FACT-2024-' || LPAD(ROW_NUMBER() OVER (ORDER BY i.createdat DESC)::text, 3, '0') as numero_facture,
                CASE 
                    WHEN f.gratuit = true THEN 0
                    ELSE (f.prix * 8 * 1.2)
                END as montant,
                CASE 
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 3 = 0 THEN 'carte'
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 3 = 1 THEN 'virement'
                    ELSE 'cheque'
                END as methode_paiement,
                CASE 
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 6 = 0 THEN 'en_attente'
                    ELSE 'confirme'
                END as statut
            FROM inscriptions i
            JOIN users u ON i.user_id = u.id
            JOIN formations f ON i.formation_id = f.id
            WHERE u.societe_rattachee = :companyId
            AND i.statut = 'termine'
            AND DATE_TRUNC('month', i.createdat) = DATE_TRUNC('month', :monthFilter::date)
            ORDER BY i.createdat DESC
            LIMIT 15
        `, {
            type: QueryTypes.SELECT,
            replacements: { 
                companyId,
                monthFilter: filters.month + '-01'
            }
        });

        // ========================================
        // GÉNÉRATION D'ALERTES
        // ========================================
        const alerts = [];
        
        // Vérifier les factures en retard
        const facturesEnRetard = factures.filter(f => {
            const echeance = new Date(f.date_echeance);
            return f.statut !== 'payee' && echeance < new Date();
        });
        
        if (facturesEnRetard.length > 0) {
            alerts.push({
                type: 'warning',
                title: 'Factures en retard',
                message: `Vous avez ${facturesEnRetard.length} facture(s) en retard de paiement.`,
                action: {
                    url: '?tab=factures&filter_status=en_retard',
                    text: 'Voir les factures'
                }
            });
        }

        // Vérifier les devis en attente
        const devisEnAttente = devis.filter(d => d.statut === 'en_attente');
        if (devisEnAttente.length > 0) {
            alerts.push({
                type: 'info',
                title: 'Devis en attente',
                message: `${devisEnAttente.length} devis attendent votre réponse.`,
                action: {
                    url: '?tab=devis',
                    text: 'Consulter'
                }
            });
        }

        res.render('entreprises/billing', {
            title: 'Facturation - ADSIAM',
            layout: 'layouts/company',
            activeTab,
            billingStats: billingStats[0] || {},
            devis,
            factures,
            paiements,
            filters,
            alerts,
            currentUser: req.session.user
        });

    } catch (error) {
        console.error('Erreur facturation:', error);
        req.flash('error', 'Erreur lors du chargement de la facturation.');
        res.redirect('/entreprise/dashboard');
    }
}

// ========================================
// ACTIONS SUR LES DEVIS
// ========================================
static async acceptQuote(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.session.user.societe_rattachee;

        // Simulation de l'acceptation du devis
        console.log(`Acceptation du devis ${id} pour l'entreprise ${companyId}`);

        // Générer un numéro de facture
        const numeroFacture = `FACT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

        res.json({
            success: true,
            message: 'Devis accepté avec succès',
            facture_numero: numeroFacture
        });

    } catch (error) {
        console.error('Erreur acceptation devis:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'acceptation du devis'
        });
    }
}

// ========================================
// GESTION DES FACTURES
// ========================================
static async getInvoiceDetails(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.session.user.societe_rattachee;

        // Simulation des détails d'une facture
        const invoiceDetails = {
            numero_facture: id,
            date_emission: new Date(),
            date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            montant_ttc: 470.40,
            formation_titre: 'Communication & Relationnel',
            nombre_participants: 8,
            statut: 'a_payer'
        };

        res.json({
            success: true,
            invoice: invoiceDetails
        });

    } catch (error) {
        console.error('Erreur détails facture:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des détails'
        });
    }
}

static async processPayment(req, res) {
    try {
        const { id } = req.params;
        const { methode } = req.body;
        const companyId = req.session.user.societe_rattachee;

        console.log(`Traitement paiement facture ${id}, méthode: ${methode}, entreprise: ${companyId}`);

        if (methode === 'card') {
            // Simulation d'une URL de paiement
            res.json({
                success: true,
                payment_url: `https://payment.adsiam.fr/pay/${id}?token=${Date.now()}`
            });
        } else {
            // Instructions de virement
            res.json({
                success: true,
                iban: 'FR76 1234 5678 9012 3456 789',
                bic: 'ADSIFRP1',
                reference: id,
                message: 'Instructions de virement envoyées'
            });
        }

    } catch (error) {
        console.error('Erreur traitement paiement:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du traitement du paiement'
        });
    }
}

// ========================================
// GÉNÉRATION DE DOCUMENTS
// ========================================
static async downloadInvoicePdf(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.session.user.societe_rattachee;

        console.log(`Génération PDF facture ${id} pour l'entreprise ${companyId}`);

        // Simulation d'un PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="facture-${id}.pdf"`);
        res.send(Buffer.from(`PDF simulé - Facture ${id}`));

    } catch (error) {
        console.error('Erreur génération PDF facture:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la génération du PDF'
        });
    }
}

static async downloadPaymentReceipt(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.session.user.societe_rattachee;

        console.log(`Génération reçu paiement ${id} pour l'entreprise ${companyId}`);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="recu-paiement-${id}.pdf"`);
        res.send(Buffer.from(`PDF simulé - Reçu de paiement ${id}`));

    } catch (error) {
        console.error('Erreur génération reçu:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la génération du reçu'
        });
    }
}

// ========================================
// EXPORT DES DONNÉES
// ========================================
static async exportBillingData(req, res) {
    try {
        const { type, format } = req.query;
        const companyId = req.session.user.societe_rattachee;
        const month = req.query.month;

        console.log(`Export ${type} au format ${format} pour l'entreprise ${companyId}`);

        let data = [];
        let filename = '';
        let headers = [];

        switch (type) {
            case 'devis':
                headers = ['Numéro', 'Date', 'Formation', 'Participants', 'Montant HT', 'Statut'];
                data = [
                    ['DEV-2024-001', '15/03/2024', 'Communication & Relationnel', '12', '960.00', 'Accepté'],
                    ['DEV-2024-002', '18/03/2024', 'Hygiène & Sécurité', '8', '672.00', 'En attente']
                ];
                filename = `devis-${companyId}`;
                break;

            case 'factures':
                headers = ['Numéro', 'Date émission', 'Échéance', 'Montant TTC', 'Statut'];
                data = [
                    ['FACT-2024-001', '20/03/2024', '19/04/2024', '1152.00', 'Payée'],
                    ['FACT-2024-002', '25/03/2024', '24/04/2024', '806.40', 'À payer']
                ];
                filename = `factures-${companyId}`;
                break;

            case 'paiements':
                headers = ['Date', 'Facture', 'Montant', 'Méthode', 'Statut'];
                data = [
                    ['20/03/2024', 'FACT-2024-001', '1152.00', 'Carte bancaire', 'Confirmé'],
                    ['15/03/2024', 'FACT-2024-000', '480.00', 'Virement', 'Confirmé']
                ];
                filename = `paiements-${companyId}`;
                if (month) filename += `-${month}`;
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Type d\'export non supporté'
                });
        }

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
            
            const csvContent = [
                headers.join(','),
                ...data.map(row => row.join(','))
            ].join('\n');
            
            res.send('\ufeff' + csvContent); // BOM pour Excel
        } else {
            res.status(400).json({
                success: false,
                message: 'Format d\'export non supporté'
            });
        }

    } catch (error) {
        console.error('Erreur export facturation:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'export'
        });
    }
}

// ========================================
// API POUR MISES À JOUR EN TEMPS RÉEL
// ========================================
static async getBillingStatusUpdates(req, res) {
    try {
        const companyId = req.session.user.societe_rattachee;

        // Simulation de vérification des mises à jour
        const updates = [];

        // Simuler quelques mises à jour aléatoires
        if (Math.random() > 0.7) {
            updates.push({
                type: 'payment',
                id: 'PAY-' + Date.now(),
                status: 'confirme',
                message: 'Paiement confirmé'
            });
        }

        if (Math.random() > 0.8) {
            updates.push({
                type: 'invoice',
                id: 'FACT-2024-002',
                statusClass: 'success',
                statusText: 'Payée'
            });
        }

        res.json({
            success: true,
            updates
        });

    } catch (error) {
        console.error('Erreur vérification statuts:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la vérification'
        });
    }
}

// ========================================
// PAGES DÉTAILLÉES
// ========================================
static async viewQuote(req, res) {
    try {
        const { id } = req.params;
        
        res.render('entreprises/quote-view', {
            title: `Devis ${id} - ADSIAM`,
            layout: 'layouts/company',
            quoteId: id
        });

    } catch (error) {
        console.error('Erreur vue devis:', error);
        req.flash('error', 'Erreur lors de l\'affichage du devis.');
        res.redirect('/entreprise/facturation');
    }
}

static async viewInvoice(req, res) {
    try {
        const { id } = req.params;
        
        res.render('entreprises/invoice-view', {
            title: `Facture ${id} - ADSIAM`,
            layout: 'layouts/company',
            invoiceId: id
        });

    } catch (error) {
        console.error('Erreur vue facture:', error);
        req.flash('error', 'Erreur lors de l\'affichage de la facture.');
        res.redirect('/entreprise/facturation');
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
    try {
        const companyId = req.session.user.societe_rattachee;
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        // Filtres
        const filters = {
            statut: req.query.statut || '',
            periode: req.query.periode || '',
            search: req.query.search || ''
        };

        // Construction de la clause WHERE
        let whereClause = `e.societe_rattachee = :companyId`;
        const replacements = { companyId, limit, offset };

        if (filters.statut) {
            whereClause += ` AND d.statut = :statut`;
            replacements.statut = filters.statut;
        }

        if (filters.periode) {
            const days = parseInt(filters.periode);
            whereClause += ` AND d.date_creation >= NOW() - INTERVAL '${days} days'`;
        }

        if (filters.search) {
            whereClause += ` AND d.numero_devis ILIKE :search`;
            replacements.search = `%${filters.search}%`;
        }

        // Récupération des devis (simulation avec les données existantes)
        const quotes = await sequelize.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY i.createdat DESC) as id,
                'DEV-2024-' || LPAD(ROW_NUMBER() OVER (ORDER BY i.createdat DESC)::text, 3, '0') as numero_devis,
                i.createdat as date_creation,
                f.titre as formation_titre,
                CASE 
                    WHEN f.titre LIKE '%Communication%' THEN 'Équipe communication'
                    WHEN f.titre LIKE '%Hygiène%' THEN 'Personnel soignant'
                    WHEN f.titre LIKE '%Ergonomie%' THEN 'Équipe technique'
                    ELSE 'Formation générale'
                END as description_courte,
                CASE 
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 3 = 1 THEN 12
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 3 = 2 THEN 8
                    ELSE 15
                END as nombre_participants,
                CASE 
                    WHEN f.gratuit = true THEN 0
                    ELSE (f.prix * 
                        CASE 
                            WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 3 = 1 THEN 12
                            WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 3 = 2 THEN 8
                            ELSE 15
                        END * 0.9)
                END as montant_ht,
                CASE 
                    WHEN f.gratuit = true THEN 0
                    ELSE (f.prix * 
                        CASE 
                            WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 3 = 1 THEN 12
                            WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 3 = 2 THEN 8
                            ELSE 15
                        END * 0.9 * 1.2)
                END as montant_ttc,
                CASE 
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 4 = 1 THEN 'accepte'
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 4 = 2 THEN 'envoye'
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 4 = 3 THEN 'en_attente'
                    ELSE 'brouillon'
                END as statut,
                CASE 
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 4 != 0 
                    THEN i.createdat + INTERVAL '30 days'
                    ELSE NULL
                END as date_validite
            FROM inscriptions i
            JOIN users u ON i.user_id = u.id
            JOIN formations f ON i.formation_id = f.id
            WHERE u.societe_rattachee = :companyId
            ORDER BY i.createdat DESC
            LIMIT :limit OFFSET :offset
        `, {
            type: QueryTypes.SELECT,
            replacements
        });

        // Stats des devis
        const quoteStats = await sequelize.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN statut_calc = 'accepte' THEN 1 END) as acceptes,
                COUNT(CASE WHEN statut_calc = 'en_attente' THEN 1 END) as en_attente,
                COALESCE(SUM(montant_ht_calc), 0) as montant_total
            FROM (
                SELECT 
                    CASE 
                        WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 4 = 1 THEN 'accepte'
                        WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 4 = 2 THEN 'envoye'
                        WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 4 = 3 THEN 'en_attente'
                        ELSE 'brouillon'
                    END as statut_calc,
                    CASE 
                        WHEN f.gratuit = true THEN 0
                        ELSE (f.prix * 12 * 0.9)
                    END as montant_ht_calc
                FROM inscriptions i
                JOIN users u ON i.user_id = u.id
                JOIN formations f ON i.formation_id = f.id
                WHERE u.societe_rattachee = :companyId
            ) stats
        `, {
            type: QueryTypes.SELECT,
            replacements: { companyId }
        });

        // Total pour pagination
        const totalResult = await sequelize.query(`
            SELECT COUNT(*) as total
            FROM inscriptions i
            JOIN users u ON i.user_id = u.id
            WHERE u.societe_rattachee = :companyId
        `, {
            type: QueryTypes.SELECT,
            replacements: { companyId }
        });

        const total = parseInt(totalResult[0].total);
        const totalPages = Math.ceil(total / limit);

        // Formations disponibles pour le modal
        const formations = await sequelize.query(`
            SELECT id, titre, prix, duree_heures, gratuit
            FROM formations 
            WHERE actif = true
            ORDER BY titre
        `, {
            type: QueryTypes.SELECT
        });

        res.render('entreprises/quotes', {
            title: 'Gestion des Devis - ADSIAM',
            layout: 'layouts/company',
            quotes,
            quoteStats: quoteStats[0],
            formations,
            filters: Object.keys(filters).length > 0 ? filters : null,
            pagination: {
                current: page,
                total: totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Erreur gestion devis:', error);
        req.flash('error', 'Erreur lors du chargement des devis.');
        res.redirect('/entreprise/dashboard');
    }
}

// Création d'un nouveau devis
static async createQuote(req, res) {
    try {
        const companyId = req.session.user.societe_rattachee;
        const {
            formation_id,
            nombre_participants,
            date_debut_souhaitee,
            validite_jours,
            contact_nom,
            contact_email,
            modalites,
            montant_ht,
            montant_ttc
        } = req.body;

        // Validation
        if (!formation_id || !nombre_participants) {
            return res.status(400).json({
                success: false,
                message: 'Formation et nombre de participants requis'
            });
        }

        // Vérification que la formation existe
        const formation = await sequelize.query(`
            SELECT titre, prix FROM formations WHERE id = :formationId AND actif = true
        `, {
            type: QueryTypes.SELECT,
            replacements: { formationId: formation_id }
        });

        if (!formation[0]) {
            return res.status(400).json({
                success: false,
                message: 'Formation non trouvée'
            });
        }

        // Génération du numéro de devis
        const year = new Date().getFullYear();
        const numeroDevis = `DEV-${year}-${String(Date.now()).slice(-6)}`;

        // Pour la démo, on simule la création du devis
        // Dans un vrai système, vous créeriez une table `devis`
        
        const dateValidite = validite_jours ? 
            new Date(Date.now() + parseInt(validite_jours) * 24 * 60 * 60 * 1000) : 
            null;

        // Simulation de l'insertion
        console.log('Création devis:', {
            numero_devis: numeroDevis,
            formation_id,
            nombre_participants,
            montant_ht,
            montant_ttc,
            date_validite: dateValidite,
            societe_id: companyId
        });

        res.json({
            success: true,
            message: 'Devis créé avec succès',
            numero_devis: numeroDevis,
            id: Date.now() // ID simulé
        });

    } catch (error) {
        console.error('Erreur création devis:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du devis'
        });
    }
}

// Envoi d'un devis
static async sendQuote(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.session.user.societe_rattachee;

        // Ici vous mettriez à jour le statut du devis en base
        // et enverriez l'email au client
        
        console.log(`Envoi du devis ${id} pour l'entreprise ${companyId}`);

        res.json({
            success: true,
            message: 'Devis envoyé avec succès'
        });

    } catch (error) {
        console.error('Erreur envoi devis:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi du devis'
        });
    }
}

// Suppression d'un devis
static async deleteQuote(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.session.user.societe_rattachee;

        // Vérification que le devis appartient à l'entreprise
        // et suppression en base
        
        console.log(`Suppression du devis ${id} pour l'entreprise ${companyId}`);

        res.json({
            success: true,
            message: 'Devis supprimé avec succès'
        });

    } catch (error) {
        console.error('Erreur suppression devis:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du devis'
        });
    }
}

// Duplication d'un devis
static async duplicateQuote(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.session.user.societe_rattachee;

        // Récupération du devis original et création d'une copie
        const numeroDevis = `DEV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
        
        console.log(`Duplication du devis ${id} -> ${numeroDevis} pour l'entreprise ${companyId}`);

        res.json({
            success: true,
            message: 'Devis dupliqué avec succès',
            numero_devis: numeroDevis
        });

    } catch (error) {
        console.error('Erreur duplication devis:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la duplication du devis'
        });
    }
}

// Conversion en facture
static async convertToInvoice(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.session.user.societe_rattachee;

        // Création de la facture à partir du devis
        const numeroFacture = `FACT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
        
        console.log(`Conversion devis ${id} -> facture ${numeroFacture} pour l'entreprise ${companyId}`);

        res.json({
            success: true,
            message: 'Facture créée avec succès',
            numero_facture: numeroFacture
        });

    } catch (error) {
        console.error('Erreur conversion facture:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la conversion en facture'
        });
    }
}

// Actions groupées
static async bulkQuoteAction(req, res) {
    try {
        const { ids, action } = req.body;
        const companyId = req.session.user.societe_rattachee;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucun devis sélectionné'
            });
        }

        let message = '';
        
        switch (action) {
            case 'send':
                // Envoi groupé des devis
                console.log(`Envoi groupé de ${ids.length} devis pour l'entreprise ${companyId}`);
                message = `${ids.length} devis envoyés avec succès`;
                break;
                
            case 'delete':
                // Suppression groupée des devis
                console.log(`Suppression groupée de ${ids.length} devis pour l'entreprise ${companyId}`);
                message = `${ids.length} devis supprimés avec succès`;
                break;
                
            case 'duplicate':
                // Duplication groupée des devis
                console.log(`Duplication groupée de ${ids.length} devis pour l'entreprise ${companyId}`);
                message = `${ids.length} devis dupliqués avec succès`;
                break;
                
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Action non reconnue'
                });
        }

        res.json({
            success: true,
            message
        });

    } catch (error) {
        console.error('Erreur action groupée devis:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'action groupée'
        });
    }
}

// Export des devis
static async exportQuotes(req, res) {
    try {
        const { format } = req.query;
        const companyId = req.session.user.societe_rattachee;

        // Récupération de tous les devis pour l'export
        const quotes = await sequelize.query(`
            SELECT 
                'DEV-2024-' || LPAD(ROW_NUMBER() OVER (ORDER BY i.createdat DESC)::text, 3, '0') as numero_devis,
                i.createdat as date_creation,
                f.titre as formation_titre,
                CASE 
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 3 = 1 THEN 12
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 3 = 2 THEN 8
                    ELSE 15
                END as nombre_participants,
                CASE 
                    WHEN f.gratuit = true THEN 0
                    ELSE (f.prix * 12 * 0.9)
                END as montant_ht,
                CASE 
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 4 = 1 THEN 'Accepté'
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 4 = 2 THEN 'Envoyé'
                    WHEN ROW_NUMBER() OVER (ORDER BY i.createdat DESC) % 4 = 3 THEN 'En attente'
                    ELSE 'Brouillon'
                END as statut
            FROM inscriptions i
            JOIN users u ON i.user_id = u.id
            JOIN formations f ON i.formation_id = f.id
            WHERE u.societe_rattachee = :companyId
            ORDER BY i.createdat DESC
        `, {
            type: QueryTypes.SELECT,
            replacements: { companyId }
        });

        const filename = `devis-${companyId}-${new Date().toISOString().split('T')[0]}`;

        switch (format) {
            case 'csv':
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
                
                const csvHeader = 'Numéro,Date,Formation,Participants,Montant HT,Statut\n';
                const csvData = quotes.map(q => 
                    `${q.numero_devis},${new Date(q.date_creation).toLocaleDateString('fr-FR')},${q.formation_titre},${q.nombre_participants},${q.montant_ht},${q.statut}`
                ).join('\n');
                
                res.send(csvHeader + csvData);
                break;

            case 'xlsx':
                // Pour Excel, vous devriez utiliser une bibliothèque comme exceljs
                res.status(501).json({
                    success: false,
                    message: 'Export Excel non implémenté'
                });
                break;

            case 'pdf':
                // Pour PDF, vous devriez utiliser une bibliothèque comme puppeteer
                res.status(501).json({
                    success: false,
                    message: 'Export PDF non implémenté'
                });
                break;

            default:
                res.status(400).json({
                    success: false,
                    message: 'Format d\'export non supporté'
                });
        }

    } catch (error) {
        console.error('Erreur export devis:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'export'
        });
    }
}

// Génération PDF d'un devis
static async exportQuotePdf(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.session.user.societe_rattachee;

        // Récupération des données du devis
        // En production, vous récupéreriez les vraies données du devis
        
        console.log(`Génération PDF du devis ${id} pour l'entreprise ${companyId}`);

        // Simulation d'un PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="devis-${id}.pdf"`);
        
        // Ici vous généreriez le vrai PDF avec puppeteer ou similaire
        res.send(Buffer.from('PDF simulé - Devis #' + id));

    } catch (error) {
        console.error('Erreur génération PDF devis:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la génération du PDF'
        });
    }
}

// Vérification des mises à jour
static async checkQuoteUpdates(req, res) {
    try {
        // Simulation de vérification des mises à jour
        // En production, vous vérifieriez s'il y a eu des modifications
        // depuis la dernière visite de l'utilisateur
        
        const hasUpdates = Math.random() > 0.8; // 20% de chance d'avoir des mises à jour

        res.json({
            hasUpdates,
            lastCheck: new Date().toISOString()
        });

    } catch (error) {
        console.error('Erreur vérification mises à jour:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la vérification'
        });
    }
}

// Détails d'un devis
static async getQuoteDetails(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.session.user.societe_rattachee;

        // Simulation des détails d'un devis
        const quoteDetails = {
            id: id,
            numero_devis: `DEV-2024-${String(id).padStart(3, '0')}`,
            date_creation: new Date(),
            formation_titre: 'Communication & Relationnel',
            description_courte: 'Formation équipe communication',
            nombre_participants: 12,
            montant_ht: 1068,
            montant_ttc: 1281.60,
            statut: 'brouillon',
            contact_nom: 'Marie Dupont',
            contact_email: 'marie.dupont@entreprise.fr',
            modalites: 'Formation en présentiel, 2 jours',
            date_validite: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        };

        res.render('entreprises/quote-details', {
            title: `Devis ${quoteDetails.numero_devis} - ADSIAM`,
            layout: 'layouts/company',
            quote: quoteDetails
        });

    } catch (error) {
        console.error('Erreur détails devis:', error);
        req.flash('error', 'Erreur lors du chargement des détails du devis.');
        res.redirect('/entreprise/facturation/devis');
    }
}

// Modification d'un devis
static async editQuote(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.session.user.societe_rattachee;

        // Récupération des données du devis pour modification
        const quoteDetails = {
            id: id,
            numero_devis: `DEV-2024-${String(id).padStart(3, '0')}`,
            formation_id: 1,
            nombre_participants: 12,
            date_debut_souhaitee: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            validite_jours: 30,
            contact_nom: 'Marie Dupont',
            contact_email: 'marie.dupont@entreprise.fr',
            modalites: 'Formation en présentiel, 2 jours'
        };

        // Formations disponibles
        const formations = await sequelize.query(`
            SELECT id, titre, prix, duree_heures, gratuit
            FROM formations 
            WHERE actif = true
            ORDER BY titre
        `, {
            type: QueryTypes.SELECT
        });

        res.render('entreprises/edit-quote', {
            title: `Modifier Devis ${quoteDetails.numero_devis} - ADSIAM`,
            layout: 'layouts/company',
            quote: quoteDetails,
            formations
        });

    } catch (error) {
        console.error('Erreur modification devis:', error);
        req.flash('error', 'Erreur lors du chargement du devis à modifier.');
        res.redirect('/entreprise/facturation/devis');
    }
}

// Mise à jour d'un devis
static async updateQuote(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.session.user.societe_rattachee;
        const updateData = req.body;

        // Validation et mise à jour du devis en base
        console.log(`Mise à jour du devis ${id} pour l'entreprise ${companyId}:`, updateData);

        res.json({
            success: true,
            message: 'Devis mis à jour avec succès'
        });

    } catch (error) {
        console.error('Erreur mise à jour devis:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du devis'
        });
    }
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