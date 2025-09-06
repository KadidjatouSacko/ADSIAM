import { DataTypes } from 'sequelize';

// Fonction qui définit le modèle - PATTERN CORRECT
const PartieModuleModel = (sequelize) => {
    const PartieModule = sequelize.define('PartieModule', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        module_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'modules',
                key: 'id'
            }
        },
        titre: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        ordre: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        type_contenu: {
            type: DataTypes.ENUM('video', 'quiz', 'document', 'mixte'),
            allowNull: false,
            defaultValue: 'mixte'
        },
        actif: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        tableName: 'parties_modules',
        timestamps: true,
        createdAt: 'createdat',
        updatedAt: 'updatedat',
        indexes: [
            {
                fields: ['module_id', 'ordre']
            }
        ]
    });

    return PartieModule;
};

export default PartieModuleModel;