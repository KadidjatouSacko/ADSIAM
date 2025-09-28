// Script pour créer des données de démonstration pour le player de formation
import { sequelize } from '../models/index.js';
import { QueryTypes } from 'sequelize';

async function createFormationDemo() {
    try {
        console.log('🚀 Création des données de démonstration...');

        // Vérifier si une formation existe déjà
        const formations = await sequelize.query(`
            SELECT * FROM formations WHERE id = 2 LIMIT 1
        `, { type: QueryTypes.SELECT });

        if (!formations.length) {
            console.log('Aucune formation trouvée avec ID 2. Création en cours...');

            // Créer une formation de démonstration
            await sequelize.query(`
                INSERT INTO formations (
                    id, titre, description, niveau, domaine, prix, gratuit,
                    duree_heures, nombre_modules, actif, populaire,
                    createdat, updatedat
                ) VALUES (
                    2,
                    'Formation Hygiène et Soins à Domicile',
                    'Formation complète sur les bonnes pratiques d\'hygiène et les soins à domicile pour les aides à domicile et aides-soignants.',
                    'debutant',
                    'hygiene',
                    0,
                    true,
                    6,
                    3,
                    true,
                    true,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    titre = EXCLUDED.titre,
                    description = EXCLUDED.description,
                    updatedat = NOW()
            `, { type: QueryTypes.INSERT });
        }

        // Vérifier si des modules existent
        const modules = await sequelize.query(`
            SELECT * FROM modules WHERE formation_id = 2
        `, { type: QueryTypes.SELECT });

        if (!modules.length) {
            console.log('Création des modules de démonstration...');

            // Créer les modules
            await sequelize.query(`
                INSERT INTO modules (
                    id, formation_id, titre, description, ordre, duree_minutes,
                    actif, obligatoire, createdat, updatedat
                ) VALUES
                (16, 2, 'Introduction à l\'hygiène', 'Module d\'introduction aux bonnes pratiques d\'hygiène et de sécurité', 1, 90, true, true, NOW(), NOW()),
                (17, 2, 'Soins corporels et toilette', 'Techniques de soins corporels et d\'hygiène personnelle', 2, 120, true, true, NOW(), NOW()),
                (18, 2, 'Sécurité et prévention', 'Mesures de sécurité et prévention des risques à domicile', 3, 90, true, true, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    titre = EXCLUDED.titre,
                    description = EXCLUDED.description,
                    updatedat = NOW()
            `, { type: QueryTypes.INSERT });
        }

        // Vérifier si la table contenus_module existe
        try {
            const contenus = await sequelize.query(`
                SELECT * FROM contenus_module WHERE module_id = 16 LIMIT 1
            `, { type: QueryTypes.SELECT });

            if (!contenus.length) {
                console.log('Création du contenu des modules...');

                // Créer le contenu pour le module 16 (Introduction à l'hygiène)
                await sequelize.query(`
                    INSERT INTO contenus_module (
                        module_id, titre, description, type_contenu, ordre,
                        duree_minutes, actif, createdat, updatedat
                    ) VALUES
                    (16, 'Vidéo d\'introduction', 'Introduction aux bonnes pratiques d\'hygiène', 'video', 1, 15, true, NOW(), NOW()),
                    (16, 'Les principes de base', 'Principes fondamentaux de l\'hygiène à domicile', 'texte', 2, 20, true, NOW(), NOW()),
                    (16, 'Quiz de validation', 'Test de connaissances sur l\'hygiène', 'quiz', 3, 10, true, NOW(), NOW()),
                    (16, 'Guide de référence', 'Document PDF de référence', 'document', 4, 5, true, NOW(), NOW())
                    ON CONFLICT (id) DO NOTHING
                `, { type: QueryTypes.INSERT });
            }

        } catch (error) {
            console.log('⚠️ Table contenus_module non trouvée, création des données de démonstration en mémoire seulement');
        }

        // Vérifier si des inscriptions existent pour l'utilisateur de test
        const inscriptions = await sequelize.query(`
            SELECT * FROM inscriptions WHERE formation_id = 2 LIMIT 1
        `, { type: QueryTypes.SELECT });

        if (!inscriptions.length) {
            console.log('Création d\'une inscription de démonstration...');

            // Trouver un utilisateur de test
            const users = await sequelize.query(`
                SELECT * FROM users WHERE role != 'admin' LIMIT 1
            `, { type: QueryTypes.SELECT });

            if (users.length > 0) {
                await sequelize.query(`
                    INSERT INTO inscriptions (
                        user_id, formation_id, statut, progression_pourcentage,
                        date_inscription, createdat, updatedat
                    ) VALUES (
                        :userId, 2, 'en_cours', 25, NOW(), NOW(), NOW()
                    )
                    ON CONFLICT (user_id, formation_id) DO UPDATE SET
                        statut = 'en_cours',
                        updatedat = NOW()
                `, {
                    type: QueryTypes.INSERT,
                    replacements: { userId: users[0].id }
                });

                console.log(`✅ Inscription créée pour l'utilisateur ${users[0].prenom} ${users[0].nom}`);
            }
        }

        console.log('✅ Données de démonstration créées avec succès !');
        console.log('🎯 Vous pouvez maintenant tester la route: /formation/2/continuer');

    } catch (error) {
        console.error('❌ Erreur lors de la création des données de démonstration:', error);
    }
}

// Exécuter le script
createFormationDemo()
    .then(() => {
        console.log('🏁 Script terminé');
        process.exit(0);
    })
    .catch(error => {
        console.error('💥 Erreur fatale:', error);
        process.exit(1);
    });