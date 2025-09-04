// controllers/EntrepriseController.js
import { QueryTypes } from 'sequelize';
import { sequelize } from '../models/index.js';
import Entreprise from '../models/Entreprise.js';

class EntrepriseController {
    // 📋 Liste des entreprises avec pagination et filtres
    static async index(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            
            // Construction des filtres
            const where = {};
            const { search, statut, secteur, type_contrat } = req.query;
            
            if (search) {
                where[sequelize.Op.or] = [
                    { nom: { [sequelize.Op.iLike]: `%${search}%` } },
                    { siret: { [sequelize.Op.like]: `%${search}%` } },
                    { ville: { [sequelize.Op.iLike]: `%${search}%` } }
                ];
            }
            
            if (statut) where.statut = statut;
            if (secteur) where.secteur_activite = secteur;
            if (type_contrat) where.type_contrat = type_contrat;

            const { count, rows } = await Entreprise.findAndCountAll({
                where,
                order: [['nom', 'ASC']],
                limit,
                offset,
                attributes: [
                    'id', 'nom', 'siret', 'secteur_activite', 'ville', 
                    'email_contact', 'statut', 'type_contrat',
                    'nombre_licences_max', 'nombre_licences_utilisees',
                    'date_fin_contrat', 'createdAt'
                ]
            });

            // Statistiques pour le dashboard
            const stats = await this.getStatistiques();

            res.render('entreprises/index', {
                title: 'Gestion des Entreprises - ADSIAM',
                layout: 'layouts/admin',
                entreprises: rows,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(count / limit),
                    totalItems: count,
                    limit
                },
                filters: { search, statut, secteur, type_contrat },
                stats
            });
        } catch (error) {
            console.error('💥 Erreur index entreprises:', error);
            req.flash('error', 'Erreur lors du chargement des entreprises');
            res.redirect('/dashboard');
        }
    }

    // 👁️ Affichage détaillé d'une entreprise
    static async show(req, res) {
        try {
            const { id } = req.params;
            
            const entreprise = await Entreprise.findByPk(id);
            
            if (!entreprise) {
                req.flash('error', 'Entreprise non trouvée');
                return res.redirect('/entreprises');
            }

            // Récupérer les utilisateurs de l'entreprise
            const utilisateurs = await sequelize.query(`
                SELECT 
                    u.id, u.prenom, u.nom, u.email, u.type_utilisateur,
                    u.statut, u.derniere_connexion_le, u.cree_le,
                    COUNT(i.id) as formations_inscrites,
                    AVG(i.progression_pourcentage) as progression_moyenne
                FROM utilisateurs u
                LEFT JOIN inscriptions i ON u.id = i.user_id
                WHERE u.societe_rattachee = :entrepriseNom
                GROUP BY u.id
                ORDER BY u.nom, u.prenom
            `, {
                type: QueryTypes.SELECT,
                replacements: { entrepriseNom: entreprise.nom }
            });

            // Statistiques d'utilisation
            const statsUtilisation = await sequelize.query(`
                SELECT 
                    COUNT(DISTINCT u.id) as utilisateurs_actifs,
                    COUNT(DISTINCT i.formation_id) as formations_utilisees,
                    SUM(i.temps_total_minutes) as temps_total_formation,
                    COUNT(CASE WHEN i.certifie THEN 1 END) as certifications_obtenues
                FROM utilisateurs u
                LEFT JOIN inscriptions i ON u.id = i.user_id
                WHERE u.societe_rattachee = :entrepriseNom
                AND u.statut = 'actif'
            `, {
                type: QueryTypes.SELECT,
                replacements: { entrepriseNom: entreprise.nom }
            });

            res.render('entreprises/show', {
                title: `${entreprise.nom} - Détails Entreprise`,
                layout: 'layouts/admin',
                entreprise,
                utilisateurs,
                stats: statsUtilisation[0]
            });
        } catch (error) {
            console.error('💥 Erreur show entreprise:', error);
            req.flash('error', 'Erreur lors du chargement de l\'entreprise');
            res.redirect('/entreprises');
        }
    }

    // 📝 Formulaire de création
    static async create(req, res) {
        res.render('entreprises/create', {
            title: 'Nouvelle Entreprise - ADSIAM',
            layout: 'layouts/admin',
            entreprise: {}
        });
    }

    // 💾 Sauvegarde d'une nouvelle entreprise
    static async store(req, res) {
        try {
            const entrepriseData = {
                ...req.body,
                nombre_licences_utilisees: 0,
                statut: 'en_attente',
                derniere_activite: new Date()
            };

            // Vérification SIRET unique
            const siretExistant = await Entreprise.findBySiret(req.body.siret);
            if (siretExistant) {
                req.flash('error', 'Ce numéro SIRET est déjà enregistré');
                return res.render('entreprises/create', {
                    title: 'Nouvelle Entreprise - ADSIAM',
                    layout: 'layouts/admin',
                    entreprise: req.body,
                    errors: { siret: 'SIRET déjà utilisé' }
                });
            }

            const entreprise = await Entreprise.create(entrepriseData);
            
            req.flash('success', `Entreprise "${entreprise.nom}" créée avec succès`);
            res.redirect(`/entreprises/${entreprise.id}`);
        } catch (error) {
            console.error('💥 Erreur création entreprise:', error);
            
            const errors = {};
            if (error.errors) {
                error.errors.forEach(err => {
                    errors[err.path] = err.message;
                });
            }

            res.render('entreprises/create', {
                title: 'Nouvelle Entreprise - ADSIAM',
                layout: 'layouts/admin',
                entreprise: req.body,
                errors
            });
        }
    }

    // ✏️ Formulaire d'édition
    static async edit(req, res) {
        try {
            const { id } = req.params;
            const entreprise = await Entreprise.findByPk(id);
            
            if (!entreprise) {
                req.flash('error', 'Entreprise non trouvée');
                return res.redirect('/entreprises');
            }

            res.render('entreprises/edit', {
                title: `Modifier ${entreprise.nom} - ADSIAM`,
                layout: 'layouts/admin',
                entreprise
            });
        } catch (error) {
            console.error('💥 Erreur edit entreprise:', error);
            req.flash('error', 'Erreur lors du chargement de l\'entreprise');
            res.redirect('/entreprises');
        }
    }

    // 🔄 Mise à jour d'une entreprise
    static async update(req, res) {
        try {
            const { id } = req.params;
            const entreprise = await Entreprise.findByPk(id);
            
            if (!entreprise) {
                req.flash('error', 'Entreprise non trouvée');
                return res.redirect('/entreprises');
            }

            // Vérification SIRET unique (sauf pour l'entreprise actuelle)
            if (req.body.siret !== entreprise.siret) {
                const siretExistant = await Entreprise.findBySiret(req.body.siret);
                if (siretExistant) {
                    req.flash('error', 'Ce numéro SIRET est déjà utilisé par une autre entreprise');
                    return res.render('entreprises/edit', {
                        title: `Modifier ${entreprise.nom} - ADSIAM`,
                        layout: 'layouts/admin',
                        entreprise: { ...entreprise.toJSON(), ...req.body },
                        errors: { siret: 'SIRET déjà utilisé' }
                    });
                }
            }

            await entreprise.update(req.body);
            
            req.flash('success', `Entreprise "${entreprise.nom}" mise à jour avec succès`);
            res.redirect(`/entreprises/${entreprise.id}`);
        } catch (error) {
            console.error('💥 Erreur update entreprise:', error);
            
            const errors = {};
            if (error.errors) {
                error.errors.forEach(err => {
                    errors[err.path] = err.message;
                });
            }

            const entreprise = await Entreprise.findByPk(req.params.id);
            res.render('entreprises/edit', {
                title: `Modifier ${entreprise.nom} - ADSIAM`,
                layout: 'layouts/admin',
                entreprise: { ...entreprise.toJSON(), ...req.body },
                errors
            });
        }
    }

    // 🗑️ Suppression d'une entreprise
    static async destroy(req, res) {
        try {
            const { id } = req.params;
            const entreprise = await Entreprise.findByPk(id);
            
            if (!entreprise) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Entreprise non trouvée' 
                });
            }

            // Vérifier s'il y a des utilisateurs liés
            const utilisateurs = await sequelize.query(`
                SELECT COUNT(*) as count 
                FROM utilisateurs 
                WHERE societe_rattachee = :entrepriseNom
            `, {
                type: QueryTypes.SELECT,
                replacements: { entrepriseNom: entreprise.nom }
            });

            if (utilisateurs[0].count > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Impossible de supprimer l'entreprise. ${utilisateurs[0].count} utilisateur(s) y sont rattachés.`
                });
            }

            await entreprise.destroy();
            
            res.json({
                success: true,
                message: `Entreprise "${entreprise.nom}" supprimée avec succès`
            });
        } catch (error) {
            console.error('💥 Erreur suppression entreprise:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la suppression'
            });
        }
    }

    // 🔄 Changement de statut
    static async updateStatut(req, res) {
        try {
            const { id } = req.params;
            const { statut, motif } = req.body;
            
            const entreprise = await Entreprise.findByPk(id);
            if (!entreprise) {
                return res.status(404).json({
                    success: false,
                    message: 'Entreprise non trouvée'
                });
            }

            const ancienStatut = entreprise.statut;
            await entreprise.update({ 
                statut,
                notes_internes: motif ? 
                    `${entreprise.notes_internes || ''}\n[${new Date().toLocaleDateString()}] Changement de statut: ${ancienStatut} → ${statut}. Motif: ${motif}`.trim() 
                    : entreprise.notes_internes
            });

            res.json({
                success: true,
                message: `Statut mis à jour: ${statut}`,
                nouveauStatut: statut
            });
        } catch (error) {
            console.error('💥 Erreur update statut:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la mise à jour du statut'
            });
        }
    }

    // 📊 Statistiques globales
    static async getStatistiques() {
        try {
            const stats = await Entreprise.getStatistiques();
            
            // Statistiques supplémentaires
            const statsSupp = await sequelize.query(`
                SELECT 
                    COUNT(CASE WHEN date_fin_contrat < NOW() THEN 1 END) as contrats_expires,
                    COUNT(CASE WHEN date_fin_contrat BETWEEN NOW() AND NOW() + INTERVAL '30 days' THEN 1 END) as expire_bientot,
                    SUM(CASE WHEN statut = 'actif' THEN tarif_mensuel ELSE 0 END) as chiffre_affaires_mensuel
                FROM entreprises
            `, {
                type: QueryTypes.SELECT
            });

            return {
                ...stats.dataValues,
                ...statsSupp[0],
                taux_utilisation: stats.dataValues.licences_totales > 0 ? 
                    Math.round((stats.dataValues.licences_utilisees / stats.dataValues.licences_totales) * 100) : 0
            };
        } catch (error) {
            console.error('💥 Erreur statistiques entreprises:', error);
            return {
                total: 0,
                actives: 0,
                en_attente: 0,
                licences_totales: 0,
                licences_utilisees: 0,
                tarif_moyen: 0,
                contrats_expires: 0,
                expire_bientot: 0,
                chiffre_affaires_mensuel: 0,
                taux_utilisation: 0
            };
        }
    }

    // 🔍 API de recherche
    static async search(req, res) {
        try {
            const { q } = req.query;
            
            if (!q || q.length < 2) {
                return res.json({ success: true, results: [] });
            }

            const entreprises = await Entreprise.findAll({
                where: {
                    [sequelize.Op.or]: [
                        { nom: { [sequelize.Op.iLike]: `%${q}%` } },
                        { siret: { [sequelize.Op.like]: `%${q}%` } }
                    ],
                    statut: 'actif'
                },
                attributes: ['id', 'nom', 'siret', 'ville'],
                limit: 10,
                order: [['nom', 'ASC']]
            });

            res.json({
                success: true,
                results: entreprises.map(e => ({
                    id: e.id,
                    text: `${e.nom} (${e.ville})`,
                    nom: e.nom,
                    siret: e.siret,
                    ville: e.ville
                }))
            });
        } catch (error) {
            console.error('💥 Erreur recherche entreprises:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la recherche'
            });
        }
    }

    // 📈 Dashboard entreprise (pour une entreprise spécifique)
    static async dashboard(req, res) {
        try {
            const { id } = req.params;
            const entreprise = await Entreprise.findByPk(id);
            
            if (!entreprise) {
                req.flash('error', 'Entreprise non trouvée');
                return res.redirect('/entreprises');
            }

            // Activité récente de l'entreprise
            const activiteRecente = await sequelize.query(`
                SELECT 
                    u.prenom, u.nom, u.derniere_connexion_le,
                    i.date_inscription, f.titre as formation_titre,
                    pm.date_fin as module_termine
                FROM utilisateurs u
                LEFT JOIN inscriptions i ON u.id = i.user_id
                LEFT JOIN formations f ON i.formation_id = f.id
                LEFT JOIN progressions_modules pm ON i.id = pm.inscription_id
                WHERE u.societe_rattachee = :entrepriseNom
                AND (u.derniere_connexion_le IS NOT NULL 
                     OR i.date_inscription >= NOW() - INTERVAL '30 days'
                     OR pm.date_fin >= NOW() - INTERVAL '30 days')
                ORDER BY GREATEST(
                    COALESCE(u.derniere_connexion_le, '1970-01-01'),
                    COALESCE(i.date_inscription, '1970-01-01'),
                    COALESCE(pm.date_fin, '1970-01-01')
                ) DESC
                LIMIT 20
            `, {
                type: QueryTypes.SELECT,
                replacements: { entrepriseNom: entreprise.nom }
            });

            res.render('entreprises/dashboard', {
                title: `Dashboard ${entreprise.nom} - ADSIAM`,
                layout: 'layouts/admin',
                entreprise,
                activiteRecente
            });
        } catch (error) {
            console.error('💥 Erreur dashboard entreprise:', error);
            req.flash('error', 'Erreur lors du chargement du dashboard');
            res.redirect('/entreprises');
        }
    }
}

export default EntrepriseController;