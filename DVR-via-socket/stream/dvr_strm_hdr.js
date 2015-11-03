var PESHead = function(data) {
	if (data != null && data.length >= 6) {
		var pes_head = new Buffer(33);
		pes_head.write(data, 0, pes_head.length, 'binary');
		this.prefix = new Buffer(3);
		this.prefix.fill('');
		for (var i = 0; i < 3; i++) {
			this.prefix[i] = pes_head[i];
		}
		// this.prefix = pes_head.slice(0, 2).toString().split("\u0000")[0];
		this.strm_id = pes_head.readUInt8(3);
		// Stream id, 1 byte, Examples: Audio streams (0xC0-0xDF), Video streams (0xE0-0xEF)
		// Note: The above 4 bytes is called the 32 bit start code. Says wiki.

		this.strm_len_hi = pes_head.readUInt8(4);
		this.strm_len_lo = pes_head.readUInt8(5);
		this.Length = pes_head.readUInt16BE(4);
		// PES Packet length, 2 bytes, Can be zero.
		// If the PES packet length is set to zero, the PES packet can be of any length.
		// A value of zero for the PES packet length can be used only when the PES packet payload is a video elementary stream.

		// Note: The above 6 bytes is PES header, pes data start from next byte.
		if (data.length < 32) {
			return this;
		}
		this.pes_attr = pes_head.readUInt8(6);
		this.pes_flag = pes_head.readUInt8(7);
		this.pes_header_data_len = pes_head.readUInt8(8);	// 0x17
		this.pts_32_30 = pes_head.readUInt8(9);			// '0011' + 3 bits + mark bit(0) 
		this.pts_29_22 = pes_head.readUInt8(10);
		this.pts_21_15 = pes_head.readUInt8(11);		// mark bit(0) + 7 bits  
		this.pts_14_7 = pes_head.readUInt8(12);
		this.pts_6_0 = pes_head.readUInt8(13);			// mark bit(0) + 7  bits
		this.dts_32_30 = pes_head.readUInt8(14);		// '0001' + 3 bits + mark bit(0) 
		this.dts_29_22 = pes_head.readUInt8(15);
		this.dts_21_15 = pes_head.readUInt8(16);		// mark bit(0) + 7 bits  
		this.dts_14_7 = pes_head.readUInt8(17);
		this.dts_6_0 = pes_head.readUInt8(18);			// mark bit(0) + 7  bits
		this.pes_ext_flag = pes_head.readUInt8(19);
		this.pes_ext_field_len = pes_head.readUInt8(20);	// mark bit(7) + 7 bits, 0x8b
		this.pes_prev_pkt_len_21_15 = pes_head.readUInt8(21);	// mark bit(7) + 7 bits
		this.pes_prev_pkt_len_14_8 = pes_head.readUInt8(22);	// mark bit(3) + 7 bits
		this.pes_prev_pkt_len_7_0 = pes_head.readUInt8(23);    
		this.pes_curr_pkt_len_21_15 = pes_head.readUInt8(24);	// mark bit(7) + 7 bits
		this.pes_curr_pkt_len_14_8 = pes_head.readUInt8(25);	// mark bit(3) + 7 bits
		this.pes_curr_pkt_len_7_0 = pes_head.readUInt8(26);    
		this.app_specified_field1 = pes_head.readUInt8(27);
		this.app_specified_field2 = new Buffer(4);
		this.app_specified_field2.fill('');
		for (var i = 0; i < 4; i++) {
			this.app_specified_field2[i] = pes_head[i + 28];
		}
	}
}

var FrameHead = function(data) {
	if (data != null && data.length > 11) {
		var frame_head = new Buffer(data.length); // 92 + 28 = 120
		frame_head.write(data, 0, frame_head.length, 'binary');
/*		this.ID = new Buffer(8);
		this.ID.fill('');
		for (var i = 0; i < 8; i++) {
			this.ID[i] = frame_head[i];
		}*/
		this.ID = frame_head.slice(0, 8).toString().split("\u0000")[0]; // pteeeld'\0'
		this.Version = frame_head.readUInt8(8);
		this.Ch = frame_head.readUInt8(9);
		this.AudioCh = frame_head.readUInt8(10);
		if (data.length < 92) {
			return this;
		}
/*		this.CameraTag = new Buffer(11);
		this.CameraTag.fill('');
		for (var i = 0; i < 9; i++) {
			this.CameraTag[i] = frame_head[i + 39];
		}*/
		this.CameraTag = frame_head.slice(11, 20).toString().split("\u0000")[0];
		this.CameraTagRes = new Buffer(2);
		this.CameraTagRes.fill('');
		for (var i = 0; i < 2; i++) {
			this.CameraTagRes[i] = frame_head[i + 20];
		}
		this.StreamType = frame_head.readUInt8(22);
		// Type: AudioStream, VideoStream, DataStream
		this.FrameType = frame_head.readUInt8(23);
		// Type: IFrame, PFrame, BFrame, GPSFrame, POSFrame
		this.EncStandard = frame_head.readUInt8(24);
		// Standard: MPEG4, H264
		this.EncSize = frame_head.readUInt8(25);
		// Size: FULL_D1, HALF_D1, CIF
		this.iIPS = frame_head.readUInt8(26);
		this.oIPS = frame_head.readUInt8(27);
		this.Length = frame_head.readUInt32LE(28);
		this.TimeCode = frame_head.readUInt16LE(32);
		this.Status = frame_head.readUInt8(34);
/*		this.Reserved1 = new Buffer(5);
		this.Reserved1.fill('');
		for (var i = 0; i < 5; i++) {
			this.Reserved1[i] = frame_head[i + 35];
		}
*/
		// Video system, should be "NTSC" or "PAL0"
		this.Sec = frame_head.readUInt32LE(40);
		this.Ms = frame_head.readUInt32LE(44);
		this.HiPTS = frame_head.readUInt32LE(48);
		this.LoPTS = frame_head.readUInt32LE(52);
		this.OffPrevGop = frame_head.readUInt32LE(56);
		this.OffNextGop = frame_head.readUInt32LE(60);
		this.ChSeq = frame_head.readUInt32LE(64);
		this.Sequence = frame_head.readUInt32LE(68);
/*		this.Reserved2 = new Buffer(16);
		this.Reserved2.fill('');
		for (var i = 0; i < 16; i++) {
			this.Reserved2[i] = frame_head[i + 72];
		}
*/
		this.CheckSum = frame_head.readUInt32LE(88);
		if (data.length > 123) {
			this.pes_head = new PESHead(data.slice(92, 124));
		}

	} else {
		console.log("E: no data, FrameHead");
		return;
	}
}

var StrmPktData = function(data) {
	if (data != null) {
		var strm_data = new Buffer(28);
		strm_data.write(data, 0, strm_data.length, 'binary');
	} else {
		return;
	}

//	var strm_data = data;
	this.StartCode = strm_data.readUInt32LE(0);
	this.Length = strm_data.readUInt32LE(4);
	this.Token = strm_data.readUInt32LE(8);
	this.SendNo = strm_data.readUInt32LE(12);
	this.tp = new Buffer(12);
	this.tp.fill('');
	for (var i = 0; i < 12; i++) {
		this.tp[i] = strm_data[i + 16];
	}
	if (data.length > 28) {
//		console.log("StrmPktData: " + data.length);
		if (data.length > 119) {
			this.frame_head = new FrameHead(data.slice(28, 120));
		}
		if (data.length > 151) {
			this.pes_head = new PESHead(data.slice(120, 152));
		}
/*		for (var i = 152; i < data.length; i++) {
			this.pes_data[i - 152] = data[i];
		}*/
	}
}

module.exports = {
	StrmPktData:		StrmPktData,
	FrameHead:		FrameHead,
	StrmPktHead_length:	28,
	FrameHead_length:	92,
};
