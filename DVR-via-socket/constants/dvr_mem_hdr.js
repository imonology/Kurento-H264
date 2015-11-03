const MOTION_ACTS = {"id": 0, "length": 160};
const VLOSS_ACTS = {"id": 1, "length": 160};
const ALARM_ACTS = {"id": 2, "length": 160};
const HDD_FULL_ACT = {"id": 3, "length": 6};
const ALARM_HDD_FULL_ACT = {"id": 4, "length": 6};
const AUTH = {"id": 5, "length": 559};
const AUX_FTP = {"id": 6, "length": 163};
const AUX_SERIAL = {"id": 7, "length": 25};
const AUX_MAIL = {"id": 8, "length": 651};
const NETWORK = {"id": 9, "length": 243};
const SYSTEM = {"id":10, "length": 100};
const AIS_ATTR = {"id": 11, "length": 192};
const MOTION_ATTRS = {"id": 12, "length": 1604};
const CAMERAS_ATTR = {"id": 13, "length": 452};
const RECORD_WEEK_SCHEDULE = {"id": 14, "length": 576};
const MAIN_SEQ = {"id": 15, "length": 10};
const CALL_MON_SEQ = {"id": 16, "length": 10};
const MAIN_STATIC = {"id": 17, "length": 10};
const VOLUME = {"id": 18, "length": 10};
const MAX = {"id": 19, "length": 10};

module.exports = {
	MOTION_ACTS : MOTION_ACTS,
	VLOSS_ACTS : VLOSS_ACTS,
	ALARM_ACTS : ALARM_ACTS,
	HDD_FULL_ACT : HDD_FULL_ACT,
	ALARM_HDD_FULL_ACT : ALARM_HDD_FULL_ACT,
	AUTH : AUTH,
	AUX_FTP : AUX_FTP,
	AUX_SERIAL : AUX_SERIAL,
	AUX_MAIL : AUX_MAIL,
	NETWORK : NETWORK,
	SYSTEM : SYSTEM,
	AIS_ATTR : AIS_ATTR,
	MOTION_ATTRS : MOTION_ATTRS,
	CAMERAS_ATTR : CAMERAS_ATTR,
	RECORD_WEEK_SCHEDULE : RECORD_WEEK_SCHEDULE,
	MAIN_SEQ : MAIN_SEQ,
	CALL_MON_SEQ : CALL_MON_SEQ,
	MAIN_STATIC : MAIN_STATIC,
	VOLUME : VOLUME,
	MAX : MAX
};
