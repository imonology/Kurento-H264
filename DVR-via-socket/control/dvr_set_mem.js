var dvr_cmd_hdr = require('../constants/dvr_cmd_hdr.js');
var dvr_mem_hdr = require('../constants/dvr_mem_hdr.js');
var iconv = require("iconv-lite");

var null_term = new Buffer(1);
null_term.writeUInt8(0, 0);


var Camera = function (ch) {
	var tmp = new Buffer(9);
	this.data = new Buffer(16 * 28);
	this.data.fill('');
	for (var i = 0; i < 16; i++) {
		tmp.fill(0);
		this.data.writeUInt8(ch[i].Id, (0 + (i * 28)));
		// console.log(ch[i].Title);
		// console.log(ch[i].Title.length);
		// console.log(tmp.length);
		tmp = iconv.encode(ch[i].Title, "Big5");
		for (var j = 0; j < 9; j++) {
			// tmp.write(ch[i].Title, 0, tmp.length, 'utf8');
			// console.log(tmp[j]);
			this.data[(1 + (i * 28) + j)] = tmp[j];
			// console.log(this.data[(1 + (i * 28) + j)]);
		}
		switch (ch[i].Size) {
			case "":
				ch[i].Size = 0;
				break;
			case "FULL-D1":
				ch[i].Size = 1;
				break;
			case "HALF-D1":
				ch[i].Size = 2;
				break;
			case "CIF":
				ch[i].Size = 3;
				break;
			default:
				ch[i].Size = 0;
		}
		this.data.writeUInt8(ch[i].Size, (10 + (i * 28)));
		this.data.writeUInt8(ch[i].GroupId, (11 + (i * 28)));
		this.data.writeUInt8(ch[i].Standard, (12 + (i * 28)));
		this.data.writeUInt8(ch[i].Quality, (13 + (i * 28)));
		this.data.writeUInt8(ch[i].PreIPS, (14 + (i * 28)));
		this.data.writeUInt8(ch[i].NormalIPS, (15 + (i * 28)));
		this.data.writeUInt8(ch[i].AlarmIPS, (16 + (i * 28)));
		this.data.writeUInt8(ch[i].AudioCh, (17 + (i * 28)));
		this.data.writeUInt16LE(ch[i].PtzId, (18 + (i * 28)));
		this.data.writeUInt8(ch[i].CallDispEv0, (20 + (i * 28)));
		this.data.writeUInt8(ch[i].CallDispDw0, (21 + (i * 28)));
		this.data.writeUInt8(ch[i].CallDispEv1, (22 + (i * 28)));
		this.data.writeUInt8(ch[i].CallDispDw1, (23 + (i * 28)));
		this.data.writeUInt8((ch[i].Installed + (ch[i].Covered << 1) + (ch[i].MotionAct << 2)
			+ (ch[i].VLossAct << 3) + (ch[i].HDSize << 4) + (ch[i].Resolved << 6) + (ch[i].HD << 7)), (24 + (i * 28)));
		for (var j = 0; j < 3; j++) {
			this.data[(25 + (i * 28) + j)] = ch[i].reserved[j];
		}
	}
}

// var bstres = ["", "FULL-D1", "HALF-D1", "CIF"];
var setCameras = function (cameras) {
	var BestRes = new Buffer(1);
	// console.log(cameras.BestRes);
	switch (cameras.BestRes) {
		case "":
			cameras.BestRes = 0;
			break;
		case "FULL-D1":
			cameras.BestRes = 1;
			break;
		case "HALF-D1":
			cameras.BestRes = 2;
			break;
		case "CIF":
			cameras.BestRes = 3;
			break;
		default:
			cameras.BestRes = 0;
	}
	BestRes.writeUInt8(cameras.BestRes, 0);
	var Watermark = new Buffer(1);
	Watermark.writeUInt8(((cameras.Watermark === "on") ? 1 : 0), 0);
	var Compression = new Buffer(1);
	Compression.writeUInt8(((cameras.Compression === "HIGH") ? 1 : 0), 0);
	var reserved = new Buffer(1);
	reserved.writeUInt8(cameras.reserved, 0);
	var ch = new Camera(cameras.ch);
	this.data = new Buffer.concat([BestRes, Watermark, Compression, reserved, ch.data]);
	console.log(JSON.stringify(this.data));
}

var setActionData = function (act) {
	this.data = new Buffer(160);
	this.data.fill('');
	for (var i = 0; i < 16; i++) {
		this.data.writeUInt16LE(act.ActionData[i].Duration, 0 + (10 * i));
		this.data.writeUInt8((act.ActionData[i].Log + (act.ActionData[i].Buzzer << 1)
		    + (act.ActionData[i].Mail << 2) + (act.ActionData[i].FTPOut << 3)
		    + (act.ActionData[i].NetAlarm << 4) + (act.ActionData[i].ScrnMsg << 5)), 2 + (10 * i));
		this.data.writeUInt8(act.ActionData[i].AlarmOut, 3 + (10 * i));
		this.data.writeUInt8(act.ActionData[i].FocusCh, 4 + (10 * i));
		this.data.writeUInt8(act.ActionData[i].GoToPreset, 5 + (10 * i));
		this.data.writeUInt16LE(act.ActionData[i].PreRecord, 6 + (10 * i));
		this.data.writeUInt16LE(act.ActionData[i].PostRecord, 8 + (10 * i));
	}
}

var setHDDFullAct = function (hdd) {
	this.data = new Buffer(dvr_mem_hdr.HDD_FULL_ACT.length);
	this.data.fill('');
	this.data.writeUInt16LE(hdd.HDDFullAct.Duration, 0);	
	this.data.writeUInt8((hdd.HDDFullAct.Log + (hdd.HDDFullAct.Buzzer << 1)
	    + (hdd.HDDFullAct.ScrnMsg << 2) + (hdd.HDDFullAct.Mail << 3)
	    + (hdd.HDDFullAct.NetAlarm << 4) + (hdd.HDDFullAct.AutoOverwrite << 5)
	    + (hdd.HDDFullAct.FullAct << 6) + (hdd.HDDFullAct.Reserved << 7)), 2);
	this.data.writeUInt8(hdd.HDDFullAct.AlarmOut, 3);	
	this.data.writeUInt16LE(hdd.HDDFullAct.Notify, 4);	
}

var FtpPrefix = function (prefix) {
	var id = new Buffer(1);
	id.writeUInt8(prefix.id, 0);

	var str = new Buffer(8);
	str.fill('');
	str.write(prefix.str);

	var checksum = new Buffer(1);
	checksum.writeUInt8(prefix.checksum, 0);

	this.buf = new Buffer.concat([id, str, checksum]);
	
}

var setAux_Ftp = function (ftp) {
	var host = new Buffer(81);
	host.fill('');
	host.write(ftp.Aux_FtpParam.host);

	var username = new Buffer(41);
	username.fill('');
	username.write(ftp.Aux_FtpParam.username);

	var password = new Buffer(31);
	password.fill('');
	password.write(ftp.Aux_FtpParam.password);

	var prefix = new FtpPrefix(ftp.Aux_FtpParam.prefix);
	this.data = new Buffer.concat([host, username, password, prefix.buf]);
}

var Aux_SerialParam = function (serial) {
	this.buf = new Buffer(24);
	for (var i = 0; i < 2; i++) {
		this.buf.writeUInt8(serial[i].connection_type, 0 + (i * 12));
		this.buf.writeUInt8(serial[i].model_index, 1 + (i * 12));
		this.buf.writeUInt8(serial[i].comPort, 2 + (i * 12));
		this.buf.writeUInt32LE(serial[i].baudrate, 3 + (i * 12));
		this.buf.writeUInt8(serial[i].databits, 7 + (i * 12));
		this.buf.writeUInt8(serial[i].stopbits, 8 + (i * 12));
		this.buf.writeUInt8(serial[i].parity, 9 + (i * 12));
		this.buf.writeUInt16LE(serial[i].deviceId, 10 + (i * 12));
	}
}

var setAux_Serials = function (serials) {
	var NumOfSerials = new Buffer(1);
	NumOfSerials.writeUInt8(serials.Aux_Serials.NumOfSerials, 0);
	var serial = new Aux_SerialParam(serials.Aux_Serials.serial);
	this.data = new Buffer.concat([NumOfSerials, serial.buf]);
}

var Attachment = function (attach) {
	var id = new Buffer(1);
	id.writeUInt8(attach.id, 0);
	var type = new Buffer(1);
	type.writeUInt8(attach.type, 0);
	var reserved = new Buffer(7);
	reserved.fill('');
	reserved.write(attach.reserved);
	var checksum = new Buffer(1);
	checksum.writeUInt8(attach.checksum, 0);
	this.buf = new Buffer.concat([id, type, reserved, checksum]);
}

var setAux_Mail = function (mail) {
	var SMTPAddr = new Buffer(71);
	SMTPAddr.fill('');
	var attachFile = new Attachment(mail.Aux_Mail.attachFile);
	var NeedAuth = new Buffer(1);
	NeedAuth.writeUInt8(mail.Aux_Mail.NeedAuth, 0);
	var User = new Buffer(41);
	User.fill('');
	User.write(mail.Aux_Mail.User);
	var Password = new Buffer(41);
	Password.fill('');
	Password.write(mail.Aux_Mail.Password);
	var MailFrom = new Buffer(81);
	MailFrom.fill('');
	MailFrom.write(mail.Aux_Mail.MailFrom);
	var NumofMailTos = new Buffer(1);
	NumofMailTos.writeUInt8(mail.Aux_Mail.NumofMailTos, 0);
	var MailTo = new Buffer(405);
	MailTo.fill('');
	for (var i = 0; i < 5; i++) {
		MailTo.write(mail.Aux_Mail.MailTo[i], (0 + (i * 81)), 81);
	}
	this.data = new Buffer.concat([SMTPAddr, attachFile.buf, NeedAuth, User, Password, MailFrom, NumofMailTos, MailTo]);
}

var setAuthData = function (auth) {
	this.buf = new Buffer(558);
	this.buf.fill('');
	for (var i = 0; i < 18 && auth[i]; i++) {
		var user = new Buffer(15);
		user.fill(0);
		var passwd = new Buffer(15);
		passwd.fill(0);
		var level = new Buffer(1);
		user.write(auth[i].username);
		console.log(auth[i].username);
		passwd.write(auth[i].password);
		level.writeUInt8(auth[i].level, 0);
		for (var j = 0; j < 15; j++) {
			this.buf[(i * 31) + j] = user[j];
			this.buf[(i * 31) + 15 + j] = passwd[j];
		}
		this.buf[(i * 31) + 30] = level[0];
	}
}

var setAuth = function (auth) {
	var AuthData = new setAuthData(auth.AuthData);
	var defaultLogin = new Buffer(1);
	defaultLogin.writeUInt8(auth.defaultLogin, 0);
	this.data = new Buffer.concat([AuthData.buf, defaultLogin]);
}

var setStaticIp = function (sip) {
	this.buf = new Buffer(16);
	for (var i = 0; i < 4; i++) {
		this.buf.writeUInt8(parseInt(sip.ip.split(".")[i]), i);
		this.buf.writeUInt8(parseInt(sip.mask.split(".")[i]), i + 4);
		this.buf.writeUInt8(parseInt(sip.router.split(".")[i]), i + 8);
		this.buf.writeUInt8(parseInt(sip.DNS.split(".")[i]), i + 12);
	}
}

var setPPPoe = function (pppoe) {
//	this.buf = new Buffer(31 * 2 + 1 + 41 * 2 + 71);
//	this.buf.fill('');
	var username = new Buffer(31);
	var password = new Buffer(31);
	var dns_type = new Buffer(1);
	var dns_name = new Buffer(41);
	var dns_pswd = new Buffer(41);
	var pppoeurl = new Buffer(71);
	username.fill('');
	username.write(pppoe.username);
	password.fill('');
	password.write(pppoe.password);
	dns_type.writeUInt8(pppoe.dns_type, 0);
	dns_name.fill('');
	dns_name.write(pppoe.dns_account_name);
	dns_pswd.fill('');
	dns_pswd.write(pppoe.dns_account_password);
	pppoeurl.fill('');
	pppoeurl.write(pppoe.URL);
	this.buf = new Buffer.concat([username, password, dns_type, dns_name, dns_pswd, pppoeurl]);
}

var setAdvNetwork = function (adv) {
	this.buf = new Buffer(10);
	this.buf.writeUInt8(adv.id, 0);
	this.buf.writeUInt16LE(adv.ctrl_port, 1);
	this.buf.writeUInt16LE(adv.data_port, 3);
	this.buf.writeUInt8(adv.wap_pic_quality, 5);
	this.buf.writeUInt16LE(adv.http_port, 6);
	this.buf.writeUInt8(adv.reserved, 8);
	this.buf.writeUInt8(adv.checksum, 9);
}

var setNetwork = function (net) {
	var net_type = new Buffer(1);
	net_type.writeUInt8(net.net_type, 0);
	var sip = new setStaticIp(net.sip);
	var pppoe = new setPPPoe(net.pppoe);
	var adv_network = new setAdvNetwork(net.adv_network);
	this.data = new Buffer.concat([net_type, sip.buf, pppoe.buf, adv_network.buf]);
}

var setTZone = function (tzone) {
//	var dt_format = [];
	this.buf = new Buffer(13);
	this.buf.writeUInt8(tzone.index, 0);
	this.buf.writeUInt16LE(tzone.offset_hour, 1);
	this.buf.writeUInt16LE(tzone.offset_min, 3);
	this.buf.writeUInt8(tzone.isDSTEnable, 5);
	this.buf.writeUInt8(tzone.DST.s_month, 6);
	this.buf.writeUInt8(tzone.DST.s_day, 7);
	this.buf.writeUInt8(tzone.DST.s_hour, 8);
	this.buf.writeUInt8(tzone.DST.e_month, 9);
	this.buf.writeUInt8(tzone.DST.e_month, 10);
	this.buf.writeUInt8(tzone.DST.e_month, 11);
	this.buf.writeUInt8(tzone.DateTimeFormat, 12);
//	this.buf.writeUInt8(dt_format[tzone.DateTimeFormat]);
/*	if (tzone.DateTimeFormat == "YY/MM/DD HH:MM") {
		this.buf.writeUInt8(0, 12);
	}
	else if (tzone.DateTimeFormat == "MM/DD/YY HH:MM") {
		this.buf.writeUInt8(1, 12);
	}
	else if (tzone.DateTimeFormat == "DD/MM/YY HH:MM") {
		this.buf.writeUInt8(2, 12);
	}*/
}

var setTSync = function (tsync) {
	this.buf = new Buffer(66);
	this.buf.writeUInt8(tsync.isEnable, 0);
//	var tsp_type = [];
//	console.log(tsync.TSPType);
//	this.buf.writeUInt8(tsp_type[tsync.TSPType]);
	this.buf.writeUInt8(tsync.TSPType, 0);
	var tsp = new Buffer(65);
	tsp.fill('');
	tsp.write(tsync.TSP);
	for (var i = 0;  i < 65; i++) {
		this.buf[i + 1] = tsp[i];
	}
}

var setSysData = function (sysdata) {
//	var lang = [];
//	console.log(JSON.stringify(sysdata.TimeSync));
	var TimeSync = new setTSync(sysdata.TimeSync);
	var TimeZone = new setTZone(sysdata.TimeZone);
	var language = new Buffer(1);
//	language.writeUInt8(lang[sysdata.language], 0);
	language.writeUInt8(sysdata.language, 0);
	console.log(JSON.stringify(language));
	var protectionKey = new Buffer(20);
	protectionKey.fill('');
	protectionKey.write(sysdata.protectionKey);
/*	for (var i = 0; i < 20; i++) {
		protectionKey[i] = sysdata.protectionKey[i]; 
	}
*/
	/* 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 */
	/* # # # # # # # # # # #  #  #  #  #  #  0  0  0  0  */
	/* # # # # 0 # # # # 0 #  #  #  #  0  #  #  #  #  0  */
	for (var i = 0; i < 3; i++) {
		protectionKey[18 - (5 * i)] = protectionKey[15 - (4 * i)];
		protectionKey[17 - (5 * i)] = protectionKey[14 - (4 * i)];
		protectionKey[16 - (5 * i)] = protectionKey[13 - (4 * i)];
		protectionKey[15 - (5 * i)] = protectionKey[12 - (4 * i)];
		protectionKey[14 - (5 * i)] = '';
	}
	this.data = new Buffer.concat([TimeSync.buf, TimeZone.buf, /*null_term, */language, protectionKey]);
//	console.log(JSON.stringify(this.data));
}

var setAlarmIns = function (ais) {
	var tmp = new Buffer(9);
	this.buf = new Buffer(16 * 12);
	this.buf.fill(0);
	for (var i = 0; i < 16; i++, tmp.fill(0)) {
		this.buf.writeUInt8(ais.pin[i].Installed, (0 + (12 * i)));
		tmp.write(ais.pin[i].Title, 0, tmp.length, 'binary');
		for (var j = 0; j < 9; j++) {
			this.buf[(1 + (12 * i) + j)] = tmp[j];
		}
		this.buf.writeUInt8(ais.pin[i].NormalOpen, (10 + (12 * i)));
		this.buf.writeUInt8((ais.pin[i].AIAct + (ais.pin[i].Delay << 1)), (11 + (12 * i)));
	}
	this.data = this.buf;
}

/**
 * {
 * 	{1, 0, 0, 0, 0, 1, 1, 0 ...}
 * 	{0, 1, 1, 1, 0, 1, 1, 1 ...}
 * 	{0, 1, 1, 1, 0, 1, 1, 1 ...}
 * 	{0, 1, 1, 1, 0, 1, 1, 1 ...}
 * 	.
 * 	.
 * 	.
 * }	-> 0xFFC000A1, 0xFFC000BB wtf...
 *
 */
var mattr_wrapper = function (map, Rows, Cols) {
	var mask;
	for (var i = Cols; i < 32; i++) { // 4 bytes
		mask =  mask + (1 << i);
	}
	console.log(mask);
	this.WinRow = [];
	for (var i = 0; i < Rows; i++) {
		for (var j = 0; j < Cols; j++) {
			this.WinRow[i] += (map[i][j] << j) + mask;
		}
	}
	for (var i = Rows; i < 24; i++) { // WinRow[24]
		this.WinRow[i] = 0xFFFFFFFF;
	}
}

var setMotionAttr = function (ch) {
	this.buf = new Buffer(1600);
	for (var i = 0; i < 16; i++) {
		this.buf.writeUInt8(ch[i].Sensitivity, (0 + (i * 100)));
		this.buf.writeUInt8(ch[i].GridCnts, (1 + (i * 100)));
		this.buf.writeUInt8(ch[i].Rows, (2 + (i * 100)));
		this.buf.writeUInt8(ch[i].Cols, (3 + (i * 100)));
		for (var j = 0; j < 24; j++) {
			this.buf.writeUInt32LE(ch[i].WinRow[j], (4 + (i * 100) + (j * 4)));
		}
	}
	console.log(ch);
}

var setMotionAttrs = function (mattrs) {
	var rows = new Buffer(2);
//	console.log(mattrs);
	rows.writeUInt16LE(mattrs.rows, 0);
	var cols = new Buffer(2);
	cols.writeUInt16LE(mattrs.cols, 0);
	var ch = new setMotionAttr(mattrs.ch);
	this.data = new Buffer.concat([rows, cols, ch.buf]);
}

var VtShareMemSet = function (key, obj) {
// 	if (obj.share_mem_id)
// find id, length and compare
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_SET_SHARE_MEM, key.length + 4);
	console.log(JSON.stringify(header.data));
	console.log(JSON.stringify(obj.data));
	var id = new Buffer(4);
	id.fill(0);
	id.writeUInt32LE(key.id, 0);
	this.data = new Buffer.concat([header.data, id, obj.data]);
//	console.log(dvr_mem_hdr.MOTION_ACTS.id);
	console.log(JSON.stringify(this.data));
}

var VtUpdateShareMem = function () {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_UPDATE_SHARE_MEM, 0);
	this.data = header.data;
}

module.exports = {
	setActionData :			setActionData,
	setAuth :			setAuth,
	setNetwork :			setNetwork,
	setSysData :			setSysData,
	setHDDFullAct :			setHDDFullAct,
	setAux_Ftp :			setAux_Ftp,
	setAux_Serials :		setAux_Serials,
	setAux_Mail :			setAux_Mail,
	setAlarmIns :			setAlarmIns,
	setMotionAttrs :		setMotionAttrs,
	setCameras :			setCameras,
	VtShareMemSet :                 VtShareMemSet,
	VtUpdateShareMem :		VtUpdateShareMem,
}
