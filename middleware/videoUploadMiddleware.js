// middleware/videoUploadMiddleware.js
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration du stockage pour les vidéos
const videoStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/videos');
        
        // Créer le dossier s'il n'existe pas
        try {
            await fs.access(uploadPath);
        } catch {
            await fs.mkdir(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Générer un nom unique pour le fichier
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        const filename = `video-${uniqueSuffix}${extension}`;
        cb(null, filename);
    }
});

// Configuration du stockage pour les thumbnails
const thumbnailStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/thumbnails');
        
        try {
            await fs.access(uploadPath);
        } catch {
            await fs.mkdir(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        const filename = `thumb-${uniqueSuffix}${extension}`;
        cb(null, filename);
    }
});

// Filtre pour les fichiers vidéo
const videoFileFilter = (req, file, cb) => {
    const allowedVideoTypes = [
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/x-msvideo', // AVI
        'video/x-ms-wmv',  // WMV
        'video/webm'
    ];
    
    if (file.fieldname === 'video' && allowedVideoTypes.includes(file.mimetype)) {
        cb(null, true);
    } else if (file.fieldname === 'thumbnail' && file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`), false);
    }
};

// Configuration multer pour vidéos
const videoUpload = multer({
    storage: videoStorage,
    fileFilter: videoFileFilter,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB max pour les vidéos
    }
});

// Configuration multer pour thumbnails
const thumbnailUpload = multer({
    storage: thumbnailStorage,
    fileFilter: videoFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max pour les thumbnails
    }
});

// Middleware combiné pour gérer vidéo + thumbnail
export const uploadVideoWithThumbnail = (req, res, next) => {
    const upload = multer({
        storage: multer.diskStorage({
            destination: async (req, file, cb) => {
                let uploadPath;
                
                if (file.fieldname === 'video') {
                    uploadPath = path.join(__dirname, '../uploads/videos');
                } else if (file.fieldname === 'thumbnail') {
                    uploadPath = path.join(__dirname, '../uploads/thumbnails');
                } else {
                    uploadPath = path.join(__dirname, '../uploads/documents');
                }
                
                try {
                    await fs.access(uploadPath);
                } catch {
                    await fs.mkdir(uploadPath, { recursive: true });
                }
                
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const extension = path.extname(file.originalname);
                let prefix = 'file';
                
                if (file.fieldname === 'video') prefix = 'video';
                else if (file.fieldname === 'thumbnail') prefix = 'thumb';
                
                const filename = `${prefix}-${uniqueSuffix}${extension}`;
                cb(null, filename);
            }
        }),
        fileFilter: (req, file, cb) => {
            const allowedVideoTypes = [
                'video/mp4', 'video/mpeg', 'video/quicktime', 
                'video/x-msvideo', 'video/x-ms-wmv', 'video/webm'
            ];
            
            if (file.fieldname === 'video' && allowedVideoTypes.includes(file.mimetype)) {
                cb(null, true);
            } else if (file.fieldname === 'thumbnail' && file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else if (file.fieldname === 'document') {
                cb(null, true);
            } else {
                cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`), false);
            }
        },
        limits: {
            fileSize: 500 * 1024 * 1024 // 500MB max
        }
    }).fields([
        { name: 'video', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 },
        { name: 'document', maxCount: 1 }
    ]);

    upload(req, res, (err) => {
        if (err) {
            console.error('Erreur upload:', err);
            return res.status(400).json({ 
                success: false, 
                error: err.message 
            });
        }
        
        // Ajouter les informations des fichiers uploadés à req.uploadedFiles
        req.uploadedFiles = {
            video: req.files?.video?.[0] || null,
            thumbnail: req.files?.thumbnail?.[0] || null,
            document: req.files?.document?.[0] || null
        };
        
        next();
    });
};

// Fonction utilitaire pour obtenir des informations sur la vidéo
export const getVideoInfo = async (videoPath) => {
    try {
        const stats = await fs.stat(videoPath);
        const extension = path.extname(videoPath).toLowerCase();
        
        return {
            size: stats.size,
            format: extension.substring(1), // Enlever le point
            sizeFormatted: formatFileSize(stats.size)
        };
    } catch (error) {
        console.error('Erreur lecture vidéo:', error);
        return null;
    }
};

// Fonction pour formater la taille de fichier
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Middleware pour supprimer un fichier vidéo
export const deleteVideoFile = async (filePath) => {
    try {
        if (filePath && typeof filePath === 'string') {
            const fullPath = path.join(__dirname, '../uploads', filePath);
            await fs.unlink(fullPath);
            console.log(`Fichier supprimé: ${filePath}`);
        }
    } catch (error) {
        console.error('Erreur suppression fichier:', error);
    }
};

// Middleware pour valider les URLs vidéo (YouTube, Vimeo, etc.)
export const validateVideoUrl = (url) => {
    if (!url) return { valid: false };
    
    // Patterns pour différentes plateformes
    const patterns = {
        youtube: /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        vimeo: /^(https?:\/\/)?(www\.)?vimeo\.com\/([0-9]+)/,
        dailymotion: /^(https?:\/\/)?(www\.)?dailymotion\.com\/video\/([a-zA-Z0-9]+)/
    };
    
    for (const [platform, pattern] of Object.entries(patterns)) {
        if (pattern.test(url)) {
            return { 
                valid: true, 
                platform,
                embedUrl: generateEmbedUrl(url, platform)
            };
        }
    }
    
    // URL directe vers fichier vidéo
    if (url.match(/\.(mp4|webm|ogg|avi|mov)$/i)) {
        return { 
            valid: true, 
            platform: 'direct',
            embedUrl: url
        };
    }
    
    return { valid: false };
};

// Générer URL d'embed selon la plateforme
const generateEmbedUrl = (url, platform) => {
    switch (platform) {
        case 'youtube':
            const youtubeId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
            return youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : url;
            
        case 'vimeo':
            const vimeoId = url.match(/vimeo\.com\/([0-9]+)/)?.[1];
            return vimeoId ? `https://player.vimeo.com/video/${vimeoId}` : url;
            
        case 'dailymotion':
            const dmId = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/)?.[1];
            return dmId ? `https://www.dailymotion.com/embed/video/${dmId}` : url;
            
        default:
            return url;
    }
};

export default {
    uploadVideoWithThumbnail,
    getVideoInfo,
    formatFileSize,
    deleteVideoFile,
    validateVideoUrl
};