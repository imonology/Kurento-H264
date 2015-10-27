# Kurento-H264
creating end-to-end connection from RTSP source to Firefox H264 WebRTC


# Requirements 

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

Luis has summarized our requirements as follow, which is correct, though due to budget & time constrain, we'd like to focus on the first three first:

1. You have your RTSP/H.264 streams received in real-time at Kurento.
2. Kurento records those streams in MP4 blocks without any transcoding (I assume audio is coming in PCM format)
3. Kurento serves those streams through H.264+WebRTC without transcoding to Firefox browsers (audio in PCM, if audio needs to be in Opus, then, transcoding would be necessary for the audio). Chrome might support also this in a few months with high probability.
4. Kurento provides the capability of playing pre-recorderd files with pause and fast ff/bw functions. This requires transcoding (one transcoding per stream being viewed).

So the goal we'd like to achieve with the consultant is to develop the demonstrator for this H.264-only Kurento pipeline. 