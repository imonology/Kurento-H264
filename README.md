# Kurento-H264
creating end-to-end connection from RTSP source to Firefox H264 WebRTC

# Goals
1. Develop the demonstrator for a H.264-only Kurento pipeline using GKB IPcam as RTSP source
	
# IPcam Access
rtsp://163.22.32.118/live1.sdp
rtsp://163.22.32.62/live1.sdp
rtsp://140.109.221.238/live1.sdp	
	

# Requirements (holistic view)

1. our video sources are:
   * IP cam (H.264 encoded RTSP streams)
   * DVR (H.264 encoded via custom socket-based protocol)

2. for each video source, we'll need to be able to:
   * live view the stream (in low-res and HD)
   * record the stream (in HD)
   * replay a recorded stream (in low-res and HD, with fast forward/backward, pause capabilities)

3. support the following number of simultaneous streams on an "adequate server":
  * 32 streams of live-view (low-res display in grid, HD when enlarged for a single stream)
  * 32 streams of recording (in HD)
  * 16 streams of playback (low-res display in grid, HD when enlarged for a single stream)

Our goal is to achieve the above by end of this year, and our prototype can now functionally do 1) & 2) (pending stability tuning) for 4 channels ONLY on a given target server.

The main performance bottleneck identified so far is the trans-coding from H.264 to VP8 format (for live-view, record, and playback).

Luis's summary of requirements:

1. You have your RTSP/H.264 streams received in real-time at Kurento.
2. Kurento records those streams in MP4 blocks without any transcoding (I assume audio is coming in PCM format)
3. Kurento serves those streams through H.264+WebRTC without transcoding to Firefox browsers (audio in PCM, if audio needs to be in Opus, then, transcoding would be necessary for the audio). Chrome might support also this in a few months with high probability.
4. Kurento provides the capability of playing pre-recorderd files with pause and fast ff/bw functions. This requires transcoding (one transcoding per stream being viewed).

# Contacts
Mo-Che (MC):
skype: chryslerwrangler
phone: +886-921541878

Matthew (BlueT):
skype: bluet_dot_org
phone: +886-953033076

Shun-Yun (SY):
skype: shunyunhu
mail: syhu@imonology.com
phone: +886-925097273