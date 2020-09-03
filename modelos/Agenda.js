module.exports = function(sequelize, DataTypes){

	var Agenda = sequelize.define('Agenda', {
		id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, pintar: [2,3,4], name: 'Identificador', tipo: 'number'},
		observacion: {type: DataTypes.TEXT, length: 1024, allowNull: false, pintar: [1,2,3,4], name: "Observaciones", tipo: "textarea", rows: "3"},
		fecha: {type: DataTypes.DATE, allowNull: false, pintar: [1,2,3,4], name: "Fecha y hora de visita", tipo: "datetime-local"},
		recordatorio: {type: DataTypes.INTEGER, allowNull: false, pintar: [1,2,3,4], name: "Recordatorio en minutos", tipo: "number"},
		duracion: {type: DataTypes.INTEGER, allowNull: false, pintar: [1,2,3,4], name: "Duracion en minutos", tipo: 'number'},
		asistio: {type: DataTypes.DATE, allowNull: true, pintar: [1,2,3,4], name: "Confirmacion de asistencia", tipo: 'date'},
		reagendo: {type: DataTypes.INTEGER, allowNull: true, pintar: [2,3,4], name: "Id de nueva agenda", tipo: 'number'}
	},{
		freezeTableName: true,
		paranoid: true,
		referencia: {representante: ['GestionId', 'observacion', 'fecha', 'duracion']},
		classMethods: {associate: function(models){
			Agenda.belongsTo(models.Gestion),
			Agenda.belongsTo(models.Usuario, {as: 'Confirmo'}),
			Agenda.belongsTo(models.Usuario, {as: 'Creador', allowNull: false})
		}},
		relaciones: {
			GestionId: {pintar:[1,2,3,4], name: "No. de gestion", tipo: 'number'}
		},
		seguridad: {
			1: 'agendaIns', 2: 'agendaAct', 3: 'agendaEli', 4: 'agendaBus' 
		}
	});
	
	return Agenda;
}
