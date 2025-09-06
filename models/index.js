import { Sequelize, DataTypes, Op } from 'sequelize';
import dotenv from 'dotenv';

// Import des modèles
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
import ConversationModel from './Conversation.js';
import PartieModuleModel from './PartieModule.js';
import VideoPartieModel from './VideoPartie.js';
import QuizModel from './Quiz.js';
import QuestionQuizModel from './QuestionQuiz.js';
import ReponseQuestionModel from './ReponseQuestion.js';
import DocumentPartieModel from './DocumentPartie.js';
import TentativeQuizModel from './TentativeQuiz.js';
import VueVideoModel from './VueVideo.js';
import TelechargementDocumentModel from './TelechargementDocument.js';
import EvaluationModuleModel from './EvaluationModule.js';
import EtudiantModel from './Etudiant.js';

// Charger les variables d'environnement
dotenv.config();

// Vérification des variables d'environnement
const requiredVars = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST'];
const missingVars = requiredVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('❌ Variables d\'environnement manquantes:', missingVars);
  process.exit(1);
}

// Configuration Sequelize
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    port: process.env.DB_PORT || 5432,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      timestamps: true,
      createdAt: 'createdat',
      updatedAt: 'updatedat',
      underscored: false,
    },
    pool: { 
      max: 5, 
      min: 0, 
      acquire: 30000, 
      idle: 10000 
    },
  }
);

// Initialiser les modèles en appelant les fonctions exportées
const Formation = FormationModel(sequelize);
const Module = ModuleModel(sequelize);
const PartieModule = PartieModuleModel(sequelize);
const VideoPartie = VideoPartieModel(sequelize);
const Quiz = QuizModel(sequelize);
const QuestionQuiz = QuestionQuizModel(sequelize);
const ReponseQuestion = ReponseQuestionModel(sequelize);
const DocumentPartie = DocumentPartieModel(sequelize);
const TentativeQuiz = TentativeQuizModel(sequelize);
const VueVideo = VueVideoModel(sequelize);
const TelechargementDocument = TelechargementDocumentModel(sequelize);
const EvaluationModule = EvaluationModuleModel(sequelize);
const Caracteristique = CaracteristiqueModel(sequelize);
const Avis = AvisModel(sequelize);
const User = UserModel(sequelize);
const Inscription = InscriptionModel(sequelize);
const Message = MessageModel(sequelize);
const Evenement = EvenementModel(sequelize);
const ParticipationEvenement = ParticipationEvenementModel(sequelize);
const ProgressionModule = ProgressionModuleModel(sequelize);
const Notification = NotificationModel(sequelize);
const Etudiant = EtudiantModel(sequelize);

// Import spécial pour Conversation qui retourne un objet avec deux modèles
const { Conversation, ConversationParticipant } = ConversationModel(sequelize);

// ===============================
// DÉFINITION DES ASSOCIATIONS
// ===============================

// FORMATION -> MODULES
Formation.hasMany(Module, {
    foreignKey: 'formation_id',
    as: 'modules',
    onDelete: 'CASCADE'
});
Module.belongsTo(Formation, {
    foreignKey: 'formation_id',
    as: 'formation'
});

// FORMATION -> CARACTÉRISTIQUES
Formation.hasMany(Caracteristique, {
    foreignKey: 'formation_id',
    as: 'caracteristiques',
    onDelete: 'CASCADE'
});
Caracteristique.belongsTo(Formation, {
    foreignKey: 'formation_id',
    as: 'formation'
});

// FORMATION -> AVIS
Formation.hasMany(Avis, {
    foreignKey: 'formation_id',
    as: 'avis',
    onDelete: 'CASCADE'
});
Avis.belongsTo(Formation, {
    foreignKey: 'formation_id',
    as: 'formation'
});

// FORMATION -> INSCRIPTIONS
Formation.hasMany(Inscription, {
    foreignKey: 'formation_id',
    as: 'inscriptions',
    onDelete: 'CASCADE'
});
Inscription.belongsTo(Formation, {
    foreignKey: 'formation_id',
    as: 'formation'
});

// FORMATION -> ÉVÉNEMENTS
Formation.hasMany(Evenement, {
    foreignKey: 'formation_id',
    as: 'evenements',
    onDelete: 'SET NULL'
});
Evenement.belongsTo(Formation, {
    foreignKey: 'formation_id',
    as: 'formation'
});

// FORMATION -> MESSAGES
Formation.hasMany(Message, {
    foreignKey: 'formation_id',
    as: 'messages',
    onDelete: 'CASCADE'
});
Message.belongsTo(Formation, {
    foreignKey: 'formation_id',
    as: 'formation'
});

// MODULE -> PARTIES
Module.hasMany(PartieModule, {
    foreignKey: 'module_id',
    as: 'parties',
    onDelete: 'CASCADE'
});
PartieModule.belongsTo(Module, {
    foreignKey: 'module_id',
    as: 'module'
});

// MODULE -> PROGRESSIONS
Module.hasMany(ProgressionModule, {
    foreignKey: 'module_id',
    as: 'progressions',
    onDelete: 'CASCADE'
});
ProgressionModule.belongsTo(Module, {
    foreignKey: 'module_id',
    as: 'module'
});

// MODULE -> ÉVALUATIONS
Module.hasMany(EvaluationModule, {
    foreignKey: 'module_id',
    as: 'evaluations',
    onDelete: 'CASCADE'
});
EvaluationModule.belongsTo(Module, {
    foreignKey: 'module_id',
    as: 'module'
});

// PARTIE -> VIDÉOS
PartieModule.hasMany(VideoPartie, {
    foreignKey: 'partie_id',
    as: 'videos',
    onDelete: 'CASCADE'
});
VideoPartie.belongsTo(PartieModule, {
    foreignKey: 'partie_id',
    as: 'partie'
});

// PARTIE -> QUIZ
PartieModule.hasMany(Quiz, {
    foreignKey: 'partie_id',
    as: 'quiz',
    onDelete: 'CASCADE'
});
Quiz.belongsTo(PartieModule, {
    foreignKey: 'partie_id',
    as: 'partie'
});

// PARTIE -> DOCUMENTS
PartieModule.hasMany(DocumentPartie, {
    foreignKey: 'partie_id',
    as: 'documents',
    onDelete: 'CASCADE'
});
DocumentPartie.belongsTo(PartieModule, {
    foreignKey: 'partie_id',
    as: 'partie'
});

// QUIZ -> QUESTIONS
Quiz.hasMany(QuestionQuiz, {
    foreignKey: 'quiz_id',
    as: 'questions',
    onDelete: 'CASCADE'
});
QuestionQuiz.belongsTo(Quiz, {
    foreignKey: 'quiz_id',
    as: 'quiz'
});

// QUIZ -> TENTATIVES
Quiz.hasMany(TentativeQuiz, {
    foreignKey: 'quiz_id',
    as: 'tentatives',
    onDelete: 'CASCADE'
});
TentativeQuiz.belongsTo(Quiz, {
    foreignKey: 'quiz_id',
    as: 'quiz'
});

// QUESTION -> RÉPONSES
QuestionQuiz.hasMany(ReponseQuestion, {
    foreignKey: 'question_id',
    as: 'reponses',
    onDelete: 'CASCADE'
});
ReponseQuestion.belongsTo(QuestionQuiz, {
    foreignKey: 'question_id',
    as: 'question'
});

// VIDÉO -> VUES
VideoPartie.hasMany(VueVideo, {
    foreignKey: 'video_id',
    as: 'vues',
    onDelete: 'CASCADE'
});
VueVideo.belongsTo(VideoPartie, {
    foreignKey: 'video_id',
    as: 'video'
});

// DOCUMENT -> TÉLÉCHARGEMENTS
DocumentPartie.hasMany(TelechargementDocument, {
    foreignKey: 'document_id',
    as: 'telechargements',
    onDelete: 'CASCADE'
});
TelechargementDocument.belongsTo(DocumentPartie, {
    foreignKey: 'document_id',
    as: 'document'
});

// USER -> INSCRIPTIONS
User.hasMany(Inscription, {
    foreignKey: 'user_id',
    as: 'inscriptions',
    onDelete: 'CASCADE'
});
Inscription.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
});

// USER -> PROGRESSIONS
User.hasMany(ProgressionModule, {
    foreignKey: 'user_id',
    as: 'progressions',
    onDelete: 'CASCADE'
});
ProgressionModule.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
});

// USER -> TENTATIVES QUIZ
User.hasMany(TentativeQuiz, {
    foreignKey: 'user_id',
    as: 'tentatives_quiz',
    onDelete: 'CASCADE'
});
TentativeQuiz.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
});

// USER -> VUES VIDÉOS
User.hasMany(VueVideo, {
    foreignKey: 'user_id',
    as: 'vues_videos',
    onDelete: 'CASCADE'
});
VueVideo.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
});

// USER -> TÉLÉCHARGEMENTS
User.hasMany(TelechargementDocument, {
    foreignKey: 'user_id',
    as: 'telechargements',
    onDelete: 'CASCADE'
});
TelechargementDocument.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
});

// USER -> ÉVALUATIONS
User.hasMany(EvaluationModule, {
    foreignKey: 'user_id',
    as: 'evaluations_modules',
    onDelete: 'CASCADE'
});
EvaluationModule.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
});

// USER -> ÉVÉNEMENTS (en tant que formateur)
User.hasMany(Evenement, {
    foreignKey: 'formateur_id',
    as: 'evenementsAnime',
    onDelete: 'SET NULL'
});
Evenement.belongsTo(User, {
    foreignKey: 'formateur_id',
    as: 'formateur'
});

// USER -> PARTICIPATIONS ÉVÉNEMENTS
User.hasMany(ParticipationEvenement, {
    foreignKey: 'user_id',
    as: 'participations',
    onDelete: 'CASCADE'
});
ParticipationEvenement.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
});

// USER -> NOTIFICATIONS
User.hasMany(Notification, {
    foreignKey: 'user_id',
    as: 'notifications',
    onDelete: 'CASCADE'
});
Notification.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
});

// ÉVÉNEMENT -> PARTICIPATIONS
Evenement.hasMany(ParticipationEvenement, {
    foreignKey: 'evenement_id',
    as: 'participations',
    onDelete: 'CASCADE'
});
ParticipationEvenement.belongsTo(Evenement, {
    foreignKey: 'evenement_id',
    as: 'evenement'
});

// INSCRIPTION -> PROGRESSIONS
Inscription.hasMany(ProgressionModule, {
    foreignKey: 'inscription_id',
    as: 'progressions',
    onDelete: 'CASCADE'
});
ProgressionModule.belongsTo(Inscription, {
    foreignKey: 'inscription_id',
    as: 'inscription'
});

// ASSOCIATIONS MESSAGERIE
Conversation.belongsToMany(User, {
    through: ConversationParticipant,
    as: 'participants',
    foreignKey: 'conversation_id'
});
User.belongsToMany(Conversation, {
    through: ConversationParticipant,
    as: 'conversations',
    foreignKey: 'user_id'
});

Conversation.hasMany(Message, {
    as: 'messages',
    foreignKey: 'conversation_id',
    onDelete: 'CASCADE'
});
Message.belongsTo(Conversation, {
    foreignKey: 'conversation_id'
});

Message.belongsTo(User, {
    as: 'sender',
    foreignKey: 'sender_id'
});
Message.belongsTo(User, {
    as: 'receiver',
    foreignKey: 'receiver_id'
});

User.hasMany(Message, {
    as: 'messagesEnvoyes',
    foreignKey: 'sender_id',
    onDelete: 'CASCADE'
});
User.hasMany(Message, {
    as: 'messagesRecus',
    foreignKey: 'receiver_id',
    onDelete: 'CASCADE'
});

// Test de connexion à la base de données
(async () => {
  try {
    console.log('🔌 Test de connexion à la base de données...');
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données réussie');
    
    // Synchroniser les modèles si nécessaire (pour le développement uniquement)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Synchronisation des modèles...');
      await sequelize.sync({ alter: false }); // Ne pas forcer la recréation
      console.log('✅ Modèles synchronisés');
    }
  } catch (err) {
    console.error('❌ Erreur de connexion à la base de données:', err.message);
    process.exit(1);
  }
})();

// Export des modèles et de Sequelize
export {
  // Configuration Sequelize
  sequelize,
  Op,
  
  // Modèles Formation
  Formation,
  Module,
  PartieModule,
  VideoPartie,
  Quiz,
  QuestionQuiz,
  ReponseQuestion,
  DocumentPartie,
  Caracteristique,
  
  // Modèles Utilisateur
  User,
  Etudiant,
  Inscription,
  ProgressionModule,
  TentativeQuiz,
  VueVideo,
  TelechargementDocument,
  EvaluationModule,
  
  // Modèles Communication
  Message,
  Conversation,
  ConversationParticipant,
  Notification,
  
  // Modèles Événements
  Evenement,
  ParticipationEvenement,
  
  // Modèles Avis
  Avis
};