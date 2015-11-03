var dvr_addmem_hdr = require('../constants/dvr_addmem_hdr.js');
var dvr_cmd_hdr = require('../constants/dvr_cmd_hdr.js');

var PrivacyMask = function (buf) {
	this.numOfMasks = buf.readUInt16LE(0);
	this.color = buf.readUInt16LE(2);
	this.x = [];
	this.y = [];
	this.width = [];
	this.height = [];
	for (var i = 0; i < 16; i++) {
		this.x[i] = buf.readUInt8(4 + i);
		this.y[i] = buf.readUInt8(20 + i);
		this.width[i] = buf.readUInt8(36 + i);
		this.height[i] = buf.readUInt8(52 + i);
	}
	this.reserved = buf.slice(68, buf.length);
}

var CamerasEx = function (buf) {
	this.version = buf.readUInt32LE(0);
	this.PMask = [];
	for (var i = 0; i < 16; i++) {
		this.PMask[i] = new PrivacyMask(buf.slice((4 + (76 * i)), (80 + (76 * i))));
	}
	this.reserved = buf.slice(1220, buf.length);
}

var VtAddShareMem = function (buf) {
	this.share_mem_id = buf.readUInt32LE(0);
	this.length = buf.readUInt32LE(4);
	switch (this.length) {
		case dvr_addmem_hdr.CamsAttrEx.length:
			this.data = new CamerasEx(buf.slice(8, buf.length));
	}
}

var VtAddShareMemsAccess = function (buf) {
	this.counts = buf.readUInt32LE(0);
	this.VtAddShareMem = new VtAddShareMem(buf.slice(4, buf.length));
}

exports.VTS_ACK_GET_ADDITIONAL_SHARE_MEMS_CamsAttrEx = function (data) {
	var ack = new Buffer(8 + 12 + dvr_addmem_hdr.CamsAttrEx.length); // header, VtAddShareMemsAccess, VtAddShareMem, CamsAttrEx
        ack.write(data, 0, ack.length, 'binary');
        this.VtAddShareMemsAccess = new VtAddShareMemsAccess(ack.slice(8, ack.length));
}

exports.VtGetAddShareMems = function (key) {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_GET_ADDITIONAL_SHARE_MEMS, 260);

	var counts = new Buffer(4);
	counts.writeUInt32LE(1, 0);
	
	var id = new Buffer(256);
	id.fill(0);
	id.writeUInt32LE(key, 0);

	this.data = new Buffer.concat([header.data, counts, id]);
}
