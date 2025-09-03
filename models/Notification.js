import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    titre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    contenu: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    type_notification: {
      type: DataTypes.STRING,
      defaultValue: 'info'
    },
    lien: {
      type: DataTypes.STRING,
      allowNull: true
    },
    lu: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    date_lecture: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'notifications',
    timestamps: true
  });

  return Notification;
};
