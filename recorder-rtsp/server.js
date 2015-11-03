var path = require('path');
var url = require('url');
var cookieParser = require('cookie-parser')
var express = require('express');
var session = require('express-session')
var minimist = require('minimist');
var ws = require('ws');
var kurento = require('kurento-client');

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
var kurentoClient = null;

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
    path : '/recorder_rtsp'
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
            start(sessionId, ws, function(error, sdpAnswer) {
                if (error) {
                    return ws.send(JSON.stringify({
                        id : 'error',
                        message : error
                    }));
                }
                ws.send(JSON.stringify({
                    id : 'startResponse'
                }));
            });
            break;

        case 'stop':
            stop(sessionId);
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

function start(sessionId, ws, callback) {
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

            createMediaElements(pipeline, ws, function(error, recorderEndpoint, playerEndpoint) {
                if (error) {
                    pipeline.release();
                    return callback(error);
                }

                connectMediaElements(recorderEndpoint, playerEndpoint, function(error) {
                    if (error) {
                        pipeline.release();
                        return callback(error);
                    }

                    sessions[sessionId] = {
                        'pipeline' : pipeline,
                        'recorderEndpoint' : recorderEndpoint,
                        'playerEndpoint': playerEndpoint
                    }
                    playerEndpoint.play (function(error) {
                        if (error) {
                            return callback(error);
                        }
                        recorderEndpoint.record (function(error) {
                            if (error) {
                                return callback(error);
                            }

                            return callback(null);
                        });
                    });
                });
            });
        });
    });
}

function createMediaElements(pipeline, ws, callback) {
    var options = {uri : "file:///tmp/rtspVideo.mp4", mediaProfile: 'MP4_VIDEO_ONLY'}
    pipeline.create('RecorderEndpoint', options, function(error, recorderEndpoint) {
        if (error) {
            return callback(error);
        }

        // we use 'useEncodedMedia' to avoid transconding in the input of the pipeline
        // On this way, playerendpoint push media in the same format that the feed
        // provides it instead of RAW format.
        var options = {uri : 'rtsp://163.22.32.118/live1.sdp', useEncodedMedia: true}

        pipeline.create('PlayerEndpoint', options, function(error, playerEndpoint) {
            if (error) {
                return callback(error);
            }

            return callback(null, recorderEndpoint, playerEndpoint);
        });
    });
}

function connectMediaElements(recorderEndpoint, playerEndpoint, callback) {

    playerEndpoint.connect(recorderEndpoint, 'VIDEO', function(error) {
        if (error) {
            return callback(error);
        }

        return callback(null);
    });
}

function stop(sessionId) {
    if (sessions[sessionId]) {
        var player = sessions[sessionId].playerEndpoint;
        var recorder = sessions[sessionId].recorderEndpoint;
        var pipeline = sessions[sessionId].pipeline;
        
        recorder.stop();
        player.stop ();        
        console.info('Releasing pipeline');
        pipeline.release();

        delete sessions[sessionId];
    }
}

app.use(express.static(path.join(__dirname, 'static')));
