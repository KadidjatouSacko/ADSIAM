import express from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware.js';
import { User } from '../models/User.js';
import { validateProfileUpdate } from '../middleware/validationMiddleware.js';
import { getDatabaseStats } from '../config/database.js';

const router = express.Router();

// ==========================================
// ROUTES UTILISATEUR
// ==========================================

// Obtenir le profil utilisateur connecté
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password', 'passwordResetToken', 'refreshToken', 'emailVerificationToken'] }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable'
            });
        }

        res.json({
            success: true,
            user: user
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du profil'
        });
    }
});

// Mettre à jour le profil utilisateur
router.put('/profile', authMiddleware, validateProfileUpdate, async (req, res) => {
    try {
        const { firstName, lastName, avatar } = req.body;
        const userId = req.user.id;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable'
            });
        }

        // Mettre à jour les champs modifiés uniquement
        const updateData = {};
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (avatar !== undefined) updateData.avatar = avatar;

        await user.update(updateData);

        // Retourner l'utilisateur mis à jour sans les champs sensibles
        const updatedUser = await User.findByPk(userId, {
            attributes: { exclude: ['password', 'passwordResetToken', 'refreshToken', 'emailVerificationToken'] }
        });

        res.json({
            success: true,
            message: 'Profil mis à jour avec succès',
            user: updatedUser
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du profil'
        });
    }
});

// Changer le mot de passe
router.put('/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // Validation basique
        if (!currentPassword || !newPassword) {
            return res.status(422).json({
                success: false,
                message: 'Mot de passe actuel et nouveau mot de passe requis'
            });
        }

        if (newPassword.length < 8) {
            return res.status(422).json({
                success: false,
                message: 'Le nouveau mot de passe doit contenir au moins 8 caractères'
            });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable'
            });
        }

        // Vérifier le mot de passe actuel
        const bcrypt = await import('bcryptjs');
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Mot de passe actuel incorrect'
            });
        }

        // Vérifier que le nouveau mot de passe est différent
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                message: 'Le nouveau mot de passe doit être différent de l\'ancien'
            });
        }

        // Hacher et sauvegarder le nouveau mot de passe
        const hashedNewPassword = await bcrypt.hash(newPassword, 12);
        await user.update({
            password: hashedNewPassword,
            refreshToken: null, // Invalider tous les refresh tokens
            refreshTokenExpires: null
        });

        res.json({
            success: true,
            message: 'Mot de passe modifié avec succès'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du changement de mot de passe'
        });
    }
});

// Supprimer le compte utilisateur
router.delete('/profile', authMiddleware, async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.user.id;

        if (!password) {
            return res.status(422).json({
                success: false,
                message: 'Mot de passe requis pour supprimer le compte'
            });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable'
            });
        }

        // Vérifier le mot de passe
        const bcrypt = await import('bcryptjs');
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Mot de passe incorrect'
            });
        }

        // Soft delete de l'utilisateur
        await user.destroy();

        res.json({
            success: true,
            message: 'Compte supprimé avec succès'
        });

    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du compte'
        });
    }
});

// ==========================================
// ROUTES ADMINISTRATEUR
// ==========================================

// Lister les utilisateurs (admin uniquement)
router.get('/users', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', role = '', status = '' } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        
        // Filtrage par recherche (nom, email)
        if (search) {
            whereClause[Op.or] = [
                { firstName: { [Op.iLike]: `%${search}%` } },
                { lastName: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } }
            ];
        }

        // Filtrage par rôle
        if (role) {
            whereClause.role = role;
        }

        // Filtrage par statut
        if (status) {
            whereClause.status = status;
        }

        const { count, rows: users } = await User.findAndCountAll({
            where: whereClause,
            attributes: { exclude: ['password', 'passwordResetToken', 'refreshToken', 'emailVerificationToken'] },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            users,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des utilisateurs'
        });
    }
});

// Modifier le rôle d'un utilisateur (admin uniquement)
router.put('/users/:id/role', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['student', 'instructor', 'admin'].includes(role)) {
            return res.status(422).json({
                success: false,
                message: 'Rôle invalide'
            });
        }

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable'
            });
        }

        // Empêcher de se retirer les droits admin
        if (user.id === req.user.id && user.role === 'admin' && role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Vous ne pouvez pas retirer vos propres droits administrateur'
            });
        }

        await user.update({ role });

        res.json({
            success: true,
            message: 'Rôle mis à jour avec succès',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du rôle'
        });
    }
});

// Changer le statut d'un utilisateur (admin uniquement)
router.put('/users/:id/status', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'inactive', 'suspended'].includes(status)) {
            return res.status(422).json({
                success: false,
                message: 'Statut invalide'
            });
        }

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable'
            });
        }

        // Empêcher de se désactiver soi-même
        if (user.id === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Vous ne pouvez pas modifier votre propre statut'
            });
        }

        await user.update({ status });

        res.json({
            success: true,
            message: 'Statut mis à jour avec succès',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                status: user.status
            }
        });

    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du statut'
        });
    }
});

// ==========================================
// ROUTES DE STATISTIQUES
// ==========================================

// Statistiques générales (admin uniquement)
router.get('/stats', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const stats = await getDatabaseStats();
        
        // Ajouter des statistiques supplémentaires
        const recentUsers = await User.getRecentRegistrations(7);
        
        res.json({
            success: true,
            stats: {
                ...stats,
                recentRegistrations: recentUsers.length,
                recentUsers: recentUsers.map(user => ({
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    createdAt: user.createdAt
                }))
            }
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques'
        });
    }
});

// ==========================================
// ROUTES UTILITAIRES
// ==========================================

// Recherche d'utilisateurs
router.get('/search/users', authMiddleware, async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;

        if (!q || q.length < 2) {
            return res.json({
                success: true,
                users: []
            });
        }

        const users = await User.findAll({
            where: {
                [Op.or]: [
                    { firstName: { [Op.iLike]: `%${q}%` } },
                    { lastName: { [Op.iLike]: `%${q}%` } },
                    { email: { [Op.iLike]: `%${q}%` } }
                ],
                status: 'active'
            },
            attributes: ['id', 'firstName', 'lastName', 'email', 'avatar', 'role'],
            limit: parseInt(limit),
            order: [['firstName', 'ASC']]
        });

        res.json({
            success: true,
            users: users.map(user => ({
                id: user.id,
                name: `${user.firstName} ${user.lastName}`,
                email: user.email,
                avatar: user.avatar,
                role: user.role
            }))
        });

    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche'
        });
    }
});

// Import Op pour les requêtes Sequelize
import { Op } from 'sequelize';

export default router;