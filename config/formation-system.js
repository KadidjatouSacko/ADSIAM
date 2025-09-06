// config/formation-system.js - Configuration d'intégration complète

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const formationConfig = {
    // Chemins des uploads
    upload: {
        videosPath: path.join(__dirname, '../uploads/videos'),
        documentsPath: path.join(__dirname, '../uploads/documents'),
        maxVideoSize: 500 * 1024 * 1024, // 500MB
        maxDocumentSize: 50 * 1024 * 1024, // 50MB
        allowedVideoFormats: ['mp4', 'webm', 'avi', 'mov'],
        allowedDocumentFormats: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xlsx', 'xls']
    },
    
    // Configuration des quiz
    quiz: {
        defaultTimeLimit: 30, // minutes
        maxAttempts: 3,
        passingScore: 70, // pourcentage
        showResultsImmediately: true
    },
    
    // Configuration des vidéos
    video: {
        completionThreshold: 90, // pourcentage pour considérer une vidéo comme terminée
        progressUpdateInterval: 10, // secondes
        streamingChunkSize: 1024 * 1024 // 1MB chunks
    },
    
    // Configuration des notifications
    notifications: {
        emailOnCompletion: true,
        emailOnCertification: true,
        reminderAfterDays: 7
    }
};

// app.js - Configuration principale de l'application
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

// Import des routes
import formationRoutes from './routes/formations.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';

// Import des modèles avec associations
import './models/associations.js';

// Import de la configuration
import { formationConfig } from './config/formation-system.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configuration middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Configuration des sessions
app.use(session({
    secret: process.env.SESSION_SECRET || 'adsiam-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 heures
    }
}));

// Configuration EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour les variables globales dans les templates
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.isConnected = !!req.user;
    res.locals.formationConfig = formationConfig;
    res.locals.flash = req.session.flash || null;
    delete req.session.flash;
    next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/formations', formationRoutes);
app.use('/admin', adminRoutes);

// Route API pour le streaming et les actions utilisateur
app.use('/api/videos', formationRoutes);
app.use('/api/quiz', formationRoutes);
app.use('/api/documents', formationRoutes);

// Route principale - redirection vers formations
app.get('/', (req, res) => {
    res.redirect('/formations');
});

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).render('errors/404', {
        title: 'Page non trouvée - ADSIAM',
        message: 'La page que vous cherchez n\'existe pas.'
    });
});

// Gestion des erreurs serveur
app.use((error, req, res, next) => {
    console.error('Erreur serveur:', error);
    res.status(500).render('errors/500', {
        title: 'Erreur serveur - ADSIAM',
        error: process.env.NODE_ENV === 'development' ? error : null
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur ADSIAM démarré sur le port ${PORT}`);
    console.log(`📚 Système de formations avancées activé`);
    console.log(`🎥 Streaming vidéo configuré`);
    console.log(`❓ Système de quiz interactifs prêt`);
    console.log(`📄 Gestion documentaire active`);
});

export default app;

// middleware/auth.js - Middleware d'authentification
export const requireAuth = (req, res, next) => {
    if (!req.user) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ error: 'Authentification requise' });
        }
        return res.redirect('/auth/login');
    }
    next();
};

export const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(403).json({ error: 'Accès administrateur requis' });
        }
        return res.status(403).render('errors/403', {
            title: 'Accès refusé - ADSIAM',
            message: 'Vous n\'avez pas les permissions nécessaires.'
        });
    }
    next();
};

// utils/video-processor.js - Utilitaires pour le traitement vidéo
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';

export class VideoProcessor {
    static async extractMetadata(videoPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    console.error('Erreur extraction métadonnées:', err);
                    resolve({
                        duration: 0,
                        width: 0,
                        height: 0,
                        format: 'unknown'
                    });
                } else {
                    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                    resolve({
                        duration: Math.round(metadata.format.duration) || 0,
                        width: videoStream?.width || 0,
                        height: videoStream?.height || 0,
                        format: metadata.format.format_name || 'unknown',
                        bitrate: metadata.format.bit_rate || 0
                    });
                }
            });
        });
    }

    static async generateThumbnail(videoPath, outputPath, timeOffset = 10) {
        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .screenshots({
                    timestamps: [timeOffset],
                    filename: 'thumbnail.jpg',
                    folder: outputPath,
                    size: '320x240'
                })
                .on('end', () => resolve(true))
                .on('error', (err) => {
                    console.error('Erreur génération thumbnail:', err);
                    resolve(false);
                });
        });
    }

    static async optimizeVideo(inputPath, outputPath, quality = 'medium') {
        const qualitySettings = {
            low: { crf: 28, preset: 'fast' },
            medium: { crf: 23, preset: 'medium' },
            high: { crf: 18, preset: 'slow' }
        };

        const settings = qualitySettings[quality] || qualitySettings.medium;

        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .videoCodec('libx264')
                .audioCodec('aac')
                .addOption('-crf', settings.crf)
                .addOption('-preset', settings.preset)
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err) => reject(err))
                .run();
        });
    }
}

// utils/quiz-validator.js - Validateur pour les quiz
export class QuizValidator {
    static validateQuizStructure(quizData) {
        const errors = [];

        // Validation des champs requis
        if (!quizData.titre || quizData.titre.trim().length === 0) {
            errors.push('Le titre du quiz est obligatoire');
        }

        if (!quizData.questions || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
            errors.push('Le quiz doit contenir au moins une question');
        }

        // Validation des questions
        quizData.questions?.forEach((question, index) => {
            if (!question.question || question.question.trim().length === 0) {
                errors.push(`Question ${index + 1}: Le texte de la question est obligatoire`);
            }

            if (!question.type_question || !['qcm', 'vrai_faux', 'texte_libre'].includes(question.type_question)) {
                errors.push(`Question ${index + 1}: Type de question invalide`);
            }

            // Validation spécifique selon le type
            if (question.type_question === 'qcm') {
                if (!question.reponses || question.reponses.length < 2) {
                    errors.push(`Question ${index + 1}: Une question QCM doit avoir au moins 2 réponses`);
                }

                const bonnesReponses = question.reponses?.filter(r => r.est_correcte).length || 0;
                if (bonnesReponses === 0) {
                    errors.push(`Question ${index + 1}: Au moins une réponse correcte est requise`);
                }
            }

            if (question.type_question === 'vrai_faux') {
                if (!question.reponse_correcte || !['true', 'false'].includes(question.reponse_correcte)) {
                    errors.push(`Question ${index + 1}: La réponse correcte (vrai/faux) doit être spécifiée`);
                }
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static calculateScore(quiz, userResponses) {
        let totalPoints = 0;
        let earnedPoints = 0;
        const details = [];

        quiz.questions.forEach(question => {
            totalPoints += question.points || 1;
            const userResponse = userResponses[question.id];
            let correct = false;

            switch (question.type_question) {
                case 'qcm':
                    const correctAnswers = question.reponses
                        .filter(r => r.est_correcte)
                        .map(r => r.id);
                    
                    const userAnswers = Array.isArray(userResponse) ? userResponse : [userResponse];
                    correct = correctAnswers.length === userAnswers.length &&
                             correctAnswers.every(id => userAnswers.includes(id));
                    break;

                case 'vrai_faux':
                    correct = userResponse === question.reponse_correcte;
                    break;

                case 'texte_libre':
                    // Pour les réponses libres, on peut implémenter une logique de mots-clés
                    correct = true; // À adapter selon vos besoins
                    break;
            }

            if (correct) {
                earnedPoints += question.points || 1;
            }

            details.push({
                questionId: question.id,
                correct,
                points: correct ? (question.points || 1) : 0
            });
        });

        const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

        return {
            totalPoints,
            earnedPoints,
            percentage,
            details
        };
    }
}

// utils/file-manager.js - Gestionnaire de fichiers
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class FileManager {
    static async ensureDirectoryExists(dirPath) {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    static generateSafeFilename(originalName) {
        const timestamp = Date.now();
        const random = crypto.randomBytes(8).toString('hex');
        const ext = path.extname(originalName);
        const baseName = path.basename(originalName, ext)
            .replace(/[^a-zA-Z0-9-_]/g, '_')
            .substring(0, 50);
        
        return `${timestamp}_${random}_${baseName}${ext}`;
    }

    static async deleteFile(filePath) {
        try {
            await fs.unlink(filePath);
            return true;
        } catch (error) {
            console.error('Erreur suppression fichier:', error);
            return false;
        }
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static getFileType(filename) {
        const ext = path.extname(filename).toLowerCase().substring(1);
        const types = {
            // Vidéos
            mp4: 'video',
            webm: 'video',
            avi: 'video',
            mov: 'video',
            // Documents
            pdf: 'document',
            doc: 'document',
            docx: 'document',
            ppt: 'document',
            pptx: 'document',
            xlsx: 'document',
            xls: 'document',
            // Images
            jpg: 'image',
            jpeg: 'image',
            png: 'image',
            gif: 'image'
        };
        
        return types[ext] || 'unknown';
    }
}

// scripts/migrate-formations.js - Script de migration pour les formations existantes
import { sequelize } from '../config/database.js';
import { Formation, Module } from '../models/associations.js';

export async function migrateExistingFormations() {
    try {
        console.log('🔄 Début de la migration des formations existantes...');

        // Récupérer toutes les formations sans la nouvelle structure
        const formations = await Formation.findAll({
            include: [
                {
                    model: Module,
                    as: 'modules',
                    required: false
                }
            ]
        });

        for (const formation of formations) {
            console.log(`📚 Migration de: ${formation.titre}`);

            // Si la formation n'a pas de modules, en créer un par défaut
            if (!formation.modules || formation.modules.length === 0) {
                const defaultModule = await Module.create({
                    formation_id: formation.id,
                    titre: 'Introduction',
                    description: 'Module d\'introduction à la formation',
                    duree_minutes: formation.duree_heures ? formation.duree_heures * 60 : 60,
                    ordre: 1,
                    disponible: true
                });

                console.log(`  ✅ Module par défaut créé: ${defaultModule.titre}`);
            }

            // Mettre à jour le nombre de modules
            const moduleCount = await Module.count({
                where: { formation_id: formation.id }
            });

            await formation.update({
                nombre_modules: moduleCount
            });

            console.log(`  📊 Nombre de modules mis à jour: ${moduleCount}`);
        }

        console.log('✅ Migration terminée avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        throw error;
    }
}

// scripts/sync-database.js - Script de synchronisation de la base de données
import { sequelize } from '../config/database.js';
import './models/associations.js';

export async function syncDatabase() {
    try {
        console.log('🔄 Synchronisation de la base de données...');

        // Synchroniser tous les modèles
        await sequelize.sync({ alter: true });
        
        console.log('✅ Base de données synchronisée');

        // Exécuter les migrations si nécessaire
        await migrateExistingFormations();

        console.log('🎉 Système de formations prêt !');
    } catch (error) {
        console.error('❌ Erreur de synchronisation:', error);
        throw error;
    }
}



// .env.example - Variables d'environnement
/*
# Base de données
DATABASE_URL=postgresql://username:password@localhost:5432/adsiam
DB_HOST=localhost
DB_PORT=5432
DB_NAME=adsiam
DB_USER=username
DB_PASSWORD=password

# Application
NODE_ENV=development
PORT=3000
SESSION_SECRET=your-super-secret-session-key

# Upload et stockage
UPLOAD_MAX_SIZE=500MB
VIDEO_QUALITY=medium
GENERATE_THUMBNAILS=true

# Notifications
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@adsiam.fr
SMTP_PASSWORD=password
NOTIFICATION_EMAIL=admin@adsiam.fr

# Sécurité
JWT_SECRET=your-jwt-secret-key
BCRYPT_ROUNDS=12
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=900000

# FFmpeg (optionnel si pas dans PATH)
FFMPEG_PATH=/usr/local/bin/ffmpeg
FFPROBE_PATH=/usr/local/bin/ffprobe
*/


export { formationConfig };