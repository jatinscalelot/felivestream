const dotenv = require('dotenv').config();
var path = require('path');
var url = require('url');
var express = require('express');
var minimist = require('minimist');
var ws = require('ws');
var kurento = require('kurento-client');
var fs = require('fs');
var https = require('https');
let mongoose = require("mongoose");
const async = require('async');
const mongoConnection = require('./utilities/connections');
const constants = require('./utilities/constants');
const lstreamModel = require('./models/livestreams.model');
const organiserModel = require('./models/organizers.model');
const userModel = require('./models/users.model');
const currentpresentersModel = require('./models/currentpresenters.model');
var argv = minimist(process.argv.slice(2), {
	default: {
		as_uri: 'http://stun.festumevento.com:8443/',
		ws_uri: 'ws://live.festumevento.in:8888/kurento'
	}
});
var options = {
	key: fs.readFileSync('keys/server.key'),
	cert: fs.readFileSync('keys/server.crt')
};
var app = express();
var idCounter = 0;
var candidatesQueue = {};
var kurentoClient = null;
var presenter = [];
var viewers = [];
var noPresenterMessage = 'No active presenter. Try again later...';
var asUrl = url.parse(argv.as_uri);
var port = asUrl.port;
var server = https.createServer(options, app).listen(port, function () {
	console.log('Festum Evento Livestreaming App Started');
	console.log('Open ' + url.format(asUrl) + ' with a WebRTC capable browser');
});
mongoose.set('runValidators', true);
mongoose.set('strictQuery', false);
mongoose.connect(process.env.MONGO_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true
});
mongoose.connection.once('open', () => {
	console.log("Well done! , connected with mongoDB database");
}).on('error', error => {
	console.log("Oops! database connection error:" + error);
});
var wss = new ws.Server({
	server: server,
	path: '/one2many'
});
function nextUniqueId() {
	idCounter++;
	return idCounter.toString();
}
var userId = null;
wss.on('connection', function (ws, req) {
	const queryString = req.url.split('?')[1];
	if (queryString) {
		const queryParams = new URLSearchParams(queryString);
		var sessionId = queryParams.get('sessionId');
		let oId = queryParams.get('oId');
		let uId = queryParams.get('uId');
		let primary = mongoConnection.useDb(constants.DEFAULT_DB);
		if ((sessionId && sessionId != undefined && sessionId != '' && sessionId != null) && ((oId && oId != undefined && oId != null && oId != '' && oId != 'null' && mongoose.Types.ObjectId.isValid(oId)) || (uId && uId != undefined && uId != null && uId != '' && uId != 'null' && mongoose.Types.ObjectId.isValid(uId)))) {
			(async () => {
				let livestreamData = await primary.model(constants.MODELS.livestreams, lstreamModel).findById(sessionId).lean();
				let organiserData = {}; let userData = {};
				if (oId && oId != undefined && oId != null && oId != '' && oId != 'null' && mongoose.Types.ObjectId.isValid(oId)) {
					organiserData = await primary.model(constants.MODELS.organizers, organiserModel).findById(oId).lean();
				} else {
					userId = uId;
					if (viewers[userId]) {
						if (viewers[userId].ws && viewers[userId].sessionId == sessionId) {
							viewers[userId].ws.send(JSON.stringify({
								id: 'stopCommunication'
							}));
							delete viewers[userId];
						}
					}
					userData = await primary.model(constants.MODELS.users, userModel).findById(uId).lean();
				}
				//console.log('livestreamData', livestreamData);
				//console.log('organiserData', organiserData);
				//console.log('userData', userData);
				ws.on('error', function (error) {
					console.log('Connection ' + sessionId + ' error');
					stop(sessionId);
				});
				ws.on('close', function () {
					console.log('Connection ' + sessionId + ' closed');
					//stop(sessionId);
				});
				ws.on('message', function (_message) {
					var message = JSON.parse(_message);
					console.log('Connection ' + sessionId + ' received message ');
					switch (message.id) {
						case 'presenter':
							startPresenter(sessionId, ws, message.sdpOffer, function (error, sdpAnswer) {
								if (error) {
									return ws.send(JSON.stringify({
										id: 'presenterResponse',
										response: 'rejected',
										message: error
									}));
								}
								ws.send(JSON.stringify({
									id: 'presenterResponse',
									response: 'accepted',
									sdpAnswer: sdpAnswer
								}));
							});
							break;
						case 'viewer':
							startViewer(sessionId, ws, message.sdpOffer, function (error, sdpAnswer) {
								if (error) {
									return ws.send(JSON.stringify({
										id: 'viewerResponse',
										response: 'rejected',
										message: error
									}));
								}
								ws.send(JSON.stringify({
									id: 'viewerResponse',
									response: 'accepted',
									sdpAnswer: sdpAnswer
								}));
							});
							break;
						case 'stop':
							if (oId && oId != undefined && oId != null && oId != '' && oId != 'null' && mongoose.Types.ObjectId.isValid(oId)) {
								stop(sessionId);
							}
							break;
						case 'onIceCandidate':
							onIceCandidate(message.type, sessionId, message.candidate);
							break;
						default:
							ws.send(JSON.stringify({
								id: 'error',
								message: 'Invalid message ' + message
							}));
							break;
					}
				});
			})().catch((error) => {
				console.log('error in main catch', error);
			});
		}
	}
});
function getKurentoClient(callback) {
	if (kurentoClient !== null) {
		return callback(null, kurentoClient);
	}
	kurento(argv.ws_uri, function (error, _kurentoClient) {
		if (error) {
			console.log("Could not find media server at address " + argv.ws_uri);
			return callback("Could not find media server at address" + argv.ws_uri
				+ ". Exiting with error " + error);
		}
		kurentoClient = _kurentoClient;
		callback(null, kurentoClient);
	});
}
function startPresenter(sessionId, ws, sdpOffer, callback) {
	clearCandidatesQueue(sessionId);
	if (presenter[sessionId] && presenter[sessionId] !== null) {
		stop(sessionId);
		return callback("Another user is currently acting as presenter. Try again later ...");
	}
	presenter[sessionId] = {
		id: sessionId,
		pipeline: null,
		webRtcEndpoint: null
	}
	getKurentoClient(function (error, kurentoClient) {
		if (error) {
			stop(sessionId);
			return callback(error);
		}
		if (presenter[sessionId] && presenter[sessionId] === null) {
			stop(sessionId);
			return callback(noPresenterMessage);
		}
		kurentoClient.create('MediaPipeline', function (error, pipeline) {
			if (error) {
				stop(sessionId);
				return callback(error);
			}
			if (presenter[sessionId] && presenter[sessionId] === null) {
				stop(sessionId);
				return callback(noPresenterMessage);
			}
			presenter[sessionId].pipeline = pipeline;
			pipeline.create('WebRtcEndpoint', function (error, webRtcEndpoint) {
				if (error) {
					stop(sessionId);
					return callback(error);
				}
				if (presenter[sessionId] && presenter[sessionId] === null) {
					stop(sessionId);
					return callback(noPresenterMessage);
				}
				presenter[sessionId].webRtcEndpoint = webRtcEndpoint;
				if (candidatesQueue[sessionId]) {
					while (candidatesQueue[sessionId].length) {
						var candidate = candidatesQueue[sessionId].shift();
						webRtcEndpoint.addIceCandidate(candidate);
					}
				}
				webRtcEndpoint.on('OnIceCandidate', function (event) {
					var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
					ws.send(JSON.stringify({
						id: 'iceCandidate',
						candidate: candidate
					}));
				});
				webRtcEndpoint.processOffer(sdpOffer, function (error, sdpAnswer) {
					if (error) {
						stop(sessionId);
						return callback(error);
					}
					if (presenter[sessionId] && presenter[sessionId] === null) {
						stop(sessionId);
						return callback(noPresenterMessage);
					}
					callback(null, sdpAnswer);
				});
				webRtcEndpoint.gatherCandidates(function (error) {
					if (error) {
						stop(sessionId);
						return callback(error);
					}
				});
			});
		});
	});
}
function startViewer(sessionId, ws, sdpOffer, callback) {
	clearCandidatesQueue(userId);
	if (presenter[sessionId] && presenter[sessionId] === null) {
		console.log('in if condition 1');
		stop(sessionId);
		return callback(noPresenterMessage);
	}
	presenter[sessionId].pipeline.create('WebRtcEndpoint', function (error, webRtcEndpoint) {
		if (error) {
			// stop(sessionId);
			return callback(error);
		}
		viewers[userId] = {
			"webRtcEndpoint": webRtcEndpoint,
			"ws": ws,
			"sessionId": sessionId
		}
		if (presenter[sessionId] && presenter[sessionId] === null) {
			//stop(sessionId);
			return callback(noPresenterMessage);
		}
		if (candidatesQueue[userId]) {
			while (candidatesQueue[userId].length) {
				var candidate = candidatesQueue[userId].shift();
				webRtcEndpoint.addIceCandidate(candidate);
			}
		}
		webRtcEndpoint.on('OnIceCandidate', function (event) {
			var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
			ws.send(JSON.stringify({
				id: 'iceCandidate',
				candidate: candidate
			}));
		});
		webRtcEndpoint.processOffer(sdpOffer, function (error, sdpAnswer) {
			if (error) {
				// stop(sessionId);
				return callback(error);
			}
			if (presenter[sessionId] && presenter[sessionId] === null) {
				// stop(sessionId);
				return callback(noPresenterMessage);
			}
			presenter[sessionId].webRtcEndpoint.connect(webRtcEndpoint, function (error) {
				if (error) {
					// stop(sessionId);
					return callback(error);
				}
				if (presenter[sessionId] && presenter[sessionId] === null) {
					// stop(sessionId);
					return callback(noPresenterMessage);
				}
				callback(null, sdpAnswer);
				webRtcEndpoint.gatherCandidates(function (error) {
					if (error) {
						// stop(sessionId);
						return callback(error);
					}
				});
			});
		});
	});
}
function clearCandidatesQueue(sessionId) {
	if (candidatesQueue[sessionId]) {
		delete candidatesQueue[sessionId];
	}
}
function stop(sessionId) {
	console.log(presenter[sessionId]);
	if (presenter[sessionId] && presenter[sessionId] !== null && presenter[sessionId].id && presenter[sessionId].id == sessionId) {
		for (var i in viewers) {
			var viewer = viewers[i];
			if (viewer.ws && viewer.sessionId == sessionId) {
				viewer.ws.send(JSON.stringify({
					id: 'stopCommunication'
				}));
			}
		}
		presenter[sessionId].pipeline.release();
		presenter[sessionId] = null;
		// viewers = [];
	} else if (viewers[sessionId]) {
		viewers[sessionId].webRtcEndpoint.release();
		delete viewers[sessionId];
	}
	clearCandidatesQueue(sessionId);
	if (viewers.length < 1 && !presenter[sessionId]) {
		console.log('Closing kurento client');
		try {
			kurentoClient.close();
		} catch (e) { }
		kurentoClient = null;
	}
}
function onIceCandidate(type, sessionId, _candidate) {
	var candidate = kurento.getComplexType('IceCandidate')(_candidate);
	if (type == 'pub' && presenter[sessionId] && presenter[sessionId].id === sessionId && presenter[sessionId].webRtcEndpoint) {
		console.info('Sending presenter candidate');
		presenter[sessionId].webRtcEndpoint.addIceCandidate(candidate);
	}
	else if (viewers[userId] && viewers[userId].webRtcEndpoint) {
		console.info('Sending viewer candidate');
		viewers[userId].webRtcEndpoint.addIceCandidate(candidate);
	}
	else {
		console.info('Queueing candidate');
		if (!candidatesQueue[sessionId]) {
			candidatesQueue[sessionId] = [];
		}
		candidatesQueue[sessionId].push(candidate);
	}
}
// app.use(express.static(path.join(__dirname, 'static')), (req, res) => {
// 	console.log('req', req);
// });
app.get('/count', async (req, res) => {
	if (req.query.apiKey && req.query.apiKey != '' && req.query.apiKey != undefined && req.query.apiKey != null && mongoose.Types.ObjectId.isValid(req.query.apiKey)) {
		let x = 0;
		for (var i in viewers) {
			var viewer = viewers[i];
			if (viewer.ws && viewer.sessionId == req.query.apiKey) {
				++x;
			}
		}
		res.json({ count: x });
		res.end();
	} else {
		res.json({ count: 0 });
		res.end();
	}
});
app.get('/:sessionId', function (req, res, next) {
	console.log('req params', req.params);
	res.redirect('https://livestream.festumevento.com/?sessionId=' + req.params.sessionId)
});
app.use(express.static(path.join(__dirname, 'static')));


