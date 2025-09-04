import express from 'express';
import { sequelize } from '../models/index.js';
import { QueryTypes, Op } from 'sequelize';
import DashboardController from '../controllers/DashboardController.js';

const router = express.Router();

// ========================================
// 🛡️ MIDDLEWARE D'AUTHENTIFICATION
// ========================================

// Middleware d'authentification pour les routes protégées
const requireAuth = (req, res, next) => {
    if (!req.session?.userId) {
        req.flash('info', 'Veuillez vous connecter pour accéder à cette page.');
        return res.redirect('/auth/login');
    }
    next();
};

// Middleware pour enrichir les données utilisateur dans les vues
const enrichUserData = async (req, res, next) => {
    if (req.session?.userId) {
        try {
            const userData = await sequelize.query(`
                SELECT 
                    u.*,
                    CASE 
                        WHEN u.type_utilisateur = 'aide_domicile' THEN 'Aide à domicile'
                        WHEN u.type_utilisateur = 'aide_soignant' THEN 'Aide-soignant'
                        WHEN u.type_utilisateur = 'formateur' THEN 'Formateur'
                        ELSE 'Étudiant'
                    END as type_display
                FROM utilisateurs u 
                WHERE u.id = :userId
            `, {
                type: QueryTypes.SELECT,
                replacements: { userId: req.session.userId }
            });
            
            if (userData[0]) {
                req.user = userData[0]; // Ajouter req.user pour compatibilité
                req.session.user = userData[0];
                res.locals.currentUser = userData[0];
                res.locals.user = userData[0]; // Ajouter pour les templates
                res.locals.hasRole = (role) => userData[0].type_utilisateur === role;
                res.locals.isActive = () => userData[0].statut === 'actif';
            }
        } catch (error) {
            console.error('❌ Erreur enrichissement utilisateur:', error);
        }
    }
    next();
};

// ========================================
// 🔧 HELPER FUNCTIONS
// ========================================

// Helper pour calculer les statistiques utilisateur
async function getUserStats(userId) {
    try {
        const statsQuery = `
            SELECT 
                COUNT(DISTINCT i.id) as total_inscriptions,
                AVG(COALESCE(i.progression_pourcentage, 0)) as progression_globale,
                COUNT(CASE WHEN i.certifie = true THEN 1 END) as certifications_count,
                COUNT(CASE WHEN i.statut = 'en_cours' THEN 1 END) as inscriptions_actives,
                COUNT(CASE WHEN i.statut = 'termine' THEN 1 END) as formations_terminees,
                COALESCE(SUM(CASE WHEN pm.updatedat >= NOW() - INTERVAL '7 days' THEN pm.temps_passe_minutes ELSE 0 END), 0) as temps_total_semaine
            FROM inscriptions i
            LEFT JOIN progressions_modules pm ON pm.inscription_id = i.id
            WHERE i.user_id = :userId
        `;

        const result = await sequelize.query(statsQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });

        const stats = result[0];
        return {
            progressionGlobale: Math.round(stats.progression_globale || 0),
            tempsTotalSemaine: parseInt(stats.temps_total_semaine || 0),
            certificationsCount: parseInt(stats.certifications_count || 0),
            inscriptionsActives: parseInt(stats.inscriptions_actives || 0),
            formationsTerminees: parseInt(stats.formations_terminees || 0)
        };
    } catch (error) {
        console.error('Erreur getUserStats:', error);
        return { 
            progressionGlobale: 0, 
            tempsTotalSemaine: 0, 
            certificationsCount: 0, 
            inscriptionsActives: 0,
            formationsTerminees: 0
        };
    }
}

// Helper pour les activités récentes
async function getRecentActivities(userId, limit = 5) {
    try {
        const activitiesQuery = `
            SELECT 
                'module_complete' as type,
                CONCAT('Module complété: ', m.titre) as titre,
                CONCAT('Formation: ', f.titre) as description,
                pm.updatedat as createdat,
                pm.id
            FROM progressions_modules pm
            JOIN modules m ON pm.module_id = m.id
            JOIN formations f ON m.formation_id = f.id
            WHERE pm.user_id = :userId AND pm.statut = 'termine'
            
            UNION ALL
            
            SELECT 
                'message' as type,
                'Nouveau message' as titre,
                msg.sujet as description,
                msg.createdat,
                msg.id
            FROM messages msg
            WHERE (msg.destinataire_id = :userId OR msg.receiver_id = :userId)
            
            ORDER BY createdat DESC
            LIMIT :limit
        `;

        const activities = await sequelize.query(activitiesQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId, limit }
        });

        return activities.map(activity => ({
            id: `${activity.type}_${activity.id}`,
            type: activity.type,
            titre: activity.titre,
            description: activity.description,
            createdat: activity.createdat
        }));
    } catch (error) {
        console.error('Erreur getRecentActivities:', error);
        return [];
    }
}

// Helper functions pour les templates
const templateHelpers = {
    formatDate: (date) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    },
    formatDateTime: (date) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    formatDuration: (minutes) => {
        if (!minutes) return '0min';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}min` : ''}` : `${mins}min`;
    },
    truncateText: (text, length = 100) => {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
    }
};

// ========================================
// 📊 ROUTES PRINCIPALES DU DASHBOARD
// ========================================

// Dashboard principal
router.get('/dashboard', requireAuth, enrichUserData, async (req, res) => {
    try {
        const userId = req.session.userId;
        
        // Statistiques utilisateur
        const stats = await getUserStats(userId);
        
        // Formation en cours
        const formationEnCoursQuery = `
            SELECT 
                i.*,
                f.titre,
                f.description,
                f.icone,
                f.nombre_modules,
                f.duree_heures
            FROM inscriptions i
            JOIN formations f ON i.formation_id = f.id
            WHERE i.user_id = :userId AND i.statut = 'en_cours'
            ORDER BY i.updatedat DESC
            LIMIT 1
        `;
        
        const formationEnCoursResult = await sequelize.query(formationEnCoursQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });
        
        const formationEnCours = formationEnCoursResult[0] || null;
        
        // Modules progression si formation en cours
        let modulesProgression = [];
        if (formationEnCours) {
            const modulesQuery = `
                SELECT 
                    m.*,
                    pm.statut,
                    pm.progression_pourcentage,
                    pm.temps_passe_minutes
                FROM modules m
                LEFT JOIN progressions_modules pm ON (
                    pm.module_id = m.id 
                    AND pm.inscription_id = :inscriptionId
                )
                WHERE m.formation_id = :formationId
                ORDER BY m.ordre ASC
            `;
            
            modulesProgression = await sequelize.query(modulesQuery, {
                type: QueryTypes.SELECT,
                replacements: { 
                    inscriptionId: formationEnCours.id,
                    formationId: formationEnCours.formation_id 
                }
            });
        }

        // Activités récentes
        const activites = await getRecentActivities(userId);

        // Messages non lus
        const messagesNonLusQuery = `
            SELECT COUNT(*) as count 
            FROM messages 
            WHERE (destinataire_id = :userId OR receiver_id = :userId) 
            AND lu = false
        `;
        const messagesNonLusResult = await sequelize.query(messagesNonLusQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });
        const messagesNonLus = parseInt(messagesNonLusResult[0].count);

        // Notifications non lues
        const notificationsNonLuesQuery = `
            SELECT COUNT(*) as count 
            FROM notifications 
            WHERE user_id = :userId AND lu = false
        `;
        const notificationsNonLuesResult = await sequelize.query(notificationsNonLuesQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });
        const notificationsNonLues = parseInt(notificationsNonLuesResult[0].count);

        // Prochain événement
        const prochainEvenementQuery = `
            SELECT 
                e.*,
                CASE WHEN pe.user_id IS NOT NULL THEN true ELSE false END as user_inscrit
            FROM evenements e
            LEFT JOIN participations_evenements pe ON (e.id = pe.evenement_id AND pe.user_id = :userId)
            WHERE e.date_debut > NOW()
            ORDER BY e.date_debut ASC
            LIMIT 1
        `;
        const prochainEvenementResult = await sequelize.query(prochainEvenementQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });
        const prochainEvenement = prochainEvenementResult[0] || null;

        // Certifications récentes
        const certificationsQuery = `
            SELECT 
                i.*,
                f.titre as formation_titre
            FROM inscriptions i
            JOIN formations f ON i.formation_id = f.id
            WHERE i.user_id = :userId AND i.certifie = true
            ORDER BY i.date_certification DESC
            LIMIT 3
        `;
        const certifications = await sequelize.query(certificationsQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });

        console.log(`📊 Dashboard chargé pour utilisateur ${userId}`);

        res.render('dashboard/etudiant', {
            user: req.user,
            stats,
            layout: false,
            formationEnCours,
            modulesProgression,
            activites,
            messagesNonLus,
            notificationsNonLues,
            prochainEvenement,
            certifications,
            currentPage: 'dashboard',
            pageTitle: 'Dashboard',
            ...templateHelpers
        });
        
    } catch (error) {
        console.error('💥 Erreur dashboard:', error);
        req.flash('error', 'Erreur lors du chargement du dashboard');
        res.status(500).render('error', { 
            message: 'Erreur lors du chargement du dashboard',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Route: Mes formations
router.get('/mes-formations', requireAuth, enrichUserData, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Inscriptions utilisateur avec formations
        const inscriptionsQuery = `
            SELECT 
                i.*,
                f.titre,
                f.description,
                f.icone,
                f.nombre_modules,
                f.duree_heures,
                f.prix,
                f.gratuit
            FROM inscriptions i
            JOIN formations f ON i.formation_id = f.id
            WHERE i.user_id = :userId
            ORDER BY i.updatedat DESC
        `;
        
        const inscriptions = await sequelize.query(inscriptionsQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });

        // Ajouter l'objet formation pour compatibilité template
        const inscriptionsFormatted = inscriptions.map(inscription => ({
            ...inscription,
            formation: {
                id: inscription.formation_id,
                titre: inscription.titre,
                description: inscription.description,
                icone: inscription.icone,
                nombre_modules: inscription.nombre_modules,
                duree_heures: inscription.duree_heures,
                prix: inscription.prix,
                gratuit: inscription.gratuit
            }
        }));

        // Statistiques formations
        const stats = {
            enCours: inscriptions.filter(i => i.statut === 'en_cours').length,
            terminees: inscriptions.filter(i => i.statut === 'termine').length,
            certifications: inscriptions.filter(i => i.certifie === true).length
        };

        res.render('dashboard/mes-formations', {
            user: req.user,
            inscriptions: inscriptionsFormatted,
            stats,
            currentPage: 'formations',
            pageTitle: 'Mes Formations',
            ...templateHelpers
        });
    } catch (error) {
        console.error('💥 Erreur mes-formations:', error);
        req.flash('error', 'Erreur lors du chargement des formations');
        res.status(500).render('error', { 
            message: 'Erreur lors du chargement des formations',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Route: Mes certifications
router.get('/mes-certifications', requireAuth, enrichUserData, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Certifications obtenues
        const certificationsQuery = `
            SELECT 
                i.*,
                f.titre as formation_titre,
                f.description as formation_description,
                f.domaine
            FROM inscriptions i
            JOIN formations f ON i.formation_id = f.id
            WHERE i.user_id = :userId AND i.certifie = true
            ORDER BY i.date_certification DESC
        `;
        
        const certifications = await sequelize.query(certificationsQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });

        // Statistiques certifications
        const statsQuery = `
            SELECT 
                COUNT(CASE WHEN i.statut = 'en_cours' THEN 1 END) as en_cours,
                AVG(CASE WHEN i.note_finale IS NOT NULL THEN i.note_finale ELSE 0 END) as note_moyenne,
                COUNT(CASE WHEN i.certifie = true AND EXTRACT(YEAR FROM i.date_certification) = EXTRACT(YEAR FROM NOW()) THEN 1 END) as cette_annee
            FROM inscriptions i
            WHERE i.user_id = :userId
        `;
        
        const statsResult = await sequelize.query(statsQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });

        const stats = {
            enCours: parseInt(statsResult[0].en_cours || 0),
            noteMovenne: Math.round((parseFloat(statsResult[0].note_moyenne) || 0) * 10) / 10,
            cetteAnnee: parseInt(statsResult[0].cette_annee || 0)
        };

        res.render('dashboard/mes-certifications', {
            user: req.user,
            certifications,
            stats,
            currentPage: 'certifications',
            pageTitle: 'Mes Certifications',
            ...templateHelpers
        });
    } catch (error) {
        console.error('💥 Erreur mes-certifications:', error);
        req.flash('error', 'Erreur lors du chargement des certifications');
        res.status(500).render('error', { 
            message: 'Erreur lors du chargement des certifications',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Route: Mes messages
router.get('/mes-messages', requireAuth, enrichUserData, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Messages reçus
        const messagesQuery = `
            SELECT 
                m.*,
                CASE 
                    WHEN m.expediteur_id IS NOT NULL THEN u.prenom || ' ' || u.nom
                    ELSE 'ADSIAM Support'
                END as expediteur_nom
            FROM messages m
            LEFT JOIN utilisateurs u ON m.expediteur_id = u.id
            WHERE (m.destinataire_id = :userId OR m.receiver_id = :userId)
            AND (m.archive IS NULL OR m.archive = false)
            ORDER BY m.createdat DESC
            LIMIT 50
        `;
        
        const messages = await sequelize.query(messagesQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });

        // Messages récents pour sidebar
        const messagesRecents = messages.slice(0, 3);

        res.render('dashboard/mes-messages', {
            user: req.user,
            messages,
            messagesRecents,
            messagesNonLus: messages.filter(m => !m.lu).length,
            currentPage: 'messages',
            pageTitle: 'Mes Messages',
            ...templateHelpers
        });
    } catch (error) {
        console.error('💥 Erreur mes-messages:', error);
        req.flash('error', 'Erreur lors du chargement des messages');
        res.status(500).render('error', { 
            message: 'Erreur lors du chargement des messages',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Route: Événements
router.get('/evenements', requireAuth, enrichUserData, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Événements à venir et actuels
        const evenementsQuery = `
            SELECT 
                e.*,
                CASE WHEN pe.user_id IS NOT NULL THEN true ELSE false END as user_inscrit,
                COUNT(pe_all.user_id) as participants_count,
                u_formateur.prenom || ' ' || u_formateur.nom as formateur_nom
            FROM evenements e
            LEFT JOIN participations_evenements pe ON (e.id = pe.evenement_id AND pe.user_id = :userId)
            LEFT JOIN participations_evenements pe_all ON e.id = pe_all.evenement_id
            LEFT JOIN utilisateurs u_formateur ON e.formateur_id = u_formateur.id
            WHERE e.date_debut >= NOW() - INTERVAL '1 day'
            GROUP BY e.id, pe.user_id, u_formateur.id
            ORDER BY e.date_debut ASC
        `;
        
        const evenements = await sequelize.query(evenementsQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });

        // Événements prochains pour sidebar
        const evenementsProchains = evenements
            .filter(e => e.user_inscrit && new Date(e.date_debut) > new Date())
            .slice(0, 3);

        res.render('dashboard/evenements', {
            user: req.user,
            evenements,
            evenementsProchains,
            currentPage: 'evenements',
            pageTitle: 'Événements',
            ...templateHelpers
        });
    } catch (error) {
        console.error('💥 Erreur evenements:', error);
        req.flash('error', 'Erreur lors du chargement des événements');
        res.status(500).render('error', { 
            message: 'Erreur lors du chargement des événements',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Route Ma Progression - Simple et complète
router.get('/ma-progression', async (req, res) => {
    // Vérifier l'authentification
    if (!req.session?.userId) {
        req.flash('info', 'Veuillez vous connecter pour accéder à votre progression');
        return res.redirect('/auth/login');
    }

    try {
        const userId = req.session.userId;

        // Requête principale pour toutes les données nécessaires
        const [stats] = await sequelize.query(`
            SELECT 
                COALESCE(AVG(i.progression_pourcentage), 0) as progression_globale,
                COALESCE(SUM(i.temps_total_minutes), 0) as temps_total_minutes,
                COUNT(CASE WHEN i.certifie = true THEN 1 END) as certifications_obtenues,
                COUNT(CASE WHEN i.statut IN ('en_cours', 'termine') THEN 1 END) as inscriptions_actives
            FROM inscriptions i
            WHERE i.user_id = $1
        `, {
            bind: [userId],
            type: sequelize.QueryTypes.SELECT
        });

        // Formations avec progression
        const formations = await sequelize.query(`
            SELECT 
                f.id, f.titre, f.description, f.niveau, f.duree_heures, f.nombre_modules,
                f.icone, f.domaine,
                i.progression_pourcentage, i.statut as statut_inscription,
                i.temps_total_minutes as temps_formation, i.certifie
            FROM formations f
            JOIN inscriptions i ON f.id = i.formation_id
            WHERE i.user_id = $1
            ORDER BY i.date_inscription DESC
        `, {
            bind: [userId],
            type: sequelize.QueryTypes.SELECT
        });

        // Pour chaque formation, récupérer les modules
        for (let formation of formations) {
            const modules = await sequelize.query(`
                SELECT 
                    m.id, m.titre, m.duree_minutes, m.ordre,
                    COALESCE(pm.statut, 'non_commence') as statut,
                    pm.temps_passe_minutes, pm.progression_pourcentage as progression_module
                FROM modules m
                LEFT JOIN progressions_modules pm ON m.id = pm.module_id AND pm.user_id = $1
                WHERE m.formation_id = $2
                ORDER BY m.ordre
            `, {
                bind: [userId, formation.id],
                type: sequelize.QueryTypes.SELECT
            });
            formation.modules = modules;
        }

        // Données hebdomadaires (7 derniers jours)
        const weeklyStats = await sequelize.query(`
            WITH last_7_days AS (
                SELECT generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day'::interval)::date as day
            ),
            daily_study AS (
                SELECT 
                    DATE(pm.date_debut) as study_date,
                    SUM(pm.temps_passe_minutes) as total_minutes
                FROM progressions_modules pm
                JOIN inscriptions i ON pm.inscription_id = i.id
                WHERE i.user_id = $1 AND pm.date_debut >= CURRENT_DATE - 6
                GROUP BY DATE(pm.date_debut)
            )
            SELECT 
                l7.day,
                CASE EXTRACT(DOW FROM l7.day)
                    WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mer'
                    WHEN 4 THEN 'Jeu' WHEN 5 THEN 'Ven' WHEN 6 THEN 'Sam'
                    WHEN 0 THEN 'Dim'
                END as day_name,
                COALESCE(ds.total_minutes, 0) as time
            FROM last_7_days l7
            LEFT JOIN daily_study ds ON l7.day = ds.study_date
            ORDER BY l7.day
        `, {
            bind: [userId],
            type: sequelize.QueryTypes.SELECT
        });

        // Série de jours consécutifs (calcul simple)
        const [streakData] = await sequelize.query(`
            SELECT COUNT(DISTINCT DATE(pm.date_debut)) as streak_days
            FROM progressions_modules pm
            JOIN inscriptions i ON pm.inscription_id = i.id
            WHERE i.user_id = $1 
            AND pm.date_debut >= CURRENT_DATE - 7
        `, {
            bind: [userId],
            type: sequelize.QueryTypes.SELECT
        });

        // Activités récentes
        const activites = await sequelize.query(`
            SELECT 
                'Module terminé' as titre,
                CONCAT('Module "', m.titre, '" terminé') as description,
                pm.date_fin as createdat
            FROM progressions_modules pm
            JOIN modules m ON pm.module_id = m.id
            JOIN inscriptions i ON pm.inscription_id = i.id
            WHERE i.user_id = $1 AND pm.statut = 'termine'
            
            UNION ALL
            
            SELECT 
                'Nouvelle inscription' as titre,
                CONCAT('Inscription à "', f.titre, '"') as description,
                i.date_inscription as createdat
            FROM inscriptions i
            JOIN formations f ON i.formation_id = f.id
            WHERE i.user_id = $1
            
            ORDER BY createdat DESC LIMIT 5
        `, {
            bind: [userId],
            type: sequelize.QueryTypes.SELECT
        });

        // Préparer les données pour la vue
        const progressionData = {
            stats: {
                progressionGlobale: stats.progression_globale || 0,
                tempsTotalMinutes: stats.temps_total_minutes || 0,
                certificationsObtenues: stats.certifications_obtenues || 0,
                inscriptionsActives: stats.inscriptions_actives || 0
            },
            formations: formations,
            weeklyStats: weeklyStats.map(day => ({
                day: day.day_name,
                time: Math.round(day.time || 0)
            })),
            streakDays: streakData.streak_days || 0,
            activites: activites
        };

        // Rendre la vue
        res.render('dashboard/progression', {
            title: 'Ma Progression - ADSIAM',
            layout: false,
            ...progressionData
        });

    } catch (error) {
        console.error('Erreur page progression:', error);
        req.flash('error', 'Erreur lors du chargement de votre progression');
        res.redirect('/dashboard');
    }
});

// API simple pour mise à jour progression module
router.post('/api/progression/module', async (req, res) => {
    if (!req.session?.userId) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    try {
        const { moduleId, statut, tempsEcoule } = req.body;
        const userId = req.session.userId;

        await sequelize.query(`
            INSERT INTO progressions_modules (
                user_id, module_id, inscription_id, statut, temps_passe_minutes,
                date_debut, date_fin, progression_pourcentage, createdat, updatedat
            )
            SELECT 
                $1, $2, i.id, $3, $4,
                CASE WHEN $3 = 'en_cours' THEN NOW() ELSE NULL END,
                CASE WHEN $3 = 'termine' THEN NOW() ELSE NULL END,
                CASE WHEN $3 = 'termine' THEN 100 ELSE 50 END,
                NOW(), NOW()
            FROM inscriptions i
            JOIN modules m ON m.formation_id = i.formation_id
            WHERE i.user_id = $1 AND m.id = $2
            ON CONFLICT (user_id, module_id)
            DO UPDATE SET
                statut = $3,
                temps_passe_minutes = progressions_modules.temps_passe_minutes + $4,
                date_fin = CASE WHEN $3 = 'termine' THEN NOW() ELSE progressions_modules.date_fin END,
                progression_pourcentage = CASE WHEN $3 = 'termine' THEN 100 ELSE 50 END,
                updatedat = NOW()
        `, {
            bind: [userId, moduleId, statut, tempsEcoule || 0],
            type: sequelize.QueryTypes.INSERT
        });

        res.json({ success: true, message: 'Progression mise à jour' });

    } catch (error) {
        console.error('Erreur mise à jour progression:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Route: Mon profil
router.get('/mon-profil', requireAuth, enrichUserData, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Statistiques pour profil
        const stats = await getUserStats(userId);
        const statsProfile = {
            formationsTerminees: stats.formationsTerminees,
            certificats: stats.certificationsCount,
            heuresFormation: Math.round(stats.tempsTotalSemaine / 60)
        };

        // Activités récentes pour profil
        const activites = await getRecentActivities(userId, 5);

        res.render('dashboard/mon-profil', {
            user: req.user,
            stats: statsProfile,
            activites,
            currentPage: 'profil',
            pageTitle: 'Mon Profil',
            ...templateHelpers
        });
    } catch (error) {
        console.error('💥 Erreur mon-profil:', error);
        req.flash('error', 'Erreur lors du chargement du profil');
        res.status(500).render('error', { 
            message: 'Erreur lors du chargement du profil',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// ========================================
// 🔧 API ROUTES POUR DONNÉES DYNAMIQUES
// ========================================

// API: Marquer message comme lu
router.post('/api/messages/:id/mark-read', requireAuth, async (req, res) => {
    try {
        const messageId = req.params.id;
        const userId = req.session.userId;

        await sequelize.query(`
            UPDATE messages 
            SET lu = true, date_lecture = NOW() 
            WHERE id = :messageId 
            AND (destinataire_id = :userId OR receiver_id = :userId)
        `, {
            type: QueryTypes.UPDATE,
            replacements: { messageId, userId }
        });

        console.log(`✅ Message ${messageId} marqué comme lu pour utilisateur ${userId}`);
        res.json({ success: true });
    } catch (error) {
        console.error('💥 Erreur mark-read:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// API: Inscription à un événement
router.post('/api/evenements/:id/inscription', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.id;
        const userId = req.session.userId;

        // Vérifier si événement existe
        const evenementQuery = `
            SELECT * FROM evenements WHERE id = :eventId
        `;
        const evenement = await sequelize.query(evenementQuery, {
            type: QueryTypes.SELECT,
            replacements: { eventId }
        });

        if (evenement.length === 0) {
            return res.status(404).json({ success: false, message: 'Événement non trouvé' });
        }

        // Vérifier si déjà inscrit
        const existingParticipationQuery = `
            SELECT * FROM participations_evenements 
            WHERE evenement_id = :eventId AND user_id = :userId
        `;
        const existingParticipation = await sequelize.query(existingParticipationQuery, {
            type: QueryTypes.SELECT,
            replacements: { eventId, userId }
        });

        if (existingParticipation.length > 0) {
            return res.status(400).json({ success: false, message: 'Déjà inscrit à cet événement' });
        }

        // Créer participation
        await sequelize.query(`
            INSERT INTO participations_evenements (evenement_id, user_id, statut_participation, createdat, updatedat)
            VALUES (:eventId, :userId, 'inscrit', NOW(), NOW())
        `, {
            type: QueryTypes.INSERT,
            replacements: { eventId, userId }
        });

        // Créer notification
        await sequelize.query(`
            INSERT INTO notifications (user_id, titre, contenu, type_notification, lien, createdat, updatedat)
            VALUES (:userId, 'Inscription confirmée', :contenu, 'event', :lien, NOW(), NOW())
        `, {
            type: QueryTypes.INSERT,
            replacements: { 
                userId, 
                contenu: `Votre inscription à l'événement "${evenement[0].titre}" a été confirmée.`,
                lien: `/evenements/${eventId}`
            }
        });

        res.json({ 
            success: true, 
            message: 'Inscription confirmée'
        });
    } catch (error) {
        console.error('💥 Erreur inscription événement:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// API: Mise à jour profil
router.post('/api/profil/update', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const updateData = req.body;

        // Champs autorisés à la modification
        const allowedFields = ['prenom', 'nom', 'telephone', 'date_naissance', 'etablissement', 'ville', 'code_postal'];
        const updates = [];
        const replacements = { userId };

        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = :${field}`);
                replacements[field] = updateData[field];
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'Aucune donnée à mettre à jour' });
        }

        await sequelize.query(`
            UPDATE utilisateurs 
            SET ${updates.join(', ')}, modifie_le = NOW()
            WHERE id = :userId
        `, {
            type: QueryTypes.UPDATE,
            replacements
        });

        res.json({ success: true, message: 'Profil mis à jour avec succès' });
    } catch (error) {
        console.error('💥 Erreur update profil:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// API: Recherche globale
router.get('/api/search', requireAuth, async (req, res) => {
    try {
        const query = req.query.q;
        const userId = req.session.userId;

        if (!query || query.length < 2) {
            return res.json({ success: true, results: [] });
        }

        const searchTerm = `%${query}%`;
        const results = [];

        // Rechercher dans les formations inscrites
        const formationsQuery = `
            SELECT 
                f.id,
                f.titre,
                f.description,
                f.icone,
                'formation' as type
            FROM formations f
            JOIN inscriptions i ON f.id = i.formation_id
            WHERE i.user_id = :userId
            AND (f.titre ILIKE :searchTerm OR f.description ILIKE :searchTerm)
            LIMIT 5
        `;
        
        const formations = await sequelize.query(formationsQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId, searchTerm }
        });

        formations.forEach(formation => {
            results.push({
                title: formation.titre,
                description: formation.description.substring(0, 100) + '...',
                url: `/formation/${formation.id}`,
                type: 'formation'
            });
        });

        // Rechercher dans les messages
        const messagesQuery = `
            SELECT 
                m.id,
                m.sujet,
                m.contenu
            FROM messages m
            WHERE (m.destinataire_id = :userId OR m.receiver_id = :userId)
            AND (m.sujet ILIKE :searchTerm OR m.contenu ILIKE :searchTerm)
            LIMIT 3
        `;
        
        const messages = await sequelize.query(messagesQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId, searchTerm }
        });

        messages.forEach(message => {
            results.push({
                title: message.sujet,
                description: message.contenu.substring(0, 100) + '...',
                url: `/mes-messages/${message.id}`,
                type: 'message'
            });
        });

        console.log(`🔍 Recherche "${query}" - ${results.length} résultats trouvés`);
        res.json({ success: true, results });
    } catch (error) {
        console.error('💥 Erreur recherche:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Rafraîchir les statistiques en temps réel
router.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const stats = await getUserStats(userId);
        res.json({ success: true, stats });
    } catch (error) {
        console.error('💥 Erreur refresh stats:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ========================================
// ⚠️ MIDDLEWARE D'ERREUR
// ========================================

// Middleware d'erreur spécifique aux routes API
router.use('/api/*', (error, req, res, next) => {
    console.error('💥 Erreur API Dashboard:', error);
    res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
});

console.log('✅ Routes Dashboard corrigées et chargées avec succès');

export default router;