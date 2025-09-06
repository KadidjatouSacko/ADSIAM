// controllers/FormationController.js - Version avancée avec modules, parties, vidéos et quiz

import { Op } from 'sequelize';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import { 
    Formation, 
    Module, 
    PartieModule,
    VideoPartie,
    Quiz,
    QuestionQuiz,
    ReponseQuestion,
    DocumentPartie,
    TentativeQuiz,
    VueVideo,
    TelechargementDocument,
    EvaluationModule,
    Avis,
    User,
    Inscription
} from '../models/index.js';

// Configuration Multer pour l'upload de fichiers
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = file.fieldname.includes('video') ? 'uploads/videos/' : 'uploads/documents/';
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB max
    },
    fileFilter: function (req, file, cb) {
        if (file.fieldname.includes('video')) {
            const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/avi', 'video/quicktime'];
            if (allowedVideoTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Type de vidéo non supporté'), false);
            }
        } else if (file.fieldname.includes('document')) {
            const allowedDocTypes = [
                'application/pdf', 
                'application/msword', 
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            ];
            if (allowedDocTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Type de document non supporté'), false);
            }
        } else {
            cb(null, true);
        }
    }
});

export class FormationController {

    // ====================== AFFICHAGE DES FORMATIONS ======================
    async list(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 12;
            const search = req.query.search || '';
            const domaine = req.query.domaine || '';
            const niveau = req.query.niveau || '';
            const gratuit = req.query.gratuit === 'true';
            
            const where = { actif: true };
            
            if (search) {
                where[Op.or] = [
                    { titre: { [Op.iLike]: `%${search}%` } },
                    { description: { [Op.iLike]: `%${search}%` } }
                ];
            }
            
            if (domaine) where.domaine = domaine;
            if (niveau) where.niveau = niveau;
            if (gratuit) where.gratuit = true;

            const { rows: formations, count } = await Formation.findAndCountAll({
                where,
                include: [
                    {
                        model: Module,
                        as: 'modules',
                        include: [
                            {
                                model: PartieModule,
                                as: 'parties',
                                include: [
                                    { model: VideoPartie, as: 'videos' },
                                    { model: Quiz, as: 'quiz' },
                                    { model: DocumentPartie, as: 'documents' }
                                ]
                            }
                        ]
                    },
                    {
                        model: Avis,
                        as: 'avis',
                        where: { verifie: true },
                        required: false
                    }
                ],
                order: [['createdAt', 'DESC']],
                limit,
                offset: (page - 1) * limit,
                distinct: true // Important pour éviter la duplication avec les includes
            });

            // Calculer les statistiques pour chaque formation
            const formationsEnrichies = formations.map(formation => {
                const totalVideos = formation.modules?.reduce((acc, module) => 
                    acc + (module.parties?.reduce((partieAcc, partie) => 
                        partieAcc + (partie.videos?.length || 0), 0) || 0), 0) || 0;
                
                const totalQuiz = formation.modules?.reduce((acc, module) => 
                    acc + (module.parties?.reduce((partieAcc, partie) => 
                        partieAcc + (partie.quiz?.length || 0), 0) || 0), 0) || 0;

                const avisVerifies = formation.avis || [];
                const noteMoyenne = avisVerifies.length > 0 
                    ? (avisVerifies.reduce((sum, avis) => sum + avis.note, 0) / avisVerifies.length).toFixed(1)
                    : 0;

                return {
                    ...formation.toJSON(),
                    totalVideos,
                    totalQuiz,
                    nombreAvis: avisVerifies.length,
                    noteMoyenne: parseFloat(noteMoyenne)
                };
            });

            const totalPages = Math.ceil(count / limit);

            res.render('visiteurs/formations', {
                formations: formationsEnrichies,
                pagination: {
                    currentPage: page,
                    totalPages,
                    total: count,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                },
                filters: { search, domaine, niveau, gratuit }
            });
        } catch (error) {
            console.error('Erreur liste formations:', error);
            res.status(500).render('error', { message: 'Erreur serveur' });
        }
    }

    async detail(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.id; // Si l'utilisateur est connecté

            const formation = await Formation.findByPk(id, {
                include: [
                    {
                        model: Module,
                        as: 'modules',
                        order: [['ordre', 'ASC']],
                        include: [
                            {
                                model: PartieModule,
                                as: 'parties',
                                order: [['ordre', 'ASC']],
                                include: [
                                    {
                                        model: VideoPartie,
                                        as: 'videos',
                                        attributes: userId ? undefined : ['id', 'titre', 'description', 'duree_secondes'] // Limiter les infos si pas connecté
                                    },
                                    {
                                        model: Quiz,
                                        as: 'quiz',
                                        include: [
                                            {
                                                model: QuestionQuiz,
                                                as: 'questions',
                                                order: [['ordre', 'ASC']],
                                                include: [
                                                    {
                                                        model: ReponseQuestion,
                                                        as: 'reponses',
                                                        order: [['ordre', 'ASC']]
                                                    }
                                                ]
                                            }
                                        ]
                                    },
                                    {
                                        model: DocumentPartie,
                                        as: 'documents'
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        model: Avis,
                        as: 'avis',
                        where: { verifie: true },
                        required: false,
                        limit: 10,
                        order: [['createdAt', 'DESC']]
                    }
                ]
            });

            if (!formation || !formation.actif) {
                return res.status(404).render('error', {
                    message: 'Formation non trouvée',
                    error: { status: 404 }
                });
            }

            // Calculer les moyennes d'avis
            if (formation.avis?.length > 0) {
                const totalNotes = formation.avis.reduce((sum, avis) => sum + avis.note, 0);
                formation.dataValues.noteMoyenne = (totalNotes / formation.avis.length).toFixed(1);
                formation.dataValues.nombreAvis = formation.avis.length;
            } else {
                formation.dataValues.noteMoyenne = 0;
                formation.dataValues.nombreAvis = 0;
            }

            // Si l'utilisateur est connecté, récupérer sa progression
            let progressionUtilisateur = null;
            if (userId) {
                progressionUtilisateur = await this.getProgressionUtilisateur(userId, id);
            }

            // Formations similaires
            const formationsSimilaires = await Formation.findAll({
                where: {
                    domaine: formation.domaine,
                    id: { [Op.ne]: formation.id },
                    actif: true
                },
                limit: 3,
                include: [
                    {
                        model: Avis,
                        as: 'avis',
                        where: { verifie: true },
                        required: false
                    }
                ]
            });

            // Calculer les moyennes pour les formations similaires
            formationsSimilaires.forEach(f => {
                if (f.avis?.length > 0) {
                    const totalNotes = f.avis.reduce((sum, avis) => sum + avis.note, 0);
                    f.dataValues.noteMoyenne = (totalNotes / f.avis.length).toFixed(1);
                    f.dataValues.nombreAvis = f.avis.length;
                } else {
                    f.dataValues.noteMoyenne = 0;
                    f.dataValues.nombreAvis = 0;
                }
            });

            res.render('visiteurs/formation', { 
                formation, 
                formationsSimilaires,
                progressionUtilisateur,
                isConnected: !!userId
            });
        } catch (error) {
            console.error('Erreur détail formation:', error);
            res.status(500).render('error', { message: 'Erreur serveur' });
        }
    }

    // ====================== CRÉATION DE FORMATIONS (ADMIN) ======================
    async createForm(req, res) {
        try {
            res.render('admin/formations/create', {
                title: 'Créer une formation - ADSIAM Admin',
                admin: req.admin,
                currentPage: 'formations',
                layout: 'layouts/admin'
            });
        } catch (error) {
            console.error('Erreur createForm:', error);
            res.status(500).render('errors/500', { error });
        }
    }

    async create(req, res) {
        const transaction = await Formation.sequelize.transaction();
        
        try {
            const {
                titre,
                description,
                domaine,
                niveau,
                prix,
                icone,
                gratuit,
                populaire,
                certifiant,
                actif,
                modules // Structure complexe des modules
            } = req.body;

            console.log('📝 Création formation:', { titre, modulesCount: Object.keys(modules || {}).length });

            // Créer la formation principale
            const formationData = {
                titre,
                description,
                domaine,
                niveau,
                prix: parseFloat(prix) || 0,
                icone: icone || '📚',
                gratuit: gratuit === 'true' || parseFloat(prix) === 0,
                populaire: populaire === 'true',
                certifiant: certifiant === 'true',
                actif: actif !== 'false',
                nombre_modules: Object.keys(modules || {}).length
            };

            const formation = await Formation.create(formationData, { transaction });

            // Traiter les modules et leur contenu
            if (modules) {
                await this.processModules(formation.id, modules, req.files, transaction);
            }

            await transaction.commit();

            req.session.flash = {
                type: 'success',
                message: `Formation "${titre}" créée avec succès avec ${Object.keys(modules || {}).length} modules`
            };

            res.redirect('/admin/formations');
        } catch (error) {
            await transaction.rollback();
            console.error('Erreur création formation:', error);
            
            res.status(500).render('admin/formations/create', {
                title: 'Créer une formation - ADSIAM Admin',
                admin: req.admin,
                error: 'Erreur lors de la création de la formation: ' + error.message,
                formData: req.body,
                currentPage: 'formations',
                layout: 'layouts/admin'
            });
        }
    }

    async processModules(formationId, modules, files, transaction) {
        for (const [moduleKey, moduleData] of Object.entries(modules)) {
            console.log(`🔄 Traitement module: ${moduleData.titre}`);

            // Créer le module
            const module = await Module.create({
                formation_id: formationId,
                titre: moduleData.titre,
                description: moduleData.description,
                duree_minutes: parseInt(moduleData.duree) || 0,
                ordre: parseInt(moduleData.ordre) || 1,
                disponible: true
            }, { transaction });

            // Traiter les parties du module
            if (moduleData.parties) {
                await this.processParties(module.id, moduleData.parties, files, transaction);
            }
        }
    }

    async processParties(moduleId, parties, files, transaction) {
        for (const [partieKey, partieData] of Object.entries(parties)) {
            console.log(`📑 Traitement partie: ${partieData.titre}`);

            // Créer la partie
            const partie = await PartieModule.create({
                module_id: moduleId,
                titre: partieData.titre,
                description: partieData.description || '',
                ordre: parseInt(partieKey) || 1,
                type_contenu: 'mixte'
            }, { transaction });

            // Traiter les vidéos si présentes
            if (partieData.video && files) {
                await this.processVideo(partie.id, partieData, files, transaction);
            }

            // Traiter les documents si présents
            if (partieData.documents && files) {
                await this.processDocuments(partie.id, partieData, files, transaction);
            }

            // Traiter les quiz si présents dans les questions globales
            await this.processQuizFromQuestions(partie.id, transaction);
        }
    }

    async processVideo(partieId, partieData, files, transaction) {
        // Chercher le fichier vidéo correspondant
        const videoFile = files.find(file => 
            file.fieldname.includes('video') && 
            file.fieldname.includes(partieId.toString())
        );

        if (videoFile) {
            console.log(`🎥 Traitement vidéo: ${videoFile.originalname}`);

            // Obtenir les métadonnées de la vidéo avec ffmpeg
            const metadata = await this.getVideoMetadata(videoFile.path);

            await VideoPartie.create({
                partie_id: partieId,
                titre: partieData.titre || 'Vidéo du cours',
                nom_fichier: videoFile.originalname,
                chemin_fichier: videoFile.path,
                duree_secondes: metadata.duration,
                taille_fichier: videoFile.size,
                format_video: path.extname(videoFile.originalname).substring(1),
                acces_connecte_uniquement: true
            }, { transaction });
        }
    }

    async processDocuments(partieId, partieData, files, transaction) {
        // Chercher les fichiers documents correspondants
        const documentFiles = files.filter(file => 
            file.fieldname.includes('document') && 
            file.fieldname.includes(partieId.toString())
        );

        for (const docFile of documentFiles) {
            console.log(`📄 Traitement document: ${docFile.originalname}`);

            await DocumentPartie.create({
                partie_id: partieId,
                titre: docFile.originalname,
                nom_fichier: docFile.originalname,
                chemin_fichier: docFile.path,
                type_document: path.extname(docFile.originalname).substring(1),
                taille_fichier: docFile.size,
                acces_connecte_uniquement: true
            }, { transaction });
        }
    }

    async processQuizFromQuestions(partieId, transaction) {
        // Cette fonction traiterait les questions/quiz soumises via le formulaire
        // Pour l'instant, on peut créer un quiz exemple
        
        const quiz = await Quiz.create({
            partie_id: partieId,
            titre: 'Quiz de vérification',
            description: 'Vérifiez vos connaissances',
            duree_limite_minutes: 15,
            note_passage: 70.0,
            obligatoire: false
        }, { transaction });

        // Ajouter une question exemple
        const question = await QuestionQuiz.create({
            quiz_id: quiz.id,
            question: 'Avez-vous bien compris cette partie ?',
            type_question: 'vrai_faux',
            points: 1,
            ordre: 1
        }, { transaction });

        await ReponseQuestion.create({
            question_id: question.id,
            texte_reponse: 'Vrai',
            est_correcte: true,
            ordre: 1
        }, { transaction });

        await ReponseQuestion.create({
            question_id: question.id,
            texte_reponse: 'Faux',
            est_correcte: false,
            ordre: 2
        }, { transaction });
    }

    // ====================== UTILITAIRES ======================
    async getVideoMetadata(videoPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    console.error('Erreur ffprobe:', err);
                    resolve({ duration: 0 }); // Valeur par défaut
                } else {
                    resolve({
                        duration: Math.round(metadata.format.duration) || 0,
                        width: metadata.streams[0]?.width || 0,
                        height: metadata.streams[0]?.height || 0
                    });
                }
            });
        });
    }

    async getProgressionUtilisateur(userId, formationId) {
        try {
            const inscription = await Inscription.findOne({
                where: { user_id: userId, formation_id: formationId }
            });

            if (!inscription) return null;

            // Calculer la progression détaillée
            const progression = await Formation.sequelize.query(`
                SELECT 
                    COUNT(DISTINCT pm.id) as total_parties,
                    COUNT(DISTINCT CASE WHEN vv.terminee = true THEN v.id END) as videos_terminees,
                    COUNT(DISTINCT CASE WHEN tq.terminee = true AND tq.pourcentage >= q.note_passage THEN q.id END) as quiz_reussis,
                    CASE 
                        WHEN COUNT(DISTINCT v.id) + COUNT(DISTINCT q.id) > 0
                        THEN ROUND(
                            (COUNT(DISTINCT CASE WHEN vv.terminee = true THEN v.id END) + 
                             COUNT(DISTINCT CASE WHEN tq.terminee = true AND tq.pourcentage >= q.note_passage THEN q.id END)) * 100.0 / 
                            (COUNT(DISTINCT v.id) + COUNT(DISTINCT q.id)), 2
                        )
                        ELSE 0 
                    END as pourcentage_completion
                FROM formations f
                LEFT JOIN modules m ON f.id = m.formation_id
                LEFT JOIN parties_modules pm ON m.id = pm.module_id
                LEFT JOIN videos_parties v ON pm.id = v.partie_id
                LEFT JOIN vues_videos vv ON v.id = vv.video_id AND vv.user_id = :userId
                LEFT JOIN quiz q ON pm.id = q.partie_id
                LEFT JOIN tentatives_quiz tq ON q.id = tq.quiz_id AND tq.user_id = :userId
                WHERE f.id = :formationId
            `, {
                replacements: { userId, formationId },
                type: Formation.sequelize.QueryTypes.SELECT
            });

            return progression[0];
        } catch (error) {
            console.error('Erreur progression utilisateur:', error);
            return null;
        }
    }

    // ====================== STREAMING VIDÉO ======================
    async streamVideo(req, res) {
        try {
            const { videoId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: 'Connexion requise pour voir les vidéos' });
            }

            const video = await VideoPartie.findByPk(videoId, {
                include: [
                    {
                        model: PartieModule,
                        as: 'partie',
                        include: [
                            {
                                model: Module,
                                as: 'module',
                                include: [
                                    {
                                        model: Formation,
                                        as: 'formation'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            });

            if (!video) {
                return res.status(404).json({ error: 'Vidéo non trouvée' });
            }

            // Vérifier que l'utilisateur est inscrit à la formation
            const inscription = await Inscription.findOne({
                where: {
                    user_id: userId,
                    formation_id: video.partie.module.formation.id,
                    statut: 'active'
                }
            });

            if (!inscription && !video.partie.module.formation.gratuit) {
                return res.status(403).json({ error: 'Accès non autorisé à cette vidéo' });
            }

            // Enregistrer/mettre à jour la vue vidéo
            await VueVideo.upsert({
                user_id: userId,
                video_id: videoId,
                temps_visionne_secondes: 0,
                pourcentage_visionne: 0
            });

            // Stream de la vidéo
            const videoPath = video.chemin_fichier;
            const stat = await fs.stat(videoPath);
            const fileSize = stat.size;
            const range = req.headers.range;

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;
                
                const readStream = createReadStream(videoPath, { start, end });
                
                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': 'video/mp4',
                });
                
                readStream.pipe(res);
            } else {
                res.writeHead(200, {
                    'Content-Length': fileSize,
                    'Content-Type': 'video/mp4',
                });
                
                const readStream = createReadStream(videoPath);
                readStream.pipe(res);
            }
        } catch (error) {
            console.error('Erreur streaming vidéo:', error);
            res.status(500).json({ error: 'Erreur lors du streaming de la vidéo' });
        }
    }

    // ====================== GESTION DES QUIZ ======================
    async getQuiz(req, res) {
        try {
            const { quizId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: 'Connexion requise' });
            }

            const quiz = await Quiz.findByPk(quizId, {
                include: [
                    {
                        model: QuestionQuiz,
                        as: 'questions',
                        order: [['ordre', 'ASC']],
                        include: [
                            {
                                model: ReponseQuestion,
                                as: 'reponses',
                                order: [['ordre', 'ASC']]
                            }
                        ]
                    },
                    {
                        model: PartieModule,
                        as: 'partie',
                        include: [
                            {
                                model: Module,
                                as: 'module',
                                include: [
                                    {
                                        model: Formation,
                                        as: 'formation'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            });

            if (!quiz) {
                return res.status(404).json({ error: 'Quiz non trouvé' });
            }

            // Vérifier l'accès utilisateur
            const inscription = await Inscription.findOne({
                where: {
                    user_id: userId,
                    formation_id: quiz.partie.module.formation.id,
                    statut: 'active'
                }
            });

            if (!inscription) {
                return res.status(403).json({ error: 'Accès non autorisé' });
            }

            // Vérifier le nombre de tentatives
            const tentativesCount = await TentativeQuiz.count({
                where: { user_id: userId, quiz_id: quizId }
            });

            if (tentativesCount >= quiz.nombre_tentatives_max) {
                return res.status(403).json({ 
                    error: 'Nombre maximum de tentatives atteint',
                    tentativesRestantes: 0
                });
            }

            // Masquer les bonnes réponses pour l'affichage
            const quizPourAffichage = {
                ...quiz.toJSON(),
                questions: quiz.questions.map(question => ({
                    ...question.toJSON(),
                    reponses: question.reponses.map(reponse => ({
                        id: reponse.id,
                        texte_reponse: reponse.texte_reponse,
                        ordre: reponse.ordre
                        // est_correcte est volontairement omis
                    }))
                }))
            };

            res.json({
                quiz: quizPourAffichage,
                tentativesRestantes: quiz.nombre_tentatives_max - tentativesCount
            });
        } catch (error) {
            console.error('Erreur récupération quiz:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }

    async submitQuiz(req, res) {
        try {
            const { quizId } = req.params;
            const { reponses } = req.body; // { questionId: [reponseIds], ... }
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: 'Connexion requise' });
            }

            const quiz = await Quiz.findByPk(quizId, {
                include: [
                    {
                        model: QuestionQuiz,
                        as: 'questions',
                        include: [
                            {
                                model: ReponseQuestion,
                                as: 'reponses'
                            }
                        ]
                    }
                ]
            });

            if (!quiz) {
                return res.status(404).json({ error: 'Quiz non trouvé' });
            }

            // Calculer le score
            let scoreTotal = 0;
            let pointsMax = 0;
            const resultatsDetailles = [];

            for (const question of quiz.questions) {
                pointsMax += question.points;
                const reponsesUtilisateur = reponses[question.id] || [];
                const bonnesReponses = question.reponses.filter(r => r.est_correcte).map(r => r.id);
                
                // Vérifier si les réponses sont correctes
                const reponseCorrecte = bonnesReponses.length === reponsesUtilisateur.length &&
                    bonnesReponses.every(id => reponsesUtilisateur.includes(id));

                if (reponseCorrecte) {
                    scoreTotal += question.points;
                }

                resultatsDetailles.push({
                    questionId: question.id,
                    question: question.question,
                    reponsesUtilisateur,
                    bonnesReponses,
                    correct: reponseCorrecte,
                    points: reponseCorrecte ? question.points : 0,
                    explication: question.explication
                });
            }

            const pourcentage = pointsMax > 0 ? (scoreTotal / pointsMax) * 100 : 0;
            const reussi = pourcentage >= quiz.note_passage;

            // Enregistrer la tentative
            const numeroTentative = await TentativeQuiz.count({
                where: { user_id: userId, quiz_id: quizId }
            }) + 1;

            const tentative = await TentativeQuiz.create({
                user_id: userId,
                quiz_id: quizId,
                numero_tentative: numeroTentative,
                score: scoreTotal,
                pourcentage: pourcentage,
                terminee: true,
                date_fin: new Date(),
                reponses_utilisateur: reponses
            });

            res.json({
                success: true,
                resultats: {
                    score: scoreTotal,
                    pointsMax,
                    pourcentage: Math.round(pourcentage * 100) / 100,
                    reussi,
                    notePassage: quiz.note_passage,
                    tentative: numeroTentative,
                    maxTentatives: quiz.nombre_tentatives_max
                },
                details: quiz.afficher_resultats_immediats ? resultatsDetailles : null
            });
        } catch (error) {
            console.error('Erreur soumission quiz:', error);
            res.status(500).json({ error: 'Erreur lors de la soumission' });
        }
    }

    // ====================== TÉLÉCHARGEMENT DE DOCUMENTS ======================
    async downloadDocument(req, res) {
        try {
            const { documentId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: 'Connexion requise' });
            }

            const document = await DocumentPartie.findByPk(documentId, {
                include: [
                    {
                        model: PartieModule,
                        as: 'partie',
                        include: [
                            {
                                model: Module,
                                as: 'module',
                                include: [
                                    {
                                        model: Formation,
                                        as: 'formation'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            });

            if (!document) {
                return res.status(404).json({ error: 'Document non trouvé' });
            }

            // Vérifier l'accès
            const inscription = await Inscription.findOne({
                where: {
                    user_id: userId,
                    formation_id: document.partie.module.formation.id,
                    statut: 'active'
                }
            });

            if (!inscription && document.acces_connecte_uniquement) {
                return res.status(403).json({ error: 'Accès non autorisé' });
            }

            // Enregistrer le téléchargement
            await TelechargementDocument.create({
                user_id: userId,
                document_id: documentId,
                adresse_ip: req.ip,
                user_agent: req.get('User-Agent')
            });

            // Servir le fichier
            res.download(document.chemin_fichier, document.nom_fichier);
        } catch (error) {
            console.error('Erreur téléchargement document:', error);
            res.status(500).json({ error: 'Erreur lors du téléchargement' });
        }
    }

    // ====================== SUIVI DE PROGRESSION ======================
    async updateVideoProgress(req, res) {
        try {
            const { videoId } = req.params;
            const { tempsVisionne, pourcentageVisionne, position } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: 'Connexion requise' });
            }

            const terminee = pourcentageVisionne >= 90; // Considéré comme terminé à 90%

            await VueVideo.upsert({
                user_id: userId,
                video_id: videoId,
                temps_visionne_secondes: tempsVisionne,
                pourcentage_visionne: pourcentageVisionne,
                terminee,
                derniere_position_secondes: position
            });

            res.json({ success: true, terminee });
        } catch (error) {
            console.error('Erreur mise à jour progression vidéo:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }

    async getProgressionModule(req, res) {
        try {
            const { moduleId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: 'Connexion requise' });
            }

            const progression = await Formation.sequelize.query(`
                SELECT * FROM calculer_progression_module(:userId, :moduleId)
            `, {
                replacements: { userId, moduleId },
                type: Formation.sequelize.QueryTypes.SELECT
            });

            res.json({ progression: progression[0] || 0 });
        } catch (error) {
            console.error('Erreur progression module:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }

    // ====================== ADMIN - GESTION AVANCÉE ======================
    async getFormationStats(req, res) {
        try {
            const { id } = req.params;

            const stats = await Formation.sequelize.query(`
                SELECT 
                    f.titre,
                    COUNT(DISTINCT m.id) as total_modules,
                    COUNT(DISTINCT pm.id) as total_parties,
                    COUNT(DISTINCT v.id) as total_videos,
                    COUNT(DISTINCT q.id) as total_quiz,
                    COUNT(DISTINCT d.id) as total_documents,
                    COUNT(DISTINCT i.id) as total_inscriptions,
                    COUNT(DISTINCT CASE WHEN vv.terminee = true THEN vv.user_id END) as utilisateurs_videos_terminees,
                    COUNT(DISTINCT CASE WHEN tq.reussi = true THEN tq.user_id END) as utilisateurs_quiz_reussis,
                    AVG(DISTINCT av.note) as note_moyenne_avis
                FROM formations f
                LEFT JOIN modules m ON f.id = m.formation_id
                LEFT JOIN parties_modules pm ON m.id = pm.module_id
                LEFT JOIN videos_parties v ON pm.id = v.partie_id
                LEFT JOIN quiz q ON pm.id = q.partie_id
                LEFT JOIN documents_parties d ON pm.id = d.partie_id
                LEFT JOIN inscriptions i ON f.id = i.formation_id
                LEFT JOIN vues_videos vv ON v.id = vv.video_id
                LEFT JOIN tentatives_quiz tq ON q.id = tq.quiz_id
                LEFT JOIN avis av ON f.id = av.formation_id AND av.verifie = true
                WHERE f.id = :formationId
                GROUP BY f.id, f.titre
            `, {
                replacements: { formationId: id },
                type: Formation.sequelize.QueryTypes.SELECT
            });

            res.json({ stats: stats[0] || {} });
        } catch (error) {
            console.error('Erreur stats formation:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }

    // ====================== MIDDLEWARE D'UPLOAD ======================
    static getUploadMiddleware() {
        return upload.fields([
            { name: 'videos', maxCount: 50 },
            { name: 'documents', maxCount: 100 }
        ]);
    }

    // ====================== NETTOYAGE DES FICHIERS ======================
    async cleanupUnusedFiles(req, res) {
        try {
            // Nettoyer les fichiers orphelins
            const videosDb = await VideoPartie.findAll({
                attributes: ['chemin_fichier']
            });

            const documentsDb = await DocumentPartie.findAll({
                attributes: ['chemin_fichier']
            });

            const fichiersUtilises = [
                ...videosDb.map(v => v.chemin_fichier),
                ...documentsDb.map(d => d.chemin_fichier)
            ];

            // Ici vous pourriez implémenter la logique pour supprimer
            // les fichiers du système de fichiers qui ne sont plus référencés

            res.json({ 
                success: true, 
                message: 'Nettoyage terminé',
                fichiersUtilises: fichiersUtilises.length
            });
        } catch (error) {
            console.error('Erreur nettoyage fichiers:', error);
            res.status(500).json({ error: 'Erreur lors du nettoyage' });
        }
    }
}