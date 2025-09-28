import { Formation, sequelize } from '../models/index.js';

// Fonction pour créer un slug
function createSlug(titre) {
    return titre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim('-');
}

async function listFormations() {
    try {
        console.log('📚 Liste des formations et leurs slugs:');

        const formations = await Formation.findAll();

        console.log(`\nNombre de formations: ${formations.length}\n`);

        formations.forEach(formation => {
            const slug = createSlug(formation.titre);
            console.log(`ID: ${formation.id}`);
            console.log(`Titre: "${formation.titre}"`);
            console.log(`Slug: "${slug}"`);
            console.log(`---`);
        });

        console.log('\nRecherche du slug "formation-test-video-et-quiz":');
        const targetSlug = 'formation-test-video-et-quiz';
        const foundFormation = formations.find(f => createSlug(f.titre) === targetSlug);

        if (foundFormation) {
            console.log(`✅ Formation trouvée: ID ${foundFormation.id} - "${foundFormation.titre}"`);
        } else {
            console.log(`❌ Aucune formation ne correspond au slug "${targetSlug}"`);
        }

    } catch (error) {
        console.error('❌ Erreur:', error);
    } finally {
        await sequelize.close();
    }
}

listFormations();