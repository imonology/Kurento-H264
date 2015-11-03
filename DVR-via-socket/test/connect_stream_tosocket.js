var fs = require("fs");
var net = require("net");

var self = this;

var server = net.createServer(function (c) {
	console.log("client connected");
	c.on("end", function () {
		console.log(server);
		console.log("client disconnected");
	});
	self.connected = c;
	console.log(c);
});

/**	XXX
	please modify this

		|	|
		v	v
*/
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
			if (typeof(self.connected) !== "undefined") {
				if (typeof(self.connected.writable)) {
					self.connected.write(response.data, "binary");
				} else {
					console.log("connecting RRRR QQ");
				}
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
