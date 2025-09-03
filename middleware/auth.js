import User from '../models/User.js';

// middlewares/auth.js
export function isStudent(req, res, next) {
    if (!req.user) {
        return res.status(401).send('Vous devez être connecté pour accéder à cette page');
    }
    if (req.user.role !== 'etudiant') {
        return res.status(403).send('Accès interdit : étudiants uniquement');
    }
    next();
}

