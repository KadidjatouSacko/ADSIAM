// models/index.js - Version avec debug pour identifier le problème
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import FormationModel from './Formation.js';
import ModuleModel from './Module.js';
import CaracteristiqueModel from './Caracteristique.js';
import AvisModel from './Avis.js';

// Charger les variables d'environnement
dotenv.config();

// 🐛 DEBUG: Afficher les variables d'environnement
console.log('🔍 Variables d\'environnement détectées :');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  DB_NAME:', process.env.DB_NAME);
console.log('  DB_USER:', process.env.DB_USER);
console.log('  DB_HOST:', process.env.DB_HOST);
console.log('  DB_PORT:', process.env.DB_PORT);
// Ne pas afficher le mot de passe pour la sécurité
console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? '***masqué***' : 'NON DÉFINI');

// Vérifier si toutes les variables sont définies
const requiredVars = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Variables d\'environnement manquantes:', missingVars);
  console.error('📁 Vérifiez votre fichier .env à la racine du projet');
  process.exit(1);
}

// Configuration de la connexion Sequelize
const sequelizeConfig = {
  host: process.env.DB_HOST,
  dialect: 'postgres',
  port: process.env.DB_PORT || 5432,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: false,
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};

console.log('🔧 Configuration Sequelize:', {
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  host: sequelizeConfig.host,
  port: sequelizeConfig.port,
  dialect: sequelizeConfig.dialect
});

// Créer l'instance Sequelize
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  sequelizeConfig
);

// Test de connexion avec gestion d'erreurs détaillée
async function testConnection() {
  try {
    console.log('🔌 Test de connexion à la base de données...');
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données réussie');
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:');
    console.error('   Message:', error.message);
    console.error('   Code erreur:', error.original?.code);
    console.error('   Détails:', error.original?.detail);
    
    // Suggestions basées sur l'erreur
    if (error.message.includes('does not exist') || error.message.includes('n\'existe pas')) {
      console.error('');
      console.error('🔧 SOLUTION: La base de données n\'existe pas. Créez-la avec:');
      console.error('   psql -U postgres -c "CREATE DATABASE \\"' + process.env.DB_NAME + '\\""');
      console.error('   ou utilisez pgAdmin pour créer la base de données');
    } else if (error.message.includes('authentication failed') || error.message.includes('password authentication failed')) {
      console.error('');
      console.error('🔧 SOLUTION: Problème d\'authentification. Vérifiez:');
      console.error('   - Le nom d\'utilisateur dans DB_USER');
      console.error('   - Le mot de passe dans DB_PASSWORD');
      console.error('   - Que l\'utilisateur existe dans PostgreSQL');
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('connect ECONNREFUSED')) {
      console.error('');
      console.error('🔧 SOLUTION: PostgreSQL n\'est pas démarré. Démarrez le service:');
      console.error('   - Windows: Services → PostgreSQL');
      console.error('   - Ou via pgAdmin');
    }
    
    throw error;
  }
}

// Initialiser les modèles
console.log('📦 Initialisation des modèles...');
const Formation = FormationModel(sequelize);
const Module = ModuleModel(sequelize);
const Caracteristique = CaracteristiqueModel(sequelize);
const Avis = AvisModel(sequelize);

// Définir les associations
console.log('🔗 Configuration des associations...');
Formation.hasMany(Module, { foreignKey: 'formation_id', as: 'modules' });
Module.belongsTo(Formation, { foreignKey: 'formation_id', as: 'formation' });

Formation.hasMany(Caracteristique, { foreignKey: 'formation_id', as: 'caracteristiques' });
Caracteristique.belongsTo(Formation, { foreignKey: 'formation_id', as: 'formation' });

Formation.hasMany(Avis, { foreignKey: 'formation_id', as: 'avis' });
Avis.belongsTo(Formation, { foreignKey: 'formation_id', as: 'formation' });

console.log('✅ Modèles et associations configurés');

// Tester la connexion au démarrage
testConnection().catch(error => {
  console.error('💥 Impossible de se connecter à la base de données');
  process.exit(1);
});

export {
  sequelize,
  Formation,
  Module,
  Caracteristique,
  Avis,
  testConnection
};