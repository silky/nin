function loadMusic() {
  var webAudioContext = new window.AudioContext();
  var _bufferSource;
  var _buffer;
  var _loaded = false;
  Loader.loadAjax('res/music.mp3', {responseType: 'arraybuffer'}, function(data) {
    webAudioContext.decodeAudioData(data, function(buffer) {
      _buffer = buffer;
      _loaded = true;
    });
  });
  var _gainNode = webAudioContext.createGain();
  _gainNode.gain.value = 1;
  _gainNode.connect(webAudioContext.destination);

  var _currentLocalTime = 0;
  var _globalTimeOffset = 0;
  var _playbackRate = 1;

  return {
    paused: false,

    setCurrentTime: function(currentTime) {
      _currentLocalTime = currentTime;
      _globalTimeOffset = webAudioContext.currentTime;
      if(!this.paused) {
        this.play();
      }
    },

    setPlaybackRate: function(playbackRate) {
      var shouldPlay = !this.paused;
      this.pause();
      _playbackRate = playbackRate;
      if(shouldPlay) {
        this.play();
      }
    },

    getCurrentTime: function() {
      var currentTime = _currentLocalTime;
      if(!this.paused) {
        currentTime = _currentLocalTime + (webAudioContext.currentTime - _globalTimeOffset) * _playbackRate;
      }
      if(currentTime > this.getDuration()) {
        currentTime = this.getDuration();
      }
      return currentTime;
    },

    setVolume: function(volume) {
      _gainNode.gain.value = volume;
    },

    play: function() {
      if(!_loaded) {
        return;
      }
      _globalTimeOffset = webAudioContext.currentTime;
      this.paused = false;
      _bufferSource && _bufferSource.stop();
      _bufferSource = webAudioContext.createBufferSource();
      _bufferSource.buffer = _buffer;
      _bufferSource.connect(_gainNode);
      _bufferSource.start(0, _currentLocalTime);
      _bufferSource.playbackRate.value = _playbackRate;
    },

    getDuration: function() {
      return _buffer && _buffer.duration;
    },

    pause: function() {
      this.setCurrentTime(this.getCurrentTime());
      this.paused = true;
      _bufferSource && _bufferSource.stop();
    }
  }
}
