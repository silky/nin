class MainCtrl {
  constructor(socket, demo, commands, $window, $timeout) {
    this.themes = [
      'dark',
      'light'
    ];

    this.fileCache = {};

    this.selectedTheme = localStorage.getItem('selectedTheme') || 'dark';
    commands.on('selectTheme', theme => {
      var foundTheme = false;
      for(var i = 0; i < this.themes.length; i++) {
        if(this.themes[i] == theme) {
          foundTheme = true;
          continue;
        }
      }
      if(!foundTheme) {
        return;
      }
      this.selectedTheme = theme;
      localStorage.setItem('selectedTheme', theme);
    });

    this.menu = [
      {
        name: 'File',
        items: [
          {name: 'Exit', shortcut: 'ESC', click: function() {}}
        ]
      },
      {
        name: 'Playback',
        items: [
          {name: 'Rewind to start', shortcut: 'return', click: function() {
            commands.jumpToFrame(0);
          }},
          {name: 'Rewind one second', shortcut: '.', click: function() {
            commands.jog(-60);
          }},
          {name: 'Forward one second', shortcut: ',', click: function() {
            commands.jog(60);
          }},
          {name: 'Rewind 10 seconds', shortcut: 'K', click: function() {
            commands.jog(-60 * 10);
          }},
          {name: 'Forward 10 seconds', shortcut: 'L', click: function() {
            commands.jog(60 * 10);
          }},
          {name: 'Rewind one frame', shortcut: ';', click: function() {
            commands.jog(-1);
          }},
          {name: 'Forward one frame', shortcut: ':', click: function() {
            commands.jog(1);
          }},
          {name: '-'},
          {name: '0.25x playback rate', shortcut: '1', click: function() {
            commands.setPlaybackRate(0.25);
          }},
          {name: '0.5x playback rate', shortcut: '2', click: function() {
            commands.setPlaybackRate(0.5);
          }},
          {name: '1x playback rate', shortcut: '3', click: function() {
            commands.setPlaybackRate(1);
          }},
          {name: '2x playback rate', shortcut: '4', click: function() {
            commands.setPlaybackRate(2);
          }},
          {name: '4x playback rate', shortcut: '5', click: function() {
            commands.setPlaybackRate(4);
          }},
          {name: '-'},
          {name: 'Set cue point', shortcut: 'g', click: function() {
            commands.setCuePoint();
          }},
          {name: 'Halve loop length', shortcut: 't', click: function() {
            commands.multiplyLoopLengthBy(0.5);
          }},
          {name: 'Double loop length', shortcut: 'y', click: function() {
            commands.multiplyLoopLengthBy(2.0);
          }},
          {name: '-'},
          {name: 'Toggle fullscreen', shortcut: 'm', click: function() {
            commands.toggleFullscreen();
          }},
          {name: 'Mute', shortcut: 'j', click: function() {
            commands.toggleMusic();
          }},
          {name: 'Volume up', shortcut: '+', click: function() {
            commands.volumeDelta(0.1);
          }},
          {name: 'Volume down', shortcut: '-', click: function() {
            commands.volumeDelta(-0.1);
          }},
          {name: 'Play/pause', shortcut: 'space', click: function() {
            commands.playPause();
          }}
        ]
      },
      {
        name: 'Render',
        items: [
          {name: 'Start rendering', click: function() {
            commands.startRendering();
          }},
          {name: 'Stop rendering', click: function() {
            commands.stopRendering();
          }}
        ]
      },
      {
        name: 'Camera',
        items: [
          {name: 'Toggle camera path visualization', click: function() {
            commands.toggleCameraPathVisualizations();
          }}
        ]
      },
      {
        name: 'Generate',
        items: [
          {name: 'Node', click: function() {
            commands.pause();
            const nodeName = $window.prompt("Enter a name for the node:");
            commands.generate('node', nodeName);
          }}
        ]
      },
      {
        name: 'Theme',
        items: [
          {name: 'Dark', click: function() {
            commands.selectTheme('dark');
          }},
          {name: 'Light', click: function() {
            commands.selectTheme('light');
          }}
        ]
      },
      {
        name: 'Help',
        items: [
          {name: 'Online wiki', click: function() {
            $window.open('https://github.com/ninjadev/nin/wiki');
          }}
        ]
      },
    ];

    this.demo = demo;
    this.fullscreen = false;
    this.inspectedLayer = null;
    this.mute = localStorage.getItem('nin-mute') ? true : false;
    if (localStorage.hasOwnProperty('nin-volume')) {
      this.volume = +localStorage.getItem('nin-volume');
    } else {
      this.volume = 1;
    }

    commands.on('generate', (type, name) => {
      socket.sendEvent('generate', {type: type, name: name});
    });

    commands.on('toggleFullscreen', () => {
      this.fullscreen = !this.fullscreen;
    });

    commands.on('toggleMusic', () => {
      this.mute = !this.mute;
      if (this.mute) {
        localStorage.setItem('nin-mute', 1);
      } else {
        localStorage.removeItem('nin-mute');
      }
    });

    commands.on('volumeDelta', delta => {
      this.mute = false;
      this.volume = clamp(0, this.volume + delta, 1);
      localStorage.setItem('nin-volume', this.volume);
    });

    socket.onopen = function() {
      console.log('nin socket connection established', arguments);
    };

    /* http://stackoverflow.com/a/7616484 */
    function hash(string) {
      var h = 0, i, chr, len;
      if (string.length === 0) return h;
      for (i = 0, len = string.length; i < len; i++) {
        chr   = string.charCodeAt(i);
        h = ((h << 5) - h) + chr;
        h |= 0; // Convert to 32bit integer
      }
      return h;
    }

    var layerShaderDependencies = {};
    this.globalJSErrors = this.globalJSErrors || {};
    socket.on('add change', event => {
      try {
        switch (event.type) {
        case 'graph':
          let graph = JSON.parse(event.content);

          for (let nodeInfo of graph) {
            let node = demo.nm.createNode(nodeInfo);

            try {
              demo.nm.insertOrReplaceNode(node);
            } catch (e) {
              // This hack only works due to not-yet received
              // nodes created through generate not having
              // any connections / friends.
              $timeout(function () {
                demo.nm.insertOrReplaceNode(node);
              }, 100);
            }
          }

          for (let nodeInfo of graph) {
            for (let outputName in nodeInfo.connectedTo) {
              let toNodeId = nodeInfo.connectedTo[outputName].split('.')[0];
              let inputName = nodeInfo.connectedTo[outputName].split('.')[1];
              demo.nm.connect(
                nodeInfo.id,
                outputName,
                toNodeId,
                inputName);
            }
          }

          this.graph = graph;
          Loader.start(function() {}, function() {});
          break;

        case 'camera':
          for (let key in demo.nm.nodes) {
            if (demo.nm.nodes[key] instanceof NIN.CameraNode) {
              if (demo.nm.nodes[key].options.path == event.path) {
                demo.nm.nodes[key].initializeCamera(event.content);
              }
            }
          }
          break;

        case 'shader':
          var indirectEval = eval;
          this.fileCache[event.path] = event.content;
          indirectEval(event.content);

          for (var i in this.layers) {
            var layer = this.layers[i];
            if (layerShaderDependencies[layer.type]) {
              if (layerShaderDependencies[layer.type].indexOf(event.shadername) !== -1) {
                demo.nm.refresh(layer.type);
              }
            }
          }

          demo.nm.update(demo.looper.currentFrame);
          Loader.start(function() {}, function() {});
          break;

        case 'node':
          this.fileCache[event.path] = event.content;
          var indirectEval = eval;
          indirectEval(event.content);

          var splitted = event.path.split('/');
          var filename = splitted[splitted.length - 1];
          var typename = filename.slice(0, -3);
          if(this.graph) {
            for(var i = 0; i < this.graph.length; i++) {
              var nodeInfo = this.graph[i];
              if(nodeInfo.type == typename) {
                var node = demo.nm.createNode(nodeInfo);
                demo.nm.insertOrReplaceNode(node);
              }
            }
          }

          demo.nm.update(demo.looper.currentFrame);
          Loader.start(function() {}, function() {});
          break;
        }

        delete this.globalJSErrors[event.type];
      } catch (e) {
        e.context = "WS load of " + event.path + " failed";
        e.type = event.type;
        e.path = event.path;
        this.globalJSErrors[event.type] = e;
      }
    });

    socket.onclose = e => {
      console.log('nin socket connection closed', e);
      this.disconnected = true;
    };
  }
}

module.exports = MainCtrl;
