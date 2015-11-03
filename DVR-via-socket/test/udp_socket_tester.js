var fs = require("fs");
var net = require("net");
var dgram = require("dgram");

var udpclient = dgram.createSocket("udp4");
var HOST = "127.0.0.1";
var PORT = 52001;

var self = this;

fs.writeFile("udp.mp4", "binary")

udpclient.on("message", function (message, remote) {
	// console.log(remote.address + ':' + remote.port +' - ' + message);
	fs.appendFile("udp.mp4", message, "binary");
});

udpclient.bind(PORT, HOST);

var msg = new Buffer("rr");

udpclient.send(msg, 0, 2, PORT, HOST, function (err, msglen) {
	if (err) {
		throw err;
	}
	console.log("udp msg sent.");
});
