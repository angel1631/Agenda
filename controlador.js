var express = require('express');
var ics = require('ics');
var router = express.Router();
var modelos = require('../../modelos');
var FCM = require('../FCM');
var uuid4 = require('uuid/v4')



router.get('/insertar_seguimiento_gestion', function(req,res){
	campos = [{tipo: "number", name: "No. de gestion", id: "GestionId", valor: req.query.GestionId}];
	campos.push({tipo: "textarea", name: "Observacion", id: "observacion", rows: "3"});
	campos.push({tipo: "datetime-local", name: "Fecha de visita", id: "fecha"});
	campos.push({tipo: "number", name: "Recordatorio en minutos", id: "recordatorio"});
	campos.push({tipo: "number", name: "Duracion de la visita en minutos", id: "duracion"});
	datos = {accion: "insertar_seguimiento_gestion" , modelo: "Agenda", campos: campos};
	datos.menu = req.menu.html;
	res.render('formulario_base2', datos);
});
router.post('/insertar_seguimiento_gestion', function(req, res, next){
	var values = req.body.values;
	var nvalues = {};
	for(value in values){
		if(values[value]!=''){
			nvalues[value] = values[value];
		}
	}
	values.CreadorId = req.user.id;
	if(values.fecha =='') res.json({cod: 0, msj: 'Fecha incorrecta verifique'});
	else{
		modelos.Agenda.findAll({where: {GestionId: values.GestionId, asistio: null}}).then(function(agenda){
			if(agenda.length>0){
				res.json({cod: 0, msj: 'Error no puede tener mas de un evento activo agendado por gestion, por favor confirmar asistencias'});
			}else{
				if(new Date(values.fecha)<= new Date(new Date().setMinutes(new Date().getMinutes()- 360))){
					res.json({cod:0, msj: 'La fecha no puede estar en pasado'});	
				}else{
					modelos.Agenda.create(values).then(function(m){
						if(m){
							val_seguimiento = {observacion: 'El ejecutivo: '+req.user.nombre+', agendo una visita para la fecha '+m.get('fecha')+', el ejecutivo informa: '+m.get('observacion')},
							val_seguimiento['GestionId'] = m.get('GestionId');
							val_seguimiento['EstadoGestionId'] = 5;
							val_seguimiento['CreadorId'] = m.get('CreadorId');
							modelos.GestionSeguimiento.create(val_seguimiento).then(function(gs){
								
								modelos.Gestion.findAll({include: [{model: modelos.Usuario, as: 'Creador'}], where: {id: m.GestionId}}).then(function(gestiones){
									gestion = gestiones[0];
									gestion.update({EstadoGestionId: 5}).then(function(){
										data = {titulo: "Agenda de la gestion No. "+m.get('GestionId')};
										data.descripcion = 'El ejecutivo: '+req.user.nombre+', agendo un seguimiento, tambien indica: '+m.get('observacion');
										data.EncargadoId = {nombre: req.user.nombre, correo: req.user.correo};
										data.CreadorId= {nombre: gestion.get('Creador').get('nombre'), correo:gestion.get('Creador').get('correo')};
										fec = new Date(m.fecha);
										//fec = new Date(fec.setMinutes(fec.getMinutes()-360));
										data.inicio = [fec.getUTCFullYear(), fec.getMonth()+1, fec.getUTCDate(), fec.getUTCHours(),fec.getUTCMinutes()];
										//console.log(fec);
										fec_f = new Date(fec.setMinutes(fec.getMinutes()+parseInt(m.duracion)));
										//console.log(fec_f);
										data.finaliza = [fec_f.getUTCFullYear(), fec_f.getUTCMonth()+1, fec_f.getUTCDate(),fec_f.getUTCHours(),fec_f.getUTCMinutes()];
										//console.log(data);
										f_crear_evento_calendario(data).then(function(icalendar){
											var info = {from: 'Sistema de contacto Gnesis', to: data.CreadorId.correo, subject: data.titulo, text: data.descripcion};
											info.icalEvent = {
												method: 'ADD',
												content: icalendar
											}
											FCM.enviar_mail(info);
											if(data.EncargadoId.correo != info.to){
												FCM.enviar_mail(info);
												info.to = data.EncargadoId.correo;
												info.text = 'Agendaste un evento en la gestion No. '+m.get('GestionId')+', indicaste: '+m.get('observacion');
												FCM.enviar_mail(info);		
											}
										}).catch(function(error){
											console.log("error al crear ics. "+error);
										});

										/*/
										var info = {'notification': {'title': 'Visita para la gestion '+gestion.get('id'), 'body': 'Se agendo una visita la fecha '+m.get('fecha')+', para la gestion No. '+gestion.get("id")}, 'data': {'gestion': gestion.get("id"), 'tipo': 'agendar', 'titulo': 'Visita para dar seguimiento gestion '+gestion.get("id"),'fecha': m.get('fecha'), 'observacion': m.get('observacion'), 'duracion': m.get('duracion'), 'recordatorio': m.get('recordatorio')}};
										FCM.enviar_info(req.user.id, info);
										if(req.user.id != gestion.CreadorId){
											info.notification.title = 'Coordinacion para visita';
											info.notification.body = 'El ejecutivo '+req.user.nombre+', agendo una visita o seguimiento para la fecha '+m.get('fecha')+' en su gestion No. '+gestion.get("id");
											FCM.enviar_info(gestion.CreadorId, info);
										}*/
										res.json({'cod': '1', 'msj': 'Todo Ok', 'id': m.get("id")});
										next();
									}).catch(function(error){
										res.json({'cod': '0', 'msj': 'Guardo el seguimiento pero no el nuevo estado de la gestion'+error});
										next();
									});
								}).catch(function(error){
									res.json({'cod': '0', 'msj': 'Guardo el seguimiento pero no encontro la gestion'});
									next();
								});
							}).catch(function(error){
								res.json({'cod': '0', 'msj': 'Guardo en agenda pero no creo el seguimiento de la gestion'});
								next();
							});	
						}else{
							console.log("Error al guardar en agenda");
							next();

						}
					}).catch(function(error){
						res.json({'cod': '0', 'msj': error.message});
						next();
					});
				}
			}

		});
	}			
});
router.get('/confirmar_asistencia/:gestion', function(req,res,next){
	modelos.Agenda.findAll({include: [{model: modelos.Gestion}, {model: modelos.Usuario, as: 'Creador'}], where: {GestionId: req.params.gestion, asistio: null}}).then(function(agendas){	
		if(agendas.length>0){
			permitido = false;
			var agenda = agendas[0];
			if(agenda.get("Gestion").CreadorId==req.user.id || agenda.get("Creador").jefe == req.user.id || agenda.get('Gestion').EncargadoId == req.user.id) permitido = true;
			if(permitido){
				var ahora = new Date();
				agenda.update({asistio: ahora, ConfirmoId: req.user.id}).then(function(){
					val_seguimiento = {observacion: 'El ejecutivo: '+req.user.nombre+', confirmo el evento'},
					val_seguimiento['GestionId'] = agenda.get('GestionId');
					val_seguimiento['EstadoGestionId'] = 2;
					val_seguimiento['CreadorId'] = req.user.id;
					modelos.GestionSeguimiento.create(val_seguimiento).then(function(gs){
						agenda.get('Gestion').update({EstadoGestionId: 2}).then((g)=>{
							res.redirect('/');
							var info = {notification: {'title': 'Confirmo asistencia evento', 'body': 'Se confirmo el seguimiento del ejecutivo: '+agenda.get("Creador").nombre+' en el evento programado para: '+agenda.get('fecha')+', en la gestion '+req.params.gestion+'. Confirmado por: '+req.user.nombre}, data: {'gestion': req.params.gestion}};
							if(req.user.id != agenda.get('Gestion').CreadorId)
								FCM.enviar_info(agenda.get('Gestion').CreadorId, info);
							if(req.user.id != agenda.get('CreadorId'))
								FCM.enviar_info(agenda.get('CreadorId'), info);	
						}).catch((error)=>{
							res.json({cod:0,msj: 'No se actualizo el estado de la Gestion'});
						})
					}).catch((error)=>{
						res.json({cod:0,msj: 'Error no se pudo crear el seguimiento'});
					});	
				}).catch(function(error){
					res.json({cod: 0, msj: 'Error no se pudo actualizar el evento por favor volver a intentar'+error});
				});
			}else{
				res.json({cod:0, msj: 'No esta autorizado para confirmar la asistencia'});
			}
		}else{
			res.json({cod: 0, msj: 'No hay eventos que confirmar, para esta gestion'});
		}
	});
});
router.get('/confirmar_autorizacion', function(req,res,next){
	campos = [{tipo: "number", name: "No. de gestion", id: "GestionId", valor: req.query.GestionId}];
	campos.push({tipo: "textarea", name: "Observacion", id: "observacion", rows: "3"});
	datos = {accion: "confirmar_autorizacion" , modelo: "Agenda", campos: campos};
	
	datos.menu = req.menu.html;
	res.render('formulario_base2', datos);
});
router.post('/confirmar_autorizacion', function(req,res,next){
	var values = JSON.parse(req.body.values);
	if(values.GestionId=='') res.json({cod:0,msj:'Gestion no valida'});
	else{
		f_confirmar_asistencia(values.GestionId,req.user.id).then(function(respuesta){
			res.json({cod:1,msj: 'Todo Ok'});
			var info = {notification: {'title': 'Confirmo asistencia evento', 'body': 'Se confirmo la asistencia del ejecutivo: '+respuesta.get("Creador").nombre+' en el evento programado para: '+agenda.get('fecha')+', en la gestion '+values.GestionId+'. Confirmado por: '+req.user.nombre}, data: {'gestion': values.GestionId}};
			FCM.enviar_info(agenda.get('Gestion').CreadorId, info);
			FCM.enviar_info(agenda.get('CreadorId'), info);
		}).catch(function(error){
			res.json({cod:0,msj:error});
		});
	}
	
});
router.get('/reagendar/', function(req,res,next){
	campos = [{tipo: "number", name: "No. de gestion", id: "GestionId", valor: req.query.GestionId}];
	campos.push({tipo: "textarea", name: "Observacion", id: "observacion", rows: "3"});
	campos.push({tipo: "datetime-local", name: "Nueva fecha de visita", id: "fecha"});
	campos.push({tipo: "number", name: "Recordatorio en minutos", id: "recordatorio"});
	campos.push({tipo: "number", name: "Duracion de la visita en minutos", id: "duracion"});
	datos = {accion: "reagendar", modelo: "Agenda", campos: campos};
	datos.menu = req.menu.html;
	res.render('formulario_base2', datos);
});
router.post('/reagendar/', function(req,res,next){
	var values = req.body.values;
	var nvalues = {};
	for(value in values){
		if(values[value]!=''){
			nvalues[value] = values[value];
		}
	}
	values.CreadorId = req.user.id;
	if(values.fecha=='')res.json({cod:0,msj:'Error en fecha verificar'})
	else{
		if(new Date(values.fecha)<= new Date(new Date().setMinutes(new Date().getMinutes()- 360))){
			res.json({cod:0, msj: 'La fecha no puede estar en pasado'});	
		}else{
			modelos.Agenda.findAll({where: {GestionId: values.GestionId, asistio: null}}).then(function(agendas){
				if(agendas.length>0){
					agenda = agendas[0];
					modelos.Agenda.create(values).then(function(a){
						ahora = new Date();
						agenda.update({asistio: ahora, ConfirmoId: req.user.id, reagendo: a.get('id')}).then(function(ag){
							val_seguimiento = {observacion: 'El ejecutivo: '+req.user.nombre+', reagendo una visita para la fecha '+a.get('fecha')+', el ejecutivo informa: '+a.get('observacion')},
							val_seguimiento['GestionId'] = a.get('GestionId');
							val_seguimiento['EstadoGestionId'] = 5;
							val_seguimiento['CreadorId'] = req.user.id;
							modelos.GestionSeguimiento.create(val_seguimiento).then(function(gs){
								modelos.Gestion.findById(a.GestionId).then(function(gestion){
									gestion.update({EstadoGestionId: 5}).then(function(){
										var info = {'notification': {'title': 'Visita para la gestion '+gestion.get('id'), 'body': 'Se agendo una visita la fecha '+a.get('fecha')+', para la gestion No. '+gestion.get("id")}, 'data': {'gestion': gestion.get("id"), 'tipo': 'agendar', 'titulo': 'Visita para dar seguimiento gestion '+gestion.get("id"),'fecha': a.get('fecha'), 'observacion': a.get('observacion'), 'duracion': a.get('duracion'), 'recordatorio': a.get('recordatorio')}};
										FCM.enviar_info(req.user.id, info);		
										var info = {'notification': {'tile': 'Coordinacion para visita', 'body': 'El ejecutivo '+req.user.nombre+', agendo una visita o seguimiento para la fecha '+a.get('fecha')+' en su gestion No. '+gestion.get("id")}, 'data': {'gestion': gestion.get("id")}};
										FCM.enviar_info(gestion.CreadorId, info);
										
										res.json({'cod': '1', 'msj': 'Todo Ok', 'id': a.get("id")});
										next();
									}).catch(function(error){
										res.json({'cod': '0', 'msj': 'Guardo el seguimiento pero no el nuevo estado de la gestion'});
										next();
									});
								}).catch(function(error){
									res.json({'cod': '0', 'msj': 'Guardo el seguimiento pero no encontro la gestion'});
									next();
								});
							}).catch(function(error){
								res.json({'cod': '0', 'msj': 'Guardo en agenda pero no creo el seguimiento de la gestion'+error});
								next();
							});	
						}).catch(function(error){
							res.json({cod: 0, msj: error});
						});
					}).catch(function(error){
						res.json({cod: 0, msj: error});
					});
					
				}else{
					res.json({cod: 0, msj: 'No existe agendas pendientes en esta gestion'});
				}
			}).catch(function(error){
				res.json({cod: 0, msj: error});
			});
		}	
	}
});

module.exports = router;

function f_confirmar_asistencia(gestion, usuarioId){
	return new Promise(function(resolver, regresar){
		modelos.Agenda.findAll({include: [{model: modelos.Gestion}, {model: modelos.Usuario, as: 'Creador'}], where: {GestionId: gestion, asistio: null}}).then(function(agendas){
		
			if(agendas.length>0){
				permitido = false;
				var agenda = agendas[0];
				if(agenda.get("Gestion").CreadorId==usuarioId || agenda.get("Creador").jefe == usuarioId) permitido = true;
				if(permitido){
					var ahora = new Date();
					agenda.update({asistio: ahora, ConfirmoId: usuarioId}).then(function(ag){
						resolver(ag);
					}).catch(function(error){
						regresar('Error no se pudo actualizar el evento por favor volver a intentar'+error);
					});
				}else{
					regresar('No esta autorizado para confirmar la asistencia');
				}
			}else{
				regresar('No hay eventos que confirmar, para esta gestion');
			}
		});
	});
}

function f_crear_evento_calendario(data){

	return new Promise(function(resolver, regresar){
		var event = {
			start: data.inicio,
			end: data.finaliza,
			title: data.titulo,
			description: data.descripcion,
			categories: ['eventos Gnesis'],
			status: 'CONFIRMED',
			organizer: { name: 'Administrador', email: 'contacto.genesis@gmail.com' },
			attendees: [
			{ name: data.EncargadoId.nombre, email: data.EncargadoId.correo },
			{ name: data.CreadorId.nombre, email: data.CreadorId.correo }
			]
		}
		//console.log(event);
		create_ics(event).then((resultado)=>{
			resolver(resultado);
		}).catch((error)=>{
			regresar(error);
		});
		
	});
}
function create_ics(event){
	return new Promise((success, fail)=>{
		var ahora = new Date();
		out = "BEGIN:VCALENDAR\nVERSION:2.0\nCALSCALE:GREGORIAN\n";
		event.start.reduce((a,value,key)=>{event.start[key] = agregar_cero(value)},0);
		event.end.reduce((a,value,key)=>{event.end[key] = agregar_cero(value)},0);
		if(event.productId) out += 'PRODID:'+event.productId+'\n';
		else out += 'PRODID:Tecnodisa/ics\n'
		out += "BEGIN:VEVENT\n";
		out += 	"UID:"+uuid4()+"\n";
		out += "SUMMARY:"+event.title+"\n";

		out += "DTSTAMP:"+ahora.getFullYear()+""+agregar_cero((ahora.getMonth()+1))+""+agregar_cero(ahora.getDate())+"T"+agregar_cero(ahora.getHours())+''+agregar_cero(ahora.getMinutes())+"00\n";
		out += "DTSTART:"+event.start[0]+''+event.start[1]+''+event.start[2]+'T'+event.start[3]+''+event.start[4]+'00\n';
		out += "DTEND:"+event.end[0]+''+event.end[1]+''+event.end[2]+'T'+event.end[3]+''+event.end[4]+'00\n';
		out += "DESCRIPTION:"+event.description+"\n";
		out	+= "STATUS:"+event.status+"\n";
		out += "CATEGORIES:"+event.categories[0]+"\n";
		out += "ORGANIZER;CN="+event.organizer.name+":mailto:"+event.organizer.email+"\n";
		for(var m = 0; m<event.attendees.length; m++){
			out += "ATTENDEE;RSVP=FALSE;CN="+event.attendees[m].name+":mailto:"+event.attendees[m].email+"\n";
		}
		out += "END:VEVENT\n";
		out += "END:VCALENDAR\n";
		success(out);
	});
}
function agregar_cero(a){
	console.log("entro: "+a);
	a = a+"";
	console.log("longitud:" +a.length);
	if(a.length==1) a = "0"+a;
	console.log("salio: "+a);
	return a;
	
}
