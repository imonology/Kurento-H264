var dvr_cmd_hdr = require('../constants/dvr_cmd_hdr.js');
var dvr_mem_hdr = require('../constants/dvr_mem_hdr.js');

var HDDFullAct = function (buf) {
	this.Duration = buf.readUInt16LE(0);	// Duration time: 0(Unlimited), 3, 5, 10, 15, 20, 30, 40, 50, 60,
						// 120, 180, 300, 600, 900, 1200, 1800, 2400, 3000, 3600
						// Refer to duration_table[]
	this.Log = (buf.readUInt8(2) % 2) ? "On" : "Off";	// 1=Log On, 0=Off
	this.Buzzer = ((buf.readUInt8(2) >> 1) % 2) ? "On" : "Off";	// 1=Buzzer On, 0=Off
	this.ScrnMsg = ((buf.readUInt8(2) >> 2) % 2) ? "On" : "Not";	// 1=Screen Message, 0=Not
	this.Mail = ((buf.readUInt8(2) >> 3) % 2) ? "Send Mail" : "Not";	// 1=FTP Out, 0=Not
	this.NetAlarm = ((buf.readUInt8(2) >> 4) % 2);	// Reserved
	this.AutoOverWrite = ((buf.readUInt8(2) >> 5) % 2) ? "Auto" : "Not";	// 1=Auto overwrite, 0=Not

	this.FullAct = ((buf.readUInt8(2) >> 6) % 2) ? "On" : "Not";	// 1=Hdd Full Action, 0=Not
	this.Reserved = ((buf.readUInt8(2) >> 7) % 2);

	this.AlarmOut = buf.readUInt8(3);	// 0~(MAX_AO-1), Invalid=INVALID_BYTE_VALUE
	this.Notify = buf.readUInt16LE(4);	// Reserved
}

var VtAckGetShareMem_HDDFullAct = function (data) {
	var ack = new Buffer(8 + dvr_mem_hdr.HDD_FULL_ACT.length);
	ack.write(data, 0, ack.length, 'binary');
	this.HDDFullAct = new HDDFullAct(ack.slice(8, 14));
}

var FtpPrefix = function (buf) {
	this.id = buf.readUInt8(0);
	this.str = buf.slice(1, 9).toString("utf8").split("\u0000")[0];
/*	this.str = new Buffer(8);
	this.str.fill('');
	for (var i = 0; i < 8; i++) {
		this.str[i] = buf[i + 1];
	}*/
	this.checksum = buf.readUInt8(9);
	
}

var Aux_FtpParam = function (buf) {
	this.host = buf.slice(0, 81).toString("utf8").split("\u0000")[0];
/*	this.host = new Buffer(81);
	this.host.fill('');
	for (var i = 0; i < 81; i++) {
		this.host[i] = buf[i];
	}*/
	this.username = buf.slice(81, 122).toString("utf8").split("\u0000")[0];
/*	this.username = new Buffer(41);
	this.username.fill('');
	for (var i = 0; i < 41; i++) {
		this.username[i] = buf[i + 81];
	}*/
	this.password = buf.slice(122, 153).toString("utf8").split("\u0000")[0];
/*	this.password = new Buffer(31);
	this.password.fill('');
	for (var i = 0; i < 31; i++) {
		this.password[i] = buf[i + 81 + 41];
	}*/
	this.prefix = new FtpPrefix(buf.slice(81+41+31, buf.length));
}

var VtAckGetShareMem_Aux_Ftp = function (data) {
	var ack = new Buffer(8 + dvr_mem_hdr.AUX_FTP.length);
	ack.write(data, 0, ack.length, 'binary');
	this.Aux_FtpParam = new Aux_FtpParam(ack.slice(8, ack.length));
}

var Aux_SerialParam = function (buf) {
	var conntype = ["NULL_TYPE", "PTZ_TYPE", "REMOTE_CTRL_TYPE", "", "GPS_TYPE", "", "", "", "POS_TYPE"];
	var ptz = ["Pelco - Pelco(D-Type)", "Samsung - SCC-641P", "Lilin - PIH-Series", "DynaColor - DynaColor", "Kalatel - Kalatel", "Bosch - Bosch AutoDome", "Auviss - Video Trek", "FUJISOFT - PTC-400C", "FUJISOFT - VC-C4"];
	var model = ["TERMINAL_MODEL", "KEYBOARD_MODEL"];
	var _parity = ["NONE", "ODD", "EVEN"];
	this.connection_type = conntype[buf.readUInt8(0)];
	switch (buf.readUInt8(0)) {
	case 1:
		this.model_index = ptz[buf.readUInt8(1)];
		break;
	case 2:
		this.model_index = model[buf.readUInt8(1)];
		break;
	case 4:
		this.model_index = "NMEA_0183_MODEL";
		break;
	default:
		this.model_index = buf.readUInt8(1);
	}
	this.comPort = buf.readUInt8(2);
	this.baudrate = buf.readUInt32LE(3);
	this.databits = buf.readUInt8(7);
	this.stopbits = buf.readUInt8(8);
	this.parity = _parity[buf.readUInt8(9)];
	this.deviceId = buf.readUInt16LE(10);
}

var Aux_Serials = function (buf) {
	this.NumOfSerials = buf.readUInt8(0);
	console.log(buf.length);
	this.serial = [];
	for (var i = 0; i < 2; i++) {
		this.serial[i] = new Aux_SerialParam(buf.slice((1 + (12 * i)), 13 + (12 * i)));
	}
}

var VtAckGetShareMem_Aux_Serials = function (data) {
	var ack = new Buffer(8 + dvr_mem_hdr.AUX_SERIAL.length);
	ack.write(data, 0, ack.length, 'binary');
	this.Aux_Serials = new Aux_Serials(ack.slice(8, ack.length));
}

var Attachment = function (buf) {
	var _type = ["ATTACH_NONE", "ATTACH_ORG_IMAGE", "ATTACH_QCIF_IMAGE", "ATTACH_CIF_IMAGE"];
	this.id = buf.readUInt8(0);
	this.type = _type[buf.readUInt8(1)];
	this.reserved = buf.slice(2, 9).toString("utf8").split("\u0000")[0];
	this.checksum = buf.readUInt8(9);
}

var Aux_Mail = function (buf) {
//	this.SMTPAddr = new Buffer(71);
	this.SMTPAddr = buf.slice(0, 71).toString("utf8").split("\u0000")[0];
	this.attachFile = new Attachment(buf.slice(71, 81));
	this.NeedAuth = buf.readUInt8(81);
	this.User = buf.slice(82, 123).toString("utf8").split("\u0000")[0]; // new Buffer(41);
	this.Password = buf.slice(123, 164).toString("utf8").split("\u0000")[0]; // new Buffer(41);
	this.MailFrom = buf.slice(164, 245).toString("utf8").split("\u0000")[0]; // new Buffer(81);
	this.NumofMailTos = buf.readUInt8(245);
	this.MailTo = [];
	for (var i = 0; i < 5; i++) {
		this.MailTo[i] = buf.slice((246 + (81 * i)), (246 + (81 * (i + 1)))).toString("utf8").split("\u0000")[0];
	}
}

var VtAckGetShareMem_Aux_Mail = function (data) {
	var ack = new Buffer(8 + dvr_mem_hdr.AUX_MAIL.length);
	ack.write(data, 0, ack.length, 'binary');
	this.Aux_Mail = new Aux_Mail(ack.slice(8, ack.length));

}

var AlarmIn = function (buf) {
	this.Installed = (buf.readUInt8(0)) ? "Install" : "Not";
	this.Title = buf.slice(1, 9).toString("utf8").split("\u0000")[0]; // Reserved
	this.NormalOpen = (buf.readUInt8(10)) ? "Normal Open" : "Not";
	this.AIAct = (buf.readUInt8(11) % 2) ? "Alarm Input Action" : "Not";
	this.Delay = (buf.readUInt8(11) >> 1); // delay time
}

var VtAckGetShareMem_AlarmIns = function (data) {
	var ack = new Buffer(8 + dvr_mem_hdr.AIS_ATTR.length);
	ack.write(data, 0, ack.length, 'binary');
	this.pin = [];
	for (var i = 0; i < 16; i++) {
		this.pin[i] = new AlarmIn(ack.slice((8 + (12 * i)), (24 + (12 * i))));
	}
}

var MotionAttrs = function (buf) {
	this.Sensitivity = buf.readUInt8(0);
	this.GridCnts = buf.readUInt8(1);
	this.Rows = buf.readUInt8(2);
	this.Cols = buf.readUInt8(3);
	this.WinRow = [];
	for (var i = 0; i < 24; i++) {
		this.WinRow[i] = buf.readUInt32LE(4 + (4 * i));
	}
}

var VtAckGetShareMem_MotionAttrs = function (data) {
	var ack = new Buffer(8 + dvr_mem_hdr.MOTION_ATTRS.length);
	ack.write(data, 0, ack.length, 'binary');
	this.rows = ack.readUInt16LE(8);
	this.cols = ack.readUInt16LE(10);
	this.ch = [];
	for (var i = 0; i < 16; i++) {
		this.ch[i] = new MotionAttrs(ack.slice((12 + (i * 100)), (112 + (i * 100))));
	}
}

var RecSchedule = function (buf) {
	this.NumOfSlots = buf.readUInt8(0);
	this.SHour = [];
	this.SMin = [];
	this.NormalRec = [];
	this.AlarmRec = [];
	this.MotionRec = [];
	for (var i = 0; i < 16; i ++) {
		this.SHour[i] = buf.readUInt8(1 + i);
		this.SMin[i] = buf.readUInt8(17 + i);
		this.NormalRec[i] = buf.readUInt8(33 + i);
		this.AlarmRec[i] = buf.readUInt8(49 + i);
		this.MotionRec[i] = buf.readUInt8(65 + i);
	}
}

var RecWeekSch = function (buf) {
	this.day = [];
	for (var i = 0; i < 7; i++) {
		this.day[i] = new RecSchedule(buf.slice((0 + (i * 81)), (81 + (i * 81))));
	}
}

var VtAckGetShareMem_RecWeekSch = function (data) {
	var ack = new Buffer(8 + dvr_mem_hdr.RECORD_WEEK_SCHEDULE.length);
	ack.write(data, 0, ack.length, 'binary');
	this.Individual = ack.readUInt8(8);
	this.ch = new RecWeekSch(ack.slice(9, ack.length));
	
}

var VtGetShareMem = function (key) {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_GET_SHARE_MEM, 4);

	this.id = new Buffer(4);
	this.id.fill(0);
	this.id.writeUInt32LE(key.id, 0);

	this.data = new Buffer.concat([header.data, this.id]);
}

/*var VtGetAddShareMems = function () {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_GET_ADDITIONAL_SHARE_MEMS, 8);
	this.counts = new Buffer(4);
	this.share_mem_id = new Buffer(4 * 64);
	this.counts.fill('');
	this.counts.writeUInt32LE(-1, 1);
	for (var i = 0; i < 64; i+=4) {
		this.share_mem_id.writeUInt32LE(i / 4, i);
	}
}*/

module.exports = {
	VtGetShareMem :			VtGetShareMem,
	VtAckGetShareMem_HDDFullAct :	VtAckGetShareMem_HDDFullAct,
	VtAckGetShareMem_Aux_Ftp :	VtAckGetShareMem_Aux_Ftp,
	VtAckGetShareMem_Aux_Serials :	VtAckGetShareMem_Aux_Serials,
	VtAckGetShareMem_Aux_Mail :	VtAckGetShareMem_Aux_Mail,
	VtAckGetShareMem_AlarmIns :	VtAckGetShareMem_AlarmIns,
	VtAckGetShareMem_MotionAttrs :	VtAckGetShareMem_MotionAttrs,
	VtAckGetShareMem_RecWeekSch :	VtAckGetShareMem_RecWeekSch,
}
