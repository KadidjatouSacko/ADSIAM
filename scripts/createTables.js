// scripts/createTables.js - Script pour créer les tables et les données
import { sequelize, Formation, Module, Caracteristique, Avis } from '../models/index.js';

async function createTablesAndData() {
  try {
    console.log('🚀 Début de la création des tables et données...');
    
    // 1. Synchroniser les modèles (créer les tables)
    console.log('📋 Création des tables...');
    await sequelize.sync({ force: true }); // force: true supprime et recrée les tables
    console.log('✅ Tables créées avec succès');

    // 2. Créer les formations
    console.log('📚 Insertion des formations...');
    const formationsData = [
      {
        titre: 'Communication & Relationnel',
        description: 'Maîtrisez l\'art de la communication bienveillante, la gestion des émotions et des situations difficiles avec les résidents et les familles.',
        icone: '🗣️',
        niveau: 'debutant',
        duree_heures: 3,
        nombre_modules: 5,
        prix: 0.00,
        gratuit: true,
        domaine: 'communication',
        badge: 'Essentiel',
        populaire: true,
        certifiant: true
      },
      {
        titre: 'Hygiène, Sécurité & Prévention',
        description: 'Protocoles d\'hygiène professionnelle, sécurité avec les produits ménagers, prévention des risques domestiques et des infections.',
        icone: '🛡️',
        niveau: 'intermediaire',
        duree_heures: 4,
        nombre_modules: 4,
        prix: 49.00,
        prix_original: 79.00,
        gratuit: false,
        domaine: 'hygiene',
        badge: 'Avancé',
        populaire: true,
        certifiant: true
      },
      {
        titre: 'Ergonomie & Gestes Professionnels',
        description: 'Techniques de manutention, prévention des TMS, utilisation du matériel médical et accompagnement sécurisé des transferts.',
        icone: '🏥',
        niveau: 'avance',
        duree_heures: 5,
        nombre_modules: 3,
        prix: 79.00,
        gratuit: false,
        domaine: 'ergonomie',
        badge: 'Expert',
        populaire: true,
        certifiant: true
      },
      {
        titre: 'Gestion des Urgences & Premiers Secours',
        description: 'Formation complète aux gestes qui sauvent : RCP, défibrillateur, position latérale de sécurité, gestion des blessures.',
        icone: '🚨',
        niveau: 'expert',
        duree_heures: 6,
        nombre_modules: 5,
        prix: 99.00,
        gratuit: false,
        domaine: 'urgences',
        badge: 'Critique',
        populaire: true,
        certifiant: true
      },
      {
        titre: 'Préparation des Repas & Alimentation',
        description: 'Hygiène alimentaire, repas équilibrés adaptés, gestion des textures pour éviter les fausses routes.',
        icone: '🍽️',
        niveau: 'intermediaire',
        duree_heures: 4,
        nombre_modules: 4,
        prix: 59.00,
        gratuit: false,
        domaine: 'nutrition',
        badge: 'Pratique',
        populaire: false,
        certifiant: false
      },
      {
        titre: 'Pathologies & Situations Spécifiques',
        description: 'Accompagnement des troubles cognitifs, Alzheimer, maladies chroniques, perte de mobilité et fin de vie.',
        icone: '🧠',
        niveau: 'expert',
        duree_heures: 5,
        nombre_modules: 4,
        prix: 89.00,
        gratuit: false,
        domaine: 'pathologies',
        badge: 'Spécialisé',
        populaire: false,
        nouveau: true,
        certifiant: true
      }
    ];

    const formations = await Formation.bulkCreate(formationsData);
    console.log(`✅ ${formations.length} formations créées`);

    // 3. Créer les modules
    console.log('🎯 Insertion des modules...');
    const modulesData = [
      // Modules pour Communication & Relationnel (formation_id: 1)
      {
        formation_id: 1,
        titre: 'Introduction à la communication professionnelle',
        description: 'Découvrez le rôle et les enjeux de la communication dans le secteur de l\'aide à domicile.',
        ordre: 1,
        duree_minutes: 15,
        type_contenu: 'video',
        disponible: true
      },
      {
        formation_id: 1,
        titre: 'Les bases de la communication bienveillante',
        description: 'Maîtrisez l\'écoute active et la reformulation.',
        ordre: 2,
        duree_minutes: 20,
        type_contenu: 'video',
        disponible: true
      },
      {
        formation_id: 1,
        titre: 'Gestion des émotions et situations difficiles',
        description: 'Apprenez à identifier vos émotions et celles de la personne accompagnée.',
        ordre: 3,
        duree_minutes: 25,
        type_contenu: 'video',
        disponible: false
      },
      {
        formation_id: 1,
        titre: 'Communication avec les familles et l\'équipe',
        description: 'Maîtrisez la transmission claire des informations.',
        ordre: 4,
        duree_minutes: 18,
        type_contenu: 'video',
        disponible: false
      },
      {
        formation_id: 1,
        titre: 'Respect de la dignité et de l\'autonomie',
        description: 'Apprenez à encourager l\'autonomie sans imposer.',
        ordre: 5,
        duree_minutes: 22,
        type_contenu: 'video',
        disponible: false
      },
      
      // Modules pour Hygiène & Sécurité (formation_id: 2)
      {
        formation_id: 2,
        titre: 'Protocoles d\'hygiène de base',
        description: 'Les règles fondamentales d\'hygiène en milieu professionnel.',
        ordre: 1,
        duree_minutes: 30,
        type_contenu: 'video',
        disponible: true
      },
      {
        formation_id: 2,
        titre: 'Sécurité avec les produits ménagers',
        description: 'Manipulation et stockage sécurisés des produits chimiques.',
        ordre: 2,
        duree_minutes: 25,
        type_contenu: 'video',
        disponible: true
      },
      {
        formation_id: 2,
        titre: 'Prévention des infections',
        description: 'Techniques de prévention et de contrôle des infections.',
        ordre: 3,
        duree_minutes: 35,
        type_contenu: 'video',
        disponible: false
      },
      {
        formation_id: 2,
        titre: 'Prévention des chutes et accidents',
        description: 'Identifier et prévenir les risques d\'accidents domestiques.',
        ordre: 4,
        duree_minutes: 30,
        type_contenu: 'video',
        disponible: false
      }
    ];

    const modules = await Module.bulkCreate(modulesData);
    console.log(`✅ ${modules.length} modules créés`);

    // 4. Créer les caractéristiques
    console.log('⭐ Insertion des caractéristiques...');
    const caracteristiquesData = [
      // Formation Communication (ID: 1)
      { formation_id: 1, titre: 'Écoute active', icone: '✓' },
      { formation_id: 1, titre: 'Gestion conflits', icone: '✓' },
      { formation_id: 1, titre: 'Respect dignité', icone: '✓' },
      { formation_id: 1, titre: 'Vidéos pratiques', icone: '✓' },
      
      // Formation Hygiène (ID: 2)
      { formation_id: 2, titre: 'Protocoles hygiène', icone: '✓' },
      { formation_id: 2, titre: 'Sécurité produits', icone: '✓' },
      { formation_id: 2, titre: 'Prévention chutes', icone: '✓' },
      { formation_id: 2, titre: 'Anti-infections', icone: '✓' },
      
      // Formation Ergonomie (ID: 3)
      { formation_id: 3, titre: 'Bonnes postures', icone: '✓' },
      { formation_id: 3, titre: 'Transferts sécurisés', icone: '✓' },
      { formation_id: 3, titre: 'Matériel médical', icone: '✓' },
      { formation_id: 3, titre: 'Prévention TMS', icone: '✓' },
      
      // Formation Urgences (ID: 4)
      { formation_id: 4, titre: 'RCP & Défibrillateur', icone: '✓' },
      { formation_id: 4, titre: 'Position PLS', icone: '✓' },
      { formation_id: 4, titre: 'Gestion blessures', icone: '✓' },
      { formation_id: 4, titre: 'Situations critiques', icone: '✓' },
      
      // Formation Nutrition (ID: 5)
      { formation_id: 5, titre: 'Hygiène alimentaire', icone: '✓' },
      { formation_id: 5, titre: 'Repas équilibrés', icone: '✓' },
      { formation_id: 5, titre: 'Textures adaptées', icone: '✓' },
      { formation_id: 5, titre: 'Hydratation', icone: '✓' },
      
      // Formation Pathologies (ID: 6)
      { formation_id: 6, titre: 'Troubles cognitifs', icone: '✓' },
      { formation_id: 6, titre: 'Maladies chroniques', icone: '✓' },
      { formation_id: 6, titre: 'Perte mobilité', icone: '✓' },
      { formation_id: 6, titre: 'Fin de vie', icone: '✓' }
    ];

    const caracteristiques = await Caracteristique.bulkCreate(caracteristiquesData);
    console.log(`✅ ${caracteristiques.length} caractéristiques créées`);

    // 5. Créer les avis
    console.log('💬 Insertion des avis...');
    const avisData = [
      {
        formation_id: 1,
        nom_utilisateur: 'Sophie Martin',
        role: 'Aide à domicile',
        ville: 'Paris',
        note: 5,
        commentaire: 'Cette formation m\'a vraiment aidée dans mon quotidien. Les techniques de communication bienveillante ont transformé mes relations avec les personnes que j\'accompagne.',
        verifie: true
      },
      {
        formation_id: 1,
        nom_utilisateur: 'Marie Dubois',
        role: 'Auxiliaire de vie',
        ville: 'Lyon',
        note: 5,
        commentaire: 'Excellente formation ! J\'ai particulièrement apprécié le module sur la gestion des émotions.',
        verifie: true
      },
      {
        formation_id: 1,
        nom_utilisateur: 'Jean Legrand',
        role: 'Aide-soignant EHPAD',
        ville: 'Marseille',
        note: 4,
        commentaire: 'Formation très complète et bien structurée. Les PDF téléchargeables sont parfaits pour réviser.',
        verifie: true
      },
      {
        formation_id: 2,
        nom_utilisateur: 'Claire Bernard',
        role: 'Aide à domicile',
        ville: 'Toulouse',
        note: 5,
        commentaire: 'Les protocoles d\'hygiène sont très clairs et faciles à appliquer au quotidien.',
        verifie: true
      },
      {
        formation_id: 2,
        nom_utilisateur: 'Pierre Dumont',
        role: 'Auxiliaire de vie',
        ville: 'Nice',
        note: 4,
        commentaire: 'Bonne formation sur la sécurité. J\'aurais aimé plus d\'exemples concrets.',
        verifie: true
      }
    ];

    const avis = await Avis.bulkCreate(avisData);
    
    console.log(`✅ ${avis.length} avis créés`);

    // 6. Vérifications finales
    console.log('🔍 Vérifications finales...');
    const totalFormations = await Formation.count();
    const totalModules = await Module.count();
    const totalCaracteristiques = await Caracteristique.count();
    const totalAvis = await Avis.count();

    console.log('📊 Résumé de la base de données :');
    console.log(`   - ${totalFormations} formations`);
    console.log(`   - ${totalModules} modules`);
    console.log(`   - ${totalCaracteristiques} caractéristiques`);
    console.log(`   - ${totalAvis} avis`);
    console.log('');
    console.log('🎉 Base de données créée et peuplée avec succès !');
    console.log('🚀 Vous pouvez maintenant démarrer votre serveur avec: npm run dev');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création:', error);
    throw error;
  }
}

// Exécuter le script si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  createTablesAndData()
    .then(() => {
      console.log('✅ Script terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erreur fatale:', error);
      process.exit(1);
    });
}

export default createTablesAndData;