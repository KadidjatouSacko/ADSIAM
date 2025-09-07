// middleware/uploadMiddleware.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configuration du stockage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = 'uploads/';
        
        // Créer des dossiers selon le type de fichier
        if (file.fieldname === 'photo_profil') {
            uploadPath += 'profiles/';
        } else if (file.fieldname === 'documents') {
            uploadPath += 'documents/';
        } else {
            uploadPath += 'general/';
        }

        // Créer le dossier s'il n'existe pas
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Générer un nom unique
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, `${name}_${uniqueSuffix}${ext}`);
    }
});

// Filtres de fichiers
const fileFilter = (req, file, cb) => {
    console.log('📁 Fichier reçu:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
    });

    // Types de fichiers autorisés
    const allowedTypes = {
    images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    documents: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
    ],
    videos: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
};


const allAllowedTypes = [
    ...allowedTypes.images,
    ...allowedTypes.documents,
    ...allowedTypes.videos
];

    if (allAllowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`), false);
    }
};

// Configuration multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
        files: 5 // max 5 fichiers à la fois
    }
});


// Middleware pour gérer les erreurs d'upload
export const handleUploadErrors = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error('Erreur Multer:', err);
        
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'Fichier trop volumineux',
                message: 'La taille maximale autorisée est de 10MB'
            });
        }
        
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                error: 'Trop de fichiers',
                message: 'Maximum 5 fichiers autorisés'
            });
        }
        
        return res.status(400).json({
            error: 'Erreur d\'upload',
            message: err.message
        });
    }
    
    if (err) {
        console.error('Erreur upload:', err);
        return res.status(400).json({
            error: 'Erreur d\'upload',
            message: err.message
        });
    }
    
    next();
};

// Middleware pour traiter les formulaires avec fichiers
export const processFormWithFiles = (fields) => {
    return (req, res, next) => {
        let uploadHandler;

        if (fields && fields.length > 0) {
            uploadHandler = upload.fields(fields); // champs connus
        } else {
            uploadHandler = upload.any(); // accepte tous les fichiers dynamiques
        }

        uploadHandler(req, res, (err) => {
            if (err) {
                return handleUploadErrors(err, req, res, next);
            }

            if (req.files) {
                console.log('📂 Fichiers uploadés:', Object.keys(req.files));

                // Ajouter les chemins des fichiers au req.body
                req.files.forEach(file => {
                    if (!req.body[`${file.fieldname}_paths`]) {
                        req.body[`${file.fieldname}_paths`] = [];
                    }
                    req.body[`${file.fieldname}_paths`].push(file.path);
                });
            }

            // Parser JSON si présent
            if (req.body.data) {
                try {
                    const data = JSON.parse(req.body.data);
                    Object.assign(req.body, data);
                    delete req.body.data;
                } catch (e) {
                    console.warn('Impossible de parser req.body.data comme JSON');
                }
            }

            console.log('📝 Body final après upload:', req.body);
            next();
        });
    };
};


// Middleware simple pour un seul fichier
export const uploadSingle = (fieldName, destination = 'general') => {
    const singleUpload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                const uploadPath = `uploads/${destination}/`;
                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                const name = file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9]/g, '_');
                cb(null, `${name}_${uniqueSuffix}${ext}`);
            }
        }),
        fileFilter,
        limits: {
            fileSize: 10 * 1024 * 1024
        }
    }).single(fieldName);

    return (req, res, next) => {
        singleUpload(req, res, (err) => {
            if (err) {
                return handleUploadErrors(err, req, res, next);
            }
            next();
        });
    };
};

// Middleware pour parser les formulaires complexes
export const parseFormData = (req, res, next) => {
    // Convertir les chaînes 'true'/'false' en booléens
    Object.keys(req.body).forEach(key => {
        if (req.body[key] === 'true') {
            req.body[key] = true;
        } else if (req.body[key] === 'false') {
            req.body[key] = false;
        }
        
        // Convertir les nombres
        if (typeof req.body[key] === 'string' && !isNaN(req.body[key]) && req.body[key] !== '') {
            const num = parseFloat(req.body[key]);
            if (!isNaN(num)) {
                req.body[key] = num;
            }
        }
    });
    
    next();
};

export default upload;