var fs = require("fs");
var net = require("net");
var dgram = require("dgram");

// var udpclient = dgram.createSocket("udp4");
var HOST = "127.0.0.1";
var PORT = 52001;

var self = this;

var server = dgram.createSocket("udp4");

server.on('listening', function () {
	var address = server.address();
	console.log('UDP Server listening on ' + address.address + ":" + address.port);
});

server.on('message', function (message, remote) {
	// console.log(remote.address + ':' + remote.port +' - ' + message);
});

server.bind(PORT, HOST);

var test = function (input) {
	var onDone = function (response) {
		console.log("onDone");
		if (typeof(response) !== "undefined")
			console.log(response);
	}
	var onFail = function (response) {
		console.log("onFail");
		console.log(response);
	}
	var onNotify = function (response) {
		console.log("onNotify");
		console.log(response);
	}

	var onData = [
		function (response) {
			if (response.data.length > 0) {
				var message = new Buffer(response.data.length);
				message.write(response.data, 0, message.length, "binary");
				server.send(message, 0, message.length, PORT, HOST, function (err, bytes) {
					if (err) {
						console.log("bytes:");
						console.log(bytes);
						console.log("err:");
						console.log(err);
						// throw err;
					}
					console.log("UDP message send to " + HOST + ":" + PORT + " " + bytes);
				});
			}
		},
		function (response) {
		},
		function (response) {
		},
		function (response) {
		},
		function (response) {
		},
		function (response) {
		},
		function (response) {
		},
		function (response) {
		},
	];
	var stream = {
		"onDone": onDone,
		"onFail": onFail,
		"onData": onData,
		"dataport": 680,
	};

	var login = {
		"onDone": onDone,
		"onFail": onFail,
		"onNotify": onNotify,
		"user": "aa",
		"passwd": "11"
	};

	var connect = {
		"onDone": onDone,
		"onFail": onFail,
		"onNotify": onNotify,
		"streamIDs": [1,2,3,4,5,6,7,8],
		"host": "211.75.205.251",
		"port": 670
	};

	var connector = require("../dvr_connector_OO.js");
	this.dvr_connector = new connector();
	var this_test = this;

	login.onDone = function (response) {
		this_test.dvr_connector.strm(stream);
	}
	connect.onDone = function (response) {
		this_test.dvr_connector.login(login);
	}

	this.dvr_connector.init(connect);
}

test();
