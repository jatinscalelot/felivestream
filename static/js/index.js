const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('sessionId');
const oId = urlParams.get('oId');
const uId = urlParams.get('uId');
if (oId && oId != null && oId != undefined && oId != '') {
	var ws = new WebSocket('wss://' + location.host + '/one2many?sessionId=' + sessionId + '&oId=' + oId);
} else {
	var ws = new WebSocket('wss://' + location.host + '/one2many?sessionId=' + sessionId + '&uId=' + uId);
}
var video;
var webRtcPeer;
var type = 'pub';

window.onload = function () {
	if (oId && oId != null && oId != undefined && oId != '') {
		document.getElementById('call').style.display = "block";
		document.getElementById('viewer').style.display = "none";
	} else {
		document.getElementById('call').style.display = "none";
		document.getElementById('viewer').style.display = "block";
	}
	console = new Console();
	video = document.getElementById('video');
	document.getElementById('call').addEventListener('click', function () { presenter(); });
	document.getElementById('viewer').addEventListener('click', function () { viewer(); });
	document.getElementById('terminate').addEventListener('click', function () { stop(); });
}
window.onbeforeunload = function () {
	ws.close();
}
ws.onmessage = function (message) {
	var parsedMessage = JSON.parse(message.data);
	console.info('Received message: ' + message.data);
	switch (parsedMessage.id) {
		case 'presenterResponse':
			presenterResponse(parsedMessage);
			break;
		case 'viewerResponse':
			viewerResponse(parsedMessage);
			break;
		case 'stopCommunication':
			dispose();
			break;
		case 'iceCandidate':
			webRtcPeer.addIceCandidate(parsedMessage.candidate)
			break;
		default:
			console.error('Unrecognized message', parsedMessage);
	}
	console.log('total no of user :', ws);
}

function presenterResponse(message) {
	if (message.response != 'accepted') {
		var errorMsg = message.message ? message.message : 'Unknow error';
		console.warn('Call not accepted for the following reason: ' + errorMsg);
		dispose();
	} else {
		webRtcPeer.processAnswer(message.sdpAnswer);
	}
}
function viewerResponse(message) {
	if (message.response != 'accepted') {
		var errorMsg = message.message ? message.message : 'Unknow error';
		console.warn('Call not accepted for the following reason: ' + errorMsg);
		dispose();
	} else {
		webRtcPeer.processAnswer(message.sdpAnswer);
	}
}
function presenter() {
	if (!webRtcPeer) {
		showSpinner(video);
		var options = {
			localVideo: video,
			onicecandidate: onIceCandidate
		}
		webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function (error) {
			if (error) return onError(error);

			this.generateOffer(onOfferPresenter);
		});
	}
}
function onOfferPresenter(error, offerSdp) {
	if (error) return onError(error);
	var message = {
		id: 'presenter',
		sdpOffer: offerSdp
	};
	sendMessage(message);
}
function viewer() {
	type = 'sub';
	if (!webRtcPeer) {
		showSpinner(video);
		var options = {
			remoteVideo: video,
			onicecandidate: onIceCandidate
		}
		webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function (error) {
			if (error) return onError(error);

			this.generateOffer(onOfferViewer);
		});
	}
}
function onOfferViewer(error, offerSdp) {
	if (error) return onError(error)
	var message = {
		id: 'viewer',
		sdpOffer: offerSdp
	}
	sendMessage(message);
}
function onIceCandidate(candidate) {
	console.log('Local candidate' + JSON.stringify(candidate));
	var message = {
		id: 'onIceCandidate',
		candidate: candidate
	}
	sendMessage(message);
}
function stop() {
	if (webRtcPeer) {
		var message = {
			id: 'stop'
		}
		sendMessage(message);
		dispose();
	}
}
function dispose() {
	if (webRtcPeer) {
		webRtcPeer.dispose();
		webRtcPeer = null;
	}
	hideSpinner(video);
}
function sendMessage(message) {
	message.type = type;
	var jsonMessage = JSON.stringify(message);
	console.log('Sending message: ' + jsonMessage);
	ws.send(jsonMessage);
}
function showSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].poster = './img/transparent-1px.png';
		arguments[i].style.background = 'center transparent url("./img/spinner.gif") no-repeat';
	}
}
function hideSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].src = '';
		arguments[i].poster = './img/webrtc.png';
		arguments[i].style.background = '';
	}
}
/**
 * Lightbox utility (to display media pipeline image in a modal dialog)
 */
$(document).delegate('*[data-toggle="lightbox"]', 'click', function (event) {
	event.preventDefault();
	$(this).ekkoLightbox();
});
setInterval(function () {
	$.ajax({
		contentType: 'application/json',
		dataType: 'json',
		success: function(data){
			$('#liveviewers').text(data.count);
		},
		error: function(){
			console.log('Error while getting current user count');
		},
		processData: false,
		type: 'GET',
		url: '/count?apiKey='+sessionId
	});
}, 5000);

