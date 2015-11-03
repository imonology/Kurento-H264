var fs = require("fs");
var net = require("net");

var HOST = "127.0.0.1";
var PORT = 50001;

var setup = function () {
	fs.writeFile("./1.ts", "binary");
}

var test = function (input) {
	setup();
	var tcp_sock = new net.Socket();
	tcp_sock.setEncoding("binary");

	tcp_sock.connect(PORT, HOST, function (ret) {
		console.log("connected to " + HOST + ":" + PORT);
	});

	tcp_sock.on("error", function (err) {
		console.log(err);
	});

	tcp_sock.on("timeout", function (err) {
		console.log(err);
	});

	tcp_sock.on("data", function (rcv) {
		fs.appendFile("./1.ts", rcv, "binary");
	});

}

test();
