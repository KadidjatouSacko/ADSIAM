import { 
    User, 
    Formation, 
    Module, 
    Inscription, 
    ProgressionModule, 
    Evenement, 
    Quiz, 
    QuestionQuiz, 
    ReponseQuestion, 
    ContenusModule, // Maintenant disponible
    DocumentPartie, // Nom correct
    PartieModule, // Nom correct
    TentativeQuiz,
    TelechargementDocument
} from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize } from '../models/index.js'; // Ajoutez cette ligne si manquante
import { QueryTypes } from 'sequelize'; // Ajoutez cette ligne si manquante
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

// Afficher profil existant
export const showProfil = async (req, res) => {
    try {
        const userId = req.session.userId;
        const user = await User.findByPk(userId);
        const progressions = await ProgressionModule.findAll({ where: { user_id: userId } });

        res.render('etudiants/profil', { user, progressions, successMessage: req.flash?.('success') });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur lors de l'affichage du profil");
    }
};

// Afficher page création
export const showCreateProfil = (req, res) => {
    res.render('etudiants/nouveauProfil', { successMessage: req.flash?.('success') });
};

// Créer un profil
export const createProfil = async (req, res) => {
    try {
        const { prenom, nom, email, telephone, date_naissance, adresse, ville, code_postal, statut_professionnel, experience, presentation } = req.body;
        const newUser = await User.create({
            prenom, nom, email, telephone, date_naissance, adresse, ville, code_postal, statut: statut_professionnel, experience, presentation
        });

        req.session.userId = newUser.id;
        req.flash?.('success', 'Profil créé avec succès !');
        res.redirect('/etudiants/profil');
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur lors de la création du profil");
    }
};

// Afficher page modification
export const showUpdateProfil = async (req, res) => {
    try {
        const userId = req.session.userId;
        const user = await User.findByPk(userId);
        res.render('etudiants/nouveauProfil', { user, successMessage: req.flash?.('success') });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur lors de l'affichage de la modification");
    }
};

// Mettre à jour profil
export const updateProfil = async (req, res) => {
    try {
        const userId = req.session.userId;
        await User.update(req.body, { where: { id: userId } });

        req.flash?.('success', 'Modifications sauvegardées avec succès !');
        res.redirect('/etudiants/profil');
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur lors de la mise à jour du profil");
    }
};

// Supprimer profil
export const deleteProfil = async (req, res) => {
    try {
        const userId = req.session.userId;
        await User.destroy({ where: { id: userId } });
        req.session.destroy(() => {
            res.redirect('/');
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur lors de la suppression du profil");
    }
};

export async function showDashboard(req, res) {
    try {
        const userId = req.user?.id || req.session?.userId;
        if (!userId) return res.status(401).send('Utilisateur introuvable');

        const user = await User.findByPk(userId, {
            include: [
                { 
                    model: Inscription, 
                    as: 'inscriptions',
                    include: [{ model: Formation, as: 'formation' }]
                },
                { model: Evenement, as: 'evenements' },
                { model: ProgressionModule, as: 'progressions' }
            ]
        });

        if (!user) return res.status(404).send('Utilisateur introuvable');

        const progressions = user.progressions.map(p => ({
            titre: p.moduleNom,
            progression_pourcentage: p.pourcentage,
            moduleActuel: p.moduleActuel,
            modulesTotal: p.modulesTotal,
            tempsRestant: p.tempsRestant
        }));

        const stats = [
            { label: 'Formations terminées', value: user.inscriptions.length },
            { label: 'Progression globale', value: Math.round(user.progressions.reduce((a,b)=>a+b.pourcentage,0)/user.progressions.length || 0) }
        ];

        const activites = user.activites || [];
        const actionsRapides = user.actionsRapides || [];
        const evenements = user.evenements.map(evt => ({
            titre: evt.titre,
            jour: evt.date.getDate(),
            mois: evt.date.toLocaleString('fr-FR', { month: 'short' }),
            heure: evt.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            lieu: evt.lieu
        }));

        res.render('etudiants/dashboard-etudiant',{
            user: { ...user.dataValues, stats, activites, actionsRapides, evenements }, 
            progressions 
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur serveur');
    }
}

export async function showFormations(req, res) {
    try {
        const userId = req.user?.id || req.session?.userId;
        if (!userId) return res.status(401).send('Utilisateur introuvable');

        const user = await User.findByPk(userId, {
            include: [
                { 
                    model: Inscription, 
                    as: 'inscriptions',
                    include: [{ model: Formation, as: 'formation' }]
                },
                { model: ProgressionModule, as: 'progressions' }
            ]
        });

        if (!user) return res.status(404).send('Utilisateur introuvable');

        const formations = user.inscriptions.map(ins => {
            const f = ins.formation;
            const prog = user.progressions.find(p => p.formationId === f.id) || {};
            return {
                id: f.id,
                titre: f.titre,
                description: f.description,
                categorie: f.categorie,
                niveau: f.niveau,
                modulesTotal: f.modulesTotal,
                tempsTotal: f.tempsTotal,
                progressionPourcentage: prog.pourcentage || 0,
                moduleActuel: prog.moduleActuel || 0,
                dernierAcces: ins.dernierAcces,
                statut: ins.statut,
                certificat: ins.certificatDisponible || false
            };
        });

        const stats = {
            total: formations.length,
            terminees: formations.filter(f => f.statut === 'completed').length,
            enCours: formations.filter(f => f.statut === 'in-progress').length,
            progressionMoyenne: formations.length
                ? Math.round(formations.reduce((sum, f) => sum + f.progressionPourcentage, 0) / formations.length)
                : 0
        };

        res.render('etudiants/formations-etudiant', {
            user,
            formations,
            stats
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur serveur');
    }
}

export async function showMessagerie(req, res) {
    try {
        const userId = req.user?.id || req.session?.userId;
        if (!userId) return res.status(401).send('Utilisateur introuvable');

        const user = await User.findByPk(userId, {
            include: [
                {
                    model: Conversation,
                    as: 'conversations',
                    include: [
                        { model: Message, as: 'messages', order: [['createdAt', 'ASC']] }
                    ]
                }
            ]
        });

        if (!user) return res.status(404).send('Utilisateur introuvable');

        const stats = {
            unreadMessages: user.conversations.reduce(
                (sum, c) => sum + c.messages.filter(m => !m.lu && m.receiverId === userId).length, 0
            ),
            activeFormateurs: [...new Set(user.conversations
                .filter(c => c.type === 'formateur')
                .map(c => c.participants.filter(p => p.role === 'formateur').map(f => f.id))
                .flat()
            )].length,
            totalConversations: user.conversations.length,
            avgResponseTime: '24h'
        };

        res.render('etudiants/messagerie-etudiant', { user, conversations: user.conversations, stats });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur serveur');
    }
}



// API pour sauvegarder la progression vidéo
export const saveVideoProgress = async (req, res) => {
    try {
        const userId = req.user?.id || req.session?.userId;
        const { moduleId, timeWatched, totalDuration, completed } = req.body;

        if (!userId || !moduleId) {
            return res.status(400).json({ error: 'Données manquantes' });
        }

        const [progression, created] = await ProgressionModule.findOrCreate({
            where: { user_id: userId, module_id: moduleId },
            defaults: {
                statut: 'en_cours',
                progression_pourcentage: 0,
                temps_passe_minutes: 0
            }
        });

        const progressPercentage = totalDuration > 0 ? 
            Math.min(100, Math.round((timeWatched / totalDuration) * 100)) : 0;

        await progression.update({
            temps_passe_minutes: Math.max(progression.temps_passe_minutes, Math.round(timeWatched / 60)),
            progression_pourcentage: Math.max(progression.progression_pourcentage, progressPercentage),
            statut: completed || progressPercentage >= 90 ? 'termine' : 'en_cours',
            date_fin: completed || progressPercentage >= 90 ? new Date() : null
        });

        await updateFormationProgress(userId, moduleId);

        res.json({ 
            success: true, 
            progression: progressPercentage,
            completed: progression.statut === 'termine'
        });

    } catch (error) {
        console.error('Erreur sauvegarde progression vidéo:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// API pour soumettre un quiz
export const submitQuiz = async (req, res) => {
    try {
        const userId = req.user?.id || req.session?.userId;
        const { moduleId, answers, score } = req.body;

        if (!userId || !moduleId || !answers) {
            return res.status(400).json({ error: 'Données manquantes' });
        }

        const tentative = await TentativeQuiz.create({
            user_id: userId,
            quiz_id: req.body.quizId,
            numero_tentative: 1,
            score: score || 0,
            pourcentage: score || 0,
            terminee: true,
            date_debut: new Date(),
            date_fin: new Date(),
            reponses_utilisateur: answers
        });

        if (score >= 70) {
            await ProgressionModule.update({
                statut: 'termine',
                progression_pourcentage: 100,
                note: score,
                date_fin: new Date()
            }, {
                where: { user_id: userId, module_id: moduleId }
            });

            await updateFormationProgress(userId, moduleId);
        }

        res.json({ 
            success: true, 
            passed: score >= 70,
            score: score,
            tentativeId: tentative.id
        });

    } catch (error) {
        console.error('Erreur soumission quiz:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// API pour sauvegarder le temps passé
export const saveTimeSpent = async (req, res) => {
    try {
        const userId = req.user?.id || req.session?.userId;
        const { moduleId, timeSpent } = req.body;

        if (!userId || !moduleId || timeSpent === undefined) {
            return res.status(400).json({ error: 'Données manquantes' });
        }

        await ProgressionModule.update({
            temps_passe_minutes: Math.max(0, Math.round(timeSpent / 60))
        }, {
            where: { user_id: userId, module_id: moduleId }
        });

        res.json({ success: true });

    } catch (error) {
        console.error('Erreur sauvegarde temps:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// API pour télécharger un document
export const downloadDocument = async (req, res) => {
    try {
        const documentId = req.params.documentId;
        const userId = req.user?.id || req.session?.userId;

        const document = await DocumentPartie.findByPk(documentId);
        
        if (!document) {
            return res.status(404).json({ error: 'Document introuvable' });
        }

        if (document.acces_connecte_uniquement && !userId) {
            return res.status(401).json({ error: 'Connexion requise' });
        }

        await document.increment('telechargements_count');

        if (userId) {
            await TelechargementDocument.create({
                user_id: userId,
                document_id: documentId,
                date_telechargement: new Date(),
                adresse_ip: req.ip,
                user_agent: req.get('User-Agent')
            });
        }

        const filePath = document.chemin_fichier;
        res.download(filePath, document.nom_fichier);

    } catch (error) {
        console.error('Erreur téléchargement document:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Fonction utilitaire pour mettre à jour la progression globale de la formation
async function updateFormationProgress(userId, moduleId) {
    try {
        const module = await Module.findByPk(moduleId, {
            attributes: ['formation_id']
        });

        if (!module) return;

        const allModules = await Module.findAll({
            where: { formation_id: module.formation_id },
            attributes: ['id']
        });

        const progressions = await ProgressionModule.findAll({
            where: { 
                user_id: userId,
                module_id: { [Op.in]: allModules.map(m => m.id) }
            },
            attributes: ['progression_pourcentage', 'statut']
        });

        const totalModules = allModules.length;
        const completedModules = progressions.filter(p => p.statut === 'termine').length;
        const averageProgress = progressions.length > 0 ? 
            progressions.reduce((sum, p) => sum + (p.progression_pourcentage || 0), 0) / totalModules : 0;

        const newStatus = completedModules === totalModules ? 'termine' : 'en_cours';
        
        await Inscription.update({
            progression_pourcentage: Math.round(averageProgress),
            statut: newStatus,
            date_fin_prevue: newStatus === 'termine' ? new Date() : null,
            certifie: newStatus === 'termine'
        }, {
            where: { 
                user_id: userId, 
                formation_id: module.formation_id 
            }
        });

        console.log(`Progression formation mise à jour: ${Math.round(averageProgress)}% (${completedModules}/${totalModules} modules)`);

    } catch (error) {
        console.error('Erreur mise à jour progression formation:', error);
    }
}

export const showFormationInteractive = async (req, res) => {
    try {
        const { formationId, moduleNumber } = req.params;
        const userId = req.session.userId;

        console.log(`📚 Chargement formation interactive - Formation: ${formationId}, Module: ${moduleNumber}, User: ${userId}`);

        // 1. Vérifier que l'utilisateur est inscrit à cette formation
        const inscription = await sequelize.query(`
            SELECT i.*, f.titre as formation_titre
            FROM inscriptions i
            JOIN formations f ON i.formation_id = f.id
            WHERE i.user_id = :userId AND i.formation_id = :formationId
        `, {
            type: QueryTypes.SELECT,
            replacements: { userId, formationId }
        });

        if (inscription.length === 0) {
            console.log(`❌ Utilisateur ${userId} non inscrit à la formation ${formationId}`);
            req.flash('error', 'Vous n\'êtes pas inscrit à cette formation');
            return res.redirect('/etudiant/formations');
        }

        // 2. Récupérer les données de la formation
        const [formation] = await sequelize.query(`
            SELECT 
                f.*,
                i.progression_pourcentage as progression_inscription,
                i.statut as statut_inscription,
                i.temps_total_minutes,
                i.date_inscription
            FROM formations f
            JOIN inscriptions i ON f.id = i.formation_id
            WHERE f.id = :formationId AND i.user_id = :userId
        `, {
            type: QueryTypes.SELECT,
            replacements: { formationId, userId }
        });

        if (!formation) {
            console.log(`❌ Formation ${formationId} non trouvée`);
            return res.status(404).render('error', { 
                message: 'Formation non trouvée',
                layout: 'layouts/main'
            });
        }

        // 3. Récupérer tous les modules de la formation avec leur progression
        const modules = await sequelize.query(`
            SELECT 
                m.*,
                COALESCE(pm.statut, 'non_commence') as statut,
                COALESCE(pm.progression_pourcentage, 0) as progression_module,
                pm.temps_passe_minutes,
                pm.date_debut,
                pm.date_fin
            FROM modules m
            LEFT JOIN progressions_modules pm ON (
                m.id = pm.module_id 
                AND pm.user_id = :userId
                AND pm.inscription_id = :inscriptionId
            )
            WHERE m.formation_id = :formationId
            ORDER BY m.ordre ASC
        `, {
            type: QueryTypes.SELECT,
            replacements: { 
                formationId, 
                userId, 
                inscriptionId: inscription[0].id 
            }
        });

        // 4. Trouver le module actuel
        const moduleActuel = modules.find(m => m.ordre == moduleNumber);
        if (!moduleActuel) {
            console.log(`❌ Module ${moduleNumber} non trouvé dans formation ${formationId}`);
            return res.status(404).render('error', { 
                message: 'Module non trouvé',
                layout: 'layouts/main'
            });
        }

        // 5. Récupérer les parties du module
        const partiesModule = await sequelize.query(`
            SELECT *
            FROM parties_modules
            WHERE module_id = :moduleId
            ORDER BY ordre ASC
        `, {
            type: QueryTypes.SELECT,
            replacements: { moduleId: moduleActuel.id }
        });

        // 6. Récupérer le contenu vidéo du module
        let contenuVideo = null;
        if (partiesModule.length > 0) {
            const contenusVideo = await sequelize.query(`
                SELECT 
                    cm.*,
                    vp.url_video,
                    vp.duree_secondes as video_duree_secondes,
                    vp.qualite as video_qualite
                FROM contenus_module cm
                LEFT JOIN videos_parties vp ON cm.id = vp.partie_id
                WHERE cm.module_id = :moduleId 
                AND cm.type_contenu = 'video'
                AND cm.actif = true
                ORDER BY cm.ordre ASC
                LIMIT 1
            `, {
                type: QueryTypes.SELECT,
                replacements: { moduleId: moduleActuel.id }
            });

            contenuVideo = contenusVideo[0] || null;
        }

        // 7. Récupérer le quiz du module
        let quiz = null;
        if (partiesModule.length > 0) {
            const quizData = await sequelize.query(`
                SELECT 
                    q.*,
                    COUNT(qq.id) as nombre_questions
                FROM quiz q
                LEFT JOIN questions_quiz qq ON q.id = qq.quiz_id
                WHERE q.partie_id IN (
                    SELECT id FROM parties_modules WHERE module_id = :moduleId
                )
                GROUP BY q.id
                ORDER BY q.id ASC
                LIMIT 1
            `, {
                type: QueryTypes.SELECT,
                replacements: { moduleId: moduleActuel.id }
            });

            if (quizData.length > 0) {
                const quizBase = quizData[0];
                
                // Récupérer les questions du quiz
                const questions = await sequelize.query(`
                    SELECT 
                        qq.*,
                        JSON_AGG(
                            JSON_BUILD_OBJECT(
                                'id', rq.id,
                                'texte_reponse', rq.texte_reponse,
                                'est_correcte', rq.est_correcte,
                                'ordre', rq.ordre
                            ) ORDER BY rq.ordre
                        ) as reponses
                    FROM questions_quiz qq
                    LEFT JOIN reponses_questions rq ON qq.id = rq.question_id
                    WHERE qq.quiz_id = :quizId
                    GROUP BY qq.id
                    ORDER BY qq.ordre ASC
                `, {
                    type: QueryTypes.SELECT,
                    replacements: { quizId: quizBase.id }
                });

                quiz = {
                    ...quizBase,
                    questions: questions || []
                };
            }
        }

        // 8. Récupérer les documents téléchargeables
        const documents = await sequelize.query(`
            SELECT 
                dp.*,
                CASE 
                    WHEN dp.taille_fichier IS NOT NULL THEN dp.taille_fichier
                    ELSE 0
                END as taille_fichier_safe
            FROM documents_parties dp
            WHERE dp.partie_id IN (
                SELECT id FROM parties_modules WHERE module_id = :moduleId
            )
            ORDER BY dp.id ASC
        `, {
            type: QueryTypes.SELECT,
            replacements: { moduleId: moduleActuel.id }
        });

        // 9. Déterminer la navigation (modules précédent/suivant)
        const moduleIndex = modules.findIndex(m => m.id === moduleActuel.id);
        const modulePrecedent = moduleIndex > 0 ? modules[moduleIndex - 1] : null;
        const moduleSuivant = moduleIndex < modules.length - 1 ? modules[moduleIndex + 1] : null;

        // 10. Calculer les statistiques de progression
        const modulesTermines = modules.filter(m => m.statut === 'termine').length;
        const progressionGlobale = formation.progression_inscription || 0;
        const progressionModule = moduleActuel.progression_module || 0;

       // 11. Marquer le début du module si première visite
if (moduleActuel.statut === 'non_commence') {
    // Vérifier si une progression existe déjà
    const existingProgress = await sequelize.query(`
        SELECT id FROM progressions_modules 
        WHERE user_id = :userId AND module_id = :moduleId
    `, {
        type: QueryTypes.SELECT,
        replacements: { userId, moduleId: moduleActuel.id }
    });

    if (existingProgress.length === 0) {
        await sequelize.query(`
            INSERT INTO progressions_modules (
                user_id, module_id, inscription_id, statut, 
                date_debut, progression_pourcentage, 
                createdat, updatedat
            )
            VALUES (
                :userId, :moduleId, :inscriptionId, 'en_cours',
                NOW(), 0,
                NOW(), NOW()
            )
        `, {
            replacements: {
                userId,
                moduleId: moduleActuel.id,
                inscriptionId: inscription[0].id
            }
        });
    } else {
        await sequelize.query(`
            UPDATE progressions_modules 
            SET statut = 'en_cours',
                date_debut = COALESCE(date_debut, NOW()),
                updatedat = NOW()
            WHERE user_id = :userId AND module_id = :moduleId
        `, {
            replacements: { userId, moduleId: moduleActuel.id }
        });
    }

    moduleActuel.statut = 'en_cours';
}

        // 12. Mettre à jour la dernière activité de l'inscription
        await sequelize.query(`
            UPDATE inscriptions 
            SET updatedat = NOW()
            WHERE id = :inscriptionId
        `, {
            replacements: { inscriptionId: inscription[0].id }
        });

        // 13. Données pour le template
        const templateData = {
            // Données principales
            formation,
            modules,
            moduleActuel,
            
            // Contenu du module
            contenuVideo,
            quiz,
            documents,
            
            // Navigation
            modulePrecedent,
            moduleSuivant,
            
            // Progression
            progression: progressionGlobale,
            progressionModule,
            modulesTermines,
            
            // Utilisateur
            user: req.session.user || { id: userId },
            
            // Métadonnées
            currentPage: 'formation',
            pageTitle: `${formation.titre} - Module ${moduleActuel.ordre}`,
            
            // Désactiver le layout principal
            layout: false
        };

        console.log(`✅ Formation interactive chargée - ${modules.length} modules, progression: ${progressionGlobale}%`);

        // 14. Rendre le template
        res.render('formations/formation-interactive', templateData);

    } catch (error) {
        console.error('❌ Erreur dans showFormationInteractive:', error);
        console.error('Stack trace:', error.stack);
        
        // Log détaillé pour debug
        console.error('Paramètres reçus:', {
            formationId: req.params.formationId,
            moduleNumber: req.params.moduleNumber,
            userId: req.session.userId
        });

        res.status(500).render('error', { 
            message: 'Erreur lors du chargement de la formation',
            error: process.env.NODE_ENV === 'development' ? error : {},
            layout: 'layouts/main'
        });
    }
}

// Redirection vers le premier module d'une formation
export const redirectToFirstModule = async (req, res) => {
    try {
        const formationId = req.params.formationId;
        const userId = req.user?.id || req.session?.userId;

        const inscription = await Inscription.findOne({
            where: { user_id: userId, formation_id: formationId }
        });

        if (!inscription) {
            return res.redirect(`/formations/${formationId}?error=not_enrolled`);
        }

        const progressions = await ProgressionModule.findAll({
            where: { user_id: userId },
            include: [{
                model: Module,
                as: 'module',
                where: { formation_id: formationId },
                attributes: ['ordre']
            }],
            order: [[{ model: Module, as: 'module' }, 'ordre', 'ASC']]
        });

        let targetModule = 1;
        
        for (const prog of progressions) {
            if (prog.statut !== 'termine') {
                targetModule = prog.module.ordre;
                break;
            }
        }

        res.redirect(`/formation/${formationId}/module/${targetModule}`);

    } catch (error) {
        console.error('Erreur redirection module:', error);
        res.redirect(`/formations/${formationId}`);
    }
};