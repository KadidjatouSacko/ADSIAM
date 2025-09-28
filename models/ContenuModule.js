import { DataTypes } from 'sequelize';

export default function ContenuModuleModel(sequelize) {
    const ContenuModule = sequelize.define('contenus_module', {
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
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        type_contenu: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'video, document, texte, quiz, etc.'
        },
        fichier_path: {
            type: DataTypes.STRING,
            allowNull: true
        },
        video_url: {
            type: DataTypes.STRING,
            allowNull: true
        },
        video_fichier: {
            type: DataTypes.STRING,
            allowNull: true
        },
        thumbnail_path: {
            type: DataTypes.STRING,
            allowNull: true
        },
        duree_minutes: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        duree_secondes: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        taille_fichier: {
            type: DataTypes.BIGINT,
            allowNull: true
        },
        format_video: {
            type: DataTypes.STRING,
            allowNull: true
        },
        ordre: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        actif: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: true
        }
    }, {
        tableName: 'contenus_module',
        timestamps: true,
        createdAt: 'createdat',
        updatedAt: 'updatedat'
    });

    return ContenuModule;
}