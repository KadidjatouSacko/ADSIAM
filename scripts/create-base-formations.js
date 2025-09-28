import {
    Formation,
    sequelize
} from '../models/index.js';

async function createBaseFormations() {
    try {
        console.log('🚀 Création des formations de base...');

        const formationsData = [
            {
                titre: 'Communication & Relationnel',
                description: 'Maîtrisez les techniques de communication pour améliorer vos relations avec les résidents et les familles.',
                icone: '🗣️',
                niveau: 'debutant',
                duree_heures: 3,
                nombre_modules: 4,
                prix: 89.99,
                prix_original: 129.99,
                gratuit: false,
                domaine: 'communication',
                badge: 'Populaire',
                populaire: true,
                nouveau: false,
                certifiant: true,
                actif: true
            },
            {
                titre: 'Hygiène, Sécurité & Prévention',
                description: 'Apprenez les protocoles d\'hygiène et de sécurité essentiels pour protéger les résidents et vous-même.',
                icone: '🛡️',
                niveau: 'intermediaire',
                duree_heures: 4,
                nombre_modules: 5,
                prix: 0,
                prix_original: 99.99,
                gratuit: true,
                domaine: 'hygiene',
                badge: 'Gratuit',
                populaire: false,
                nouveau: true,
                certifiant: true,
                actif: true
            },
            {
                titre: 'Gestion des Urgences & Premiers Secours',
                description: 'Réagissez efficacement en situation d\'urgence et maîtrisez les gestes de premiers secours.',
                icone: '🚨',
                niveau: 'avance',
                duree_heures: 6,
                nombre_modules: 6,
                prix: 149.99,
                prix_original: 199.99,
                gratuit: false,
                domaine: 'urgences',
                badge: 'Essentiel',
                populaire: true,
                nouveau: false,
                certifiant: true,
                actif: true
            },
            {
                titre: 'Pathologies & Situations Spécifiques',
                description: 'Comprenez les principales pathologies et adaptez votre accompagnement selon les besoins spécifiques.',
                icone: '🧠',
                niveau: 'expert',
                duree_heures: 8,
                nombre_modules: 7,
                prix: 199.99,
                prix_original: 249.99,
                gratuit: false,
                domaine: 'pathologies',
                badge: 'Expert',
                populaire: false,
                nouveau: false,
                certifiant: true,
                actif: true
            },
            {
                titre: 'Préparation des Repas & Alimentation',
                description: 'Maîtrisez les techniques de préparation des repas adaptés aux besoins nutritionnels des seniors.',
                icone: '🍽️',
                niveau: 'intermediaire',
                duree_heures: 3,
                nombre_modules: 4,
                prix: 79.99,
                prix_original: 109.99,
                gratuit: false,
                domaine: 'nutrition',
                badge: 'Nouveau',
                populaire: false,
                nouveau: true,
                certifiant: false,
                actif: true
            },
            {
                titre: 'Ergonomie & Gestes Professionnels',
                description: 'Préservez votre santé physique avec les bonnes techniques de manutention et de positionnement.',
                icone: '🏥',
                niveau: 'debutant',
                duree_heures: 2,
                nombre_modules: 3,
                prix: 59.99,
                prix_original: 89.99,
                gratuit: false,
                domaine: 'ergonomie',
                badge: 'Pratique',
                populaire: true,
                nouveau: false,
                certifiant: false,
                actif: true
            }
        ];

        let created = 0;
        let existing = 0;

        for (const formationData of formationsData) {
            // Vérifier si la formation existe déjà
            const existingFormation = await Formation.findOne({
                where: { titre: formationData.titre }
            });

            if (!existingFormation) {
                await Formation.create(formationData);
                console.log(`✅ Formation créée: ${formationData.titre}`);
                created++;
            } else {
                console.log(`ℹ️ Formation déjà existante: ${formationData.titre}`);
                existing++;
            }
        }

        console.log('');
        console.log('🎉 Formations de base créées avec succès !');
        console.log('');
        console.log('📊 Résumé:');
        console.log(`- Formations créées: ${created}`);
        console.log(`- Formations déjà existantes: ${existing}`);
        console.log(`- Total: ${formationsData.length} formations`);
        console.log('');
        console.log('🔗 Domaines couverts:');
        console.log('- Communication & Relationnel');
        console.log('- Hygiène, Sécurité & Prévention');
        console.log('- Gestion des Urgences & Premiers Secours');
        console.log('- Pathologies & Situations Spécifiques');
        console.log('- Préparation des Repas & Alimentation');
        console.log('- Ergonomie & Gestes Professionnels');

    } catch (error) {
        console.error('❌ Erreur lors de la création des formations:', error);
    } finally {
        await sequelize.close();
    }
}

// Exécuter le script
createBaseFormations();