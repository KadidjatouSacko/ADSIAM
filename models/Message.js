import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    expediteur_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    destinataire_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    formation_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    sujet: {
      type: DataTypes.STRING,
      allowNull: false
    },
    contenu: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    lu: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    archive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    date_lecture: {
      type: DataTypes.DATE,
      allowNull: true
    },
    type_message: {
      type: DataTypes.STRING,
      defaultValue: 'personnel'
    },
    priorite: {
      type: DataTypes.STRING,
      defaultValue: 'normale'
    }
  }, {
    tableName: 'messages',
    timestamps: true
  });

  return Message;
};
