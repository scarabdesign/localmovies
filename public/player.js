
var Player = function(dataObject, dispatch){
	this.dataObject = dataObject;
	this.dispatch = dispatch;
	this.type;
	this.moviePlayer;
	this.ui = {};
	this.fadeTimer;
	this.currentList = [];
	this.listeners = {};
	this.currentMovie;
	
	var self = this;
	this.initPanel(function(){
		self.loadPlayerOptions();
		self.loadCurrentMovieScreen();
	});
};

Player.prototype.setType = function(){
	var t = document.createElement("video")
	this.type = t.play ? "html5" : "iframe";
};

Player.prototype.setListeners = function(events, target, callback){
	for(var i = 0, l = events.length; i < l; ++i){
		var e = events[i];
		if(!this.listeners[e]){
			this.listeners[e] = [];
		}
		this.listeners[e].push({
			"target": target,
			"callback": callback
		});
	}
};

Player.prototype.loadPlayerOptions = function(){
	var muted = this.getOption("muted") || false;
	this.moviePlayer.muted(muted);
	var volume = this.getOption("volume");
	if(volume != undefined){
		this.moviePlayer.volume(volume);
	}
};

Player.prototype.getDimensions = function(){
	var windowWidth = $(window).width();

	var width;
	if(this.moviePlayer){
		width = this.moviePlayer.videoWidth();
	}else{
		width = windowWidth;
	}
	
	var height;
	if(this.moviePlayer){
		height = this.moviePlayer.videoHeight();
	}else{
		height = 300;
	}
	
	if(width > windowWidth){
		width = windowWidth;
	}
	if(width > 640){
		width = 640;
	}
	
	if(width < 300){
		width = 300;
	}
	
	if(height > 300){
		height = 300;
	}
	
	return {
		"width": width,
		"height": height
	};
};

Player.prototype.setDim = function(){
	var dim = this.getDimensions();
	dim.height ? this.moviePlayer.height(dim.height) : this.moviePlayer.width(dim.width);
};

Player.prototype.clearCurrentMovie = function(){
	
	if(this.currentMovie && this.currentMovie.movieItem){
		if(this.currentMovie.mediatype == "karaoke"){
			this.currentMovie.movieItem.reset();
		}
		
		this.removeItemFromQueue(this.currentMovie);
		if(this.currentMovie.mediatype == "movies"){
			this.dispatch.clearTimesForMovie(this.currentMovie);
		}
	}
	
	this.dataObject.clearMovie("currentMovie");
	this.currentMovie = null;
};

Player.prototype.setCurrentMovie = function(movie){
	this.currentMovie = movie || this.currentMovie;
	this.dataObject.storeMovie("currentMovie", this.currentMovie);
};

Player.prototype.loadCurrentMovieScreen = function(){
	var movie = this.dataObject.getStoredMovie("currentMovie");
	if(!movie){
		return;
	}
	this.setMovieTitle(movie);
	this.showMovieScreen(movie);
};

Player.prototype.bigButtonAdjustment = function(movie){
	var player = this.moviePlayer.el();
	var bButton = this.moviePlayer.bigPlayButton.el();
	var poH = $(player).height();
	var poW = $(player).width();
	var bbH = $(bButton).height();
	var bbW = $(bButton).width();
	var self = this;
	this.moviePlayer.bigPlayButton.hide();
	setTimeout(function(){
		$(self.moviePlayer.bigPlayButton.contentEl())
			.css({
				"top": Math.round((poH / 2) - (bbH / 2)),
				"left": Math.round((poW / 2) - (bbW / 2))
			})
			.on("click", function(){
				self.loadCurrentMovie();
			});
		self.moviePlayer.bigPlayButton.show();
	}, 0);
};

Player.prototype.showMovieScreen = function(movie){
	if(movie.movieItem){
		var url = this.getCurrentScreen(movie);
		this.setPoster(url);
		this.bigButtonAdjustment(movie);
		this.showPlayer();
	}
};

Player.prototype.setPoster = function(url){
	this.moviePlayer.poster(url);
};

Player.prototype.clearPoster = function(){
	this.setPoster("");
};

Player.prototype.getCurrentScreen = function(movie){
	var url = this.dispatch.getStoredScreen(movie);
	if(!url){
		url = movie.movieItem.getMovieScreenUrl();
		this.dispatch.storeScreen(movie);
	}
	return url;
};

Player.prototype.loadCurrentMovie = function(){
	var movie = this.dataObject.getStoredMovie("currentMovie");
	if(!movie){
		return;
	}
	if(movie.mediatype == "television"){
		return this.dispatch.queueSeriesAndPlayNext(movie);
	}
	this.newQueue([movie]);
	this.moviePlayer.autoplay(false);
	this.startQueue();
};

Player.prototype.setMovieOption = function(key, value){
	if(!this.currentMovie){
		return;
	}
	this.currentMovie[key] = value;
	if(this.currentMovie.movieItem){
		this.currentMovie.movieItem.updateOption(key, value);
	}
};

Player.prototype.setOption = function(key, value){
	this.dataObject.storeOption(key, value);
};

Player.prototype.getOption = function(key){
	return this.dataObject.getStoredOption(key);
};

Player.prototype.onError = function(){
	var self = this;
	setTimeout(function(){
		var error = self.moviePlayer.error();
		auth.authCheck(function(){
			self.hidePlayer();
			if(error){
				console.log(error);
				if(error.code == 4){
					self.dataObject.onErrorCleanup(self.currentMovie.dir);
					self.clearCurrentMovie();
				}
			}
		})
	}, 0);
}

Player.prototype.playNext = function(){
	this.clearCurrentMovie();
	this.startQueue();
};

Player.prototype.playPrev = function(){
	this.dispatch.queueSeriesAndPlayPrev(this.currentMovie);
};

Player.prototype.events = {
	"mouseover": function(self){
		self.titleFlash();
	},
	"mouseout": function(self){
		self.titleFade();
	},
	"ended": function(self){
		self.playNext();
	},
	"canplay": function(self){
		self.loadPlayerOptions();
		self.setDim();
	},
	"timeupdate": function(self){
		if(self.currentMovie){
			self.setMovieOption("time", self.moviePlayer.currentTime());
			self.dataObject.saveTime(self.currentMovie);
		}
	},
	"volumechange": function(self){
		var vol = self.moviePlayer.volume() || 0.1;
		self.setOption("volume", vol);
		self.setOption("muted", self.moviePlayer.muted());
	},
	"durationchange": function(self){
		self.setMovieOption("duration", self.moviePlayer.duration());
		self.setCurrentMovie();
	},
	"error": function(self){
		self.onError();
	},
	"loadeddata": function(self){
		self.setDim();
		self.adjustControls();
		self.setMovieTitle(self.currentMovie);
		self.clearPoster();
	}
};

Player.prototype.onEvent = function(event){
	var self = event.data.self;
	var type = event.type;
	setTimeout(function(){
		self.events[type] && self.events[type](self);
		if(self.listeners[type]){
			for(var i = 0, l = self.listeners[type].length; i < l; ++i){
				var evCb = self.listeners[type][i];
				evCb.callback.apply(evCb.target, [self.currentMovie]);
			}
		}
	}, 0);
};

Player.prototype.initPanel = function(callback){
	this.setType();
	var self = this;
	var dim = this.getDimensions();
	if(this.type == "html5"){
		var moviePanel = $(ce("video"))
			.addClass("video-js hidden")
			.attr({
				"id": "playerElem"
			})
			.on("mouseover mouseout ended canplay timeupdate volumechange durationchange loadeddata error", 
				{"self": this}, 
				this.onEvent
			);
		
//			.on("abort canplay canplaythrough durationchange emptied ended error loadeddata loadedmetadata loadstart pause play " +
//					"playing progress ratechange seeked seeking stalled suspend timeupdate volumechange waiting", function(e){
//				console.log(e.type);
//			});

		$(".player_panel")
			.append(moviePanel)
			.on("mouseover", function(){
				self.titleFlash();
			});
		
		this.moviePlayer = videojs("playerElem", {
				"preload": "auto",
				"autoplay": false,
				"controls": true,
				"height": dim.height,
				"width": dim.width,
				"data-setup": "{}"
			}, function(){
			self.makeControlButtons();
			callback && callback();
		});
	}
	
	if(this.type == "iframe"){
		this.moviePlayer = $(ce("iframe"))
			.attr({
				"id": "play_box",
				"name": "play_box",
				"class": "play_box",
				"width": dim.width,
				"height": dim.height,
				"frameborder": 0
			}).on("blur", function(){
				this.focus();
			});
		$(".player_panel").append(
			$(ce("div"))
				.attr({
					"width": dim.width,
					"height": dim.height
				})
				.addClass("blackdrop")
				.append(this.moviePlayer)
		);
		callback && callback();
	}
	this.shortcutKeys();
};

Player.prototype.makeControlButtons = function(){
	var self = this;
	if(!this.ui.nextButton){
		this.ui.nextButton = this.moviePlayer
			.controlBar
			.addChild('button')
			.addClass("fa")
			.addClass("fa-fast-forward")
			.addClass("player_control_button")
			.addClass("clickable")
			.on("click", function(){
				self.playNext();
			});
			
		$(this.moviePlayer.controlBar.el())
	    	.append(this.ui.nextButton.el());
		
		$(this.ui.nextButton.el())
			.attr({
				"title": "Play next"
			});
	}
	
	if(!this.ui.restartButton){
		this.ui.restartButton = this.moviePlayer
			.controlBar
			.addChild('button')
			.addClass("fa")
			.addClass("fa-step-backward")
			.addClass("player_control_button")
			.addClass("clickable")
			.on("click", function(){
				self.restartMovie();
			});
		
		$(this.moviePlayer.controlBar.el())
	    	.prepend(this.ui.restartButton.el());
		
		$(this.ui.restartButton.el())
			.attr({
				"title": "Restart"
			});
	};
	
	if(!this.ui.prevButton){
		this.ui.prevButton = this.moviePlayer
			.controlBar
			.addChild('button')
			.addClass("fa")
			.addClass("fa-fast-backward")
			.addClass("player_control_button")
			.addClass("clickable")
			.on("click", function(){
				self.playPrev();
			});
		
		$(this.moviePlayer.controlBar.el())
	    	.prepend(this.ui.prevButton.el());
		
		$(this.ui.prevButton.el())
			.attr({
				"title": "Play previous"
			});
	};
	
	if(!this.ui.titleElem){
		this.ui.titleElem = $(ce("div"))
			.addClass("title_flash")
		$(this.moviePlayer.el())
			.append(this.ui.titleElem);
	}
};

Player.prototype.toggleButton = function(button, onOff){
	$(button.el())
		.removeClass(onOff ? "hide": null)
		.addClass(!onOff ? "hide": null)
};

Player.prototype.adjustControls = function(){
	this.toggleButton(this.ui.nextButton, false);
	if(this.currentList.length > 1){
		this.toggleButton(this.ui.nextButton, true);
	}
	
	this.toggleButton(this.ui.prevButton, false);
	if(this.currentMovie && this.currentMovie.mediatype == "television"){
		this.toggleButton(this.ui.prevButton, true);
	}
};

Player.prototype.fadeElem = function(elem){
	clearTimeout(this.fadeTimer);
	$(elem)
		.stop()
		.animate({
			"opacity": 0
		}, 2000,
		function(){
			$(elem)
				.stop()
		});
};

Player.prototype.flashElem = function(elem){
	$(elem)
		.stop()
		.css({
			"opacity": 1
		});
	
	var self = this;
	clearTimeout(this.fadeTimer);
};

Player.prototype.titleFade = function(){
	this.fadeElem(this.ui.titleElem);
};

Player.prototype.titleFlash = function(){
	this.flashElem(this.ui.titleElem);
	var self = this;
	this.fadeTimer = setTimeout(function(){
		self.titleFade();
	}, 5000);
};

Player.prototype.setMovieTitle = function(movie){
	if(movie && this.ui.titleElem){
		$(this.ui.titleElem)
			.empty()
			.append(
				movie.movieItem.fullTitle()
			);
		this.titleFlash();
		this.setDocumentTitle(movie);
	}
};

Player.prototype.setDocumentTitle = function(movie){
	if(movie){
		document.title = movie.movieItem.getReverseFullTitle() + " :: Movies";
	}
};

Player.prototype.play = function(dir, ignoreTime){
	if(!dir){
		return;
	}
	
	var movie = this.dataObject.getCachedItem(dir);
	movie.movieItem.scrollLeftTo();
	if(this.currentMovie && this.currentMovie.dir == movie.dir){
		return this.togglePlayback();
	}
	
	this.clearCurrentMovie();
	this.setCurrentMovie(movie);
	
	if(this.type == "html5"){
		this.moviePlayer.src(this.prepSrc(movie.dir));
		if(!movie.movieItem.isDone()){
			this.moviePlayer.currentTime(movie.time);
		}
	}
	this.showPlayer();
	this.togglePlayback();
}

Player.prototype.prepSrc = function(dir){
	return dir + "?service=movies";
};

Player.prototype.showPlayer = function(){
	$(this.moviePlayer.el()).removeClass("hidden");
};

Player.prototype.hidePlayer = function(){
	$(this.moviePlayer.el()).addClass("hidden");
};

Player.prototype.togglePlayback = function(){
	if(!this.moviePlayer || !this.currentMovie){
		return;
	}
	if(this.type == "html5"){
		if(this.moviePlayer.paused()){
			this.moviePlayer.play();
		}else{
			this.moviePlayer.pause();
		}
	}
	if(this.type == "iframe"){
		$(this.moviePlayer)
			.attr({
				"src": this.prepSrc(movie.dir)
			});
	}
};

Player.prototype.getQueuePaths = function(movies){
	if(!movies){
		return;
	}
	if(!(movies instanceof Array)){
		movies = [movies];
	}
	var paths = [];
	for(var i = 0, l = movies.length; i < l; ++i){
		paths.push(movies[i].dir);
	}
	return paths;
};

Player.prototype.addItemsToEnd = function(movies){
	var items = this.getQueuePaths(movies);
	this.currentList = this.currentList.concat(items);
	this.dataObject.saveQueue(this.currentList);
};

Player.prototype.addItemsToBegining = function(movies){
	var items = this.getQueuePaths(movies);
	this.currentList = items.concat(this.currentList);
	this.play(this.currentList[0]);
	this.dataObject.saveQueue(this.currentList);
};

Player.prototype.addItemsNext = function(movies){
	if(!this.currentMovie){
		return this.addItemsToBegining(movies);
	}
	var items = this.getQueuePaths(movies);
	var index = this.currentList.indexOf(this.currentMovie.dir);
	var args = [index + 1, 0].concat(items);
	Array.prototype.splice.apply(this.currentList, args);
	this.dataObject.saveQueue(this.currentList);
};

Player.prototype.newQueue = function(movies){
	this.currentList = this.getQueuePaths(movies);
	this.dataObject.saveQueue(this.currentList);
};

Player.prototype.removeItemFromQueue = function(movie){
	var items = this.getQueuePaths(movie);
	var index = this.currentList.indexOf(items[0]);
	if(index > -1){
		this.currentList.splice(index, 1);
		this.dataObject.saveQueue(this.currentList);
	}
};

Player.prototype.startQueue = function(ignoreTime){
	if(!this.currentList.length){
		return;
	}
	this.play(this.currentList[0], ignoreTime);
};

Player.prototype.playNextUnplayed = function(){
	if(!this.currentList.length){
		return;
	}
	var movie = this.dataObject.getCachedItem(this.currentList[0]);
	if(movie && movie.movieItem.isDone()){
		this.removeItemFromQueue(movie);
		return this.playNextUnplayed();
	}
	this.play(this.currentList[0]);
};

Player.prototype.trackBack = function(shift){
	if(this.currentMovie && this.currentMovie.time){
		this.currentMovie.time = this.currentMovie.time - (shift ? 10 : 1);
		this.moviePlayer.currentTime(this.currentMovie.time);
	}
};

Player.prototype.trackForward = function(shift){
	if(this.currentMovie && this.currentMovie.time){
		this.currentMovie.time = this.currentMovie.time + (shift ? 10 : 1);
		this.moviePlayer.currentTime(this.currentMovie.time);
	}
};

Player.prototype.restartMovie = function(){
	this.dispatch.clearTimesForMovie(this.currentMovie);
	this.setMovieOption("time", 0);
	this.moviePlayer.currentTime(0);
};

Player.prototype.shortcuts = {
	"32": function(target){
		target.togglePlayback();
	},
	"37": function(target, shift){
		target.trackBack(shift);
	},
	"39": function(target, shift){
		target.trackForward(shift);
	}
}

Player.prototype.shortcutKeys = function(){
	if(this.type == "html5"){
		var self = this;
		$(document.body)
			.on("keydown", function(e){
				var stopProp = function(){
					e.stopImmediatePropagation();
					e.preventDefault();
				};
				if(self.shortcuts[e.which]){
					stopProp();
					self.shortcuts[e.which](self, e.shiftKey);
				}
			});
	}
};
