import {
    Formation,
    Module,
    PartieModule,
    VideoPartie,
    DocumentPartie,
    Quiz,
    QuestionQuiz,
    ReponseQuestion,
    sequelize
} from '../models/index.js';

async function addTestDataToFormation() {
    try {
        console.log('🚀 Ajout de données de test pour la formation ID 2...');

        // Vérifier que la formation existe
        const formation = await Formation.findByPk(2);
        if (!formation) {
            console.error('❌ Formation ID 2 non trouvée');
            return;
        }

        console.log(`✅ Formation trouvée: "${formation.titre}"`);

        // Créer un module de test
        const module1 = await Module.create({
            formation_id: 2,
            titre: 'Introduction au Bien-être',
            description: 'Découvrez les bases du bien-être et de la prévention du burn-out',
            duree_minutes: 45,
            type_contenu: 'video',
            ordre: 1,
            disponible: true
        });

        console.log(`✅ Module créé: "${module1.titre}"`);

        // Créer des parties pour ce module
        const partie1 = await PartieModule.create({
            module_id: module1.id,
            titre: 'Comprendre le burn-out',
            description: 'Définition et symptômes du burn-out',
            type_contenu: 'video',
            duree_minutes: 15,
            ordre: 1
        });

        const partie2 = await PartieModule.create({
            module_id: module1.id,
            titre: 'Quiz de compréhension',
            description: 'Testez vos connaissances sur le burn-out',
            type_contenu: 'quiz',
            duree_minutes: 10,
            ordre: 2
        });

        const partie3 = await PartieModule.create({
            module_id: module1.id,
            titre: 'Ressources complémentaires',
            description: 'Documents et guides pratiques',
            type_contenu: 'document',
            duree_minutes: 20,
            ordre: 3
        });

        console.log('✅ Parties créées');

        // Ajouter une vidéo à la partie 1
        const video1 = await VideoPartie.create({
            partie_id: partie1.id,
            titre: 'Introduction au burn-out',
            description: 'Vidéo d\'introduction sur le burn-out',
            nom_fichier: 'sample-burnout-intro.mp4',
            chemin_fichier: '/videos/sample-burnout-intro.mp4',
            url_video: '/videos/sample-burnout-intro.mp4',
            duree_secondes: 900, // 15 minutes
            taille_fichier: 52428800, // 50MB
            format_video: 'mp4',
            acces_connecte_uniquement: true
        });

        console.log('✅ Vidéo ajoutée');

        // Créer un quiz pour la partie 2
        const quiz1 = await Quiz.create({
            partie_id: partie2.id,
            titre: 'Quiz sur le burn-out',
            description: 'Évaluez vos connaissances sur le burn-out',
            instructions: 'Choisissez la meilleure réponse pour chaque question.',
            duree_limite_minutes: 10,
            nombre_tentatives_max: 3,
            note_passage: 80,
            melanger_questions: false,
            actif: true
        });

        // Créer des questions pour le quiz
        const question1 = await QuestionQuiz.create({
            quiz_id: quiz1.id,
            question: 'Qu\'est-ce que le burn-out ?',
            type_question: 'choix_multiple',
            points: 1,
            ordre: 1,
            obligatoire: true
        });

        // Créer les réponses pour la question 1
        await ReponseQuestion.create({
            question_id: question1.id,
            texte_reponse: 'Un état de fatigue temporaire',
            est_correcte: false,
            ordre: 1
        });

        await ReponseQuestion.create({
            question_id: question1.id,
            texte_reponse: 'Un syndrome d\'épuisement professionnel',
            est_correcte: true,
            ordre: 2
        });

        await ReponseQuestion.create({
            question_id: question1.id,
            texte_reponse: 'Une maladie génétique',
            est_correcte: false,
            ordre: 3
        });

        const question2 = await QuestionQuiz.create({
            quiz_id: quiz1.id,
            question: 'Quels sont les principaux symptômes du burn-out ?',
            type_question: 'choix_multiple',
            points: 1,
            ordre: 2,
            obligatoire: true
        });

        await ReponseQuestion.create({
            question_id: question2.id,
            texte_reponse: 'Épuisement émotionnel et physique',
            est_correcte: true,
            ordre: 1
        });

        await ReponseQuestion.create({
            question_id: question2.id,
            texte_reponse: 'Augmentation de l\'appétit',
            est_correcte: false,
            ordre: 2
        });

        await ReponseQuestion.create({
            question_id: question2.id,
            texte_reponse: 'Amélioration des performances',
            est_correcte: false,
            ordre: 3
        });

        console.log('✅ Quiz et questions créés');

        // Ajouter des documents à la partie 3
        const document1 = await DocumentPartie.create({
            partie_id: partie3.id,
            titre: 'Guide pratique de prévention',
            description: 'Guide complet pour prévenir le burn-out',
            nom_fichier: 'guide-prevention-burnout.pdf',
            chemin_fichier: '/documents/guide-prevention-burnout.pdf',
            type_document: 'pdf',
            taille_fichier: 2097152, // 2MB
            actif: true
        });

        const document2 = await DocumentPartie.create({
            partie_id: partie3.id,
            titre: 'Checklist bien-être',
            description: 'Checklist quotidienne pour maintenir son bien-être',
            nom_fichier: 'checklist-bien-etre.pdf',
            chemin_fichier: '/documents/checklist-bien-etre.pdf',
            type_document: 'pdf',
            taille_fichier: 1048576, // 1MB
            actif: true
        });

        console.log('✅ Documents ajoutés');

        // Créer un deuxième module
        const module2 = await Module.create({
            formation_id: 2,
            titre: 'Techniques de gestion du stress',
            description: 'Apprenez les techniques efficaces pour gérer le stress',
            duree_minutes: 60,
            type_contenu: 'video',
            ordre: 2,
            disponible: true
        });

        const partie4 = await PartieModule.create({
            module_id: module2.id,
            titre: 'Techniques de relaxation',
            description: 'Découvrez différentes techniques de relaxation',
            type_contenu: 'video',
            duree_minutes: 30,
            ordre: 1
        });

        await VideoPartie.create({
            partie_id: partie4.id,
            titre: 'Techniques de respiration',
            description: 'Apprenez les techniques de respiration anti-stress',
            nom_fichier: 'sample-relaxation.mp4',
            chemin_fichier: '/videos/sample-relaxation.mp4',
            url_video: '/videos/sample-relaxation.mp4',
            duree_secondes: 1800, // 30 minutes
            taille_fichier: 104857600, // 100MB
            format_video: 'mp4',
            acces_connecte_uniquement: true
        });

        console.log('✅ Deuxième module créé');

        // Mettre à jour le nombre de modules de la formation
        await formation.update({
            nombre_modules: 2
        });

        console.log('🎉 Données de test ajoutées avec succès !');
        console.log('');
        console.log('📋 Résumé:');
        console.log(`- Formation: ${formation.titre}`);
        console.log('- 2 modules créés');
        console.log('- 4 parties créées');
        console.log('- 2 vidéos ajoutées');
        console.log('- 1 quiz avec 2 questions créé');
        console.log('- 2 documents ajoutés');
        console.log('');
        console.log('🔗 Vous pouvez maintenant tester:');
        console.log(`- /formation/bien-etre-et-prevention-du-burn-out/detail`);
        console.log(`- /formation/bien-etre-et-prevention-du-burn-out/module/1`);
        console.log(`- /formation/bien-etre-et-prevention-du-burn-out/module/1/partie/1`);

    } catch (error) {
        console.error('❌ Erreur lors de l\'ajout des données:', error);
    } finally {
        await sequelize.close();
    }
}

// Exécuter le script
addTestDataToFormation();