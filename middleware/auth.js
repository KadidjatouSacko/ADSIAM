// middleware/auth.js
import { authMiddleware, roleMiddleware, permissionMiddleware, optionalAuthMiddleware, emailVerifiedMiddleware, activeAccountMiddleware } from './authMiddleware.js';

// Vérifie que l'utilisateur est connecté et actif
export const ensureAuth = authMiddleware;

// Vérifie que l'utilisateur est un étudiant
export const isStudent = [
    authMiddleware,
    roleMiddleware('student')
];

// Vérifie que l'utilisateur est un administrateur
export const isAdmin = [
    authMiddleware,
    roleMiddleware('admin')
];

// Vérifie que l'utilisateur est un instructeur
export const isInstructor = [
    authMiddleware,
    roleMiddleware('instructor')
];

// Vérifie un rôle spécifique
export const hasRole = (role) => [
    authMiddleware,
    roleMiddleware(role)
];

// Vérifie une permission spécifique
export const hasPermission = (permission) => [
    authMiddleware,
    permissionMiddleware(permission)
];

// Vérification optionnelle (user ajouté si connecté)
export const optionalAuth = optionalAuthMiddleware;

// Vérifie que l'email est confirmé
export const emailVerified = emailVerifiedMiddleware;

// Vérifie que le compte est actif
export const activeAccount = activeAccountMiddleware;
