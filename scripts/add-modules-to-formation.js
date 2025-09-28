// Script pour ajouter des modules à une formation existante
import { sequelize } from '../models/index.js';
import { QueryTypes } from 'sequelize';

async function addModulesToFormation() {
    try {
        console.log('🚀 Ajout de modules à la formation...');

        // Vérifier s'il y a des formations
        const formations = await sequelize.query(`
            SELECT * FROM formations WHERE actif = true ORDER BY id LIMIT 5
        `, { type: QueryTypes.SELECT });

        if (!formations.length) {
            console.log('❌ Aucune formation trouvée');
            return;
        }

        console.log(`✅ ${formations.length} formations trouvées:`);
        formations.forEach(f => {
            console.log(`  - ID: ${f.id}, Titre: ${f.titre}`);
        });

        // Prendre la première formation
        const formation = formations[0];
        console.log(`\n🎯 Ajout de modules à la formation: "${formation.titre}" (ID: ${formation.id})`);

        // Vérifier s'il y a déjà des modules
        const existingModules = await sequelize.query(`
            SELECT * FROM modules WHERE formation_id = :formationId
        `, {
            type: QueryTypes.SELECT,
            replacements: { formationId: formation.id }
        });

        if (existingModules.length > 0) {
            console.log(`✅ ${existingModules.length} modules déjà présents:`);
            existingModules.forEach(m => {
                console.log(`  - Module ${m.ordre}: ${m.titre}`);
            });
        } else {
            console.log('📝 Création de nouveaux modules...');

            // Créer des modules selon le domaine de la formation
            let modules = [];

            if (formation.domaine === 'hygiene') {
                modules = [
                    {
                        titre: "Hygiène des mains et EPI",
                        description: "Apprentissage des techniques de lavage des mains et utilisation des équipements de protection individuelle",
                        ordre: 1,
                        duree_minutes: 45
                    },
                    {
                        titre: "Hygiène corporelle et soins",
                        description: "Techniques d'hygiène corporelle et de soins à la personne",
                        ordre: 2,
                        duree_minutes: 60
                    },
                    {
                        titre: "Prévention des infections",
                        description: "Mesures de prévention et contrôle des infections",
                        ordre: 3,
                        duree_minutes: 40
                    }
                ];
            } else if (formation.domaine === 'communication') {
                modules = [
                    {
                        titre: "Communication bienveillante",
                        description: "Techniques de communication adaptée aux personnes âgées",
                        ordre: 1,
                        duree_minutes: 50
                    },
                    {
                        titre: "Gestion des situations difficiles",
                        description: "Approches pour gérer les situations de conflit ou de stress",
                        ordre: 2,
                        duree_minutes: 45
                    }
                ];
            } else {
                // Modules génériques
                modules = [
                    {
                        titre: "Introduction au module",
                        description: "Présentation générale et objectifs du module",
                        ordre: 1,
                        duree_minutes: 30
                    },
                    {
                        titre: "Mise en pratique",
                        description: "Exercices pratiques et mise en situation",
                        ordre: 2,
                        duree_minutes: 45
                    },
                    {
                        titre: "Évaluation des acquis",
                        description: "Quiz et validation des connaissances",
                        ordre: 3,
                        duree_minutes: 20
                    }
                ];
            }

            // Insérer les modules
            for (const module of modules) {
                await sequelize.query(`
                    INSERT INTO modules (
                        formation_id, titre, description, duree_minutes, ordre,
                        type_contenu, disponible, createdat, updatedat
                    ) VALUES (
                        :formationId, :titre, :description, :dureeMinutes, :ordre,
                        'mixte', true, NOW(), NOW()
                    )
                `, {
                    type: QueryTypes.INSERT,
                    replacements: {
                        formationId: formation.id,
                        titre: module.titre,
                        description: module.description,
                        dureeMinutes: module.duree_minutes,
                        ordre: module.ordre
                    }
                });

                console.log(`  ✅ Module ajouté: ${module.titre}`);
            }

            // Mettre à jour le nombre de modules dans la formation
            await sequelize.query(`
                UPDATE formations
                SET nombre_modules = :nombreModules,
                    updatedat = NOW()
                WHERE id = :formationId
            `, {
                type: QueryTypes.UPDATE,
                replacements: {
                    nombreModules: modules.length,
                    formationId: formation.id
                }
            });

            console.log(`\n🎯 ${modules.length} modules ajoutés avec succès !`);
        }

        // Récupérer les modules finaux
        const finalModules = await sequelize.query(`
            SELECT * FROM modules WHERE formation_id = :formationId ORDER BY ordre
        `, {
            type: QueryTypes.SELECT,
            replacements: { formationId: formation.id }
        });

        console.log(`\n📋 Modules finaux pour la formation "${formation.titre}":`);
        finalModules.forEach(m => {
            console.log(`  ${m.ordre}. ${m.titre} (${m.duree_minutes}min)`);
            console.log(`     ${m.description}`);
        });

        console.log(`\n🚀 Vous pouvez maintenant tester: /formation/${formation.id}/continuer`);

    } catch (error) {
        console.error('❌ Erreur:', error);
    }
}

// Exécuter le script
addModulesToFormation()
    .then(() => {
        console.log('\n🏁 Script terminé');
        process.exit(0);
    })
    .catch(error => {
        console.error('💥 Erreur fatale:', error);
        process.exit(1);
    });