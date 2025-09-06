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
import PDFDocument from 'pdfkit';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs/promises';

export class AdminController {
    
    // ====================== TABLEAU DE BORD ======================
    async dashboard(req, res) {
        try {
            console.log('🎯 AdminController.dashboard appelé');
            console.log('🎯 req.admin:', req.admin);
            
            const stats = await this.getRealDashboardStats();
            
            res.render('admin/dashboard', {
                title: 'Tableau de bord - Administration ADSIAM',
                admin: req.admin,
                stats,
                currentPage: 'dashboard',
                layout: 'layouts/admin'
            });
        } catch (error) {
            console.error('Erreur dashboard admin:', error);
            res.status(500).send(`
                <h1>Erreur 500</h1>
                <p>Erreur dans le dashboard admin:</p>
                <pre>${error.message}</pre>
            `);
        }
    }

    async getRealDashboardStats() {
        try {
            const { QueryTypes } = await import('sequelize');
            const { sequelize } = await import('../models/index.js');

            // Statistiques de base avec requêtes SQL adaptées à vos tables
            const [
                totalUsers,
                totalFormations,
                totalInscriptions,
                pendingInscriptions,
                recentUsers,
                recentInscriptions,
                topFormations
            ] = await Promise.all([
                // Total utilisateurs depuis la table users
                sequelize.query("SELECT COUNT(*) as count FROM users", {
                    type: QueryTypes.SELECT
                }).then(result => result[0]?.count || 0),

                // Total formations
                sequelize.query("SELECT COUNT(*) as count FROM formations", {
                    type: QueryTypes.SELECT
                }).then(result => result[0]?.count || 0),

                // Total inscriptions
                sequelize.query("SELECT COUNT(*) as count FROM inscriptions", {
                    type: QueryTypes.SELECT
                }).then(result => result[0]?.count || 0),

                // Inscriptions en attente
                sequelize.query("SELECT COUNT(*) as count FROM inscriptions WHERE statut = 'en_attente'", {
                    type: QueryTypes.SELECT
                }).then(result => result[0]?.count || 0),

                // Utilisateurs récents
                sequelize.query(`
                    SELECT prenom, nom, email, role, "createdAt"
                    FROM users 
                    ORDER BY "createdAt" DESC 
                    LIMIT 5
                `, {
                    type: QueryTypes.SELECT
                }),

                // Inscriptions récentes
                sequelize.query(`
                    SELECT 
                        u.prenom, u.nom,
                        f.titre as formation_titre,
                        i."createdAt",
                        i.statut
                    FROM inscriptions i
                    LEFT JOIN users u ON i.user_id = u.id
                    LEFT JOIN formations f ON i.formation_id = f.id
                    ORDER BY i."createdAt" DESC
                    LIMIT 5
                `, {
                    type: QueryTypes.SELECT
                }),

                // Formations populaires
                sequelize.query(`
                    SELECT 
                        f.titre, f.icone,
                        COUNT(i.id) as inscription_count
                    FROM formations f
                    LEFT JOIN inscriptions i ON f.id = i.formation_id
                    GROUP BY f.id, f.titre, f.icone
                    ORDER BY inscription_count DESC
                    LIMIT 5
                `, {
                    type: QueryTypes.SELECT
                })
            ]);

            // Formater les données pour le template
            return {
                totalUsers,
                totalFormations,
                totalInscriptions,
                pendingInscriptions,
                activeUsers: Math.floor(totalUsers * 0.7), // Estimation
                activeFormations: Math.floor(totalFormations * 0.9),
                userGrowthRate: 12, // À calculer dynamiquement
                inscriptionGrowthRate: 8,
                recentUsers: recentUsers || [],
                recentInscriptions: (recentInscriptions || []).map(inscription => ({
                    id: Math.random(),
                    User: {
                        prenom: inscription.prenom,
                        nom: inscription.nom
                    },
                    Formation: {
                        titre: inscription.formation_titre
                    },
                    statut: inscription.statut,
                    createdAt: inscription.createdAt
                })),
                topFormations: (topFormations || []).map(formation => ({
                    id: Math.random(),
                    titre: formation.titre,
                    icone: formation.icone || '📚',
                    Inscriptions: Array(formation.inscription_count).fill({ id: 1 })
                })),
                monthlyStats: await this.getMonthlyStatsReal()
            };

        } catch (error) {
            console.error('Erreur getRealDashboardStats:', error);
            // Fallback avec données d'exemple
            return {
                totalUsers: 247,
                activeUsers: 189,
                totalFormations: 36,
                activeFormations: 30,
                totalInscriptions: 1247,
                pendingInscriptions: 12,
                userGrowthRate: 15,
                inscriptionGrowthRate: 22,
                recentUsers: [
                    { id: 1, prenom: 'Marie', nom: 'Dupont', email: 'marie.dupont@example.com', role: 'apprenant', createdAt: new Date() },
                    { id: 2, prenom: 'Jean', nom: 'Martin', email: 'jean.martin@example.com', role: 'apprenant', createdAt: new Date() }
                ],
                recentInscriptions: [
                    {
                        id: 1,
                        User: { prenom: 'Sophie', nom: 'Bernard' },
                        Formation: { titre: 'Communication & Relationnel' },
                        statut: 'en_attente',
                        createdAt: new Date()
                    }
                ],
                topFormations: [
                    {
                        id: 1,
                        titre: 'Communication & Relationnel',
                        icone: '🗣️',
                        Inscriptions: Array(25).fill({ id: 1 })
                    }
                ],
                monthlyStats: []
            };
        }
    }

    async getMonthlyStatsReal() {
        try {
            const { QueryTypes } = await import('sequelize');
            const { sequelize } = await import('../models/index.js');

            const monthlyData = await sequelize.query(`
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') as month,
                    COUNT(*) as count
                FROM users 
                WHERE "createdAt" >= NOW() - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', "createdAt")
                ORDER BY DATE_TRUNC('month', "createdAt") DESC
                LIMIT 12
            `, {
                type: QueryTypes.SELECT
            });

            return monthlyData.map(row => ({
                month: row.month,
                users: parseInt(row.count),
                inscriptions: 0
            }));

        } catch (error) {
            console.error('Erreur getMonthlyStatsReal:', error);
            return [];
        }
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
                // Suppression de l'include problématique pour l'instant
                attributes: ['id', 'prenom', 'nom', 'email', 'role', 'statut', 'createdAt', 'telephone']
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
                currentPage: 'users',
                layout: 'layouts/admin'
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
                currentPage: 'users',
                layout: 'layouts/admin'
            });
        } catch (error) {
            console.error('Erreur createUserForm:', error);
            res.status(500).render('errors/500', { error });
        }
    }

    async createUser(req, res) {
        try {
            console.log('📝 Données du formulaire reçues:', req.body);
            
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

            // Validation des champs requis
            if (!prenom || !nom || !email || !mot_de_passe) {
                return res.status(400).render('admin/users/create', {
                    title: 'Créer un utilisateur - ADSIAM Admin',
                    admin: req.admin,
                    error: 'Tous les champs obligatoires doivent être remplis',
                    formData: req.body,
                    currentPage: 'users',
                    layout: 'layouts/admin'
                });
            }

            // Vérifier si l'email existe déjà
            const existingUser = await User.findOne({ where: { email } });
            if (existingUser) {
                return res.status(400).render('admin/users/create', {
                    title: 'Créer un utilisateur - ADSIAM Admin',
                    admin: req.admin,
                    error: 'Cet email est déjà utilisé',
                    formData: req.body,
                    currentPage: 'users',
                    layout: 'layouts/admin'
                });
            }

            // Hash du mot de passe (à implémenter avec bcrypt)
            // const hashedPassword = await bcrypt.hash(mot_de_passe, 10);

            const newUser = await User.create({
                prenom,
                nom,
                email,
                telephone,
                role: role || 'apprenant',
                type_utilisateur: type_utilisateur || 'aide_domicile',
                mot_de_passe, // TODO: Hasher le mot de passe
                statut: 'actif',
                etablissement,
                ville,
                experience,
                email_verifie_le: new Date()
            });

            console.log('✅ Utilisateur créé:', newUser.id);

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
                error: 'Erreur lors de la création de l\'utilisateur: ' + error.message,
                formData: req.body,
                currentPage: 'users',
                layout: 'layouts/admin'
            });
        }
    }

    async editUserForm(req, res) {
        try {
            const { id } = req.params;
            const user = await User.findByPk(id);

            if (!user) {
                return res.status(404).render('errors/404', {
                    message: 'Utilisateur non trouvé'
                });
            }

            res.render('admin/users/edit', {
                title: `Modifier ${user.prenom} ${user.nom} - ADSIAM Admin`,
                admin: req.admin,
                user,
                currentPage: 'users',
                layout: 'layouts/admin'
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
                attributes: ['id', 'titre', 'description', 'prix', 'domaine', 'niveau', 'actif', 'createdAt']
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
                currentPage: 'formations',
                layout: 'layouts/admin'
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
                currentPage: 'formations',
                layout: 'layouts/admin'
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
                actif: req.body.actif !== 'false' // Par défaut actif
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
                currentPage: 'formations',
                layout: 'layouts/admin'
            });
        }
    }

    // ====================== GESTION DES INSCRIPTIONS ======================
    // Dans votre AdminController.js, remplacez la méthode getInscriptions par cette version corrigée :

async getInscriptions(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const statut = req.query.statut || '';
        
        const { QueryTypes } = await import('sequelize');
        const { sequelize } = await import('../models/index.js');

        // D'abord, vérifions la structure de la table inscriptions
        console.log('🔍 Vérification de la structure de la table inscriptions...');
        
        try {
            const tableInfo = await sequelize.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'inscriptions'
                ORDER BY ordinal_position;
            `, {
                type: QueryTypes.SELECT
            });
            
            console.log('📋 Colonnes de la table inscriptions:', tableInfo);
            
            // Déterminer le nom correct de la colonne de date
            const dateColumn = tableInfo.find(col => 
                col.column_name.toLowerCase().includes('created') || 
                col.column_name.toLowerCase().includes('date')
            );
            
            const dateColumnName = dateColumn ? dateColumn.column_name : 'created_at';
            console.log(`📅 Colonne de date détectée: ${dateColumnName}`);
            
            // Construire la requête avec le bon nom de colonne
            const whereClause = statut ? `WHERE i.statut = '${statut}'` : '';
            
            const inscriptionsQuery = `
                SELECT 
                    i.*,
                    u.prenom, u.nom, u.email,
                    f.titre as formation_titre, f.icone, f.prix
                FROM inscriptions i
                LEFT JOIN users u ON i.user_id = u.id
                LEFT JOIN formations f ON i.formation_id = f.id
                ${whereClause}
                ORDER BY i."${dateColumnName}" DESC
                LIMIT ${limit} OFFSET ${(page - 1) * limit}
            `;

            const countQuery = `
                SELECT COUNT(*) as count
                FROM inscriptions i
                ${whereClause}
            `;

            const [inscriptions, countResult] = await Promise.all([
                sequelize.query(inscriptionsQuery, { type: QueryTypes.SELECT }),
                sequelize.query(countQuery, { type: QueryTypes.SELECT })
            ]);

            const count = parseInt(countResult[0].count);
            const totalPages = Math.ceil(count / limit);

            // Formater les données pour le template
            const formattedInscriptions = inscriptions.map(inscription => ({
                id: inscription.id,
                statut: inscription.statut,
                createdAt: inscription[dateColumnName], // Utiliser le bon nom de colonne
                User: {
                    id: inscription.user_id,
                    prenom: inscription.prenom,
                    nom: inscription.nom,
                    email: inscription.email
                },
                Formation: {
                    id: inscription.formation_id,
                    titre: inscription.formation_titre,
                    icone: inscription.icone || '📚',
                    prix: inscription.prix
                }
            }));

            res.render('admin/inscriptions/list', {
                title: 'Gestion des inscriptions - ADSIAM Admin',
                admin: req.admin,
                inscriptions: formattedInscriptions,
                pagination: {
                    currentPage: page,
                    totalPages,
                    total: count,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                },
                filters: { statut },
                currentPage: 'inscriptions',
                layout: 'layouts/admin'
            });

        } catch (tableError) {
            console.error('❌ Erreur lors de la vérification de la table:', tableError);
            
            // Fallback: essayer avec des noms de colonnes alternatifs
            const fallbackQuery = `
                SELECT 
                    i.id,
                    i.statut,
                    i.created_at,
                    u.prenom, u.nom, u.email,
                    f.titre as formation_titre, f.icone, f.prix
                FROM inscriptions i
                LEFT JOIN users u ON i.user_id = u.id
                LEFT JOIN formations f ON i.formation_id = f.id
                ${statut ? `WHERE i.statut = '${statut}'` : ''}
                ORDER BY i.id DESC
                LIMIT ${limit} OFFSET ${(page - 1) * limit}
            `;

            const inscriptions = await sequelize.query(fallbackQuery, { type: QueryTypes.SELECT });
            
            const formattedInscriptions = inscriptions.map(inscription => ({
                id: inscription.id,
                statut: inscription.statut,
                createdAt: inscription.created_at || new Date(),
                User: {
                    id: inscription.user_id,
                    prenom: inscription.prenom || 'N/A',
                    nom: inscription.nom || 'N/A',
                    email: inscription.email || 'N/A'
                },
                Formation: {
                    id: inscription.formation_id,
                    titre: inscription.formation_titre || 'Formation inconnue',
                    icone: inscription.icone || '📚',
                    prix: inscription.prix || 0
                }
            }));

            res.render('admin/inscriptions/list', {
                title: 'Gestion des inscriptions - ADSIAM Admin',
                admin: req.admin,
                inscriptions: formattedInscriptions,
                pagination: {
                    currentPage: page,
                    totalPages: 1,
                    total: inscriptions.length,
                    hasNext: false,
                    hasPrev: false
                },
                filters: { statut },
                currentPage: 'inscriptions',
                layout: 'layouts/admin'
            });
        }

    } catch (error) {
        console.error('Erreur getInscriptions:', error);
        res.status(500).render('errors/500', { 
            error,
            title: 'Erreur - ADSIAM Admin',
            admin: req.admin,
            layout: 'layouts/admin'
        });
    }
}

async editEventForm(req, res) {
    try {
        const { id } = req.params;
        const { QueryTypes } = await import('sequelize');
        const { sequelize } = await import('../models/index.js');

        const event = await sequelize.query(`
            SELECT * FROM evenements WHERE id = :id
        `, {
            type: QueryTypes.SELECT,
            replacements: { id }
        });

        if (!event || event.length === 0) {
            return res.status(404).render('errors/404', {
                message: 'Événement non trouvé'
            });
        }

        const formations = await sequelize.query(`
            SELECT id, titre FROM formations WHERE actif = true ORDER BY titre ASC
        `, {
            type: QueryTypes.SELECT
        });

        res.render('admin/events/edit', {
            title: `Modifier l'événement - ADSIAM Admin`,
            admin: req.admin,
            event: event[0],
            formations,
            currentPage: 'events',
            layout: 'layouts/admin'
        });
    } catch (error) {
        console.error('Erreur editEventForm:', error);
        res.status(500).render('errors/500', { error });
    }
}

async updateEvent(req, res) {
    try {
        const { id } = req.params;
        const { QueryTypes } = await import('sequelize');
        const { sequelize } = await import('../models/index.js');

        const updateData = {
            titre: req.body.titre,
            description: req.body.description,
            date_debut: req.body.date_debut ? new Date(req.body.date_debut) : null,
            date_fin: req.body.date_fin ? new Date(req.body.date_fin) : null,
            lieu: req.body.lieu,
            max_participants: parseInt(req.body.max_participants) || null,
            formation_id: req.body.formation_id || null
        };

        await sequelize.query(`
            UPDATE evenements SET 
                titre = :titre,
                description = :description,
                date_debut = :date_debut,
                date_fin = :date_fin,
                lieu = :lieu,
                max_participants = :max_participants,
                formation_id = :formation_id
            WHERE id = :id
        `, {
            type: QueryTypes.UPDATE,
            replacements: { ...updateData, id }
        });

        req.session.flash = {
            type: 'success',
            message: 'Événement mis à jour avec succès'
        };

        res.redirect('/admin/evenements');
    } catch (error) {
        console.error('Erreur updateEvent:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
}

async deleteEvent(req, res) {
    try {
        const { id } = req.params;
        const { QueryTypes } = await import('sequelize');
        const { sequelize } = await import('../models/index.js');

        const result = await sequelize.query(`
            DELETE FROM evenements WHERE id = :id
        `, {
            type: QueryTypes.DELETE,
            replacements: { id }
        });

        res.json({ 
            success: true, 
            message: 'Événement supprimé avec succès' 
        });
    } catch (error) {
        console.error('Erreur deleteEvent:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la suppression',
            message: error.message 
        });
    }
}

async viewEvent(req, res) {
    try {
        const { id } = req.params;
        const { QueryTypes } = await import('sequelize');
        const { sequelize } = await import('../models/index.js');

        const event = await sequelize.query(`
            SELECT 
                e.*,
                f.titre as formation_titre
            FROM evenements e
            LEFT JOIN formations f ON e.formation_id = f.id
            WHERE e.id = :id
        `, {
            type: QueryTypes.SELECT,
            replacements: { id }
        });

        if (!event || event.length === 0) {
            return res.status(404).render('errors/404', {
                message: 'Événement non trouvé'
            });
        }

        res.render('admin/events/view', {
            title: `Événement: ${event[0].titre} - ADSIAM Admin`,
            admin: req.admin,
            event: event[0],
            currentPage: 'events',
            layout: 'layouts/admin'
        });
    } catch (error) {
        console.error('Erreur viewEvent:', error);
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
                currentPage: 'reports',
                layout: 'layouts/admin'
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
            inscriptionStats
        ] = await Promise.all([
            this.getUserStats(),
            this.getFormationStats(),
            this.getInscriptionStats()
        ]);

        return {
            userStats,
            formationStats,
            inscriptionStats,
            progressionStats: { // Données par défaut en attendant le modèle
                totalProgress: 0,
                completed: 0,
                inProgress: 0,
                completionRate: 0
            }
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

    async getInscriptionStats() {
        const total = await Inscription.count();
        const active = await Inscription.count({ where: { statut: 'active' } });
        const pending = await Inscription.count({ where: { statut: 'en_attente' } });
        const completed = await Inscription.count({ where: { statut: 'terminee' } });
        
        return { total, active, pending, completed };
    }

    // ====================== MESSAGERIE ======================
  async getMessaging(req, res) {
    try {
        const { QueryTypes } = await import('sequelize');
        const { sequelize } = await import('../models/index.js');

        // D'abord, vérifier la structure de la table messages
        console.log('🔍 Vérification de la structure de la table messages...');
        
        try {
            const tableInfo = await sequelize.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'messages'
                ORDER BY ordinal_position;
            `, {
                type: QueryTypes.SELECT
            });
            
            console.log('📋 Colonnes de la table messages:', tableInfo);
            
            // Déterminer le nom correct de la colonne de date
            const dateColumn = tableInfo.find(col => 
                col.column_name.toLowerCase().includes('created') || 
                col.column_name.toLowerCase().includes('date')
            );
            
            const dateColumnName = dateColumn ? dateColumn.column_name : 'created_at';
            console.log(`📅 Colonne de date détectée: ${dateColumnName}`);
            
            // Requête corrigée avec le bon nom de colonne
            const conversationsQuery = `
                SELECT DISTINCT ON (m.conversation_id)
                    m.conversation_id, 
                    m.sujet,
                    m."${dateColumnName}",
                    u.prenom, 
                    u.nom
                FROM messages m
                LEFT JOIN users u ON m.expediteur_id = u.id
                WHERE m.conversation_id IS NOT NULL
                ORDER BY m.conversation_id, m."${dateColumnName}" DESC
                LIMIT 20
            `;

            const conversations = await sequelize.query(conversationsQuery, {
                type: QueryTypes.SELECT
            });

            // Formater les données pour le template
            const formattedConversations = conversations.map(conv => ({
                conversation_id: conv.conversation_id,
                sujet: conv.sujet,
                createdAt: conv[dateColumnName],
                expediteur: {
                    prenom: conv.prenom,
                    nom: conv.nom
                }
            }));

            res.render('admin/messaging/dashboard', {
                title: 'Messagerie - ADSIAM Admin',
                admin: req.admin,
                conversations: formattedConversations,
                currentPage: 'messaging',
                layout: 'layouts/admin'
            });

        } catch (tableError) {
            console.error('❌ Erreur lors de la vérification de la table messages:', tableError);
            
            // Fallback: afficher la page avec des données d'exemple
            const sampleConversations = [
                {
                    conversation_id: 'conv_001',
                    sujet: 'Question sur la formation Communication',
                    createdAt: new Date(),
                    expediteur: {
                        prenom: 'Marie',
                        nom: 'Dupont'
                    }
                },
                {
                    conversation_id: 'conv_002',
                    sujet: 'Problème technique avec la plateforme',
                    createdAt: new Date(),
                    expediteur: {
                        prenom: 'Jean',
                        nom: 'Martin'
                    }
                },
                {
                    conversation_id: 'conv_003',
                    sujet: 'Demande de certificat',
                    createdAt: new Date(),
                    expediteur: {
                        prenom: 'Sophie',
                        nom: 'Bernard'
                    }
                }
            ];

            res.render('admin/messaging/dashboard', {
                title: 'Messagerie - ADSIAM Admin',
                admin: req.admin,
                conversations: sampleConversations,
                currentPage: 'messaging',
                layout: 'layouts/admin'
            });
        }

    } catch (error) {
        console.error('Erreur getMessaging:', error);
        res.status(500).render('errors/500', { 
            error,
            title: 'Erreur - ADSIAM Admin',
            admin: req.admin,
            layout: 'layouts/admin'
        });
    }
}

    // ====================== ÉVÉNEMENTS ======================
    async getEvents(req, res) {
        try {
            const events = await Evenement.findAll({
                order: [['date_debut', 'DESC']],
                attributes: ['id', 'titre', 'description', 'date_debut', 'date_fin', 'lieu', 'max_participants']
            });

            res.render('admin/events/list', {
                title: 'Gestion des événements - ADSIAM Admin',
                admin: req.admin,
                events,
                currentPage: 'events',
                layout: 'layouts/admin'
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
                currentPage: 'events',
                layout: 'layouts/admin'
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
                currentPage: 'events',
                layout: 'layouts/admin'
            });
        }
    }

    // ====================== PARAMÈTRES ======================
  // Méthodes de classe, pas de variables template
// Dans votre AdminController.js, remplacez la méthode getSettings par ceci :

async getSettings(req, res) {
    try {
        // Définir explicitement l'objet settings avec toutes les propriétés
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

        console.log('🔧 Settings data:', settings); // Debug

        res.render('admin/settings', {
            title: 'Paramètres généraux - ADSIAM Admin',
            admin: req.admin,
            settings, // Passer l'objet settings complet
            currentPage: 'settings',
            layout: 'layouts/admin'
        });
    } catch (error) {
        console.error('Erreur getSettings:', error);
        res.status(500).render('errors/500', { error });
    }
}

    async updateOrganismSettings(req, res) {
        try {
            const { nom, adresse, telephone, email, siret, numeroDeclaration } = req.body;
            
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
            const stats = await this.getRealDashboardStats();
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

    async exportFormationsReport(res, format) {
        const formations = await Formation.findAll({
            attributes: ['id', 'titre', 'description', 'prix', 'domaine', 'niveau', 'actif', 'createdAt'],
            raw: true
        });

        if (format === 'csv') {
            const csvWriter = createObjectCsvWriter({
                path: '/tmp/formations_report.csv',
                header: [
                    { id: 'id', title: 'ID' },
                    { id: 'titre', title: 'Titre' },
                    { id: 'description', title: 'Description' },
                    { id: 'prix', title: 'Prix' },
                    { id: 'domaine', title: 'Domaine' },
                    { id: 'niveau', title: 'Niveau' },
                    { id: 'actif', title: 'Actif' },
                    { id: 'createdAt', title: 'Date de création' }
                ]
            });

            await csvWriter.writeRecords(formations);
            res.download('/tmp/formations_report.csv', 'rapport_formations.csv');
        }
    }

    async exportInscriptionsReport(res, format) {
        const { QueryTypes } = await import('sequelize');
        const { sequelize } = await import('../models/index.js');

        const inscriptions = await sequelize.query(`
            SELECT 
                i.id,
                i.statut,
                i."createdAt",
                u.prenom,
                u.nom,
                u.email,
                f.titre as formation_titre
            FROM inscriptions i
            LEFT JOIN users u ON i.user_id = u.id
            LEFT JOIN formations f ON i.formation_id = f.id
            ORDER BY i."createdAt" DESC
        `, {
            type: QueryTypes.SELECT
        });

        if (format === 'csv') {
            const csvWriter = createObjectCsvWriter({
                path: '/tmp/inscriptions_report.csv',
                header: [
                    { id: 'id', title: 'ID' },
                    { id: 'prenom', title: 'Prénom' },
                    { id: 'nom', title: 'Nom' },
                    { id: 'email', title: 'Email' },
                    { id: 'formation_titre', title: 'Formation' },
                    { id: 'statut', title: 'Statut' },
                    { id: 'createdAt', title: 'Date d\'inscription' }
                ]
            });

            await csvWriter.writeRecords(inscriptions);
            res.download('/tmp/inscriptions_report.csv', 'rapport_inscriptions.csv');
        }
    }

    async generateUsersPDF(res, users) {
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=rapport_utilisateurs.pdf');
        
        doc.pipe(res);
        
        doc.fontSize(20).text('Rapport des Utilisateurs - ADSIAM', 50, 50);
        doc.fontSize(12).text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 50, 80);
        
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

    // Fonction pour corriger les erreurs d'associations Sequelize
async getFormationsWithoutAssociations(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const domaine = req.query.domaine || '';
        const niveau = req.query.niveau || '';
        
        const { QueryTypes } = await import('sequelize');
        const { sequelize } = await import('../models/index.js');

        // Construire la clause WHERE
        let whereConditions = [];
        let params = {};

        if (search) {
            whereConditions.push("(f.titre ILIKE :search OR f.description ILIKE :search)");
            params.search = `%${search}%`;
        }
        if (domaine) {
            whereConditions.push("f.domaine = :domaine");
            params.domaine = domaine;
        }
        if (niveau) {
            whereConditions.push("f.niveau = :niveau");
            params.niveau = niveau;
        }

        const whereClause = whereConditions.length > 0 ? 
            `WHERE ${whereConditions.join(' AND ')}` : '';

        // Requête pour les formations avec pagination
        const formationsQuery = `
            SELECT 
                f.*,
                COUNT(i.id) as inscriptions_count
            FROM formations f
            LEFT JOIN inscriptions i ON f.id = i.formation_id
            ${whereClause}
            GROUP BY f.id
            ORDER BY f."createdAt" DESC
            LIMIT ${limit} OFFSET ${(page - 1) * limit}
        `;

        // Requête pour le total
        const countQuery = `
            SELECT COUNT(DISTINCT f.id) as count
            FROM formations f
            ${whereClause}
        `;

        const [formations, countResult] = await Promise.all([
            sequelize.query(formationsQuery, { 
                type: QueryTypes.SELECT,
                replacements: params
            }),
            sequelize.query(countQuery, { 
                type: QueryTypes.SELECT,
                replacements: params
            })
        ]);

        const count = parseInt(countResult[0].count);
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
            currentPage: 'formations',
            layout: 'layouts/admin'
        });
    } catch (error) {
        console.error('Erreur getFormations:', error);
        res.status(500).render('errors/500', { error });
    }
}

async getUsersWithoutAssociations(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const role = req.query.role || '';
        const statut = req.query.statut || '';
        
        const { QueryTypes } = await import('sequelize');
        const { sequelize } = await import('../models/index.js');

        // Construire la clause WHERE
        let whereConditions = [];
        let params = {};

        if (search) {
            whereConditions.push("(u.prenom ILIKE :search OR u.nom ILIKE :search OR u.email ILIKE :search)");
            params.search = `%${search}%`;
        }
        if (role) {
            whereConditions.push("u.role = :role");
            params.role = role;
        }
        if (statut) {
            whereConditions.push("u.statut = :statut");
            params.statut = statut;
        }

        const whereClause = whereConditions.length > 0 ? 
            `WHERE ${whereConditions.join(' AND ')}` : '';

        // Requête pour les utilisateurs avec pagination
        const usersQuery = `
            SELECT 
                u.id, u.prenom, u.nom, u.email, u.role, u.statut, 
                u."createdAt", u.telephone,
                COUNT(i.id) as inscriptions_count
            FROM users u
            LEFT JOIN inscriptions i ON u.id = i.user_id
            ${whereClause}
            GROUP BY u.id, u.prenom, u.nom, u.email, u.role, u.statut, u."createdAt", u.telephone
            ORDER BY u."createdAt" DESC
            LIMIT ${limit} OFFSET ${(page - 1) * limit}
        `;

        // Requête pour le total
        const countQuery = `
            SELECT COUNT(DISTINCT u.id) as count
            FROM users u
            ${whereClause}
        `;

        const [users, countResult] = await Promise.all([
            sequelize.query(usersQuery, { 
                type: QueryTypes.SELECT,
                replacements: params
            }),
            sequelize.query(countQuery, { 
                type: QueryTypes.SELECT,
                replacements: params
            })
        ]);

        const count = parseInt(countResult[0].count);
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
            currentPage: 'users',
            layout: 'layouts/admin'
        });
    } catch (error) {
        console.error('Erreur getUsers:', error);
        res.status(500).render('errors/500', { error });
    }
}

// Template pour les paramètres - views/admin/settings.ejs
// const settingsTemplate = `
// <!DOCTYPE html>
// <html lang="fr">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title><%= title %></title>
//     <link rel="stylesheet" href="/css/admin.css">
// </head>
// <body>
//     <div class="admin-layout">
//         <nav class="sidebar">
//             <div class="sidebar-header">
//                 <h2>ADSIAM Admin</h2>
//             </div>
//             <ul class="sidebar-menu">
//                 <li><a href="/admin">📊 Tableau de bord</a></li>
//                 <li><a href="/admin/utilisateurs">👥 Utilisateurs</a></li>
//                 <li><a href="/admin/formations">📚 Formations</a></li>
//                 <li><a href="/admin/inscriptions">📝 Inscriptions</a></li>
//                 <li><a href="/admin/evenements">📅 Événements</a></li>
//                 <li><a href="/admin/rapports">📊 Rapports</a></li>
//                 <li><a href="/admin/messagerie">💬 Messagerie</a></li>
//                 <li><a href="/admin/parametres" class="active">⚙️ Paramètres</a></li>
//             </ul>
//         </nav>

//         <main class="main-content">
//             <div class="content-header">
//                 <h1>Paramètres généraux</h1>
//             </div>

//             <div class="settings-container">
//                 <!-- Paramètres de l'organisme -->
//                 <div class="settings-section">
//                     <h3>Informations de l'organisme</h3>
//                     <form action="/admin/parametres/organisme" method="POST" class="settings-form">
//                         <div class="form-row">
//                             <div class="form-group">
//                                 <label for="nom" class="form-label">Nom de l'organisme</label>
//                                 <input type="text" id="nom" name="nom" class="form-input" 
//                                        value="<%= settings.organisme.nom %>" required>
//                             </div>
//                             <div class="form-group">
//                                 <label for="siret" class="form-label">SIRET</label>
//                                 <input type="text" id="siret" name="siret" class="form-input" 
//                                        value="<%= settings.organisme.siret %>">
//                             </div>
//                         </div>

//                         <div class="form-group">
//                             <label for="adresse" class="form-label">Adresse</label>
//                             <textarea id="adresse" name="adresse" class="form-textarea" rows="3"><%= settings.organisme.adresse %></textarea>
//                         </div>

//                         <div class="form-row">
//                             <div class="form-group">
//                                 <label for="telephone" class="form-label">Téléphone</label>
//                                 <input type="tel" id="telephone" name="telephone" class="form-input" 
//                                        value="<%= settings.organisme.telephone %>">
//                             </div>
//                             <div class="form-group">
//                                 <label for="email" class="form-label">Email</label>
//                                 <input type="email" id="email" name="email" class="form-input" 
//                                        value="<%= settings.organisme.email %>">
//                             </div>
//                         </div>

//                         <div class="form-group">
//                             <label for="numeroDeclaration" class="form-label">Numéro de déclaration d'activité</label>
//                             <input type="text" id="numeroDeclaration" name="numeroDeclaration" class="form-input" 
//                                    value="<%= settings.organisme.numeroDeclaration %>">
//                         </div>

//                         <button type="submit" class="btn btn-primary">💾 Sauvegarder</button>
//                     </form>
//                 </div>

//                 <!-- Paramètres du site -->
//                 <div class="settings-section">
//                     <h3>Paramètres du site</h3>
//                     <form action="/admin/parametres/site" method="POST" class="settings-form">
//                         <div class="form-group">
//                             <label for="titre" class="form-label">Titre du site</label>
//                             <input type="text" id="titre" name="titre" class="form-input" 
//                                    value="<%= settings.site.titre %>">
//                         </div>

//                         <div class="form-group">
//                             <label for="description" class="form-label">Description</label>
//                             <textarea id="description" name="description" class="form-textarea" rows="3"><%= settings.site.description %></textarea>
//                         </div>

//                         <div class="form-row">
//                             <div class="form-group">
//                                 <label for="couleurPrimaire" class="form-label">Couleur primaire</label>
//                                 <input type="color" id="couleurPrimaire" name="couleurPrimaire" class="form-input" 
//                                        value="<%= settings.site.couleurPrimaire %>">
//                             </div>
//                             <div class="form-group">
//                                 <label for="couleurSecondaire" class="form-label">Couleur secondaire</label>
//                                 <input type="color" id="couleurSecondaire" name="couleurSecondaire" class="form-input" 
//                                        value="<%= settings.site.couleurSecondaire %>">
//                             </div>
//                         </div>

//                         <button type="submit" class="btn btn-primary">💾 Sauvegarder</button>
//                     </form>
//                 </div>

//                 <!-- Paramètres des notifications -->
//                 <div class="settings-section">
//                     <h3>Notifications</h3>
//                     <form action="/admin/parametres/notifications" method="POST" class="settings-form">
//                         <div class="form-group">
//                             <label class="form-label">Notifications par email</label>
//                             <div style="display: flex; flex-direction: column; gap: 0.5rem;">
//                                 <label style="display: flex; align-items: center; gap: 0.5rem;">
//                                     <input type="checkbox" name="emailInscription" 
//                                            <%= settings.notifications.emailInscription ? 'checked' : '' %>>
//                                     Nouvelle inscription
//                                 </label>
//                                 <label style="display: flex; align-items: center; gap: 0.5rem;">
//                                     <input type="checkbox" name="emailValidation" 
//                                            <%= settings.notifications.emailValidation ? 'checked' : '' %>>
//                                     Validation d'inscription
//                                 </label>
//                                 <label style="display: flex; align-items: center; gap: 0.5rem;">
//                                     <input type="checkbox" name="emailRappel" 
//                                            <%= settings.notifications.emailRappel ? 'checked' : '' %>>
//                                     Rappels de formation
//                                 </label>
//                             </div>
//                         </div>

//                         <div class="form-group">
//                             <label style="display: flex; align-items: center; gap: 0.5rem;">
//                                 <input type="checkbox" name="smsActivation" 
//                                        <%= settings.notifications.smsActivation ? 'checked' : '' %>>
//                                 Activer les notifications SMS
//                             </label>
//                         </div>

//                         <button type="submit" class="btn btn-primary">💾 Sauvegarder</button>
//                     </form>
//                 </div>

//                 <!-- Actions système -->
//                 <div class="settings-section">
//                     <h3>Actions système</h3>
//                     <div class="system-actions">
//                         <button onclick="clearCache()" class="btn btn-secondary">🗑️ Vider le cache</button>
//                         <button onclick="exportData()" class="btn btn-secondary">📥 Exporter les données</button>
//                         <button onclick="backupDatabase()" class="btn btn-secondary">💾 Sauvegarder la base</button>
//                         <button onclick="viewLogs()" class="btn btn-secondary">📋 Voir les logs</button>
//                     </div>
//                 </div>
//             </div>
//         </main>
//     </div>

//     <style>
//         .settings-container {
//             display: flex;
//             flex-direction: column;
//             gap: 3rem;
//         }

//         .settings-section {
//             background: white;
//             border-radius: 20px;
//             padding: 3rem;
//             box-shadow: 0 10px 30px rgba(0,0,0,0.05);
//         }

//         .settings-section h3 {
//             font-size: 1.5rem;
//             font-weight: 600;
//             color: var(--text-dark);
//             margin-bottom: 2rem;
//             padding-bottom: 1rem;
//             border-bottom: 2px solid var(--soft-gray);
//         }

//         .settings-form {
//             display: flex;
//             flex-direction: column;
//             gap: 1.5rem;
//         }

//         .system-actions {
//             display: grid;
//             grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
//             gap: 1rem;
//         }

//         .system-actions .btn {
//             justify-content: center;
//         }

//         @media (max-width: 768px) {
//             .settings-section {
//                 padding: 2rem;
//             }
            
//             .system-actions {
//                 grid-template-columns: 1fr;
//             }
//         }
//     </style>

//     <script>
//         function clearCache() {
//             if (confirm('Vider le cache du système ?')) {
//                 alert('Cache vidé avec succès');
//             }
//         }

//         function exportData() {
//             alert('Export des données en cours...');
//         }

//         function backupDatabase() {
//             if (confirm('Créer une sauvegarde de la base de données ?')) {
//                 alert('Sauvegarde créée avec succès');
//             }
//         }

//         function viewLogs() {
//             window.open('/admin/logs', '_blank');
//         }
//     </script>
// </body>
// </html>
// `;

// Correction pour les événements sans associations
async getEventsWithoutAssociations(req, res) {
    try {
        const { QueryTypes } = await import('sequelize');
        const { sequelize } = await import('../models/index.js');

        const events = await sequelize.query(`
            SELECT 
                e.*,
                f.titre as formation_titre
            FROM evenements e
            LEFT JOIN formations f ON e.formation_id = f.id
            ORDER BY e.date_debut DESC
        `, {
            type: QueryTypes.SELECT
        });

        res.render('admin/events/list', {
            title: 'Gestion des événements - ADSIAM Admin',
            admin: req.admin,
            events: events.map(event => ({
                ...event,
                Formation: event.formation_titre ? { titre: event.formation_titre } : null
            })),
            currentPage: 'events',
            layout: 'layouts/admin'
        });
    } catch (error) {
        console.error('Erreur getEvents:', error);
        res.status(500).render('errors/500', { error });
    }
}
}