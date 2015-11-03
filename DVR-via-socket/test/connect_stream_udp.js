var fs = require("fs");
var net = require("net");
var dgram = require("dgram");

var udpclient = dgram.createSocket("udp4");
var HOST = "193.147.51.49";
var PORT = 52000;

var self = this;

var server = net.createServer(function (c) {
	console.log("client connected");
	c.on("end", function () {
		console.log(server);
		console.log("client disconnected");
	});

	c.on("close", function (err) {
		console.log(err);
	});

	c.on("error", function (err) {
		console.log(err);
	});

	self.connected = c;
	console.log(c);
});

/**	XXX
	please modify this

		|	|
		v	v
*/

fs.writeFile("error.log", "utf-8");

server.listen(50001, "127.0.0.1", function() {
	console.log('server bound');
	console.log(server);
});

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
			var message = new Buffer(response.data.length);
			message.write(response.data, 0, message.length, "binary");
			if (typeof(self.connected) !== "undefined") {
				if (typeof(self.connected.writable)) {
					self.connected.write(message, "binary");
				} else {
					console.log("connecting RRRR QQ");
				}
			}
			try {
				udpclient.send(message, 0, message.length, PORT, HOST, function (err, bytes) {
					if (err) {
						console.log("bytes:");
						console.log(bytes);
						console.log("err:");
						console.log(err);
						// throw err;
					}
					console.log("UDP message send to " + HOST + ":" + PORT + " " + bytes);
				});
			} catch (err) {
				console.log(err);
				fs.appendFile("error.log", "err: ", "utf-8");
				fs.appendFile("error.log", err, "utf-8");
				fs.appendFile("error.log", ", response.data.length: ", "utf-8");
				fs.appendFile("error.log", response.data.length, "utf-8");
				fs.appendFile("error.log", ", message.length: ", "utf-8");
				fs.appendFile("error.log", message.length, "utf-8");
				fs.appendFile("error.log", ".\n", "utf-8");
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
