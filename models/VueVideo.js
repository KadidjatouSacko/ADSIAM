// models/VueVideo.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const VueVideo = sequelize.define('VueVideo', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    video_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'videos_parties',
        key: 'id'
      }
    },
    temps_visionne_secondes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    pourcentage_visionne: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0
    },
    terminee: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    derniere_position_secondes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'vues_videos',
    timestamps: true,
    createdAt: 'createdat',
    updatedAt: 'updatedat',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'video_id']
      }
    ]
  });

  return VueVideo;
};
