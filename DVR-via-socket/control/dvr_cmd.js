var dvr_cmd_hdr = require('../constants/dvr_cmd_hdr.js');
var dvr_mem_hdr = require('../constants/dvr_mem_hdr.js');

var null_term = new Buffer(1);
null_term.writeUInt8(0, 0);

/**
 * message : VTC_LOGIN
 * Login parameters
 */
var VtLogin = function (user, passwd) {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_LOGIN, 31);

	if (user && passwd) {
		var l_user = new Buffer(14);
		var l_passwd = new Buffer(14);
		l_user.fill(0);
		l_passwd.fill(0);
		l_user.write(user);
		l_passwd.write(passwd);
	} else {
		console.log('plz input user and passwd');
		return;
	}

	this.data = new Buffer.concat([header.data, l_user, null_term, l_passwd, null_term, null_term]);
}

var VtAckLogin = function (data) {
	var ack = new Buffer(data.length);
	var level = ['GUEST', 'OPERATOR', 'SUPERVISOR', 'SUPERVISOR'];
	var ntsc = ['NTSC', 'PAL'];
	var res = ['FD1', 'HD1', 'CIF'];

	ack.write(data, 0, ack.length, 'binary');
	this.Level = level[ack.readUInt8(8)];
	this.NTSC = ntsc[ack.readUInt8(9)]; // 1=NTSC, 0=PAL
	this.Res = res[ack.readUInt8(10)]; // Best resolution, FD1, HD1, CIF
}

var VtSetExtraVStrm = function () {
	var header = new dvr_cmd_hdr.header(false, dvr_cmd_hdr.VTC_SET_EXTRA_V_STREAM, 32);
	var type = new Buffer(1);
	var reserved = new Buffer(31);
	// #define STREAM_RECORD           0
	// #define STREAM_EXTRA            1
	type.writeUInt8(1, 0); // EXTRA
	reserved.fill('');
	this.data = new Buffer.concat([header.data, type, reserved]);
}

var VtGetSystemInfo = function () {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_GET_SYS_INFO, 0);
	this.data = header.data;
}

var VtAckGetSystemInfo = function (data) {
	var ack = new Buffer(data.length);
	ack.write(data, 0, ack.length, 'binary');
	var video_system = ['NTSC', 'PAL'];
	this.Model =  new Buffer(20);
	this.Model.fill('');
	for (var i = 0; i < 20; i++) {
		this.Model[i] = ack[i + 8];
	}
	this.Model = this.Model.toString('binary');

	this.Serial = new Buffer(30);
	this.Serial.fill('');
	for (var i = 0; i < 30; i++) {
		this.Serial[i] = ack[i + 28];
	}
	this.Serial = this.Serial.toString('binary');

	this.HWVersion = ack.readUInt16LE(58);
	this.SWVersion = ack.readUInt16LE(60);
	this.NumOfCameras = ack.readUInt8(62);
	this.NumOfAudios = ack.readUInt8(63);
	this.NumOfAIs = ack.readUInt8(64);
	this.NumOfAOs = ack.readUInt8(65);
	this.NumOfEncoders = ack.readUInt8(66);
	this.NumOfDecoders = ack.readUInt8(67);
	this.TVSystem = video_system[ack.readUInt8(68)];
}

/**
 * message : VTC_POLL_STATUS
 * keep connection and obtain info of ptz cameras
 */

var VtPollStatus = function () {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_POLL_STATUS, 6);
	var version = new Buffer(4);
	var sub_version = new Buffer(1);
	var reserved = new Buffer(1);
	version.fill(0);
	version.writeUInt32LE(2, 0);
	sub_version.fill(1);
	reserved.fill(0);
	this.data = new Buffer.concat([header.data, version, sub_version, reserved]);
}

var VtAckPollStatus = function (data, NumOfCameras) {
	var ack = new Buffer(data.length);
	ack.write(data, 0, ack.length, 'binary');
//	this.VLoss = [];
	this.NumOfCameras = [];
	var tmp = ack.readUInt16LE(8);
	for (var i = 0; i < NumOfCameras; i++) {
		this.NumOfCameras[i] = ((ack.readUInt16LE(8) >> i) % 2) ? 0 : 1; 
	}
/*
Motion;
AI;
AO;
HDDStatus;
*/
	
}

var VtStreamConnect = function () {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_STREAM_CONNECT, 0);
	this.data = header.data;
	
}

/*
var VtAckStreamConnect = function (data) {
}
*/

var VtStreamDisconnect = function () {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_STREAM_DISCONNECT, 0);
	this.data = header.data;
}

/*
var VtAckStreamDisconnect = function (data) {
}
*/

/**
 *	message : VTC_SET_LIVE_CHANNEL
 *	set live channel parameters
 *	For example:
 *		liveChs = 0x00 0x00 0x00 0x00 : DVR will not send any video data
 *		liveChs = 0xff 0x00 0x00 0x00 : DVR will send 1~8 channels' video data
 */

var VtLiveChsParam = function (VideoCh, AudioCh) {
	if (VideoCh != null && AudioCh != null) {
		var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_SET_LIVE_CHANNEL, 8);
		var liveChs = new Buffer(4);
		var liveAuds = new Buffer(4);
		liveChs.fill(0);
		liveAuds.fill(0);
		var tmp = 0;
		for (var i = 0; i < VideoCh; i++) {
			tmp = tmp + Math.pow(2, i);
		}
		liveChs.writeUInt32LE(tmp, 0);
	}
	this.data = new Buffer.concat([header.data, liveChs, liveAuds]);
//	console.log(JSON.stringify(this.data));
}

/**
 * Message : VTC_GET_SHARE_MEM
 * obtain DVR's memory info
 * aims to detect the max channels' number which devices support
 * decide time_zone to calculate the time on PES packets
 */

/*
var VtGetShareMem = function (share_mem_id) {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_GET_SHARE_MEM, 11);

	if (share_mem_id) {
		this.id = new Buffer(4);
		this.id.fill(0);
		this.id.writeUInt32LE(share_mem_id);
	} else {
		console.log('plz input share_mem_id');
		return;
	}

	this.data = new Buffer.concat([header.data, this.id]);
}
*/

var VtGetLog = function () {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_GET_LOG, 15);
	var isEvent = new Buffer(1);
	isEvent.writeUInt8(1, 0);
	var isReset = new Buffer(1);
	isReset.writeUInt8(0, 0);
	var actType = new Buffer(4);
	actType.fill(0);
	actType.writeUInt32LE(1, 0);
	var readNumber = new Buffer(4);
	readNumber.writeUInt32LE(20, 0);
	var srcId = new Buffer(4);
	srcId.writeUInt32LE(0xffff, 0); // 0xffff ?
	var eventType = new Buffer(1);
	eventType.writeUInt8(14, 0);
	this.data = new Buffer.concat([header.data, isEvent, isReset, actType, readNumber, srcId, eventType]);
	console.log(JSON.stringify(this.data));
}


/**
 * [ VTS_ACK_GET_LOG ]
 * Acknowledge for VTC_GET_LOG command
 * Reply with byData[0] -
 *     0x00 : succeeded for the command
 *     0xff : failed for the command
 * Reply with parameter -
 *     VtAckGetLog structure; Model: DM1604H4-HD04
 */

var Log = function (buf) {
	this.Type = buf.readUInt8(0);
	this.Time = buf.readUInt32LE(1);
}

var Aux_GetLog = function (buf) {
	this.Num = buf.readUInt32LE(0);
	this.Data = [];
	for (var i = 0; i < ((buf.length - 4) / 5); i++) {
		this.Data[i] = new Log(buf.slice((4 + (i * 5)), (9 + (i * 5))));
	}
}

var Log_List_Data = function (buf) {
	var time = new Date(buf.readUInt32LE(0) * 1000);
	this.time = time.toLocaleString();
	this.node_id = buf.readUInt32LE(4);
	this.ch = buf.readUInt16LE(8);
	this.event_type = buf.readUInt8(10);
	this.source_id = buf.readUInt8(11);
	this.hdd_id = buf.readUInt8(12);
	this.prealarm_time = buf.readUInt8(13);
	this.with_log = buf.readUInt8(14);
	this.reserved = buf.readUInt8(15);
}

var VtAckGetLog = function (data) {
	var ack = new Buffer(data.length);
	ack.write(data, 0, ack.length, 'binary');
	this.isEvent = ack.readUInt8(8);
	console.log("this.Event:" + this.isEvent);
	this.readNumber = ack.readUInt32LE(9);
	if (this.isEvent) {
		this.logListData = [];
		for (var i = 0; i < 20; i++) {
			this.logListData[i] = new Log_List_Data(ack.slice((13 + (i * 16)), (29 + (i * 16))));
		}
	}
	else {
		this.sysLog = new Aux_GetLog(ack.slice(14, ack.length));
	}
}

var VtGetSysTime = function () {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_GET_SYS_TIME, 0);
	this.data = new Buffer.concat([header.data/*, null_term*/]);
}

var VtAckGetSysTime = function (data) {
	var ack = new Buffer(data.length);
	ack.write(data, 0, ack.length, 'binary');
	this.tm_sec = ack.readUInt32LE(8);
	this.tm_min = ack.readUInt32LE(12);
	this.tm_hour = ack.readUInt32LE(16);
	this.tm_mday = ack.readUInt32LE(20);
	this.tm_mon = ack.readUInt32LE(24) + 1;
	this.tm_year = ack.readUInt32LE(28) + 1900;
	this.tm_wday = ack.readUInt32LE(32);
	this.tm_yday = ack.readUInt32LE(36);
	this.tm_isdst = ack.readUInt32LE(40);
}

var VtSetSysTime = function (buf) {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_SET_SYS_TIME, 36);
	var tm = new Buffer(36);
	tm.fill(0);
	tm.writeUInt32LE(buf.tm_sec, 0);
	tm.writeUInt32LE(buf.tm_min, 4);
	tm.writeUInt32LE(buf.tm_hour, 8);
	tm.writeUInt32LE(buf.tm_mday, 12);
	tm.writeUInt32LE(buf.tm_mon, 16);
	tm.writeUInt32LE(buf.tm_year, 20);
	tm.writeUInt32LE(buf.tm_wday, 24);
	tm.writeUInt32LE(buf.tm_yday, 28);
	tm.writeUInt32LE(buf.tm_isdst, 32);
	this.data = new Buffer.concat([header.data, tm]);
}

var VtGetShareMem_Auth = function () {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_GET_SHARE_MEM, 4);

	var id = new Buffer(4);
	id.fill(0);
	id.writeUInt32LE(5, 0);

	this.data = new Buffer.concat([header.data, id]);
}

var VtAckGetShareMem_Auth = function (data) {
	var ack = new Buffer(data.length);
	ack.write(data, 0, ack.length, 'binary');
	var level = ['GUEST', 'OPERATOR', 'SUPERVISOR', 'SUPERVISOR'];
	this.AuthData = [];
	for (var i = 0, j = 8; i < 18 && ack[j] != 0; i++, j += 31) {
/*		console.log(ack.readUInt8(j+30)); */
		var username = new Buffer(15);
		username.fill('');
		for (var k = 0; k < 15; k++) {
			username[k] = ack[j + k];
		}
		var passwd = new Buffer(15);
		passwd.fill('');
		for (var k = 0; k < 15; k++) {
			passwd[k] = ack[j + 15 + k];
		}
		this.AuthData[i] = {
			"username": username.toString("utf8").split("\u0000")[0],
			"password": passwd.toString("utf8").split("\u0000")[0],
			"level": level[ack.readUInt8(j+30)]
		};
	}
	this.defaultLogin = ack.readUInt8(566);
}

var VtGetShareMem_Network = function () {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_GET_SHARE_MEM, 4);

	var id = new Buffer(4);
	id.fill(0);
	id.writeUInt32LE(9, 0);

	this.data = new Buffer.concat([header.data, id]);
}

var VtAckGetShareMem_Network = function (data) {
// length 251
	var ack = new Buffer(data.length);
	ack.write(data, 0, ack.length, 'binary');
	var tmp, ip = '', mask = '', router = '', DNS = '';
	var type = ["NET_STATIC_IP", "NET_PPPOE", "NET_DHCPC"];
	var dns_type = ["DNS_DYNAMIC", "DNS_STATIC", "DNS_CUSTOM"];
	var quality = ["WAP_PIC_QUALITY_NORMAL", "WAP_PIC_QUALITY_FINE", "WAP_PIC_QUALITY_SUPER_FINE"];

	this.net_type = type[ack.readUInt8(8)];

	for (var i = 0; i < 4; i++) {
//		var base = 9;
		for (var j = 0; j < 4; j++) {
			tmp = ack[((i * 4) + j + 9)];
			if (i == 0) {
				(j != 0) ? (ip += "." + tmp)  : ip = tmp;
			}
			else if (i == 1) {
				(j != 0) ? (mask += "." + tmp)  : mask = tmp;
			}
			else if (i == 2) {
				(j != 0) ? (router += "." + tmp)  : router = tmp;
			}
			else if (i == 3) {
				(j != 0) ? (DNS += "." + tmp)  : DNS = tmp;
			}
		}
	}
//	this.net_type = type[ack.readUInt8(8)];
//	if (ack.readUInt8(8) == 0) {
	this.sip = {
		"ip": ip,
		"mask": mask,
		"router": router,
		"DNS": DNS
	};
//	}
//	else if (ack.readUInt8(8) == 1) {
	this.pppoe = {
		"username": ack.slice(25, 55).toString("utf8").split("\u0000")[0],
		"password": ack.slice(56, 86).toString("utf8").split("\u0000")[0],
		"dns_type": ((ack.readUInt8(87) >> 1) ? "custom"
			    : dns_type[ack.readUInt8(87)]),
		"dns_account_name": ack.slice(88, 128).toString("utf8").split("\u0000")[0],
		"dns_account_password": ack.slice(129, 169).toString("utf8").split("\u0000")[0],
		"URL": ack.slice(170, 240).toString("utf8").split("\u0000")[0]
	}
//	}
	this.adv_network = {
		"id": ack.readUInt8(241),
		"ctrl_port": ack.readUInt16LE(242),
		"data_port": ack.readUInt16LE(244),
		"wap_pic_quality": quality[ack.readUInt8(246)],
		"http_port": ack.readUInt16LE(247),
		"reserved": ack.readUInt8(249),
		"checksum": ack.readUInt8(250)
	};
}

var VtGetShareMem_SysData = function () {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_GET_SHARE_MEM, 4);

	var id = new Buffer(4);
	id.fill(0);
	id.writeUInt32LE(10, 0);

	this.data = new Buffer.concat([header.data, id]);
}

var TZone = function (buf) {
//	var tzone = new Buffer(data.length);
//	tzone.write(data, 0, tzone.length, 'binary');
	var dt_format = ["YY/MM/DD HH:MM", "MM/DD/YY HH:MM", "DD/MM/YY HH:MM"];
	this.index = buf.readUInt8(0);
	this.offset_hour = buf.readUInt16LE(1);
	this.offset_min = buf.readUInt16LE(3);
	this.isDSTEnable = buf.readUInt8(5) ? "Enable" : "Not"; // daylight saving
	this.DST = {
		"s_month": buf.readUInt8(6),
		"s_day": buf.readUInt8(7),
		"s_hour": buf.readUInt8(8),
		"e_month": buf.readUInt8(9),
		"e_day": buf.readUInt8(10),
		"e_hour": buf.readUInt8(11)
	}
	this.DateTimeFormat = dt_format[buf.readUInt8(12)];
/*
DT_FORMAT_0, // YY/MM/DD HH:MM
DT_FORMAT_1, // MM/DD/YY HH:MM
DT_FORMAT_2  // DD/MM/YY HH:MM
*/	
}

var TSync = function (buf) {
//	var tsync = new Buffer(data.length);
//	tsync.write(data.toString('binary'), 0, tsync.length, 'binary');
	var tsp_type = ["NONE","TSP_SERV","GPS","NUM_OF_TIME_SYNC_TYPES"];
//	this.isEnable = buf.readUInt8(0);
	this.TSPType = tsp_type[buf.readUInt8(0)];
	this.TSP = new Buffer(65);
	this.TSP.fill('');
	for (var i = 0; i < 65; i++) {
		this.TSP[i] = buf[i + 1];
	}
	this.TSP = this.TSP.toString("utf8").split("\u0000")[0];
}

var VtAckGetShareMem_SysData = function (data) {
	var ack = new Buffer(data.length);
	var lang = ["ENGLISH", "GERMAN", "ITALIAN", "DUTCH", "FINLAND",
		    "RUSSIAN", "DANISH", "FRENCH", "NORWEGIAN", "POLISH",
		    "PORTUGUESE", "SPANISH", "SWEDISH", "TURKISH", "GREEK",
		    "THAI", "T_CHINESE", "S_CHINESE", "KOREAN", "JAPANESE",
		    "HEBREW", "CZECH", "LAOTHIAN"];
	ack.write(data, 0, ack.length, 'binary');
	this.TimeSync = new TSync(ack.slice(8, 74)); // 66
	this.TimeZone = new TZone(ack.slice(74, 87)); // 13
	this.language = lang[parseInt(ack.readInt8(87))];
//	console.log(ack.readInt8(87));
//	console.log(ack[88]);
//	console.log(this.language);
	this.protectionKey = ack.slice(88, 92).toString("utf8").split("\u0000")[0] + " "
		+ ack.slice(93, 97).toString("utf8").split("\u0000")[0] + " "
		+ ack.slice(98, 102).toString("utf8").split("\u0000")[0] + " "
		+ ack.slice(103, 108).toString("utf8").split("\u0000")[0];
}

var TZone_raw = function (buf) {
	this.index = buf.readUInt8(0);
	this.offset_hour = buf.readUInt16LE(1);
	this.offset_min = buf.readUInt16LE(3);
	this.isDSTEnable = buf.readUInt8(5); // daylight saving
	this.DST = {
		"s_month": buf.readUInt8(6),
		"s_day": buf.readUInt8(7),
		"s_hour": buf.readUInt8(8),
		"e_month": buf.readUInt8(9),
		"e_day": buf.readUInt8(10),
		"e_hour": buf.readUInt8(11)
	}
	this.DateTimeFormat = buf.readUInt8(12);
}

var TSync_raw = function (buf) {
	this.TSPType = buf.readUInt8(0);
	this.TSP = new Buffer(65);
	this.TSP.fill('');
	for (var i = 0; i < 65; i++) {
		this.TSP[i] = buf[i + 1];
	}
	this.TSP = this.TSP.toString("utf8").split("\u0000")[0];
}

var VtAckGetShareMem_SysData_raw = function (data) {
	var ack = new Buffer(data.length);
	ack.write(data, 0, ack.length, 'binary');
	this.TimeSync = new TSync_raw(ack.slice(8, 74)); // 66
	this.TimeZone = new TZone_raw(ack.slice(74, 87)); // 13
	this.language = parseInt(ack.readInt8(87));
//	console.log(ack.readInt8(87));
//	console.log(ack[88]);
//	console.log(this.language);
	this.protectionKey = ack.slice(88, 92).toString("utf8").split("\u0000")[0]
		+ ack.slice(93, 97).toString("utf8").split("\u0000")[0]
		+ ack.slice(98, 102).toString("utf8").split("\u0000")[0]
		+ ack.slice(103, 108).toString("utf8").split("\u0000")[0];
}
var VtGetShareMem_Cameras = function () {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_GET_SHARE_MEM, 4);

	id = new Buffer(4);
	id.fill(0);
	id.writeUInt32LE(13, 0);

	this.data = new Buffer.concat([header.data, id]);
}

var iconv = require("iconv-lite");
var bstres = ["", "FULL-D1", "HALF-D1", "CIF"];
var Camera = function (buf) {
//	console.log("Camera");
	this.Id = buf.readUInt8(0);
/*	this.Title = new Buffer(9);
	for (var i = 0; i < 9; i++) {
		this.Title[i] = buf[i + 1];
	}*/
	// var str = iconv.decode(buf.slice(1, 9), "Big5").split("\u0000")[0];
	// console.log(str);
	// this.Title = buf.slice(1, 9).toString("hex").split("\u0000")[0];
	this.Title = iconv.decode(buf.slice(1, 9), "Big5").split("\u0000")[0];
	this.Size = bstres[buf.readUInt8(10)];
	this.GroupId = buf.readUInt8(11);
	this.Standard = buf.readUInt8(12);
	this.Quality = buf.readUInt8(13) + 1;
	this.PreIPS = buf.readUInt8(14);
	this.NormalIPS = buf.readUInt8(15);
	this.AlarmIPS = buf.readUInt8(16);
	this.AudioCh = buf.readUInt8(17);
	this.PtzId = buf.readUInt16LE(18);
	this.CallDispEv0 = buf.readUInt8(20);
	this.CallDispDw0 = buf.readUInt8(21);
	this.CallDispEv1 = buf.readUInt8(22);
	this.CallDispDw1 = buf.readUInt8(23);
	this.Installed = buf.readUInt8(24) % 2;
	this.Covered = (buf.readUInt8(24) >> 1) % 2;
	this.MotionAct = (buf.readUInt8(24) >> 2) % 2;
	this.VLossAct = (buf.readUInt8(24) >> 3) % 2;

	if ((buf.readUInt8(24) >> 4) % 2) {
		this.HDSize = "HD_1280X720";
	}
	else if ((buf.readUInt8(24) >> 5) % 2) {
		this.HDSize = "HD_1920X1080";
	}
	else {
		// console.log(this.HDSize);
		if (typeof(this.HDSize) === "undefined") {
			// this.HDSize = "NaN ._.";
			this.HDSize = 0;
		}
	}

	this.Resolved = (buf.readUInt8(24) >> 6) % 2;
	this.HD = (buf.readUInt8(24) >> 7) % 2;
	this.reserved = new Buffer(3);
	for (var i = 0; i < 3; i++) {
		this.reserved[i] = buf[i + 25];
	}
}

var VtAckGetShareMem_Cameras = function(data) {
// length = 460
	var ack = new Buffer(data.length);
	ack.write(data, 0, ack.length, 'binary');
//	console.log(ack.readUInt8(8));
	this.BestRes = bstres[ack.readUInt8(8)];
	this.Watermark = ack.readUInt8(9) ? "On" : "Off";
	this.Compression = ack.readUInt8(10) ? "HIGH" : "NORMAL";
	this.reserved = ack.readUInt8(11);
	this.ch = [];
	for (var i = 0; i < 16; i++) {
		this.ch[i] = new Camera(ack.slice((12 + (28 * i)), (40 + (28 * i))));
	}
}

var VtGetShareMem_MotionActs = function (data) {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_GET_SHARE_MEM, 4);

	id = new Buffer(4);
	id.fill(0);
	id.writeUInt32LE(0, 0);

	this.data = new Buffer.concat([header.data, id]);
}

var VtGetShareMem_VLossActs = function (data) {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_GET_SHARE_MEM, 4);

	id = new Buffer(4);
	id.fill(0);
	id.writeUInt32LE(1, 0);

	this.data = new Buffer.concat([header.data, id]);
}

var VtGetShareMem_AlarmActs = function (data) {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_GET_SHARE_MEM, 4);

	id = new Buffer(4);
	id.fill(0);
	id.writeUInt32LE(2, 0);

	this.data = new Buffer.concat([header.data, id]);
}

var ActionData = function (buf) {
	this.Duration = buf.readUInt16LE(0);	// Duration time: 0(Unlimited), 3, 5, 10, 15, 20, 30, 40, 50, 60,
						// 120, 180, 300, 600, 900, 1200, 1800, 2400, 3000, 3600
						// Refer to duration_table[]
	this.Log = (buf.readUInt8(2) % 2) ? "On" : "Off";		// 1=Log On, 0=Off
	this.Buzzer = ((buf.readUInt8(2) >> 1) % 2) ? "On" : "Off";	// 1=Buzzer On, 0=Off
	this.Mail = ((buf.readUInt8(2) >> 2) % 2) ? "Send Mail" : "Not";		// 1=Send Mail, 0=Not
	this.FtpOut = ((buf.readUInt8(2) >> 3) % 2) ? "FTP Out" : "Not";	// 1=FTP Out, 0=Not
	this.NetAlarm = ((buf.readUInt8(2) >> 4) % 2);	// Reserved
	this.ScrnMsg = ((buf.readUInt8(2) >> 5) % 2) ? "Screen Message" : "Not";	// 1=Screen Message, 0=Not

	this.Resolved = [(buf.readUInt8(2) >> 6) % 2, (buf.readUInt8(2) >> 7) % 2];

	this.AlarmOut = buf.readUInt8(3);	// 0~(MAX_AO-1), Invalid=INVALID_BYTE_VALUE
	this.FocusCh = buf.readUInt8(4);	// 0~(MAX_CH-1), Invalid=INVALID_BYTE_VALUE
	this.GoToPreset = buf.readUInt8(5);	// 0~MAX_PRESET
						// Pre-record: 0, 1, 2, 3, 5, 10 , 15, 20, 30, 40, 50, 60
	this.PreRecord = buf.readUInt16LE(6);	// Refer to pre_record_table[]
	this.PostRecord = buf.readUInt16LE(8);	// Post-record: 0, 1, 2, 3, 5, 10, 15, 20, 30, 40, 50,
						// 60, 120, 180, 300, 600, 900, 1200, 1800, 2400, 3000, 3600
						// Refer to post_record_table[]	
}

var VtAckGetShareMem_MotionActs = function (data) {
// length 168
        var ack = new Buffer(data.length);
        ack.write(data, 0, ack.length, 'binary');
	this.ActionData = [];
	console.log(ack.length);
	for (var i = 0; i < 16; i++) {
		this.ActionData[i] = new ActionData(ack.slice((8 + (i * 10)), (18 + (i * 10))));
	}
}

var VtAckGetShareMem_VLossActs = function (data) {
// length 168
        var ack = new Buffer(data.length);
        ack.write(data, 0, ack.length, 'binary');
	this.ActionData = [];
	console.log(ack.length);
	for (var i = 0; i < 16; i++) {
		this.ActionData[i] = new ActionData(ack.slice((8 + (i * 10)), (18 + (i * 10))));
	}
}

var VtAckGetShareMem_AlarmActs = function (data) {
// length 168
        var ack = new Buffer(data.length);
        ack.write(data, 0, ack.length, 'binary');
	this.ActionData = [];
	console.log(ack.length);
	for (var i = 0; i < 16; i++) {
		this.ActionData[i] = new ActionData(ack.slice((8 + (i * 10)), (18 + (i * 10))));
	}
}

/*
var VtShareMemSet = function (id, data) {
//	if (obj.share_mem_id)
// find id, length and compare
	console.log(dvr_mem_hdr.MOTION_ACTS.id);
	console.log(data);
}
*/

var VtDataAck = function (SendNo, tp) {
	if (SendNo != null && tp != null) {
		var header = new dvr_cmd_hdr.header(false, dvr_cmd_hdr.VTC_DATA_RECV_ACK, 16)
		var _SendNo = new Buffer(4);
		_SendNo.fill('');
		_SendNo.writeUInt32LE(SendNo, 0);
		var _tp = new Buffer(12);
		for (var i = 0; i < 12; i++) {
			_tp[i] = tp[i];
		}
	}
	this.data = new Buffer.concat([header.data, _SendNo, _tp]);
//	console.log(JSON.stringify(this.data));
}

var VtSendPtzKey = function (keyState, keyCode, ch, param) {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_SEND_PTZ_KEY, 9);

	if (keyState != null && keyCode != null && ch != null && param != null) {
		var ptz_cmd = new Buffer(9);
		ptz_cmd.fill(0);
		ptz_cmd.writeUInt8(keyState, 0);
		ptz_cmd.writeUInt16LE(keyCode, 1);
		ptz_cmd.writeUInt16LE(ch, 3);
		ptz_cmd.writeUInt32LE(param, 5);
	} else {
		console.log('plz input keyState, keyCode, ch and param');
		return;
	}

	this.data = new Buffer.concat([header.data, ptz_cmd]);
}

var VtEventNotify = function (data) {
	var notify = new Buffer(data.length);
	notify.write(data, 0, notify.length, 'binary');
	this.alarm_changed_mask = notify.readUInt16LE(7);
	this.alarm_value = notify.readUInt16LE(9);
	this.vloss_changed_mask = notify.readUInt16LE(11);
	this.vloss_value = notify.readUInt16LE(13);
	this.motion_changed_mask = notify.readUInt16LE(15);
	this.motion_value = notify.readUInt16LE(17);
	this.hdds_fail_changed_mask = notify.readUInt32LE(19);
	this.hdds_failed = notify.readUInt32LE(23);

	this.year = notify.readUInt16LE(27);
	this.mon = notify.readUInt8(29);
	this.day = notify.readUInt8(30);
	this.hour = notify.readUInt8(31);
	this.min = notify.readUInt8(32);
	this.sec = notify.readUInt8(33);

	this.is_alarmEx_support = notify.readUInt8(34);
	this.alarmEx_changed_mask = notify.readUInt16LE(35);
	this.alarmEx_value = notify.readUInt16LE(37);
	this.reserved = {};
	for (var i = 39; i < notify.length; i++) {
		this.reserved[i - 39] = notify[i];
	}
}

module.exports = {
	VtLogin :			VtLogin,
	VtSetExtraVStrm :		VtSetExtraVStrm,
	VtGetSystemInfo :		VtGetSystemInfo,
	VtAckGetSystemInfo :		VtAckGetSystemInfo,
	VtAckLogin :			VtAckLogin,
	VtPollStatus :			VtPollStatus,
	VtAckPollStatus :		VtAckPollStatus,
	VtStreamConnect :		VtStreamConnect,
	VtStreamDisconnect :		VtStreamDisconnect,
	VtLiveChsParam :		VtLiveChsParam,
	VtSendPtzKey : 			VtSendPtzKey,
	VtDataAck : 			VtDataAck,
	VtEventNotify :			VtEventNotify,
	VtGetLog :			VtGetLog,
	VtAckGetLog :			VtAckGetLog,
	VtGetSysTime :			VtGetSysTime,
	VtSetSysTime :			VtSetSysTime,
	VtAckGetSysTime :		VtAckGetSysTime,
	VtGetShareMem_Auth :		VtGetShareMem_Auth,
	VtAckGetShareMem_Auth :		VtAckGetShareMem_Auth,
	VtGetShareMem_Network :		VtGetShareMem_Network,
	VtAckGetShareMem_Network :	VtAckGetShareMem_Network,
	VtGetShareMem_SysData :		VtGetShareMem_SysData,
	VtAckGetShareMem_SysData :	VtAckGetShareMem_SysData,
	VtAckGetShareMem_SysData_raw :	VtAckGetShareMem_SysData_raw,
	VtGetShareMem_Cameras :		VtGetShareMem_Cameras,
	VtAckGetShareMem_Cameras :	VtAckGetShareMem_Cameras,
//	VtShareMemSet :			VtShareMemSet,
	VtGetShareMem_MotionActs :	VtGetShareMem_MotionActs,
	VtAckGetShareMem_MotionActs :	VtAckGetShareMem_MotionActs,
	VtGetShareMem_VLossActs :	VtGetShareMem_VLossActs,
	VtAckGetShareMem_VLossActs :	VtAckGetShareMem_VLossActs,
	VtGetShareMem_AlarmActs :	VtGetShareMem_AlarmActs,
	VtAckGetShareMem_AlarmActs :	VtAckGetShareMem_AlarmActs,
};
