import { Router } from 'express';
import {
    Quiz,
    QuestionQuiz,
    ReponseQuestion,
    ProgressionModule,
    ProgressionPartie,
    TentativeQuiz,
    VueVideo,
    TelechargementDocument,
    User,
    Module,
    PartieModule,
    VideoPartie,
    DocumentPartie,
    Formation,
    Inscription
} from '../models/index.js';
import { ensureAuth } from '../middleware/auth.js';

const router = Router();

// Middleware pour vérifier l'authentification sur toutes les routes API
router.use(ensureAuth);

// === ROUTES POUR TEMPLATE INTERACTIF ===

// Soumettre un quiz (version enhanced)
router.post('/quiz/submit-enhanced', async (req, res) => {
    try {
        const { quizId, partieId, moduleId, answers } = req.body;
        const userId = req.user?.id || req.session.userId;

        // Récupérer le quiz avec questions et réponses
        const quiz = await Quiz.findByPk(quizId, {
            include: [{
                model: QuestionQuiz,
                as: 'questions',
                include: [{ model: ReponseQuestion, as: 'reponses' }]
            }]
        });

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz non trouvé' });
        }

        // Calculer le score
        let score = 0;
        let totalPoints = 0;
        const resultats = {};

        quiz.questions.forEach(question => {
            const questionId = question.id.toString();
            const userAnswerId = answers[questionId];
            const bonneReponse = question.reponses.find(r => r.est_correcte);
            const points = question.points || 1;

            totalPoints += points;
            resultats[questionId] = {
                bonneReponse: bonneReponse?.id,
                reponseUtilisateur: userAnswerId,
                correct: bonneReponse && userAnswerId == bonneReponse.id
            };

            if (resultats[questionId].correct) {
                score += points;
            }
        });

        const pourcentage = Math.round((score / totalPoints) * 100);
        const passed = pourcentage >= (quiz.note_passage || 80);

        // Sauvegarder la tentative
        const tentative = await TentativeQuiz.create({
            user_id: userId,
            quiz_id: quizId,
            score: score,
            pourcentage: pourcentage,
            reponses_utilisateur: answers,
            terminee: true,
            date_debut: new Date(),
            date_fin: new Date()
        });

        res.json({
            success: true,
            score,
            totalPoints,
            pourcentage,
            passed,
            resultats,
            message: passed ?
                'Félicitations ! Quiz réussi.' :
                `Score insuffisant. Il faut ${quiz.note_passage || 80}% pour réussir.`
        });

    } catch (error) {
        console.error('Erreur soumission quiz enhanced:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Marquer une vidéo comme terminée
router.post('/video/complete', async (req, res) => {
    try {
        const { partieId, moduleId, videoId, watchedPercentage } = req.body;
        const userId = req.user?.id || req.session.userId;

        if (videoId) {
            await VueVideo.upsert({
                user_id: userId,
                video_id: videoId,
                pourcentage_visionne: watchedPercentage || 100,
                terminee: true
            });
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Erreur completion vidéo:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Sauvegarder la progression vidéo
router.post('/video/progress', async (req, res) => {
    try {
        const { moduleId, partieId, currentTime, duration, progressPercentage } = req.body;
        const userId = req.user?.id || req.session.userId;

        // Pour l'instant, on peut simplement loguer la progression
        console.log(`Progression vidéo - User: ${userId}, Module: ${moduleId}, Progression: ${progressPercentage}%`);

        res.json({ success: true });

    } catch (error) {
        console.error('Erreur sauvegarde progression vidéo:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Télécharger un document
router.get('/documents/:documentId/download', async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user?.id || req.session.userId;

        const document = await DocumentPartie.findByPk(documentId);
        if (!document) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }

        // Enregistrer le téléchargement
        await TelechargementDocument.create({
            user_id: userId,
            document_id: documentId,
            date_telechargement: new Date()
        });

        // Pour l'instant, retourner les informations du document
        // En production, vous devriez servir le fichier réel
        res.json({
            success: true,
            document: {
                id: document.id,
                titre: document.titre,
                nom_fichier: document.nom_fichier,
                chemin_fichier: document.chemin_fichier
            }
        });

    } catch (error) {
        console.error('Erreur téléchargement document:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// === ROUTES QUIZ ===

// Récupérer les questions d'un quiz
router.get('/quiz/:quizId/questions', async (req, res) => {
    try {
        const { quizId } = req.params;
        const userId = req.user?.id || req.session.userId;

        const quiz = await Quiz.findByPk(quizId, {
            include: [
                {
                    model: QuestionQuiz,
                    as: 'questions',
                    include: [
                        {
                            model: ReponseQuestion,
                            as: 'reponses',
                            order: [['ordre', 'ASC']]
                        }
                    ],
                    order: [['ordre', 'ASC']]
                }
            ]
        });

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz non trouvé' });
        }

        // Vérifier les tentatives précédentes
        const tentativesPrecedentes = await TentativeQuiz.findAll({
            where: { 
                user_id: userId, 
                quiz_id: quizId 
            },
            order: [['createdAt', 'DESC']]
        });

        // Mélanger les questions si configuré
        let questions = quiz.questions;
        if (quiz.melanger_questions) {
            questions = [...questions].sort(() => Math.random() - 0.5);
        }

        res.json({
            id: quiz.id,
            titre: quiz.titre,
            description: quiz.description,
            instructions: quiz.instructions,
            duree_limite_minutes: quiz.duree_limite_minutes,
            nombre_tentatives_max: quiz.nombre_tentatives_max,
            note_passage: quiz.note_passage,
            tentatives_utilisees: tentativesPrecedentes.length,
            questions: questions.map(q => ({
                id: q.id,
                question: q.question,
                type_question: q.type_question,
                points: q.points,
                explication: q.explication,
                media_url: q.media_url,
                reponses: q.reponses.map(r => ({
                    id: r.id,
                    texte_reponse: r.texte_reponse,
                    // Ne pas exposer est_correcte côté client
                    ordre: r.ordre
                }))
            }))
        });

    } catch (error) {
        console.error('Erreur récupération quiz:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Soumettre les résultats d'un quiz
router.post('/quiz/result', async (req, res) => {
    try {
        const { 
            quizId, 
            partieId, 
            moduleId, 
            score, 
            correctAnswers, 
            totalQuestions, 
            userAnswers,
            tempsPasse 
        } = req.body;
        const userId = req.user?.id || req.session.userId;

        // Récupérer le quiz pour vérification
        const quiz = await Quiz.findByPk(quizId, {
            include: [{
                model: QuestionQuiz,
                as: 'questions',
                include: [{ model: ReponseQuestion, as: 'reponses' }]
            }]
        });

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz non trouvé' });
        }

        // Vérifier le nombre de tentatives
        const tentativesPrecedentes = await TentativeQuiz.count({
            where: { user_id: userId, quiz_id: quizId }
        });

        if (quiz.nombre_tentatives_max && tentativesPrecedentes >= quiz.nombre_tentatives_max) {
            return res.status(400).json({ error: 'Nombre maximum de tentatives atteint' });
        }

        // Calculer le score réel côté serveur pour sécurité
        let scoreReel = 0;
        const reponsesCorrectes = [];

        quiz.questions.forEach((question, index) => {
            const reponseCorrecte = question.reponses.find(r => r.est_correcte);
            const reponseUtilisateur = userAnswers[index];
            
            if (reponseCorrecte && reponseUtilisateur !== undefined) {
                const reponseCorrecteIndex = question.reponses.findIndex(r => r.est_correcte);
                if (reponseUtilisateur === reponseCorrecteIndex) {
                    scoreReel += question.points || 1;
                }
                reponsesCorrectes.push(reponseCorrecteIndex);
            }
        });

        const scorePoircentage = Math.round((scoreReel / quiz.questions.length) * 100);
        const reussit = scorePoircentage >= (quiz.note_passage || 70);

        // Créer la tentative
        const tentative = await TentativeQuiz.create({
            user_id: userId,
            quiz_id: quizId,
            numero_tentative: tentativesPrecedentes + 1,
            score: scoreReel,
            pourcentage: scorePoircentage,
            temps_passe_secondes: tempsPasse || 0,
            terminee: true,
            date_debut: new Date(Date.now() - (tempsPasse * 1000) || 0),
            date_fin: new Date(),
            reponses_utilisateur: {
                answers: userAnswers,
                correct_answers: reponsesCorrectes
            }
        });

        // Mettre à jour la progression de la partie
        if (partieId) {
            await ProgressionPartie.upsert({
                user_id: userId,
                partie_id: partieId,
                module_id: moduleId,
                statut: reussit ? 'terminee' : 'echouee',
                progression_pourcentage: reussit ? 100 : scorePoircentage,
                note: scorePoircentage,
                tentatives: (tentativesPrecedentes + 1)
            });
        }

        // Mettre à jour la progression du module si toutes les parties sont terminées
        if (moduleId) {
            await updateModuleProgression(userId, moduleId);
        }

        res.json({
            success: true,
            tentative_id: tentative.id,
            score_reel: scoreReel,
            pourcentage: scorePoircentage,
            reussit: reussit,
            message: reussit ? 'Quiz réussi !' : `Quiz échoué. Note de passage: ${quiz.note_passage || 70}%`
        });

    } catch (error) {
        console.error('Erreur soumission quiz:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// === ROUTES PROGRESSION ===

// Mettre à jour la progression d'une vidéo
router.post('/progression/video', async (req, res) => {
    try {
        const { partieId, moduleId, progression, tempsVisionne } = req.body;
        const userId = req.user?.id || req.session.userId;

        // Récupérer l'ID de la vidéo depuis la partie
        const partie = await PartieModule.findByPk(partieId, {
            include: [{ model: VideoPartie, as: 'videos' }]
        });

        if (!partie || !partie.videos || partie.videos.length === 0) {
            return res.status(404).json({ error: 'Vidéo non trouvée' });
        }

        const video = partie.videos[0];

        // Mettre à jour ou créer la vue vidéo
        await VueVideo.upsert({
            user_id: userId,
            video_id: video.id,
            temps_visionne_secondes: tempsVisionne,
            pourcentage_visionne: progression,
            terminee: progression >= 100,
            derniere_position_secondes: tempsVisionne
        });

        // Mettre à jour la progression de la partie
        await ProgressionPartie.upsert({
            user_id: userId,
            partie_id: partieId,
            module_id: moduleId,
            statut: progression >= 100 ? 'terminee' : 'en_cours',
            progression_pourcentage: progression,
            temps_passe_minutes: Math.ceil(tempsVisionne / 60)
        });

        // Mettre à jour la progression du module
        if (moduleId) {
            await updateModuleProgression(userId, moduleId);
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Erreur mise à jour progression vidéo:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Mettre à jour la progression d'une partie (général)
router.post('/progression/partie', async (req, res) => {
    try {
        const { partieId, moduleId, formationId, action, progression = 0 } = req.body;
        const userId = req.user?.id || req.session.userId;

        let statut = 'non_commence';
        let progressionPourcentage = progression;

        switch (action) {
            case 'start':
                statut = 'en_cours';
                progressionPourcentage = Math.max(progression, 10);
                break;
            case 'complete':
                statut = 'terminee';
                progressionPourcentage = 100;
                break;
            case 'update':
                statut = progression >= 100 ? 'terminee' : 'en_cours';
                progressionPourcentage = progression;
                break;
        }

        await ProgressionPartie.upsert({
            user_id: userId,
            partie_id: partieId,
            module_id: moduleId,
            statut: statut,
            progression_pourcentage: progressionPourcentage,
            date_debut: new Date(),
            date_fin: statut === 'terminee' ? new Date() : null
        });

        // Mettre à jour la progression du module
        if (moduleId) {
            await updateModuleProgression(userId, moduleId);
        }

        // Mettre à jour la progression de la formation
        if (formationId) {
            await updateFormationProgression(userId, formationId);
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Erreur mise à jour progression partie:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// === ROUTES DOCUMENTS ===

// Enregistrer le téléchargement d'un document
router.post('/document/download', async (req, res) => {
    try {
        const { documentId } = req.body;
        const userId = req.user?.id || req.session.userId;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        await TelechargementDocument.create({
            user_id: userId,
            document_id: documentId,
            date_telechargement: new Date(),
            adresse_ip: ip,
            user_agent: userAgent
        });

        res.json({ success: true });

    } catch (error) {
        console.error('Erreur enregistrement téléchargement:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// === ROUTES NOTES ===

// Sauvegarder les notes d'un utilisateur
router.post('/notes/save', async (req, res) => {
    try {
        const { formationId, moduleId, partieId, notes } = req.body;
        const userId = req.user?.id || req.session.userId;

        // Vous pouvez créer une table Notes si nécessaire
        // Pour l'instant, on peut stocker dans les données de progression
        if (partieId) {
            await ProgressionPartie.update(
                { 
                    donnees_progression: {
                        notes: notes,
                        last_updated: new Date()
                    }
                },
                { where: { user_id: userId, partie_id: partieId } }
            );
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Erreur sauvegarde notes:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Récupérer les notes d'un utilisateur
router.get('/notes/:partieId', async (req, res) => {
    try {
        const { partieId } = req.params;
        const userId = req.user?.id || req.session.userId;

        const progression = await ProgressionPartie.findOne({
            where: { user_id: userId, partie_id: partieId }
        });

        const notes = progression?.donnees_progression?.notes || '';

        res.json({ notes });

    } catch (error) {
        console.error('Erreur récupération notes:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// === FONCTIONS UTILITAIRES ===

async function updateModuleProgression(userId, moduleId) {
    try {
        // Récupérer toutes les parties du module
        const module = await Module.findByPk(moduleId, {
            include: [{ model: PartiesModule, as: 'parties' }]
        });

        if (!module || !module.parties.length) return;

        // Récupérer les progressions des parties
        const progressionsParties = await ProgressionPartie.findAll({
            where: { 
                user_id: userId, 
                module_id: moduleId 
            }
        });

        // Calculer la progression moyenne
        let totalProgression = 0;
        let partiesTerminees = 0;
        let tempsTotal = 0;

        module.parties.forEach(partie => {
            const progression = progressionsParties.find(p => p.partie_id === partie.id);
            if (progression) {
                totalProgression += progression.progression_pourcentage || 0;
                tempsTotal += progression.temps_passe_minutes || 0;
                if (progression.statut === 'terminee') {
                    partiesTerminees++;
                }
            }
        });

        const progressionMoyenne = Math.round(totalProgression / module.parties.length);
        const statutModule = partiesTerminees === module.parties.length ? 'terminee' : 
                            progressionMoyenne > 0 ? 'en_cours' : 'non_commence';

        // Mettre à jour ou créer la progression du module
        await ProgressionModule.upsert({
            user_id: userId,
            module_id: moduleId,
            statut: statutModule,
            progression_pourcentage: progressionMoyenne,
            temps_passe_minutes: tempsTotal,
            date_fin: statutModule === 'terminee' ? new Date() : null
        });

    } catch (error) {
        console.error('Erreur mise à jour progression module:', error);
    }
}

async function updateFormationProgression(userId, formationId) {
    try {
        // Récupérer tous les modules de la formation
        const formation = await Formation.findByPk(formationId, {
            include: [{ model: Module, as: 'modules' }]
        });

        if (!formation || !formation.modules.length) return;

        // Récupérer les progressions des modules
        const progressionsModules = await ProgressionModule.findAll({
            where: { 
                user_id: userId,
                module_id: formation.modules.map(m => m.id)
            }
        });

        // Calculer la progression de la formation
        let totalProgression = 0;
        let modulesTermines = 0;
        let tempsTotal = 0;

        formation.modules.forEach(module => {
            const progression = progressionsModules.find(p => p.module_id === module.id);
            if (progression) {
                totalProgression += progression.progression_pourcentage || 0;
                tempsTotal += progression.temps_passe_minutes || 0;
                if (progression.statut === 'terminee') {
                    modulesTermines++;
                }
            }
        });

        const progressionMoyenne = Math.round(totalProgression / formation.modules.length);
        const statutFormation = modulesTermines === formation.modules.length ? 'terminee' : 
                               progressionMoyenne > 0 ? 'en_cours' : 'non_commencee';

        // Mettre à jour l'inscription
        await Inscription.update({
            statut: statutFormation,
            progression_pourcentage: progressionMoyenne,
            temps_total_minutes: tempsTotal,
            date_certification: statutFormation === 'terminee' ? new Date() : null,
            certifie: statutFormation === 'terminee'
        }, {
            where: { 
                user_id: userId, 
                formation_id: formationId 
            }
        });

    } catch (error) {
        console.error('Erreur mise à jour progression formation:', error);
    }
}

export default router;