import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import FormationModel from './Formation.js';
import ModuleModel from './Module.js';
import CaracteristiqueModel from './Caracteristique.js';
import AvisModel from './Avis.js';
import UserModel from './User.js';
import InscriptionModel from './Inscription.js';
import MessageModel from './Message.js';
import EvenementModel from './Evenement.js';
import ParticipationEvenementModel from './ParticipationEvenement.js';
import ProgressionModuleModel from './ProgressionModule.js';
import NotificationModel from './Notification.js';

// Charger les variables d'environnement
dotenv.config();

// Vérification des variables
const requiredVars = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST'];
const missingVars = requiredVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('❌ Variables d\'environnement manquantes:', missingVars);
  process.exit(1);
}

// Configuration Sequelize
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'postgres',
  port: process.env.DB_PORT || 5432,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    createdAt: 'createdat', // utilise ta colonne existante
    updatedAt: 'updatedat',
    underscored: false
  },
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
});


// Initialiser les modèles
const Formation = FormationModel(sequelize);
const Module = ModuleModel(sequelize);
const Caracteristique = CaracteristiqueModel(sequelize);
const Avis = AvisModel(sequelize);
const User = UserModel(sequelize);
const Inscription = InscriptionModel(sequelize);
const Message = MessageModel(sequelize);
const Evenement = EvenementModel(sequelize);
const ParticipationEvenement = ParticipationEvenementModel(sequelize);
const ProgressionModule = ProgressionModuleModel(sequelize);
const Notification = NotificationModel(sequelize);

// Associations
Formation.hasMany(Module, { foreignKey: 'formation_id', as: 'modules' });
Module.belongsTo(Formation, { foreignKey: 'formation_id', as: 'formation' });

Formation.hasMany(Caracteristique, { foreignKey: 'formation_id', as: 'caracteristiques' });
Caracteristique.belongsTo(Formation, { foreignKey: 'formation_id', as: 'formation' });

Formation.hasMany(Avis, { foreignKey: 'formation_id', as: 'avis' });
Avis.belongsTo(Formation, { foreignKey: 'formation_id', as: 'formation' });

User.hasMany(Inscription, { foreignKey: 'user_id', as: 'inscriptions' });
Inscription.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Formation.hasMany(Inscription, { foreignKey: 'formation_id', as: 'inscriptions' });
Inscription.belongsTo(Formation, { foreignKey: 'formation_id', as: 'formation' });

User.hasMany(Message, { foreignKey: 'expediteur_id', as: 'messagesEnvoyes' });
User.hasMany(Message, { foreignKey: 'destinataire_id', as: 'messagesRecus' });
Message.belongsTo(User, { foreignKey: 'expediteur_id', as: 'expediteur' });
Message.belongsTo(User, { foreignKey: 'destinataire_id', as: 'destinataire' });

Formation.hasMany(Message, { foreignKey: 'formation_id', as: 'messages' });
Message.belongsTo(Formation, { foreignKey: 'formation_id', as: 'formation' });

Formation.hasMany(Evenement, { foreignKey: 'formation_id', as: 'evenements' });
Evenement.belongsTo(Formation, { foreignKey: 'formation_id', as: 'formation' });

User.hasMany(Evenement, { foreignKey: 'formateur_id', as: 'evenementsAnime' });
Evenement.belongsTo(User, { foreignKey: 'formateur_id', as: 'formateur' });

Evenement.hasMany(ParticipationEvenement, { foreignKey: 'evenement_id', as: 'participations' });
User.hasMany(ParticipationEvenement, { foreignKey: 'user_id', as: 'participations' });
ParticipationEvenement.belongsTo(Evenement, { foreignKey: 'evenement_id', as: 'evenement' });
ParticipationEvenement.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(ProgressionModule, { foreignKey: 'user_id', as: 'progressions' });
ProgressionModule.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Module.hasMany(ProgressionModule, { foreignKey: 'module_id', as: 'progressions' });
ProgressionModule.belongsTo(Module, { foreignKey: 'module_id', as: 'module' });

Inscription.hasMany(ProgressionModule, { foreignKey: 'inscription_id', as: 'progressions' });
ProgressionModule.belongsTo(Inscription, { foreignKey: 'inscription_id', as: 'inscription' });

User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Connexion test
(async () => {
  try {
    console.log('🔌 Test connexion DB...');
    await sequelize.authenticate();
    console.log('✅ Connexion réussie');
  } catch (err) {
    console.error('❌ Erreur connexion DB:', err.message);
    process.exit(1);
  }
})();

export {
  sequelize,
  Formation,
  Module,
  Caracteristique,
  Avis,
  User,
  Inscription,
  Message,
  Evenement,
  ParticipationEvenement,
  ProgressionModule,
  Notification
};
