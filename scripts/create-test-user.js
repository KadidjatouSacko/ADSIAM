import {
    User,
    Formation,
    Inscription,
    sequelize
} from '../models/index.js';

async function createTestUser() {
    try {
        console.log('🚀 Création de l\'utilisateur de test...');

        // Vérifier si l'utilisateur existe déjà
        let user = await User.findByPk(1);

        if (!user) {
            // Créer l'utilisateur de test
            user = await User.create({
                id: 1,
                prenom: 'Marie',
                nom: 'Martin',
                email: 'marie.martin@test.com',
                mot_de_passe: 'password123', // En production, cela serait hashé
                role: 'etudiant',
                type_utilisateur: 'etudiant',
                statut: 'actif',
                date_inscription: new Date()
            });
            console.log('✅ Utilisateur de test créé');
        } else {
            console.log('✅ Utilisateur de test déjà existant');
        }

        // Récupérer toutes les formations
        const formations = await Formation.findAll();
        console.log(`📚 ${formations.length} formations trouvées`);

        if (formations.length === 0) {
            console.log('❌ Aucune formation trouvée. Créez d\'abord des formations.');
            return;
        }

        // Inscrire l'utilisateur à toutes les formations pour le test
        for (const formation of formations) {
            // Vérifier si déjà inscrit
            const existingInscription = await Inscription.findOne({
                where: {
                    user_id: user.id,
                    formation_id: formation.id
                }
            });

            if (!existingInscription) {
                // Utiliser seulement 'en_cours' pour éviter les problèmes de contraintes
                await Inscription.create({
                    user_id: user.id,
                    formation_id: formation.id,
                    date_inscription: new Date(),
                    statut: 'en_cours',
                    progression_pourcentage: Math.floor(Math.random() * 80) + 10,
                    temps_total_minutes: Math.floor(Math.random() * 300) + 60,
                    certifie: false,
                    note_finale: null
                });
                console.log(`✅ Inscrit à: ${formation.titre}`);
            } else {
                console.log(`ℹ️ Déjà inscrit à: ${formation.titre}`);
            }
        }

        console.log('');
        console.log('🎉 Utilisateur de test créé avec succès !');
        console.log('');
        console.log('📋 Détails:');
        console.log(`- ID: ${user.id}`);
        console.log(`- Nom: ${user.prenom} ${user.nom}`);
        console.log(`- Email: ${user.email}`);
        console.log(`- Rôle: ${user.role}`);
        console.log(`- Statut: ${user.statut}`);
        console.log(`- Inscriptions: ${formations.length} formations`);
        console.log('');
        console.log('🔗 Vous pouvez maintenant tester:');
        console.log('- http://localhost:3000/formations');
        console.log('- http://localhost:3000/dashboard');
        console.log('- http://localhost:3000/profil');

    } catch (error) {
        console.error('❌ Erreur lors de la création de l\'utilisateur:', error);
    } finally {
        await sequelize.close();
    }
}

// Exécuter le script
createTestUser();