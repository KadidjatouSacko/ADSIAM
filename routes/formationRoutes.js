// routes/visiteurRoutes.js - Version complète
import express from 'express';
import FormationController from "../controllers/FormationController.js";

const router = express.Router();

// ====================== PAGES PRINCIPALES ======================
// Page d'accueil
router.get('/', FormationController.accueil.bind(FormationController));

// Catalogue des formations avec filtres
router.get('/formations', FormationController.catalogue.bind(FormationController));

// Détail d'une formation spécifique
router.get('/formations/:id', FormationController.detail.bind(FormationController));

// Page de contact
router.get('/contact', FormationController.contact.bind(FormationController));
router.post('/contact', FormationController.traitementContact.bind(FormationController));

// ====================== ACTIONS FORMATIONS ======================
// Commencer une formation (redirection vers tableau de bord étudiant)
router.get('/formations/:id/commencer', (req, res) => {
    const { id } = req.params;

    // Vérifier si l'utilisateur est connecté
    if (!req.session.user) {
        req.session.returnTo = `/formations/${id}/commencer`;
        return res.redirect('/auth/connexion?message=Connectez-vous pour accéder à cette formation');
    }

    // Vérifier si l'utilisateur est inscrit à cette formation
    // TODO: Implémenter la vérification d'inscription

    // Rediriger vers le tableau de bord étudiant
    res.redirect(`/dashboard/formations/${id}`);
});

// Continuer une formation en cours - PLAYER DE FORMATION AVEC VRAIES DONNÉES
router.get('/formation/:id/continuer', async (req, res) => {
    try {
        const { id } = req.params;
        const { module: moduleId, element: elementId } = req.query;

        // Vérifier si l'utilisateur est connecté
        if (!req.session.user) {
            req.session.returnTo = `/formation/${id}/continuer`;
            return res.redirect('/auth/login?message=Connectez-vous pour continuer cette formation');
        }

        const userId = req.session.userId;

        // Importation dynamique pour éviter les erreurs de module
        const { sequelize } = await import('../models/index.js');
        const { QueryTypes } = await import('sequelize');

        // === RÉCUPÉRER LA FORMATION ===
        const formationQuery = `
            SELECT *
            FROM formations
            WHERE id = :formationId AND actif = true
        `;

        const formations = await sequelize.query(formationQuery, {
            type: QueryTypes.SELECT,
            replacements: { formationId: id }
        });

        if (!formations.length) {
            req.flash('error', 'Formation non trouvée');
            return res.redirect('/mes-formations');
        }

        const formation = formations[0];

        // === VÉRIFIER L'INSCRIPTION DE L'UTILISATEUR ===
        const inscriptionQuery = `
            SELECT *
            FROM inscriptions
            WHERE user_id = :userId AND formation_id = :formationId
        `;

        const inscriptions = await sequelize.query(inscriptionQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId, formationId: id }
        });

        let inscription = null;
        if (inscriptions.length > 0) {
            inscription = inscriptions[0];
        } else {
            // Créer une inscription automatique pour la démo
            console.log('Création inscription automatique pour la démo');
            await sequelize.query(`
                INSERT INTO inscriptions (
                    user_id, formation_id, statut, progression_pourcentage,
                    date_inscription, createdat, updatedat
                ) VALUES (
                    :userId, :formationId, 'en_cours', 0, NOW(), NOW(), NOW()
                )
            `, {
                type: QueryTypes.INSERT,
                replacements: { userId, formationId: id }
            });

            const newInscriptions = await sequelize.query(inscriptionQuery, {
                type: QueryTypes.SELECT,
                replacements: { userId, formationId: id }
            });
            inscription = newInscriptions[0];
        }

        // === RÉCUPÉRER LES MODULES AVEC PROGRESSION ===
        const modulesQuery = `
            SELECT
                m.*,
                pm.statut as progression_statut,
                pm.progression_pourcentage,
                pm.temps_passe_minutes,
                pm.date_debut,
                pm.date_fin,
                CASE
                    WHEN m.ordre = 1 THEN true
                    WHEN LAG(pm.statut) OVER (ORDER BY m.ordre) = 'termine' THEN true
                    ELSE false
                END as accessible
            FROM modules m
            LEFT JOIN progressions_modules pm ON (
                pm.module_id = m.id
                AND pm.inscription_id = :inscriptionId
            )
            WHERE m.formation_id = :formationId
            ORDER BY m.ordre ASC
        `;

        const modules = await sequelize.query(modulesQuery, {
            type: QueryTypes.SELECT,
            replacements: {
                inscriptionId: inscription.id,
                formationId: id
            }
        });

        // === DÉTERMINER LE MODULE ACTUEL ===
        let moduleActuel;
        if (moduleId) {
            moduleActuel = modules.find(m => m.id == moduleId);
        } else {
            // Premier module non terminé ou le premier
            moduleActuel = modules.find(m => m.progression_statut !== 'termine') || modules[0];
        }

        if (!moduleActuel) {
            req.flash('error', 'Aucun module trouvé pour cette formation');
            return res.redirect('/mes-formations');
        }

        // === RÉCUPÉRER TOUTES LES SOUS-PARTIES DU MODULE ===
        let contenuModule = [];
        let allDocuments = [];

        console.log(`🔍 Récupération du contenu pour le module ${moduleActuel.id}`);

        // 1. Récupérer toutes les parties du module
        try {
            const partiesQuery = `
                SELECT
                    pm.*,
                    pp.statut as progression_statut,
                    pp.progression_pourcentage,
                    pp.temps_passe_minutes,
                    pp.note as note_obtenue,
                    CASE
                        WHEN pp.statut = 'termine' THEN true
                        ELSE false
                    END as termine
                FROM parties_modules pm
                LEFT JOIN progressions_parties pp ON (
                    pp.partie_id = pm.id
                    AND pp.user_id = :userId
                )
                WHERE pm.module_id = :moduleId AND pm.actif = true
                ORDER BY pm.ordre ASC
            `;

            const parties = await sequelize.query(partiesQuery, {
                type: QueryTypes.SELECT,
                replacements: {
                    userId: userId,
                    moduleId: moduleActuel.id
                }
            });

            console.log(`📋 ${parties.length} parties trouvées pour le module`);

            // 2. Pour chaque partie, récupérer le contenu détaillé
            for (const partie of parties) {
                console.log(`📄 Traitement de la partie: ${partie.titre} (Type: ${partie.type_contenu})`);

                let contenuPartie = {
                    id: partie.id,
                    titre: partie.titre,
                    description: partie.description,
                    type: partie.type_contenu || 'texte',
                    ordre: partie.ordre,
                    duree_minutes: partie.duree_minutes,
                    termine: partie.termine,
                    progression_pourcentage: partie.progression_pourcentage || 0,
                    note_obtenue: partie.note_obtenue
                };

                // Récupérer le contenu spécifique selon le type
                if (partie.type_contenu === 'video') {
                    // Récupérer les vidéos associées
                    try {
                        const videoQuery = `
                            SELECT * FROM videos_parties
                            WHERE partie_id = :partieId
                            ORDER BY id ASC
                        `;
                        const videos = await sequelize.query(videoQuery, {
                            type: QueryTypes.SELECT,
                            replacements: { partieId: partie.id }
                        });

                        if (videos.length > 0) {
                            contenuPartie.url = videos[0].chemin_fichier || videos[0].url_video;
                            contenuPartie.video_titre = videos[0].titre;
                            contenuPartie.video_description = videos[0].description;
                            contenuPartie.duree_seconds = videos[0].duree_secondes; // Correct column name
                            console.log(`🎥 Vidéo trouvée pour partie ${partie.id}: ${contenuPartie.url}`);
                        } else {
                            console.log(`⚠️ Aucune vidéo trouvée pour partie ${partie.id}`);
                        }
                    } catch (error) {
                        console.log(`❌ Erreur récupération vidéo pour partie ${partie.id}:`, error.message);
                    }

                } else if (partie.type_contenu === 'texte') {
                    // Récupérer le contenu texte
                    try {
                        const texteQuery = `
                            SELECT * FROM contenus_texte
                            WHERE partie_id = :partieId AND actif = true
                        `;
                        const textes = await sequelize.query(texteQuery, {
                            type: QueryTypes.SELECT,
                            replacements: { partieId: partie.id }
                        });

                        if (textes.length > 0) {
                            contenuPartie.contenu = textes[0].contenu_html || textes[0].contenu_text;
                        } else {
                            contenuPartie.contenu = partie.description;
                        }
                    } catch (error) {
                        contenuPartie.contenu = partie.description;
                    }

                } else if (partie.type_contenu === 'quiz') {
                    // Récupérer le quiz et ses questions
                    try {
                        // D'abord récupérer le quiz associé à cette partie
                        const quizQuery = `
                            SELECT * FROM quiz WHERE partie_id = :partieId
                        `;
                        const quizs = await sequelize.query(quizQuery, {
                            type: QueryTypes.SELECT,
                            replacements: { partieId: partie.id }
                        });

                        if (quizs.length > 0) {
                            const quiz = quizs[0];
                            contenuPartie.quiz_id = quiz.id;
                            contenuPartie.quiz_titre = quiz.titre;

                            // Récupérer les questions de ce quiz
                            const questionsQuery = `
                                SELECT
                                    q.*,
                                    r.reponse_text,
                                    r.est_correcte,
                                    r.ordre as reponse_ordre
                                FROM questions_quiz q
                                LEFT JOIN reponses_quiz r ON q.id = r.question_id
                                WHERE q.quiz_id = :quizId
                                ORDER BY q.ordre ASC, r.ordre ASC
                            `;
                            const quizData = await sequelize.query(questionsQuery, {
                                type: QueryTypes.SELECT,
                                replacements: { quizId: quiz.id }
                            });

                            // Grouper les questions et réponses
                            const questionsMap = {};
                            quizData.forEach(row => {
                                if (!questionsMap[row.id]) {
                                    questionsMap[row.id] = {
                                        id: row.id,
                                        question: row.question,
                                        ordre: row.ordre,
                                        answers: []
                                    };
                                }
                                if (row.reponse_text) {
                                    questionsMap[row.id].answers.push({
                                        id: `${row.id}_${row.reponse_ordre}`,
                                        text: row.reponse_text,
                                        correct: row.est_correcte
                                    });
                                }
                            });

                            contenuPartie.questions = Object.values(questionsMap);
                            console.log(`❓ ${contenuPartie.questions.length} questions trouvées pour partie ${partie.id} (Quiz: ${quiz.titre})`);
                        } else {
                            console.log(`⚠️ Aucun quiz trouvé pour partie ${partie.id}`);
                            contenuPartie.questions = [];
                        }
                    } catch (error) {
                        console.log(`❌ Erreur récupération quiz pour partie ${partie.id}:`, error.message);
                        contenuPartie.questions = [];
                    }
                }

                // 3. Récupérer les documents de cette partie
                try {
                    const documentsQuery = `
                        SELECT * FROM documents_parties
                        WHERE partie_id = :partieId
                        ORDER BY titre ASC
                    `;
                    const docs = await sequelize.query(documentsQuery, {
                        type: QueryTypes.SELECT,
                        replacements: { partieId: partie.id }
                    });

                    if (docs.length > 0) {
                        const docsFormatted = docs.map(d => ({
                            id: d.id,
                            titre: d.titre,
                            description: d.description,
                            type: d.type_document || 'pdf',
                            url: d.chemin_fichier,
                            taille: d.taille_fichier ? `${Math.round(d.taille_fichier / 1024)} KB` : 'N/A',
                            partie_id: partie.id
                        }));

                        contenuPartie.documents = docsFormatted;
                        allDocuments.push(...docsFormatted);
                        console.log(`📄 ${docs.length} documents trouvés pour partie ${partie.id}: ${docs.map(d => d.titre).join(', ')}`);
                    } else {
                        console.log(`⚠️ Aucun document trouvé pour partie ${partie.id}`);
                    }
                } catch (error) {
                    console.log(`❌ Erreur récupération documents pour partie ${partie.id}:`, error.message);
                }

                contenuModule.push(contenuPartie);
            }

        } catch (error) {
            console.error('❌ Erreur récupération parties:', error);
        }

        // Fallback si aucune partie trouvée - essayer contenus_module
        if (contenuModule.length === 0) {
            try {
                const contenuQuery = `
                    SELECT
                        cm.*,
                        pp.statut as progression_statut,
                        pp.progression_pourcentage,
                        CASE
                            WHEN pp.statut = 'termine' THEN true
                            ELSE false
                        END as termine
                    FROM contenus_module cm
                    LEFT JOIN progressions_parties pp ON (
                        pp.partie_id = cm.id
                        AND pp.user_id = :userId
                    )
                    WHERE cm.module_id = :moduleId
                    ORDER BY cm.ordre ASC
                `;

                const contenus = await sequelize.query(contenuQuery, {
                    type: QueryTypes.SELECT,
                    replacements: {
                        userId: userId,
                        moduleId: moduleActuel.id
                    }
                });

                contenuModule = contenus.map(c => ({
                    id: c.id,
                    titre: c.titre,
                    description: c.description,
                    type: c.type_contenu || 'texte',
                    url: c.video_url || c.fichier_path,
                    contenu: c.contenu_html || c.description,
                    duree_minutes: c.duree_minutes,
                    ordre: c.ordre,
                    termine: c.termine,
                    progression_pourcentage: c.progression_pourcentage || 0
                }));

                console.log(`📋 Fallback: ${contenuModule.length} contenus trouvés dans contenus_module`);

            } catch (error) {
                console.log('❌ Erreur contenus_module fallback');
            }
        }

        // Si toujours aucun contenu, créer du contenu de démonstration
        if (contenuModule.length === 0) {
            console.log('⚠️ Aucun contenu trouvé, création de contenu de démonstration');
            contenuModule = [
                {
                    id: 1,
                    titre: `Introduction - ${moduleActuel.titre}`,
                    type: 'texte',
                    contenu: `
                        <div class="intro-content">
                            <h3>${moduleActuel.titre}</h3>
                            <p>${moduleActuel.description || 'Module de formation ADSIAM'}</p>
                            <h4>Objectifs du module :</h4>
                            <ul>
                                <li>Acquérir les connaissances essentielles</li>
                                <li>Développer les compétences pratiques</li>
                                <li>Valider les acquis par un quiz</li>
                            </ul>
                            <div class="alert alert-info">
                                <strong>Note :</strong> Ce contenu est généré automatiquement.
                                Veuillez ajouter du contenu réel via l'interface d'administration.
                            </div>
                        </div>
                    `,
                    ordre: 1,
                    termine: false,
                    progression_pourcentage: 0
                },
                {
                    id: 2,
                    titre: "Quiz de validation",
                    type: 'quiz',
                    questions: [
                        {
                            id: 1,
                            question: `Avez-vous bien compris les objectifs du module "${moduleActuel.titre}" ?`,
                            answers: [
                                { id: 1, text: "Oui, parfaitement", correct: true },
                                { id: 2, text: "En partie", correct: false },
                                { id: 3, text: "Non, j'ai besoin de relire", correct: false }
                            ]
                        },
                        {
                            id: 2,
                            question: "Que devez-vous faire après ce module ?",
                            answers: [
                                { id: 1, text: "Passer au module suivant", correct: true },
                                { id: 2, text: "Arrêter la formation", correct: false },
                                { id: 3, text: "Recommencer depuis le début", correct: false }
                            ]
                        }
                    ],
                    ordre: 2,
                    termine: false,
                    progression_pourcentage: 0
                }
            ];
        }

        console.log(`✅ Total: ${contenuModule.length} éléments de contenu chargés`);

        // === DÉTERMINER L'ÉLÉMENT ACTUEL ===
        console.log(`🎯 Recherche elementActuel: elementId=${elementId}, contenuModule.length=${contenuModule.length}`);

        let elementActuel;
        if (elementId) {
            elementActuel = contenuModule.find(c => c.id == elementId);
            console.log(`🔍 Recherche par ID ${elementId}: ${elementActuel ? 'trouvé' : 'non trouvé'}`);
        } else {
            // Premier élément non terminé ou le premier
            elementActuel = contenuModule.find(c => !c.termine) || contenuModule[0];
            console.log(`🔍 Premier élément: ${elementActuel ? elementActuel.titre : 'aucun'}`);
        }

        // Si toujours pas d'élément, forcer le premier
        if (!elementActuel && contenuModule.length > 0) {
            elementActuel = contenuModule[0];
            console.log(`🔄 Fallback vers premier élément: ${elementActuel.titre}`);
        }

        console.log(`✅ Element actuel final: ${elementActuel ? elementActuel.titre : 'AUCUN'}`);
        console.log(`📋 Tous les éléments disponibles:`, contenuModule.map(c => `${c.id}:${c.titre}`));

        // Élément précédent et suivant
        const currentIndex = contenuModule.findIndex(c => c.id === elementActuel?.id);
        const elementPrecedent = currentIndex > 0 ? contenuModule[currentIndex - 1] : null;
        const elementSuivant = currentIndex < contenuModule.length - 1 ? contenuModule[currentIndex + 1] : null;

        // === CALCULER LES STATISTIQUES DÉTAILLÉES ===

        // 1. Progression par module
        const modulesTermines = modules.filter(m => m.progression_statut === 'termine').length;
        const modulesEnCours = modules.filter(m => m.progression_statut === 'en_cours').length;
        const progressionFormation = modules.length > 0 ? (modulesTermines / modules.length) * 100 : 0;
        const tempsTotal = modules.reduce((acc, m) => acc + (m.temps_passe_minutes || 0), 0);

        // 2. Progression détaillée du module actuel
        const partiesTerminees = contenuModule.filter(c => c.termine).length;
        const progressionModule = contenuModule.length > 0 ? (partiesTerminees / contenuModule.length) * 100 : 0;

        // 3. Marquer l'accessibilité des éléments
        contenuModule.forEach((element, index) => {
            // Le premier élément est toujours accessible
            if (index === 0) {
                element.accessible = true;
            } else {
                // Un élément est accessible si le précédent est terminé ou si c'est un document
                const elementPrecedent = contenuModule[index - 1];
                element.accessible = elementPrecedent.termine || element.type === 'document';
            }

            // Ajouter des informations de progression
            element.progressionText = element.termine ? 'Terminé' :
                                    element.accessible ? 'Disponible' : 'Verrouillé';

            // Calculer le nombre d'éléments (pour les quiz)
            if (element.type === 'quiz' && element.questions) {
                element.nombre_questions = element.questions.length;
            }
        });

        // === UTILISER LES DOCUMENTS DÉJÀ RÉCUPÉRÉS ===
        let documents = allDocuments;

        // Si pas de documents dans les parties, essayer une requête globale
        if (documents.length === 0) {
            try {
                const documentsQuery = `
                    SELECT
                        dp.*,
                        pm.titre as partie_titre
                    FROM documents_parties dp
                    JOIN parties_modules pm ON dp.partie_id = pm.id
                    WHERE pm.module_id = :moduleId AND dp.actif = true
                    ORDER BY dp.titre ASC
                `;

                const docsResult = await sequelize.query(documentsQuery, {
                    type: QueryTypes.SELECT,
                    replacements: { moduleId: moduleActuel.id }
                });

                documents = docsResult.map(d => ({
                    id: d.id,
                    titre: d.titre,
                    description: d.description,
                    type: d.type_document || 'pdf',
                    url: d.chemin_fichier,
                    taille: d.taille_fichier ? `${Math.round(d.taille_fichier / 1024)} KB` : 'N/A',
                    partie_titre: d.partie_titre
                }));

                console.log(`📄 ${documents.length} documents trouvés globalement`);

            } catch (error) {
                console.log('❌ Aucun document trouvé globalement');
                documents = [];
            }
        }

        // === AJOUTER DES STATISTIQUES AVANCÉES ===
        const statistiques = {
            formation: {
                progression: progressionFormation,
                modulesTotal: modules.length,
                modulesTermines: modulesTermines,
                modulesEnCours: modulesEnCours,
                tempsTotal: tempsTotal
            },
            module: {
                progression: progressionModule,
                partiesTotal: contenuModule.length,
                partiesTerminees: partiesTerminees,
                partiesAccessibles: contenuModule.filter(c => c.accessible).length,
                documentsTotal: documents.length
            }
        };

        // Notes par défaut
        const notesUtilisateur = '';

        console.log(`📖 Formation player chargé: Formation ${id}, Module ${moduleActuel.id}, Element ${elementActuel?.id}`);
        console.log(`📊 Statistiques: ${progressionFormation.toFixed(1)}% formation, ${progressionModule.toFixed(1)}% module`);

        // === RENDRE LA VUE ===
        res.render('formations/formation-player', {
            formation,
            modules,
            moduleActuel,
            contenuModule,
            elementActuel,
            elementPrecedent,
            elementSuivant,
            modulesTermines,
            progressionFormation,
            progressionModule, // Progression du module actuel
            tempsTotal,
            documents,
            notesUtilisateur,
            statistiques, // Statistiques détaillées
            mode: 'continuer', // Mode continuer
            resultats: null, // Pas de résultats en mode continuer
            user: req.session.user,
            title: `${formation.titre} - ${moduleActuel.titre}`
        });

    } catch (error) {
        console.error('❌ Erreur formation player:', error);
        req.flash('error', 'Erreur lors du chargement de la formation');
        res.redirect('/mes-formations');
    }
});

// Revoir une formation terminée - MÊME TEMPLATE QUE CONTINUER
router.get('/formation/:id/revoir', async (req, res) => {
    try {
        const { id } = req.params;
        const { module: moduleId, element: elementId } = req.query;

        // Vérifier si l'utilisateur est connecté
        if (!req.session.user) {
            req.session.returnTo = `/formation/${id}/revoir`;
            return res.redirect('/auth/login?message=Connectez-vous pour revoir cette formation');
        }

        const userId = req.session.userId;

        // Importation dynamique pour éviter les erreurs de module
        const { sequelize } = await import('../models/index.js');
        const { QueryTypes } = await import('sequelize');

        // === RÉCUPÉRER LA FORMATION ===
        const formationQuery = `
            SELECT *
            FROM formations
            WHERE id = :formationId AND actif = true
        `;

        const formations = await sequelize.query(formationQuery, {
            type: QueryTypes.SELECT,
            replacements: { formationId: id }
        });

        if (!formations.length) {
            req.flash('error', 'Formation non trouvée');
            return res.redirect('/mes-formations');
        }

        const formation = formations[0];

        // === VÉRIFIER L'INSCRIPTION DE L'UTILISATEUR ===
        const inscriptionQuery = `
            SELECT *
            FROM inscriptions
            WHERE user_id = :userId AND formation_id = :formationId
        `;

        const inscriptions = await sequelize.query(inscriptionQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId, formationId: id }
        });

        if (!inscriptions.length) {
            req.flash('error', 'Vous n\'êtes pas inscrit à cette formation');
            return res.redirect('/mes-formations');
        }

        const inscription = inscriptions[0];

        // === RÉCUPÉRER LES MODULES AVEC PROGRESSION ET RÉSULTATS ===
        const modulesQuery = `
            SELECT
                m.*,
                pm.statut as progression_statut,
                pm.progression_pourcentage,
                pm.temps_passe_minutes,
                pm.date_debut,
                pm.date_fin,
                pm.note as note_finale,
                true as accessible
            FROM modules m
            LEFT JOIN progressions_modules pm ON (
                pm.module_id = m.id
                AND pm.inscription_id = :inscriptionId
            )
            WHERE m.formation_id = :formationId
            ORDER BY m.ordre ASC
        `;

        const modules = await sequelize.query(modulesQuery, {
            type: QueryTypes.SELECT,
            replacements: {
                inscriptionId: inscription.id,
                formationId: id
            }
        });

        // === DÉTERMINER LE MODULE ACTUEL ===
        let moduleActuel;
        if (moduleId) {
            moduleActuel = modules.find(m => m.id == moduleId);
        } else {
            // En mode revoir, commencer par le premier module
            moduleActuel = modules[0];
        }

        if (!moduleActuel) {
            req.flash('error', 'Aucun module trouvé pour cette formation');
            return res.redirect('/mes-formations');
        }

        // === RÉCUPÉRER LE CONTENU DU MODULE AVEC RÉSULTATS ===
        let contenuModule = [];

        // Essayer d'abord avec contenus_module
        try {
            const contenuQuery = `
                SELECT
                    cm.*,
                    CASE
                        WHEN pp.statut = 'termine' THEN true
                        ELSE false
                    END as termine,
                    pp.note as note_obtenue,
                    pp.progression_pourcentage as progression_element,
                    pp.temps_passe_minutes as temps_element
                FROM contenus_module cm
                LEFT JOIN progressions_parties pp ON (
                    pp.partie_id = cm.id
                    AND pp.user_id = :userId
                )
                WHERE cm.module_id = :moduleId
                ORDER BY cm.ordre ASC
            `;

            contenuModule = await sequelize.query(contenuQuery, {
                type: QueryTypes.SELECT,
                replacements: {
                    userId: userId,
                    moduleId: moduleActuel.id
                }
            });

            // Adapter le format pour le template
            contenuModule = contenuModule.map(c => ({
                id: c.id,
                titre: c.titre,
                description: c.description,
                type: c.type_contenu || 'texte',
                url: c.video_url || c.fichier_path,
                contenu: c.description,
                duree_minutes: c.duree_minutes,
                ordre: c.ordre,
                termine: c.termine,
                note_obtenue: c.note_obtenue,
                progression_element: c.progression_element,
                temps_element: c.temps_element
            }));

        } catch (error) {
            console.log('Erreur contenus_module, essai avec parties_modules');
        }

        // Si pas de contenu dans contenus_module, essayer parties_modules
        if (contenuModule.length === 0) {
            try {
                const partiesQuery = `
                    SELECT
                        pm.*,
                        CASE
                            WHEN pp.statut = 'termine' THEN true
                            ELSE false
                        END as termine,
                        pp.note as note_obtenue,
                        pp.progression_pourcentage as progression_element,
                        pp.temps_passe_minutes as temps_element
                    FROM parties_modules pm
                    LEFT JOIN progressions_parties pp ON (
                        pp.partie_id = pm.id
                        AND pp.user_id = :userId
                    )
                    WHERE pm.module_id = :moduleId AND pm.actif = true
                    ORDER BY pm.ordre ASC
                `;

                const parties = await sequelize.query(partiesQuery, {
                    type: QueryTypes.SELECT,
                    replacements: {
                        userId: userId,
                        moduleId: moduleActuel.id
                    }
                });

                // Adapter le format pour le template
                contenuModule = parties.map(p => ({
                    id: p.id,
                    titre: p.titre,
                    description: p.description,
                    type: p.type_contenu || 'texte',
                    contenu: p.description,
                    ordre: p.ordre,
                    termine: p.termine,
                    note_obtenue: p.note_obtenue,
                    progression_element: p.progression_element,
                    temps_element: p.temps_element
                }));

            } catch (error) {
                console.log('Erreur parties_modules, utilisation données par défaut');
            }
        }

        // Si toujours pas de contenu, créer du contenu par défaut
        if (contenuModule.length === 0) {
            contenuModule = [
                {
                    id: 1,
                    titre: `Révision - ${moduleActuel.titre}`,
                    type: 'texte',
                    contenu: `
                        <h3>Révision du module : ${moduleActuel.titre}</h3>
                        <p>${moduleActuel.description || 'Module de formation ADSIAM'}</p>

                        <div class="revision-summary">
                            <h4>📊 Résultats de votre formation :</h4>
                            <ul>
                                <li><strong>Statut :</strong> ${moduleActuel.progression_statut === 'termine' ? '✅ Terminé' : '⏳ En cours'}</li>
                                <li><strong>Progression :</strong> ${moduleActuel.progression_pourcentage || 0}%</li>
                                <li><strong>Temps passé :</strong> ${moduleActuel.temps_passe_minutes || 0} minutes</li>
                                ${moduleActuel.note_finale ? `<li><strong>Note finale :</strong> ${moduleActuel.note_finale}/20</li>` : ''}
                            </ul>
                        </div>

                        <h4>🎯 Points clés à retenir :</h4>
                        <ul>
                            <li>Connaissances essentielles acquises</li>
                            <li>Compétences pratiques développées</li>
                            <li>Validation des acquis réussie</li>
                        </ul>
                    `,
                    ordre: 1,
                    termine: true
                }
            ];
        }

        // === RÉCUPÉRER LES RÉSULTATS DE QUIZ ===
        let resultatsQuiz = [];
        try {
            const quizResultsQuery = `
                SELECT
                    tq.*,
                    q.titre as quiz_titre
                FROM tentatives_quiz tq
                LEFT JOIN quiz q ON tq.quiz_id = q.id
                WHERE tq.user_id = :userId
                ORDER BY tq.date_fin DESC
                LIMIT 10
            `;

            resultatsQuiz = await sequelize.query(quizResultsQuery, {
                type: QueryTypes.SELECT,
                replacements: { userId }
            });

        } catch (error) {
            console.log('Aucun résultat de quiz trouvé');
        }

        // === DÉTERMINER L'ÉLÉMENT ACTUEL ===
        let elementActuel;
        if (elementId) {
            elementActuel = contenuModule.find(c => c.id == elementId);
        } else {
            // En mode revoir, commencer par le premier élément
            elementActuel = contenuModule[0];
        }

        // Élément précédent et suivant
        const currentIndex = contenuModule.findIndex(c => c.id === elementActuel?.id);
        const elementPrecedent = currentIndex > 0 ? contenuModule[currentIndex - 1] : null;
        const elementSuivant = currentIndex < contenuModule.length - 1 ? contenuModule[currentIndex + 1] : null;

        // === CALCULER LES STATISTIQUES ===
        const modulesTermines = modules.filter(m => m.progression_statut === 'termine').length;
        const progressionFormation = modules.length > 0 ? (modulesTermines / modules.length) * 100 : 0;
        const tempsTotal = modules.reduce((acc, m) => acc + (m.temps_passe_minutes || 0), 0);

        // === RÉCUPÉRER LES DOCUMENTS ===
        let documents = [];
        try {
            const documentsQuery = `
                SELECT *
                FROM documents_parties dp
                JOIN parties_modules pm ON dp.partie_id = pm.id
                WHERE pm.module_id = :moduleId
                ORDER BY dp.titre ASC
            `;

            const docsResult = await sequelize.query(documentsQuery, {
                type: QueryTypes.SELECT,
                replacements: { moduleId: moduleActuel.id }
            });

            documents = docsResult.map(d => ({
                id: d.id,
                titre: d.titre,
                description: d.description,
                type: d.type_document || 'pdf',
                url: d.chemin_fichier,
                taille: d.taille_fichier ? `${Math.round(d.taille_fichier / 1024)} KB` : 'N/A'
            }));

        } catch (error) {
            console.log('Aucun document trouvé');
            documents = [];
        }

        // Notes par défaut
        const notesUtilisateur = '';

        // === CONSTRUIRE LES RÉSULTATS POUR LE MODE REVOIR ===
        const resultats = {
            dateCompletion: new Date(), // Date de la dernière completion
            scoreGlobal: progressionFormation, // Score global basé sur la progression
            tempsTotal: tempsTotal, // Temps total passé en minutes
            modulesTermines: modulesTermines,
            modules: modules.map(m => ({
                titre: m.titre,
                score: m.progression_pourcentage || 0,
                temps: m.temps_passe_minutes || 0,
                statut: m.progression_statut || 'non_commence'
            })),
            quiz: contenuModule
                .filter(c => c.type === 'quiz' && c.note_obtenue !== null)
                .map(c => ({
                    titre: c.titre,
                    score: c.note_obtenue || 0,
                    bonnesReponses: Math.round((c.note_obtenue || 0) / 100 * 5), // Estimation
                    totalQuestions: 5, // Estimation
                    temps: c.temps_element || 0
                })),
            modulesARevoir: modules
                .filter(m => (m.progression_pourcentage || 0) < 70)
                .map(m => m.titre)
        };

        console.log(`📖 Formation revoir chargée: Formation ${id}, Module ${moduleActuel.id}, Element ${elementActuel?.id}`);

        // === RENDRE LA VUE AVEC MODE REVOIR ===
        res.render('formations/formation-player', {
            formation,
            modules,
            moduleActuel,
            contenuModule,
            elementActuel,
            elementPrecedent,
            elementSuivant,
            modulesTermines,
            progressionFormation,
            tempsTotal,
            documents,
            notesUtilisateur,
            resultats, // Résultats pour le mode revoir
            mode: 'revoir', // Mode revoir
            user: req.session.user,
            title: `Révision: ${formation.titre} - ${moduleActuel.titre}`
        });

    } catch (error) {
        console.error('❌ Erreur formation revoir:', error);
        req.flash('error', 'Erreur lors du chargement de la formation');
        res.redirect('/mes-formations');
    }
});

// Commencer une formation (alternative route)
router.get('/formation/:id/commencer', (req, res) => {
    const { id } = req.params;

    // Vérifier si l'utilisateur est connecté
    if (!req.session.user) {
        req.session.returnTo = `/formation/${id}/commencer`;
        return res.redirect('/auth/login?message=Connectez-vous pour commencer cette formation');
    }

    // Rediriger vers le tableau de bord étudiant
    res.redirect(`/dashboard/formations/${id}`);
});

// Acheter une formation (redirection vers paiement)
router.get('/formations/:id/acheter', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Récupérer les détails de la formation
        const formation = await Formation.findByPk(id, {
            attributes: ['id', 'titre', 'prix', 'gratuit']
        });
        
        if (!formation) {
            return res.status(404).render('error', { 
                message: 'Formation non trouvée' 
            });
        }
        
        if (formation.gratuit) {
            return res.redirect(`/formations/${id}/commencer`);
        }
        
        // Rediriger vers la page de paiement
        res.render('visiteurs/paiement', {
            formation,
            title: `Acheter ${formation.titre} - ADSIAM`
        });
        
    } catch (error) {
        console.error('Erreur achat formation:', error);
        res.status(500).render('error', { message: 'Erreur serveur' });
    }
});

// ====================== ROUTE DE TEST ======================
// Route de test pour le player de formation
router.get('/formation/test', (req, res) => {
    console.log('🧪 Route de test appelée');

    // Données de test simples
    const formationTest = {
        id: 2,
        titre: 'Formation Test Hygiène',
        description: 'Formation de test pour le player',
        domaine: 'hygiene',
        nombre_modules: 3,
        duree_heures: 6
    };

    const modulesTest = [
        {
            id: 1,
            titre: "Introduction à l'hygiène",
            description: "Module d'introduction",
            ordre: 1,
            duree_minutes: 30,
            statut: 'en_cours',
            accessible: true,
            progression_pourcentage: 25
        }
    ];

    const contenuTest = [
        {
            id: 1,
            titre: "Vidéo d'introduction",
            type: 'video',
            url: '/videos/demo.mp4',
            description: 'Vidéo de test',
            ordre: 1,
            termine: false
        },
        {
            id: 2,
            titre: "Les principes de base",
            type: 'texte',
            contenu: '<h3>Test de contenu texte</h3><p>Ceci est un test du player de formation.</p>',
            ordre: 2,
            termine: false
        }
    ];

    res.render('formations/formation-player', {
        formation: formationTest,
        modules: modulesTest,
        moduleActuel: modulesTest[0],
        contenuModule: contenuTest,
        elementActuel: contenuTest[0],
        elementPrecedent: null,
        elementSuivant: contenuTest[1],
        modulesTermines: 0,
        progressionFormation: 25,
        tempsTotal: 0,
        documents: [],
        notesUtilisateur: '',
        mode: 'continuer', // Mode test
        resultats: null, // Pas de résultats en mode test
        user: { id: 1, prenom: 'Test', nom: 'User' },
        title: 'Formation Test'
    });
});

// ====================== API FORMATION PLAYER ======================
// API pour mettre à jour la progression
router.post('/api/formation/progress', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }

        const { action, formationId, moduleId, elementId, timeSpent } = req.body;
        const userId = req.session.userId;

        // Importation dynamique
        const { sequelize } = await import('../models/index.js');
        const { QueryTypes } = await import('sequelize');

        switch (action) {
            case 'element_completed':
                await sequelize.query(`
                    INSERT INTO progressions_parties (
                        user_id, partie_id, module_id, statut, temps_passe_minutes,
                        progression_pourcentage, date_debut, date_fin, createdat, updatedat
                    )
                    SELECT :userId, :elementId, pm.module_id, 'termine', :timeSpent, 100,
                           COALESCE(pp.date_debut, NOW()), NOW(), NOW(), NOW()
                    FROM parties_modules pm
                    LEFT JOIN progressions_parties pp ON pp.partie_id = :elementId AND pp.user_id = :userId
                    WHERE pm.id = :elementId
                    ON CONFLICT (user_id, partie_id)
                    DO UPDATE SET
                        statut = 'termine',
                        temps_passe_minutes = progressions_parties.temps_passe_minutes + :timeSpent,
                        progression_pourcentage = 100,
                        date_fin = NOW(),
                        updatedat = NOW()
                `, {
                    type: QueryTypes.INSERT,
                    replacements: { userId, formationId, elementId, timeSpent }
                });
                break;

            case 'module_completed':
                await sequelize.query(`
                    INSERT INTO progressions_modules (
                        user_id, module_id, inscription_id, statut, temps_passe_minutes,
                        date_debut, date_fin, progression_pourcentage, createdat, updatedat
                    )
                    SELECT :userId, :moduleId, i.id, 'termine', :timeSpent,
                           COALESCE(pm.date_debut, NOW()), NOW(), 100, NOW(), NOW()
                    FROM inscriptions i
                    LEFT JOIN progressions_modules pm ON pm.module_id = :moduleId AND pm.user_id = :userId
                    WHERE i.user_id = :userId AND i.formation_id = :formationId
                    ON CONFLICT (user_id, module_id)
                    DO UPDATE SET
                        statut = 'termine',
                        temps_passe_minutes = progressions_modules.temps_passe_minutes + :timeSpent,
                        date_fin = NOW(),
                        progression_pourcentage = 100,
                        updatedat = NOW()
                `, {
                    type: QueryTypes.INSERT,
                    replacements: { userId, formationId, moduleId, timeSpent }
                });
                break;

            case 'progress_update':
                // Mise à jour générale de progression
                await sequelize.query(`
                    UPDATE inscriptions
                    SET updatedat = NOW(),
                        temps_total_minutes = COALESCE(temps_total_minutes, 0) + :timeSpent
                    WHERE user_id = :userId AND formation_id = :formationId
                `, {
                    type: QueryTypes.UPDATE,
                    replacements: { userId, formationId, timeSpent }
                });
                break;
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Erreur mise à jour progression:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// API pour sauvegarder les résultats de quiz
router.post('/api/formation/quiz-results', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }

        const { formationId, moduleId, elementId, score, passed, answers, timeSpent } = req.body;
        const userId = req.session.userId;

        const { sequelize } = await import('../models/index.js');
        const { QueryTypes } = await import('sequelize');

        // Sauvegarder les résultats du quiz
        await sequelize.query(`
            INSERT INTO tentatives_quiz (
                user_id, quiz_id, numero_tentative, score, pourcentage,
                temps_passe_secondes, terminee, date_debut, date_fin,
                reponses_utilisateur, createdat, updatedat
            )
            VALUES (:userId, :elementId, 1, :score, :score, :timeSpent, true,
                    NOW() - INTERVAL ':timeSpent seconds', NOW(),
                    :answers, NOW(), NOW())
            ON CONFLICT (user_id, quiz_id, numero_tentative)
            DO UPDATE SET
                score = :score,
                pourcentage = :score,
                temps_passe_secondes = :timeSpent,
                terminee = true,
                date_fin = NOW(),
                reponses_utilisateur = :answers,
                updatedat = NOW()
        `, {
            type: QueryTypes.INSERT,
            replacements: {
                userId, formationId, moduleId, elementId, score, passed,
                answers: JSON.stringify(answers), timeSpent
            }
        });

        // Si le quiz est réussi, marquer l'élément comme terminé
        if (passed) {
            await sequelize.query(`
                INSERT INTO progressions_parties (
                    user_id, partie_id, module_id, statut, temps_passe_minutes,
                    progression_pourcentage, date_debut, date_fin, createdat, updatedat
                )
                SELECT :userId, :elementId, pm.module_id, 'termine', :timeSpent, 100,
                       COALESCE(pp.date_debut, NOW()), NOW(), NOW(), NOW()
                FROM parties_modules pm
                LEFT JOIN progressions_parties pp ON pp.partie_id = :elementId AND pp.user_id = :userId
                WHERE pm.id = :elementId
                ON CONFLICT (user_id, partie_id)
                DO UPDATE SET
                    statut = 'termine',
                    temps_passe_minutes = progressions_parties.temps_passe_minutes + :timeSpent,
                    progression_pourcentage = 100,
                    date_fin = NOW(),
                    updatedat = NOW()
            `, {
                type: QueryTypes.INSERT,
                replacements: { userId, formationId, elementId, timeSpent }
            });
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Erreur sauvegarde quiz:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// API pour sauvegarder les notes
router.post('/api/formation/save-notes', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }

        const { formationId, moduleId, notes } = req.body;
        const userId = req.session.userId;

        const { sequelize } = await import('../models/index.js');
        const { QueryTypes } = await import('sequelize');

        await sequelize.query(`
            INSERT INTO notes_formation (
                user_id, formation_id, module_id, notes, createdat, updatedat
            )
            VALUES (:userId, :formationId, :moduleId, :notes, NOW(), NOW())
            ON CONFLICT (user_id, formation_id, module_id)
            DO UPDATE SET
                notes = :notes,
                updatedat = NOW()
        `, {
            type: QueryTypes.INSERT,
            replacements: { userId, formationId, moduleId, notes }
        });

        res.json({ success: true });

    } catch (error) {
        console.error('Erreur sauvegarde notes:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ====================== API RECHERCHE ======================
// API pour recherche en temps réel
router.get('/api/recherche', FormationController.recherche.bind(FormationController));

// API pour filtres avancés
router.get('/api/formations/filtres', async (req, res) => {
    try {
        const { domaine, niveau, prix_max, gratuit_seulement } = req.query;
        
        const where = { actif: true };
        
        if (domaine) where.domaine = domaine;
        if (niveau) where.niveau = niveau;
        if (prix_max) where.prix = { [Op.lte]: parseFloat(prix_max) };
        if (gratuit_seulement === 'true') where.gratuit = true;
        
        const formations = await Formation.findAll({
            where,
            attributes: ['id', 'titre', 'prix', 'gratuit', 'icone', 'niveau', 'domaine'],
            limit: 20
        });
        
        res.json({
            success: true,
            formations,
            total: formations.length
        });
        
    } catch (error) {
        console.error('Erreur API filtres:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors du filtrage' 
        });
    }
});

// ====================== PAGES STATIQUES ======================
// À propos
router.get('/a-propos', (req, res) => {
    res.render('visiteurs/about', {
        title: 'À propos - ADSIAM',
        stats: {
            professionnelsFormes: 2847,
            formationsDisponibles: 36,
            tauxSatisfaction: 97,
            anneesExperience: 8
        }
    });
});

// Mentions légales
router.get('/mentions-legales', (req, res) => {
    res.render('visiteurs/legal', {
        title: 'Mentions légales - ADSIAM'
    });
});

// Politique de confidentialité
router.get('/politique-confidentialite', (req, res) => {
    res.render('visiteurs/privacy', {
        title: 'Politique de confidentialité - ADSIAM'
    });
});

// FAQ
router.get('/faq', (req, res) => {
    const faqData = [
        {
            category: 'Formations',
            questions: [
                {
                    question: 'Comment accéder à mes formations ?',
                    answer: 'Après votre inscription, connectez-vous à votre tableau de bord pour accéder à toutes vos formations.'
                },
                {
                    question: 'Les formations sont-elles certifiantes ?',
                    answer: 'Oui, toutes nos formations délivrent un certificat de réussite reconnu dans le secteur.'
                }
            ]
        },
        {
            category: 'Paiement',
            questions: [
                {
                    question: 'Quels moyens de paiement acceptez-vous ?',
                    answer: 'Nous acceptons les cartes bancaires, PayPal et les virements SEPA.'
                }
            ]
        }
    ];
    
    res.render('visiteurs/faq', {
        title: 'FAQ - Questions fréquentes - ADSIAM',
        faqData
    });
});

// ====================== REDIRECTIONS COMPATIBILITÉ ======================
// Redirections pour compatibilité avec ancienne structure
router.get('/formations/catalogue', (req, res) => res.redirect('/formations'));
router.get('/formation/:id', (req, res) => res.redirect(`/formations/${req.params.id}`));
router.get('/cours/:id', (req, res) => res.redirect(`/formations/${req.params.id}`));

// ====================== GESTION DES ERREURS ======================
// Page 404 pour les routes non trouvées
router.get('*', (req, res) => {
    res.status(404).render('errors/404', {
        title: 'Page non trouvée - ADSIAM',
        message: 'La page que vous cherchez n\'existe pas.',
        suggestions: [
            { text: 'Retour à l\'accueil', url: '/' },
            { text: 'Voir nos formations', url: '/formations' },
            { text: 'Nous contacter', url: '/contact' }
        ]
    });
});

export default router;