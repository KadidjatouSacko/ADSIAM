import { sequelize } from '../models/index.js';
import { QueryTypes } from 'sequelize';

class DashboardController {
    
    // Route principale du dashboard étudiant
    static async dashboard(req, res) {
        try {
            // Vérification de la session (déjà gérée par votre middleware)
            if (!req.session?.userId) {
                req.flash('info', 'Veuillez vous connecter pour accéder au tableau de bord.');
                return res.redirect('/auth/login');
            }

            const userId = req.session.userId;
            
            // Récupération des données utilisateur complètes
            const userData = await DashboardController.getUserData(userId);
            
            // Récupération des statistiques
            const stats = await DashboardController.getStats(userId);
            
            // Formation en cours
            const formationEnCours = await DashboardController.getFormationEnCours(userId);
            
            // Modules de progression pour la formation en cours
            const modulesProgression = formationEnCours ? 
                await DashboardController.getModulesProgression(userId, formationEnCours.formation_id) : [];
            
            // Activités récentes
            const activites = await DashboardController.getActivitesRecentes(userId);
            
            // Certifications obtenues
            const certifications = await DashboardController.getCertifications(userId);
            
            // Événements à venir
            const evenementsProchains = await DashboardController.getEvenementsProchains(userId);
            
            // Messages récents
            const messagesRecents = await DashboardController.getMessagesRecents(userId);
            
            // Compter les messages non lus
            const messagesNonLus = await DashboardController.countMessagesNonLus(userId);
            
            // Compter les notifications non lues
            const notificationsNonLues = await DashboardController.countNotificationsNonLues(userId);

            // Mettre à jour les variables locales pour les helpers
            res.locals.currentUser = userData;
            res.locals.hasRole = (role) => userData.type_utilisateur === role;
            res.locals.isActive = () => userData.statut === 'actif';

            // Données pour la vue
            const viewData = {
                title: 'Dashboard - ADSIAM',
                layout: 'layouts/main',
                user: userData,
                stats,
                formationEnCours,
                modulesProgression,
                activites,
                certifications,
                certificationsCount: certifications.length,
                inscriptionsActives: stats.inscriptionsActives,
                evenementsProchains,
                prochainEvenement: evenementsProchains[0] || null,
                messagesRecents,
                messagesNonLus,
                notificationsNonLues
            };

            console.log('📊 Dashboard chargé pour l\'utilisateur:', userData.prenom, userData.nom);
            res.render('dashboard/etudiant', viewData);
            
        } catch (error) {
            console.error('💥 Erreur dashboard:', error);
            req.flash('error', 'Erreur lors du chargement du dashboard');
            res.redirect('/');
        }
    }

    // Récupération des données utilisateur
    static async getUserData(userId) {
        const query = `
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
        `;
        
        const result = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });
        
        return result[0];
    }

    // Récupération des statistiques utilisateur
    static async getStats(userId) {
        try {
            // Progression globale
            const progressionQuery = `
                SELECT 
                    COALESCE(AVG(i.progression_pourcentage), 0) as progression_globale,
                    COUNT(*) as total_inscriptions,
                    COUNT(CASE WHEN i.statut = 'en_cours' THEN 1 END) as inscriptions_actives,
                    COUNT(CASE WHEN i.certifie = true THEN 1 END) as certifications_obtenues,
                    COALESCE(SUM(i.temps_total_minutes), 0) as temps_total_minutes
                FROM inscriptions i
                WHERE i.user_id = :userId
            `;
            
            const progressionResult = await sequelize.query(progressionQuery, {
                type: QueryTypes.SELECT,
                replacements: { userId }
            });
            
            const progression = progressionResult[0];
            
            // Temps d'étude cette semaine
            const tempsSemaineQuery = `
                SELECT COALESCE(SUM(pm.temps_passe_minutes), 0) as temps_semaine
                FROM progressions_modules pm
                JOIN inscriptions i ON pm.inscription_id = i.id
                WHERE i.user_id = :userId 
                AND pm.createdat >= date_trunc('week', CURRENT_DATE)
            `;
            
            const tempsSemaineResult = await sequelize.query(tempsSemaineQuery, {
                type: QueryTypes.SELECT,
                replacements: { userId }
            });
            
            const tempsSemaine = tempsSemaineResult[0].temps_semaine;

            return {
                progressionGlobale: parseFloat(progression.progression_globale) || 0,
                totalInscriptions: parseInt(progression.total_inscriptions) || 0,
                inscriptionsActives: parseInt(progression.inscriptions_actives) || 0,
                certificationsObtenues: parseInt(progression.certifications_obtenues) || 0,
                tempsTotalMinutes: parseInt(progression.temps_total_minutes) || 0,
                tempsTotalSemaine: parseInt(tempsSemaine) || 0
            };
            
        } catch (error) {
            console.error('❌ Erreur stats:', error);
            return {
                progressionGlobale: 0,
                totalInscriptions: 0,
                inscriptionsActives: 0,
                certificationsObtenues: 0,
                tempsTotalMinutes: 0,
                tempsTotalSemaine: 0
            };
        }
    }

    // Formation en cours (la plus récente non terminée)
    static async getFormationEnCours(userId) {
        const query = `
            SELECT 
                i.*,
                f.titre as formation_titre,
                f.description as formation_description,
                f.icone as formation_icone,
                f.nombre_modules,
                f.duree_heures,
                json_build_object(
                    'id', f.id,
                    'titre', f.titre,
                    'description', f.description,
                    'icone', f.icone,
                    'nombre_modules', f.nombre_modules,
                    'duree_heures', f.duree_heures
                ) as formation,
                -- Calculer le module actuel
                (
                    SELECT COUNT(*) + 1
                    FROM progressions_modules pm2
                    JOIN modules m2 ON pm2.module_id = m2.id
                    WHERE pm2.inscription_id = i.id 
                    AND pm2.statut = 'termine'
                    AND m2.formation_id = f.id
                ) as module_actuel
            FROM inscriptions i
            JOIN formations f ON i.formation_id = f.id
            WHERE i.user_id = :userId 
            AND i.statut = 'en_cours'
            ORDER BY i.date_inscription DESC
            LIMIT 1
        `;
        
        const result = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });
        
        return result[0] || null;
    }

    // Modules de progression pour une formation
    static async getModulesProgression(userId, formationId) {
        const query = `
            SELECT 
                m.*,
                COALESCE(pm.statut, 'non_commence') as statut,
                pm.progression_pourcentage,
                pm.temps_passe_minutes,
                pm.note,
                pm.date_debut,
                pm.date_fin,
                -- Déterminer si le module est disponible
                CASE 
                    WHEN m.ordre = 1 THEN true
                    WHEN EXISTS (
                        SELECT 1 FROM progressions_modules pm2 
                        JOIN modules m2 ON pm2.module_id = m2.id
                        JOIN inscriptions i2 ON pm2.inscription_id = i2.id
                        WHERE i2.user_id = :userId 
                        AND m2.formation_id = :formationId 
                        AND m2.ordre = m.ordre - 1 
                        AND pm2.statut = 'termine'
                    ) THEN true
                    ELSE false
                END as disponible
            FROM modules m
            LEFT JOIN progressions_modules pm ON (
                pm.module_id = m.id 
                AND pm.inscription_id = (
                    SELECT id FROM inscriptions 
                    WHERE user_id = :userId AND formation_id = :formationId 
                    ORDER BY date_inscription DESC LIMIT 1
                )
            )
            WHERE m.formation_id = :formationId
            ORDER BY m.ordre
        `;
        
        const result = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            replacements: { userId, formationId }
        });
        
        return result;
    }

    // Activités récentes
    static async getActivitesRecentes(userId) {
        const query = `
            SELECT 
                'module_complete' as type,
                'Module terminé' as titre,
                'Vous avez terminé "' || m.titre || '"' as description,
                pm.updatedat as createdat,
                pm.id
            FROM progressions_modules pm
            JOIN modules m ON pm.module_id = m.id
            JOIN inscriptions i ON pm.inscription_id = i.id
            WHERE i.user_id = :userId 
            AND pm.statut = 'termine'
            
            UNION ALL
            
            SELECT 
                'formation_started' as type,
                'Formation commencée' as titre,
                'Début de "' || f.titre || '"' as description,
                i.date_inscription as createdat,
                i.id
            FROM inscriptions i
            JOIN formations f ON i.formation_id = f.id
            WHERE i.user_id = :userId
            
            UNION ALL
            
            SELECT 
                'certification' as type,
                'Nouveau certificat' as titre,
                'Certificat "' || f.titre || '" obtenu' as description,
                i.date_certification as createdat,
                i.id
            FROM inscriptions i
            JOIN formations f ON i.formation_id = f.id
            WHERE i.user_id = :userId 
            AND i.certifie = true
            AND i.date_certification IS NOT NULL
            
            ORDER BY createdat DESC
            LIMIT 10
        `;
        
        const result = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });
        
        return result;
    }

    // Certifications obtenues
    static async getCertifications(userId) {
        const query = `
            SELECT 
                i.id,
                f.titre as formation_titre,
                i.date_certification,
                i.note_finale,
                f.icone as formation_icone
            FROM inscriptions i
            JOIN formations f ON i.formation_id = f.id
            WHERE i.user_id = :userId 
            AND i.certifie = true
            AND i.date_certification IS NOT NULL
            ORDER BY i.date_certification DESC
        `;
        
        const result = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });
        
        return result;
    }

    // Événements à venir
    static async getEvenementsProchains(userId) {
        const query = `
            SELECT 
                e.*,
                COUNT(pe.id) as participants_count
            FROM evenements e
            LEFT JOIN participations_evenements pe ON e.id = pe.evenement_id
            WHERE e.date_debut > NOW()
            AND e.statut = 'actif'
            AND (
                e.formation_id IS NULL 
                OR e.formation_id IN (
                    SELECT formation_id FROM inscriptions WHERE user_id = :userId
                )
            )
            GROUP BY e.id
            ORDER BY e.date_debut ASC
            LIMIT 6
        `;
        
        const result = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });
        
        return result;
    }

    // Messages récents
    static async getMessagesRecents(userId) {
        const query = `
            SELECT 
                m.*
            FROM messages m
            WHERE m.destinataire_id = :userId
            OR m.receiver_id = :userId
            ORDER BY m.createdat DESC
            LIMIT 5
        `;
        
        const result = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });
        
        return result;
    }

    // Compter messages non lus
    static async countMessagesNonLus(userId) {
        const query = `
            SELECT COUNT(*) as count
            FROM messages m
            WHERE (m.destinataire_id = :userId OR m.receiver_id = :userId)
            AND m.lu = false
        `;
        
        const result = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });
        
        return parseInt(result[0].count) || 0;
    }

    // Compter notifications non lues
    static async countNotificationsNonLues(userId) {
        const query = `
            SELECT COUNT(*) as count
            FROM notifications n
            WHERE n.user_id = :userId
            AND n.lu = false
        `;
        
        const result = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });
        
        return parseInt(result[0].count) || 0;
    }

    // API pour rafraîchir les statistiques
    static async refreshStats(req, res) {
        try {
            if (!req.session?.userId) {
                return res.status(401).json({ error: 'Non authentifié' });
            }

            const stats = await DashboardController.getStats(req.session.userId);
            res.json(stats);
            
        } catch (error) {
            console.error('💥 Erreur refresh stats:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }

    // API pour l'inscription aux événements
    static async inscriptionEvenement(req, res) {
        try {
            if (!req.session?.userId) {
                return res.status(401).json({ error: 'Non authentifié' });
            }

            const { eventId } = req.params;
            const userId = req.session.userId;

            // Vérifier si déjà inscrit
            const checkQuery = `
                SELECT id FROM participations_evenements 
                WHERE evenement_id = :eventId AND user_id = :userId
            `;
            const checkResult = await sequelize.query(checkQuery, {
                type: QueryTypes.SELECT,
                replacements: { eventId, userId }
            });

            if (checkResult.length > 0) {
                return res.json({ 
                    success: false, 
                    message: 'Vous êtes déjà inscrit à cet événement' 
                });
            }

            // Vérifier les places disponibles
            const eventQuery = `
                SELECT e.*, COUNT(pe.id) as participants_count
                FROM evenements e
                LEFT JOIN participations_evenements pe ON e.id = pe.evenement_id
                WHERE e.id = :eventId
                GROUP BY e.id
            `;
            const eventResult = await sequelize.query(eventQuery, {
                type: QueryTypes.SELECT,
                replacements: { eventId }
            });
            
            const event = eventResult[0];

            if (!event) {
                return res.json({ 
                    success: false, 
                    message: 'Événement introuvable' 
                });
            }

            if (event.max_participants && event.participants_count >= event.max_participants) {
                return res.json({ 
                    success: false, 
                    message: 'Événement complet' 
                });
            }

            // Inscrire l'utilisateur
            const insertQuery = `
                INSERT INTO participations_evenements (evenement_id, user_id, statut_participation, createdat, updatedat)
                VALUES (:eventId, :userId, 'confirme', NOW(), NOW())
            `;
            await sequelize.query(insertQuery, {
                type: QueryTypes.INSERT,
                replacements: { eventId, userId }
            });

            // Créer une notification
            const notifQuery = `
                INSERT INTO notifications (user_id, titre, contenu, type_notification, createdat, updatedat)
                VALUES (:userId, :titre, :contenu, :type, NOW(), NOW())
            `;
            await sequelize.query(notifQuery, {
                type: QueryTypes.INSERT,
                replacements: {
                    userId,
                    titre: 'Inscription confirmée',
                    contenu: `Votre inscription à l'événement "${event.titre}" a été confirmée.`,
                    type: 'evenement'
                }
            });

            console.log(`✅ Inscription utilisateur ${userId} à l'événement ${eventId}`);
            res.json({ 
                success: true, 
                message: 'Inscription confirmée avec succès' 
            });

        } catch (error) {
            console.error('💥 Erreur inscription événement:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur lors de l\'inscription' 
            });
        }
    }
}

export default DashboardController;