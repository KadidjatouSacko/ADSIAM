// controllers/AdminController.js
import { Op } from 'sequelize';
import { 
    User, 
    Formation, 
    Inscription, 
    Module,  
    Message, 
    Notification,
    Evenement,
    Avis
} from '../models/index.js';
import Progression_Module from '../models/ProgressionModule.js';
import PDFDocument from 'pdfkit';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs/promises';

export class AdminController {
    
    // ====================== TABLEAU DE BORD ======================
    async dashboard(req, res) {
        try {
            const stats = await this.getDashboardStatsData();
            
            res.render('admin/dashboard', {
                title: 'Tableau de bord - Administration ADSIAM',
                admin: req.admin,
                stats,
                currentPage: 'dashboard'
            });
        } catch (error) {
            console.error('Erreur dashboard admin:', error);
            res.status(500).render('errors/500', { error });
        }
    }

    async getDashboardStatsData() {
        const [
            totalUsers,
            activeUsers,
            totalFormations,
            activeFormations,
            totalInscriptions,
            pendingInscriptions,
            recentUsers,
            recentInscriptions,
            topFormations,
            monthlyStats
        ] = await Promise.all([
            User.count(),
            User.count({ where: { statut: 'actif' } }),
            Formation.count(),
            Formation.count({ where: { actif: true } }),
            Inscription.count(),
            Inscription.count({ where: { statut: 'en_attente' } }),
            User.findAll({ 
                order: [['createdAt', 'DESC']], 
                limit: 5,
                attributes: ['id', 'prenom', 'nom', 'email', 'createdAt', 'role']
            }),
            Inscription.findAll({
                include: [
                    { model: User, attributes: ['prenom', 'nom'] },
                    { model: Formation, attributes: ['titre'] }
                ],
                order: [['createdAt', 'DESC']],
                limit: 5
            }),
            Formation.findAll({
                include: [{
                    model: Inscription,
                    attributes: []
                }],
                group: ['Formation.id'],
                order: [['inscriptions', 'DESC']],
                limit: 5,
                attributes: ['id', 'titre', 'icone'],
                raw: false
            }),
            this.getMonthlyStats()
        ]);

        return {
            totalUsers,
            activeUsers,
            totalFormations,
            activeFormations,
            totalInscriptions,
            pendingInscriptions,
            recentUsers,
            recentInscriptions,
            topFormations,
            monthlyStats,
            userGrowthRate: await this.calculateGrowthRate('users'),
            inscriptionGrowthRate: await this.calculateGrowthRate('inscriptions')
        };
    }

    async getMonthlyStats() {
        // Statistiques des 12 derniers mois
        const months = [];
        const now = new Date();
        
        for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            
            const [newUsers, newInscriptions] = await Promise.all([
                User.count({
                    where: {
                        createdAt: {
                            [Op.gte]: date,
                            [Op.lt]: nextMonth
                        }
                    }
                }),
                Inscription.count({
                    where: {
                        createdAt: {
                            [Op.gte]: date,
                            [Op.lt]: nextMonth
                        }
                    }
                })
            ]);

            months.push({
                month: date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
                users: newUsers,
                inscriptions: newInscriptions
            });
        }

        return months;
    }

    async calculateGrowthRate(type) {
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const model = type === 'users' ? User : Inscription;
        
        const [lastMonthCount, currentMonthCount] = await Promise.all([
            model.count({
                where: {
                    createdAt: {
                        [Op.gte]: lastMonth,
                        [Op.lt]: currentMonth
                    }
                }
            }),
            model.count({
                where: {
                    createdAt: {
                        [Op.gte]: currentMonth
                    }
                }
            })
        ]);

        if (lastMonthCount === 0) return currentMonthCount > 0 ? 100 : 0;
        return Math.round(((currentMonthCount - lastMonthCount) / lastMonthCount) * 100);
    }

    // ====================== GESTION DES UTILISATEURS ======================
    async getUsers(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const search = req.query.search || '';
            const role = req.query.role || '';
            const statut = req.query.statut || '';
            
            const where = {};
            
            if (search) {
                where[Op.or] = [
                    { prenom: { [Op.iLike]: `%${search}%` } },
                    { nom: { [Op.iLike]: `%${search}%` } },
                    { email: { [Op.iLike]: `%${search}%` } }
                ];
            }
            
            if (role) where.role = role;
            if (statut) where.statut = statut;

            const { rows: users, count } = await User.findAndCountAll({
                where,
                order: [['createdAt', 'DESC']],
                limit,
                offset: (page - 1) * limit,
                include: [{
                    model: Inscription,
                    attributes: ['id', 'statut'],
                    required: false
                }]
            });

            const totalPages = Math.ceil(count / limit);

            res.render('admin/users/list', {
                title: 'Gestion des utilisateurs - ADSIAM Admin',
                admin: req.admin,
                users,
                pagination: {
                    currentPage: page,
                    totalPages,
                    total: count,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                },
                filters: { search, role, statut },
                currentPage: 'users'
            });
        } catch (error) {
            console.error('Erreur getUsers:', error);
            res.status(500).render('errors/500', { error });
        }
    }

    async createUserForm(req, res) {
        try {
            res.render('admin/users/create', {
                title: 'Créer un utilisateur - ADSIAM Admin',
                admin: req.admin,
                currentPage: 'users'
            });
        } catch (error) {
            console.error('Erreur createUserForm:', error);
            res.status(500).render('errors/500', { error });
        }
    }

    async createUser(req, res) {
        try {
            const {
                prenom,
                nom,
                email,
                telephone,
                role,
                type_utilisateur,
                mot_de_passe,
                etablissement,
                ville,
                experience
            } = req.body;

            // Vérifier si l'email existe déjà
            const existingUser = await User.findOne({ where: { email } });
            if (existingUser) {
                return res.status(400).render('admin/users/create', {
                    title: 'Créer un utilisateur - ADSIAM Admin',
                    admin: req.admin,
                    error: 'Cet email est déjà utilisé',
                    formData: req.body,
                    currentPage: 'users'
                });
            }

            const newUser = await User.create({
                prenom,
                nom,
                email,
                telephone,
                role,
                type_utilisateur,
                mot_de_passe, // Note: Hashage du mot de passe à implémenter
                statut: 'actif',
                etablissement,
                ville,
                experience,
                email_verifie_le: new Date()
            });

            req.session.flash = {
                type: 'success',
                message: `Utilisateur ${prenom} ${nom} créé avec succès`
            };

            res.redirect('/admin/utilisateurs');
        } catch (error) {
            console.error('Erreur createUser:', error);
            res.status(500).render('admin/users/create', {
                title: 'Créer un utilisateur - ADSIAM Admin',
                admin: req.admin,
                error: 'Erreur lors de la création de l\'utilisateur',
                formData: req.body,
                currentPage: 'users'
            });
        }
    }

    async editUserForm(req, res) {
        try {
            const { id } = req.params;
            const user = await User.findByPk(id, {
                include: [{
                    model: Inscription,
                    include: [{ model: Formation, attributes: ['titre'] }]
                }]
            });

            if (!user) {
                return res.status(404).render('errors/404', {
                    message: 'Utilisateur non trouvé'
                });
            }

            res.render('admin/users/edit', {
                title: `Modifier ${user.prenom} ${user.nom} - ADSIAM Admin`,
                admin: req.admin,
                user,
                currentPage: 'users'
            });
        } catch (error) {
            console.error('Erreur editUserForm:', error);
            res.status(500).render('errors/500', { error });
        }
    }

    async updateUser(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // Supprimer les champs sensibles si pas autorisé
            delete updateData.mot_de_passe;

            const [updatedRows] = await User.update(updateData, {
                where: { id }
            });

            if (updatedRows === 0) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }

            req.session.flash = {
                type: 'success',
                message: 'Utilisateur mis à jour avec succès'
            };

            res.redirect('/admin/utilisateurs');
        } catch (error) {
            console.error('Erreur updateUser:', error);
            res.status(500).json({ error: 'Erreur lors de la mise à jour' });
        }
    }

    async deleteUser(req, res) {
        try {
            const { id } = req.params;
            
            const deleted = await User.destroy({
                where: { id }
            });

            if (deleted === 0) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }

            res.json({ success: true, message: 'Utilisateur supprimé avec succès' });
        } catch (error) {
            console.error('Erreur deleteUser:', error);
            res.status(500).json({ error: 'Erreur lors de la suppression' });
        }
    }

    // ====================== GESTION DES FORMATIONS ======================
    async getFormations(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const search = req.query.search || '';
            const domaine = req.query.domaine || '';
            const niveau = req.query.niveau || '';
            
            const where = {};
            
            if (search) {
                where[Op.or] = [
                    { titre: { [Op.iLike]: `%${search}%` } },
                    { description: { [Op.iLike]: `%${search}%` } }
                ];
            }
            
            if (domaine) where.domaine = domaine;
            if (niveau) where.niveau = niveau;

            const { rows: formations, count } = await Formation.findAndCountAll({
                where,
                order: [['createdAt', 'DESC']],
                limit,
                offset: (page - 1) * limit,
                include: [
                    {
                        model: Module,
                        attributes: ['id', 'titre']
                    },
                    {
                        model: Inscription,
                        attributes: ['id', 'statut']
                    }
                ]
            });

            const totalPages = Math.ceil(count / limit);

            res.render('admin/formations/list', {
                title: 'Gestion des formations - ADSIAM Admin',
                admin: req.admin,
                formations,
                pagination: {
                    currentPage: page,
                    totalPages,
                    total: count,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                },
                filters: { search, domaine, niveau },
                currentPage: 'formations'
            });
        } catch (error) {
            console.error('Erreur getFormations:', error);
            res.status(500).render('errors/500', { error });
        }
    }

    async createFormationForm(req, res) {
        try {
            res.render('admin/formations/create', {
                title: 'Créer une formation - ADSIAM Admin',
                admin: req.admin,
                currentPage: 'formations'
            });
        } catch (error) {
            console.error('Erreur createFormationForm:', error);
            res.status(500).render('errors/500', { error });
        }
    }

    async createFormation(req, res) {
        try {
            const formationData = {
                ...req.body,
                prix: parseFloat(req.body.prix) || 0,
                prix_original: parseFloat(req.body.prix_original) || null,
                duree_heures: parseInt(req.body.duree_heures) || 0,
                nombre_modules: parseInt(req.body.nombre_modules) || 0,
                gratuit: req.body.gratuit === 'true',
                populaire: req.body.populaire === 'true',
                nouveau: req.body.nouveau === 'true',
                certifiant: req.body.certifiant === 'true',
                actif: req.body.actif === 'true'
            };

            const newFormation = await Formation.create(formationData);

            req.session.flash = {
                type: 'success',
                message: `Formation "${newFormation.titre}" créée avec succès`
            };

            res.redirect('/admin/formations');
        } catch (error) {
            console.error('Erreur createFormation:', error);
            res.status(500).render('admin/formations/create', {
                title: 'Créer une formation - ADSIAM Admin',
                admin: req.admin,
                error: 'Erreur lors de la création de la formation',
                formData: req.body,
                currentPage: 'formations'
            });
        }
    }

    // ====================== GESTION DES INSCRIPTIONS ======================
    async getInscriptions(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const statut = req.query.statut || '';
            
            const where = {};
            if (statut) where.statut = statut;

            const { rows: inscriptions, count } = await Inscription.findAndCountAll({
                where,
                order: [['createdAt', 'DESC']],
                limit,
                offset: (page - 1) * limit,
                include: [
                    {
                        model: User,
                        attributes: ['id', 'prenom', 'nom', 'email']
                    },
                    {
                        model: Formation,
                        attributes: ['id', 'titre', 'icone', 'prix']
                    }
                ]
            });

            const totalPages = Math.ceil(count / limit);

            res.render('admin/inscriptions/list', {
                title: 'Gestion des inscriptions - ADSIAM Admin',
                admin: req.admin,
                inscriptions,
                pagination: {
                    currentPage: page,
                    totalPages,
                    total: count,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                },
                filters: { statut },
                currentPage: 'inscriptions'
            });
        } catch (error) {
            console.error('Erreur getInscriptions:', error);
            res.status(500).render('errors/500', { error });
        }
    }

    async validateInscription(req, res) {
        try {
            const { id } = req.params;
            
            const [updatedRows] = await Inscription.update(
                { statut: 'active' },
                { where: { id } }
            );

            if (updatedRows === 0) {
                return res.status(404).json({ error: 'Inscription non trouvée' });
            }

            // Créer une notification pour l'utilisateur
            const inscription = await Inscription.findByPk(id, {
                include: [{ model: Formation, attributes: ['titre'] }]
            });

            await Notification.create({
                user_id: inscription.user_id,
                titre: 'Inscription validée',
                contenu: `Votre inscription à la formation "${inscription.Formation.titre}" a été validée.`,
                type_notification: 'inscription',
                lu: false
            });

            res.json({ success: true, message: 'Inscription validée avec succès' });
        } catch (error) {
            console.error('Erreur validateInscription:', error);
            res.status(500).json({ error: 'Erreur lors de la validation' });
        }
    }

    // ====================== RAPPORTS ET STATISTIQUES ======================
    async getReports(req, res) {
        try {
            const reportData = await this.generateReportData();
            
            res.render('admin/reports/dashboard', {
                title: 'Rapports et statistiques - ADSIAM Admin',
                admin: req.admin,
                reportData,
                currentPage: 'reports'
            });
        } catch (error) {
            console.error('Erreur getReports:', error);
            res.status(500).render('errors/500', { error });
        }
    }

    async generateReportData() {
        const [
            userStats,
            formationStats,
            inscriptionStats,
            progressionStats
        ] = await Promise.all([
            this.getUserStats(),
            this.getFormationStats(),
            this.getInscriptionStats(),
            this.getProgressionStats()
        ]);

        return {
            userStats,
            formationStats,
            inscriptionStats,
            progressionStats
        };
    }

    async getUserStats() {
        const total = await User.count();
        const byRole = await User.findAll({
            attributes: ['role', [User.sequelize.fn('COUNT', User.sequelize.col('role')), 'count']],
            group: ['role'],
            raw: true
        });
        
        const active = await User.count({ where: { statut: 'actif' } });
        
        return { total, byRole, active };
    }

    async getFormationStats() {
        const total = await Formation.count();
        const active = await Formation.count({ where: { actif: true } });
        const byDomain = await Formation.findAll({
            attributes: ['domaine', [Formation.sequelize.fn('COUNT', Formation.sequelize.col('domaine')), 'count']],
            group: ['domaine'],
            raw: true
        });
        
        return { total, active, byDomain };
    }

    // ====================== MESSAGERIE ======================
    async getMessaging(req, res) {
        try {
            const conversations = await Message.findAll({
                attributes: ['conversation_id', 'sujet'],
                group: ['conversation_id', 'sujet'],
                order: [['createdAt', 'DESC']],
                limit: 20,
                include: [{
                    model: User,
                    as: 'expediteur',
                    attributes: ['prenom', 'nom']
                }]
            });

            res.render('admin/messaging/dashboard', {
                title: 'Messagerie - ADSIAM Admin',
                admin: req.admin,
                conversations,
                currentPage: 'messaging'
            });
        } catch (error) {
            console.error('Erreur getMessaging:', error);
            res.status(500).render('errors/500', { error });
        }
    }

    // ====================== PARAMÈTRES ======================
    async getSettings(req, res) {
        try {
            // Ici vous pourriez récupérer les paramètres depuis une table de configuration
            const settings = {
                organisme: {
                    nom: 'ADSIAM',
                    adresse: '123 Rue de la Formation, 75001 Paris',
                    telephone: '06 50 84 81 75',
                    email: 'contact@adsiam.fr',
                    siret: '12345678901234',
                    numeroDeclaration: 'OF123456789'
                },
                site: {
                    titre: 'ADSIAM - Formation Excellence',
                    description: 'Plateforme de formation pour professionnels de l\'aide à domicile',
                    logo: '/images/logo-adsiam.png',
                    couleurPrimaire: '#e7a6b7',
                    couleurSecondaire: '#a5bfd4'
                },
                notifications: {
                    emailInscription: true,
                    emailValidation: true,
                    emailRappel: true,
                    smsActivation: false
                }
            };

            res.render('admin/settings/dashboard', {
                title: 'Paramètres généraux - ADSIAM Admin',
                admin: req.admin,
                settings,
                currentPage: 'settings'
            });
        } catch (error) {
            console.error('Erreur getSettings:', error);
            res.status(500).render('errors/500', { error });
        }
    }

    async updateOrganismSettings(req, res) {
        try {
            // Ici vous mettriez à jour les paramètres en base
            const { nom, adresse, telephone, email, siret, numeroDeclaration } = req.body;
            
            // Simulation de mise à jour
            req.session.flash = {
                type: 'success',
                message: 'Paramètres de l\'organisme mis à jour avec succès'
            };

            res.redirect('/admin/parametres');
        } catch (error) {
            console.error('Erreur updateOrganismSettings:', error);
            res.status(500).json({ error: 'Erreur lors de la mise à jour' });
        }
    }

    // ====================== API ENDPOINTS ======================
    async getLiveStats(req, res) {
        try {
            const stats = await this.getDashboardStatsData();
            res.json(stats);
        } catch (error) {
            console.error('Erreur getLiveStats:', error);
            res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
        }
    }

    async searchUsersAPI(req, res) {
        try {
            const { q } = req.query;
            const users = await User.findAll({
                where: {
                    [Op.or]: [
                        { prenom: { [Op.iLike]: `%${q}%` } },
                        { nom: { [Op.iLike]: `%${q}%` } },
                        { email: { [Op.iLike]: `%${q}%` } }
                    ]
                },
                attributes: ['id', 'prenom', 'nom', 'email', 'role'],
                limit: 10
            });

            res.json(users);
        } catch (error) {
            console.error('Erreur searchUsersAPI:', error);
            res.status(500).json({ error: 'Erreur lors de la recherche' });
        }
    }

    async toggleUserStatus(req, res) {
        try {
            const { id } = req.params;
            const user = await User.findByPk(id);
            
            if (!user) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }

            const newStatus = user.statut === 'actif' ? 'inactif' : 'actif';
            await user.update({ statut: newStatus });

            res.json({ 
                success: true, 
                message: `Utilisateur ${newStatus === 'actif' ? 'activé' : 'désactivé'} avec succès`,
                newStatus 
            });
        } catch (error) {
            console.error('Erreur toggleUserStatus:', error);
            res.status(500).json({ error: 'Erreur lors du changement de statut' });
        }
    }

    async exportReport(req, res) {
        try {
            const { type } = req.params;
            const format = req.query.format || 'csv';

            switch (type) {
                case 'users':
                    await this.exportUsersReport(res, format);
                    break;
                case 'formations':
                    await this.exportFormationsReport(res, format);
                    break;
                case 'inscriptions':
                    await this.exportInscriptionsReport(res, format);
                    break;
                default:
                    res.status(400).json({ error: 'Type de rapport non supporté' });
            }
        } catch (error) {
            console.error('Erreur exportReport:', error);
            res.status(500).json({ error: 'Erreur lors de l\'export' });
        }
    }

    async exportUsersReport(res, format) {
        const users = await User.findAll({
            attributes: ['id', 'prenom', 'nom', 'email', 'role', 'statut', 'createdAt'],
            raw: true
        });

        if (format === 'csv') {
            const csvWriter = createObjectCsvWriter({
                path: '/tmp/users_report.csv',
                header: [
                    { id: 'id', title: 'ID' },
                    { id: 'prenom', title: 'Prénom' },
                    { id: 'nom', title: 'Nom' },
                    { id: 'email', title: 'Email' },
                    { id: 'role', title: 'Rôle' },
                    { id: 'statut', title: 'Statut' },
                    { id: 'createdAt', title: 'Date de création' }
                ]
            });

            await csvWriter.writeRecords(users);
            res.download('/tmp/users_report.csv', 'rapport_utilisateurs.csv');
        } else if (format === 'pdf') {
            await this.generateUsersPDF(res, users);
        }
    }

    async generateUsersPDF(res, users) {
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=rapport_utilisateurs.pdf');
        
        doc.pipe(res);
        
        // En-tête
        doc.fontSize(20).text('Rapport des Utilisateurs - ADSIAM', 50, 50);
        doc.fontSize(12).text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 50, 80);
        
        // Tableau des utilisateurs
        let y = 120;
        doc.fontSize(10);
        doc.text('ID', 50, y);
        doc.text('Nom complet', 100, y);
        doc.text('Email', 250, y);
        doc.text('Rôle', 400, y);
        doc.text('Statut', 480, y);
        
        y += 20;
        users.forEach(user => {
            doc.text(user.id.toString(), 50, y);
            doc.text(`${user.prenom} ${user.nom}`, 100, y);
            doc.text(user.email, 250, y);
            doc.text(user.role, 400, y);
            doc.text(user.statut, 480, y);
            y += 15;
            
            if (y > 750) {
                doc.addPage();
                y = 50;
            }
        });
        
        doc.end();
    }

    // ====================== GESTION DES ÉVÉNEMENTS ======================
    async getEvents(req, res) {
        try {
            const events = await Evenement.findAll({
                order: [['date_debut', 'DESC']],
                include: [
                    {
                        model: Formation,
                        attributes: ['titre'],
                        required: false
                    }
                ]
            });

            res.render('admin/events/list', {
                title: 'Gestion des événements - ADSIAM Admin',
                admin: req.admin,
                events,
                currentPage: 'events'
            });
        } catch (error) {
            console.error('Erreur getEvents:', error);
            res.status(500).render('errors/500', { error });
        }
    }

    async createEventForm(req, res) {
        try {
            const formations = await Formation.findAll({
                where: { actif: true },
                attributes: ['id', 'titre'],
                order: [['titre', 'ASC']]
            });

            res.render('admin/events/create', {
                title: 'Créer un événement - ADSIAM Admin',
                admin: req.admin,
                formations,
                currentPage: 'events'
            });
        } catch (error) {
            console.error('Erreur createEventForm:', error);
            res.status(500).render('errors/500', { error });
        }
    }

    async createEvent(req, res) {
        try {
            const eventData = {
                ...req.body,
                date_debut: new Date(req.body.date_debut),
                date_fin: new Date(req.body.date_fin),
                max_participants: parseInt(req.body.max_participants) || null,
                formation_id: req.body.formation_id || null
            };

            const newEvent = await Evenement.create(eventData);

            req.session.flash = {
                type: 'success',
                message: `Événement "${newEvent.titre}" créé avec succès`
            };

            res.redirect('/admin/evenements');
        } catch (error) {
            console.error('Erreur createEvent:', error);
            res.status(500).render('admin/events/create', {
                title: 'Créer un événement - ADSIAM Admin',
                admin: req.admin,
                error: 'Erreur lors de la création de l\'événement',
                formData: req.body,
                currentPage: 'events'
            });
        }
    }

    // ====================== MÉTHODES UTILITAIRES ======================
    async getInscriptionStats() {
        const total = await Inscription.count();
        const active = await Inscription.count({ where: { statut: 'active' } });
        const pending = await Inscription.count({ where: { statut: 'en_attente' } });
        const completed = await Inscription.count({ where: { statut: 'terminee' } });
        
        return { total, active, pending, completed };
    }

    async getProgressionStats() {
        const totalProgress = await Progression_Module.count();
        const completed = await Progression_Module.count({ where: { statut: 'termine' } });
        const inProgress = await Progression_Module.count({ where: { statut: 'en_cours' } });
        
        const completionRate = totalProgress > 0 ? Math.round((completed / totalProgress) * 100) : 0;
        
        return { totalProgress, completed, inProgress, completionRate };
    }

    async sendMessage(req, res) {
        try {
            const { receiver_id, sujet, contenu, type_message = 'admin' } = req.body;

            const message = await Message.create({
                expediteur_id: req.admin.id,
                destinataire_id: receiver_id,
                sujet,
                contenu,
                type_message,
                lu: false
            });

            // Créer aussi une notification
            await Notification.create({
                user_id: receiver_id,
                titre: `Nouveau message: ${sujet}`,
                contenu: contenu.substring(0, 100) + '...',
                type_notification: 'message',
                lien: `/messages/${message.id}`,
                lu: false
            });

            res.json({ success: true, message: 'Message envoyé avec succès' });
        } catch (error) {
            console.error('Erreur sendMessage:', error);
            res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
        }
    }

    async createNotification(req, res) {
        try {
            const { user_id, titre, contenu, type_notification, lien } = req.body;

            await Notification.create({
                user_id,
                titre,
                contenu,
                type_notification,
                lien,
                lu: false
            });

            res.json({ success: true, message: 'Notification créée avec succès' });
        } catch (error) {
            console.error('Erreur createNotification:', error);
            res.status(500).json({ error: 'Erreur lors de la création de la notification' });
        }
    }

    async bulkUserAction(req, res) {
        try {
            const { action, userIds } = req.body;

            switch (action) {
                case 'activate':
                    await User.update({ statut: 'actif' }, { where: { id: userIds } });
                    break;
                case 'deactivate':
                    await User.update({ statut: 'inactif' }, { where: { id: userIds } });
                    break;
                case 'delete':
                    await User.destroy({ where: { id: userIds } });
                    break;
                default:
                    return res.status(400).json({ error: 'Action non supportée' });
            }

            res.json({ 
                success: true, 
                message: `Action "${action}" appliquée à ${userIds.length} utilisateur(s)` 
            });
        } catch (error) {
            console.error('Erreur bulkUserAction:', error);
            res.status(500).json({ error: 'Erreur lors de l\'action groupée' });
        }
    }

    
}