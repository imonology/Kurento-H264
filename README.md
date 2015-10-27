# Kurento-H264
creating end-to-end connection from RTSP source to Firefox H264 WebRTC


# Requirements 

(holistically viewed):

1) our video sources are:
   a) IP cam (H.264 encoded RTSP streams)
   b) DVR (H.264 encoded via custom socket-based protocol)

2) for each video source, we'll need to be able to:
   a) live view the stream (in low-res and HD)
   b) record the stream (in HD)
   c) replay a recorded stream (in low-res and HD, with fast forward/backward, pause capabilities)

3) support the following number of simultaneous streams on an "adequate server":
  a) 32 streams of live-view (low-res display in grid, HD when enlarged for a single stream)
  b) 32 streams of recording (in HD)
  c) 16 streams of playback (low-res display in grid, HD when enlarged for a single stream)

Our goal is to achieve the above by end of this year, and our prototype can now functionally do 1) & 2) (pending stability tuning) for 4 channels ONLY on a given target server.

The main performance bottleneck identified so far is the trans-coding from H.264 to VP8 format (for live-view, record, and playback).

We'd thus like to have the capability to ONLY use H.264 encoding "throughout" the entire video pipeline (i.e., live-view, record, and playback all in H.264), to avoid the CPU-intensive trans-coding, and achieve our targeted 32 streams.

From our previous discussions with Luis, our current understanding is summarized as follows (please correct if we get it wrong):

1. Such H.264-ONLY WebRTC processing pipeline is possible with Kurento, though currently only Firefox supports H.264 decoding.

2. However, a minor possibility exists that our video source's encoding may not be recongized by Firefox.
   see Luis's comment:
    My personal opinion is that, with this hourly-based model, we could have a successful demonstrator of what you want with 95% of probabilities, being the 5% of failure probability mainly associated to incompatibility problems on the H.264 specific profiles between your RTSP sources and Firefox.
3. If we want server (KMS)-enabled fast forward/backward/pause, transcoding is a MUST.

Luis has summarized our requirements as follow, which is correct, though due to budget & time constrain, we'd like to focus on the first three first:

1. You have your RTSP/H.264 streams received in real-time at Kurento.
2. Kurento records those streams in MP4 blocks without any transcoding (I assume audio is coming in PCM format)
3. Kurento serves those streams through H.264+WebRTC without transcoding to Firefox browsers (audio in PCM, if audio needs to be in Opus, then, transcoding would be necessary for the audio). Chrome might support also this in a few months with high probability.
4. Kurento provides the capability of playing pre-recorderd files with pause and fast ff/bw functions. This requires transcoding (one transcoding per stream being viewed).

So the goal we'd like to achieve with the consultant is to develop the demonstrator for this H.264-only Kurento pipeline. 