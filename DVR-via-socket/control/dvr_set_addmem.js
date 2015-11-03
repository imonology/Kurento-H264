var dvr_cmd_hdr = require('../constants/dvr_cmd_hdr.js');
var dvr_addmem_hdr = require('../constants/dvr_addmem_hdr.js');

var null_term = new Buffer(1);
null_term.writeUInt8(0, 0);

exports.setCamerasEx = function (cam) {
	this.data = new Buffer(dvr_addmem_hdr.CamsAttrEx.length);
	this.data.fill('');
	this.data.writeUInt32LE(cam.version, 0);
//	console.log(cam);

	for (var i = 0; i < 16; i++) {
		this.data.writeUInt16LE(cam.PMask[i].numOfMasks, (4 + (i * 76)));
		this.data.writeUInt16LE(cam.PMask[i].color, (6 + (i * 76)));
		for (var j = 0; j < cam.PMask[i].numOfMasks; j++) {
			this.data.writeUInt8(cam.PMask[i].x[j], (8 + (i * 76) + j));
			this.data.writeUInt8(cam.PMask[i].y[j], (24 + (i * 76) + j));
			this.data.writeUInt8(cam.PMask[i].width[j], (40 + (i * 76) + j));
			this.data.writeUInt8(cam.PMask[i].height[j], (56 + (i * 76) + j));
		}
		console.log(cam.PMask[i]);
	}
}

exports.VtSetAddShareMems = function (key, obj) {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_SET_ADDITIONAL_SHARE_MEMS, key.length + 12);
	var counts = new Buffer(4);
	counts.fill(0);
	counts.writeUInt32LE(1, 0);

	var id = new Buffer(4);
	id.fill(0);
	id.writeUInt32LE(key.id, 0);

	var length = new Buffer(4);
	length.fill(0);
	length.writeUInt32LE(key.length, 0);

	this.data = new Buffer.concat([header.data, counts, id, length, obj.data]);
	console.log(JSON.stringify(this.data));
}

exports.VtUpdateAddShareMems = function () {
	var header = new dvr_cmd_hdr.header(true, dvr_cmd_hdr.VTC_UPDATE_ADDITIONAL_SHARE_MEMS, 1);
	this.data = new Buffer.concat([header.data, null_term]);
}
