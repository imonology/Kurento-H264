var net = require("net");
var spawn = require("child_process").spawn,
	exec = require("child_process").exec;

var dvr_cmd_hdr = require("./constants/dvr_cmd_hdr.js");
var dvr_mem_hdr = require("./constants/dvr_mem_hdr.js");
var dvr_addmem_hdr = require("./constants/dvr_addmem_hdr.js");

var dvr_get_mem = require("./control/dvr_get_mem.js");
var dvr_set_mem = require("./control/dvr_set_mem.js");

var dvr_get_addmem = require("./control/dvr_get_addmem.js");
var dvr_set_addmem = require("./control/dvr_set_addmem.js");

var dvr_cmd = require("./control/dvr_cmd.js");
var dvr_strm_hdr = require("./stream/dvr_strm_hdr.js");

/* IC method */
if (typeof(LOG) === "undefined") {
	console.log("dvr connector: LOG undefined");
	var LOG = {};
	if (typeof(LOG.warn) === "undefined") {
		LOG.warn = function (ret) {
			console.warn(ret);
		}
	}
	if (typeof(LOG.error) === "undefined") {
		LOG.error = function (ret) {
			console.error(ret);
		}
	}
	if (typeof(LOG.stack) == "undefined") {
		LOG.stack = function (ret) {
			console.trace();
		}
	}
}

/* create dvr_connector obj */
function dvr_connector(input) {
	LOG.warn("dvr connector: create dvr_connector");
	if (typeof(input) !== "undefined") {
		LOG.warn("dvr connector: create connector with input");
		LOG.warn(input);
		this.init(input); // thank you BlueT
	}
	this.reconnecting = 0;
	return this;
}


/* this method will create socket and connect to target,
 * if input contains username and password, it will send a login request to target */
dvr_connector.prototype.init = function (input) {
	var self = this;
	if (typeof(input.host) === "undefined"
	    || typeof(input.port) === "undefined"
	    || typeof(input.onDone) === "undefined"
	    || typeof(input.onFail) === "undefined"
	    || typeof(input.onNotify) === "undefined") {
		LOG.warn("dvr connector init: please check your input: {host, port, onDone, onFail, onNotify}");
		LOG.warn(input);
		// input.onFail("dvr connector init: please check your input: {host, port, onDone, onFail, onNotify}");
		return;
	}

	if (typeof(input.dataport) === "undefined") {
		LOG.warn("dvr connector init: dataport undefined");
	}

	if ((typeof(this.data) === "undefined") || (this.reconnecting != 0)) {
		this.data = input;
	} else {
		LOG.error("dvr connector init: connector already exists, L:72");
		input.onFail("connector already exists");
		return this;
	}

	if (typeof(input.onNotify) === "undefined") {
		LOG.warn("dvr connector init: onNotify undefined");
	} else {
		this.onNotify = input.onNotify; // should be stored
	}

	if (typeof(input.onData) === "undefined") {
		LOG.warn("dvr connector init: onData undefined");
	} else {
		this.onData = input.onData; // should be stored
	}

	if (typeof(input.streamIDs) === "undefined") {
		LOG.warn("dvr connector init: streamIDs undefined");
	} else {
		this.streamIDs = input.streamIDs;
	}

	if ((typeof(this.ctrl_port) !== "undefined") && (this.reconnecting == 0)) {
		LOG.warn({
			"warning": "connector already exists, L:92",
			"this.ctrl_port": this.ctrl_port
		});
		input.onDone({
			"warning": "connector already exist, L:96"
		});
		return;
	}


	this.ctrl_port = new net.Socket(); // create ctrl_port
	this.ctrl_port.setEncoding("binary");

/*
	if (this.ctrl_port.address() != null) { // never happened, I think :S
		LOG.warn({
			"warning": "address already in use",
			"address": this.ctrl_port.address()
		});
		input.onDone({
			"warning": "address already in use",
			"address": this.ctrl_port.address()
		});
		return;
	}
*/

	// create tcp socket and connect
	this.ctrl_port.connect(input.port, input.host, function (ret) {
		LOG.warn("connected to " + input.host + ":" + input.port);
		input.onDone(ret);
	});

	this.ctrl_port.on("error", function (err) {
		LOG.error(err);
		input.onFail(err);
	});

	this.ctrl_port.on("timeout", function (err) {
		LOG.error(err);
		input.onFail(err);
	});

	this.ctrl_port.on("end", function () {
		if (typeof(this.ctrl_port) !== "undefined") {
			if (typeof(this.ctrl_port.address) !== "undefined") {
				LOG.warn("ctrl port disconnected." + this.ctrl_port.address());
			}
		}
		clearInterval(self.keep_ctrl_port);
		LOG.warn("timer keep_ctrl_port killed.");
		if (typeof(self.ctrl_disconn) !== "undefined") {
			self.ctrl_disconn("ctrl port disconnected.");
		}
		// delete this.ctrl_port;
		// self.reconnect_ctrl_port();
	});

	// when tcp socket rcv data
	this.ctrl_port.on("data", function (data_rcv) {
		LOG.warn("dvr connector: rcv data from ctrl_port");
		if (typeof(self.cmd_response_broken) !== "undefined" && self.cmd_response_broken != {}) {
			if (self.cmd_response_broken.left == data_rcv.length) {
				var concat = self.cmd_response_broken.data + data_rcv;
				data_rcv = concat;
				self.cmd_response_broken.data = "";
				LOG.warn("dvr conncetor: defragment success, clean previous data fragment");
			}
		}

		var header = new Buffer(7); // ack, msgID, length
		header.write(data_rcv, 0, 7, 'binary');
		cmd = header.readUInt16LE(1);
		length = header.readUInt32LE(3) + 7; // header length 7

		if (length > data_rcv.length) {
			LOG.warn("dvr connector: data from ctrl_port were broken");
			LOG.warn("dvr connector: length in header: " + length + ", packet length: " + data_rcv.length);
			//if (self.cmd_response_broken. == "" || typeof(self.cmd_response_broken) === "undefined") {
			if (typeof(self.cmd_response_broken) === "undefined"
			    || (typeof(self.cmd_response_broken) !== "undefined" && self.cmd_response_broken.data == "")) {
				self.cmd_response_broken = {
					"data": data_rcv,
					"left": length - data_rcv.length
				};
				LOG.warn("dvr connector: keep and stolen this fragment");
				data_rcv = "";
			} else {
				self.cmd_response_broken = {};
				LOG.warn("dvr connector: back to original process");
			}
		}

		switch (cmd) {
		case dvr_cmd_hdr.VTS_ACK_LOGIN:
			self.login_response(data_rcv);
			break;

		case dvr_cmd_hdr.VTS_ACK_POLL_STATUS:
			self.poll_status_response(data_rcv);
			break;

		case dvr_cmd_hdr.VTS_ACK_GET_SYS_INFO:
			self.info_response(data_rcv);
			break;

		case dvr_cmd_hdr.VTS_ACK_STREAM_CONNECT:
			self.strm_response(data_rcv);
			break;

		case dvr_cmd_hdr.VTS_ACK_SET_LIVE_CHANNEL:
			self.set_live_channel_response(data_rcv);
			break;

		case dvr_cmd_hdr.VTS_ACK_SEND_PTZ_KEY:
			self.ptz_response(data_rcv);
			break;

		case dvr_cmd_hdr.VTS_ACK_STREAM_DISCONNECT:
			self.strm_disconn_response(data_rcv);
			break;

		case dvr_cmd_hdr.VTS_EVENT_NOTIFY:
			self.event_notify(data_rcv);
			break;

		case dvr_cmd_hdr.VTS_ACK_GET_SYS_TIME:
			self.get_sys_time_response(data_rcv);
			break;

		case dvr_cmd_hdr.VTS_ACK_SET_SYS_TIME:
			self.set_sys_time_response(data_rcv);
			break;

		case dvr_cmd_hdr.VTS_ACK_GET_SHARE_MEM:
			self.get_mem_info_response(data_rcv);
			break;

		case dvr_cmd_hdr.VTS_ACK_SET_SHARE_MEM:
			self.set_mem_info_response(data_rcv);
			break;

		case dvr_cmd_hdr.VTS_ACK_UPDATE_SHARE_MEM:
			self.update_mem_info_response(data_rcv);
			break;

		case dvr_cmd_hdr.VTS_ACK_GET_ADDITIONAL_SHARE_MEMS:
			self.get_addmem_info_response(data_rcv);
			break;

		case dvr_cmd_hdr.VTS_ACK_SET_ADDITIONAL_SHARE_MEMS:
			self.set_addmem_info_response(data_rcv);
			break;

		case dvr_cmd_hdr.VTS_ACK_UPDATE_ADDITIONAL_SHARE_MEMS:
			self.update_addmem_info_response(data_rcv);
			break;

		default:
			LOG.warn("dvr connector: unknow msg");
			LOG.warn(JSON.stringify(data_rcv));
			LOG.warn(data_rcv.length);
		}
	});

}

dvr_connector.prototype.login = function (input) {
// logging into DVR when TCP connection established
	var self = this;
//	console.trace();
	console.log("dvr_connector_OO.js: DVR LOGIN : input: ", input);
	
	var login = new dvr_cmd.VtLogin(input.user, input.passwd);
	this.data.user = input.user;
	this.data.passwd = input.passwd;

	LOG.warn("dvr connector: Logging into DVR ...");

	this.login_success = function (response) {
		LOG.warn("dvr connector: login_success callback");

		var poll_status_obj = {
			"ack": {
				"status": "Login succeeded.",
				"Level": response.Level,
				"NTSC": response.NTSC,
				"RES": response.RES,
				"Screens": [],
			},
			"onDone": input.onDone,
			"onFail": input.onFail,
			"poll_status_called": 1
		};

		var _poll_status = function (response) {
			self.poll_status(poll_status_obj);
		}

		var _cameras = function (response) {
			self.get_mem_info_cameras({"onDone": _poll_status, "onFail": console.log});
		}

		self.info({"onDone": _cameras, "onFail": console.log});
	}
	this.login_failed = input.onFail;
	try {
		this.ctrl_port.write(login.data); // send login to DVR
	} catch (err) {
		LOG.warn(err);
	}
}

dvr_connector.prototype.login_response = function (response) {
	console.log("dvr connector: login_response()");
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error("VTC_LOGIN failed");
		LOG.error(JSON.stringify(response));
		this.login_failed({"status": "Login failed."});
		try {
			this.ctrl_port.end();
		} catch (err) {
			LOG.warn(err);
		}
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		var ack_login = new dvr_cmd.VtAckLogin(response);
		LOG.error("VTC_LOGIN succeeded");
		this.login_success({
			"status": "Login succeeded.",
			"Level": ack_login.Level,
			"NTSC": ack_login.NTSC,
			"RES": ack_login.RES
		});
		this.keepalive();
		break;

	default:
		LOG.error("VTC_LOGIN exception: " + JSON.stringify(response[dvr_cmd_hdr.CMDID]));
	}
}

dvr_connector.prototype.keepalive = function () {
	this.poll = new dvr_cmd.VtPollStatus();
	var self = this;
	this.keep_ctrl_port = setInterval (function () {
		if (self.ctrl_port.writable) {
			self.ctrl_port.write(self.poll.data);
			// LOG.warn("typeof(self.ctrl_port): ");
			// LOG.warn(typeof(self.ctrl_port));
			// LOG.warn(self.ctrl_port);
			LOG.warn("keep-alive ... " + JSON.stringify(self.data));
		} else {
			LOG.error("self.ctrl_port.writable !== \"true\"");
		}
	}, 1000 * 20);
}

dvr_connector.prototype.poll_status = function (input) {
	var poll_status = new dvr_cmd.VtPollStatus();

	if (typeof(input.ack) == "undefined") {
		this.poll_status_ack = {
			"ack": {
				"Screens": [],
			},
			"onDone": input.onDone,
			"onFail": input.onFail,
			"poll_status_called": 0,
		};
	} else {
		this.poll_status_ack = input;
	}

	this.poll_status_ack.poll_status_called = 1;
	this.ctrl_port.write(poll_status.data);
}

dvr_connector.prototype.poll_status_response = function (response) {
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error("VTC_POLL_STATUS failed");
		if (typeof(this.login_failed) !== "undefined") {
			this.login_failed({"status": "Login failed."});
			try {
				this.ctrl_port.end();
			} catch (err) {
				LOG.warn(err);
			}
			break;
		}
		if (typeof(this.poll_status_ack) != "undefined") {
			if (this.poll_status_ack.poll_status_called) {
				this.poll_status_ack.poll_status_called = 0;
				this.poll_status_ack.onFail({"status": "VTC_POLL_STATUS failed"});
			}
		}
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		if (typeof(this.poll_status_ack) !== "undefined") {
			if (this.poll_status_ack.poll_status_called) {
				// var ack_poll_status = new dvr_cmd.VtAckPollStatus(response, 4); // FIXME: magic num 4, num of cameras
				var ack_poll_status = new dvr_cmd.VtAckPollStatus(response, this.data.NumOfCameras);
				LOG.warn("VTC_POLL_STATUS succeeded: " + JSON.stringify(ack_poll_status));

				this.poll_status_ack.ack.Screens = ack_poll_status.NumOfCameras;
				console.log("dvr connector, Settings->Installed:\t" + this.data.Installed);
				console.log("dvr connector, !Video Loss Channel:\t" + this.poll_status_ack.ack.Screens);
				for (var i = 0; i < this.data.NumOfCameras; i++) {
					this.poll_status_ack.ack.Screens[i] &= this.data.Installed[i];
				}

				this.poll_status_ack.poll_status_called = 0;
				this.poll_status_ack.onDone(this.poll_status_ack.ack);
			}
		}
		break;
	default:
		LOG.error("VTC_POLL_STATUS exception: " + JSON.stringify(response[dvr_cmd_hdr.CMDID]));
	}
}

dvr_connector.prototype.event_notify = function (response) {
	var notify = new dvr_cmd.VtEventNotify(response);
	var time = {
		"year": notify.year,
		"month": notify.mon,
		"day": notify.day,
		"hour": notify.hour,
		"minute": notify.min,
		"second": notify.sec
	};
	if (notify.alarm_changed_mask) {
		this.onNotify({
			"event": "alarm",
			"data": {
				"ch": [
					(notify.alarm_value % 2),
					((notify.alarm_value >> 1) % 2),
					((notify.alarm_value >> 2) % 2),
					((notify.alarm_value >> 3) % 2),
				],
				"time": time 
			}
		});
	}
	if (notify.vloss_changed_mask) {
		var vloss_bit = notify.vloss_value;
		var l_value = [];
		for (var i = 0; vloss_bit > 0; i++) {
			l_value[i] = vloss_bit % 2;
			vloss_bit = vloss_bit >> 1;
		}
		this.onNotify({
			"event": "videoloss",
			"data": {
				"value": l_value,
				"time": time
			}
		});
	}

	if (notify.motion_changed_mask) {
		this.onNotify({
			"event": "motion",
			"data": {
				"ch": [
					(notify.motion_changed_mask % 2),
					((notify.motion_changed_mask >> 1) % 2),
					((notify.motion_changed_mask >> 2) % 2),
					((notify.motion_changed_mask >> 3) % 2),
				],
				"value": notify.motion_value,
				"time": time
			}
		});
	}

	if (notify.hdds_fail_changed_mask) {
		this.onNotify({
			"event": "hdds_fail",
			"data": {
				"value": notify.hdds_fail_value,
				"time": time
			}
		});
	}
}

dvr_connector.prototype.info = function (input) {
	var get_system_info = new dvr_cmd.VtGetSystemInfo();
	this.get_system_info_ack = input.onDone;
	this.get_system_info_err = input.onFail;
	this.ctrl_port.write(get_system_info.data);
}

dvr_connector.prototype.info_response = function (response) {
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error("VTC_GET_SYS_INFO failed");
		this.get_system_info_err({"status": "Get system information failed."});
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		var ack_sys_info = new dvr_cmd.VtAckGetSystemInfo(response);
		LOG.warn("VTC_GET_SYS_INFO succeeded: " + JSON.stringify(ack_sys_info));
		this.data.Model = ack_sys_info.Model.split("\u0000")[0];
		this.data.Serial = ack_sys_info.Serial.split("\u0000")[0];
		this.data.HWVersion = ack_sys_info.HWVersion;
		this.data.SWVersion = ack_sys_info.SWVersion;
		this.data.NumOfCameras = ack_sys_info.NumOfCameras;
		this.data.NumOfAudios = ack_sys_info.NumOfAudios;
		this.data.NumOfAIs = ack_sys_info.NumOfAIs;
		this.data.NumOfAOs = ack_sys_info.NumOfAOs;
		this.data.NumOfEncoders = ack_sys_info.NumOfEncoders;
		this.data.NumOfDecoders = ack_sys_info.NumOfDecoders;
		this.data.TVSystem = ack_sys_info.TVSystem;

		if (typeof(this.poll_status_ack) === "undefined") {
			this.poll_status_ack = {};
			this.poll_status_ack.ack = {};
			this.poll_status_ack.ack.Screens = [];
		} else if (typeof(this.poll_status_ack.ack) === "undefined") {
			this.poll_status_ack.ack = {};
			this.poll_status_ack.ack.Screens = [];
		} else if (typeof(this.poll_status_ack.ack.Screens) == "undefined"){
			this.poll_status_ack.ack.Screens = [];
		}
		this.get_system_info_ack({
			"status": "Get system information succeeded.",
			"Model": ack_sys_info.Model.split("\u0000")[0],
			"Serial": ack_sys_info.Serial.split("\u0000")[0],
			"HWVersion": ack_sys_info.HWVersion,
			"SWVersion": ack_sys_info.SWVersion,
			"NumOfCameras": ack_sys_info.NumOfCameras,
			"NumOfAudios": ack_sys_info.NumOfAudios,
			"NumOfAIs": ack_sys_info.NumOfAIs,
			"NumOfAOs": ack_sys_info.NumOfAOs,
			"NumOfEncoders": ack_sys_info.NumOfEncoders,
			"NumOfDecoders": ack_sys_info.NumOfDecoders,
			"TVSystem": ack_sys_info.TVSystem,
			"Screens": this.poll_status_ack.ack.Screens
		});
		break;
	default:
		LOG.error("VTC_GET_SYS_INFO exception: " + JSON.stringify(response[dvr_cmd_hdr.CMDID]));
	}
}

dvr_connector.prototype.exit = function (input) {
	LOG.warn("disconnecting dvr connector");
	if (typeof(this.keep_ctrl_port) !== "undefined") {
		clearInterval(this.keep_ctrl_port);
	}
	if (typeof(this.ctrl_port) !== "undefined") {
		LOG.warn("ctrl_port !== \"undefined\"");
		this.ctrl_port.end();
//		this.ctrl_port.destroy();
		delete this.ctrl_port;
	}
	if (this.reconnecting == 0) {
		this.ctrl_disconn = input.onDone;
	} else {
		input.onDone();
	}
}



dvr_connector.prototype.ptz = function (input) {
	var ptz_cmd = new dvr_cmd.VtSendPtzKey(input.keyState, input.keyCode, input.ch, input.param);
	this.ptz_ack = input.onDone;
	this.ptz_err = input.onFail;
	this.ctrl_port.write(ptz_cmd.data);
}

dvr_connector.prototype.ptz_response = function (response) {
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error("VTC_SEND_PTZ_KEY failed");
		this.ptz_ack({"status": "PTZ failed."});
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		LOG.warn("VTC_SEND_PTZ_KEY succeeded");
		this.ptz_ack({"status": "PTZ succeeded."});
		break;
	default:
		LOG.error("VTC_SEND_PTZ_KEY exception: " + JSON.stringify(response[dvr_cmd_hdr.CMDID]));
	}
}

dvr_connector.prototype.set_live_channel = function (input) {
	var set_live_channel = new dvr_cmd.VtLiveChsParam(4, 2); // FIXME, 4, 0 ?!
	this.ctrl_port.write(set_live_channel.data);
}

dvr_connector.prototype.set_live_channel_response = function (response) {
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error("VTC_SET_LIVE_CHANNEL failed");
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		LOG.warn("VTC_SET_LIVE_CHANNEL succeeded");
		break;
	default:
		LOG.warn("VTC_SET_LIVE_CHANNEL exception: " + JSON.stringify(response[dvr_cmd_hdr.CMDID]))
	}
}

dvr_connector.prototype.set_x_v_strm = function (input) {
	var xvstrm = new dvr_cmd.VtSetExtraVStrm();
	this.ctrl_port.write(xvstrm.data);
//	input.onDone();
}

dvr_connector.prototype.strm = function (input) {
	var self = this;
/*	if (this.data_port.address() != null) {
		LOG.error({
			"error": "data_port already in use",
			"address": this.data_port.address()
		});
		input.onFail({
			"error": "data_port already in use",
			"address": this.data_port.address()
		});
		return;
	}
*/
	LOG.warn("dvr connector: strm()");
	if (typeof(input.onData) === "undefined") {
		input.onFail("input.onData undefined");
		return;
	} else {
		this.onData = input.onData;
	}

	if (typeof(input.dataport) !== "undefined") {
		// LOG.warn("got dataport %j", input);
		this.data.dataport = input.dataport;
	} else {
		LOG.warn("dataport err %j", input);
		input.onFail(input);
		return;
	}
	
	var xvstrm = new dvr_cmd.VtSetExtraVStrm();
	// LOG.warn(xvstrm);
	this.ctrl_port.write(xvstrm.data);

	var stream_connect = new dvr_cmd.VtStreamConnect();
	this.strm_ack = input.onDone;
	this.strm_err = input.onFail;
//	this.data_disconn = input.onFail;
	this.ctrl_port.write(stream_connect.data);
	this.data_port = new net.Socket();
	this.data_port.setEncoding("binary");

	this.left = 0;
	this.stream_send_num = 0;
	this.stream_ch_now = 0;

/*
	if (this.data_port.address() != null) {
		LOG.warn({
			"warning": "data_port already connected",
			"this.data_port": this.data_port
		});
		input.onDone({
			"warning": "data_port already connected"
		});
		return;
	}
*/

	this.data_port.connect(self.data.dataport, self.data.host, function () {
		LOG.warn("CONNECTED TO DATA PORT: " + self.data.host + ":" + self.data.dataport);
	});

/*	this.data_port.on("error", input.onFail);

	this.data_port.on("timeout", input.onFail);

	this.data_port.on("end", function () {
		LOG.warn("data port disconnected.");
		if (self.strm_err != null) {
			self.strm_err("data port disconnected.");
			self.strm({
				"onDone": function (data) {
					LOG.warn("data port reconnected");
				},
				"onFail": function (data) {
					LOG.warn(data);
				},
				"onData": self.onData,
				"dataport": self.data.dataport,
			});
		}
	});*/

	this.data_port.on("data", function (data) {
		self.data_keepalive();
/*		self.process_stream(data);
		return;
*/
		if (typeof(self.broken) !== "undefined" && self.broken != "") {
			// LOG.warn("dvr connector: streaming data defragment");
			var concat = self.broken + data;
			// var ff5656ff = data.indexOf("\xff\x56\x56\xff");
			// LOG.warn("indexof ff5656ff: " + ff5656ff);
			data = concat;
			self.broken = "";
			// pteeeld frame head, set self.stream_ch_now
			// onData this frame and start process

		}

		/*if (typeof(self.frame_head_broken) !== "undefined" && self.frame_head_broken != "") {
			LOG.warn("dvr connector: frame head defragment");
			LOG.warn("typeof frame_head: " + typeof(self.frame_head_broken) + ", " + self.frame_head_broken + ", " + self.frame_head_broken.length);
			LOG.warn("typeof data: " + typeof(data) + ", " + data + ", " + data.length);
			var concat2 = Buffer(self.frame_head_broken.length + data.length);
			concat2.write(self.frame_head_broken, 0, self.frame_head_broken.length, "binary");
			concat2.write(data, self.frame_head_broken.length, data.length, "binary");
			data = concat2.toString();
			var raw_packet = new Buffer(data.length);
			raw_packet.write(data, 0, raw_packet.length, "binary");

			self.frame_head_broken = "";
			var _pteeeld = data.indexOf("pteeeld");
			LOG.warn("frame head defragment, pteeeld: " + _pteeeld);
			if (_pteeeld != -1) {
				var frame_head = new dvr_strm_hdr.FrameHead(data.slice(pteeeld, data.length));
				LOG.warn(frame_head);
			}

			LOG.warn("frame_head.Length " + frame_head.Length + " Ch " + frame_head.Ch);
			if (typeof(frame_head) !== "undefined") {
				if (typeof(frame_head.Ch) !== "undefined") {
					self.stream_ch_now = frame_head.Ch; // XXX, pes ch
				}
			}

			if ((raw_packet.length - pteeeld) > 123) {
			}

			process.exit(1);
		}*/
		if (typeof(raw_packet) === "undefined") {
			var raw_packet = new Buffer(data.length);
		}

		raw_packet.write(data, 0, raw_packet.length, "binary");

		var shift = self.left;

		var diff = (shift) ? (self.left - raw_packet.length) : 0; // fragment data left

//		LOG.warn("RRRRRRRRcv data, raw_packet.length: " + raw_packet.length + " self.left: " + self.left + " diff: " + diff);

		if (data.length < 4) { // fragment data
			// onData;
//			LOG.warn("data.length < 4, onData length :" + data.length + " L:618");
			if (typeof(self.onData[self.stream_ch_now]) === "undefined") {
				// LOG.error("onData[" + self.stream_ch_now + "] undefined");
			} else {
				self.onData[self.stream_ch_now]({
					"data": data,
					"encode": "binary",
					"ch": self.stream_ch_now,
					"streamID": self.streamIDs[self.stream_ch_now],
					"host": self.data.host,
					"port": self.data.dataport
				});
			}

			self.left -= raw_packet.length;
//			LOG.warn("== Next ==\n\n");
			return;
		}

		if (raw_packet.readUInt32LE(0) == 4283848447) { // 0xff5656ff, std pkt header
			if (data.length < 28) {
//				LOG.warn("start from ff5656ff, data.length < 28, dvr connector: broken packet");
				self.broken = data;
				return;
			}
			var strm_pkt_data = new dvr_strm_hdr.StrmPktData(data);
//			LOG.warn("start from 0xff5656ff, strm_pkt_data.Length " + strm_pkt_data.Length + " strm_pkt_data.SendNo " + strm_pkt_data.SendNo);
			if ((strm_pkt_data.SendNo - self.stream_send_num) > 1000) {
				LOG.error("dvr connector: SendNo sequence error, " + (strm_pkt_data.SendNo - self.stream_send_num));
				strm_pkt_data.SendNo = self.stream_send_num + 1;
				self.stream_send_num = strm_pkt_data.SendNo;
			} else {
				self.stream_send_num = strm_pkt_data.SendNo;
			}
			var data_ack = new dvr_cmd.VtDataAck(strm_pkt_data.SendNo, strm_pkt_data.tp);
			self.ctrl_port.write(data_ack.data); // ack this header

			self.left = strm_pkt_data.Length; // fragment size

			if (raw_packet.length > 28) { // not only header in this packet
				diff = self.left - (raw_packet.length - 28); // fragment data size
				shift = 28 + self.left; // shift header and data length;
				self.left = diff;
				if (diff >= 0 && diff < 120) { // next fragment needed
//					LOG.warn("0 <= diff < 120: " + diff + ", == Next ==\n\n");
					// onData
					self.find_frame_channel(data.slice(28, data.length));
//					LOG.warn("onData length :" + (data.length - 28) + " L:659");
					if (typeof(self.onData[self.stream_ch_now]) === "undefined") {
						// LOG.error("onData[" + self.stream_ch_now + "] undefined");
					} else {
						self.onData[self.stream_ch_now]({
							"data": data.slice(28, data.length), // skip header
							"encode": "binary",
							"ch": self.stream_ch_now,
							"streamID": self.streamIDs[self.stream_ch_now],
							"host": self.data.host,
							"port": self.data.dataport
						});
					}
					return;
				}
				if (raw_packet.length > 119) {
//					LOG.warn("length > 119, strm_pkt_head.frame_head.Length " + strm_pkt_data.frame_head.Length + " Ch " + strm_pkt_data.frame_head.Ch);
					if (typeof(strm_pkt_data) !== "undefined") {
						if (typeof(strm_pkt_data.frame_head) !== "undefined") {
							if (typeof(strm_pkt_data.frame_head.Ch) !== "undefined") {
								self.stream_ch_now = strm_pkt_data.frame_head.Ch; // XXX, pes ch
							}
						}
					}
				}
				if (raw_packet.length > 151) {
//					LOG.warn("length > 151, strm_pkt_head.pes_head.strm_id " + strm_pkt_data.pes_head.strm_id + " prefix " + JSON.stringify(strm_pkt_data.pes_head.prefix) + " length " + strm_pkt_data.pes_head.Length);
				}
				if (diff >= 0) { // next packet
//					LOG.warn("onData length :" + (data.length - 28) + " L:727");
					if (typeof(self.onData[self.stream_ch_now]) === "undefined") {
						// LOG.error("onData[" + self.stream_ch_now + "] undefined");
					} else {
						self.onData[self.stream_ch_now]({
							"data": data.slice(28, data.length), // skip header
							"encode": "binary",
							"ch": self.stream_ch_now,
							"streamID": self.streamIDs[self.stream_ch_now],
							"host": self.data.host,
							"port": self.data.dataport
						});
					}
//					LOG.warn("== Next ==\n");
					return;
				} else {
//					LOG.warn("onData length :" + (shift - 28) + " L:741");
					if (typeof(self.onData[self.stream_ch_now]) === "undefined") {
						// LOG.error("onData[" + self.stream_ch_now + "] undefined");
					} else {
						self.onData[self.stream_ch_now]({
							"data": data.slice(28, shift), // skip header
							"encode": "binary",
							"ch": self.stream_ch_now,
							"streamID": self.streamIDs[self.stream_ch_now],
							"host": self.data.host,
							"port": self.data.dataport
						});
					}
				}
				// return;
			}

		} else if (diff >= 0) { // not finished
			self.left = diff;
			var pteeeld = data.indexOf("pteeeld");
			
			if (pteeeld != -1) {
//				LOG.warn("pteeeld: " + pteeeld);
				if (data.length - pteeeld < 11) {
					/*console.log(data.length);
					console.log(pteeeld);
					console.log(self.left);
					self.frame_head_broken = data.slice(pteeeld, data.length);
					self.left += (data.length - pteeeld);
					*/
					// self.left += (data.length - pteeeld);
					return;
				}

				var frame_head = new dvr_strm_hdr.FrameHead(data.slice(pteeeld, data.length));
				if ((raw_packet.length - pteeeld) > 91) {
//					LOG.warn("frame_head.Length " + frame_head.Length + " Ch " + frame_head.Ch);
					if (typeof(frame_head) !== "undefined") {
						if (typeof(frame_head.Ch) !== "undefined") {
							self.stream_ch_now = frame_head.Ch; // XXX, pes ch
						}
					}
				}
				if ((raw_packet.length - pteeeld) > 123) {
//					LOG.warn("frame_head.pes_head.strm_id " + frame_head.pes_head.strm_id + " prefix " + JSON.stringify(frame_head.pes_head.prefix) + " length " + frame_head.pes_head.Length);
				}
			} else {
				// notfound
				// LOG.warn("frame_head not found");
			}

//			LOG.warn("onData length :" + data.length + " L:712");
			if (typeof(self.onData[self.stream_ch_now]) === "undefined") {
				// LOG.error("onData[" + self.stream_ch_now + "] undefined");
			} else {
				self.onData[self.stream_ch_now]({
					"data": data,
					"encode": "binary",
					"ch": self.stream_ch_now,
					"streamID": self.streamIDs[self.stream_ch_now],
					"host": self.data.host,
					"port": self.data.dataport
				});
			}
//			LOG.warn("diff >= 0, == Next ==\n\n");
			return;
			// onData

		}
		if (diff < 0 && diff > -28) { // header broken, what the fuuuuuuuuuuuuuuuu /_>\
//			LOG.warn("diff: " + diff + " data " + JSON.stringify(raw_packet));
			self.broken = data.slice(data.length + diff, data.length);
			self.left -= diff;
			return;
		}
		while (diff < -27) { // data is finished and got next header in same packet
			// onData
			/*if (diff < -151) {
				LOG.warn("< -151");
				var strm_pkt_head = new dvr_strm_hdr.StrmPktData(data.slice(shift, (shift + 152)));
			} else if (diff < -119) {
				LOG.warn("< -119");
				var strm_pkt_head = new dvr_strm_hdr.StrmPktData(data.slice(shift, (shift + 120)));
			} else {
				LOG.warn("< -27");
				var strm_pkt_head = new dvr_strm_hdr.StrmPktData(data.slice(shift, (shift + 28)));
			}*/
			if ((data.length - shift) < 28) {
//				LOG.warn("dvr connector: broken packet header");
				self.broken = data.slice(shift, data.length);
				return;
			}

			if (typeof(strm_pkt_data) === "undefined") {
				if (typeof(strm_pkt_head) === "undefined") {
					// self.process_frame(data.slice(0, shift));
					self.find_frame_channel(data.slice(0, shift));
					// self.find_frame_channel(data.slice((shift + 28), data.length));
//					LOG.warn("onData length: " + self.stream_frame_length);
//					LOG.warn("onData length: " + shift + " L:752");
					if (typeof(self.onData[self.stream_ch_now]) === "undefined") {
						// LOG.error("onData[" + self.stream_ch_now + "] undefined");
					} else {
						self.onData[self.stream_ch_now]({
							"data": data.slice(0, shift), // write data left in packet
							// "data": data.slice((shift + 28), (shift + this.stream_frame_length + 28)),
							"encode": "binary",
							"ch": self.stream_ch_now,
							"streamID": self.streamIDs[self.stream_ch_now],
							"host": self.data.host,
							"port": self.data.dataport
						});
					}
				}
			}
			var strm_pkt_head = new dvr_strm_hdr.StrmPktData(data.slice(shift, data.length));

//			LOG.warn("data.indexOf(pteeeld): " + data.slice(shift, data.length).indexOf("pteeeld"));
			if (strm_pkt_head.StartCode != 4283848447) { // FIXME: something wrong here
				LOG.error("!!!!!!!!!!!!!!!!!!!!ERR: slicing failed!!!!!!!!!!!!!!!!!!!");
				LOG.error("shift: " + shift + ", data.length: " + data.length);
				LOG.error(data.indexOf("\xff\x56\x56\xff"));
				LOG.error(data.slice(1, data.length).indexOf("\xff\x56\x56\xff"));
				var pteeeld = data.slice(shift, data.length).indexOf("pteeeld");
				var ff = data.slice(shift, data.length).indexOf("\xff\x56\x56\xff");
//				LOG.warn("ERR: slicing failed");
				if ((data.length - (shift + ff)) < 28) {
//					LOG.warn("dvr connector: broken header");
					self.broken = data.slice((shift + ff), data.length);
					return;
				}
				strm_pkt_head = new dvr_strm_hdr.StrmPktData(data.slice((shift + ff), data.length));
//				LOG.warn("trying to fix this error... index: " + pteeeld + " shift " + shift + " ff " + ff);
				if ((ff != -1) && strm_pkt_head.StartCode != 4283848447) { // FIXME: something wrong here
					LOG.error("!!!!!!!!!!!!!!!!!!!!ERR: slicing failed again QAQ!!!!!!!!!!!!!!!!!!!, next");
					/*self.onData({
						"data": data.slice(shift, data.length), // ack left data in packet
						"encode": "binary",
						"ch": self.stream_ch_now
					});*/
					return;
				} else if (ff == -1) {
					LOG.error("frame head not found, raw_packet size: " + raw_packet.length + " next");
//					LOG.warn("onData length :" + (data.length - shift) + " L:788");
					if (typeof(self.onData[self.stream_ch_now]) === "undefined") {
						// LOG.error("onData[" + self.stream_ch_now + "] undefined");
					} else {
						self.onData[self.stream_ch_now]({
							"data": data.slice(shift, data.length), // write data left in packet
							"encode": "binary",
							"ch": self.stream_ch_now,
							"streamID": self.streamIDs[self.stream_ch_now],
							"host": self.data.host,
							"port": self.data.dataport
						});
					}
					return;
				} else {
//					LOG.warn("Problem solved");
					if ((strm_pkt_head.SendNo - self.stream_send_num) > 1000) {
						LOG.error("dvr connector: SendNo sequence error, " + (strm_pkt_head.SendNo - self.stream_send_num));
						strm_pkt_head.SendNo = self.stream_send_num + 1;
						self.stream_send_num = strm_pkt_head.SendNo;
					} else {
						self.stream_send_num = strm_pkt_head.SendNo;
					}
					var data_ack = new dvr_cmd.VtDataAck(strm_pkt_head.SendNo, strm_pkt_head.tp);
				}
				// LOG.warn("== Next ==\n\n");
				// return;
			} else {
				if ((strm_pkt_head.SendNo - self.stream_send_num) > 1000) {
					LOG.error("dvr connector: SendNo sequence error, " + (strm_pkt_head.SendNo - self.stream_send_num));
					strm_pkt_head.SendNo = self.stream_send_num + 1;
					self.stream_send_num = strm_pkt_head.SendNo;
				} else {
					self.stream_send_num = strm_pkt_head.SendNo;
				}
				var data_ack = new dvr_cmd.VtDataAck(strm_pkt_head.SendNo, strm_pkt_head.tp);
			}

//			LOG.warn("strm_pkt_head.StartCode (should be 4283848447)" + strm_pkt_head.StartCode);
//			LOG.warn("strm_pkt_head.Length " + strm_pkt_head.Length + " strm_pkt_head.SendNo " + strm_pkt_head.SendNo);

			if ((raw_packet.length - shift) > 119) {
//				LOG.warn("strm_pkt_head.frame_head.Length " + strm_pkt_head.frame_head.Length + " Ch " + strm_pkt_head.frame_head.Ch);
				if (typeof(strm_pkt_head) !== "undefined") {
					if (typeof(strm_pkt_head.frame_head) !== "undefined") {
						if (typeof(strm_pkt_head.frame_head.Ch) !== "undefined") {
							self.stream_ch_now = strm_pkt_head.frame_head.Ch; // XXX
						}
					}
				}
			} else {
/*				// frame head broken
				LOG.warn("(raw_packet.length - shift) <= 119");
				self.broken = data.slice(shift + 28, data.length);
				self.left += data.length - (shift + 28);
				if ((raw_packet.length - shift) != 0)
					self.exit({"onDone": console.log, "onFail": console.log});
				return;*/
			}
			if ((raw_packet.length - shift) > 151) {
//				LOG.warn("strm_pkt_head.pes_head.strm_id " + strm_pkt_head.pes_head.strm_id + " prefix " + JSON.stringify(strm_pkt_head.pes_head.prefix) + " length " + strm_pkt_head.pes_head.Length);
			}

			self.ctrl_port.write(data_ack.data); // ack this data packet

			if ((strm_pkt_head.Length) > (raw_packet.length - shift - 28)) { // next packet needed
				// frame head might broken here
				self.left = strm_pkt_head.Length - (raw_packet.length - shift - 28);
//				LOG.warn("diff: " + diff + " shift: " + shift);
//				LOG.warn("self.left: " + self.left + ", next");

//				LOG.warn("onData length :" + (data.length - shift - 28) + " L:837");
				if (((data.length - (shift + 28)) < 12) && ((data.length - (shift + 28)) != 0)) {
					// LOG.warn("QQQQQQQQQQQQQdata.length - (shift + 28): " + (data.length - (shift + 28)));
					// self.strm_disconn({"onDone": console.log, "onError": console.log});
					self.find_frame_channel(data.slice(shift + 28, data.length));
					// self.exit({"onDone": console.log, "onFail": console.log});
					// process.exit(1);
					self.broken = data.slice(shift + 28, data.length);
					self.left += data.length - (shift + 28);
					return;
				}

				self.find_frame_channel(data.slice(shift + 28, data.length));

//				LOG.warn("onData length :" + (data.length - shift - 28) + " L:837");
				if (typeof(self.onData[self.stream_ch_now]) === "undefined") {
					// LOG.error("onData[" + self.stream_ch_now + "] undefined");
				} else {
					self.onData[self.stream_ch_now]({
						"data": data.slice(shift + 28, data.length), // skip header
						"encode": "binary",
						"ch": self.stream_ch_now,
						"streamID": self.streamIDs[self.stream_ch_now],
						"host": self.data.host,
						"port": self.data.dataport
					});
				}
				return;
			} else {
//				LOG.warn("onData length :" + strm_pkt_head.Length + " L:946");
				if (typeof(self.onData[self.stream_ch_now]) === "undefined") {
					// LOG.error("onData[" + self.stream_ch_now + "] undefined");
				} else {
					self.onData[self.stream_ch_now]({
						"data": data.slice(shift + 28, (shift + 28 + strm_pkt_head.Length)), // skip header
						"encode": "binary",
						"ch": self.stream_ch_now,
						"streamID": self.streamIDs[self.stream_ch_now],
						"host": self.data.host,
						"port": self.data.dataport
					});
				}
				shift += (28 + strm_pkt_head.Length);
				self.left = 0;

				if (shift == raw_packet.length) { // data ends
//					LOG.warn("== Next ==\n\n");
					return;
				}
			}
//			LOG.warn("diff: " + diff + " shift: " + shift);
//			LOG.warn("self.left: " + self.left);
//			LOG.warn("Next, diff < -27");
		}
	});

	this.data_port.on("error", function (err) {
		LOG.error(err);
		input.onFail(err);
	});

	this.data_port.on("timeout", function (err) {
		LOG.error(err);
		input.onFail(err);
	});

}

dvr_connector.prototype.strm_response = function (response) {
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error("VTC_STREAM_CONNECT failed");
		var err = new Buffer(response.length);
		err.write(response, 0, err.length, 'binary');
		for (var i = 0; i < response.length; i++) {
			LOG.error(err.readUInt8(i));
		}
		this.strm_err({"status": "VTC_STREAM_CONNECT failed"});
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		LOG.warn("VTC_STREAM_CONNECT succeeded");
		this.set_live_channel(); // FIXME, call onDone after set channel
		this.strm_ack({"status": "VTC_STREAM_CONNECT succeeded"});
		break;
	default:
		LOG.error("VTC_STREAM_CONNECT exception: " + JSON.stringify(response[dvr_cmd_hdr.CMDID]));
		this.strm_err({"status": "VTC_STREAM_CONNECT exception"});
	}
}


/*
dvr_connector.prototype.process_stream = function (data) {
}
*/

dvr_connector.prototype.find_frame_channel = function (data) {
	// LOG.warn("find_frame_channel");
	var pteeeld = data.indexOf("pteeeld"); // frameID
	if (pteeeld == -1) {
		// LOG.warn("frame_head not found");
		return;
	}
	if (data.length - pteeeld < 11) {
		/*console.log(data.length);
		console.log(pteeeld);
		console.log(this.left);
		this.frame_head_broken = data.slice(pteeeld, data.length);*/
		// this.left += (data.length - pteeeld);
		return;
	}
	var frame_head = new dvr_strm_hdr.FrameHead(data.slice(pteeeld, data.length));
	// LOG.warn("strm_pkt_head.frame_head.Length " + frame_head.Length + " Ch " + frame_head.Ch);
	if (typeof(frame_head) !== "undefined") {
		if (typeof(frame_head.Ch) !== "undefined") {
			this.stream_ch_now = frame_head.Ch; // XXX, pes ch
		}
	}
	if (data.length >= frame_head.Length) {
		this.stream_frame_length = frame_head.Length;
	} else {
		this.stream_frame_length = data.length;
	}
}

/*
dvr_connector.prototype.process_stream_head = function (data) {
	var ff5656ff = data.indexOf("\xff\x56\x56\xff");
	LOG.warn("dvr connector: data.length " + data.length);
	if (ff5656ff == -1) { // start code not found, try to find frame head
		this.process_frame(data);
		return;
	} else if ((ff5656ff + dvr_strm_hdr.StrmPktHead_length) < data.length) {
		// not a complete stream packet header
		LOG.error("stream packet header broken");
		if (ff5656ff > 0) {
			LOG.warn("dvr connector: this.stream_ch_now " + this.stream_ch_now);
			this.onData({
				"data": data.slice(0, ff5656ff),
				"encode": "binary",
				"ch": this.stream_ch_now
			});
		}
		this.strm_packet_broken = data.slice(ff5656ff, data.length);
		return;
	} else {
		var ff5656ff_end = ff5656ff + dvr_strm_hdr.StrmPktHead_length;
		var strm_packet_head = new dvr_strm_hdr.StrmPktData(data.slice(ff5656ff, ff5656ff_end));

		if ((strm_packet_head.SendNo - this.stream_send_num) > 1000) {
			LOG.error("dvr connector: SendNo sequence error, " + (strm_packet_head.SendNo - this.stream_send_num));
			strm_packet_head.SendNo = this.stream_send_num + 1;
			this.stream_send_num += 1;
		} else {
			this.stream_send_num = strm_packet_head.SendNo;
		}

		LOG.warn("dvr connector: stream SendNo " + strm_packet_head.SendNo);
		var data_ack = new dvr_cmd.VtDataAck(strm_packet_head.SendNo, strm_packet_head.tp);
		this.ctrl_port.write(data_ack.data); // ack this header

		this.process_frame(data.slice(ff5656ff_end, data.length));

		if (ff5656ff_end == data.length) {
			return;
		}
	}
}
*/

dvr_connector.prototype.process_frame = function (data) {
	var pteeeld = data.indexOf("pteeeld"); // frameID

	if (pteeeld == -1) { // frameID not found
		LOG.warn("dvr connector: this.stream_ch_now " + this.stream_ch_now);
		this.onData({
			"data": data,
			"encode": "binary",
			"ch": this.stream_ch_now
		});
		return;

	} else if ((pteeeld + dvr_strm_hdr.FrameHead_length) < data.length) {
	// not a complete frame header, put data in onData() next time
		LOG.error("frame header broken");
		this.frame_header_broken = data.slice(pteeeld, data.length);
		return;
	} else { // frame header found
		var frame_head_end = pteeeld + dvr_strm_hdr.FrameHead_length;
		var frame_head = new dvr_strm_hdr.FrameHead(data.slice(pteeeld, frame_head_end));
		this.stream_ch_now = frame_head.Ch; // XXX, pes ch
		data = data.slice(frame_head_end, data.length);
		var ff5656ff = data.indexOf("\xff\x56\x56\xff");
		if (ff5656ff != -1) {
			LOG.warn("dvr connector: this.stream_ch_now " + this.stream_ch_now + " " + frame_head.Ch);
			this.onData({
				"data": data.slice(pteeeld, ff5656ff),
				"encode": "binary",
				"ch": this.stream_ch_now
			});
			this.process_stream_head(data.slice(ff5656ff, data.length));
		} else {
			LOG.warn("dvr connector: this.stream_ch_now " + this.stream_ch_now + " " + frame_head.Ch);
			this.onData({
				"data": data.slice(pteeeld, data.length),
				"encode": "binary",
				"ch": this.stream_ch_now
			});
		}
//		this.process_stream(data);
	}
}

/*
dvr_connector.prototype.process_stream = function (data_rcv) {
	// var concat = this_connector.broken + data_rcv;
	var data = data_rcv;
	this.frame_header_broken = "";
	this.strm_packet_broken = "";

	if (this.frame_header_broken !== "") {
		data = frame_header_broken + data;
		frame_header_broken = "";
	}
	if (this.strm_packet_broken !== "") {
		data = strm_packet_broken + data;
		strm_packet_broken = "";
	}
	data = this.process_stream_head(data);
}
*/

dvr_connector.prototype.strm_disconn = function (input) {
	LOG.warn("dvr connector: strm_disconn()");
	var stream_disconnect = new dvr_cmd.VtStreamDisconnect();
	clearInterval(this.keep_data_port);
	LOG.warn("timer keep_data_port killed");
	if (this.reconnecting == 0) {
		this.data_disconn = input.onDone;
		this.ctrl_port.write(stream_disconnect.data);
	}
	if (typeof(this.data_port) !== "undefined") {
		this.data_port.end();
		this.data_port.destroy();
		delete this.data_port;
	}
	if (this.reconnecting == 1) {
		input.onDone("bye bye old strm");
	}
	// console.log(this.data_port);
}

dvr_connector.prototype.strm_disconn_response = function (response) {
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error("VTC_STREAM_DISCONNECT failed");
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		LOG.warn("VTC_STREAM_DISCONNECT succeeded");
		if (typeof(this.data_disconn) !== "undefined") {
			this.data_disconn("VTC_STREAM_DISCONNECT succeeded");
		}
		break;
	default:
		LOG.warn("VTC_STREAM_DISCONNECT exception: " + JSON.stringify(response[dvr_cmd_hdr.CMDID]))
	}
}

// FIXME, reconnect ctrl port
dvr_connector.prototype.data_keepalive = function () {
	var self = this;
	if (typeof(this.keep_data_port) !== "undefined" || typeof(this.keep_data_port) !== {}) {
		clearInterval(this.keep_data_port);
		delete this.keep_data_port;
	}
	this.keep_data_port = setInterval(function () {
		self.reconnect_strm();
		self.onNotify({
			"event": "dvr connector: stream connection lost, reconnecting ...",
			"data": {
				// time
			}
		});
	}, 5000);
}

dvr_connector.prototype.reconnect_strm = function (input) {
	var self = this;
	this.reconnecting = 1;
	LOG.warn("\n\n\ndvr connector: reconnect_strm()");
	var onDone = function (ret) {
		LOG.warn("dvr connector: stream socket reconnected");
		this.reconnecting = 0;
	}
	var onFail = function (ret) {
		LOG.error("dvr connector: reconnect to stream socket failed");
	}

	var reconn_strm = {
		"dataport": this.data.dataport,
		"streamIDs": this.streamIDs,
		"onData": this.onData,
		"onDone": onDone,
		"onFail": onFail
	};

	var login = {
		"user": this.data.user,
		"passwd": this.data.passwd,
		"onDone": function (response) {
			LOG.warn("reconnect: login onDone, call strm");
			LOG.warn(reconn_strm);
			self.strm(reconn_strm);
		},
		"onFail": onFail
	}

	var init = {
		"host": this.data.host,
		"port": this.data.port,
		"onDone": function (response) {
			LOG.stack();
			LOG.warn("reconnect: init onDone, call login.");
			self.login(login);
		},
		"onFail": onFail,
		"onNotify": this.onNotify
	};

	var reconn_ctrl_port = {
		"onDone": function (response) {
			if (typeof(self.ctrl_port) !== "undefined" || typeof(self.ctrl_port) !== {}) {
				LOG.warn("reconnect: exit onDone, call init.");
				LOG.warn(self.ctrl_port);
				delete self.ctrl_port;
			}
			self.init(init);
		},
		"onFail": onFail
	};

	var disconn = {
		"onDone": function (response) {
			LOG.warn("reconnect: strm_disconn onDone, call exit.");
			self.exit(reconn_ctrl_port);
		},
		"onFail": onFail
	}

//	var reconn_strm = {"onDone": onDone, "onFail": onFail};

	// var stream_connect = new dvr_cmd.VtStreamConnect();
	this.reconnect_stream_ack = onDone;
	this.reconnect_stream_err = onFail;
	if (typeof(this.keep_data_port) !== "undefined" || typeof(this.keep_data_port) !== {}) {
		clearInterval(this.keep_data_port);
	}
	this.strm_disconn(disconn);
}

dvr_connector.prototype.get_log = function (input) {
	var log = new dvr_cmd.VtGetLog();
	this.get_log_ack = input.onDone;
	this.get_log_err = input.onFail;
	this.ctrl_port.write(log.data);
}

dvr_connector.prototype.get_log_response = function (response) {
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error('VTS_ACK_GET_LOG failed');
		this.get_log_err({"status": "GETLOG failed."});
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		LOG.warn('VTS_ACK_GET_LOG succeeded');
		console.log(response.length);
		for (var i = 0; i < response.length; i++) {
			console.log(i + ":" + JSON.stringify(response[i]));
		}
		var log = new dvr_cmd.VtAckGetLog(response);
		if (log.isEvent) {
			this.get_log_ack({
				"status": "GETLOG succeeded.",
				"isEvent": log.isEvent,
				"readNumber": log.readNumber,
				"logListData": log.logListData,
			});
		} else {
			this.get_log_ack({
				"status": "GETLOG succeeded.",
				"isEvent": log.isEvent,
				"readNumber": log.readNumber,
				"sysLog": log.sysLog,
			});
		}
		break;
	default:
		LOG.error('VTS_ACK_GET_LOG exception: ' + JSON.stringify(response));
	}
}

dvr_connector.prototype.get_sys_time = function (input) {
	var time = new dvr_cmd.VtGetSysTime();
	this.get_sys_time_ack = input.onDone;
	this.get_sys_time_err = input.onFail;
	this.ctrl_port.write(time.data);
}

dvr_connector.prototype.get_sys_time_response = function (response) {
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error('VTS_ACK_GET_SYS_TIME failed');
		this.get_sys_time_err({"status": "GETSYSTIME failed."});
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		LOG.warn('VTS_ACK_GET_SYS_TIME succeeded');
		console.log(response.length);
		console.log(JSON.stringify(response));
		var time = new dvr_cmd.VtAckGetSysTime(response);
		this.get_sys_time_ack({
			"status": "GETSYSTIME succeeded.",
			"my_tm": time
		});
		break;
	default:
		LOG.error('VTS_ACK_GET_SYS_TIME exception: ' + JSON.stringify(response));
	}
}

dvr_connector.prototype.set_sys_time = function (input) {
	var time = new dvr_cmd.VtSetSysTime(input.data);
	this.set_sys_time_ack = input.onDone;
	this.set_sys_time_err = input.onFail;
	this.ctrl_port.write(time.data);
}

dvr_connector.prototype.set_sys_time_response = function (response) {
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error('VTS_ACK_SET_SYS_TIME failed');
		this.set_sys_time_err({"status": "SETSYSTIME failed."});
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		LOG.warn('VTS_ACK_SET_SYS_TIME succeeded');
		console.log(response.length);
		console.log(JSON.stringify(response));
		this.set_sys_time_ack({
			"status": "SETSYSTIME succeeded.",
		});
		break;
	default:
		LOG.error('VTS_ACK_SET_SYS_TIME exception: ' + JSON.stringify(response));
	}
}

dvr_connector.prototype.get_mem_info_hddfull = function (input) {
	var hddfull = new dvr_get_mem.VtGetShareMem(dvr_mem_hdr.HDD_FULL_ACT);
	this.share_mem_ack = input.onDone;
	this.share_mem_err = input.onFail;
	while(1) {
		if (this.share_mem_ack_hddfull == 1 || this.share_mem_ack_alarmhdd == 1) {
			continue;
		} else {
			this.share_mem_ack_hddfull = 1;
			this.ctrl_port.write(hddfull.data);
			break;
		}
	}
}

dvr_connector.prototype.get_mem_info_alarmhdd = function (input) {
	var alarmhdd = new dvr_get_mem.VtGetShareMem(dvr_mem_hdr.ALARM_HDD_FULL_ACT);
	this.share_mem_ack = input.onDone;
	this.share_mem_err = input.onFail;
	while(1) {
		if (this.share_mem_ack_hddfull == 1 || this.share_mem_ack_alarmhdd == 1) {
			continue;
		} else {
			this.share_mem_ack_alarmhdd = 1;
			this.ctrl_port.write(alarmhdd.data);
			break;
		}
	}
}

dvr_connector.prototype.get_mem_info_aux_ftp = function (input) {
	var ftp = new dvr_get_mem.VtGetShareMem(dvr_mem_hdr.AUX_FTP);
	this.share_mem_ack = input.onDone;
	this.share_mem_err = input.onFail;
	this.ctrl_port.write(ftp.data);
}

dvr_connector.prototype.get_mem_info_aux_serials = function (input) {
	var serial = new dvr_get_mem.VtGetShareMem(dvr_mem_hdr.AUX_SERIAL);
	this.share_mem_ack = input.onDone;
	this.share_mem_err = input.onFail;
	this.ctrl_port.write(serial.data);
}

dvr_connector.prototype.get_mem_info_aux_mail = function (input) {
	var mail = new dvr_get_mem.VtGetShareMem(dvr_mem_hdr.AUX_MAIL);
	this.share_mem_ack = input.onDone;
	this.share_mem_err = input.onFail;
	this.ctrl_port.write(mail.data);
}

dvr_connector.prototype.get_mem_info_auth = function (input) {
	var auth = new dvr_cmd.VtGetShareMem_Auth();
	this.share_mem_ack = input.onDone;
	this.share_mem_err = input.onFail;
	this.ctrl_port.write(auth.data);
}

dvr_connector.prototype.get_mem_info_net = function (input) {
	var net = new dvr_cmd.VtGetShareMem_Network();
	this.share_mem_ack = input.onDone;
	this.share_mem_err = input.onFail;
	this.ctrl_port.write(net.data);
}

dvr_connector.prototype.get_mem_info_sys = function (input) {
	var sys = new dvr_cmd.VtGetShareMem_SysData();
	this.share_mem_ack = input.onDone;
	this.share_mem_err = input.onFail;
	this.ctrl_port.write(sys.data);
}

dvr_connector.prototype.get_mem_info_alarmins = function (input) {
	var alarmins = new dvr_get_mem.VtGetShareMem(dvr_mem_hdr.AIS_ATTR);
	this.share_mem_ack = input.onDone;
	this.share_mem_err = input.onFail;
	this.ctrl_port.write(alarmins.data);
}

dvr_connector.prototype.get_mem_info_motionattrs = function (input) {
	var mattr = new dvr_get_mem.VtGetShareMem(dvr_mem_hdr.MOTION_ATTRS);
	this.share_mem_ack = input.onDone;
	this.share_mem_err = input.onFail;
	this.ctrl_port.write(mattr.data);
}

dvr_connector.prototype.get_mem_info_cameras = function (input) {
	var cameras = new dvr_cmd.VtGetShareMem_Cameras();
	this.share_mem_ack = input.onDone;
	this.share_mem_err = input.onFail;
	this.ctrl_port.write(cameras.data);
}

dvr_connector.prototype.get_mem_info_rec_sch = function (input) {
	var sch = new dvr_get_mem.VtGetShareMem(dvr_mem_hdr.RECORD_WEEK_SCHEDULE);
	this.share_mem_ack = input.onDone;
	this.share_mem_err = input.onFail;
	this.ctrl_port.write(sch.data);
}

dvr_connector.prototype.get_mem_info_motion = function (input) {
	var motion = new dvr_cmd.VtGetShareMem_MotionActs();
	this.share_mem_ack = input.onDone;
	this.share_mem_err = input.onFail;

	while(1) {
		if (this.share_mem_ack_motion == 1 || this.share_mem_ack_vloss == 1 || this.share_mem_ack_alarm == 1) {
			continue;
		} else {
			this.share_mem_ack_motion = 1;
			this.ctrl_port.write(motion.data);
			break;
		}
	}
}

dvr_connector.prototype.get_mem_info_vloss = function (input) {
	var vloss = new dvr_cmd.VtGetShareMem_VLossActs();
	this.share_mem_ack = input.onDone;
	this.share_mem_err = input.onFail;

	while(1) {
		if (this.share_mem_ack_motion == 1 || this.share_mem_ack_vloss == 1 || this.share_mem_ack_alarm == 1) {
			continue;
		} else {
			this.share_mem_ack_vloss = 1;
			this.ctrl_port.write(vloss.data);
			break;
		}
	}
}

dvr_connector.prototype.get_mem_info_alarm = function (input) {
	var alarm = new dvr_cmd.VtGetShareMem_AlarmActs();
	this.share_mem_ack = input.onDone;
//	this.share_mem_err = input.onDone;
	this.share_mem_err = input.onFail;

	while(1) {
		if (this.share_mem_ack_motion == 1 || this.share_mem_ack_vloss == 1 || this.share_mem_ack_alarm == 1) {
			continue;
		} else {
			this.share_mem_ack_alarm = 1;
			this.ctrl_port.write(alarm.data);
			break;
		}
	}
}

// FIXME, clean this ... this ...

dvr_connector.prototype.get_mem_info_response = function (response) {
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error('VTC_ACK_GET_SHARE_MEM failed');
		this.share_mem_err({"status": "GetShareMem failed."});
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		LOG.warn('VTC_ACK_GET_SHARE_MEM succeeded');
		switch (response.length) {
		case 567:	/* Auth */
			var ack_share_mem = new dvr_cmd.VtAckGetShareMem_Auth(response);
			this.share_mem_ack({
				"status": "GetShareMem_AUTH succeeded.",
				"AuthData": ack_share_mem.AuthData,
				"defaultLogin": ack_share_mem.defaultLogin
			});
			break;

		case 251:	/* Network */
			var ack_share_mem = new dvr_cmd.VtAckGetShareMem_Network(response);
			this.share_mem_ack({
				"status": "GetShareMem_Network succeeded.",
				"net_type": ack_share_mem.net_type,
				"sip": ack_share_mem.sip,
				"pppoe": ack_share_mem.pppoe,
				"adv_network": ack_share_mem.adv_network
			});
//			console.log(response);
			break;

		case 108:	/* SysData */
//			console.log(JSON.stringify(response));
//			var ack_share_mem = new dvr_cmd.VtAckGetShareMem_SysData(response);
			var ack_share_mem = new dvr_cmd.VtAckGetShareMem_SysData_raw(response);
			this.share_mem_ack({
				"status": "GetShareMem_SysData succeeded.",
				"sys_data": ack_share_mem
//				"TimeSync": ack_share_mem.TimeSync,
//				"TimeZone": ack_share_mem.TimeZone,
//				"language": ack_share_mem.language,
//				"protectionKey": ack_share_mem.protectionKey
			});
			break;
		case 460:	/* Cameras */
			var ack_share_mem = new dvr_cmd.VtAckGetShareMem_Cameras(response);
			this.data.Installed = [];
			for (var i = 0; i < this.data.NumOfCameras; i++) {
				this.data.Installed[i] = ack_share_mem.ch[i].Installed;
			}
			this.share_mem_ack({
				"status": "GetShareMem_Cameras succeeded.",
				"BestRes": ack_share_mem.BestRes,
				"Watermark": ack_share_mem.Watermark,
				"Compression": ack_share_mem.Compression,
				"reserved": ack_share_mem.reserved,
				"ch": ack_share_mem.ch
			});
			break;
		case 168:
			if (this.share_mem_ack_motion == 1) {
				var ack_share_mem = new dvr_cmd.VtAckGetShareMem_MotionActs(response);
				this.share_mem_ack({
					"status": "GetShareMem_MotionActs succeeded.",
					"ActionData": ack_share_mem.ActionData
				});
				this.share_mem_ack_motion = 0;
			}
			else if (this.share_mem_ack_vloss == 1) {
				var ack_share_mem = new dvr_cmd.VtAckGetShareMem_VLossActs(response);
				this.share_mem_ack({
					"status": "GetShareMem_VLossActs succeeded.",
					"ActionData": ack_share_mem.ActionData
				});
				this.share_mem_ack_vloss = 0;
			}
			else if (this.share_mem_ack_alarm == 1) {
				var ack_share_mem = new dvr_cmd.VtAckGetShareMem_AlarmActs(response);
				this.share_mem_ack({
					"status": "GetShareMem_AlarmActs succeeded.",
					"ActionData": ack_share_mem.ActionData
				});
				this.share_mem_ack_alarm = 0;
			}
			break;
		case 14:
			if (this.share_mem_ack_hddfull == 1) {
				var ack_share_mem = new dvr_get_mem.VtAckGetShareMem_HDDFullAct(response);
				this.share_mem_ack({
					"status": "GetShareMem_HDDFullAct succeeded.",
					"HDDFullAct": ack_share_mem.HDDFullAct
				});
				this.share_mem_ack_hddfull = 0;
			}
			if (this.share_mem_ack_alarmhdd == 1) {
				var ack_share_mem = new dvr_get_mem.VtAckGetShareMem_HDDFullAct(response);
				this.share_mem_ack({
					"status": "GetShareMem_AlarmHDDFullAct succeeded.",
					"AlarmHDDFullAct": ack_share_mem.HDDFullAct
				});
				this.share_mem_ack_alarmhdd = 0;
			}
			break;
		case 171:
			var ack_share_mem = new dvr_get_mem.VtAckGetShareMem_Aux_Ftp(response);
			this.share_mem_ack({
				"status": "GetShareMem_Aux_Ftp succeeded.",
				"Aux_FtpParam": ack_share_mem.Aux_FtpParam
			});
			break;
		case 33:
			var ack_share_mem = new dvr_get_mem.VtAckGetShareMem_Aux_Serials(response);
			this.share_mem_ack({
				"status": "GetShareMem_Aux_Serials succeeded.",
				"Aux_Serials": ack_share_mem.Aux_Serials
			});
			break;
		case 659:
			var ack_share_mem = new dvr_get_mem.VtAckGetShareMem_Aux_Mail(response);
			this.share_mem_ack({
				"status": "GetShareMem_Aux_Mail succeeded.",
				"Aux_Mail": ack_share_mem.Aux_Mail
			});
			break;
		case (dvr_mem_hdr.AIS_ATTR.length + 8):
			var ack_share_mem = new dvr_get_mem.VtAckGetShareMem_AlarmIns(response);
			this.share_mem_ack({
				"status": "GetShareMem_AlarmIns succeeded.",
				"AlarmIns": ack_share_mem
			});
			break;
		case 1612:
			var ack_share_mem = new dvr_get_mem.VtAckGetShareMem_MotionAttrs(response);
			this.share_mem_ack({
				"status": "GetShareMem_MotionAttrs succeeded.",
				"MotionAttrs": ack_share_mem
			});
			break;
		case 575:
			var ack_share_mem = new dvr_get_mem.VtAckGetShareMem_RecWeekSch(response);
			this.share_mem_ack({
				"status": "GetShareMem_RecWeekSch succeeded.",
				"MotionAttrs": ack_share_mem
			});
			break;
		default:
			LOG.warn("Unknown share memory type: " + response.length + "\n" + JSON.stringify(response));
			this.share_mem_ack({
				"status": "GetShareMem succeeded.",
				"share_mem": ack_share_mem
			});
		}
		break;
	default:
		LOG.error('VTC_ACK_GET_SHARE_MEM exception: ' + JSON.stringify(response[dvr_cmd_hdr.CMDID]));
	}
}

dvr_connector.prototype.set_mem_info_motion = function (input) {
	var set = new dvr_set_mem.setActionData(input.data);
	var motion = new dvr_set_mem.VtShareMemSet(dvr_mem_hdr.MOTION_ACTS, set);
	this.set_mem_ack = input.onDone;
//	this.set_mem_err = input.onDone;
	this.set_mem_err = input.onFail;
	this.ctrl_port.write(motion.data);
}

dvr_connector.prototype.set_mem_info_vloss = function (input) {
	var set = new dvr_set_mem.setActionData(input.data);
	var vloss = new dvr_set_mem.VtShareMemSet(dvr_mem_hdr.VLOSS_ACTS, set);
	this.set_mem_ack = input.onDone;
//	this.set_mem_err = input.onDone;
	this.set_mem_err = input.onFail;
	this.ctrl_port.write(vloss.data);
}

dvr_connector.prototype.set_mem_info_alarm = function (input) {
	var set = new dvr_set_mem.setActionData(input.data);
	var alarm = new dvr_set_mem.VtShareMemSet(dvr_mem_hdr.ALARM_ACTS, set);
	this.set_mem_ack = input.onDone;
//	this.set_mem_err = input.onDone;
	this.set_mem_err = input.onFail;
	this.ctrl_port.write(alarm.data);
}

dvr_connector.prototype.set_mem_info_hddfull = function (input) {
	var set = new dvr_set_mem.setHDDFullAct(input.data);
	var hdd = new dvr_set_mem.VtShareMemSet(dvr_mem_hdr.HDD_FULL_ACT, set);
	this.set_mem_ack = input.onDone;
//	this.set_mem_err = input.onDone;
	this.set_mem_err = input.onFail;
	this.ctrl_port.write(hdd.data);
}

dvr_connector.prototype.set_mem_info_alarmhdd = function (input) {
	var set = new dvr_set_mem.setHDDFullAct(input.data);
	var hdd = new dvr_set_mem.VtShareMemSet(dvr_mem_hdr.ALARM_HDD_FULL_ACT, set);
	this.set_mem_ack = input.onDone;
//	this.set_mem_err = input.onDone;
	this.set_mem_err = input.onFail;
	this.ctrl_port.write(hdd.data);
}

dvr_connector.prototype.set_mem_info_aux_ftp = function (input) {
	var set = new dvr_set_mem.setAux_Ftp(input.data);
	var ftp = new dvr_set_mem.VtShareMemSet(dvr_mem_hdr.AUX_FTP, set);
	this.set_mem_ack = input.onDone;
//	this.set_mem_err = input.onDone;
	this.set_mem_err = input.onFail;
	this.ctrl_port.write(ftp.data);
}

dvr_connector.prototype.set_mem_info_aux_serials = function (input) {
	var set = new dvr_set_mem.setAux_Serials(input.data);
	var serials = new dvr_set_mem.VtShareMemSet(dvr_mem_hdr.AUX_SERIAL, set);
	this.set_mem_ack = input.onDone;
//	this.set_mem_err = input.onDone;
	this.set_mem_err = input.onFail;
	this.ctrl_port.write(serials.data);
}

dvr_connector.prototype.set_mem_info_aux_mail = function (input) {
	var set = new dvr_set_mem.setAux_Mail(input.data);
	var mail = new dvr_set_mem.VtShareMemSet(dvr_mem_hdr.AUX_MAIL, set);
	this.set_mem_ack = input.onDone;
//	this.set_mem_err = input.onDone;
	this.set_mem_err = input.onFail;
	this.ctrl_port.write(mail.data);
}

dvr_connector.prototype.set_mem_info_auth = function (input) {
	var set = new dvr_set_mem.setAuth(input.data);
	var auth = new dvr_set_mem.VtShareMemSet(dvr_mem_hdr.AUTH, set);
	this.set_mem_ack = input.onDone;
//	this.set_mem_err = input.onDone;
	this.set_mem_err = input.onFail;
	this.ctrl_port.write(auth.data);
}

dvr_connector.prototype.set_mem_info_net = function (input) {
	var set = new dvr_set_mem.setNetwork(input.data);
	var net = new dvr_set_mem.VtShareMemSet(dvr_mem_hdr.NETWORK, set);
	this.set_mem_ack = input.onDone;
//	this.set_mem_err = input.onDone;
	this.set_mem_err = input.onFail;
	this.ctrl_port.write(net.data);
}

dvr_connector.prototype.set_mem_info_sys = function (input) {
	var set = new dvr_set_mem.setSysData(input.data);
	var sys = new dvr_set_mem.VtShareMemSet(dvr_mem_hdr.SYSTEM, set);
	this.set_mem_ack = input.onDone;
//	this.set_mem_err = input.onDone;
	this.set_mem_err = input.onFail;
	this.ctrl_port.write(sys.data);
}

dvr_connector.prototype.set_mem_info_ais = function (input) {
	var set = new dvr_set_mem.setAlarmIns(input.data);
	var ais = new dvr_set_mem.VtShareMemSet(dvr_mem_hdr.AIS_ATTR, set);
	this.set_mem_ack = input.onDone;
	this.set_mem_err = input.onFail;
	this.ctrl_port.write(ais.data);
}

dvr_connector.prototype.set_mem_info_motionattrs = function (input) {
	var set = new dvr_set_mem.setMotionAttrs(input.data);
	var mattrs = new dvr_set_mem.VtShareMemSet(dvr_mem_hdr.MOTION_ATTRS, set);
	this.set_mem_ack = input.onDone;
	this.set_mem_err = input.onFail;
	this.ctrl_port.write(mattrs.data);
}

dvr_connector.prototype.set_mem_info_cameras = function (input) {
	var set = new dvr_set_mem.setCameras(input.data);
	var cameras = new dvr_set_mem.VtShareMemSet(dvr_mem_hdr.CAMERAS_ATTR, set);
	this.set_mem_ack = input.onDone;
	this.set_mem_err = input.onFail;
	this.ctrl_port.write(cameras.data);
}

/*
dvr_connector.prototype.set_mem_info = function (input) {
	var set_mem_info = new dvr_set_mem.VtShareMemSet(input.id, input.data);
	input.onDone({"test": "test"});
}
*/

dvr_connector.prototype.set_mem_info_response = function (response) {
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error('VTS_ACK_SET_SHARE_MEM failed');
		this.set_mem_err({"status": "SetShareMem failed."});
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		LOG.warn('VTS_ACK_SET_SHARE_MEM succeeded');
		this.set_mem_ack({"status": "SetShareMem succeeded."});
		break;
	default:
		LOG.error('VTS_ACK_SET_SHARE_MEM exception: ' + JSON.stringify(response));
	}
}

dvr_connector.prototype.update_mem_info = function (input) {
	var update_mem = new dvr_set_mem.VtUpdateShareMem();
	this.update_mem_info_ack = input.onDone;
	this.update_mem_info_err = input.onDone;
//	update_mem_info_err = input.onFail;
	this.ctrl_port.write(update_mem.data);
}

dvr_connector.prototype.update_mem_info_response = function (response) {
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error('VTS_ACK_UPDATE_SHARE_MEM failed');
		this.update_mem_info_err({"status": "UpdateShareMem failed."});
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		LOG.warn('VTS_ACK_UPDATE_SHARE_MEM succeeded');
		this.update_mem_info_ack({"status": "UpdateShareMem succeeded."});
		break;
	default:
		LOG.error('VTS_ACK_UPDATE_SHARE_MEM exception: ' + JSON.stringify(response));
	}
}

// FIXME, dvr_addmem_hdr[input].id
dvr_connector.prototype.get_addmem_info = function (input) {
	switch (input.key) {
	case "CamsAttrEx":
		var get_addmem = new dvr_get_addmem.VtGetAddShareMems(dvr_addmem_hdr.CamsAttrEx.id);
		break;
	default:
//		LOG.warn("GG");
		return;
	}
	this.get_addmem_info_ack = input.onDone;
	this.get_addmem_info_err = input.onDone;
//	update_mem_info_err = input.onFail;
	this.ctrl_port.write(get_addmem.data);
}

dvr_connector.prototype.get_addmem_info_response = function (response) {
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error("VTS_ACK_GET_ADDITIONAL_SHARE_MEMS failed");
		this.get_addmem_info_err({"status": "GetAdditionalShareMems failed."});
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		switch (response.length) {
		case 1496:
			var ack_add_share_mem = new dvr_get_addmem.VTS_ACK_GET_ADDITIONAL_SHARE_MEMS_CamsAttrEx(response);
			this.get_addmem_info_ack({
				"status": "GetAdditionalShareMems_CamsAttrEx succeeded.",
				"VtAddShareMemsAccess": ack_add_share_mem.VtAddShareMemsAccess
			});
			break;
		default:
			LOG.warn("Unknown VTS_ACK_GET_ADDITIONAL_SHARE_MEMS: " + response.length + JSON.stringify(response));
			this.get_addmem_info_ack({"status": "GetAdditionalShareMems succeeded."});
		}
		break;
	default:
		LOG.error('VTS_ACK_GET_ADDITIONAL_SHARE_MEM exception: ' + JSON.stringify(response[dvr_cmd_hdr.CMDID]) + " " + response.length);
	}
}

dvr_connector.prototype.set_addmem_info_camex = function (input) {
	var set = new dvr_set_addmem.setCamerasEx(input.data);
	var cam = new dvr_set_addmem.VtSetAddShareMems(dvr_addmem_hdr.CamsAttrEx, set);
	this.set_addmem_info_ack = input.onDone;
//	this.set_mem_err = input.onDone;
	this.set_addmem_info_err = input.onFail;
	this.ctrl_port.write(cam.data);
}

dvr_connector.prototype.set_addmem_info_response = function (response) {
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error('VTS_ACK_SET_ADDITIONAL_SHARE_MEMS failed');
		this.set_addmem_info_err({"status": "SetAdditionalShareMems failed."});
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		LOG.warn("VTS_ACK_SET_ADDITIONAL_SHARE_MEMS: " + response.length + JSON.stringify(response));
		this.set_addmem_info_ack({"status": "SetAdditionalShareMems succeeded."});
		break;

	default:
		LOG.error('VTS_ACK_SET_ADDITIONAL_SHARE_MEM exception: ' + JSON.stringify(response[dvr_cmd_hdr.CMDID]) + response.length);
	}
}

dvr_connector.prototype.update_addmem_info = function (input) {
	var update_mem = new dvr_set_addmem.VtUpdateAddShareMems();
	this.update_addmem_info_ack = input.onDone;
	this.update_addmem_info_err = input.onFail;
	this.ctrl_port.write(update_mem.data);
}

dvr_connector.prototype.update_addmem_info_response = function (response) {
	switch (response[dvr_cmd_hdr.CMDID]) {
	case dvr_cmd_hdr.CMDFAILED:
		LOG.error('VTS_ACK_UPDATE_ADDITIONAL_SHARE_MEM failed');
		this.update_addmem_info_err({"status": "UpdateAddShareMem failed."});
		break;
	case dvr_cmd_hdr.CMDSUCCESS:
		LOG.warn('VTS_ACK_UPDATE_ADDITIONAL_SHARE_MEM succeeded');
		this.update_addmem_info_ack({"status": "UpdateAddShareMem succeeded."});
		break;
	default:
		LOG.error('VTS_ACK_UPDATE_ADDITIONAL_SHARE_MEM exception: ' + JSON.stringify(response));
	}
}

module.exports = dvr_connector;
