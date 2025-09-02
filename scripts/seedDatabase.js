// scripts/seedDatabase.js
import { sequelize, Formation, Module, Caracteristique, Avis } from '../models/index.js';

class DatabaseSeeder {
  
  async run() {
    try {
      console.log('🌱 Début de la population de la base de données...');
      
      // Synchroniser et recréer les tables
      await sequelize.sync({ force: true });
      console.log('✅ Tables créées avec succès');

      await this.createFormations();
      await this.createModules();
      await this.createCaracteristiques();
      await this.createAvis();

      console.log('🎉 Base de données populée avec succès !');
      console.log(`📊 Résumé :`);
      console.log(`   - ${await Formation.count()} formations`);
      console.log(`   - ${await Module.count()} modules`);
      console.log(`   - ${await Caracteristique.count()} caractéristiques`);
      console.log(`   - ${await Avis.count()} avis`);
      
    } catch (error) {
      console.error('❌ Erreur lors de la population:', error);
      throw error;
    }
  }

  async createFormations() {
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
      },
      {
        titre: 'Bonnes Pratiques & Déontologie',
        description: 'Limites professionnelles, confidentialité, bonnes pratiques quotidiennes et gestion des situations délicates.',
        icone: '⚖️',
        niveau: 'intermediaire',
        duree_heures: 3,
        nombre_modules: 3,
        prix: 45.00,
        gratuit: false,
        domaine: 'communication',
        badge: 'Professionnel',
        populaire: false,
        certifiant: false
      },
      {
        titre: 'Professionnalisation & Bien-être',
        description: 'Gestion du stress, prévention de l\'épuisement, organisation du temps et formation continue.',
        icone: '💪',
        niveau: 'avance',
        duree_heures: 3,
        nombre_modules: 3,
        prix: 39.00,
        gratuit: false,
        domaine: 'communication',
        badge: 'Bien-être',
        populaire: false,
        nouveau: true,
        certifiant: false
      }
    ];

    const formations = await Formation.bulkCreate(formationsData);
    console.log(`✅ ${formations.length} formations créées`);
    return formations;
  }

  async createModules() {
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
    return modules;
  }

  async createCaracteristiques() {
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
    return caracteristiques;
  }

  async createAvis() {
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
      },
      {
        formation_id: 3,
        nom_utilisateur: 'Isabelle Moreau',
        role: 'Aide-soignante',
        ville: 'Strasbourg',
        note: 5,
        commentaire: 'Formation indispensable ! Les techniques de manutention m\'ont évité bien des douleurs.',
        verifie: true
      },
      {
        formation_id: 4,
        nom_utilisateur: 'Thomas Petit',
        role: 'Responsable EHPAD',
        ville: 'Bordeaux',
        note: 5,
        commentaire: 'Formation critique que tout professionnel devrait suivre. Très bien expliquée.',
        verifie: true
      }
    ];

    const avis = await Avis.bulkCreate(avisData);
    console.log(`✅ ${avis.length} avis créés`);
    return avis;
  }
}

// Exécution du script
async function runSeeder() {
  const seeder = new DatabaseSeeder();
  
  try {
    await seeder.run();
    console.log('🏁 Script terminé avec succès');
    process.exit(0);
  } catch (error) {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  }
}

// Vérifier si le script est exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
  runSeeder();
}

export default DatabaseSeeder