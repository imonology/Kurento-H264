var path = require('path');
var url = require('url');
var cookieParser = require('cookie-parser')
var express = require('express');
var session = require('express-session')
var minimist = require('minimist');
var ws = require('ws');
var kurento = require('kurento-client');
var sleep = require('sleep');

var argv = minimist(process.argv.slice(2), {
    default: {
        as_uri: 'http://localhost:8080/',
        ws_uri: 'ws://localhost:8888/kurento'
    }
});

var app = express();

/*
 * Management of sessions
 */
app.use(cookieParser());

var sessionHandler = session({
    secret : 'none',
    rolling : true,
    resave : true,
    saveUninitialized : true
});

app.use(sessionHandler);

/*
 * Definition of global variables.
 */
var sessions = {};
var candidatesQueue = {};
var kurentoClient = null;
var camera_uri = 'rtsp://140.109.221.238/live1.sdp';
var wait_to_reconnect = 10; //in second
/*
 * Server startup
 */
var asUrl = url.parse(argv.as_uri);
var port = asUrl.port;
var server = app.listen(port, function() {
    console.log('Open ' + url.format(asUrl) + ' with Chrome or Firefox');
});

var wss = new ws.Server({
    server : server,
    path : '/player-errors'
});

/*
 * Management of WebSocket messages
 */
wss.on('connection', function(ws) {
    var sessionId = null;
    var request = ws.upgradeReq;
    var response = {
        writeHead : {}
    };

    sessionHandler(request, response, function(err) {
        sessionId = request.session.id;
        console.log('Connection received with sessionId ' + sessionId);
    });

    ws.on('error', function(error) {
        console.log('Connection ' + sessionId + ' error');
        stop(sessionId);
    });

    ws.on('close', function() {
        console.log('Connection ' + sessionId + ' closed');
        stop(sessionId);
    });

    ws.on('message', function(_message) {
        var message = JSON.parse(_message);
        console.log('Connection ' + sessionId + ' received message ', message);

        switch (message.id) {
        case 'start':
            sessionId = request.session.id;
            start(sessionId, ws, message.sdpOffer, function(error, type, data) {
                if (error) {
                    return ws.send(JSON.stringify({
                        id : 'error',
                        message : error
                    }));
                }
                switch (type) {
                    case 'sdpAnswer':
                        ws.send(JSON.stringify({
                            id : 'startResponse',
                            sdpAnswer : data
                        }));
                        break;
                    case 'playerError':
                        ws.send(JSON.stringify({
                            id : 'playerError',
                            data : data
                        }));
                        break;
                     case 'playerEOS':
                        ws.send(JSON.stringify({
                            id : 'playerEOS',
                        }));
                        break;
                }
            });
            break;

        case 'stop':
            stop(sessionId);
            break;

        case 'onIceCandidate':
            onIceCandidate(sessionId, message.candidate);
            break;

        default:
            ws.send(JSON.stringify({
                id : 'error',
                message : 'Invalid message ' + message
            }));
            break;
        }

    });
});

/*
 * Definition of functions
 */

// Recover kurentoClient for the first time.
function getKurentoClient(callback) {
    if (kurentoClient !== null) {
        return callback(null, kurentoClient);
    }

    kurento(argv.ws_uri, function(error, _kurentoClient) {
        if (error) {
            console.log("Could not find media server at address " + argv.ws_uri);
            return callback("Could not find media server at address" + argv.ws_uri
                    + ". Exiting with error " + error);
        }

        kurentoClient = _kurentoClient;
        callback(null, kurentoClient);
    });
}

function start(sessionId, ws, sdpOffer, callback) {
    if (!sessionId) {
        return callback('Cannot use undefined sessionId');
    }

    getKurentoClient(function(error, kurentoClient) {
        if (error) {
            return callback(error);
        }

        kurentoClient.create('MediaPipeline', function(error, pipeline) {
            if (error) {
                return callback(error);
            }

            createMediaElements(pipeline, ws, function(error, webRtcEndpoint, playerEndpoint) {
                if (error) {
                    pipeline.release();
                    return callback(error);
                }

                if (candidatesQueue[sessionId]) {
                    while(candidatesQueue[sessionId].length) {
                        var candidate = candidatesQueue[sessionId].shift();
                        webRtcEndpoint.addIceCandidate(candidate);
                    }
                }

                connectMediaElements(webRtcEndpoint, playerEndpoint, function(error) {
                    if (error) {
                        pipeline.release();
                        return callback(error);
                    }

                    webRtcEndpoint.on('OnIceCandidate', function(event) {
                        var candidate = kurento.register.complexTypes.IceCandidate(event.candidate);
                        ws.send(JSON.stringify({
                            id : 'iceCandidate',
                            candidate : candidate
                        }));
                    });

                    webRtcEndpoint.processOffer(sdpOffer, function(error, sdpAnswer) {
                        if (error) {
                            pipeline.release();
                            return callback(error);
                        }

                        sessions[sessionId] = {
                            'pipeline' : pipeline,
                            'webRtcEndpoint' : webRtcEndpoint,
                            'playerEndpoint': playerEndpoint
                        }
                        return callback(null, 'sdpAnswer',sdpAnswer);
                    });

                    webRtcEndpoint.gatherCandidates(function(error) {
                        if (error) {
                            return callback(error);
                        }
                    });

                    //Add error and EOS listeneres to playerEndpoint
                    playerEndpoint.on('Error', function (error){
                        console.info ("player error detected", error);
                        
                        //We can not reuse the previous player.
                        // It is neccesary destroy the previous one,
                        //reconect it and suscribe to the event again
                        // The function reconnectPlayerEndpoint manages
                        //all stuff.
                        reconnectPlayerEndpoint(sessionId, function(error_) {
                            if (error_) {
                                return callback(error, 'playerError', error_);
                            }

                            return callback(null, 'playerError', error);
                        });                        
                    });

                    playerEndpoint.on('EndOfStream', function (error){
                        console.info ("Player End Of Stream detected");
                        
                        playerEndpoint.play (function(error) {
                            if (error) {
                                return callback(error);
                            }
                        });    
                        return callback(null, 'playerEOS');
                    });
                    //END: Add error and EOS listeneres to playerEndpoint

                    playerEndpoint.play (function(error) {
                        if (error) {
                            return callback(error);
                        }
                    });
                });
            });
        });
    });
}

function createMediaElements(pipeline, ws, callback) {
    pipeline.create('WebRtcEndpoint', function(error, webRtcEndpoint) {
        if (error) {
            return callback(error);
        }
        var options = {uri : camera_uri, useEncodedMedia: true}
        
        pipeline.create('PlayerEndpoint', options, function(error, playerEndpoint) {
            if (error) {
                return callback(error);
            }

            return callback(null, webRtcEndpoint, playerEndpoint);
        });
    });
}

function reconnectPlayerEndpoint (sessionId, callback) {
    if (sessions[sessionId]) {
        var player = sessions[sessionId].playerEndpoint;
        var pipeline = sessions[sessionId].pipeline;
        var webrtc = sessions[sessionId].webRtcEndpoint;

        player.release ();

        var options = {uri : camera_uri, useEncodedMedia: true}

        pipeline.create('PlayerEndpoint', options, function(error, playerEndpoint) {
            if (error) {
                return callback(error);
            }

            sessions[sessionId].playerEndpoint = playerEndpoint;

            playerEndpoint.on('Error', function (error){
                console.info ("player error detected", error);
                
                console.log ("Waiting for reconect");
                sleep.sleep(wait_to_reconnect)

                reconnectPlayerEndpoint(sessionId, function(error) {
                    if (error) {
                        return callback(error);
                    }
                });                       

                return callback(null);
            });

            playerEndpoint.on('EndOfStream', function (error){
                console.info ("Player End Of Stream detected");
                
                playerEndpoint.play (function(error) {
                    if (error) {
                        return callback(error);
                    }
                });    
                return callback(null);
            });

            playerEndpoint.connect(webrtc, 'VIDEO', function(error) {
                if (error) {
                    return callback(error);
                }

                playerEndpoint.play (function(error) {
                    if (error) {
                        return callback(error);
                    }
                });  
            });

            return callback(null);
        });
    }
}

function connectMediaElements(webRtcEndpoint, playerEndpoint, callback) {

    playerEndpoint.connect(webRtcEndpoint, 'VIDEO', function(error) {
        if (error) {
            return callback(error);
        }

        return callback(null);
    });
}

function stop(sessionId) {
    if (sessions[sessionId]) {
        var player = sessions[sessionId].playerEndpoint;
        var pipeline = sessions[sessionId].pipeline;
        player.stop ();        
        console.info('Releasing pipeline');
        pipeline.release();

        delete sessions[sessionId];
        delete candidatesQueue[sessionId];
    }
}

function onIceCandidate(sessionId, _candidate) {
    var candidate = kurento.register.complexTypes.IceCandidate(_candidate);

    if (sessions[sessionId]) {
        console.info('Sending candidate');
        var webRtcEndpoint = sessions[sessionId].webRtcEndpoint;
        webRtcEndpoint.addIceCandidate(candidate);
    }
    else {
        console.info('Queueing candidate');
        if (!candidatesQueue[sessionId]) {
            candidatesQueue[sessionId] = [];
        }
        candidatesQueue[sessionId].push(candidate);
    }
}

app.use(express.static(path.join(__dirname, 'static')));
